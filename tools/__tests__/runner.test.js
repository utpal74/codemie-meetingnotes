const fs = require('fs');
const os = require('os');
const path = require('path');
const { runBaIntake } = require('../ba-intake/index');
const { loadConfig } = require('../ba-intake/config');
const { FULL, ENV, mockClient } = require('./helpers');

const fixedNow = () => new Date('2026-11-03T00:00:00.000Z');

let tmp;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-intake-'));
});
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

const req = (extra = {}) => ({
  requestId: 'req-1',
  requestText: FULL,
  requester: { name: 'Jane', email: 'jane@example.com' },
  source: { issueKey: 'ABC-50' },
  ...extra,
});
const run = (over = {}) =>
  runBaIntake({
    request: over.request || req(),
    answers: over.answers,
    config: over.config || loadConfig(ENV),
    options: { rootDir: tmp, now: fixedNow, client: over.client || mockClient(), ...over.options },
  });
const dir = () => path.join(tmp, 'artifacts', 'ba', 'req-1');
const read = (name) => fs.readFileSync(path.join(dir(), name), 'utf8');

describe('runBaIntake', () => {
  test('dry-run writes deterministic artifacts and never mutates Jira', async () => {
    const client = mockClient();
    const s = await run({ client });
    expect(s.state).toBe('READY');
    expect(s.mode).toBe('dry-run');
    expect(s.jira.action).toBe('none');
    expect(s.artifacts).toEqual([
      '01-intake.json', '02-duplicate-candidates.json', '02-duplicate-candidates.md',
      '03-clarifying-questions.md', '04-story-draft.md', 'run-summary.json',
    ]);
    expect(fs.readdirSync(dir()).sort()).toEqual(s.artifacts);
    expect(client.createIssue).not.toHaveBeenCalled();
    expect(client.addComment).not.toHaveBeenCalled();
    expect(JSON.parse(read('run-summary.json')).startedAt).toBe('2026-11-03T00:00:00.000Z');
  });

  test('artifacts contain no email or token', async () => {
    await run();
    const all = ['01-intake.json', 'run-summary.json', '04-story-draft.md'].map(read).join('');
    expect(all).not.toContain('jane@example.com');
    expect(all).not.toContain('SECRET-TOKEN');
    expect(JSON.parse(read('01-intake.json')).requester).toEqual({ name: 'Jane' });
  });

  test('two runs produce identical story and question artifacts', async () => {
    await run();
    const first = [read('03-clarifying-questions.md'), read('04-story-draft.md')];
    await run();
    expect([read('03-clarifying-questions.md'), read('04-story-draft.md')]).toEqual(first);
  });

  test('vague request ends in NEEDS_INPUT and skips Jira even with create', async () => {
    const client = mockClient();
    const request = req({ requestText: 'Please make it better soon thanks' });
    const s = await run({ client, request, options: { mode: 'create' } });
    expect(s.state).toBe('NEEDS_INPUT');
    expect(s.jira.action).toBe('skipped');
    expect(client.createIssue).not.toHaveBeenCalled();
    expect(read('03-clarifying-questions.md')).toContain('1. ');
  });

  test('answers file input moves a vague request to READY', async () => {
    const answers = { actor: 'BA', goal: 'g', trigger: 't', outcome: 'o', rule: 'r' };
    const request = req({ requestText: 'Please make it better soon thanks' });
    const s = await run({ request, answers });
    expect(s.state).toBe('READY');
    expect(read('04-story-draft.md')).not.toContain('TBD');
  });

  test('offline run needs no Jira config and skips duplicate artifacts', async () => {
    const s = await run({ config: loadConfig({}), options: { offline: true } });
    expect(s.artifacts).not.toContain('02-duplicate-candidates.json');
  });

  test('missing Jira env fails fast naming the variables', async () => {
    await expect(run({ config: loadConfig({}) })).rejects.toThrow(/JIRA_BASE_URL.*JIRA_API_TOKEN/);
  });

  test('rejects invalid request and bad --duplicate-of', async () => {
    await expect(run({ request: req({ requestId: '../x' }) })).rejects.toThrow(/Invalid request/);
    await expect(run({ options: { duplicateOf: 'nope' } })).rejects.toThrow(/issue key/);
  });
});

describe('runBaIntake Jira flows', () => {
  test('--create-story creates, links and comments on the source', async () => {
    const client = mockClient();
    const s = await run({ client, options: { mode: 'create' } });
    expect(s.jira).toEqual({ action: 'created', key: 'ABC-100' });
    const fields = client.createIssue.mock.calls[0][0];
    expect(fields).toMatchObject({ project: { key: 'ABC' }, issuetype: { name: 'Story' }, labels: ['ba-intake-req-1'] });
    expect(client.linkIssues).toHaveBeenCalledWith({ inwardKey: 'ABC-50', outwardKey: 'ABC-100', type: 'Relates' });
    expect(client.addComment).toHaveBeenCalledWith('ABC-50', expect.stringContaining('ABC-100'));
  });

  test('BA_INTAKE_DRY_RUN forces dry-run even with create', async () => {
    const client = mockClient();
    const config = loadConfig({ ...ENV, BA_INTAKE_DRY_RUN: 'true' });
    const s = await run({ client, config, options: { mode: 'create' } });
    expect(s.mode).toBe('dry-run');
    expect(client.createIssue).not.toHaveBeenCalled();
  });

  test('--duplicate-of writes decision support and comments on the duplicate', async () => {
    const client = mockClient();
    const s = await run({ client, options: { mode: 'create', duplicateOf: 'ABC-7' } });
    expect(s.state).toBe('DUPLICATE_RECOMMENDED');
    expect(s.jira).toEqual({ action: 'commented', key: 'ABC-7' });
    expect(read('05-duplicate-decision.md')).toContain('Do not close or transition');
    expect(client.createIssue).not.toHaveBeenCalled();
  });
});
