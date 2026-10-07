# Architecture Design Review — Doctor Appointment Booking System

**Reviewer:** Senior Architect  
**Review Date:** 2026-09-23  
**Document Reviewed:** [architecture.md](architecture.md) v1.0  
**Status:** Findings documented; architecture.md updated (see Section 4)

---

## 1. Review Scope & Methodology

This review examines architecture.md against the following quality dimensions before any production code is written:

| Dimension | Checked |
|---|---|
| Correctness — will the design actually work? | ✓ |
| Concurrency & data integrity | ✓ |
| Security posture | ✓ |
| Performance against stated SLAs | ✓ |
| Observability & operability | ✓ |
| Completeness — are there unspecified gaps? | ✓ |
| Alignment with requirements.md NFRs | ✓ |

Severity scale: **Critical** (blocks coding) · **Major** (must resolve before first deploy) · **Minor** (address before v1 ship)

---

## 2. Findings

---

### FINDING-01 · Critical · Race Condition on Slot Booking

**Location:** Section 3 (SlotService), Section 6.1 (booking sequence diagram)

**Problem:**  
The booking flow has a classic TOCTOU (time-of-check / time-of-use) race condition:

```
Receptionist A: reads available slots → slot 14:30 is free
Receptionist B: reads available slots → slot 14:30 is free
Receptionist A: books slot 14:30         ← succeeds
Receptionist B: books slot 14:30         ← also succeeds (double-booking!)
```

The architecture says "a slot already booked cannot be double-booked" but provides no mechanism to guarantee it. There is no unique constraint shown in the ER diagram and no locking strategy described.

**Resolution:**  
Two layers of defence are required:

1. **Database unique constraint** on `(doctor_id, appointment_date, slot_time)` filtered to `status = 'CONFIRMED'` (a partial unique index in PostgreSQL). This makes double-booking physically impossible at the storage layer.

2. **`SELECT FOR UPDATE`** (pessimistic lock) or **optimistic concurrency** via a `version` column on the `appointments` table when checking slot availability inside the `createAppointment` transaction.

Recommended approach: wrap the slot-check + INSERT in a single serialisable transaction:

```sql
BEGIN;
SELECT COUNT(*) FROM appointments
  WHERE doctor_id = $1
    AND appointment_date = $2
    AND slot_time = $3
    AND status = 'CONFIRMED'
  FOR UPDATE;   -- locks the row range
-- if count = 0, INSERT; else return 409 Conflict
COMMIT;
```

**Agreed Decision:** Add a partial unique index `UX_appt_slot` on `(doctor_id, appointment_date, slot_time)` WHERE `status = 'CONFIRMED'`. Wrap slot-check + INSERT in a `SERIALIZABLE` Prisma transaction. Return HTTP 409 to the UI if the slot is taken, and prompt the receptionist to pick another.

---

### FINDING-02 · Critical · No Authentication on the API

**Location:** Section 8 (REST API Design), Section 11 (Security)

**Problem:**  
The API has no authentication layer. Any browser that can reach port 4000 can:
- Create appointments for arbitrary patients
- Search patient records by phone number
- Cancel or reschedule any appointment

This violates NFR-05 (data security) and DPDP Act 2023 compliance (NFR-08).

**Resolution:**  
For v1 (single receptionist desk), a session-based login is sufficient:
- A simple `POST /api/auth/login` endpoint with a username + password
- On success, issue an **httpOnly cookie** carrying a signed session token (or a short-lived JWT)
- All `/api/*` routes protected by an `authenticate` middleware that validates the token
- Default credentials seeded via environment variables (changeable without code change)

This adds one table (`receptionist_sessions` or a stateless JWT secret) and one middleware function. It does not require a full user-management system for v1.

**Agreed Decision:** Add session-based authentication. All `/api/*` routes require a valid session cookie. `POST /api/auth/login` and `GET /api/health` are the only public endpoints. Credentials stored as bcrypt hashes in environment config for v1.

---

### FINDING-03 · Critical · Encrypted Phone Number Breaks Search

**Location:** Section 7 (Database Schema), Section 8 (API — `GET /api/appointments?phone=`)

**Problem:**  
NFR-05 requires patient phone numbers to be stored AES-256 encrypted. However, the API defines `GET /api/appointments?phone=XXXXXXXXXX` which requires the database to match on the phone field. You cannot execute `WHERE patient_phone = ?` on a symmetrically encrypted column — the ciphertext will be different every time if a random IV is used.

