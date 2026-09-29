# ShareNotes v1 Implementation Plan

**Source:** [architecture.md](architecture.md) and [design-review.md](design-review.md)  
**Generated with:** GitHub Copilot Chat senior planning review  
**Date:** September 9, 2026

## Planning Rules

- `P0` means required for the first production release.
- `P1` means important follow-up work required before or shortly after launch.
- Tasks are ordered by dependency, not by team ownership.
- A task is **blocked** when its required decision or implementation prerequisite is not complete.
- No production code should be written until the decisions in Phase 0 are confirmed.

## Phase 0: Decisions and Contracts

These are the first blockers. They can be resolved in parallel by the product, security, backend, frontend, and infrastructure owners.

| ID | Priority | Task | Deliverable | Dependencies | Blocked until |
| --- | --- | --- | --- | --- | --- |
| PLAN-001 | P0 | Choose identity provider and credential policy | Provider decision, one-hour access session, optional 30-day refresh session, rotation and logout rules | None | Product and security approval |
| PLAN-002 | P0 | Choose hosting, region, database, object storage, queue, and observability platforms | Infrastructure decision record and cost/SLA assumptions | None | Infrastructure approval |
| PLAN-003 | P0 | Choose backend framework and frontend/editor stack | Node/NestJS or Fastify, React framework, Tiptap or Lexical, and structured rich-text format | None | Backend and frontend approval |
| PLAN-004 | P0 | Define API v1 contract | OpenAPI-first endpoint list, request/response schemas, error envelope, status codes, pagination, ETags, and rate-limit headers | PLAN-001, PLAN-003 | Backend and frontend sign-off |
| PLAN-005 | P0 | Define security and data policies | Attachment allowlist, magic-byte rules, 30 MB aggregation rules, sanitization allowlist, retention, audit, and privacy assumptions | PLAN-001, PLAN-002, PLAN-003 | Security sign-off |

**Blocked tasks:** All implementation tasks are blocked until PLAN-001 through PLAN-005 are sufficiently decided. Frontend visual scaffolding may start in parallel, but it must not lock in API or authentication behavior before these decisions.

## Phase 1: Project Foundation

| ID | Priority | Task | Deliverable | Dependencies | Blocked until |
| --- | --- | --- | --- | --- | --- |
| PLAN-010 | P0 | Scaffold backend modular monolith | TypeScript service, module boundaries, linting, formatting, environment template, health-test skeleton | PLAN-002, PLAN-003 | PLAN-001 and PLAN-002 if provider SDK or deployment packages are required |
| PLAN-011 | P0 | Scaffold React frontend | Application shell, routing, linting, formatting, environment template, accessible layout foundation | PLAN-003 | PLAN-003 |
| PLAN-012 | P0 | Set up local development services | Docker Compose for API, PostgreSQL, private S3-compatible storage, and Redis/queue if selected | PLAN-002, PLAN-010, PLAN-011 | PLAN-002 and scaffolds |
| PLAN-013 | P0 | Establish repository quality gates | CI runs lint, typecheck, unit tests, dependency audit, and build checks | PLAN-010, PLAN-011 | CI platform decision |
| PLAN-014 | P1 | Write developer setup documentation | README linking requirements, architecture, review, plan, local setup, test commands, and contribution rules | PLAN-010, PLAN-011, PLAN-012 | Local setup |

## Phase 2: Persistence and Infrastructure

| ID | Priority | Task | Deliverable | Dependencies | Blocked until |
| --- | --- | --- | --- | --- | --- |
| PLAN-020 | P0 | Design relational schema | `users`, `sessions`, `notes`, `share_links`, `attachments`, and `audit_log` entities with ownership, `version`, `deleted_at`, `revoked_at`, and timestamps | PLAN-005 | PLAN-005 |
| PLAN-021 | P0 | Add migrations and indexes | Repeatable migrations, owner/list indexes, token hash index, active-note filtering, attachment indexes, and migration tests | PLAN-020, PLAN-010 | Schema approval |
| PLAN-022 | P0 | Configure database access | ORM/query layer, connection pool, transaction helpers, migration runner, and database health check | PLAN-021 | Database schema |
| PLAN-023 | P0 | Provision private object storage | Encryption, private access, lifecycle cleanup for abandoned objects, service identity, and staging bucket | PLAN-002 | Cloud/platform decision |
| PLAN-024 | P0 | Configure queue and cleanup worker foundation | Retryable queue, dead-letter handling, idempotent job pattern, and metrics | PLAN-002, PLAN-010, PLAN-023 | Queue and storage choices |
| PLAN-025 | P1 | Configure backups and restore rehearsal | PostgreSQL and object-storage backup policy, retention, restore procedure, and staging restore evidence | PLAN-002, PLAN-022, PLAN-023 | Managed services available |

