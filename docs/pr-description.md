## Summary

Add a Copilot-driven, eight-step SDLC pipeline that starts from a Word user story and delegates requirements, architecture, planning, implementation, review, verification, and PR preparation to focused workspace agents. The workflow supports local-only execution and requires human approval before commits, pushes, or remote PR creation.

## Changes Made

- `.github/agents/architecture-reviewer.agent.md`, `.github/agents/code-reviewer.agent.md`, `.github/agents/delivery-planner.agent.md`, `.github/agents/implementation-engineer.agent.md`, `.github/agents/pull-request-author.agent.md`, `.github/agents/quality-verifier.agent.md`, `.github/agents/requirements-analyst.agent.md`, `.github/agents/sdlc-orchestrator.agent.md`, `.github/agents/solution-architect.agent.md`: add the eight phase specialists and orchestrator with ordered handoff, approval, local-only, review, and PR safeguards.
- `.github/config/default.yml`: map each phase to its agent, artifact, skill, local hook behavior, GitHub Actions behavior, and standard/local-only delivery policy.
- `.github/copilot-instructions.md`, `.github/instructions/copilot-instructions.md`, `.github/instructions/pr-preparation.instructions.md`: provide always-on project guidance and PR requirements at supported workspace locations.
- `.github/skills/api-contract/SKILL.md`, `.github/skills/build/SKILL.md`, `.github/skills/changelog/SKILL.md`, `.github/skills/docs-sync/SKILL.md`, `.github/skills/lint/SKILL.md`, `.github/skills/pr-prep/SKILL.md`, `.github/skills/security-scan/SKILL.md`, `.github/skills/test/SKILL.md`: migrate the eight workflow skills to VS Code's discoverable `SKILL.md` folder layout and update their procedures and paths.
- `.github/hooks/README.md`, `.github/hooks/post-commit`, `.github/hooks/pre-commit`: document and provide optional local Git hooks at the supported repository path.
- `.github/agents/config/default.yml`, `.github/agents/hooks/README.md`, `.github/agents/hooks/post-commit`, `.github/agents/hooks/pre-commit`, `.github/agents/instructions/copilot-instructions.md`, `.github/agents/instructions/pull_request_template.md`, `.github/agents/sharenotes-release.agent.md`, `.github/agents/sharenotes-reviewer.agent.md`, `.github/agents/sharenotes-verifier.agent.md`, `.github/agents/skills/api-contract.skill.md`, `.github/agents/skills/build.skill.md`, `.github/agents/skills/changelog.skill.md`, `.github/agents/skills/docs-sync.skill.md`, `.github/agents/skills/lint.skill.md`, `.github/agents/skills/pr-prep.skill.md`, `.github/agents/skills/security-scan.skill.md`, `.github/agents/skills/test.skill.md`: remove the superseded, misplaced agent delivery assets after moving them to supported locations.
- `.github/README.md`, `README.md`, `.github/pull_request_template.md`: document pipeline operation, correct artifact links, and require file-level change reasons and evidence in PRs.
- `.github/workflows/agentic-sdlc.yml`, `.github/workflows/quality.yml`: call quality checks through one reusable workflow and validate the backend/frontend scripts referenced by the PR template.
- `scripts/extract-word-requirements.ps1`, `docs/input/README.md`: extract `.docx` paragraph text locally and document Word-story intake; no source story is included in this delivery.
- `docs/requirements.md`: add the canonical requirements artifact, marked pending reconciliation and approval against the source Word document.
- `docs/architecture.md`, `docs/design-review.md`, `docs/final-review-checklist.md`, `docs/review.md`: update references from the misspelled requirements path.
- `docs/reuirement.md`: remove the superseded misspelled requirements artifact.
- `CHANGELOG.md`: record this delivery under Unreleased.

## Test Evidence

| Check | Result |
| --- | --- |
| `git diff --check` | Passed. Exact output included a line-ending warning for `backend/dist/app.module.js`; exit code was `0`. |
| `git check-ignore -v backend/node_modules/.package-lock.json` | Passed after adding the repository ignore rule. Exact output is recorded below. |
| DOCX extractor, package script, and workflow wiring checks | Passed during the focused workflow validation; the recorded outputs were `SN-101 story`, `30 MB limit`, all six expected script names present, and `git diff --check` exit code `0`. |
| Application lint/build/unit/E2E suites for this PR | Not run during this step-8-only request. `docs/verification.md` records earlier results dated September 22, 2026; they are historical and are not claimed as fresh validation for this diff. |
| GitHub Actions for this working diff | Not run yet; the current branch already has open PR #1, and Actions will rerun after the approved changes are pushed to that PR's head branch. |

Exact validation output:

```text
--- git check-ignore -v ---
.gitignore:1:**/node_modules/   backend/node_modules/.package-lock.json
--- git diff --check ---
warning: LF will be replaced by CRLF in backend/dist/app.module.js.
The file will have its original line endings in your working directory
git_diff_check_exit=0
```

## Security and Data Considerations

- No application API, authorization behavior, or data schema is changed by this delivery.
- The workflow requires explicit user confirmation before staging/committing, pushing, or creating a PR; it excludes unrelated worktree changes and does not force-push.
- The DOCX reader runs locally and adds no runtime package dependency. Review the source document before committing it; no source `.docx` is included here.

## Known Limitations

- No Word source document is present in `docs/input/`. The current requirements artifact is explicitly marked pending reconciliation and approval from the source `.docx`.
- `docs/review.md` contains the existing prototype-risk review, not a fresh review of this pipeline diff. `docs/verification.md` records results dated September 22, 2026; neither artifact was regenerated in this step-8-only request.
- This PR preparation did not rerun application test suites. Existing PR #1 is open for this branch; GitHub Actions evidence for these additional changes will be available after they are pushed.
- Existing PR #1 already targets `main` from `feat/step-8-agentic-sdlc`; update it after pushing approved changes rather than creating a duplicate.
- Local Git hooks are optional and are not automatically enabled. GitHub CLI is not installed in the checked environment; PR creation must use the available GitHub MCP integration after a successful Git push, or `gh` if installed and authenticated elsewhere.
- ShareNotes remains a prototype with in-memory storage and demo-user headers. Authentication, persistence, attachments, OpenAPI, integration infrastructure, backups, observability, and rollback evidence remain production-readiness gaps tracked in `docs/impl-plan.md`.

## Changelog

- Add the agentic SDLC pipeline, supported Copilot customizations, Word intake, and reusable quality workflow; standardize requirements documentation paths.

## Reviewer Checklist

- [ ] Requirements and architecture contracts were checked.
- [ ] Owner authorization and public read behavior are tested.
- [ ] Error and conflict behavior is covered.
- [ ] Security and dependency implications were reviewed.
- [ ] Documentation and known limitations are accurate.
- [ ] Test evidence is reproducible.