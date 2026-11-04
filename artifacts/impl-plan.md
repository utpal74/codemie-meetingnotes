# Implementation Plan — EPMCDMETST-69392

## Ticket context
**Story:** Receptionist manages appointments and sends patient SMS notifications

The system already contains:
- Protected appointment endpoints (`/api/appointments`) guarded by session auth middleware.
- Appointment lifecycle operations in `backend/src/services/AppointmentService.js`:
  - Book: `createAppointment`
  - Cancel: `cancelAppointment`
  - Reschedule: `rescheduleAppointment` (implemented as a new appointment with `previousAppointmentId`, old appointment moved to `RESCHEDULED`).
- SMS logging and dispatch via `backend/src/services/NotificationService.js`, with `SmsLog` and `SmsTemplate` Prisma models.

This implementation plan focuses on aligning existing behaviors and error codes with the Jira acceptance criteria, verifying “exactly one SMS” per operation, and ensuring slot double-booking prevention and SMS-failure persistence guarantees.

## Acceptance criteria mapping
- **AC-1 / AC-7**: Ensure slot cannot be double-booked and correct error envelope/code is returned.
- **AC-2 / AC-4 / AC-6**: Exactly one SMS attempt is created per successful lifecycle action; attempt is recorded.
- **AC-3**: Rescheduling must free the previous slot and reserve the new one (per current model: previous appointment becomes `RESCHEDULED`, new appointment is `CONFIRMED`).
- **AC-5**: Cancel must mark appointment `CANCELLED` and free slot (per current model: freeing is implicit because availability is computed by absence of `CONFIRMED` appt at that slot).
- **AC-8**: Unauthenticated calls rejected with `{ error: { code: "UNAUTHORIZED" } }`.
- **AC-9**: SMS failure must not rollback appointment changes; failure recorded in `SmsLog`.

## Implementation tasks

### T-01 — Confirm current domain error codes match ACs (no code changes in this stage)
**Goal:** Identify where `Errors.SLOT_UNAVAILABLE()` maps to the envelope and whether it uses `SLOT_ALREADY_BOOKED` vs existing `SLOT_UNAVAILABLE`.

1. Inspect `backend/src/helpers/errors.js` for:
   - Slot conflict error factory name(s)
   - `err.code` values for conflict and auth
2. Inspect `backend/src/middleware/authenticate.js` for the error code used on missing/invalid session.
3. Decide mapping to AC codes:
   - If system currently uses `SLOT_UNAVAILABLE`, determine whether to change to `SLOT_ALREADY_BOOKED` or add alias.
   - If system uses `UNAUTHORIZED`, confirm exact string.

**Files to review:**
- `backend/src/helpers/errors.js`
- `backend/src/middleware/authenticate.js`
- `backend/src/app.js` global error handler (envelope)

**Verification:** Document the current codes and required adjustments (to be done in dev stage).

---

### T-02 — Appointment booking flow alignment (AC-1, AC-2, AC-7)
**Goal:** Validate that booking creates appointment, prevents double booking, and triggers one SMS log/attempt.

Steps:
1. Review `backend/src/routes/appointments.js` POST `/`.
2. Confirm schema validation: `BookAppointmentSchema` fields include `patientName`, `patientPhone`, `doctorId`, `appointmentDate`, `slotTime`.
3. Review `AppointmentService.createAppointment`:
   - Uses serializable transaction.
   - Checks existing confirmed appointment with same doctor/date/slot.
   - Throws slot-unavailable error.
4. Review `NotificationService.sendBookingSms`:
   - Creates a single `SmsLog` row per `send` invocation.
   - Dispatches SMS and updates the same log row.
5. Confirm that the route calls `sendBookingSms` exactly once and returns `smsStatus`.

**Potential adjustments to implement later (not now):**
- Ensure conflict error code is exactly `SLOT_ALREADY_BOOKED` as in AC-7.

**Files impacted in later stage:**
- `backend/src/helpers/errors.js` (if code rename/alias)
- `backend/src/routes/appointments.js` (only if needed)

**Verification checks:**
- Manual API test plan:
  - Book same slot twice → second returns 409/422 with error envelope and code per AC-7.
  - Confirm DB has exactly 1 `appointment` record in `CONFIRMED` for that slot.
  - Confirm DB has exactly 1 `sms_log` created for the first booking with `messageType=BOOKING`.

---

### T-03 — Appointment cancellation flow alignment (AC-5, AC-6, AC-9)
**Goal:** Ensure cancel changes status, makes slot available (by business rule), and sends exactly one SMS attempt; SMS failure does not rollback.

Steps:
1. Review `backend/src/routes/appointments.js` PATCH `/:id/cancel`.
2. Review `AppointmentService.cancelAppointment`:
   - Validates appointment exists.
   - Rejects if already `CANCELLED` or `RESCHEDULED`.
   - Updates status to `CANCELLED`.
3. Review SMS sending and persistence guarantee:
   - Route awaits `NotificationService.sendCancelSms`.
   - `NotificationService.send` creates `SmsLog` before dispatch.
   - Dispatch updates log to `SENT` or `FAILED`.
   - Any failures inside send return `FAILED` and should not throw, so cancel should remain persisted.
4. Confirm slot availability computation:
   - Check `backend/src/routes/slots.js` and/or `backend/src/services/SlotService.js` logic for excluding `CANCELLED` and `RESCHEDULED` appointments when computing availability.

**Files to review:**
- `backend/src/services/SlotService.js`
- `backend/src/routes/slots.js`

**Potential adjustments to implement later:**
- If `sendCancelSms` throws in some cases, wrap it so cancel response still succeeds while reporting `smsStatus=FAILED`.

