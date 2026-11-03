# BA Intake (EPMCDMETST-70761)

Pipeline tooling that turns an enhancement request into reviewable BA artifacts:
duplicate candidates from Jira, clarifying questions, and a Jira Story draft.
It does not touch the clinic booking runtime. No npm dependencies (Node 18+).

## Usage

```bash
# Safe default: dry-run, nothing is changed in Jira
npm run ba:intake -- --input tools/ba-intake/examples/request.json

# Offline (no Jira needed): skips the duplicate search
npm run ba:intake -- --input request.json --offline

# Re-run with clarification answers
npm run ba:intake -- --input request.json --answers answers.json

# BA decided it is a duplicate: decision support + comment on that issue
npm run ba:intake -- --input request.json --duplicate-of ABC-7 --create-story

# Create the Story, link and comment on the source issue
npm run ba:intake -- --input request.json --source-issue ABC-50 --create-story
```

Jira is only changed when `--create-story` is passed and `BA_INTAKE_DRY_RUN` is not `true`.
Nothing is ever closed or transitioned.

### Input (`request.schema.json`)

Required: `requestId` (`[A-Za-z0-9._-]`, max 64), `requestText` (min 10 chars).
Optional: `title`, `source{type,issueKey,url}`, `requester{name,email}`, `links[]`, `constraints{}`.

### Answers file

JSON object with any of `actor`, `goal`, `trigger`, `outcome`, `rule`.

## Environment variables

See `.env.example`. Credentials come from the environment only and are never written to artifacts or logs.

| Variable | Purpose |
|---|---|
| `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN` | Jira REST v2 basic auth |
| `JIRA_PROJECT_KEY` | Project searched and used for new stories |
| `JIRA_ISSUE_TYPE` (Story), `JIRA_LINK_TYPE` (Relates) | Create/link settings |
| `BA_INTAKE_DUP_SEARCH_LIMIT` (10) | Max duplicate candidates |
| `BA_INTAKE_DUP_THRESHOLD` (0.5) | Score at/above which create is blocked |
| `BA_INTAKE_DRY_RUN` (false) | `true` forces dry-run |

## Outputs: `artifacts/ba/<requestId>/`

| File | Content |
|---|---|
| `01-intake.json` | Normalised request, key terms (requester email is not stored) |
| `02-duplicate-candidates.json` / `.md` | Ranked candidates: key, summary, status, URL, score, rationale |
| `03-clarifying-questions.md` | Up to 5 questions grouped by topic |
| `04-story-draft.md` | Story with the five required headings |
| `05-duplicate-decision.md` | Only with `--duplicate-of`: recommended action + comment text |
| `run-summary.json` | State, mode, JQL, counts, Jira outcome, timestamps |

Run states: `READY`, `NEEDS_INPUT` (required detail missing: no Jira change), `DUPLICATE_RECOMMENDED`.

## Behaviour notes

- Required details checked: actor, goal, trigger, success outcome, key rule (regex heuristics; answers override).
- Duplicate search uses `project = KEY AND (text ~ "t1" OR ...)`; candidates are ranked locally by shared key terms.
- Idempotency: created stories carry label `ba-intake-<requestId>`; a re-run finds it and does not create another.
  Create is blocked when a candidate scores at/above the threshold unless `--allow-duplicate` or `--duplicate-of` is used.
- Duplicate comments carry marker `[ba-intake:<requestId>]` and are not reposted.
- Jira 401/403 stop immediately; 429/503 retry with bounded backoff.
- Templates in `templates/` start with a `<!-- template: name vN -->` marker. Bump `vN` and update the
  snapshots in `tools/__tests__/__snapshots__` whenever a template changes.

## Tests

```bash
npm run test:ba   # uses jest from backend/node_modules (run npm install in backend first)
```
