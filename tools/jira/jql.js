'use strict';

// Characters with special meaning to Jira's Lucene-based text search.
const LUCENE_SPECIALS = /[+\-&|!(){}[\]^~*?\:/]/g;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;
const PROJECT_KEY = /^[A-Z][A-Z0-9_]{1,19}$/;
const LABEL = /^[A-Za-z0-9._-]{1,100}$/;

/**
 * Make free text safe to embed inside a double-quoted JQL string.
 * Control chars and Lucene operators become spaces; double quotes are escaped.
 */
function escapeJqlText(input) {
  return String(input === undefined || input === null ? '' : input)
    .replace(CONTROL_CHARS, ' ')
    .replace(LUCENE_SPECIALS, ' ')
    .replace(/"/g, '\\"')
    .replace(/\s+/g, ' ')
    .trim();
}

function assertProjectKey(projectKey) {
  if (typeof projectKey !== 'string' || !PROJECT_KEY.test(projectKey)) {
    throw new Error(`Invalid Jira project key: ${JSON.stringify(projectKey)}`);
  }
}

/**
 * project = KEY AND (text ~ "a" OR text ~ "b") ORDER BY updated DESC
 * OR keeps recall high; candidates are ranked locally afterwards.
 */
function buildDuplicateSearchJql({ projectKey, terms }) {
  assertProjectKey(projectKey);
  const clean = (terms || []).map(escapeJqlText).filter(Boolean);
  if (clean.length === 0) {
    throw new Error('buildDuplicateSearchJql requires at least one non-empty term');
  }
  const clauses = clean.map((t) => `text ~ "${t}"`).join(' OR ');
  return `project = ${projectKey} AND (${clauses}) ORDER BY updated DESC`;
}

/** JQL used for idempotency: find the issue previously created for a request. */
function buildLabelSearchJql({ projectKey, label }) {
  assertProjectKey(projectKey);
  if (typeof label !== 'string' || !LABEL.test(label)) {
    throw new Error(`Invalid Jira label: ${JSON.stringify(label)}`);
  }
  return `project = ${projectKey} AND labels = "${label}" ORDER BY created ASC`;
}

module.exports = { escapeJqlText, buildDuplicateSearchJql, buildLabelSearchJql };