This is a design contradiction that would be discovered in code and cause a costly refactor.

**Three options considered:**

| Option | Approach | Tradeoff |
|---|---|---|
| A | Deterministic encryption (same plaintext → same ciphertext) | Breaks semantic security; vulnerable to frequency analysis |
| B | Store a **keyed HMAC hash** alongside the encrypted column for lookup | Lookup uses the hash; display uses the decrypted value — correct security model |
| C | Encrypt in application layer, load all records for a doctor and filter in memory | Doesn't scale beyond a few hundred records; unacceptable |

**Agreed Decision:** Use **Option B**. Add a `patient_phone_hash` column (SHA-256 HMAC with a server-side secret key). Lookup queries use `WHERE patient_phone_hash = hmac(input, secret)`. The `patient_phone` column stores the AES-256 encrypted value for display only. Index `patient_phone_hash` for O(log n) lookup.

---

### FINDING-04 · Critical · SMS Failure Leaves Appointment in Ambiguous State

**Location:** Section 6.1 (booking sequence), ADR-03

**Problem:**  
The booking sequence is:
1. INSERT appointment → succeeds, appointment ID created
2. Call Twilio → may fail

If step 2 fails, the appointment exists in the database as `CONFIRMED` but the patient received no SMS. The receptionist sees either a confusing error or a success — the architecture does not specify the behavior.

Additionally, the appointment cannot be rolled back because it is already committed to the database (a real appointment was made — the failure is only in notification, not in the booking itself).

**Resolution:**  
Separate concerns clearly:

- The appointment is always committed first. A booking is valid with or without the SMS.
- SMS failure is a **non-blocking degradation**, not a booking failure.
- The API response should include an `smsStatus` field (`SENT` / `PENDING_RETRY` / `FAILED`).
- The UI must show a clear warning to the receptionist when `smsStatus` is not `SENT`: *"Appointment confirmed. SMS could not be sent — please inform the patient verbally."*
- The `sms_logs` table already tracks failures; add a **background retry job** (a simple `setInterval` or `node-cron` task) that polls `sms_logs WHERE status = 'FAILED' AND attempt_count < 3` and retries every 5 minutes.

**Agreed Decision:** Decouple SMS from the booking commit. Appointment INSERT is always committed. SMS is attempted immediately (fire-and-forget after first attempt). Retries happen via a background polling job every 5 minutes, up to 3 total attempts. `smsStatus` is included in the API response so the UI can warn the receptionist on failure.

---

### FINDING-05 · Major · Synchronous SMS Retry Will Violate the 3-Second SLA

**Location:** ADR-03, NFR-01, NotificationService

**Problem:**  
ADR-03 justifies synchronous SMS by saying "Twilio's p99 API latency is ~500ms." This is true for the happy path. However, the architecture also states "retries up to 3×." If Twilio's first attempt times out (Twilio's default client timeout is 30s, though typically much faster), three synchronous retries will massively exceed the 3-second booking SLA.

Even at optimistic numbers: 500ms first attempt + 500ms retry 1 + 500ms retry 2 + DB write time = already approaching or past 3 seconds before network variance is considered.

**Resolution:**  
This is resolved by FINDING-04's agreed decision: the first SMS attempt is fire-and-forget (no await on retry), and retries are background. The `createAppointment` API call returns as soon as the DB commit succeeds and the first Twilio request is dispatched (not awaited). This restores the 3-second SLA to a comfortably achievable target (~100ms DB write + ~500ms first SMS dispatch).

**Agreed Decision:** `NotificationService.sendBookingSms()` fires the first Twilio call with a short internal timeout (2s). The result is logged asynchronously. The `createAppointment` handler does not await retries.

---

### FINDING-06 · Major · No Index Strategy Defined

**Location:** Section 7 (Database Schema)

**Problem:**  
The ER diagram defines tables and foreign keys but no indexes. The two most frequent read queries are:

1. `GET /api/appointments?phone=:hash` — full table scan without an index on `patient_phone_hash`
2. `GET /api/slots?doctorId=:id&date=:date` — scans all appointments for a doctor to compute free slots

At 500 appointments/day, the table grows to ~180,000 rows per year. Without indexes, slot availability queries will degrade noticeably within months.

**Agreed Decision:** Define the following indexes explicitly in the Prisma schema:

