# Changelog

All notable changes to the Doctor Appointment Booking System are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).  
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

---

## [1.0.0] — 2026-09-23

Initial production-ready release of the Doctor Appointment Booking System,
built end-to-end via an Agentic SDLC cycle using Claude Agent Mode.

### Added — Documentation
- `requirements.md` — 8 functional requirements (FR-01–FR-08) and 8 non-functional
  requirements (NFR-01–NFR-08) for the phone-based booking system
- `architecture.md` — 3-tier architecture, ER diagram, sequence diagrams for
  book/cancel/reschedule flows, 7 ADRs, full REST API surface
- `design-review.md` — Pre-implementation review: 12 findings (4 Critical, 4 Major,
  4 Minor) with agreed decisions incorporated before coding began
- `impl-plan.md` — 41-task dependency-ordered implementation plan across 8 phases
- `code-review.md` — Post-implementation peer review: 10 findings (CR-01–CR-10)
  all confirmed and fixed

### Added — Backend (Node.js / Express / Prisma / PostgreSQL)
- 5-table Prisma schema: `departments`, `doctors`, `appointments`, `sms_logs`,
  `sms_templates`
- AES-256-GCM phone encryption + HMAC-SHA256 hash column for indexed lookups (ADR-07)
- Session-based authentication with bcrypt; `authenticate` middleware on all
  `/api/*` routes (ADR-06)
- `AppointmentService` — `createAppointment` (SERIALIZABLE transaction, slot lock),
  `cancelAppointment`, `rescheduleAppointment`, `findByIdOrPhone`
- `SlotService` — 18 × 30-minute slots (10:00–18:30), available-slot filtering
- `DoctorService` — 3 departments, 6 seeded Indian doctors
- `NotificationService` — fire-and-forget Twilio SMS (ADR-03); template cache;
  `sms_logs` persistence
- Background SMS retry job (node-cron, every 5 min, max 3 attempts)
- `smsFormat.js` — shared `interpolate`, `formatDate`, `formatTime` helpers
- Zod validation on all request bodies; standardised `{ error: { code, message, field } }` shape
- pino structured logger with `sanitize()` helper masking phone numbers
- `GET /health` endpoint with DB ping; global rate limiter; CORS from env var
- Partial unique index `UX_appt_slot` in migration (not seed) ensuring double-booking
  prevention in all environments

### Added — Frontend (React 18 / Vite / Tailwind CSS)
- `AuthContext` + `ProtectedRoute` — session-checked routing
- `LoginPage` — credential form with error display
- `BookingForm` — cascading dept → doctor → date → slot dropdowns; confirmation card
- `AppointmentList` — search by phone or UUID; colour-coded status badges
- `CancelReschedule` — inline cancel (confirm dialog) and reschedule flow
- `SmsBanner` — amber warning when `smsStatus !== 'SENT'`
- Axios client with `withCredentials: true` and normalised error interceptor

### Added — Testing
- 109 Jest tests (0 failures): 50 unit tests across 5 suites, 59 integration
  tests across 3 suites
- `scripts/check-docs.js` — 181-check document quality gate

### Added — GitHub / SDLC Infrastructure
- `.github/workflows/ci.yml` — full CI pipeline (tests + doc check + frontend build)
- `.github/workflows/agentic-pre-hooks.yml` — security scan, doc quality,
  PR description completeness check
- `.github/workflows/agentic-post-merge.yml` — deployment health check, smoke test
- `.github/agents/` — 6 Claude Agent instruction files (3 pre-hook, 3 post-hook)
- `.github/PULL_REQUEST_TEMPLATE.md` — structured PR template with reviewer checklist
- `.github/CODEOWNERS` — auto-assign reviewers by file path
- `.github/dependabot.yml` — weekly dependency updates for backend, frontend, and CI

### Fixed (Code Review CR-01 through CR-10)
- **CR-01** `toPublic()` now includes `doctorId` — reschedule slot fetch was broken
- **CR-02** `dispatchSms` uses `{ increment: 1 }` — retry loop now terminates correctly
- **CR-03** `UX_appt_slot` partial unique index moved to migration — present in prod
- **CR-04** `send()` wrapped in try/catch — SMS failure no longer causes 500 on booking
- **CR-05** Duplicate doctor seeding loop removed — seed is idempotent
- **CR-06** `SESSION_SECRET` guard throws at startup in production
- **CR-07** Error handler returns generic message for 5xx — no internal detail leak
- **CR-08** `normalisePhone()` strips existing `+91` prefix before prepending
- **CR-09** `cancelAppointment` also rejects `RESCHEDULED` status
- **CR-10** `formatDate`/`formatTime`/`interpolate` extracted to `smsFormat.js`

### Security
- AES-256-GCM encryption for patient phone numbers at rest
- HMAC-SHA256 lookup hash (separate from ciphertext — no deterministic-encryption weakness)
- `SESSION_SECRET` required env var in production; startup throws if absent
- Global error handler masks internal error messages on all 5xx responses
- Phone numbers masked in all application logs via `pino` + `sanitize()`
- CORS locked to `ALLOWED_ORIGIN` env var; `SameSite=Strict` session cookies

### Known Limitations (v1)
- No patient-facing web or mobile self-booking portal
- No payment, insurance, or medical record integration
- Twilio SMS requires real credentials configured in `.env` (mock mode available)
- Single receptionist account (multi-user auth deferred to v2)
- No automated IVR / voice bot integration
- Test suite requires Docker for the PostgreSQL test database

---

[Unreleased]: https://github.com/utpal74/doc-appointment-booking/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/utpal74/doc-appointment-booking/releases/tag/v1.0.0
