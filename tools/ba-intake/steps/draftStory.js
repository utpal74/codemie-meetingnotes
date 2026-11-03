'use strict';

const { renderTemplate } = require('../templates/render');

const HEADINGS = [
  'Summary',
  'General description',
  'Preconditions',
  'Scenarios of use (Gherkin)',
  'Acceptance criteria',
];

const TBD = 'TBD';

function oneLine(s, max) {
  const t = String(s).replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 3)}...` : t;
}

/**
 * Build the story draft. Missing details stay visible as TBD so reviewers
 * can see what still needs an answer.
 */
function draftStory({ requestText, title, proposedSummary, details = {} }) {
  const d = (k) => details[k] || TBD;
  const summary = oneLine(title || proposedSummary || requestText, 120);
  const mainName = 'Main flow';
  const altName = 'Alternative flow - invalid or incomplete input';

  const preconditions = [
    `- ${d('actor')} has access to the capability.`,
    '- Required reference data and permissions are in place.',
  ].join('\n');

  const scenarios = [
    '```gherkin',
    `Scenario: ${mainName}`,
    `  Given ${d('actor')} is ready to proceed`,
    `  When ${d('trigger')}`,
    `  Then ${d('outcome')}`,
    '',
    `Scenario: ${altName}`,
    `  Given ${d('actor')} provides invalid or incomplete input`,
    '  When the action is submitted',
    '  Then the system rejects it with a clear message and nothing is changed',
    '```',
  ].join('\n');

  const acceptance = [
    `- AC-1: Scenario "${mainName}" passes: ${d('goal')}.`,
    `- AC-2: Scenario "${altName}" passes without side effects.`,
    `- AC-3: Business rule is enforced: ${d('rule')}.`,
  ].join('\n');

  const description = requestText.trim();
  return renderTemplate('story_draft', { summary, description, preconditions, scenarios, acceptance });
}

/** Returns the top-level headings found (outside code fences), in order. */
function extractHeadings(markdown) {
  let inFence = false;
  const out = [];
  markdown.split('\n').forEach((l) => {
    if (l.startsWith('```')) inFence = !inFence;
    else if (!inFence && /^# /.test(l)) out.push(l.slice(2).trim());
  });
  return out;
}

module.exports = { draftStory, extractHeadings, HEADINGS };