**Blocked tasks:** API persistence work is blocked by PLAN-021 and PLAN-022. Attachment cleanup is blocked by PLAN-023 and PLAN-024.

## Phase 3: Authentication, Sessions, and Request Security

| ID | Priority | Task | Deliverable | Dependencies | Blocked until |
| --- | --- | --- | --- | --- | --- |
| PLAN-030 | P0 | Integrate authentication provider | Registration/login or provider login, token validation, secure cookie/session setup, and owner identity middleware | PLAN-001, PLAN-010, PLAN-022 | Provider selected and persistence ready |
| PLAN-031 | P0 | Implement session lifecycle | One-hour access session, optional 30-day refresh session, rotation, logout invalidation, and expired-session behavior | PLAN-030, PLAN-022 | Authentication integration |
| PLAN-032 | P0 | Implement CSRF protection | CSRF token generation and validation for POST/PATCH/DELETE, frontend header integration, and rejection tests | PLAN-030, PLAN-011 | Session mechanism |
| PLAN-033 | P0 | Implement distributed rate limiting | Per-IP auth limits, per-user mutation limits, per-token public-read limits, `429`, and `Retry-After` | PLAN-002, PLAN-010 | Redis or equivalent selected |
| PLAN-034 | P0 | Test authentication and request security | Login, refresh, logout, authorization middleware, CSRF, rate limits, cookie flags, and session expiry tests | PLAN-030 through PLAN-033 | Security controls implemented |

## Phase 4: Core Note Lifecycle API

| ID | Priority | Task | Deliverable | Dependencies | Blocked until |
| --- | --- | --- | --- | --- | --- |
| PLAN-040 | P0 | Implement shared error and tracing middleware | Stable error envelope with code, safe message, details, timestamp, and trace ID; no production stack traces | PLAN-004, PLAN-010 | API contract |
| PLAN-041 | P0 | Implement note create and list | Authenticated create plus paginated metadata-only list, owner filter, default limit 20, maximum 100, and updated-time sort | PLAN-022, PLAN-030, PLAN-040 | Auth and database |
| PLAN-042 | P0 | Implement note detail and ownership checks | Owner-only full detail, deleted-note `404`, attachment metadata, and consistent authorization behavior | PLAN-041 | Note persistence |
| PLAN-043 | P0 | Implement versioned note update | Owner-only `PATCH`, integer version check, increment on success, and `409 Conflict` with current version | PLAN-042 | Detail and schema version field |
| PLAN-044 | P0 | Implement soft-delete endpoint | Owner confirmation at API boundary, set `deleted_at`, exclude from lists/details, invalidate public reads, and enqueue attachment cleanup | PLAN-042, PLAN-024 | Deletion schema and queue |
| PLAN-045 | P0 | Test note lifecycle and consistency | CRUD, ownership, pagination, deleted-note behavior, transactions, and concurrent update conflict tests | PLAN-041 through PLAN-044 | Core endpoints |

**Blocked tasks:** Note endpoints are blocked by authentication, database access, and the error contract. Frontend workflows are blocked until these endpoint contracts stabilize.

## Phase 5: Sharing and Public Read Access

| ID | Priority | Task | Deliverable | Dependencies | Blocked until |
| --- | --- | --- | --- | --- | --- |
| PLAN-050 | P0 | Implement share-link creation | 256-bit opaque token, token hash storage, owner authorization, idempotent active-link behavior, and share URL response | PLAN-022, PLAN-030, PLAN-042 | Owner detail and token schema |
| PLAN-051 | P0 | Implement public shared-note read | Token hash lookup, revoked/deleted checks, read-only response, `404`, no-cache/must-revalidate, and ETag behavior | PLAN-050, PLAN-040 | Share-link storage |
| PLAN-052 | P0 | Implement owner share-link revocation | Owner-only `DELETE /api/v1/notes/:noteId/share/:token`, set `revoked_at`, and ensure future reads return `404` | PLAN-050 | Share creation |
| PLAN-053 | P0 | Test sharing and invalidation | Public unauthenticated read, token non-disclosure, revocation, deletion invalidation, ETag revalidation, and authorization tests | PLAN-050 through PLAN-052 | Sharing endpoints |

