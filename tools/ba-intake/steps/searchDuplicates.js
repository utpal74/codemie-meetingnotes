'use strict';

const { buildDuplicateSearchJql } = require('../../jira/jql');
const { renderTemplate } = require('../templates/render');

function tokenize(s) {
  return new Set((String(s).toLowerCase().match(/[a-z][a-z0-9]{2,}/g) || []));
}

/** Share of request terms that appear in a candidate summary. */
function scoreCandidate(terms, summary) {
  if (!terms.length) return { score: 0, rationale: 'no terms' };
  const tokens = tokenize(summary);
  const hits = terms.filter((t) => tokens.has(t));
  const score = Math.round((hits.length / terms.length) * 100) / 100;
  return {
    score,
    rationale: hits.length ? `summary shares: ${hits.join(', ')}` : 'no shared key terms in summary',
  };
}

async function searchDuplicates({ client, projectKey, terms, limit = 10, excludeKeys = [] }) {
  const jql = buildDuplicateSearchJql({ projectKey, terms });
  const { issues } = await client.searchIssues({
    jql,
    fields: ['summary', 'status'],
    maxResults: limit,
  });
  const candidates = issues
    .filter((i) => !excludeKeys.includes(i.key))
    .map((i) => ({ key: i.key, summary: i.summary, status: i.status, url: i.url, ...scoreCandidate(terms, i.summary) }))
    .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
  return { jql, candidates };
}

function formatCandidatesMarkdown({ requestId, jql, candidates }) {
  const body = candidates.length
    ? ['| Rank | Key | Summary | Status | Score | Rationale |', '|---|---|---|---|---|---|']
        .concat(
          candidates.map(
            (c, i) =>
              `| ${i + 1} | [${c.key}](${c.url}) | ${c.summary.replace(/\|/g, '\|')} | ${c.status} | ${c.score} | ${c.rationale} |`
          )
        )
        .join('\n')
    : '_No candidates found._';
  return renderTemplate('duplicate_ranking', { requestId, jql, body });
}

/** AC-03: recommended action when the BA marks a candidate as the duplicate. */
function buildDuplicateDecision({ requestId, duplicateOf, sourceIssueKey }) {
  const from = sourceIssueKey ? `, from ${sourceIssueKey}` : '';
  const commentText =
    `Possible duplicate: this request (${requestId}${from}) ` +
    `appears to overlap with ${duplicateOf}. Please confirm and add any extra detail to ${duplicateOf}.`;
  return {
    duplicateOf,
    recommendedAction: `Link the request to ${duplicateOf} (link type per project standard) and post the comment below. Do not close or transition any issue automatically.`,
    commentText,
  };
}

module.exports = { searchDuplicates, scoreCandidate, formatCandidatesMarkdown, buildDuplicateDecision };
