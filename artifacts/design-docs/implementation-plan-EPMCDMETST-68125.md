# Implementation Plan — EPMCDMETST-68125

**Goal:** Admin CRUD + activate/deactivate for Departments & Doctors; public booking shows only active.

## Phase 0 — Repo validation (must-do)
- [ ] Confirm existing API base path (`/api` vs others) in `backend/src/app.js`.
- [ ] Confirm how role is represented in session/user model (search for `role`, `isAdmin`, etc.).
- [ ] Confirm current frontend routing approach and auth state handling.

## Phase 1 — Database / Prisma
1. Prisma schema
   - [ ] Add `active` boolean (or rename existing `isActive` → `active`) for `Department` and `Doctor`.
   - [ ] Ensure `Doctor` belongs to exactly one `Department` (already has `departmentId`).
2. Case-insensitive unique department name
   - [ ] Prefer Postgres unique index on `lower(name)`.
   - [ ] Add SQL migration (raw) if Prisma cannot express it.
3. Migration execution
   - [ ] Generate migration in `backend/prisma/migrations/`.
   - [ ] Verify on local Postgres.

## Phase 2 — Backend (Express)
1. Authorization
   - [ ] Add `requireAdmin` middleware integrated with existing `authenticate`.
2. Admin routes
   - [ ] Implement `/api/admin/departments` CRUD.
   - [ ] Implement `/api/admin/doctors` CRUD.
   - [ ] Implement activate/deactivate endpoints as PATCH.
3. Public routes adjustments
   - [ ] Ensure existing `GET /api/departments` and `GET /api/doctors` return **active only**.
   - [ ] Ensure bookings reject creating appointments with inactive doctors/departments.
4. Validation & error handling
   - [ ] Use existing validation middleware + schemas.
   - [ ] Return 409 on duplicate department name.

## Phase 3 — Frontend (React)
1. Routing
   - [ ] Add `/admin/departments` and `/admin/doctors`.
   - [ ] Add Admin route guard.
2. Pages/components
   - [ ] Department list + create/edit modal/page.
   - [ ] Doctor list + create/edit modal/page.
   - [ ] Toggle active action with confirmation.
3. Booking UI
   - [ ] Ensure department/doctor selection uses only active lists.
   - [ ] Handle stale selection gracefully.

## Phase 4 — Testing
- [ ] Backend unit tests for middleware and normalization.
- [ ] Backend integration tests for admin endpoints + filtering.
- [ ] Frontend component tests for forms + lists.
- [ ] E2E happy path + inactive filtering regression.

## Phase 5 — Release & Rollback
### Release
- [ ] Deploy DB migration.
- [ ] Deploy backend.
- [ ] Deploy frontend.
- [ ] Run smoke tests: booking flow + admin CRUD.

### Rollback
- Rollback strategy depends on schema changes:
  - If only additive (`active` column added), rollback backend/frontend first; keep columns.
  - If rename/constraint changes, maintain compatibility for one deploy cycle or provide down migration.

## HITL checkpoints
- [ ] DB owner signs off on unique index strategy.
- [ ] Security/auth owner signs off on Admin authz checks.
- [ ] Product confirms delete vs deactivate behavior.
