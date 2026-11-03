'use strict';

/**
 * Minimal Jira REST (v2) wrapper used by BA Intake tooling.
 * - Credentials come from the caller (env), never logged or echoed in errors.
 * - 401/403 stop immediately; 429/503 are retried with bounded backoff.
 */

class JiraError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.name = 'JiraError';
    this.status = status;
    this.code = code || 'JIRA_ERROR';
  }
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function createJiraClient({
  baseUrl,
  email,
  apiToken,
  fetchImpl = globalThis.fetch,
  maxRetries = 3,
  baseDelayMs = 500,
  sleep = defaultSleep,
} = {}) {
  if (!baseUrl || !email || !apiToken) {
    throw new JiraError(
      'Jira is not configured: set JIRA_BASE_URL, JIRA_EMAIL and JIRA_API_TOKEN',
      { code: 'JIRA_CONFIG' }
    );
  }
  if (typeof fetchImpl !== 'function') {
    throw new JiraError('No fetch implementation available (Node 18+ required)', {
      code: 'JIRA_CONFIG',
    });
  }
  const root = String(baseUrl).replace(/\/+$/, '');
  const authHeader = `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`;

  async function request(method, path, { query, body } = {}) {
    const qs = query ? `?${new URLSearchParams(query).toString()}` : '';
    const url = `${root}/rest/api/2${path}${qs}`;
    for (let attempt = 0; ; attempt += 1) {
      let res;
      try {
        res = await fetchImpl(url, {
          method,
          headers: {
            Authorization: authHeader,
            Accept: 'application/json',
            ...(body ? { 'Content-Type': 'application/json' } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        });
      } catch (err) {
        throw new JiraError(`Jira request failed: ${err.message}`, { code: 'JIRA_NETWORK' });
      }

      if (res.ok) {
        if (res.status === 204) return null;
        const text = await res.text();
        return text ? JSON.parse(text) : null;
      }
      if (res.status === 401 || res.status === 403) {
        throw new JiraError(
          `Jira authentication/authorization failed (HTTP ${res.status}); check credentials and permissions`,
          { status: res.status, code: 'JIRA_AUTH' }
        );
      }
      if ((res.status === 429 || res.status === 503) && attempt < maxRetries) {
        const retryAfter = Number(res.headers && res.headers.get && res.headers.get('Retry-After'));
        await sleep(retryAfter > 0 ? retryAfter * 1000 : baseDelayMs * 2 ** attempt);
        continue;
      }
      const detail = (await res.text().catch(() => '')).slice(0, 300);
      throw new JiraError(
        res.status === 429
          ? `Jira rate limit exceeded after ${maxRetries} retries`
          : `Jira returned HTTP ${res.status} for ${method} ${path}: ${detail}`,
        { status: res.status, code: res.status === 429 ? 'JIRA_RATE_LIMIT' : 'JIRA_HTTP' }
      );
    }
  }

  const issueUrl = (key) => `${root}/browse/${key}`;

  return {
    async searchIssues({ jql, fields = ['summary', 'status'], maxResults = 10 }) {
      const data = await request('GET', '/search', {
        query: { jql, fields: fields.join(','), maxResults: String(maxResults) },
      });
      const issues = ((data && data.issues) || []).map((i) => ({
        key: i.key,
        summary: (i.fields && i.fields.summary) || '',
        status: (i.fields && i.fields.status && i.fields.status.name) || 'Unknown',
        url: issueUrl(i.key),
      }));
      return { issues };
    },
    getIssue(key, { fields } = {}) {
      return request('GET', `/issue/${encodeURIComponent(key)}`, {
        query: fields ? { fields: fields.join(',') } : undefined,
      });
    },
    async createIssue(fields) {
      const data = await request('POST', '/issue', { body: { fields } });
      return { key: data.key };
    },
    async updateIssue(key, fields) {
      await request('PUT', `/issue/${encodeURIComponent(key)}`, { body: { fields } });
    },
    async addComment(key, body) {
      await request('POST', `/issue/${encodeURIComponent(key)}/comment`, { body: { body } });
    },
    async linkIssues({ inwardKey, outwardKey, type = 'Relates' }) {
      await request('POST', '/issueLink', {
        body: { type: { name: type }, inwardIssue: { key: inwardKey }, outwardIssue: { key: outwardKey } },
      });
    },
    issueUrl,
  };
}

module.exports = { createJiraClient, JiraError };
