# Technical Design — EPMCDMETST-70761

- **Jira:** https://jiraeu.epam.com/browse/EPMCDMETST-70761
- **Branch:** `feature/EPMCDMETST-70761-meetingnotes`
- **Date:** 2026-11-03
- **Status:** Draft (Ready for dev once Open questions are resolved)

## 1. Implementation plan

> Note: This ticket is about BA workflow automation (“BA Intake”) rather than the clinic booking runtime features. The design therefore proposes *tooling* additions (Node scripts/modules) and artifacts generation, with optional Jira automation.

### T-01 Define BA Intake input/output contracts
- **Description:** Define the canonical payload schema for an incoming enhancement request and the expected artifacts produced by a BA Intake run.
- **Files to create/modify:**
  - `tools/ba-intake/types.ts`
  - `tools/ba-intake/request.schema.json` (or `tools/ba-intake/request.schema.ts` if using Zod)
  - `tools/ba-intake/README.md`
- **Depends on:** none
- **Verifying test:** Unit test validating sample payloads (valid + invalid).

### T-02 Add prompt/template assets (versioned)
- **Description:** Add prompt/template files for key term extraction, clarifying question generation, and story drafting.
- **Files to create/modify:**
  - `tools/ba-intake/templates/clarifying_questions.md`
  - `tools/ba-intake/templates/story_draft.md`
  - `tools/ba-intake/templates/duplicate_ranking.md`
- **Depends on:** T-01
- **Verifying test:** Snapshot tests for rendered templates with fixed inputs.

### T-03 Implement Jira client wrapper (tooling)
- **Description:** Implement minimal Jira REST wrapper for search and (optionally) create/link/comment.
- **Files to create/modify:**
  - `tools/jira/client.ts`
  - `tools/jira/jql.ts`
- **Depends on:** T-01
- **Verifying test:** Unit test for JQL escaping; integration test with mocked HTTP.

### T-04 Implement duplicate search step
- **Description:** Build JQL from extracted terms and fetch candidate issues; output ranked list (LLM-assisted ranking optional).
- **Files to create/modify:**
  - `tools/ba-intake/steps/searchDuplicates.ts`
  - `tools/ba-intake/steps/extractKeyTerms.ts`
- **Depends on:** T-02, T-03
- **Verifying test:** Integration test: given sample request text, returns candidates list (mock Jira response).

### T-05 Implement clarifying question generation step
- **Description:** Produce up to 5 numbered questions if request is missing any of: actor, goal, trigger, success outcome, key rule.
- **Files to create/modify:**
  - `tools/ba-intake/steps/generateQuestions.ts`
- **Depends on:** T-02
- **Verifying test:** Unit test ensuring max 5 questions and required categories.

### T-06 Implement story drafting step
- **Description:** Create a Jira Story draft that contains exactly the five required section headings in order.
- **Files to create/modify:**
  - `tools/ba-intake/steps/draftStory.ts`
- **Depends on:** T-02, T-05
- **Verifying test:** Snapshot test verifying headings order and presence.

### T-07 Implement orchestration runner + artifact writer
- **Description:** Orchestrate steps, write artifacts under `artifacts/ba/<requestId>/`.
- **Files to create/modify:**
  - `tools/ba-intake/index.ts`
  - `tools/ba-intake/artifacts.ts`
- **Depends on:** T-01..T-06
- **Verifying test:** Unit test for deterministic output paths/files.

### T-08 Optional: create or update Jira Story
- **Description:** If duplicates found, update existing issue; else create a new story. Ensure idempotency.
- **Files to create/modify:**
  - `tools/ba-intake/steps/createOrUpdateStory.ts`
- **Depends on:** T-03, T-06
- **Verifying test:** Integration tests with mocked Jira create/update flows.

### T-09 Add documentation and CI hooks
- **Description:** Add npm script to run BA Intake, document required env vars.
- **Files to create/modify:**
  - root `package.json` (or a tooling package if present)
  - `.env.example` (document Jira vars)
- **Depends on:** T-07
- **Verifying test:** Smoke run in CI using mocks/dry-run.

## 2. HLD

### 2.1 Components touched
- **New (tooling):** `tools/ba-intake/**`, `tools/jira/**`
- **Artifacts:** `artifacts/ba/**` (generated outputs)
- **No changes required to clinic runtime** (backend API, Prisma schema, frontend) unless we later decide to expose this as an internal UI.

### 2.2 Data flow

```
Enhancement request text
        |
        v
[extractKeyTerms] -----> [searchDuplicates via Jira] -----> candidate list
        |                                |
        |                                v
        |                         (optional) LLM ranking
        v
[generateQuestions] (if critical fields missing)
        |
        v
[draftStory] -> story markdown with 5 required sections
        |
        v
(optional) [createOrUpdateStory via Jira]
        |
        v
Write artifacts under artifacts/ba/<requestId>/
```

### 2.3 API surface

This design primarily uses Jira REST APIs (external). If the team later prefers to proxy Jira calls through our backend, add internal endpoints (admin-only), but that is *not required* for this ticket.

| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | Jira: `/rest/api/2/search` | tooling | Find duplicate candidate issues |
| GET | Jira: `/rest/api/2/issue/{key}` | tooling | Fetch existing issue to update |
| POST | Jira: `/rest/api/2/issue` | tooling | Create new Story issue |
| PUT | Jira: `/rest/api/2/issue/{key}` | tooling | Update existing Story issue |

