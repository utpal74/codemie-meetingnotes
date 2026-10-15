# Test Execution Report - EPMCDMETST-69392

Receptionist manages appointments + patient SMS notifications
Branch: `feature/EPMCDMETST-69392-meetingnotes` (base commit 9685195) - Date: 2026-10-15

## 1. Summary

| Layer | Written | Executed here | Result |
|---|---|---|---|
| Backend unit (Jest) | 2 new suites (39 tests) + 5 existing suites (70 tests) | Yes | 109 / 109 passed, 7 / 7 suites |
| Backend integration (Jest + Supertest) | 3 new files (41 test definitions) plus 3 earlier dev files and existing files | NO | Not run - no PostgreSQL available |
| Playwright UI specs | 3 specs (33 test definitions, 1 fixme) | NO | Not run - Playwright not installed, install not permitted |
| BDD Gherkin features | 4 files, 50 scenarios | n/a | Specification only, no step definitions or runner |

No integration or UI test result is claimed. Only the unit run below was executed.

## 2. What was executed

Command (temporary jest config with globalSetup and globalTeardown removed, because they need Docker + Postgres; the config file was deleted afterwards and is not committed):

    cd backend
    npx jest --config <temp config> --runInBand --forceExit      # testMatch: __tests__/unit/**

Result: Test Suites: 7 passed, 7 total. Tests: 109 passed, 109 total.

| Suite | Tests | Status | New |
|---|---|---|---|
| AppointmentService.assignment.test.js | 28 | passed | yes |
| NotificationService.status.test.js | 11 | passed | yes |
| schemas.test.js | 19 | passed | extended earlier by dev |
| SlotService.test.js | 15 | passed | no |
| crypto.test.js | 10 | passed | no |
| smsFormat.test.js | 14 | passed | no |
| sanitize.test.js | 12 | passed | no |

The two new suites mock Prisma and DoctorService (no database) and exercise the real AppointmentService and NotificationService code: random doctor pick restricted to doctors free at the slot, random slot pick (including Math.random extremes), NO_DOCTOR_AVAILABLE / NO_SLOTS_AVAILABLE / DOCTOR_NOT_FOUND, the 3-attempt race retry, P2034 to 409 mapping, reschedule linking and ordering, cancel state rules, and the failedAfterRetries boundary (FAILED with 1/2/3/4 attempts, SENT, PENDING).

Additional static checks: node --check passed on the 3 new integration files; jest --listTests discovers all of them; node --check (syntax only) parsed all Playwright .ts files. Syntax checks do not prove the tests pass.

## 3. What was NOT executed and why

1. Backend integration tests (everything under backend/__tests__/integration, including the 3 new files and the developer-written appointments.booking.random, auth.guard.appointments, sms.failure-surfacing): Postgres is not running and there is no DB container. globalSetup requires container doc-appointment-booking-db-1. To run: start the db container, then `cd backend && npm run test:integration`.
2. Playwright specs: @playwright/test is not installed; the install command was denied in this session. The specs live in an isolated package (frontend/e2e/package.json) so the main frontend package.json and lockfile are untouched. To run: `cd frontend/e2e && npm install && npx playwright install chromium && npm run test:e2e` (or set PW_CHANNEL=msedge). The specs stub all /api calls with page.route(), so no backend is needed; they prove UI behaviour against the documented contract, not real backend integration. The page.clock usage (SMS polling) needs Playwright 1.45+ and is unverified at runtime.
3. Gherkin features have no cucumber runner; they document intent and tag each scenario (@AC-n, @unit, @backend-integration, @ui, @gap).

## 4. Traceability (AC to tests)

