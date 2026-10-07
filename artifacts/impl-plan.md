# Implementation Plan — Doctor Appointment Booking System

**Version:** 1.0  
**Date:** 2026-09-23  
**Derived from:** [architecture.md](architecture.md) · [design-review.md](design-review.md)  
**Total estimated effort:** ~48 hours (6 focused working days)

---

## 1. Reading This Document

- **Task ID** — unique reference, used in the "Blocked by" column
- **Priority** — P0 = critical path / must go first · P1 = core feature · P2 = supporting · P3 = polish
- **Effort** — optimistic estimate for a developer already familiar with the stack
- **Blocked by** — tasks that must be **fully complete** before this task can start
- **Parallel with** — tasks that can run at the same time on a second track

Tasks are grouped into phases. Within a phase, tasks that share no dependency can be parallelised.

---

## 2. Dependency Graph (Summary)

```
Phase 0 (Scaffold)
  T01 ──────────────────────────────────────────────────────┐
  ├── T02 (Docker Compose)                                   │
  ├── T03 (.env.example)                                     │
  ├── T04 (backend deps)                                     │
  └── T05 (frontend deps)                                    │
                                                             │
Phase 1 (DB Foundation)                                      │
  T04 ──▶ T06 (Prisma schema) ──▶ T07 (indexes)             │
       ──▶ T08 (migration)                                   │
       ──▶ T09 (seed script)                                 │
                                                             │
Phase 2 (Backend Infra)                                      │
  T04 ──▶ T10 (Express + middleware)                         │
       ──▶ T11 (sanitize helper)                             │
       ──▶ T12 (GET /health)  ◀── needs T09 (DB up)         │
       ──▶ T13 (HMAC/AES helpers)                            │
       ──▶ T14 (Zod schemas)                                 │
                                                             │
Phase 3 (Auth)                                               │
  T10 ──▶ T15 (authenticate middleware)                      │
       ──▶ T16 (login/logout routes)                         │
                                                             │
Phase 4 (Doctor & Slot Services)                             │
  T09 + T10 ──▶ T17 (DoctorService)                         │
            ──▶ T18 (doctor routes)  ◀── needs T16 (auth)   │
            ──▶ T19 (SlotService)                            │
            ──▶ T20 (slots route)   ◀── needs T16 (auth)    │
                                                             │
Phase 5 (Appointment Service)  ◀── most-blocked phase        │
  T13 + T15 + T17 + T19 ──▶ T21 (createAppointment)         │
  T13 + T21 ─────────────▶ T22 (findByIdOrPhone)            │
  T21 ────────────────────▶ T23 (cancelAppointment)          │
  T21 + T19 ──────────────▶ T24 (rescheduleAppointment)      │
  T16 + T21 + T22 ─────────▶ T25 (appointment GET routes)   │
  T16 + T23 + T24 + T25 ───▶ T26 (cancel/reschedule routes) │
                                                             │
Phase 6 (Notifications)                                      │
  T03 + T04 ──▶ T27 (Twilio config)                         │
  T09 + T27 ──▶ T28 (NotificationService)                   │
  T28 ────────▶ T29 (SMS retry job)                         │
  T21+T23+T24+T28 ──▶ T30 (wire notifications)              │
                                                             │
Phase 7 (Frontend) ◀─── can start from T05 in parallel      │
  T05 ──▶ T31 (React/Vite/Tailwind)                         │
       ──▶ T32 (Axios client)                                │
  T16+T32 ──▶ T33 (LoginPage)                               │
  T18+T20+T32 ──▶ T34 (BookingForm)                         │
  T25+T32 ──▶ T35 (AppointmentList)                         │
  T26+T35 ──▶ T36 (CancelReschedule)                        │
  T33+T34+T35+T36 ──▶ T37 (React Router + protected routes) │
  T34+T36 ──▶ T38 (SMS warning UI)                          │
                                                             │
Phase 8 (Integration & Polish)                               │
  T37+T30 ──▶ T39 (E2E smoke test)                          │
  T14+T37 ──▶ T40 (Zod error display in forms)              │
  T34 ─────▶ T41 (date restrictions in picker)              │
```

---

## 3. Phase Breakdown

---

