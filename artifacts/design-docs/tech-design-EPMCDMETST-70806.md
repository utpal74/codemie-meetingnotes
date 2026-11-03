# Technical Design — EPMCDMETST-70806

- **Jira:** https://jiraeu.epam.com/browse/EPMCDMETST-70806
- **Branch:** `feature/EPMCDMETST-70806-meetingnotes`
- **Date:** 2026-11-03
- **Status:** Ready for dev

## 1) Implementation plan

> Goal: Enable authenticated Receptionist to create an appointment booking by selecting Doctor + date + slot, validating patient phone, preventing double-booking, and triggering booking SMS.

**T-01 — Align API error codes with ticket (compat-safe mapping)**
- **Description:** Ticket requires error envelope `{ error: { code, message, field } }` with codes: `SLOT_ALREADY_BOOKED`, `VALIDATION_ERROR`, `UNAUTHORIZED`. Current backend uses `SLOT_UNAVAILABLE` and Zod error shape from `validate` middleware.
- **Files:**
  - Modify: `backend/src/helpers/errors.js`
  - Modify: `backend/src/middleware/validate.js` (if needed to map Zod errors)
  - Modify: `backend/src/app.js` or global error handler (where envelope is normalized)
- **Depends on:** none
- **Verifying test:** `backend/__tests__/integration/appointments.book.test.js` (new/updated) asserts error codes.

**T-02 — Enforce double-booking protection for same Doctor+Date+Slot (DB + transaction)**
- **Description:** Add unique constraint to guarantee no two `CONFIRMED` appointments exist for same doctor/date/slot, and keep existing serializable transaction check.
- **Files:**
  - Modify: `backend/prisma/schema.prisma`
  - Create: `backend/prisma/migrations/<timestamp>_unique_confirmed_doctor_date_slot/migration.sql`
  - Modify: `backend/src/services/AppointmentService.js`
- **Depends on:** T-01
- **Verifying test:** Integration test that concurrent create returns 409 with `SLOT_ALREADY_BOOKED`.

**T-03 — Booking endpoint role protection (Receptionist required)**
- **Description:** Ticket requires only authenticated/authorized receptionist can create appointments. Current POST `/api/appointments` has no `authenticate` or `requireRole`.
- **Files:**
  - Modify: `backend/src/routes/appointments.js`
  - Modify: `backend/src/app.js` route mounting (if role guards are centralized)
- **Depends on:** none
- **Verifying test:** Integration test: unauthenticated request returns 401 `UNAUTHORIZED` envelope.

**T-04 — Request validation matches AC (phone field name and error field mapping)**
- **Description:** AC references `patientMobile` field; current API uses `patientPhone` and Zod schema. Decide and implement backward-compatible input handling.
- **Files:**
  - Modify: `backend/src/schemas/index.js` (or move appointment schemas to `backend/src/schemas/appointments.js` if that exists)
  - Modify: `backend/src/routes/appointments.js`
- **Depends on:** T-01
- **Verifying test:** Validation failure returns 400/422 with `{ error.code: "VALIDATION_ERROR", field: "patientMobile" }` per ticket.

**T-05 — Trigger SMS confirmation after booking (existing NotificationService)**
- **Description:** Ensure booking SMS is created/logged even if Twilio send fails (async failure per assumptions). Confirm current behavior already returns `smsStatus`.
- **Files:**
  - Review/Modify: `backend/src/services/NotificationService.js`
  - Review/Modify: `backend/src/jobs/*` (retry job) if needed
- **Depends on:** T-03
- **Verifying test:** Unit test stubbing NotificationService returns `smsStatus` and SmsLog created.

**T-06 — Frontend booking form (Receptionist UI)**
- **Description:** Add page for booking: patient name + mobile, department, doctor, date, available slots; submit to POST `/api/appointments`.
- **Files:**
  - Modify/Create: `frontend/src/pages/receptionist/BookAppointmentPage.jsx`
  - Modify: `frontend/src/App.jsx` routes
  - Modify/Create: `frontend/src/api/appointments.js`, `frontend/src/api/departments.js`, `frontend/src/api/doctors.js`, `frontend/src/api/slots.js`
- **Depends on:** T-03, T-04
- **Verifying test:** Playwright e2e `tests/e2e/book-appointment.spec.ts` (planned by QA stage).

## 2) HLD

### Components touched
- Backend: appointments route, appointment service, validation middleware, error helper, prisma schema/migration, notification service.
- Frontend: receptionist booking page, API client modules.

