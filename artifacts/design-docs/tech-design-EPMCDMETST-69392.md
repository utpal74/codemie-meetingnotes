# Technical Design — EPMCDMETST-69392

- **Jira:** EPMCDMETST-69392 — Receptionist manages appointments + patient SMS notifications  
  https://jiraeu.epam.com/browse/EPMCDMETST-69392
- **Repo/Branch:** `feature/EPMCDMETST-69392-meetingnotes`
- **Date:** 2026-10-15
- **Status:** Ready for dev

---

## 1. Implementation plan

> Notes on current state: core backend functionality already exists in `backend/src/routes/appointments.js`, `SlotService`, `AppointmentService`, `NotificationService`, and `smsRetryJob.js`. Main gaps vs AC are: (1) “doctor optional + random doctor assignment” and “random slot assignment” paths, (2) consistent auth/error envelope for all appointment APIs, and (3) receptionist UI affordances for random doctor/slot and for surfacing SMS failures after retries.

### T-01. Add booking request options for optional doctor and random slot
- **Description:** Extend booking DTO to allow `doctorId` to be optional when receptionist chooses “Any doctor”, and allow `slotTime` to be optional when receptionist chooses “Any available slot”. System will assign a random doctor (from selected department) and/or random available slot.
- **Files to modify:**
  - `backend/src/schemas/appointments.js`
  - `backend/src/routes/appointments.js`
  - `backend/src/services/AppointmentService.js`
  - `backend/src/services/DoctorService.js` (if helper needed)
  - `backend/src/services/SlotService.js` (if helper needed)
- **Depends on:** none
- **Verifying test:** `npm run test:integration -- appointments.booking.random.test.js` (new)

### T-02. Enforce auth middleware on appointment-management endpoints (explicit)
- **Description:** Ensure appointments router is protected with `authenticate` at mount point (already done in `app.js`) and that unauthenticated requests return `401` with `{ error: { code: "UNAUTHORIZED" } }` envelope.
- **Files to modify:**
  - `backend/src/middleware/authenticate.js` (if envelope mismatch)
  - `backend/src/app.js` (verify router mount remains behind `authenticate`)
- **Depends on:** none
- **Verifying test:** `npm run test:integration -- auth.guard.appointments.test.js` (new)

### T-03. Align API error statuses/codes to acceptance criteria
- **Description:**
  - Booking conflict under concurrency returns `409` with envelope.
  - Missing query params for search returns `422` with envelope.
  - Sunday/date validation returns `422` with envelope.
- **Files to modify:**
  - `backend/src/helpers/errors.js`
  - `backend/src/services/AppointmentService.js`
  - `backend/src/routes/appointments.js`
  - `backend/src/routes/slots.js`
- **Depends on:** T-01 (DTO changes) may require error changes.
- **Verifying test:** `npm run test:integration -- appointments.errors.test.js` (new)

### T-04. Surface SMS failures after retries
- **Description:** Provide a receptionist-visible signal when an SMS send is still FAILED after ≥3 attempts.
  - Backend: add an endpoint to query SMS status per appointment, or embed latest smsLog summary in appointment responses.
  - Frontend: show banner state for `FAILED_AFTER_RETRIES`.
- **Files to modify:**
  - `backend/src/routes/appointments.js`
  - `backend/src/services/NotificationService.js` (if status mapping needed)
  - `backend/prisma/schema.prisma` (NO schema change expected)
  - `frontend/src/components/SmsBanner.jsx`
  - `frontend/src/components/BookingForm.jsx`
  - `frontend/src/components/CancelReschedule.jsx`
- **Depends on:** none
- **Verifying test:** `npm run test:integration -- sms.failure-surfacing.test.js` (new); `npm run test:e2e -- sms-banner.spec.ts` (optional)

### T-05. Update receptionist Booking UI to support “Any doctor” + “Any slot”
- **Description:** Add UI switches/checkboxes to allow receptionist to:
  - choose department only and let backend pick doctor;
  - choose doctor but let backend pick slot;
  - choose both doctor + slot (current flow).
- **Files to modify:**
  - `frontend/src/components/BookingForm.jsx`
  - `frontend/src/api/client.js` (only if error parsing improvements needed)
- **Depends on:** T-01
- **Verifying test:** `npm run test:e2e -- booking-random.spec.ts` (new)

### T-06. Update appointment lookup + cancel/reschedule UI for SMS failure visibility
- **Description:** Ensure lookup shows status; cancel/reschedule shows sms banner and any persistent failure.
- **Files to modify:**
  - `frontend/src/components/AppointmentList.jsx`
  - `frontend/src/components/CancelReschedule.jsx`
