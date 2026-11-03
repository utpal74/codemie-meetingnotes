const { createJiraClient, JiraError } = require('../jira/client');

const res = (status, body, headers = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (k) => headers[k] },
  text: async () => (body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body)),
});

const base = { baseUrl: 'https://jira.example.com/', email: 'a@b.c', apiToken: 'SECRET-TOKEN' };

describe('createJiraClient', () => {
  test('fails fast when not configured', () => {
    expect(() => createJiraClient({ baseUrl: 'x' })).toThrow(/JIRA_BASE_URL/);
  });

  test('searchIssues maps issues, sends basic auth and encoded query', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      res(200, { issues: [{ key: 'ABC-1', fields: { summary: 'S', status: { name: 'Open' } } }] })
    );
    const c = createJiraClient({ ...base, fetchImpl });
    const out = await c.searchIssues({ jql: 'project = ABC', maxResults: 5 });
    expect(out.issues).toEqual([
      { key: 'ABC-1', summary: 'S', status: 'Open', url: 'https://jira.example.com/browse/ABC-1' },
    ]);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toContain('https://jira.example.com/rest/api/2/search?jql=project+%3D+ABC');
    expect(url).toContain('maxResults=5');
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from('a@b.c:SECRET-TOKEN').toString('base64')}`);
  });

  test('stops on 401 without retrying and never leaks the token', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(res(401, 'nope'));
    const c = createJiraClient({ ...base, fetchImpl });
    const err = await c.getIssue('ABC-1').catch((e) => e);
    expect(err).toBeInstanceOf(JiraError);
    expect(err.code).toBe('JIRA_AUTH');
    expect(err.message).not.toContain('SECRET-TOKEN');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('retries 429 honouring Retry-After then succeeds', async () => {
    const sleep = jest.fn().mockResolvedValue();
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(res(429, '', { 'Retry-After': '2' }))
      .mockResolvedValueOnce(res(200, { key: 'ABC-1' }));
    const c = createJiraClient({ ...base, fetchImpl, sleep });
    await expect(c.getIssue('ABC-1')).resolves.toEqual({ key: 'ABC-1' });
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  test('gives up after bounded retries on rate limit', async () => {
    const sleep = jest.fn().mockResolvedValue();
    const fetchImpl = jest.fn().mockResolvedValue(res(429, ''));
    const c = createJiraClient({ ...base, fetchImpl, sleep, maxRetries: 2 });
    const err = await c.getIssue('ABC-1').catch((e) => e);
    expect(err.code).toBe('JIRA_RATE_LIMIT');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map((x) => x[0])).toEqual([500, 1000]);
  });

  test('mutating calls use the right endpoints', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(res(201, { key: 'ABC-9' }))
      .mockResolvedValue(res(204));
    const c = createJiraClient({ ...base, fetchImpl });
    await expect(c.createIssue({ summary: 's' })).resolves.toEqual({ key: 'ABC-9' });
    await c.updateIssue('ABC-9', { summary: 't' });
    await c.addComment('ABC-9', 'hi');
    await c.linkIssues({ inwardKey: 'ABC-1', outwardKey: 'ABC-9' });
    const calls = fetchImpl.mock.calls.map(([u, i]) => `${i.method} ${u.replace(/^.*api\/2/, '')}`);
    expect(calls).toEqual(['POST /issue', 'PUT /issue/ABC-9', 'POST /issue/ABC-9/comment', 'POST /issueLink']);
  });

  test('wraps network failures', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('boom'));
    const err = await createJiraClient({ ...base, fetchImpl }).getIssue('ABC-1').catch((e) => e);
    expect(err.code).toBe('JIRA_NETWORK');
  });
});
