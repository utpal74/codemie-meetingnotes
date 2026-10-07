# Technical Design Package — EPMCDMETST-68387: Admin manages SMS templates

## 1. Summary
This change introduces admin management of SMS templates used by the appointment system. Admins can list and update templates for each message type (booking/cancellation/rescheduling) and preview rendered content using supported placeholders.

The backend already includes:
- Prisma `SmsTemplate` model keyed by `messageType`
- `NotificationService.getTemplates()` which reads templates from DB with a 5-minute cache
- SMS sending through Twilio

This ticket extends those capabilities with admin API endpoints, stricter placeholder validation, a preview endpoint, and a frontend admin page.

## 2. Scope
### In scope
- Admin endpoints:
  - `GET /api/admin/sms-templates`
  - `PUT /api/admin/sms-templates/:messageType`
  - `POST /api/admin/sms-templates/preview`
- Store templates in DB (existing `SmsTemplate` model).
- Placeholder parsing and validation.
- SMS sending flow loads DB template and falls back to safe defaults if missing.
- Frontend admin page to edit templates and preview.
- Tests (unit + integration) as specified.

### Out of scope
- Multi-tenant / per-doctor / per-department templates.
- Audit log persistence (who changed what) — **TBD** if user identity exists in session.
- Template approvals/version history.

## 3. Assumptions / TBDs (explicit)
- **TBD (AUTHZ)**: Repo shows `req.session.authenticated` only. If roles exist, admin routes should require an admin role (e.g., `req.session.user.role === 'ADMIN'`).
- **TBD (DEFAULTS)**: Determine where default/hardcoded templates exist today. Current system appears DB-driven; if no defaults exist, we will add local defaults in `NotificationService`.
- **TBD (FRONTEND ADMIN ROUTES)**: Confirm existing admin navigation and routing patterns in `frontend/src`.
- **TBD (SEED)**: Confirm whether `backend/prisma/seed.js` inserts `SmsTemplate` rows.

## 4. Repository stack (inspected)
### Backend
- Node.js, Express (`backend/package.json`)
- Prisma ORM + Postgres (`backend/prisma/schema.prisma`)
- Validation: Zod + custom `validate` middleware
- Auth: express-session; `authenticate` middleware checks `req.session.authenticated`
- SMS: Twilio (`twilio` npm package)

### Frontend
- React + Vite
- React Router
- Axios
- TailwindCSS

## 5. High-level design (HLD)
See: `artifacts/design-docs/hld-EPMCDMETST-68387.md`

## 6. Low-level design (LLD)
See: `artifacts/design-docs/lld-EPMCDMETST-68387.md`

## 7. Data model
### Existing Prisma model
`backend/prisma/schema.prisma` currently defines:

```prisma
enum MessageType {
  BOOKING
  CANCELLATION
  RESCHEDULING
}

model SmsTemplate {
  id           String      @id @default(uuid())
  messageType  MessageType @unique
  templateBody String
  updatedAt    DateTime    @updatedAt
}
```

### Requested schema note
Ticket mentions likely schema: `sms_templates` with `event_type enum`, `content`, `createdAt`, `updatedAt`.

Current schema differs slightly:
- `messageType` vs `event_type`
- `templateBody` vs `content`
- missing `createdAt`

Decision:
- Keep existing model name/shape for minimal change and to match current code.
- Optionally add `createdAt` later if required by product (**TBD**).

## 8. Placeholder rules
### Supported variables (required list)
- `patientName`
- `appointmentDate`
- `appointmentTime`
- `doctorName`
- `department`
- `appointmentId`

### Syntax
- Preferred: `{{variable}}` (whitespace allowed)
- Backward compatible: `{variable}` (currently used by `smsFormat.interpolate()`)

### Validation
- Template save and preview must reject unknown placeholders.
- Template save and preview must reject malformed tokens (e.g., `{{ }}`, `{{patient-name}}`). Only `\w+` is allowed.
- Length: max 500 chars (configurable; SMS is typically 160 chars but concatenated SMS is acceptable).

### Rendering behavior
- Preview endpoint uses **strict** mode: missing variable values replace with empty string or keep token? Decision: keep token by default to clearly show missing data; can optionally accept a `missingBehavior` flag (**TBD**).
- Runtime sending uses **lenient** mode: unknown placeholders should never exist (blocked by validation) but missing values may occur; leave token to avoid sending misleading info.

## 9. Backend API specs
See: `artifacts/design-docs/api-spec-EPMCDMETST-68387.md`

## 10. Implementation plan
1. **Repo reconnaissance**
   - Confirm admin route mounting in `backend/src/app.js` / `backend/src/server.js`.
   - Confirm admin navigation/routing in frontend.

2. **Backend changes**
   - Add placeholder helper `smsTemplate` supporting `{{}}` + `{}`.
   - Add admin route `routes/admin/smsTemplates.js`.
   - Add Zod schemas under `schemas/admin`.
   - Hook up router in backend app under `/api/admin`.
   - Add NotificationService cache clear and fallback defaults.

3. **Frontend changes**
   - Add admin page with list/editor/preview.
   - Add API functions.
   - Add nav link.

4. **Testing**
   - Unit tests for placeholder parsing/rendering.
   - Integration tests for API auth.
   - Integration/unit test for NotificationService picking updated template.

5. **Docs & rollout**
   - Confirm seed strategy (create defaults if missing).
   - Deploy backend then frontend (or together).

## 11. Security considerations
- Admin endpoints must be protected by session auth.
- Add rate limiting on preview endpoint (reuse existing `express-rate-limit` if configured; **TBD** where used).
- Avoid logging template bodies at info level.

## 12. Testing strategy
### Unit
- `extractPlaceholders()` detects both syntaxes and ignores duplicates.
- `validatePlaceholders()` rejects unknown.
- `renderTemplate()` replaces known variables.

### Integration
- Unauthenticated admin API returns 401.
- PUT persists and subsequent GET returns updated body.

### Integration (service)
- When template exists in DB, NotificationService uses it.
- When missing, fallback template used.

## 13. Rollout plan
- If no schema change: deploy backend + frontend.
- If `createdAt` is later needed: add prisma migration + deploy.
- Ensure DB has at least one row per `MessageType`:
  - via seed or on-demand upsert on first request (**TBD**).

## 14. Appendix
- HLD: `artifacts/design-docs/hld-EPMCDMETST-68387.md`
- LLD: `artifacts/design-docs/lld-EPMCDMETST-68387.md`
- Wireframes: `artifacts/design-docs/wireframes-EPMCDMETST-68387.md`
- API Spec: `artifacts/design-docs/api-spec-EPMCDMETST-68387.md`