## Phase 6: Attachments and Rich-Text Security

These tracks can proceed in parallel after the core note contract is stable.

| ID | Priority | Task | Deliverable | Dependencies | Blocked until |
| --- | --- | --- | --- | --- | --- |
| PLAN-060 | P0 | Implement aggregate 30 MB validation | Backend check covering text plus all attachments on create and update; return `413 Payload Too Large` before commit | PLAN-041, PLAN-043, PLAN-005 | Note mutation endpoints |
| PLAN-061 | P0 | Implement attachment allowlist validation | PDF, TXT, MD, JPG, PNG, GIF, WebP allowlist; extension, declared MIME, magic-byte, filename, and size checks | PLAN-005, PLAN-023 | Security policy and storage |
| PLAN-062 | P0 | Implement API-mediated attachment storage | Multipart upload, private object keys, transaction-safe attachment metadata, rollback of failed uploads, and no direct presigned upload in v1 | PLAN-023, PLAN-060, PLAN-061 | Storage and validation |
| PLAN-063 | P0 | Implement signed attachment downloads | Owner/shared-read authorization, private signed URLs with 15-minute TTL, per-token download rate limit, and deleted/revoked access denial | PLAN-051, PLAN-062 | Public read and storage |
| PLAN-064 | P0 | Implement attachment cleanup and retention jobs | Deletion queue, three retries, dead-letter handling, orphan metrics/alerts, one-hour target, and 60-day permanent purge job | PLAN-024, PLAN-044, PLAN-062 | Soft delete and queue |
| PLAN-065 | P0 | Implement rich-text format and sanitization | Structured editor content, backend output sanitization, frontend defense-in-depth sanitization, safe URL rules, and CSP | PLAN-003, PLAN-040 | Format and sanitizer decisions |
| PLAN-066 | P0 | Test attachment and content security | 30 MB boundary, invalid file signatures, malicious rich text, signed URL expiry, cleanup retries, dead letters, and public access controls | PLAN-060 through PLAN-065 | Security implementations |

## Phase 7: Frontend Workflows

| ID | Priority | Task | Deliverable | Dependencies | Blocked until |
| --- | --- | --- | --- | --- | --- |
| PLAN-070 | P0 | Integrate editor and auth session UI | Tiptap/Lexical editor, allowed formatting, login/signup/logout, session bootstrap, and protected routes | PLAN-003, PLAN-011, PLAN-030, PLAN-065 | Editor and auth decisions |
| PLAN-071 | P0 | Build authenticated note list and editor | New note, list, detail, create, update, version field, save states, `409` conflict UI, and `413` size feedback | PLAN-041 through PLAN-043, PLAN-060, PLAN-070 | Core API and editor |
| PLAN-072 | P0 | Build delete and sharing controls | Confirmation flow, delete redirect, share generation, Clipboard API, revoke control, and error states | PLAN-044, PLAN-050, PLAN-052, PLAN-070 | Delete/share endpoints |
| PLAN-073 | P0 | Build public shared-note page | Unauthenticated route, read-only rendering, signed attachment downloads, loading/error states, and deleted/revoked `404` state | PLAN-051, PLAN-063, PLAN-070 | Public API and editor renderer |
| PLAN-074 | P1 | Apply responsive accessibility and frontend security checks | Keyboard navigation, labels, contrast, safe link handling, CSP verification, and mobile layouts | PLAN-071 through PLAN-073 | Primary workflows |

## Phase 8: Contract, Integration, and Operational Verification