### Phase 0 — Project Scaffolding

**Goal:** Runnable skeleton. All engineers can check out and `docker-compose up` to get a running (empty) system.

| ID | Task | Priority | Effort | Blocked by | Parallel with |
|---|---|---|---|---|---|
| T01 | Create monorepo folder structure (`/backend`, `/frontend`, root `docker-compose.yml`) | P0 | 0.5h | — | — |
| T02 | Write `docker-compose.yml` (services: `db`, `api`, `frontend`; volumes; healthcheck stubs) | P0 | 1h | T01 | — |
| T03 | Create `.env.example` with all 9 required variables documented | P0 | 0.5h | T01 | T02 |
| T04 | Initialise backend: `package.json`, install Express, Prisma, Zod, pino, cors, cookie-parser, express-rate-limit, dotenv, twilio, node-cron, bcrypt | P0 | 0.5h | T01 | T02, T03 |
| T05 | Initialise frontend: Vite + React 18, install Tailwind CSS, Axios, React Router | P0 | 0.5h | T01 | T02, T03, T04 |

**Exit criteria:** `docker-compose up` starts all three containers without error (API returns 404, DB accepts connections, frontend serves placeholder page).

---

### Phase 1 — Database Foundation

**Goal:** All 5 tables exist, indexed, and seeded. Every later task relies on this.

| ID | Task | Priority | Effort | Blocked by | Parallel with |
|---|---|---|---|---|---|
| T06 | Write Prisma schema: `departments`, `doctors`, `appointments` (incl. `patient_phone_hash`), `sms_logs`, `sms_templates` tables; all FKs and enums | P0 | 2h | T04 | T05 |
| T07 | Add 4 named indexes to Prisma schema: `UX_appt_slot` (partial unique), `IX_appt_phone_hash`, `IX_appt_doctor_date`, `IX_sms_retry` | P0 | 0.5h | T06 | — |
| T08 | Run `prisma migrate dev --name init`; verify migration SQL matches schema intent | P0 | 0.5h | T06, T07 | — |
| T09 | Write Prisma seed script: 3 departments, 6 doctors, 3 SMS templates (booking, cancel, reschedule) | P0 | 1.5h | T08 | T05 |

**Exit criteria:** `prisma studio` shows all tables populated; `UX_appt_slot` partial unique index visible in `\d appointments` in psql.

---

### Phase 2 — Backend Infrastructure Layer

**Goal:** Express server running with all cross-cutting middleware wired. No feature routes yet.

| ID | Task | Priority | Effort | Blocked by | Parallel with |
|---|---|---|---|---|---|
| T10 | Initialise Express app: wire `pino-http` logger, `cors` (from `ALLOWED_ORIGIN`), `cookie-parser`, `express-rate-limit` (global), `dotenv/config`; export `app` and `server` separately | P0 | 2h | T04 | T06–T09 |
| T11 | Implement `sanitize(obj)` helper: recursively masks any key matching `phone` → `98****3210`; used by pino `serializers` | P0 | 0.5h | T10 | — |
| T12 | Implement `GET /health`: Prisma `$queryRaw SELECT 1`, return `{status, db, uptime}`; 200 on OK, 503 on DB fail | P0 | 0.5h | T09, T10 | — |
| T13 | Implement crypto helpers: `encryptPhone(plain)` → AES-256-GCM ciphertext, `decryptPhone(cipher)` → plain, `hashPhone(plain)` → HMAC-SHA256 hex; all using env-provided keys | P0 | 1.5h | T10 | T11, T12 |
| T14 | Implement Zod validation schemas for all request bodies: `BookAppointmentSchema`, `RescheduleSchema`, `LoginSchema`; write `validate(schema)` Express middleware | P1 | 1h | T04 | T11, T12, T13 |

**Exit criteria:** `GET /health` returns `{"status":"ok","db":"connected"}`. A request with a bad body to any stubbed route returns the standard error shape.

---

### Phase 3 — Authentication

**Goal:** All `/api/*` routes protected. Receptionist can log in and receive a session cookie.