- **Depends on:** T-04
- **Verifying test:** `npm run test:e2e -- manage-appointment.spec.ts` (new)

### T-07. Documentation links under docs/
- **Description:** Add entry to `docs/design.md` pointing to this tech design file; ensure `docs/pr_checklist.md` reference remains.
- **Files to modify:**
  - `docs/design.md`
- **Depends on:** none
- **Verifying test:** manual (link opens)

---

## 2. HLD

### 2.1 Components touched
- **Backend**
  - `appointments` router: booking, lookup, cancel, reschedule
  - `slots` router: availability
  - `AppointmentService`: transaction + conflict handling
  - `SlotService`: slot generation/validation
  - `DoctorService`: list doctors by department
  - `NotificationService` + `smsRetryJob`: SMS send + retries
- **Frontend**
  - Booking: `BookingForm`
  - Lookup/manage: `AppointmentList`, `CancelReschedule`
  - SMS UI: `SmsBanner`

### 2.2 Data flow (booking with random doctor/slot)

```
Receptionist UI
  | POST /api/appointments  (departmentId, doctorId?, appointmentDate, slotTime?)
  v
appointments router (authenticate -> validate)
  v
AppointmentService.createAppointmentAuto()
  |-- DoctorService.getActiveDoctorsByDepartment(departmentId)
  |-- SlotService.getAvailableSlots(doctorId, date)
  |-- Prisma $transaction (SERIALIZABLE)
  v
Appointment (CONFIRMED)
  v
NotificationService.sendBookingSms()
  |-- SmsLog(PENDING) + dispatchSms (Twilio)
  v
Response includes appointment + smsStatus
```