| AC | Unit (run) | Integration (not run) | UI (not run) |
|---|---|---|---|
| AC-1 random doctor / slot | AppointmentService.assignment, schemas | appointments.booking.random (dev); appointments.errors (NO_DOCTOR_AVAILABLE, NO_SLOTS_AVAILABLE, DOCTOR_NOT_FOUND); appointments.concurrency (any-slot, no duplicates) | booking-random.spec |
| AC-2 Mon-Sat, 10:00-18:30, no Sundays | SlotService, schemas, assignment (grid rejection) | appointments.errors (Sunday on 4 endpoints, boundaries, off-grid, past date) | booking-random (Sunday warning) |
| AC-3 CONFIRMED + unique id + details | assignment | appointments.test (existing); booking.random | booking-random (confirmation panel) |
| AC-4 no double booking, 409 envelope | assignment (race, P2034) | appointments.concurrency (6 parallel bookings, parallel reschedules); appointments.test (sequential) | booking-random (409 display) |
| AC-5 lookup by id / phone | - | appointments.test (existing); appointments.reschedule.sms (history, phone not leaked); appointments.errors (MISSING_PARAMS) | manage-appointment (Lookup) |
| AC-6 cancel + slot release + SMS | assignment (cancel rules) | appointments.test; appointments.reschedule.sms (CANCELLATION log) | manage-appointment (Cancel) |
| AC-7 reschedule linked + SMS | assignment (link, ordering) | appointments.reschedule.sms (link, chain, RESCHEDULING log, no SMS on failure); concurrency (parallel reschedule) | manage-appointment (Reschedule) |
| AC-8 401 envelope | - | auth.guard.appointments (dev) | - |
| AC-9 SMS failed after >= 3 retries surfaced | NotificationService.status | sms.failure-surfacing (dev); appointments.reschedule.sms (status endpoint) | sms-banner.spec; manage-appointment (cancel + failure) |

## 5. Findings and gaps

1. UI gap (Playwright test.fixme): ticking Any doctor without Any available slot leaves the slot select disabled (slots are only fetched for a chosen doctor) but the form still posts slotTime as an empty string, so the API answers 422 "Slot time must be in HH:MM format". The backend supports department + slot without doctor; the UI cannot express it. Suggest auto-ticking Any available slot or omitting an empty slotTime.
2. Behaviour gap: rescheduleAppointment does not check the original status, so a CANCELLED appointment can be rescheduled into a new CONFIRMED one. Recorded as test.todo and a @gap scenario; no assertion was written because the intended behaviour is not specified.
3. Slot-grid violations on booking (for example 19:00) return code INVALID_DATE on field appointmentDate with a weekday message; the accurate field would be slotTime. Tests assert only 422 and a code in {INVALID_DATE, VALIDATION_ERROR}.
4. Sunday and past-date checks use UTC day-of-week (open question 1 in the tech design); no timezone test was written.
5. Concurrency tests assert invariants (exactly one 201 for the contested slot, no 5xx, no duplicate rows). Under Serializable isolation unrelated bookings may also see 409, so those tests allow 201 or 409 but never 5xx.
6. Integration tests are unverified until run against Postgres; first-run failures are possible. With Twilio unset the booking smsStatus is DISABLED, which the tests accept.
7. Integration files delete all appointments in beforeEach, so they must run --runInBand (already the npm script).

## 6. Files

- Backend: backend/__tests__/integration/appointments.concurrency.test.js, appointments.errors.test.js, appointments.reschedule.sms.test.js; backend/__tests__/unit/AppointmentService.assignment.test.js, NotificationService.status.test.js.
- UI: frontend/e2e/package.json, playwright.config.ts, README.md, .gitignore; frontend/e2e/support/mockApi.ts, bookingForm.ts; frontend/e2e/tests/booking-random.spec.ts, manage-appointment.spec.ts, sms-banner.spec.ts.
- BDD: tests/features/appointment-booking.feature, appointment-validation-and-concurrency.feature, appointment-management.feature, sms-notifications-and-access.feature.
- Payloads (not posted): artifacts/test-reports/jira-comment-EPMCDMETST-69392.json, artifacts/test-reports/confluence-page-EPMCDMETST-69392.json.