| Index Name | Columns | Type | Purpose |
|---|---|---|---|
| `UX_appt_slot` | `(doctor_id, appointment_date, slot_time)` WHERE `status='CONFIRMED'` | Unique partial | Prevent double-booking (FINDING-01) |
| `IX_appt_phone_hash` | `patient_phone_hash` | B-tree | Phone number lookup |
| `IX_appt_doctor_date` | `(doctor_id, appointment_date)` | B-tree | Available slot computation |
| `IX_appt_status` | `status` | B-tree | Background SMS retry job filter |

---

### FINDING-07 · Major · SMS Template Storage Not Specified

**Location:** NFR-07, NotificationService

**Problem:**  
NFR-07 states "SMS templates must be configurable without a code change." The architecture acknowledges this but never specifies *where* templates are stored. Options:

- Environment variables (simple but awkward for multi-line templates)
- A `config` database table (flexible, survives restarts)
- A JSON config file (simple, requires file system access)

This gap means a developer writing `NotificationService` will make an arbitrary choice that may not align with the team's operational model.

**Agreed Decision:** Add a `sms_templates` table with columns `(id, message_type, template_body, updated_at)`. Seeded with the three templates from requirements.md at startup. `NotificationService` reads the template from this table at send time (cached in memory with a 5-minute TTL to avoid per-SMS DB reads). This satisfies NFR-07 and avoids environment variable sprawl.

---

### FINDING-08 · Major · Reschedule Creates a New Appointment ID — Patient Confusion Risk

**Location:** FR-07 (requirements.md), Section 6.3 (reschedule sequence)

**Problem:**  
The current design marks the old appointment `RESCHEDULED` and creates a brand-new appointment record with a new UUID. The patient receives a "New Appointment ID" in their SMS. This means:

- A patient who rescheduled twice has three Appointment IDs for what they consider one appointment
- If the patient calls back citing their original Appointment ID, the receptionist's lookup returns a `RESCHEDULED` record, not the current active one
- The lookup endpoint `GET /api/appointments?phone=:phone` would return all three records, which the UI must handle

The `previous_appointment_id` self-FK partially addresses this but the chain navigation is complex.

**Agreed Decision:** Keep the existing model (immutable records + chain) for audit trail purposes, but add two UI/API rules:
1. The lookup endpoint filters to the **latest active appointment** by default (most recent `CONFIRMED` in the chain). A `?includeHistory=true` param returns the full chain.
2. The SMS for rescheduling sends the **new** Appointment ID clearly labelled as "Updated Appointment ID" with the previous ID noted for reference.

No schema change required — this is a query and UI behaviour clarification.

---

### FINDING-09 · Minor · No Error Response Schema

**Location:** Section 8 (REST API Design)

**Problem:**  
The API design defines success responses but no error format. The frontend's error handling and user-facing messages depend on a predictable error shape. Developers will invent inconsistent shapes if not specified.

**Agreed Decision:** Standardise all error responses:

```json
{
  "error": {
    "code": "SLOT_UNAVAILABLE",
    "message": "The selected slot is already booked. Please choose another time.",
    "field": "slotTime"
  }
}
```

Define the following error codes:

| Code | HTTP Status | Trigger |
|---|---|---|
| `SLOT_UNAVAILABLE` | 409 | Double-booking attempt |
| `APPOINTMENT_NOT_FOUND` | 404 | ID or phone yields no record |
| `INVALID_PHONE` | 422 | Phone number fails Zod validation |
| `INVALID_DATE` | 422 | Past date or Sunday selected |
| `APPOINTMENT_ALREADY_CANCELLED` | 409 | Cancel called on already-cancelled record |
| `SMS_SEND_FAILED` | 200* | Booking succeeded, SMS failed (* not an HTTP error) |
| `UNAUTHORIZED` | 401 | Missing or invalid session token |

---

### FINDING-10 · Minor · No Health Check Endpoint

**Location:** Section 9 (Deployment Architecture)

**Problem:**  
Docker Compose and cloud platforms (ECS, Cloud Run) require a health check endpoint to determine when the container is ready to serve traffic and to detect crashes. Without it, Docker will mark the container healthy as soon as the process starts — not when it has a database connection.

**Agreed Decision:** Add `GET /health` returning:

```json
{
  "status": "ok",
  "db": "connected",
  "uptime": 3721
}
```

Returns HTTP 200 when DB is reachable, HTTP 503 otherwise. This endpoint is unauthenticated and excluded from rate limiting.

---

### FINDING-11 · Minor · CORS Policy Not Specified

**Location:** Section 9 (Deployment Architecture)