| ID | Priority | Task | Deliverable | Dependencies | Blocked until |
| --- | --- | --- | --- | --- | --- |
| PLAN-080 | P0 | Publish and validate OpenAPI | Complete schemas, examples, status codes, auth rules, pagination, ETags, errors, and generated contract checks | PLAN-004, PLAN-040 through PLAN-063 | Endpoint behavior stable |
| PLAN-081 | P0 | Run end-to-end acceptance tests | Playwright flows for login, create, edit, conflict, share, visitor read, revoke, delete, and public `404` | PLAN-053, PLAN-066, PLAN-071 through PLAN-073 | Backend and frontend flows |
| PLAN-082 | P0 | Run integration and security suite | Real PostgreSQL/storage test environment, transaction rollback, authorization, XSS, CSRF, rate limits, uploads, and cleanup behavior | PLAN-034, PLAN-045, PLAN-053, PLAN-066 | Security and lifecycle tests |
| PLAN-083 | P1 | Run performance and load tests | Note-list pagination, public reads, concurrent edits, attachment throughput, p95 targets, and database query plans | PLAN-080, PLAN-081 | Contract and E2E stability |
| PLAN-084 | P0 | Implement observability and audit logging | OpenTelemetry traces, structured logs, audit events, health/readiness endpoints, dashboards, and actionable alert thresholds | PLAN-002, PLAN-010, PLAN-024, PLAN-044 | Platform and event sources |
| PLAN-085 | P0 | Configure CI/CD and deployment | Container builds, staging promotion, blue-green release, N/N-1 migration checks, smoke tests, and under-10-minute rollback | PLAN-013, PLAN-021, PLAN-082, PLAN-084 | Tests and infrastructure |
| PLAN-086 | P0 | Write operational runbooks | Deployment, rollback, backup/restore, incident response, cleanup recovery, security patching, and capacity guidance | PLAN-025, PLAN-064, PLAN-084, PLAN-085 | Operational evidence |

## Phase 9: Launch Gate

| ID | Priority | Task | Deliverable | Dependencies | Blocked until |
| --- | --- | --- | --- | --- | --- |
| PLAN-090 | P0 | Execute production-readiness review | Signed checklist covering security, tests, performance, backups, alerts, audit, runbooks, and data retention | PLAN-081 through PLAN-086 | All P0 verification work |
| PLAN-091 | P0 | Perform rollback and restore drills | Evidence that deployment rollback meets the under-10-minute target and backup restore meets the agreed RTO/RPO | PLAN-025, PLAN-085, PLAN-086 | Deployment and backup runbooks |
| PLAN-092 | P0 | Approve launch | Product, engineering, security, and operations sign-off; documented unresolved risks | PLAN-090, PLAN-091 | Readiness evidence |

## Blocked Task Register

| Blocked task group | Blocker | What must finish first |
| --- | --- | --- |
| Backend and frontend production scaffolding | Platform/framework choices | PLAN-001 through PLAN-003 |
| Authentication and sessions | Identity provider, session storage, database access | PLAN-001, PLAN-022 |
| Note CRUD | Auth middleware, database schema, error contract | PLAN-021, PLAN-030, PLAN-040 |
| Sharing | Owner note access and token schema | PLAN-042, PLAN-050 |
| Attachment upload | Object storage, 30 MB policy, file allowlist | PLAN-023, PLAN-060, PLAN-061 |
| Cleanup and retention | Queue, soft deletion, attachment records | PLAN-024, PLAN-044, PLAN-062 |
| Frontend workflows | Stable API contract, auth, editor format | PLAN-004, PLAN-030, PLAN-065 |
| Contract and E2E testing | Implemented endpoints and UI flows | PLAN-053, PLAN-066, PLAN-071 through PLAN-073 |
| Deployment and launch | Passing security/integration tests, observability, rollback evidence | PLAN-082, PLAN-084, PLAN-085 |

## Parallel Workstreams

After Phase 0 decisions and the foundation are complete, work can proceed in parallel:

- **Backend:** persistence -> authentication -> note API -> sharing -> attachments.
- **Frontend:** application shell -> editor/auth UI -> note workflows -> shared-note page.
- **Security and QA:** test contracts and fixtures early, then execute lifecycle, XSS, upload, and authorization suites as APIs land.
- **Operations:** CI, observability, backups, runbooks, and infrastructure-as-code alongside application development.

## Immediate Next Actions

1. Confirm PLAN-001 through PLAN-005 and assign owners.
2. Create the backend and frontend scaffolds with the chosen stack.
3. Publish the first API contract before implementing frontend API calls.
4. Create the initial database migration and local development services.
5. Set up CI so every subsequent task is validated automatically.

## Definition of Done for v1

- All P0 tasks are complete and linked to reviewed evidence.
- Owner-only mutations and public read-only sharing pass integration tests.
- Version conflicts return `409`; deleted or revoked links return `404`.
- The backend rejects aggregate payloads over 30 MB and disallowed attachments.
- XSS, CSRF, upload, rate-limit, and token-security tests pass.
- Backups, restore, cleanup, alerting, deployment, and rollback drills are complete.
- The production-readiness review is signed off by product, engineering, security, and operations.