| ID | Task | Priority | Effort | Blocked by | Parallel with |
|---|---|---|---|---|---|
| T15 | Implement `authenticate` middleware: reads httpOnly session cookie, verifies HMAC signature, attaches `req.user`; returns 401 on failure | P0 | 1h | T10, T13 | T14 |
| T16 | Implement `POST /api/auth/login` (bcrypt compare against `RECEPTIONIST_PASSWORD_HASH`, set signed httpOnly cookie) and `POST /api/auth/logout` (clear cookie); apply rate-limit (5 attempts / 15 min) on login | P0 | 1.5h | T14, T15 | — |

**Exit criteria:** `POST /api/auth/login` with correct credentials sets a cookie; subsequent `GET /api/departments` (stubbed) returns 200; without cookie returns 401.

> ⚠️ **Blocked gate:** Phases 4, 5, 6 (all feature routes) cannot be wired to the router until T15 and T16 are complete, because `authenticate` is applied globally to `/api/*`.

---

### Phase 4 — Doctor & Slot Services

**Goal:** Read-only catalogue and slot availability API are live.

| ID | Task | Priority | Effort | Blocked by | Parallel with |
|---|---|---|---|---|---|
| T17 | Implement `DoctorService`: `listDepartments()`, `listDoctors(departmentId?)`, `getDoctorById(id)`; reads from seeded DB | P1 | 1h | T09, T10 | T15 |
| T18 | Implement `GET /api/departments` and `GET /api/doctors?departmentId=` routes; apply `authenticate` | P1 | 0.5h | T16, T17 | — |
| T19 | Implement `SlotService`: `generateSlots()` (10:00–18:30, 18 × 30-min slots), `getAvailableSlots(doctorId, date)` (filters out CONFIRMED), `assignRandomSlot(available[])`, `validateSlot(time)` | P1 | 2h | T09, T10 | T17 |
| T20 | Implement `GET /api/slots?doctorId=&date=` route; validate date is not Sunday or in the past; apply `authenticate` | P1 | 0.5h | T16, T19 | T18 |

**Exit criteria:** Authenticated `GET /api/slots?doctorId=<uuid>&date=2026-09-25` returns an array of 18 time strings; a date that already has some bookings returns fewer.

---

### Phase 5 — Appointment Service

**Goal:** Full booking, lookup, cancel, and reschedule business logic complete. This is the most dependency-heavy phase.

> ⚠️ **Most-blocked phase.** T21 requires T13 (crypto), T15 (auth), T17 (DoctorService), and T19 (SlotService) — do not start until all four are green.

| ID | Task | Priority | Effort | Blocked by | Parallel with |
|---|---|---|---|---|---|
| T21 | Implement `AppointmentService.createAppointment(data)`: HMAC-hash phone, encrypt phone, open Prisma `SERIALIZABLE` transaction, check slot availability with `SELECT FOR UPDATE`, INSERT appointment, return record; throw `SLOT_UNAVAILABLE` on conflict | P0 | 3h | T13, T15, T17, T19 | — |
| T22 | Implement `AppointmentService.findByIdOrPhone(idOrPhone)`: if UUID, query by ID; else compute HMAC and query by `patient_phone_hash`; return latest `CONFIRMED` in reschedule chain by default; accept `includeHistory` flag | P1 | 1h | T13, T21 | — |
| T23 | Implement `AppointmentService.cancelAppointment(id)`: validate appointment is CONFIRMED, UPDATE status to CANCELLED, return updated record; throw `APPOINTMENT_ALREADY_CANCELLED` if already cancelled | P1 | 1h | T21 | T22 |
| T24 | Implement `AppointmentService.rescheduleAppointment(id, newDate, newSlot)`: validate existing appointment, call `SlotService.validateSlot`, UPDATE old to RESCHEDULED, INSERT new with `previous_appointment_id`; wrap in SERIALIZABLE transaction | P1 | 2h | T19, T21 | T22, T23 |
| T25 | Implement `POST /api/appointments`, `GET /api/appointments/:id`, `GET /api/appointments?phone=` routes; apply `authenticate` + `validate(BookAppointmentSchema)` | P1 | 1h | T16, T21, T22 | T23, T24 |
| T26 | Implement `PATCH /api/appointments/:id/cancel` and `PATCH /api/appointments/:id/reschedule` routes; apply `authenticate` + `validate(RescheduleSchema)` | P1 | 1h | T16, T23, T24, T25 | — |

