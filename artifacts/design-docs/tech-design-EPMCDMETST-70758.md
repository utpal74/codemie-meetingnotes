# Technical Design — EPMCDMETST-70758

- **Jira:** https://jiraeu.epam.com/browse/EPMCDMETST-70758
- **Branch:** `feature/EPMCDMETST-70758-meetingnotes`
- **Date:** 2026-11-03
- **Status:** Ready for dev

## 1. Implementation plan

> Notes:
> - Backend already contains appointment lookup endpoints (`GET /api/appointments` with `phone` query param and `GET /api/appointments/:id`).
> - Global route mounting already protects `/api/appointments` with `authenticate` in `backend/src/app.js`.
> - This ticket primarily requires: (1) role restriction if required (Receptionist-only vs any authenticated user), (2) ensure responses do not leak phone, (3) includeHistory behavior matches ACs, (4) frontend receptionist UI for lookup, and (5) tests.

### T-01 — Confirm/implement receptionist-only authorization on appointment lookup
- **Description:** Ensure appointment lookup endpoints are accessible only to authenticated users with `RECEPTIONIST` role (or confirm that the system’s roles allow any authenticated receptionist access and admin access is acceptable). If role guard is required, implement `requireRole('RECEPTIONIST')` middleware for lookup routes.
- **Files to modify:**
  - `backend/src/routes/appointments.js`
  - (if needed) `backend/src/middleware/requireRole.js` (only if missing)
  - `backend/src/app.js` (only if route mounting needs adjustment)
- **Depends on:** none
- **Verifying test:** integration test asserting 401 unauthenticated; 403 for authenticated but wrong role (if enforced)

### T-02 — Align lookup-by-phone behavior with ACs (includeHistory & validation)
- **Description:** Ensure `GET /api/appointments?phone=...`:
  - returns 422 `MISSING_PARAMS` when phone is missing (already implemented)
  - validates phone format per existing rules (10 digits) and returns 422 `INVALID_PHONE` (currently not implemented at route layer)
  - `includeHistory=false` returns only active appointments expected by business rules (current service returns only `CONFIRMED`; keep unless ACs say otherwise)
  - `includeHistory=true` returns full reschedule chain. Current service returns all appointments for the hash; confirm it includes chain even when statuses change to `RESCHEDULED`.
- **Files to modify:**
  - `backend/src/routes/appointments.js`
  - `backend/src/schemas/index.js` (if adding new Zod schema export)
  - `backend/src/schemas/appointments.js` (or new schema file if pattern differs)
  - `backend/src/services/AppointmentService.js` (only if chain expansion is required beyond current behavior)
- **Depends on:** T-01
- **Verifying test:** integration tests for missing phone (422), invalid phone (422), includeHistory true/false result set

### T-03 — Ensure lookup-by-id returns required fields and no phone
- **Description:** Confirm `GET /api/appointments/:id` returns all required fields and does not leak phone. Current `toPublic()` omits `patientPhone` and includes required fields.
- **Files to modify:**
  - `backend/src/routes/appointments.js` (only if response shape adjustments needed)
- **Depends on:** T-01
- **Verifying test:** integration test: response payload does not contain `patientPhone`.

### T-04 — Add receptionist Appointment Lookup UI
- **Description:** Add a page allowing receptionist to:
  - search by Appointment ID or phone
  - toggle includeHistory for phone search
  - view results list and open appointment details panel
  - show status
- **Files to create/modify (expected):**
  - `frontend/src/pages/AppointmentLookupPage.jsx` (new)
  - `frontend/src/api/appointments.js` (add `getAppointmentById`, `searchAppointmentsByPhone`)
  - `frontend/src/App.jsx` (add route)
  - `frontend/src/components/` (optional: `AppointmentCard.jsx`, `InlineError.jsx`)
- **Depends on:** T-02/T-03 (API contract)
- **Verifying test:** Playwright (or React Testing Library if present) for basic search flows

### T-05 — Automated tests
- **Description:** Add/extend tests to cover AC-1..AC-5.
- **Files to create/modify:**
  - `backend/__tests__/integration/appointments.lookup.EPMCDMETST-70758.test.js` (new)
  - `tests/features/EPMCDMETST-70758-appointment-lookup.feature` (new)
  - `tests/e2e/EPMCDMETST-70758-appointment-lookup.spec.ts` (new, if Playwright set up)
- **Depends on:** T-01..T-04
- **Verifying test:** `npm run test:integration` and `npx playwright test` (if configured)

## 2. High-level design (HLD)

### 2.1 Components touched
- Backend
  - Express route: `backend/src/routes/appointments.js`
  - Service: `backend/src/services/AppointmentService.js`
  - Validation schemas: `backend/src/schemas/*`
  - Auth middleware: `backend/src/middleware/authenticate.js` and possibly `requireRole.js`
- Frontend
  - New receptionist page and API client helpers

### 2.2 Data flow

```text
Receptionist UI
  |  (Axios, cookie-based session)
  v
Express API (/api/appointments)
  | authenticate (session)
  | [optional] requireRole('RECEPTIONIST')
  | validate query/path
  v
AppointmentService
  | Prisma: appointment + doctor + department
  v
PostgreSQL
```

### 2.3 API surface

