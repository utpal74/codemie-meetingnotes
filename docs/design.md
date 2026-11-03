# Technical Design — EPMCDMETST-70755

- **Jira:** https://jiraeu.epam.com/browse/EPMCDMETST-70755
- **Branch:** `feature/EPMCDMETST-70755-meetingnotes`
- **Date:** 2026-11-03
- **Status:** Draft (Ready for dev)

## 1. Implementation plan

> Goal: convert BA story into an implementation-ready change set. This ticket is documentation-only: create/update `artifacts/enhancement.md` with a standardized gap-log table and seed it with initial key gaps.

### T-01 Create/standardize enhancement backlog document
- **Description:** Ensure `artifacts/enhancement.md` exists and uses a consistent gap-log table format.
- **Files to create/modify:**
  - `artifacts/enhancement.md`
- **Depends on:** none
- **Verifying test:** Manual: open markdown file and confirm table renders with required columns.

### T-02 Seed initial key gaps (no duplicates)
- **Description:** Add initial P1/P2 gaps based on existing repo documentation; do not duplicate any already present entries.
- **Files to create/modify:**
  - `artifacts/enhancement.md`
- **Depends on:** T-01
- **Verifying test:** Manual: scan table to confirm no duplicate rows (same gap statement/evidence).

### T-03 Add contribution guidelines for future updates
- **Description:** Add a short “How to update this file” section including de-duplication rule and required fields (evidence + related Jira story key).
- **Files to create/modify:**
  - `artifacts/enhancement.md`
- **Depends on:** T-01
- **Verifying test:** Manual: verify section exists and explicitly states no-duplicate rule and required evidence/story fields.

## 2. High-level design (HLD)

### 2.1 Components touched
- Docs only:
  - `artifacts/enhancement.md`

No backend, frontend, database, or CI changes.

### 2.2 Data flow
N/A (documentation-only).

### 2.3 API surface
No API changes.

### 2.4 Non-functional considerations
- **Traceability:** each gap row must link to a Jira story key and cite evidence (repo path/document section).
- **Idempotency:** updates must append only new gaps; never create duplicates.

## 3. Low-level design (LLD)

### 3.1 Document structure for `artifacts/enhancement.md`

**Header**
- Title: `# Enhancement backlog / Gap log`
- A short sentence explaining purpose.
- Optional: “Related story” (this ticket key) for traceability.

**Table columns (must match Jira ACs + BA business rules)**
| Column | Type | Notes |
|---|---|---|
| Gap / enhancement | string | One clear statement; actionable.
| Evidence (source) | string | Must include file path(s) and/or doc section(s).
| Impact | string | What breaks / why it matters.
| Recommendation | string | Proposed requirement/design change.
| Priority | enum | P1/P2/P3.
| Owner | string | Role or named owner.
| Status | enum | Open / In progress / Done / Won’t do.

**How to update (contribution rules)**
- Add rows only for new gaps.
- Before adding, search the file for similar wording/evidence.
- Always include: evidence + related Jira story key (either in Evidence cell or a “Related story:” line near the table).

### 3.2 Seed gaps (initial content)
Seed gaps should focus on items that block implementation/testing, e.g.:
- UI workflow acceptance coverage for cancel/reschedule and SMS triggers.
- Appointment creation validation matrix and slot selection rules.
- SMS content/idempotency/failure behaviors.

> Note: If `artifacts/enhancement.md` already includes some or all of these, keep existing rows and only append missing ones.

### 3.3 Error handling / validation
N/A.

### 3.4 Backward compatibility
N/A.

## 4. UI wireframes
N/A.

## 5. Traceability

| Acceptance criterion | Task(s) | Artifact | Planned verification |
|---|---|---|---|
| AC-1: `artifacts/enhancement.md` exists and includes a gap-log table with defined columns. | T-01 | `artifacts/enhancement.md` | Manual check: file exists, table columns match design. |
| AC-2: When updating, new gaps are added only if not already present. | T-02, T-03 | `artifacts/enhancement.md` | Manual check: no duplicate rows; contribution rules documented. |
| AC-3: Every gap entry includes evidence and a related Jira story key. | T-02, T-03 | `artifacts/enhancement.md` | Manual check: every row has evidence + story key reference. |

## 6. Open questions
None.