**Exit criteria:** `POST /api/appointments` creates an appointment; a second POST with the same doctor/date/slot returns 409. `GET /api/appointments?phone=9876543210` returns the correct record. Cancel and reschedule update status correctly.

---

### Phase 6 — Notification Service

**Goal:** SMS sent on every appointment action; failed sends retried in background.

> ⚠️ **T30 is blocked** by both the complete appointment service (T21, T23, T24) AND the notification service (T28). Do not wire until both sides are ready.

| ID | Task | Priority | Effort | Blocked by | Parallel with |
|---|---|---|---|---|---|
| T27 | Configure Twilio SDK client: initialise with `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN`; export singleton client | P1 | 0.5h | T03, T04 | T10–T26 |
| T28 | Implement `NotificationService`: load template from `sms_templates` (5-min TTL cache), interpolate patient/doctor/date/ID, call `client.messages.create` with 2s timeout (fire-and-forget), INSERT `sms_logs` with outcome; export `sendBookingSms`, `sendCancelSms`, `sendRescheduleSms` | P1 | 2.5h | T09, T27 | T21–T26 |
| T29 | Implement background SMS retry job (`node-cron` every 5 min): query `sms_logs WHERE status='FAILED' AND attempt_count < 3`, fetch linked appointment, call Twilio, update `sms_logs`; runs silently on server start | P1 | 1h | T28 | T21–T26 |
| T30 | Wire `NotificationService` into `AppointmentService`: call `sendBookingSms` after T21 commit, `sendCancelSms` after T23, `sendRescheduleSms` after T24; propagate `smsStatus` to API response | P1 | 1h | T21, T23, T24, T28 | T29 |

**Exit criteria:** Booking an appointment triggers an SMS log entry. Manually setting a log entry to `FAILED` causes the retry job to re-send within 5 minutes. API response includes `smsStatus`.

---

### Phase 7 — Frontend

**Goal:** Receptionist UI fully functional against the live API. Can run in parallel from Phase 1 onward using a mock API.

| ID | Task | Priority | Effort | Blocked by | Parallel with | Notes |
|---|---|---|---|---|---|---|
| T31 | Initialise React app (Vite), configure Tailwind CSS, add base layout shell | P0 | 1h | T05 | T06–T29 | Start immediately after T05 |
| T32 | Implement Axios API client: base URL from env, `withCredentials: true`, response interceptor that normalises error shape to `{code, message, field}` | P0 | 1h | T31 | T12 |
| T33 | Implement `LoginPage`: username/password form → `POST /api/auth/login`, redirect to home on success, show error on 401 | P1 | 1.5h | T16, T32 | T34, T35 |
| T34 | Implement `BookingForm`: department dropdown → `GET /api/departments`, doctor dropdown, date picker (disable Sundays + past dates), slot dropdown → `GET /api/slots`, submit → `POST /api/appointments`, show confirmation card with Appointment ID | P1 | 3h | T18, T20, T32 | T33, T35 |
| T35 | Implement `AppointmentList`: search input (phone or ID), call `GET /api/appointments?phone=` or `GET /api/appointments/:id`, display result card with status badge | P1 | 2h | T25, T32 | T33, T34 |
| T36 | Implement `CancelReschedule`: mounted on a found appointment card; Cancel button → `PATCH /cancel`; Reschedule button → date/slot pickers → `PATCH /reschedule`, refresh the appointment card on success | P1 | 2h | T26, T35 | T33, T34 |
| T37 | Implement React Router: `/login`, `/` (booking), `/appointments` (lookup) routes; `ProtectedRoute` wrapper redirects to `/login` if no session | P1 | 1h | T33, T34, T35, T36 | — |
| T38 | Add SMS warning banner: if API response `smsStatus !== 'SENT'`, display dismissible warning *"Appointment saved. SMS could not be delivered — inform patient verbally."* on BookingForm and CancelReschedule | P2 | 1h | T34, T36 | T37 |

**Exit criteria:** Full booking flow works in browser against live API — login → select doctor → pick slot → submit → see confirmation. Cancel and reschedule update the card. SMS warning appears when `smsStatus` is not `SENT`.

