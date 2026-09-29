# Phase 2 Planning & Design — EPMCDMETST-66986 (ShareNotes)

> Purpose: Phase-2 planning/design deliverable for the ShareNotes prototype. This document is *planning only* — it defines scope, approach, and design artifacts to produce in Phase 2. It does **not** implement enhancements.

## 1. Project context (short)

**ShareNotes** is a prototype note-management app with:
- **Backend**: NestJS API (token-based public read-only sharing)
- **Frontend**: React
- Current state emphasizes rapid prototyping; Phase 2 focuses on hardening, persistence, DevEx, and operability.

## 2. Architecture scope overview (Phase 2)

### 2.1 In scope

- **Security/correctness hardening**: authn/z, validation, rate limiting, error contract, audit logging.
- **Persistence**: replace in-memory storage with a database-backed model and migrations.
- **API & DevEx**: OpenAPI, consistent response/error shapes, configuration validation, test strategy.
- **Product capability improvements** (selective): sharing controls, search, organization.
- **Ops readiness**: local dev environment, observability primitives, CI quality gates.

### 2.2 Out of scope (for Phase 2 planning)

- Full enterprise IAM integration details (we will define interfaces + pluggable strategies).
- Complex multi-tenant org modeling (unless required by requirements).
- Large-scale attachment pipeline (unless explicitly prioritized as P0/P1).

### 2.3 Target quality attributes

- **Security**: strong access control boundaries; minimized token exposure.
- **Correctness**: consistent validation + error semantics.
- **Reliability**: predictable persistence and migrations.
- **Maintainability**: well-defined API contracts and code boundaries.
- **Operability**: repeatable environments, logs/metrics hooks, CI guardrails.

## 3. Proposed architecture (HLD)

### 3.1 Logical components

- **Frontend (React)**
  - Auth-aware UI (if/when enabled)
  - Notes CRUD UI
  - Share link creation/revocation UI
  - Public share viewer (read-only)

- **Backend (NestJS)**
  - Controllers (HTTP API)
  - Application services (use-cases)
  - Domain model (note, share link)
  - Persistence layer (repositories)
  - Cross-cutting: validation, authn/z guards, rate limiting, audit logging, error filter

- **Persistence**
  - Relational DB (e.g., PostgreSQL)
  - Migration toolchain (schema + seed where appropriate)

- **Ops/Platform (optional depending on priority)**
  - Local dev orchestration (Compose)
  - Observability (structured logs, metrics endpoints)

### 3.2 Primary flows (HLD)

1. **Create/update note**
   - Authenticated request → validate DTO → ownership check → persist → return stable response shape.

2. **Create share link**
   - Authenticated request → validate → create token (store *hashed*) → return share URL once.

3. **Read via share token (public)**
   - Public request → rate limit → token lookup via hash → authorization rules (revoked/expired/view limit) → return read-only note view.

### 3.3 Security model (HLD)

- Replace dev-style identity headers with a real auth mechanism **or** a clearly abstracted auth provider interface.
- Enforce ownership checks for note operations.
- Share tokens treated as secrets:
  - generated with sufficient entropy
  - stored as hash
  - only displayed at creation time
- Add baseline abuse controls: rate limiting, request size limits, consistent error handling to reduce info leakage.

## 4. Low-level design (LLD) — design approach and key decisions to capture

> Note: Keep LLD generic. Do not hardcode repo paths beyond `/docs/*` deliverables.

### 4.1 Data model (LLD)

Document the intended entities and relationships:
- **Note**
  - id, ownerId, title, content, createdAt, updatedAt, deletedAt?
- **ShareLink**
  - id, noteId, tokenHash, createdAt, revokedAt?, expiresAt?, maxViews?, viewCount?

Define:
- indexes (e.g., note owner, share token hash)
- uniqueness constraints
- retention policy for soft-deleted notes/shares

### 4.2 API contract (LLD)

Define:
- request/response schemas for note CRUD + share endpoints
- canonical error payload shape
- pagination/filtering approach (if needed)

### 4.3 Validation & error handling (LLD)

- DTO validation rules (length limits, required fields)
- sanitize rules for user-controlled content (frontend + backend)
- exception-to-error mapping with correlation IDs

### 4.4 Authn/z integration (LLD)

- guard/interceptor approach (NestJS)
- user identity extraction strategy
- authorization rules per endpoint

