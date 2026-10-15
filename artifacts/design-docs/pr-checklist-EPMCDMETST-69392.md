# PR Checklist — EPMCDMETST-69392

## Scope & Requirements
- [ ] PR title contains `EPMCDMETST-69392`
- [ ] Jira acceptance criteria AC-1..AC-9 are covered in the tech design traceability table
- [ ] No out-of-scope features (patient self-booking, payments, doctor portal) were added

## Backend
- [ ] All appointment routes are protected by session auth (`authenticate`) and unauth returns `{ error: { code: "UNAUTHORIZED" } }` with HTTP 401
- [ ] Booking supports `doctorId` optional (random doctor by department) and `slotTime` optional (random available slot)
- [ ] Booking/reschedule validate:
  - [ ] date is not Sunday
  - [ ] slot is within 10:00–18:30 30-min increments
  - [ ] patient phone is a valid 10-digit Indian mobile number
- [ ] Concurrency: double-booking for same doctor/date/slot results in HTTP 409 with standard envelope
- [ ] SMS templates are loaded from DB and no hard-coded message strings were introduced
- [ ] SMS persistent failure (>=3 attempts) is queryable and exposed to the UI

## Frontend
- [ ] Booking UI supports “Any doctor” and “Any available slot” without breaking existing manual selection
- [ ] Receptionist can search by phone or appointment ID and view status
- [ ] Cancel and reschedule actions show success state and SMS status banner
- [ ] UI clearly surfaces “SMS failed after retries—contact patient manually”

## Tests
- [ ] New/updated integration tests added for booking, lookup, cancel, reschedule, auth guard, and concurrency
- [ ] Test commands documented in PR description and pass locally:
  - [ ] `npm run test:integration`
  - [ ] `npm run test:e2e` (if added)

## Docs
- [ ] `artifacts/design-docs/tech-design-EPMCDMETST-69392.md` exists and matches what was implemented
- [ ] `artifacts/design-docs/pr-checklist-EPMCDMETST-69392.md` exists
- [ ] `docs/design.md` links to the new tech design