---

### Phase 8 — Integration & Polish

**Goal:** Everything works end-to-end from Docker Compose. Edge cases handled.

| ID | Task | Priority | Effort | Blocked by | Parallel with |
|---|---|---|---|---|---|
| T39 | E2E smoke test: `docker-compose up`, run through full booking → reschedule → cancel flow manually; verify SMS log table, verify 409 on double-book attempt | P0 | 2h | T37, T30 | — |
| T40 | Wire Zod validation errors to frontend form field hints: API `{error.field}` maps to form field red border + inline message | P2 | 1h | T14, T37 | T41 |
| T41 | Date picker restrictions: disable Sundays, disable dates in the past; enforced in both frontend component and backend Zod schema (`INVALID_DATE`) | P2 | 0.5h | T34 | T40 |

---

## 4. Complete Task Reference Table

| ID | Phase | Task (short) | P | Effort | Blocked by |
|---|---|---|---|---|---|
| T01 | 0 | Monorepo folder structure | P0 | 0.5h | — |
| T02 | 0 | docker-compose.yml | P0 | 1h | T01 |
| T03 | 0 | .env.example | P0 | 0.5h | T01 |
| T04 | 0 | Backend package.json + deps | P0 | 0.5h | T01 |
| T05 | 0 | Frontend package.json + deps | P0 | 0.5h | T01 |
| T06 | 1 | Prisma schema (5 tables) | P0 | 2h | T04 |
| T07 | 1 | Add 4 named indexes | P0 | 0.5h | T06 |
| T08 | 1 | Run initial migration | P0 | 0.5h | T06, T07 |
| T09 | 1 | Prisma seed script | P0 | 1.5h | T08 |
| T10 | 2 | Express app + middleware stack | P0 | 2h | T04 |
| T11 | 2 | `sanitize()` helper | P0 | 0.5h | T10 |
| T12 | 2 | `GET /health` endpoint | P0 | 0.5h | T09, T10 |
| T13 | 2 | HMAC + AES-256 crypto helpers | P0 | 1.5h | T10 |
| T14 | 2 | Zod schemas + `validate()` middleware | P1 | 1h | T04 |
| T15 | 3 | `authenticate` middleware | P0 | 1h | T10, T13 |
| T16 | 3 | Auth routes (login / logout) | P0 | 1.5h | T14, T15 |
| T17 | 4 | DoctorService | P1 | 1h | T09, T10 |
| T18 | 4 | Doctor / department routes | P1 | 0.5h | T16, T17 |
| T19 | 4 | SlotService | P1 | 2h | T09, T10 |
| T20 | 4 | Slots route | P1 | 0.5h | T16, T19 |
| T21 | 5 | `createAppointment` (serialisable tx) | P0 | 3h | T13, T15, T17, T19 |
| T22 | 5 | `findByIdOrPhone` (HMAC lookup + chain) | P1 | 1h | T13, T21 |
| T23 | 5 | `cancelAppointment` | P1 | 1h | T21 |
| T24 | 5 | `rescheduleAppointment` | P1 | 2h | T19, T21 |
| T25 | 5 | Appointment GET routes | P1 | 1h | T16, T21, T22 |
| T26 | 5 | Cancel / reschedule routes | P1 | 1h | T16, T23, T24, T25 |
| T27 | 6 | Twilio SDK config | P1 | 0.5h | T03, T04 |
| T28 | 6 | NotificationService (template cache + fire-and-forget) | P1 | 2.5h | T09, T27 |
| T29 | 6 | SMS background retry job (node-cron) | P1 | 1h | T28 |
| T30 | 6 | Wire notifications into AppointmentService | P1 | 1h | T21, T23, T24, T28 |
| T31 | 7 | React + Vite + Tailwind init | P0 | 1h | T05 |
| T32 | 7 | Axios API client (interceptors) | P0 | 1h | T31 |
| T33 | 7 | LoginPage component | P1 | 1.5h | T16, T32 |
| T34 | 7 | BookingForm component | P1 | 3h | T18, T20, T32 |
| T35 | 7 | AppointmentList component | P1 | 2h | T25, T32 |
| T36 | 7 | CancelReschedule component | P1 | 2h | T26, T35 |
| T37 | 7 | React Router + ProtectedRoute | P1 | 1h | T33, T34, T35, T36 |
| T38 | 7 | SMS warning banner | P2 | 1h | T34, T36 |
| T39 | 8 | E2E smoke test (Docker Compose) | P0 | 2h | T37, T30 |
| T40 | 8 | Zod error display in forms | P2 | 1h | T14, T37 |
| T41 | 8 | Date picker restrictions | P2 | 0.5h | T34 |