| Method | Path | Auth/Role | Purpose |
|---|---|---|---|
| GET | `/api/appointments/:id` | authenticated (+ receptionist if enforced) | Lookup a single appointment by appointment id |
| GET | `/api/appointments?phone=...&includeHistory=true|false` | authenticated (+ receptionist if enforced) | Lookup appointments by patient phone hash; optionally include reschedule history |

### 2.4 Non-functional notes
- **Security:** Do not return `patientPhone` (encrypted) or `patientPhoneHash` in payloads. Only expose appointment ID and non-sensitive fields.
- **Logging:** Rely on existing `pino-http`. Do not log raw phone numbers.
- **Performance:** Phone search is indexed via hash in DB (existing `patientPhoneHash`). includeHistory may return multiple rows; order descending by `createdAt`.

## 3. Low-level design (LLD)

### 3.1 Prisma changes
- **No schema changes required** (lookup uses existing `Appointment.patientPhoneHash` and `previousAppointmentId`).
- **Migration:** none.

### 3.2 Backend endpoints

#### 3.2.1 `GET /api/appointments?phone=...&includeHistory=...`
- **Middleware chain:** `authenticate` (mounted in `app.js`) → *(optional)* `requireRole('RECEPTIONIST')` → query validation
- **Query validation:**
  - `phone` required → else 422 with `{ error: { code: 'MISSING_PARAMS', message, field: 'phone' } }` (already implemented)
  - `phone` must be 10 digits → 422 `{ code: 'INVALID_PHONE', field: 'phone' }`
  - `includeHistory` optional boolean string; default `false`
- **Service call:** `AppointmentService.findByPhone(phone, { includeHistory })`
- **Success (200):** array of
  ```json
  {
    "appointmentId": "uuid",
    "patientName": "...",
    "doctorId": "uuid",
    "doctor": "Dr ...",
    "department": "Cardiology",
    "appointmentDate": "2026-11-03T00:00:00.000Z",
    "slotTime": "10:30",
    "status": "CONFIRMED",
    "createdAt": "...",
    "previousAppointmentId": "uuid|null"
  }
  ```
- **Error cases:**
  - 401 `UNAUTHORIZED` (global error handler)
  - 403 `FORBIDDEN` (only if role guard introduced)
  - 422 `MISSING_PARAMS` (phone absent)
  - 422 `INVALID_PHONE` (format)

#### 3.2.2 `GET /api/appointments/:id`
- **Middleware chain:** `authenticate` → *(optional)* `requireRole('RECEPTIONIST')`
- **Path param:** `id` is UUID; if not found return 404 `APPOINTMENT_NOT_FOUND` (already in service)
- **Success (200):** same object as above
- **Error cases:**
  - 401 `UNAUTHORIZED`
  - 403 `FORBIDDEN` (if enforced)
  - 404 `APPOINTMENT_NOT_FOUND`

### 3.3 Service behaviour

#### `AppointmentService.findByPhone(phone, { includeHistory })`
- Uses `hashPhone(phone)` and filters by `patientPhoneHash`.
- When `includeHistory=false`, returns only `CONFIRMED` appointments.
- When `includeHistory=true`, returns all statuses for that phone hash (includes `RESCHEDULED` chain and `CANCELLED` if any).

> If business expects "chain expansion" across `previousAppointmentId` even when phone changes (should not happen), add a follow-up; current DB design assumes same phone hash across chain.

### 3.4 Frontend design

#### New page: `frontend/src/pages/AppointmentLookupPage.jsx`
- **State:**
  - `mode`: `'id' | 'phone'` (or auto-detect based on UUID regex)
  - `query`: string
  - `includeHistory`: boolean (only for phone)
  - `loading`, `error`, `results`
- **API calls:**
  - `GET /api/appointments/:id`
  - `GET /api/appointments?phone=...&includeHistory=...`
- **Empty state:** show guidance text.
- **Error display:** show envelope message; for 422 show field error.

## 4. UI wireframes

```text
[Appointment Lookup]

Search by: (•) Appointment ID   ( ) Phone

Appointment ID / Phone: [____________________]  [Search]

(when Phone)
Include reschedule history: [ ]

------------------------------------------------
Results

- APT: 2b2c...   Patient: Rohan S
  Doctor: Dr Sharma (Cardiology)
  Date: 2026-11-05  Slot: 10:30  Status: CONFIRMED
  Previous: (none)

[Empty]
No appointments found.

[Error]
Phone number must be a 10-digit Indian mobile number.
```

## 5. Traceability

| Acceptance Criteria | Task(s) | Endpoint/UI | Planned test |
|---|---|---|---|
| AC-1 | T-01, T-03, T-05 | `GET /api/appointments/:id` | Integration: 200 and no phone in payload |
| AC-2 | T-01, T-02, T-05 | `GET /api/appointments?phone=` | Integration: list includes required fields, no phone |
| AC-3 | T-02, T-05 | phone search with `includeHistory=true` | Integration: includes rescheduled chain |
| AC-4 | T-02, T-05 | phone search missing `phone` | Integration: 422 `MISSING_PARAMS` field `phone` |
| AC-5 | T-01, T-05 | both endpoints | Integration: 401 when not logged in |

## 6. Open questions

1. Should **Admins** be allowed to use appointment lookup endpoints, or should lookup be strictly **RECEPTIONIST-only** (403 for Admin)? Ticket says “receptionist must be authenticated” but does not explicitly forbid Admin. Decision impacts T-01 and tests.
