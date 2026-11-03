#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { validateRequest, validateAnswers } = require('./schema');
const { loadConfig, assertJiraConfig } = require('./config');
const { writeArtifacts, ARTIFACT_NAMES: A } = require('./artifacts');
const { extractKeyTerms } = require('./steps/extractKeyTerms');
const { searchDuplicates, formatCandidatesMarkdown, buildDuplicateDecision } = require('./steps/searchDuplicates');
const { generateQuestions, duplicateConfirmationQuestions, formatQuestionsMarkdown } = require('./steps/generateQuestions');
const { draftStory } = require('./steps/draftStory');
const { createOrUpdateStory } = require('./steps/createOrUpdateStory');
const { createJiraClient } = require('../jira/client');

/**
 * Orchestrate BA Intake. Side effects are limited to artifact writes and the
 * (injectable) Jira client.
 *
 * options: { mode: 'dry-run'|'create', duplicateOf, allowDuplicate, offline,
 *            rootDir, now, client }
 */
async function runBaIntake({ request, answers = {}, options = {}, config = loadConfig() }) {
  const now = options.now || (() => new Date());
  const startedAt = now().toISOString();
  const rootDir = options.rootDir || process.cwd();

  const v = validateRequest(request);
  if (!v.valid) throw new Error(`Invalid request: ${v.errors.join('; ')}`);
  const a = validateAnswers(answers);
  if (!a.valid) throw new Error(`Invalid answers: ${a.errors.join('; ')}`);
  const req = v.value;
  const duplicateOf = options.duplicateOf;
  if (duplicateOf !== undefined && !/^[A-Z][A-Z0-9_]+-[0-9]+$/.test(duplicateOf)) {
    throw new Error('--duplicate-of must be an issue key like ABC-123');
  }
  const sourceIssueKey = req.source && req.source.issueKey;

  // Jira mutations need an explicit create request AND dry-run switched off.
  const wantsMutation = options.mode === 'create' && !config.dryRun;
  const mode = !wantsMutation ? 'dry-run' : duplicateOf ? 'update' : 'create';

  const { terms, proposedSummary } = extractKeyTerms({ requestText: req.requestText, title: req.title });

  let client = options.client;
  if (!options.offline || mode !== 'dry-run') {
    assertJiraConfig(config);
    client = client || createJiraClient(config.jira);
  }

  let jql = null;
  let candidates = [];
  if (!options.offline) {
    ({ jql, candidates } = await searchDuplicates({
      client,
      projectKey: config.projectKey,
      terms,
      limit: config.searchLimit,
      excludeKeys: sourceIssueKey ? [sourceIssueKey] : [],
    }));
  }

  const q = generateQuestions({ requestText: req.requestText, answers: a.value });
  const questions = duplicateOf ? duplicateConfirmationQuestions(duplicateOf) : q.questions;
  const state = duplicateOf ? 'DUPLICATE_RECOMMENDED' : q.state;

  const story = draftStory({
    requestText: req.requestText,
    title: req.title,
    proposedSummary,
    details: q.details,
  });

  let jiraResult;
  if (state === 'NEEDS_INPUT') {
    jiraResult = { action: 'skipped', reason: 'clarifying questions are unanswered' };
  } else {
    jiraResult = await createOrUpdateStory({
      client,
      mode,
      requestId: req.requestId,
      projectKey: config.projectKey,
      issueType: config.issueType,
      linkType: config.linkType,
      summary: (req.title || proposedSummary).slice(0, 255),
      storyDraftMd: story,
      duplicateOf,
      candidates,
      threshold: config.duplicateThreshold,
      allowDuplicate: Boolean(options.allowDuplicate),
      sourceIssueKey,
    });
  }

  const files = {
    [A.intake]: {
      requestId: req.requestId,
      title: req.title || null,
      source: req.source || null,
      // Email is PII and is deliberately not persisted in artifacts.
      requester: req.requester ? { name: req.requester.name || null } : null,
      links: req.links,
      constraints: req.constraints || null,
      requestText: req.requestText,
      keyTerms: terms,
      proposedSummary,
    },
    [A.questions]: formatQuestionsMarkdown({ requestId: req.requestId, state, questions }),
    [A.story]: story,
  };
  if (!options.offline) {
    files[A.candidates] = { requestId: req.requestId, jql, candidates };
    files[A.candidatesMd] = formatCandidatesMarkdown({ requestId: req.requestId, jql, candidates });
  }
  if (duplicateOf) {
    const d = buildDuplicateDecision({ requestId: req.requestId, duplicateOf, sourceIssueKey });
    files[A.decision] = [
      `# Duplicate decision - ${req.requestId}`,
      '',
      `Duplicate of: ${d.duplicateOf}`,
      '',
      d.recommendedAction,
      '',
      'Comment text:',
      '',
      `> ${d.commentText}`,
      '',
    ].join('\n');
  }

  const summary = {
    requestId: req.requestId,
    state,
    mode,
    startedAt,
    finishedAt: now().toISOString(),
    jql,
    candidateCount: candidates.length,
    questionCount: questions.length,
    jira: jiraResult,
    artifacts: [...Object.keys(files), A.summary].sort(),
  };
  files[A.summary] = summary;
  writeArtifacts({ rootDir, requestId: req.requestId, files });
  return summary;
}

const VALUE_FLAGS = ['--input', '--answers', '--duplicate-of', '--source-issue'];
const BOOL_FLAGS = ['--create-story', '--allow-duplicate', '--offline', '--help'];

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (VALUE_FLAGS.includes(arg)) {
      if (argv[i + 1] === undefined) throw new Error(`Missing value for ${arg}`);
      flags[arg.slice(2)] = argv[i + 1];
      i += 1;
    } else if (BOOL_FLAGS.includes(arg)) {
      flags[arg.slice(2)] = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return { flags };
}

const USAGE = [
  'Usage: npm run ba:intake -- --input <request.json> [--answers <answers.json>]',
  '       [--duplicate-of KEY] [--source-issue KEY] [--create-story] [--allow-duplicate] [--offline]',
].join('\n');

async function main(argv = process.argv.slice(2)) {
  const { flags } = parseArgs(argv);
  if (flags.help || !flags.input) {
    console.log(USAGE);
    return flags.help ? 0 : 1;
  }
  const readJson = (p) => JSON.parse(fs.readFileSync(path.resolve(p), 'utf8'));
  const request = readJson(flags.input);
  if (flags['source-issue']) request.source = { ...(request.source || {}), issueKey: flags['source-issue'] };
  const summary = await runBaIntake({
    request,
    answers: flags.answers ? readJson(flags.answers) : {},
    options: {
      mode: flags['create-story'] ? 'create' : 'dry-run',
      duplicateOf: flags['duplicate-of'],
      allowDuplicate: Boolean(flags['allow-duplicate']),
      offline: Boolean(flags.offline),
    },
  });
  console.log(`BA Intake ${summary.requestId}: state=${summary.state} mode=${summary.mode} jira=${summary.jira.action}`);
  console.log(`Artifacts: artifacts/ba/${summary.requestId}/`);
  return 0;
}

if (require.main === module) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(`BA Intake failed: ${err.message}`);
      process.exit(1);
    }
  );
}

module.exports = { runBaIntake, parseArgs, main };
