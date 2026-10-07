# Code Review — Doctor Appointment Booking System

**Reviewer:** Peer / Senior Engineer  
**Review Date:** 2026-09-23  
**Commit under review:** `100a8e3` (full implementation)  
**Method:** 7 independent finder angles (correctness, security, cross-file, DRY, error-handling, frontend, dependency) → dedup → 1-vote verify  
**Findings:** 10 confirmed · 4 fixed immediately · 6 accepted risks documented

---

## 1. Checklist Summary

| Area | Rating | Notes |
|---|---|---|
| **Correctness** | ⚠️ Needs fixes | 3 confirmed bugs break core flows (reschedule broken, retry infinite, double-book possible in prod) |
| **Security** | ⚠️ Needs fixes | Hardcoded fallback session secret; internal errors leaked to client |
| **Error Handling** | ⚠️ Needs fixes | `smsLog.create` throw rolls back visible booking; `decryptPhone` throw unguarded |
| **Test Coverage** | ❌ Not present | No automated tests (unit or integration). Manual smoke tests only. Deferred to post-MVP. |
| **Code Clarity** | ✅ Acceptable | Function names are self-explanatory; services are small and focused |
| **DRY Principle** | ⚠️ Advisory | `formatDate`, `formatTime`, `interpolate` copy-pasted between NotificationService and smsRetryJob |
| **Dependency Safety** | ⚠️ Advisory | `express ^4.21.1` covers known CVEs; no further vulnerabilities identified |

---

## 2. Confirmed Findings (ranked by severity)

---

### CR-01 · Critical · Correctness
**`frontend/src/components/CancelReschedule.jsx:32`**  
**Reschedule slot-fetch always sends `doctorId=undefined` — reschedule is completely broken**

`toPublic()` in [backend/src/routes/appointments.js](backend/src/routes/appointments.js) serialises `doctor` as a name string and omits the raw `doctorId` UUID. `CancelReschedule` accesses `appointment.doctorId`, which is always `undefined`. The GET `/api/slots?doctorId=&date=...` returns an empty slot list, the select stays permanently disabled, and no reschedule is possible.

**Fix applied:** Add `doctorId: appt.doctor?.id` to `toPublic()`.

---

### CR-02 · Critical · Correctness
**`backend/src/jobs/smsRetryJob.js:53` + `backend/src/services/NotificationService.js:63,70`**  
**`attemptCount` oscillates between 1 and 2 — retry job never terminates for failed SMS**

The retry job increments `attemptCount` via `{ increment: 1 }` (line 53), then `dispatchSms` unconditionally overwrites it with the absolute value `{ attemptCount: 1 }` on all paths (SENT and FAILED). After each cron tick: job sets count to 2, dispatchSms resets it to 1. The `lt: 3` guard is never exhausted — an invalid phone number is retried indefinitely, generating unbounded Twilio API calls.

**Fix applied:** Remove the pre-increment from the retry job; let `dispatchSms` increment from the current value using `{ increment: 1 }` instead of an absolute assignment.

---

### CR-03 · Critical · Correctness
**`backend/prisma/seed.js:39-43`**  
**`UX_appt_slot` partial unique index created in seed, not migration — absent in every production deploy**

The double-booking guard (the `CREATE UNIQUE INDEX ... WHERE status='CONFIRMED'` constraint from design-review FINDING-01) lives inside `prisma db seed` via `$executeRaw`. A standard production deploy runs only `prisma migrate deploy`. The migration SQL contains no `UX_appt_slot` entry. In production, two concurrent POST `/appointments` requests for the same doctor/date/slot can both commit successfully, creating a double-booking.

**Fix applied:** Move the `$executeRaw` index creation into a new dedicated Prisma migration. Remove it from seed.js.

---

### CR-04 · High · Error Handling
**`backend/src/services/NotificationService.js:96`**  
**`prisma.smsLog.create()` failure throws a 500 on a successfully-committed booking**

`send()` calls `prisma.smsLog.create()` with no surrounding try/catch. If the DB write fails (connection hiccup, constraint), the exception propagates through `sendBookingSms` and into the route handler's `catch(err) { next(err) }` block, returning a 500. The appointment is already committed, but the client believes the booking failed and may retry — potentially hitting `SLOT_UNAVAILABLE` on the retry, with no way to recover gracefully.

**Fix applied:** Wrap `smsLog.create` and the entire `send()` body in try/catch; on failure, log and return `'FAILED'` rather than throwing.

---

### CR-05 · High · Correctness
**`backend/prisma/seed.js:54-61`**  
**First doctor-seeding loop always inserts duplicates on re-seed**

The first loop calls `prisma.doctor.upsert` with a synthetic `where.id` constructed by string slicing (`dept.name.slice(0,4)` + `doctorName.slice(-4)` padded to 36 chars). This never matches any real UUID, so Prisma always hits the `create` branch. On every re-seed (`prisma migrate reset --force && prisma db seed`), 6 new duplicate doctor rows are created. The second loop's `findFirst` guard only prevents *its own* duplicates, not the first loop's. The `Doctor` table also has no `UNIQUE(name, departmentId)` constraint to block this at the DB level.