### 2.3 API surface

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/api/appointments` | Receptionist | Book appointment (doctor optional, slot optional) |
| GET | `/api/appointments?phone=` | Receptionist | Lookup by patient phone (optionally includeHistory) |
| GET | `/api/appointments/:id` | Receptionist | Lookup by appointment ID |
| PATCH | `/api/appointments/:id/cancel` | Receptionist | Cancel + trigger SMS |
| PATCH | `/api/appointments/:id/reschedule` | Receptionist | Reschedule (new appointment) + trigger SMS |
| GET | `/api/appointments/:id/sms` | Receptionist | (New) Get latest SMS status and attempts |
| GET | `/api/slots?doctorId=&date=` | Receptionist | Available slots for doctor on date |

### 2.4 Non-functional notes
- **Security:** all appointment APIs require session auth; do not expose patient phone decrypted.
- **Concurrency:** keep SERIALIZABLE transaction and map Prisma serialization failures to 409.
- **Observability:** log SMS dispatch errors (already via `NotificationService`). Add structured log when persistent failure detected.

---

## 3. LLD

### 3.1 Prisma / DB
No schema change required (models already contain `previousAppointmentId`, `SmsLog`, `SmsTemplate`).

If we decide to store “persistent failure surfaced” we can add a nullable timestamp field to `SmsLog` later; not required by AC.

### 3.2 Validation rules
- **Patient name:** required, trimmed, min length 2.
- **Patient phone:** required, `^[6-9]\d{9}$` (10-digit Indian mobile; stricter than “10-digit” but typical).
- **Date:** required; must be valid date string; must not be Sunday (UTC day 0 per current code; confirm timezone in Open Questions).
- **Slot:** if provided must be within allowed slot list (10:00..18:30 every 30 min).
- **Doctor:** optional; if provided must be valid UUID and exist.
- **Department:** required for booking when doctor is not provided (since random doctor selection needs department).

### 3.3 Backend: schemas
Update `backend/src/schemas/appointments.js`:
- `BookAppointmentSchema` (Zod)
  - `patientName: z.string().trim().min(2)`
  - `patientPhone: z.string().regex(/^[6-9]\d{9}$/)`
  - `departmentId: z.string().uuid().optional()` (required if `doctorId` omitted)
  - `doctorId: z.string().uuid().optional()`
  - `appointmentDate: z.string()` (ISO `yyyy-mm-dd` accepted)
  - `slotTime: z.string().regex(/^\d{2}:\d{2}$/).optional()`

`superRefine` rules:
- if `!doctorId && !departmentId` -> issue on `departmentId`

`RescheduleSchema` stays similar but validates date not Sunday and slot valid.

### 3.4 Backend: service methods
Add / adjust in `backend/src/services/AppointmentService.js`:

```js
async function createAppointmentAuto({ patientName, patientPhone, departmentId, doctorId, appointmentDate, slotTime })
```
Behaviour:
1. Validate date (not Sunday) and slot format if provided.
2. Resolve doctor:
   - if `doctorId` present, use it.
   - else pick random from active doctors in department.
     - If no active doctors -> throw `{ status: 409, code: 'NO_DOCTOR_AVAILABLE', field: 'departmentId' }`
3. Resolve slot:
   - if `slotTime` present, use it.
   - else fetch available slots for doctor/date and randomly pick one.
     - If none -> throw `{ status: 409, code: 'NO_SLOTS_AVAILABLE', field: 'slotTime' }`
4. Use existing SERIALIZABLE transaction create path to enforce uniqueness.
5. Map Prisma P2034 serialization failure to `SLOT_UNAVAILABLE` (409).

Also update `createAppointment()` to call `createAppointmentAuto()` for backward compatibility.

### 3.5 Backend: endpoints

#### POST `/api/appointments`
- **Middleware:** `authenticate` (at mount) → `validate(BookAppointmentSchema)`
- **Request body:** per schema above.
- **Success:** `201`

```json
{
  "appointmentId": "uuid",
  "patientName": "...",
  "doctorId": "uuid",
  "doctor": "Dr X",
  "department": "Cardiology",
  "appointmentDate": "2026-10-15T00:00:00.000Z",
  "slotTime": "10:30",
  "status": "CONFIRMED",
  "createdAt": "...",
  "previousAppointmentId": null,
  "smsStatus": "SENT" | "FAILED" | "PENDING_RETRY" | "DISABLED"
}
```

- **Errors:**
  - `401 UNAUTHORIZED` field null
  - `400` Zod validation errors (existing validate middleware behaviour)
  - `409 SLOT_UNAVAILABLE` field `slotTime`
  - `409 NO_DOCTOR_AVAILABLE` field `departmentId`
  - `409 NO_SLOTS_AVAILABLE` field `slotTime`

#### GET `/api/appointments?phone=...&includeHistory=true|false`
- **Middleware:** `authenticate`
- **Success:** `200` array of appointment summaries.
- **Errors:** `422 MISSING_PARAMS` field `phone`

#### GET `/api/appointments/:id`
- **Middleware:** `authenticate`
- **Success:** `200`
- **Errors:** `404 APPOINTMENT_NOT_FOUND` field null

#### PATCH `/api/appointments/:id/cancel`
- **Middleware:** `authenticate`
- **Success:** `200` appointment summary + `smsStatus`
- **Errors:**
  - `404 APPOINTMENT_NOT_FOUND`
  - `409 APPOINTMENT_ALREADY_CANCELLED` (existing Errors helper)

#### PATCH `/api/appointments/:id/reschedule`
- **Middleware:** `authenticate` → `validate(RescheduleSchema)`
- **Success:** `201` new appointment summary + `smsStatus`
- **Errors:** `409 SLOT_UNAVAILABLE`, `422 INVALID_DATE`

#### GET `/api/appointments/:id/sms` (new)
- **Purpose:** meet AC-9 “surface persistent failures”. UI can poll when `PENDING_RETRY` or `FAILED`.
- **Middleware:** `authenticate`
- **Success:** `200`

```json
{
  "appointmentId": "uuid",
  "latest": {
    "messageType": "BOOKING",
    "status": "PENDING" | "SENT" | "FAILED",
    "attemptCount": 3,
    "updatedAt": "..."
  },
  "failedAfterRetries": true
}
```

- Determine `failedAfterRetries = (latest.status === 'FAILED' && latest.attemptCount >= 3)`.

### 3.6 Frontend changes

#### `frontend/src/components/BookingForm.jsx`
- Add toggles:
  - Checkbox: “Any doctor” (when checked, disable doctor select and send `doctorId: undefined`, keep `departmentId`).
  - Checkbox: “Any available slot” (when checked, disable slot select and send `slotTime: undefined`).
- Update slot fetching logic:
  - Only fetch slots when doctor is selected AND “Any slot” is not checked.
- Error rendering:
  - Read error envelope `err.response?.data?.error` (if not already in axios client) and map to field/global.

#### `frontend/src/components/CancelReschedule.jsx`
- After cancel/reschedule success, show sms banner.
- If `smsStatus` is `FAILED` or `PENDING_RETRY`, optionally poll `/appointments/:id/sms` to detect `failedAfterRetries` and show stronger warning.

#### `frontend/src/components/SmsBanner.jsx`
- Ensure it can display:
  - SENT (green)
  - PENDING_RETRY (amber)
  - FAILED (red)
  - FAILED_AFTER_RETRIES (red + “Contact patient manually”)
  - DISABLED (gray, dev)

### 3.7 Backward compatibility
- Existing clients that POST with `doctorId` + `slotTime` must keep working.
- Existing `/api/slots` and lookup routes remain unchanged except error envelope alignment.

---

## 4. UI wireframes

### 4.1 Booking — New Appointment

```
+--------------------------------------------------+
| New Appointment                                  |
+--------------------------------------------------+
| Patient Name*  [_____________________________]   |
| Phone Number*  [__________]                      |
| Department*    [Select v]                        |
| [ ] Any doctor                                   |
| Doctor*        [Select v] (disabled if Any)      |
| Date*          [ yyyy-mm-dd ]                    |
| [ ] Any available slot                           |
| Time Slot*     [Select v] (disabled if Any)      |
|                                                  |
| [ Confirm Appointment ]                          |
+--------------------------------------------------+
| Success: shows Appointment ID + SmsBanner        |
| Error: inline field errors + global banner       |
+--------------------------------------------------+
```

### 4.2 Find Appointment

```
+--------------------------------------------------+
| Find Appointment                                 |
+--------------------------------------------------+
| [ Phone number or Appointment ID ] [ Search ]    |
|                                                  |
| Results:                                         |
|  - Card (patient, doctor, dept, date, time, id)  |
|    [ Manage -> ]                                 |
+--------------------------------------------------+
```

### 4.3 Manage Appointment (Cancel / Reschedule)

```
+---------------- Appointment card ----------------+
| Status: CONFIRMED                               |
| ...                                              |
+--------------------------------------------------+
| [ Reschedule ]   [ Cancel Appointment ]          |
|                                                  |
| Reschedule mode:                                 |
| New Date [_____]                                 |
| New Slot [Select v]                              |
| [ Confirm Reschedule ] [ Back ]                  |
|                                                  |
| After action: Success banner + SmsBanner         |
| If sms failed after retries: show red warning    |
+--------------------------------------------------+
```

---

## 5. Traceability

| Acceptance Criteria | Task(s) | Endpoint / Component | Planned test |
|---|---|---|---|
| AC-1 random doctor when not selected | T-01, T-05 | POST `/api/appointments` + `BookingForm` | integration: `appointments.booking.random.test.js`; e2e: `booking-random.spec.ts` |
| AC-2 slots Mon–Sat 10:00–18:30; reject Sundays | T-01, T-03, T-05 | SlotService + `/api/slots` + `/api/appointments` | integration: `appointments.errors.test.js` |
| AC-3 create CONFIRMED appt + unique ID + display details | T-01, T-05 | POST `/api/appointments` + confirmation panel | e2e: `booking-random.spec.ts` |
| AC-4 prevent double booking + 409 envelope | T-03 | AppointmentService SERIALIZABLE | integration: `appointments.concurrency.test.js` |
| AC-5 lookup by ID | T-03, T-06 | GET `/api/appointments/:id` + `AppointmentList` | integration: `appointments.lookup.test.js` |
| AC-6 cancel sets CANCELLED + release slot + SMS | T-03, T-04, T-06 | PATCH `/api/appointments/:id/cancel` + `CancelReschedule` | integration: `appointments.cancel.test.js`; e2e manage |
| AC-7 reschedule creates new linked appt + release old + SMS | T-03, T-04, T-06 | PATCH `/api/appointments/:id/reschedule` | integration: `appointments.reschedule.test.js` |
| AC-8 unauthenticated returns 401 UNAUTHORIZED envelope | T-02 | all protected APIs | integration: `auth.guard.appointments.test.js` |
| AC-9 SMS fails after >=3 retries -> record + surface | T-04, T-06 | `/appointments/:id/sms` + SmsBanner | integration: `sms.failure-surfacing.test.js` |

---

## 6. Open questions

1. **Timezone for “Sunday” and clinic hours validation**: current code uses `getUTCDay()`; should this be based on clinic local timezone (IST) using local `getDay()`? Ticket says “System clock/timezone is configured”; recommend switching to local day-of-week or explicitly using Asia/Kolkata.
2. **Department/Doctor active flags**: Prisma schema in this repo doesn’t include `isActive` fields (unlike prior context). Ticket requires “active Department/Doctor”. Do we need to add `isActive` booleans and admin toggles in a separate ticket, or treat all as active for this story?

Artifacts: none
