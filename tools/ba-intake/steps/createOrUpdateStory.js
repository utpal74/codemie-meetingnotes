'use strict';

const { buildLabelSearchJql } = require('../../jira/jql');

const MARKER = (requestId) => `[ba-intake:${requestId}]`;
const labelFor = (requestId) => `ba-intake-${requestId}`.replace(/[^A-Za-z0-9._-]/g, '-');

/**
 * Create a new Story or comment on a chosen duplicate. Safe by default:
 *  - mode dry-run never calls Jira
 *  - create is idempotent per requestId (label lookup)
 *  - create is blocked when strong duplicate candidates exist unless allowDuplicate
 *  - nothing is ever closed or transitioned
 */
async function createOrUpdateStory({
  client,
  mode,
  requestId,
  projectKey,
  issueType = 'Story',
  linkType = 'Relates',
  summary,
  storyDraftMd,
  duplicateOf,
  candidates = [],
  threshold = 0.5,
  allowDuplicate = false,
  sourceIssueKey,
}) {
  if (mode === 'dry-run') {
    return { action: 'none', planned: duplicateOf ? 'update' : 'create' };
  }
  const marker = MARKER(requestId);

  if (mode === 'update') {
    if (!duplicateOf) throw new Error('update mode requires --duplicate-of <ISSUE-KEY>');
    const issue = await client.getIssue(duplicateOf, { fields: ['comment'] });
    const comments = (issue && issue.fields && issue.fields.comment && issue.fields.comment.comments) || [];
    if (comments.some((c) => String(c.body).includes(marker))) {
      return { action: 'exists', key: duplicateOf, reason: 'comment already posted' };
    }
    await client.addComment(duplicateOf, `${marker}\n${storyDraftMd}`);
    return { action: 'commented', key: duplicateOf };
  }

  if (mode !== 'create') throw new Error(`Unknown mode "${mode}"`);

  const label = labelFor(requestId);
  const existing = await client.searchIssues({
    jql: buildLabelSearchJql({ projectKey, label }),
    fields: ['summary', 'status'],
    maxResults: 1,
  });
  if (existing.issues.length) {
    return { action: 'exists', key: existing.issues[0].key, reason: 'story already created for this request' };
  }

  const strong = candidates.filter((c) => c.score >= threshold);
  if (strong.length && !allowDuplicate) {
    return {
      action: 'blocked-duplicates',
      keys: strong.map((c) => c.key),
      reason: `candidates at or above threshold ${threshold}; use --duplicate-of <KEY> or --allow-duplicate`,
    };
  }

  const { key } = await client.createIssue({
    project: { key: projectKey },
    summary,
    description: storyDraftMd,
    issuetype: { name: issueType },
    labels: [label],
  });
  if (sourceIssueKey) {
    await client.linkIssues({ inwardKey: sourceIssueKey, outwardKey: key, type: linkType });
    await client.addComment(sourceIssueKey, `BA Intake created ${key} for this request. ${marker}`);
  }
  return { action: 'created', key };
}

module.exports = { createOrUpdateStory, labelFor, MARKER };
