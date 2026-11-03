# PR Checklist — EPMCDMETST-70806

## Scope & Requirements
- [ ] PR title starts with `EPMCDMETST-70806:` and matches scope (“Receptionist can create an appointment booking”)
- [ ] All acceptance criteria (AC-1 … AC-6) are covered in code + tests or have explicit follow-up tickets
- [ ] Error envelope matches `{ error: { code, message, field } }` for all failure cases in scope

## Backend
- [ ] `POST /api/appointments` requires `authenticate` and `requireRole('RECEPTIONIST')`
- [ ] Validation accepts `patientMobile` (and remains backward compatible with `patientPhone` if needed)
- [ ] Invalid mobile returns `error.code = VALIDATION_ERROR` and `error.field = patientMobile`
- [ ] Double booking returns `409` with `error.code = SLOT_ALREADY_BOOKED`
- [ ] Prisma migration adds DB-level protection against double booking (unique partial index)
- [ ] NotificationService triggers booking SMS and failures do not fail the booking (logged + SmsLog updated)

## Frontend
- [ ] Booking form exists for Receptionist with: patient name, mobile, department, doctor, date, slot
- [ ] Slot list refreshes when doctor/date changes, and booked slot cannot be selected after conflict
- [ ] User-visible error messages render from server envelope and highlight the failing field

## Tests
- [ ] Jest/Supertest integration tests added/updated for booking success, validation error, unauthorized, and conflict
- [ ] Concurrency/double-booking scenario is covered (transaction/unique index behavior)
- [ ] (If E2E exists) Playwright test covers receptionist booking happy-path

## Docs
- [ ] `artifacts/design-docs/tech-design-EPMCDMETST-70806.md` is up to date with implementation
- [ ] Any new env vars are documented (none expected)
