# Tech Design — EPMCDMETST-69387
Story: **EPMCDMETST-69387** — Phone-based appointment booking + SMS notifications
Repo/Branch: `utpal74/codemie-meetingnotes` — `feature/EPMCDMETST-69387-meetingnotes`
Date: 2026-10-15
Status: Draft

---

## 1. Problem Statement & Background
Receptionists book doctor appointments for patients via phone calls. The system must:

- Lookup appointments by patient phone number while storing phone securely (encrypt at-rest + searchable hash).
- Compute day/doctor slot availability.
- Book, reschedule, and cancel appointments with concurrency safety (double-booking prevention).
- Automatically send SMS notifications on book/reschedule/cancel. SMS failures must not block booking and must be visible to receptionists (AC-10).

This design aligns with `artifacts/architecture.md` and incorporates the critical items from `artifacts/design-review.md` (FINDING-01..05, 09).

---

## 2. Goals / Non-Goals

### Goals
- Cover AC-1..AC-10 for Jira EPMCDMETST-69387.
- Phone lookup via HMAC hash while persisting the phone encrypted.
- Make double-booking impossible at the DB layer (partial unique index) and resilient at app layer (transaction).
- Non-blocking SMS send + background retries with clear `smsStatus` surfaced to UI.
- Standard error envelope contract between backend and frontend.

### Non-Goals
- Self-service patient booking portal.
- Introducing a full async event-bus/queue (Kafka/SQS) in v1.

---

## 3. Acceptance Criteria Coverage (AC-1..AC-10)
The table below traces each AC to the design elements in this doc.

| AC | Coverage in this design |
|---|---|
| AC-1 | Search by phone using canonicalization + HMAC hash; return latest confirmed appointment by default; history via `includeHistory=true`. |
| AC-2 | Slots query per doctor/date using indexed appointment query. |
| AC-3 | Booking uses SERIALIZABLE transaction and DB partial unique index to prevent double-booking; returns 409 on conflict. |
| AC-4 | Booking sends SMS attempt after DB commit; does not block booking response; logs SMS attempts. |
| AC-5 | Reschedule creates new appointment linked via `previousAppointmentId`; SMS uses “Updated Appointment ID” semantics. |
| AC-6 | Cancel is idempotent; second cancel returns 409; SMS sent async. |
| AC-7 | Mask phone in logs; never echo raw phone in errors. |
| AC-8 | Session-cookie auth for `/api/*`; allowlist only `/api/auth/login` + `/health`. |
| AC-9 | Standard error envelope used by all API endpoints. |
| AC-10 | UI shows warning banner when `smsStatus != SENT` (FAILED or PENDING_RETRY). |

---

## 4. High-Level Design (HLD)

### 4.1 Components
```text
React Frontend
  - BookingForm (phone, dept, doctor, date, slot)
  - AppointmentDetails (sms status panel)

Express API (Monolith)
  - Routes: /api/auth, /api/appointments, /api/slots
  - Middleware chain: requestId -> logger -> cors -> session -> auth -> validate -> handler -> errorHandler
  - Services:
      AppointmentService
      SlotService
      NotificationService
      SmsRetryWorker (cron)

PostgreSQL (Prisma)
  - appointments (with phone enc + hash, smsStatus)
  - sms_logs
  - sms_templates
```

### 4.2 Key Decisions (from design-review.md)
- FINDING-01: Partial unique index + SERIALIZABLE tx to prevent double-booking.
- FINDING-03: HMAC hash column for phone lookup.
- FINDING-04/05: SMS is non-blocking; background retries.
- FINDING-09: Standard error envelope.

---

## 5. Low-Level Design (LLD)

### 5.1 Middleware Chain (detailed)
1. `requestId` middleware adds `req.id` and response header `x-request-id`.
2. `pino-http` logs request/response; uses `sanitize()` to mask phone.
3. `cors` with env allowlist, `credentials: true`.
4. `express-session`.
5. `authenticate` for `/api/*` except `/api/auth/login` and `/health`.
6. `validate` (Zod) per route.
7. Controllers call services.
8. `errorHandler` produces standard error envelope.

