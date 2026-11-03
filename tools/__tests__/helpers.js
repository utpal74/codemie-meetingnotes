const FULL =
  'As a receptionist, I want to export meeting notes as PDF, so that attendees get a copy. ' +
  'When the meeting ends, the export runs. The file must be under 5 MB.';

const ENV = {
  JIRA_BASE_URL: 'https://jira.example.com',
  JIRA_EMAIL: 'a@b.c',
  JIRA_API_TOKEN: 'SECRET-TOKEN',
  JIRA_PROJECT_KEY: 'ABC',
};

function mockClient(overrides = {}) {
  return {
    searchIssues: jest.fn().mockResolvedValue({ issues: [] }),
    getIssue: jest.fn().mockResolvedValue({ fields: { comment: { comments: [] } } }),
    createIssue: jest.fn().mockResolvedValue({ key: 'ABC-100' }),
    addComment: jest.fn().mockResolvedValue(),
    linkIssues: jest.fn().mockResolvedValue(),
    updateIssue: jest.fn().mockResolvedValue(),
    ...overrides,
  };
}

module.exports = { FULL, ENV, mockClient };