### Data flow

```
[Receptionist UI]
    | (POST /api/appointments)
    v
[Express router]
  authenticate -> requireRole('RECEPTIONIST') -> validate(BookAppointment)
    v
[AppointmentService.createAppointment]
  - serializable tx
  - check conflict
  - create appointment
    v
[NotificationService.sendBookingSms]
  - enqueue/log SmsLog + attempt send
    v
[Response 201]
```

### API surface

| Method | Path | Role | Purpose |
|---|---|---:|---|
| POST | `/api/appointments` | RECEPTIONIST | Create appointment booking (patient + doctor + date + slot) |
| GET | `/api/departments` | RECEPTIONIST | List active departments (for selection) |
| GET | `/api/doctors?departmentId=...` | RECEPTIONIST | List active doctors for department |
| GET | `/api/slots?doctorId=...&date=YYYY-MM-DD` | RECEPTIONIST | Show available slots for doctor on date |

### Non-functional notes
- **Security:** Session auth required; enforce role authorization for booking.
- **Consistency:** Use DB constraint + serializable tx to prevent double-booking under concurrency.
- **Observability:** Log SMS send outcome; booking should succeed even if SMS send fails (per A4).

## 3) LLD

### 3.1 Prisma model changes

**Current:** `Appointment` has indexes on `(doctorId, appointmentDate)` but no uniqueness.

**Change:** Add a uniqueness constraint to prevent two appointments for same doctor+date+slot **for CONFIRMED only**.

Prisma does not support partial unique indexes directly, so implement via migration SQL:
- Create a partial unique index:
  - `UNIQUE (doctorId, appointmentDate, slotTime) WHERE status = 'CONFIRMED'`

**Migration name:** `<timestamp>_unique_confirmed_doctor_date_slot`

### 3.2 Endpoint: Create appointment

**POST** `/api/appointments`

**Middleware chain:**
- `authenticate`
- `requireRole('RECEPTIONIST')`
- `validate(BookAppointmentSchemaV2)`

**Request body (backward compatible):**
- Accept either `patientPhone` (existing) or `patientMobile` (ticket wording)

Zod (conceptual):
- `patientName: string min 2`
- `patientMobile: string regex /^[6-9]\d{9}$/` (map `patientPhone` -> `patientMobile`)
- `doctorId: uuid`
- `appointmentDate: YYYY-MM-DD, not past, not Sunday`
- `slotTime: HH:MM, must be valid slot per SlotService.validateSlot`

**Success (201):**
```json
{
  "appointmentId": "uuid",
  "patientName": "...",
  "doctorId": "uuid",
  "doctor": "Dr ...",
  "department": "Cardiology",
  "appointmentDate": "2026-11-10T00:00:00.000Z",
  "slotTime": "10:30",
  "status": "CONFIRMED",
  "createdAt": "...",
  "previousAppointmentId": null,
  "smsStatus": "SENT" | "PENDING" | "FAILED"
}
```

**Error cases (envelope required):**
- **401** unauthenticated:
  - `{ error: { code: "UNAUTHORIZED", message, field: null } }`
- **403** wrong role:
  - `{ error: { code: "FORBIDDEN", message, field: null } }`
- **400/422** validation:
  - `{ error: { code: "VALIDATION_ERROR", message, field: "patientMobile" } }`
- **409** slot already booked:
  - `{ error: { code: "SLOT_ALREADY_BOOKED", message, field: "slotTime" } }`

**Implementation detail:**
- In `AppointmentService.createAppointment` map Prisma unique violation (P2002) OR serialization failure (P2034) to `SLOT_ALREADY_BOOKED`.

### 3.3 Service changes

`AppointmentService.createAppointment(input)`
- Input normalization: if `patientMobile` provided, treat as phone; if only `patientPhone`, map it.
- Keep serializable transaction.
- Conflict detection:
  - existing confirmed appt OR rely on unique partial index.
- Throw `Errors.SLOT_ALREADY_BOOKED()`.

`NotificationService.sendBookingSms(appointment)`
- Ensure method returns `SmsStatus` and does not throw for Twilio failures (log + mark FAILED).

### 3.4 Frontend

**New page:** `frontend/src/pages/receptionist/BookAppointmentPage.jsx`
- Fields:
  - Patient name
  - Patient mobile
  - Department select (loads `/api/departments`)
  - Doctor select (loads `/api/doctors?departmentId=`)
  - Date picker (Mon–Sat)
  - Slot list (loads `/api/slots?doctorId=&date=`)