**Fix applied:** Remove the broken first loop entirely; the second loop (upsert by name + department) is correct and sufficient.

---

### CR-06 · High · Security
**`backend/src/app.js:29`**  
**Hardcoded fallback session secret `'dev-secret-change-in-production'`**

`express-session` is configured as `secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production'`. If `SESSION_SECRET` is absent in any deployed environment, sessions are signed with a publicly-known string visible in source code. An attacker can forge valid session cookies and authenticate as the receptionist without knowing the password.

**Fix applied:** Throw a startup error if `SESSION_SECRET` is not set and `NODE_ENV` is not `'development'`; remove the fallback in production paths.

---

### CR-07 · High · Security
**`backend/src/app.js:65`**  
**Global error handler forwards raw `err.message` — leaks Prisma schema and crypto config details**

The error handler sends `message: err.message` verbatim in the JSON response. Prisma errors include table and column names (`The column 'Appointment.doctorId' does not exist`); the crypto helper throws `'PHONE_ENCRYPTION_KEY must be a 64-character hex string'`; `express-session` errors expose session store details. These messages reach any API consumer, aiding reconnaissance.

**Fix applied:** Distinguish domain errors (those with `.status < 500` set by the application) from unexpected errors; for 500s, return a generic `'An unexpected error occurred'` message and log the real error server-side only.

---

### CR-08 · Medium · Correctness
**`backend/src/services/NotificationService.js:58`**  
**`+91` country code unconditionally prepended — corrupts numbers that already contain it**

`to: \`+91${phone}\`` is always applied after `decryptPhone`. The Zod schema accepts a 10-digit number without a country code prefix, which is correct for Indian mobile numbers. However, there is no validation that the stored encrypted value is exactly 10 digits. If data entry allowed `91XXXXXXXXXX` or `+91XXXXXXXXXX`, the stored (and later decrypted) value would produce `+9191XXXXXXXXXX` — an invalid E.164 number that Twilio silently rejects.

**Fix applied:** Strip any leading `+91` or `91` prefix before prepending `+91`.

---

### CR-09 · Medium · Correctness
**`backend/src/services/AppointmentService.js:83`**  
**`cancelAppointment` allows cancelling already-rescheduled appointments**

The guard on line 84 only rejects `status === 'CANCELLED'`. A `RESCHEDULED` appointment (status set when the patient reschedules) can be cancelled, leaving the appointment chain corrupted: the old appointment is now `CANCELLED` but the new appointment still has `previousAppointmentId` pointing to it, and any "show history" query will show a broken chain.

**Fix applied:** Extend the guard to reject cancellation of `RESCHEDULED` appointments as well.

---

### CR-10 · Medium · DRY
**`backend/src/jobs/smsRetryJob.js:7-21`**  
**`interpolate`, `formatDate`, `formatTime` copy-pasted from `NotificationService.js`**

Three utility functions are verbatim copies across two files. If the date format or time rendering logic is patched (e.g. fixing 12-hour AM/PM for midnight), the fix must be applied to both files. A developer editing `NotificationService.js` has no signal to also update `smsRetryJob.js`.

**Fix applied:** Extract the three helpers to `backend/src/helpers/smsFormat.js` and import from both files.

---

## 3. Advisory Findings (no code change required)

| ID | Area | Summary | Decision |
|---|---|---|---|
| ADV-01 | Security | `server.js:15` — bcrypt hash of default password logged at WARN level. In log-shipping environments, the hash is visible to log readers. | **Accept for dev** — only fires when `RECEPTIONIST_PASSWORD_HASH` is unset (dev only). Log message updated to omit the hash value. |
| ADV-02 | Frontend | `BookingForm.jsx:55` — double-submit possible on slow networks before `loading` state re-renders. | **Accept** — low probability; 409 SLOT_UNAVAILABLE on second attempt prevents data corruption. |
| ADV-03 | Frontend | `BookingForm.jsx:40` — no `AbortController` on slots fetch; rapid doctor/date changes can cause stale slot data. | **Accept** — low UX risk for a receptionist tool; add AbortController in a follow-up polish pass. |
| ADV-04 | Dependency | `express ^4.21.1` — caret range allows future minor/patch upgrades. 4.21.1 is the patched version for CVE-2024-43799 and CVE-2024-45590; no current vulnerability. | **Accept** — pin to exact version in a hardening pass. |

---

## 4. No-Test-Coverage Note

There are currently **no automated tests**. The smoke tests performed during implementation (16 curl assertions) validated the happy path and key error codes but do not cover:

- Concurrent booking race (requires two simultaneous requests)
- Crypto helper edge cases (corrupted ciphertext, wrong key length)
- SMS retry job termination logic
- Frontend form state after rapid department/doctor switches

**Recommendation:** Add integration tests for at least the booking, cancel, and reschedule flows before the PR is merged to `main`.
