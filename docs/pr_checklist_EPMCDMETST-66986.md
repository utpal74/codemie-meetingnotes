# PR Checklist — EPMCDMETST-66986 (Phase 2 Planning/Design)

This checklist is intended to keep Phase-2 changes (hardening, persistence, DevEx, ops) consistent and reviewable.

## 1) Before you open the PR (author)

### Scope & hygiene
- [ ] PR has a **single clear goal** and avoids unrelated refactors.
- [ ] PR description includes: **problem**, **approach**, **trade-offs**, **testing evidence**, **rollout/rollback** (as applicable).
- [ ] Any new behavior is behind a config flag if risk is high or rollout is uncertain.

### Security/correctness (as applicable)
- [ ] Inputs are validated (length limits, required fields, allowed formats).
- [ ] Authorization rules are explicitly enforced server-side (no client trust).
- [ ] Public/token-based endpoints have abuse controls (rate limiting / throttling) when in scope.
- [ ] Sensitive values (share tokens, secrets) are not logged.

### API contract & compatibility (as applicable)
- [ ] Request/response shapes are documented (OpenAPI if available).
- [ ] Error responses follow the standard error contract.
- [ ] Breaking changes are called out and migration notes are provided.

### Persistence/data (as applicable)
- [ ] Migrations included and tested (up/down if supported by tooling).
- [ ] Schema changes include indexes/constraints where relevant.
- [ ] Data lifecycle behaviors are defined (soft delete, retention, cleanup).

### Frontend UX (as applicable)
- [ ] Loading/error/empty states implemented.
- [ ] Public share viewer is strictly read-only.
- [ ] Copy/share affordances work across common browsers.

### Testing
- [ ] Added/updated unit tests for new logic.
- [ ] Added/updated integration tests for critical flows (authz, share reads, persistence).
- [ ] Documented manual test steps if automated tests are not feasible.

### Docs
- [ ] Updated `docs/enhancement.md` if new gaps are found or scope changes.
- [ ] Updated relevant design/requirements docs if the PR changes planned behavior.

## 2) PR description template (author)

Copy/paste into PR description:

- **What / Why**:
- **Approach**:
- **Trade-offs**:
- **Security considerations**:
- **API changes**:
- **DB/migrations**:
- **Testing**:
  - Automated:
  - Manual:
- **Rollout / rollback**:
- **Follow-ups**:

## 3) Review steps (reviewer)

### Functional review
- [ ] Does the PR meet the stated goal with minimal scope?
- [ ] Are edge cases handled (invalid input, missing resources, unauthorized access)?

### Security review
- [ ] Are authn/z checks correct and centralized (guards/middleware), not duplicated ad hoc?
- [ ] Are token-based endpoints designed to avoid leakage and guessing?
- [ ] Are logs free of secrets and PII considerations documented?

### API/design review
- [ ] Are contracts consistent (status codes, error payloads, naming)?
- [ ] Are changes backward compatible or clearly flagged as breaking?

### Data review
- [ ] Are migrations safe and reversible (or rollback plan provided)?
- [ ] Are indexes/constraints adequate for expected access patterns?

### Operability review
- [ ] Are there sufficient logs/metrics hooks to debug issues?
- [ ] Are configuration changes validated and documented?

### Quality review
- [ ] Are tests meaningful (they fail for the right reasons) and cover critical paths?
- [ ] Is code readable (naming, structure, comments where needed)?

## 4) Merge readiness gates

- [ ] CI is green.
- [ ] At least one reviewer approved (more for security/persistence changes).
- [ ] Any required docs are updated.
- [ ] No TODOs left that change runtime behavior.

## 5) Post-merge verification (optional but recommended)

- [ ] Smoke test key flows:
  - [ ] create/update note
  - [ ] create share link
  - [ ] read via share token (public)
  - [ ] revoke/expire behavior (if implemented)
- [ ] Confirm logs and correlation IDs appear as expected.