### 4.5 Rate limiting (LLD)

- identify endpoints to protect (public reads + share creation)
- define default quotas + override strategy
- specify response headers + error behavior

### 4.6 Audit logging (LLD)

- events: create/update/delete note; create/revoke share; public read
- minimal fields (timestamp, actor/userId if known, noteId, shareId, requestId/correlationId, IP/UA if allowed)

## 5. Implementation plan (Phase 2)

### 5.1 Work packages (sequenced)

1. **Design alignment & ticket breakdown**
   - Convert enhancement backlog items into Jira tickets (P0/P1 first)
   - Confirm MVP Phase 2 deliverables

2. **Contract-first hardening**
   - Define OpenAPI + error contract
   - Validation rules and response normalization

3. **Persistence introduction**
   - Add DB + migrations
   - Implement repositories and swap out in-memory maps

4. **Security controls**
   - Authn/z integration approach
   - Share token hashing + abuse controls

5. **Ops/DevEx**
   - Local dev orchestration
   - CI gates and baseline observability

### 5.2 Milestones

- **M1**: API contract + validation/error contract agreed
- **M2**: DB schema + migrations + persistence working end-to-end
- **M3**: Security controls (authz, rate limiting, hashed tokens)
- **M4**: Ops readiness (compose, CI checks, logging/metrics hooks)

### 5.3 Risks & mitigations

- **Auth integration ambiguity** → mitigate by defining an AuthProvider interface and stubbing strategies.
- **Token leakage** → mitigate by hashed storage + one-time display.
- **Scope creep** → mitigate by strict P0/P1 cutline and milestone acceptance criteria.

## 6. Docs structure design & generation approach

### 6.1 Document set (Phase 2)

- `docs/phase2_EPMCDMETST-66986_design.md` (this file)
- `docs/enhancement.md` (curated backlog grouped by priority/theme)
- `docs/pr_checklist_EPMCDMETST-66986.md` (PR and review checklist)

### 6.2 How to maintain the enhancement backlog

- Treat `docs/enhancement.md` as a curated list of *candidates*.
- When an item becomes a Jira ticket:
  - add a Jira link (optional)
  - mark status (Proposed → Approved → In Progress → Done)
  - keep acceptance hints in the item

### 6.3 Definition of done for docs

- Clear project context
- >= 15 enhancement candidates grouped by priority/theme
- No repo-specific file paths invented beyond `/docs/*`

## 7. UI wireframe section (planning)

> UI wireframes are **N/A** for this planning doc, but Phase 2 should include a lightweight UI outline.

### 7.1 Suggested UI outline / “wireframe” (text)

- **Notes List**
  - search input (optional)
  - note rows: title, updated time, tags (optional)
  - actions: create, delete, share

- **Note Editor**
  - title field
  - content editor (plain/rich text)
  - save state indicator
  - share panel: create link, revoke link(s), copy URL

- **Shared Note Viewer (public)**
  - read-only title/content
  - minimal chrome (no edit)
  - “link expired/revoked” empty state

### 7.2 UI acceptance notes

- Share viewer must not expose owner-only actions.
- Share page must handle revoked/expired tokens gracefully.

## 8. Confluence outline (copy/paste structure)

1. **Overview**
   - goal, scope, non-goals
2. **Current state**
   - prototype notes, known limitations
3. **Phase 2 priorities**
   - P0/P1/P2 summary
4. **Architecture (HLD)**
   - components, flows, security model
5. **Design details (LLD)**
   - data model, API contract, validation, authz, rate limiting
6. **Implementation plan**
   - milestones, work packages, risks
7. **Open questions**
8. **Appendix**
   - enhancement backlog link, PR checklist link

## 9. PR outline (expected PR structure)

> Phase 2 will likely span multiple PRs; this is a recommended pattern.

- **PR 1: Contract & validation foundation**
  - OpenAPI generation + error contract + validation rules
- **PR 2: Persistence introduction**
  - schema + migrations + repository layer
- **PR 3: Share security hardening**
  - hashed token storage + revocation/expiration controls + rate limiting
- **PR 4: Observability & DevEx**
  - structured logs, metrics endpoint, CI checks, local orchestration

Each PR should include:
- clear scope statement
- updated docs
- test evidence
- rollback notes (if applicable)