**Total: ~48 hours**

---

## 5. Blocked Tasks — Explicit List

The following tasks cannot start until all listed dependencies are **fully complete and tested**:

| Blocked Task | Waiting for | Reason |
|---|---|---|
| **T15** (authenticate middleware) | T10, T13 | Needs the Express app instance and the HMAC helpers to verify session signatures |
| **T16** (auth routes) | T14, T15 | Needs `validate()` middleware and `authenticate` middleware to exist |
| **T21** (createAppointment) — *hardest block* | T13, T15, T17, T19 | Needs crypto helpers for phone encryption, auth middleware imported, DoctorService for doctor validation, SlotService for slot computation — all four must be complete |
| **T28** (NotificationService) | T09, T27 | Template loading requires seeded `sms_templates` table; Twilio SDK must be configured |
| **T30** (wire notifications) | T21, T23, T24, T28 | All three appointment operations must exist before they can be wrapped with SMS dispatch |
| **T34** (BookingForm) | T18, T20, T32 | Requires the departments and slots API to exist to populate dropdowns |
| **T36** (CancelReschedule) | T26, T35 | Requires the cancel/reschedule routes to exist AND AppointmentList to be mounted first |
| **T37** (React Router) | T33, T34, T35, T36 | All four page-level components must exist before routing can connect them |
| **T39** (E2E smoke test) — *final gate* | T37, T30 | All frontend routes and all notification wiring must be complete |

---

## 6. Parallel Execution Tracks

If two developers are available, the work splits cleanly into two tracks after Phase 0:

```
Track A (Backend)                    Track B (Frontend)
─────────────────                    ──────────────────
T04 → T06 → T07 → T08 → T09         T05 → T31 → T32
         ↓                                    ↓
T10 → T11 → T12 → T13 → T14         Mock API or wait for T18/T20/T25
         ↓
T15 → T16
         ↓
T17 → T18 → T19 → T20               ← T33, T34 unblock here
         ↓
T21 → T22 → T23 → T24               ← T35 unblocks here
         ↓
T25 → T26                            ← T36 unblocks here
         ↓
T27 → T28 → T29 → T30               T37 → T38

Both tracks converge at T39 (E2E smoke test)
```

With two tracks and no context-switching, wall-clock time compresses from ~48h to ~30h.

---

## 7. Suggested Coding Order (Single Developer)

Follow this sequence to unblock yourself as fast as possible:

```
T01 → T02 → T03 → T04 → T05          [Day 1 morning — scaffold]
T06 → T07 → T08 → T09                 [Day 1 afternoon — DB]
T10 → T11 → T12 → T13 → T14          [Day 2 — backend infra]
T15 → T16                              [Day 3 morning — auth]
T17 → T18 → T19 → T20                 [Day 3 afternoon — catalogue & slots]
T27 (quick, no deps) interleave here
T21 → T22 → T23 → T24 → T25 → T26   [Day 4 — appointment service]
T28 → T29 → T30                        [Day 5 morning — notifications]
T31 → T32 → T33 → T34 → T35 → T36   [Day 5 afternoon + Day 6 morning — frontend]
T37 → T38                              [Day 6 midday — routing + polish]
T39 → T40 → T41                        [Day 6 afternoon — integration test]
```

---

## 8. Definition of Done

A task is complete when:

1. Code is written and committed to the feature branch
2. The component works in isolation (manually verified or unit tested)
3. No `console.log` calls — `pino` logger used throughout
4. Phone numbers never appear unmasked in any log output
5. No hardcoded secrets, credentials, or connection strings in source

The overall feature is done when T39 (E2E smoke test) passes with all services running via `docker-compose up`.