### 5.2 Error Envelope + Mapping
**Envelope**
```json
{
  "error": {
    "code": "SLOT_UNAVAILABLE",
    "message": "The selected slot is already booked. Please choose another time.",
    "field": "slotTime",
    "requestId": "<uuid>"
  }
}
```

**Mapping**
- 401: `UNAUTHORIZED`
- 403: `FORBIDDEN`
- 404: `APPOINTMENT_NOT_FOUND`
- 409: `SLOT_UNAVAILABLE`, `APPOINTMENT_ALREADY_CANCELLED`
- 422: `VALIDATION_ERROR`

### 5.3 Data Model & Constraints
**Key fields**
- `patientPhoneEnc`: AES-256 encrypted (display only)
- `patientPhoneHash`: HMAC-SHA256 for lookup
- `smsStatus`: `NOT_SENT|PENDING_RETRY|SENT|FAILED`

**Indexes**
- `UX_appt_slot` on `(doctor_id, appointment_date, slot_time)` WHERE `status='CONFIRMED'`
- `IX_appt_phone_hash` on `patient_phone_hash`
- `IX_appt_doctor_date` on `(doctor_id, appointment_date)`
- `IX_sms_retry` on `(status, next_attempt_at)`

### 5.4 Notification Service
- Reads template from `sms_templates` (in-memory cache with 5 min TTL).
- Sends via provider with 2s timeout.
- Writes `sms_logs`.
- Updates appointment `smsStatus`.

### 5.5 Retry Worker
- Runs every 5 minutes.
- Retries FAILED logs up to 3 attempts with backoff.
- Updates appointment `smsStatus` to SENT or FAILED.

---

## 6. Wireframes (ASCII)

### 6.1 Booking
```text
Patient phone: [__________]
Department:    [v]
Doctor:        [v]
Date:          [YYYY-MM-DD]
Slots:         [09:00] [09:30] [10:00] ...

[Book]

Success:
Appointment confirmed. ID: XXXXX
If SMS failed/pending:
[WARNING] SMS could not be sent. Please inform the patient verbally.
```

### 6.2 Appointment Details (AC-10)
```text
Appointment ID: XXXXX
Doctor: Dr. ...
Date/Time: 2026-10-22 10:00
SMS Status: FAILED
[WARNING] SMS could not be sent. Please inform the patient verbally.

[Reschedule] [Cancel]
```

---

## 7. Traceability Matrix (AC -> Design -> Tests)
| AC | Design Section | Test Coverage |
|---|---|---|
| AC-1 | 5.3 | API integration: lookup by phone returns latest |
| AC-2 | 4.1/5.3 | API integration: slots reflect bookings |
| AC-3 | 5.3 | concurrency: two create attempts => one 201, one 409 |
| AC-4 | 5.4 | integration: booking creates sms_log and smsStatus |
| AC-5 | 5.3 | integration: reschedule creates chain + SMS log |
| AC-6 | 5.2 | integration: cancel twice => second 409 |
| AC-7 | 5.1 | unit: sanitize masks phone |
| AC-8 | 5.1 | integration: unauthorized requests 401 |
| AC-9 | 5.2 | unit: errorHandler shape |
| AC-10 | 6.2 | frontend: warning renders when smsStatus != SENT |

---

## 8. Implementation Plan (T-01..)
- **T-01** Validate Jira ACs and finalize DTO fields and SMS templates.
- **T-02** Prisma migration: add phone hash + smsStatus + indexes + partial unique index.
- **T-03** Implement crypto helpers: `encryptPhone`, `hashPhoneHmac`, `maskPhone`.
- **T-04** Implement/adjust endpoints for lookup, create, cancel, reschedule; add `includeHistory` param.
- **T-05** Implement NotificationService + TemplateStore + sms_logs persistence.
- **T-06** Implement SmsRetryWorker (node-cron) + backoff.
- **T-07** Frontend updates: booking form and appointment details warning panel.
- **T-08** Add tests: unit, integration, concurrency.
- **T-09** Update docs + add PR checklist.

---

## 9. Open Questions
1. Final SMS wording and localization requirements?
2. Do we need receptionist “resend SMS” button in v1 (tracked as enhancement)?
3. What is expected UI behavior for PENDING_RETRY (toast only vs persistent badge)?