### 2.4 Non-functional notes
- **Security:** Jira credentials must be provided via environment variables/CI secrets; never written to artifacts.
- **Auditability:** Each run writes a run summary (inputs, JQL used, candidate count, outcome).
- **Determinism:** Template rendering should be stable; add snapshot tests.

## 3. LLD

### 3.1 Data / Prisma changes
- **No Prisma schema changes** required.

### 3.2 Tooling modules

#### `tools/jira/client.ts`
- `searchIssues({ jql, fields, maxResults }): Promise<{ issues: JiraIssueSummary[] }>`
- `getIssue(key): Promise<JiraIssue>`
- `createIssue(fields): Promise<{ key: string }>`
- `updateIssue(key, fields): Promise<void>`

#### `tools/jira/jql.ts`
- `escapeJqlText(input: string): string` (prevents injection/broken JQL)
- `buildDuplicateSearchJql({ projectKey, terms }: {projectKey: string; terms: string[]}): string`

#### `tools/ba-intake/steps/extractKeyTerms.ts`
- Input: `{ requestText: string }`
- Output: `{ terms: string[]; proposedSummary?: string }`
- Implementation: simple heuristic + optional LLM prompt.

#### `tools/ba-intake/steps/searchDuplicates.ts`
- Input: `{ projectKey: string; terms: string[] }`
- Output: `{ candidates: { key; summary; status; url; score?; rationale? }[] }`

#### `tools/ba-intake/steps/generateQuestions.ts`
- Input: `{ requestText: string }`
- Output: `{ questions: string[] }` (max 5)
- Rule: if missing any required detail (actor/goal/trigger/outcome/rule) then produce questions and the run ends with NEEDS_INPUT state.

#### `tools/ba-intake/steps/draftStory.ts`
- Input: `{ requestText: string; questions?: string[]; answers?: Record<string,string> }`
- Output: markdown containing the *exact* 5 headings in order:
  1) Summary
  2) General description
  3) Preconditions
  4) Scenarios of use (Gherkin)
  5) Acceptance criteria

#### `tools/ba-intake/steps/createOrUpdateStory.ts`
- Input: `{ storyDraftMd: string; duplicateCandidates: ...; mode: 'dry-run'|'create'|'update' }`
- Behavior:
  - If duplicate chosen: update existing issue (append comment or update description per BA choice).
  - Else: create new story.
  - Must never create duplicates without explicit flag.

### 3.3 Error handling
Since this is tooling, errors should be explicit and non-destructive:
- Missing Jira env vars → fail fast with message.
- Jira 401/403 → stop and report.
- Jira rate limit → retry with backoff (bounded).

## 4. UI wireframes

Primary interface is CLI/pipeline.

Optional internal UI (future):

```
BA Intake
--------------------------------------------------
[ Enhancement request text textarea              ]
[ Source issue key (optional) ] [ Run ] [ Run+Create ]

Duplicates (table)
- key | summary | status | link

Clarifying questions
1) ...
2) ...

Story draft (markdown preview)
--------------------------------------------------
```

## 5. Traceability

| Jira AC | Task(s) | Endpoint/component | Planned test |
|---|---|---|---|
| AC-1 | T-06, T-08 | `draftStory`, `createOrUpdateStory` | Snapshot: headings order; integration: Jira create |
| AC-2 | T-06 | `draftStory` | Snapshot: includes main + alternative scenario |
| AC-3 | T-06 | `draftStory` | Unit: AC references scenario names |
| AC-4 | T-03, T-04, T-08 | `searchDuplicates`, Jira client | Integration: search then update existing |
| AC-5 | T-05 | `generateQuestions` | Unit: max 5; exit state NEEDS_INPUT |

## 6. Open questions

1. Should Jira updates modify description or add comment only when duplicate is selected?
2. What is the canonical “duplicate match” threshold, and is ranking purely informational?
3. Where does the enhancement request text come from in the repo (`docs/input/*`) and what is its schema?
4. Which Jira fields are mandatory on Story create in this project (components/labels/epic link)?

## 7. Implementation notes (Stage 3)

Deviations from the plan above, made to keep the repo dependency-free and consistent with its CommonJS stack:

- Modules are plain Node CommonJS (`.js`), not TypeScript. `types.ts` / Zod are replaced by `tools/ba-intake/request.schema.json` plus the dependency-free validator `tools/ba-intake/schema.js`.
- `config.js` and `templates/render.js` were added; `createOrUpdateStory.js` covers T-08 and `artifacts.js` covers T-07.
- Open question 1: when a duplicate is chosen (`--duplicate-of KEY`), Jira is updated by adding a comment only (the description is never edited).
- Open question 2: duplicate score = share of extracted key terms found in the candidate summary; it blocks `create` at or above `BA_INTAKE_DUP_THRESHOLD` (default 0.5) unless `--allow-duplicate` is given. Ranking is otherwise informational.
- Open questions 3/4: input is a JSON file passed via `--input`; Story creation sets project, summary, description, issue type (`JIRA_ISSUE_TYPE`) and an idempotency label only. Extra mandatory fields (components, epic link) are not supported yet.
- npm scripts live in a new root `package.json` (`ba:intake`, `test:ba`); tests run with the Jest binary from `backend/node_modules`.
