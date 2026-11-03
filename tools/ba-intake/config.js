'use strict';

const { JiraError } = require('../jira/client');

/** Read BA Intake settings from env. Never returns/logs the API token outside `jira`. */
function loadConfig(env = process.env) {
  const bool = (v, d) => (v === undefined || v === '' ? d : /^(1|true|yes)$/i.test(v));
  const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
  return {
    jira: {
      baseUrl: env.JIRA_BASE_URL,
      email: env.JIRA_EMAIL,
      apiToken: env.JIRA_API_TOKEN,
    },
    projectKey: env.JIRA_PROJECT_KEY,
    issueType: env.JIRA_ISSUE_TYPE || 'Story',
    linkType: env.JIRA_LINK_TYPE || 'Relates',
    searchLimit: num(env.BA_INTAKE_DUP_SEARCH_LIMIT, 10),
    duplicateThreshold: Number(env.BA_INTAKE_DUP_THRESHOLD) > 0 ? Number(env.BA_INTAKE_DUP_THRESHOLD) : 0.5,
    dryRun: bool(env.BA_INTAKE_DRY_RUN, false),
  };
}

/** Fail fast, naming every missing variable (values are never printed). */
function assertJiraConfig(config) {
  const missing = [];
  if (!config.jira.baseUrl) missing.push('JIRA_BASE_URL');
  if (!config.jira.email) missing.push('JIRA_EMAIL');
  if (!config.jira.apiToken) missing.push('JIRA_API_TOKEN');
  if (!config.projectKey) missing.push('JIRA_PROJECT_KEY');
  if (missing.length) {
    throw new JiraError(`Missing required environment variable(s): ${missing.join(', ')}`, {
      code: 'JIRA_CONFIG',
    });
  }
}

module.exports = { loadConfig, assertJiraConfig };