- Submit:
  - POST `/api/appointments` using body `{ patientName, patientMobile, doctorId, appointmentDate, slotTime }`
- Error handling:
  - Display server envelope message; highlight the `field` if present.

## 4) UI wireframes

### Booking page

```
+----------------------------------------------------+
| Book Appointment                                   |
+----------------------------------------------------+
| Patient name        [_________________________]    |
| Mobile (10 digits)  [__________]                   |
| Department          [ v Select department ]         |
| Doctor              [ v Select doctor ]             |
| Date                [ 2026-11-10 ]                  |
|                                                    |
| Available slots                                    |
|  (loading...)                                      |
|  [10:00] [10:30] [11:00] ...                       |
|                                                    |
| [ Book appointment ]                               |
|                                                    |
| Error: The selected slot is already booked.        |
+----------------------------------------------------+
```

States:
- Loading departments/doctors/slots
- Empty slots: “No available slots for this date”
- Success toast/banner with appointmentId + smsStatus

## 5) Traceability

| AC | Task(s) | Endpoint/Component | Planned test |
|---|---|---|---|
| AC-1 | T-03, T-04 | POST `/api/appointments` | Integration: successful create returns 201 |
| AC-2 | T-02 | POST `/api/appointments` | Integration: second booking same doctor/date/slot => 409 |
| AC-3 | T-05 | NotificationService | Unit/integration: smsStatus returned + SmsLog created |
| AC-4 | T-01, T-02 | Error mapping | Integration: `SLOT_ALREADY_BOOKED` envelope |
| AC-5 | T-01, T-04 | Validation | Integration: invalid mobile => `VALIDATION_ERROR` field `patientMobile` |
| AC-6 | T-03, T-01 | Auth | Integration: no session => 401 `UNAUTHORIZED` |

## 6) Open questions

1. **Error codes mismatch:** existing backend uses `SLOT_UNAVAILABLE`, `INVALID_PHONE` and `INVALID_DATE` (422). Ticket explicitly requires `SLOT_ALREADY_BOOKED` and `VALIDATION_ERROR` with field `patientMobile`. Should we (a) introduce aliases while keeping old codes for other endpoints, or (b) change globally? Proposed: **alias for this endpoint only** to minimize breaking change.
2. **Role enforcement:** Confirm actual role string is exactly `RECEPTIONIST` in `requireRole` middleware and session user object. (If roles differ, update mapping.)

## 7) Implementation notes (as built)

- **Open question 1 (error codes):** `SLOT_ALREADY_BOOKED` added as an alias used by `POST /api/appointments` only; `SLOT_UNAVAILABLE` is retained for reschedule. Validation failures keep the existing `422` + `VALIDATION_ERROR` envelope from `validate` (no change to the middleware was needed).
- **Open question 2 (roles):** the app has a single receptionist login and the session only carried `authenticated`. Login now also sets `session.role = 'RECEPTIONIST'`, and a new `requireRole(role)` middleware (401 `UNAUTHORIZED` / 403 `FORBIDDEN`) guards `POST /api/appointments`. `authenticate` was already mounted on `/api/appointments` in `app.js`.
- **T-02 (DB protection):** no new migration. The partial unique index `UX_appt_slot` on `("doctorId","appointmentDate","slotTime") WHERE status = 'CONFIRMED'` already exists in migration `20260923171805_add_slot_unique_index`. `createAppointment` additionally maps Prisma `P2002` and `P2034` to `SLOT_ALREADY_BOOKED`.
- **T-04:** `BookAppointmentSchemaV2` accepts `patientMobile` or legacy `patientPhone` (mapped to `patientMobile`); invalid values report `field: "patientMobile"`. The original `BookAppointmentSchema` is unchanged.
- **T-05:** `NotificationService.send` already catches all failures, writes an `SmsLog` row and never throws; no change. Returned `smsStatus` values are `SENT | PENDING_RETRY | FAILED | DISABLED`.
- **T-06:** the existing `BookingForm.jsx` (route `/`) already provided the form, departments, doctors, slots and envelope-based field errors. It now sends `patientMobile`, and on `SLOT_ALREADY_BOOKED` clears the selected slot and re-fetches slots so the booked slot is no longer selectable. The new page/API modules from the plan were not created, to avoid duplicating working code.
- **E2E:** Playwright test is deferred to the QA stage (as stated in T-06).
