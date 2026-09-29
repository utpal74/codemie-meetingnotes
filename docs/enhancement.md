# Enhancement Backlog

This document captures *candidate* enhancements and feature gaps identified by scanning the repository.
It is intentionally lightweight and is meant to be refined into Jira tickets.

> Scope note: The current implementation is a **prototype** with minimal hardening and (likely) in-memory storage.

## Project context

- **Product**: ShareNotes — create/manage notes and generate **public read-only** share links via opaque tokens.
- **Backend**: NestJS API.
- **Frontend**: React.
- **Sharing model**: token-based access for public read-only viewing.

---

## Enhancement candidates / feature gaps

Guidance:
- **P0**: security/correctness blockers before broader usage
- **P1**: important for durability, maintainability, and delivery
- **P2**: valuable product/ops enhancements after core hardening

Each item includes: **Title**, **Area/Component**, **Intent**, **Notes / acceptance hints**.

---

### P0 — Security & correctness

1) **Replace dev identity mechanism with real authentication** *(P0)*
- **Area/Component**: security, backend, frontend
- **Intent**: ensure only authenticated users can create/update/delete notes and manage shares.
- **Notes / acceptance hints**: define an auth strategy (e.g., JWT/OIDC/session) or an AuthProvider abstraction; remove reliance on dev headers; verify endpoints reject unauthenticated requests.

2) **Authorization enforcement for note ownership** *(P0)*
- **Area/Component**: security, backend
- **Intent**: prevent cross-user access/modification of notes.
- **Notes / acceptance hints**: add ownership checks on read/update/delete/share operations; add negative tests for IDOR scenarios.

3) **Harden public share endpoint against abuse (rate limiting + throttling)** *(P0)*
- **Area/Component**: security, backend, ops
- **Intent**: reduce token-guessing and scraping.
- **Notes / acceptance hints**: apply rate limiting to share reads and share creation; ensure consistent 429 responses; consider IP- and route-based policies.

4) **Store share tokens as hashes (never persist raw tokens)** *(P0)*
- **Area/Component**: security, backend, persistence
- **Intent**: reduce blast radius if storage is leaked.
- **Notes / acceptance hints**: store token hash + salt/pepper strategy; only show token at creation time; compare hashes on read.

5) **Consistent request validation and payload limits** *(P0)*
- **Area/Component**: correctness, backend
- **Intent**: avoid crashes and undefined behavior from invalid inputs.
- **Notes / acceptance hints**: DTO validation with explicit max lengths; validate decoded payload sizes; reject unknown fields where appropriate.

6) **Standardize error contract (API-wide)** *(P0)*
- **Area/Component**: correctness, backend
- **Intent**: make errors predictable for the frontend and reduce info leakage.
- **Notes / acceptance hints**: implement a global exception filter returning `{ code, message, details?, correlationId? }`; ensure status codes align with semantics.

7) **Audit logging for sensitive events** *(P0)*
- **Area/Component**: security, ops, backend
- **Intent**: enable traceability for note/share access.
- **Notes / acceptance hints**: log create/update/delete/share/revoke/read with request ID; ensure logs avoid storing sensitive token values.

---

### P1 — Persistence & data lifecycle

8) **Introduce database persistence + migrations** *(P1)*
- **Area/Component**: backend, persistence
- **Intent**: replace in-memory storage with durable storage.
- **Notes / acceptance hints**: define schema for notes and share links; add migration workflow; ensure local dev can run migrations.

9) **Soft-delete notes with retention policy** *(P1)*
- **Area/Component**: backend, persistence
- **Intent**: reduce accidental data loss while enabling cleanup.
- **Notes / acceptance hints**: add `deletedAt` and exclude by default; add purge job/policy definition; document retention.

10) **Share link lifecycle controls (revocation + expiration)** *(P1)*
- **Area/Component**: backend, product
- **Intent**: allow creators to control exposure over time.
- **Notes / acceptance hints**: add revokedAt/expiresAt semantics; return clear UX states for expired/revoked links.

11) **View limits / one-time links (optional access constraints)** *(P1)*
- **Area/Component**: backend, product
- **Intent**: reduce long-lived exposure.
- **Notes / acceptance hints**: implement maxViews or one-time access; ensure concurrency-safe increment/check.

---

### P1 — API & Developer Experience

12) **OpenAPI/Swagger generation and publishing** *(P1)*
- **Area/Component**: backend, DevEx
- **Intent**: document the API contract for frontend and integrators.
- **Notes / acceptance hints**: generate OpenAPI from code annotations; include examples; document auth and error shapes.

13) **Configuration validation at startup** *(P1)*
- **Area/Component**: backend, ops
- **Intent**: fail fast on misconfiguration.
- **Notes / acceptance hints**: validate required env vars; provide defaults for dev; produce a single readable config summary (without secrets).

14) **Add request correlation IDs end-to-end** *(P1)*
- **Area/Component**: backend, ops
- **Intent**: improve debugging across logs and client errors.
- **Notes / acceptance hints**: accept inbound request-id header or generate; include in responses and logs.

15) **Testing strategy uplift (unit + integration)** *(P1)*
- **Area/Component**: backend, frontend
- **Intent**: prevent regressions as persistence/security is introduced.
- **Notes / acceptance hints**: define baseline test pyramid; add integration tests around share-token read path and authz.

---

### P2 — Product features

16) **Search notes (title/content)** *(P2)*
- **Area/Component**: product, backend, frontend
- **Intent**: improve note retrieval.
- **Notes / acceptance hints**: simple contains match initially; consider DB full-text search as follow-up.

17) **Tags/folders for organization** *(P2)*
- **Area/Component**: product, backend, frontend
- **Intent**: improve navigation and categorization.
- **Notes / acceptance hints**: define minimal tag model; update list filtering; ensure tags are validated.

18) **Note version history / restore** *(P2)*
- **Area/Component**: product, backend, persistence
- **Intent**: allow recovery and visibility into changes.
- **Notes / acceptance hints**: store revisions with timestamps and actor; add restore endpoint and UI affordance.

19) **Rich text editor support with sanitization** *(P2)*
- **Area/Component**: frontend, security
- **Intent**: richer authoring while preventing XSS.
- **Notes / acceptance hints**: define allowed formatting; sanitize on render; add security tests for script injection.

20) **Better UX for share links (copy, manage multiple links)** *(P2)*
- **Area/Component**: frontend, product
- **Intent**: make sharing smoother.
- **Notes / acceptance hints**: “copy link” action; list active shares; show expiration/revocation states.

---

### P2 — Operations & platform readiness

21) **Local dev orchestration (DB, caches) via Docker Compose** *(P2)*
- **Area/Component**: devops
- **Intent**: simplify onboarding and testing.
- **Notes / acceptance hints**: one command to start dependencies; document environment variables.

22) **Observability baseline (structured logs + metrics hooks)** *(P2)*
- **Area/Component**: ops, backend
- **Intent**: enable monitoring and alerting.
- **Notes / acceptance hints**: structured JSON logs; basic request duration metrics; document how to consume.

23) **CI quality gates** *(P2)*
- **Area/Component**: devops
- **Intent**: keep main branch healthy.
- **Notes / acceptance hints**: lint/test/build steps; dependency/security scanning; enforce formatting.

---

## Notes on converting to Jira tickets

- Prefer splitting by **theme + outcome** (e.g., “Error contract standardization”, “Share token hashing”).
- Each ticket should include:
  - API contract changes (if any)
  - test plan
  - acceptance criteria aligned with the hints above
