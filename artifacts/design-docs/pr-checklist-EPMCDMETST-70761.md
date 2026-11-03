# PR Checklist — EPMCDMETST-70761

## Scope & Requirements
- [ ] PR title is `EPMCDMETST-70761: <short description>`
- [ ] Work is limited to BA Intake tooling and artifacts (no clinic booking feature changes unless required)
- [ ] Jira ticket acceptance criteria AC-1..AC-5 are each addressed and traceable
- [ ] Idempotency: rerunning does not create duplicate Jira stories unless explicitly requested

## Backend / Tooling
- [ ] `tools/ba-intake/**` added with clear entrypoint and documented usage
- [ ] Input payload validation implemented (JSON schema or Zod)
- [ ] Jira client wrapper added (`tools/jira/**`) and used consistently
- [ ] JQL escaping implemented to prevent malformed queries
- [ ] Clear error messages for missing env vars, Jira auth errors, and rate limits

## Frontend (only if added)
- [ ] Any internal UI is protected (admin-only or feature-flagged)
- [ ] Loading/empty/error states implemented

## Tests
- [ ] Unit tests added for: schema validation, JQL escaping, template rendering
- [ ] Integration tests added using mocked Jira HTTP for search/create/update
- [ ] Snapshot tests added for story draft headings/order and question formatting
- [ ] `npm test` / `npm run test:integration` passes locally (if applicable)

## Docs
- [ ] `tools/ba-intake/README.md` documents usage + env vars
- [ ] `.env.example` updated for any new variables (no secrets)
- [ ] Design docs updated: `artifacts/design-docs/tech-design-EPMCDMETST-70761.md`

