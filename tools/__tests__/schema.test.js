const { validateRequest, validateAnswers } = require('../ba-intake/schema');

const valid = {
  requestId: 'req-2026-11-03-001',
  source: { type: 'jira', issueKey: 'EPMCDMETST-70761' },
  requestText: 'As a BA I want to capture requests so that they are consistent.',
  requester: { name: 'Jane', email: 'jane@example.com' },
  links: ['https://example.com/a'],
};

describe('validateRequest', () => {
  test('accepts a valid payload and trims text', () => {
    const r = validateRequest({ ...valid, requestText: `  ${valid.requestText}  ` });
    expect(r.valid).toBe(true);
    expect(r.value.requestText).toBe(valid.requestText);
  });

  test('defaults links to an empty array', () => {
    const { links, ...rest } = valid;
    expect(validateRequest(rest).value.links).toEqual([]);
  });

  test.each([
    ['missing requestId', { ...valid, requestId: undefined }],
    ['path traversal requestId', { ...valid, requestId: '../evil' }],
    ['slash in requestId', { ...valid, requestId: 'a/b' }],
    ['dotdot in requestId', { ...valid, requestId: 'a..b' }],
    ['short text', { ...valid, requestText: 'short' }],
    ['unknown field', { ...valid, extra: 1 }],
    ['bad issue key', { ...valid, source: { issueKey: 'nope' } }],
    ['links not strings', { ...valid, links: [1] }],
  ])('rejects %s', (_name, payload) => {
    const r = validateRequest(payload);
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  test('rejects non-objects', () => {
    expect(validateRequest(null).valid).toBe(false);
    expect(validateRequest([]).valid).toBe(false);
  });
});

describe('validateAnswers', () => {
  test('accepts known keys and drops blanks', () => {
    expect(validateAnswers({ actor: ' BA ', goal: ' ' }).value).toEqual({ actor: 'BA' });
  });
  test('rejects unknown keys and non-strings', () => {
    expect(validateAnswers({ nope: 'x' }).valid).toBe(false);
    expect(validateAnswers({ actor: 1 }).valid).toBe(false);
  });
});
