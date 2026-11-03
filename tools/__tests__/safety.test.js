const { createOrUpdateStory } = require('../ba-intake/steps/createOrUpdateStory');
const { parseArgs } = require('../ba-intake/index');
const { mockClient } = require('./helpers');

describe('createOrUpdateStory idempotency and safety', () => {
  const base = { mode: 'create', requestId: 'req-1', projectKey: 'ABC', summary: 's', storyDraftMd: 'md' };

  test('rerun does not create a second story', async () => {
    const client = mockClient({ searchIssues: jest.fn().mockResolvedValue({ issues: [{ key: 'ABC-100' }] }) });
    const out = await createOrUpdateStory({ ...base, client });
    expect(out).toMatchObject({ action: 'exists', key: 'ABC-100' });
    expect(client.createIssue).not.toHaveBeenCalled();
  });

  test('strong candidates block create unless allowDuplicate', async () => {
    const candidates = [{ key: 'ABC-2', score: 0.8 }];
    const client = mockClient();
    const blocked = await createOrUpdateStory({ ...base, client, candidates });
    expect(blocked).toMatchObject({ action: 'blocked-duplicates', keys: ['ABC-2'] });
    expect(client.createIssue).not.toHaveBeenCalled();
    const forced = await createOrUpdateStory({ ...base, client, candidates, allowDuplicate: true });
    expect(forced.action).toBe('created');
  });

  test('update mode does not repost an existing comment', async () => {
    const existing = { fields: { comment: { comments: [{ body: 'x [ba-intake:req-1] y' }] } } };
    const client = mockClient({ getIssue: jest.fn().mockResolvedValue(existing) });
    const out = await createOrUpdateStory({ ...base, mode: 'update', duplicateOf: 'ABC-7', client });
    expect(out.action).toBe('exists');
    expect(client.addComment).not.toHaveBeenCalled();
  });

  test('update mode requires a duplicate key; dry-run touches nothing', async () => {
    const client = mockClient();
    await expect(createOrUpdateStory({ ...base, mode: 'update', client })).rejects.toThrow(/duplicate-of/);
    const dry = await createOrUpdateStory({ ...base, mode: 'dry-run', client });
    expect(dry).toEqual({ action: 'none', planned: 'create' });
    expect(client.searchIssues).not.toHaveBeenCalled();
  });

  test('unknown mode is rejected', async () => {
    await expect(createOrUpdateStory({ ...base, mode: 'nuke', client: mockClient() })).rejects.toThrow(/Unknown mode/);
  });
});

describe('parseArgs', () => {
  test('parses flags and rejects unknown ones', () => {
    const parsed = parseArgs(['--input', 'a.json', '--create-story', '--duplicate-of', 'ABC-1']);
    expect(parsed.flags).toEqual({ input: 'a.json', 'create-story': true, 'duplicate-of': 'ABC-1' });
    expect(() => parseArgs(['--nope'])).toThrow(/Unknown/);
    expect(() => parseArgs(['--input'])).toThrow(/Missing value/);
  });
});
