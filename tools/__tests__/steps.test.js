const { extractKeyTerms } = require('../ba-intake/steps/extractKeyTerms');
const {
  generateQuestions, formatQuestionsMarkdown, MAX_QUESTIONS, duplicateConfirmationQuestions,
} = require('../ba-intake/steps/generateQuestions');
const { draftStory, extractHeadings, HEADINGS } = require('../ba-intake/steps/draftStory');
const { searchDuplicates, scoreCandidate, formatCandidatesMarkdown } = require('../ba-intake/steps/searchDuplicates');

const FULL =
  'As a receptionist, I want to export meeting notes as PDF, so that attendees get a copy. ' +
  'When the meeting ends, the export runs. The file must be under 5 MB.';
const VAGUE = 'Please make it better soon thanks';

describe('extractKeyTerms', () => {
  test('is deterministic, drops stopwords and caps terms', () => {
    const a = extractKeyTerms({ requestText: FULL });
    expect(a).toEqual(extractKeyTerms({ requestText: FULL }));
    expect(a.terms.length).toBeLessThanOrEqual(5);
    expect(a.terms).not.toContain('the');
    expect(a.terms).toContain('meeting');
  });
  test('uses title as summary when given', () => {
    expect(extractKeyTerms({ requestText: FULL, title: 'Export PDF' }).proposedSummary).toBe('Export PDF');
  });
});

describe('generateQuestions', () => {
  test('no questions when every detail is present', () => {
    const r = generateQuestions({ requestText: FULL });
    expect(r.questions).toEqual([]);
    expect(r.state).toBe('READY');
  });
  test('vague request asks at most 5 questions and needs input', () => {
    const r = generateQuestions({ requestText: VAGUE });
    expect(r.state).toBe('NEEDS_INPUT');
    expect(r.questions.length).toBeGreaterThan(0);
    expect(r.questions.length).toBeLessThanOrEqual(MAX_QUESTIONS);
    expect(r.questions.map((q) => q.key)).toEqual(['actor', 'goal', 'trigger', 'outcome', 'rule']);
  });
  test('answers remove the matching questions', () => {
    const answers = { actor: 'BA', goal: 'g', trigger: 't', outcome: 'o', rule: 'r' };
    const r = generateQuestions({ requestText: VAGUE, answers });
    expect(r.state).toBe('READY');
    expect(r.details.actor).toBe('BA');
  });
  test('questions markdown is grouped by topic and numbered (snapshot)', () => {
    const r = generateQuestions({ requestText: VAGUE });
    expect(formatQuestionsMarkdown({ requestId: 'r1', state: r.state, questions: r.questions })).toMatchSnapshot();
  });
  test('duplicate confirmation questions replace the standard set', () => {
    expect(duplicateConfirmationQuestions('ABC-1')[0].text).toContain('ABC-1');
  });
});

describe('draftStory', () => {
  const q = generateQuestions({ requestText: FULL });
  const md = draftStory({ requestText: FULL, details: q.details, proposedSummary: 'Export notes as PDF' });

  test('has exactly the five required headings in order', () => {
    expect(extractHeadings(md)).toEqual(HEADINGS);
  });
  test('includes a main and an alternative scenario', () => {
    expect((md.match(/^Scenario: /gm) || []).length).toBe(2);
  });
  test('acceptance criteria reference the scenario names', () => {
    expect(md).toContain('Scenario "Main flow"');
    expect(md).toContain('Scenario "Alternative flow - invalid or incomplete input"');
  });
  test('missing details are shown as TBD', () => {
    expect(draftStory({ requestText: VAGUE, details: {} })).toContain('TBD');
  });
  test('story draft is stable (snapshot)', () => {
    expect(md).toMatchSnapshot();
  });
});

describe('searchDuplicates', () => {
  const client = {
    searchIssues: jest.fn().mockResolvedValue({
      issues: [
        { key: 'ABC-2', summary: 'Unrelated thing', status: 'Open', url: 'u2' },
        { key: 'ABC-1', summary: 'Export meeting notes pdf', status: 'Done', url: 'u1' },
        { key: 'ABC-3', summary: 'Self', status: 'Open', url: 'u3' },
      ],
    }),
  };
  test('ranks by score, excludes the source issue and returns the JQL', async () => {
    const terms = ['meeting', 'notes', 'pdf'];
    const out = await searchDuplicates({ client, projectKey: 'ABC', terms, excludeKeys: ['ABC-3'] });
    expect(out.candidates.map((c) => c.key)).toEqual(['ABC-1', 'ABC-2']);
    expect(out.candidates[0]).toMatchObject({ key: 'ABC-1', status: 'Done', url: 'u1', score: 1 });
    expect(out.jql).toContain('project = ABC');
    expect(client.searchIssues).toHaveBeenCalledWith(expect.objectContaining({ maxResults: 10 }));
  });
  test('scoreCandidate handles empty terms', () => {
    expect(scoreCandidate([], 'x').score).toBe(0);
  });
  test('markdown lists candidates and handles empty (snapshot)', () => {
    const c = [{ key: 'ABC-1', summary: 'A|B', status: 'Open', url: 'u', score: 0.5, rationale: 'r' }];
    expect(formatCandidatesMarkdown({ requestId: 'r1', jql: 'j', candidates: c })).toMatchSnapshot();
    expect(formatCandidatesMarkdown({ requestId: 'r1', jql: 'j', candidates: [] })).toContain('No candidates');
  });
});