**Problem:**  
In development, the React frontend runs on port 3000 and the API on port 4000 — cross-origin requests. CORS must be explicitly configured on the Express server. If not specified, developers will either allow `*` (insecure) or spend time debugging blocked requests.

**Agreed Decision:** Configure `cors` middleware with:
- **Development:** `origin: http://localhost:3000`
- **Production:** `origin: <frontend domain from env var>`
- Credentials: `true` (required for httpOnly session cookies)

The allowed origin must come from an environment variable (`ALLOWED_ORIGIN`) — never hardcoded.

---

### FINDING-12 · Minor · No Structured Logging Strategy

**Location:** Section 11 (Security — "phone numbers must not be exposed in application logs")

**Problem:**  
The architecture mentions that phone numbers must be masked in logs (NFR-05) but provides no logging framework or structure. Without a defined approach, developers will use `console.log()` inconsistently, making it easy to accidentally log a `req.body` containing the raw phone number.

**Agreed Decision:** Adopt `pino` (structured JSON logger) as the logging library. Define a `sanitize()` helper that masks phone numbers before any logging. All services log via a shared logger instance — `console.log` is prohibited in application code. Log levels: `error` (production), `info` (staging), `debug` (development).

---

## 3. Summary Table

| ID | Severity | Area | One-line Summary | Resolution |
|---|---|---|---|---|
| FINDING-01 | Critical | Data integrity | Race condition allows double-booking | Partial unique index + serialisable transaction |
| FINDING-02 | Critical | Security | No API authentication | Session-based auth; all routes protected |
| FINDING-03 | Critical | Security / Data | Encrypted phone breaks search | HMAC hash column for lookup |
| FINDING-04 | Critical | Reliability | SMS failure leaves appointment ambiguous | Decouple SMS from booking commit; warn UI |
| FINDING-05 | Major | Performance | Synchronous retries violate 3s SLA | Fire-and-forget first attempt; async retry job |
| FINDING-06 | Major | Performance | No index strategy | Four named indexes added to schema |
| FINDING-07 | Major | Maintainability | SMS template storage unspecified | `sms_templates` DB table with TTL cache |
| FINDING-08 | Major | UX / Data model | Reschedule creates confusing new IDs | Lookup returns latest CONFIRMED by default |
| FINDING-09 | Minor | API design | No error response schema | Standardised error shape + error code catalogue |
| FINDING-10 | Minor | Operability | No health check endpoint | `GET /health` with DB ping |
| FINDING-11 | Minor | Security | CORS policy unspecified | `cors` middleware with env-driven origin |
| FINDING-12 | Minor | Observability | No logging strategy | `pino` logger; `sanitize()` helper; no console.log |

**4 Critical · 4 Major · 4 Minor**  
All 4 Critical findings must be resolved before any production code is written.  
All 4 Major findings must be resolved before the first deployable build.  
Minor findings to be addressed before v1 ship.

---

## 4. Agreed Architecture Changes

The following changes have been incorporated into architecture.md:

| Change | Section Updated |
|---|---|
| Added `patient_phone_hash` column and HMAC lookup strategy | §7 Database Schema |
| Added `sms_templates` table | §7 Database Schema |
| Added 4 named indexes to schema | §7 Database Schema |
| Added `UX_appt_slot` partial unique constraint | §7 Database Schema |
| Added authentication to API surface (`POST /api/auth/login`) | §8 REST API Design |
| Added `GET /health` endpoint | §8 REST API Design |
| Added error code catalogue | §8 REST API Design |
| Updated NotificationService description (fire-and-forget + background retry) | §4 Component Responsibilities |
| Updated ADR-03 to reflect fire-and-forget + async retry strategy | §10 ADRs |
| Added ADR-06: Session auth | §10 ADRs |
| Added ADR-07: HMAC hash for phone lookup | §10 ADRs |
| Added `pino` to technology stack | §5 Technology Stack |
| Added `CORS_ORIGIN` to environment variables | §9 Deployment |

---

## 5. Items Not Changed (Accepted as-is)

| Topic | Rationale |
|---|---|
| Monolith architecture (ADR-01) | Correct for the scale. Accepted. |
| PostgreSQL as primary DB (ADR-02) | Best fit for transactional slot booking. Accepted. |
| Prisma ORM (ADR-04) | Type-safety benefit is real. Accepted. |
| Seeded catalogue (ADR-05) | Right call for v1 scope. Accepted. |
| Docker Compose for development | Appropriate for capstone. Accepted. |
| Twilio as SMS gateway | Simple API, DLT support. Accepted. |
