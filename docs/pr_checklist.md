# Pull Request Checklist

Use this checklist before opening or merging a PR.

## Scope & Requirements
- [ ] PR title includes Jira key (e.g., `EPMCDMETST-68125: ...`).
- [ ] Acceptance criteria from Jira are implemented (create/edit/activate/deactivate departments & doctors).
- [ ] Department name uniqueness enforced (case-insensitive).
- [ ] Doctor requires name + exactly one department.
- [ ] Only **Admin** can access admin UI and `/api/admin/*` endpoints.
- [ ] Booking flow blocks inactive departments/doctors for **new** bookings.
- [ ] Historical appointments still render correctly even if department/doctor becomes inactive.

## Backend
- [ ] Prisma schema updated and migrations created/applied.
- [ ] Referential integrity preserved (FKs, no orphan doctors).
- [ ] Validation added via Zod for all new/changed endpoints.
- [ ] Error responses follow `{ error: { code, message, field } }` convention.
- [ ] Logging added for important admin mutations (create/update/toggle).

## Frontend
- [ ] Admin routes/pages added and guarded by role.
- [ ] UI handles loading/error states.
- [ ] Forms validate required fields and show helpful messages.
- [ ] Booking UI filters inactive doctors/departments.

## Tests
- [ ] Unit tests added/updated for validation and authz middleware.
- [ ] Integration tests added/updated for new admin endpoints.
- [ ] Booking regression tests cover inactive filtering.
- [ ] `backend/npm test` passes.
- [ ] `frontend/npm run build` passes.

## Docs & Ops
- [ ] Technical design doc exists and is up-to-date:
  - [ ] `artifacts/design-docs/tech-design-EPMCDMETST-68125.md`
  - [ ] `docs/design.md` links to the design doc
- [ ] `.env.example` updated if new env vars introduced.
- [ ] No secrets committed.

## Quality
- [ ] No dead/debug code or console logs.
- [ ] Lint/format (if configured) is clean.
- [ ] PR is reasonably sized and self-contained.
