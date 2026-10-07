# Pull Request Checklist

Use this checklist before opening or merging a PR.

## Scope & Requirements
- [ ] PR title includes Jira key (e.g., `EPMCDMETST-68387: ...`).
- [ ] Acceptance criteria from Jira are implemented.

### For EPMCDMETST-68387 (Admin manages SMS templates)
- [ ] Admin can list SMS templates.
- [ ] Admin can update template per message type (`BOOKING`, `CANCELLATION`, `RESCHEDULING`).
- [ ] Admin can preview rendered SMS.
- [ ] Allowed variables enforced: `patientName`, `appointmentDate`, `appointmentTime`, `doctorName`, `department`, `appointmentId`.
- [ ] Placeholder syntax `{{var}}` supported (and `{var}` kept for backward compatibility).
- [ ] SMS sending flow loads template from DB by messageType with safe fallback if missing.

## Backend
- [ ] Admin endpoints implemented:
  - [ ] `GET /api/admin/sms-templates`
  - [ ] `PUT /api/admin/sms-templates/:messageType`
  - [ ] `POST /api/admin/sms-templates/preview`
- [ ] Auth enforced for `/api/admin/*`.
- [ ] Zod validation added for all new endpoints.
- [ ] Error responses follow `{ error: { code, message, field } }` convention.
- [ ] NotificationService cache invalidated after template update.

## Frontend
- [ ] Admin page added: list + editor + preview.
- [ ] UI shows allowed variables and validation errors.
- [ ] Loading/error states handled.

## Tests
- [ ] Unit tests for placeholder parser/renderer.
- [ ] Integration tests for admin API auth.
- [ ] Integration test ensures send uses updated template.
- [ ] `backend/npm test` passes.
- [ ] `frontend/npm run build` passes.

## Docs & Ops
- [ ] Technical design doc exists and is up-to-date:
  - [ ] `artifacts/design-docs/tech-design-EPMCDMETST-68387.md`
  - [ ] `docs/design.md` links to the design doc
- [ ] `.env.example` updated if new env vars introduced.
- [ ] No secrets committed.

## Quality
- [ ] No dead/debug code.
- [ ] PR is reasonably sized and self-contained.