**Verification checks:**
- Cancel appointment → appointment status becomes `CANCELLED`.
- DB `SmsLog` created with `messageType=CANCELLATION` and status updated.
- Simulate Twilio disabled: ensure cancel still 200 OK and `SmsLog.status=FAILED`.

---

### T-04 — Appointment rescheduling flow alignment (AC-3, AC-4)
**Goal:** Reschedule updates appointment to a new slot and frees old one. Current design creates a new appointment and marks old as `RESCHEDULED`.

Steps:
1. Review `backend/src/routes/appointments.js` PATCH `/:id/reschedule`.
2. Review `AppointmentService.rescheduleAppointment`:
   - Validates slot format.
   - Reads existing appointment.
   - In serializable transaction:
     - Checks conflict for target slot.
     - Updates existing appointment status to `RESCHEDULED`.
     - Creates a new `CONFIRMED` appointment with `previousAppointmentId`.
3. Confirm that the response semantics are acceptable:
   - AC says “updates existing appointment”; implementation returns a new appointment id.
   - Decide if product expects same id or if “preserving identity” assumption A3 is acceptable.

**Open question (may require product confirmation):**
- Should reschedule preserve appointment ID (update same record), or is creating a new appointment acceptable as long as history is linked?

**Potential adjustments to implement later:**
- If AC strictly requires same appointment id, modify model/logic to update `appointmentDate` and `slotTime` in place and keep history elsewhere.

**Verification checks:**
- After reschedule:
  - Old appointment status is `RESCHEDULED`.
  - New appointment is `CONFIRMED` for new slot.
  - Booking at old slot succeeds (because no `CONFIRMED` remains).
  - Exactly one SMS log created for the new appointment with `messageType=RESCHEDULING`.

---

### T-05 — Ensure “exactly one SMS” per successful lifecycle action (AC-2/4/6)
**Goal:** Guarantee we do not duplicate SMS logs or dispatches.

Steps:
1. Review all appointment routes for additional SMS triggers (e.g., hooks, background jobs).
2. Review `NotificationService.send` for idempotency concerns:
   - It always creates a new `SmsLog` row; if route is retried by client, duplicates may occur.
3. Determine whether the system requires idempotency:
   - Jira AC says “exactly one SMS after successful action”; interpret as “per successful API call”, not “globally once per appointment change”.

**Potential adjustments to implement later (if idempotency required):**
- Add idempotency key support (header) stored with `SmsLog`.
- Or add unique constraint per `(appointmentId, messageType)` (but reschedule uses a new appointment id).

**Verification checks:**
- Confirm only one call site per route.
- Confirm no Prisma middleware auto-sends.

---

### T-06 — Authentication enforcement (AC-8)
**Goal:** Ensure unauthenticated requests to appointment actions are rejected with correct envelope and `UNAUTHORIZED` code.

Steps:
1. Verify `backend/src/app.js` uses `authenticate` middleware for `/api/appointments`.
2. Review `backend/src/middleware/authenticate.js` behavior:
   - Status code (401 vs 403)
   - Error code string
   - Error message
3. Align with AC: `{ error: { code: "UNAUTHORIZED", message: string } }`.

**Potential adjustments to implement later:**
- If code differs, update middleware to use `err.code='UNAUTHORIZED'` and `status=401`.

**Verification checks:**
- Curl without cookies → 401 with correct envelope.

---

### T-07 — Frontend touchpoints (plan only; no code changes in this stage)
**Goal:** Identify where receptionist triggers book/reschedule/cancel and displays `smsStatus`.

Steps:
1. Locate appointment-related pages/components under `frontend/src`.
2. Confirm API client calls:
   - POST `/api/appointments`
   - PATCH `/api/appointments/:id/cancel`
   - PATCH `/api/appointments/:id/reschedule`
3. Confirm UI behavior for SMS outcomes:
   - display `smsStatus` (SENT/FAILED/DISABLED/PENDING_RETRY)

**Files to review:**
- `frontend/src/**` (appointment screens, API client)

---

## Verification plan (what to run in dev/test stage)
> No tests are written in this stage; this section specifies checks for the subsequent implementation stage.

1. **API auth check**
   - Without session: all appointment endpoints return 401 with `{error:{code:"UNAUTHORIZED"}}`.
2. **Booking**
   - Book valid slot → 201, appointment created, `smsStatus` present.
   - Book same slot again → rejected with code `SLOT_ALREADY_BOOKED` (or mapped code).
3. **Reschedule**
   - Reschedule to free slot → 201, new appointment returned (or updated appointment if changed later).
   - Old slot becomes available.
4. **Cancel**
   - Cancel confirmed appointment → 200, status `CANCELLED`.
   - Attempt cancel again → appropriate domain error.
5. **SMS failure resilience**
   - Disable Twilio env vars → appointment operations succeed; `SmsLog` records `FAILED`.

## Rollout / configuration notes
- Ensure `SmsTemplate` rows exist for `BOOKING`, `CANCELLATION`, `RESCHEDULING` in target environment.
- Ensure `SESSION_SECRET` configured in production.
- Twilio vars:
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_PHONE_NUMBER`

## Open questions
1. **Reschedule semantics vs AC-3:** Is creating a new appointment record (with a new ID) acceptable, or must reschedule update the existing appointment ID in place?
2. **Conflict error code (AC-7):** Should the product standardize on `SLOT_ALREADY_BOOKED` or keep `SLOT_UNAVAILABLE` and document aliasing?
3. **“Exactly one SMS” meaning:** Is it per successful API call, or must it be globally idempotent even if the same request is retried?
