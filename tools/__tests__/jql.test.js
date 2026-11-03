const { escapeJqlText, buildDuplicateSearchJql, buildLabelSearchJql } = require('../jira/jql');

describe('escapeJqlText', () => {
  test('escapes double quotes so input cannot break out of the string', () => {
    expect(escapeJqlText('x" OR project = FOO')).toBe('x\\" OR project = FOO');
  });
  test('neutralises Lucene operators and backslashes', () => {
    expect(escapeJqlText('a+b -c (d) \ e*')).toBe('a b c d e');
  });
  test('strips control characters and collapses whitespace', () => {
    expect(escapeJqlText('a\n\tb\u0000c')).toBe('a b c');
  });
  test('handles null/undefined', () => {
    expect(escapeJqlText(undefined)).toBe('');
  });
});

describe('buildDuplicateSearchJql', () => {
  test('builds an OR text query ordered by updated', () => {
    expect(buildDuplicateSearchJql({ projectKey: 'ABC', terms: ['meeting', 'notes'] })).toBe(
      'project = ABC AND (text ~ "meeting" OR text ~ "notes") ORDER BY updated DESC'
    );
  });
  test('hostile terms cannot add unescaped quotes', () => {
    const jql = buildDuplicateSearchJql({ projectKey: 'ABC', terms: ['a" OR 1=1 --'] });
    expect(jql).toContain('text ~ "a\\" OR 1=1"');
    expect(jql.replace(/\\"/g, "").split('"').length - 1).toBe(2);
  });
  test('rejects bad project keys and empty terms', () => {
    expect(() => buildDuplicateSearchJql({ projectKey: 'abc OR 1=1', terms: ['x'] })).toThrow(/project key/);
    expect(() => buildDuplicateSearchJql({ projectKey: 'ABC', terms: ['  ', '+'] })).toThrow(/term/);
  });
});

describe('buildLabelSearchJql', () => {
  test('builds label query and validates label', () => {
    expect(buildLabelSearchJql({ projectKey: 'ABC', label: 'ba-intake-r1' })).toBe(
      'project = ABC AND labels = "ba-intake-r1" ORDER BY created ASC'
    );
    expect(() => buildLabelSearchJql({ projectKey: 'ABC', label: 'x" OR 1=1' })).toThrow(/label/);
  });
});
