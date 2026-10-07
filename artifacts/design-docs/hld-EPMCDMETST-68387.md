# HLD — EPMCDMETST-68387: Admin manages SMS templates

## Overview
Enable admins to manage SMS message templates (Booking / Cancellation / Rescheduling) via an admin UI and admin APIs. Templates are stored in Postgres via Prisma (`SmsTemplate` table already exists). During SMS dispatch, the system loads the template by `messageType` from DB with caching; if missing, it falls back to a safe, existing default/hardcoded template (TBD where current defaults live) to avoid message loss.

## Goals
- Admin CRUD-lite (list + update) SMS templates.
- Preview rendered SMS with example variables before saving/sending.
- Ensure SMS sending flow reads template from DB; no breaking changes.

## Non-goals
- Multi-language templates.
- Per-department/per-doctor templates.
- Versioning/approval workflows.

## Current system (from repo inspection)
- Backend: Node.js + Express, Prisma ORM, Postgres.
- Auth: session-based (`req.session.authenticated`).
- SMS provider: Twilio (`twilio` package).
- SMS templating currently uses `interpolate(template, vars)` in `backend/src/helpers/smsFormat.js` with placeholders like `{patientName}`.
- DB already contains `SmsTemplate` model keyed by `messageType` enum (`BOOKING|CANCELLATION|RESCHEDULING`).
- `NotificationService.getTemplates()` already loads templates from Prisma with a 5-minute in-memory cache.

## Proposed architecture

### Components
1. **Admin SMS Template API (Backend)**
   - New Express router under `backend/src/routes/admin/smsTemplates.js`.
   - Mounted under `/api/admin/sms-templates` (consistent with other admin routes).
   - Uses existing auth middleware (TBD: confirm route mounting includes `authenticate` globally or per route).
   - Uses Zod validation via existing `validate` middleware.

2. **Template Rendering / Placeholder Validation (Backend shared helper)**
   - Support placeholders `{{var}}` (as requested).
   - Keep backward compatibility for existing `{var}` templates (since repo currently uses `{var}`).
   - Implement a renderer that:
     - finds placeholders, validates they’re in the allowed set
     - replaces with provided variables
     - leaves unknown placeholders intact OR rejects depending on context (API save should reject; runtime send should be tolerant and leave token as-is).

3. **Admin UI (Frontend)**
   - New route/page: `/admin/sms-templates`.
   - List templates by messageType; select one to edit.
   - Textarea editor with helper panel listing allowed variables.
   - Preview panel (calls preview endpoint).

4. **SMS Dispatch Flow Update**
   - Ensure `NotificationService.send()` uses DB template for messageType.
   - Add fallback to existing hardcoded defaults if DB record missing.
   - Ensure cache invalidation on template update (simple approach: clear cache on successful PUT).

## Data flow

### List
UI -> `GET /api/admin/sms-templates` -> DB `SmsTemplate.findMany()` -> UI table.

### Update
UI -> `PUT /api/admin/sms-templates/:messageType` (body: `{ templateBody }`) -> validate placeholders -> `SmsTemplate.upsert()` -> clear cache -> response.

### Preview
UI -> `POST /api/admin/sms-templates/preview` (body includes messageType, templateBody, variables) -> validate placeholders -> render -> response `{ rendered }`.

### Send
Booking/Cancellation/Rescheduling event -> `NotificationService.send()` -> load template from cache/DB -> render with appointment-derived vars -> Twilio.

## Security
- Admin endpoints require authenticated session.
- (TBD) If roles exist, enforce admin role; currently repo only shows `authenticated` boolean.
- Rate limit preview endpoint to avoid abuse.

## Observability
- Log template update events (who/when TBD; current auth doesn’t show user identity).
- Log preview requests at debug level only (avoid sensitive data in logs).

## Rollout
- Ship DB migration only if schema changes (for this ticket, schema exists; no migration required).
- Seed defaults (TBD if seed already inserts `SmsTemplate` rows; verify in `backend/prisma/seed.js`).
- Deploy backend + frontend together.
