# PR Checklist — EPMCDMETST-70758

## Scope & Requirements
- [ ] PR title starts with `EPMCDMETST-70758:` and matches the story intent (appointment lookup by ID/phone)
- [ ] AC-1..AC-5 are all mapped in the design traceability table and covered by tests
- [ ] No patient phone numbers are logged or returned in API payloads

## Backend
- [ ] Appointment lookup routes require authentication (verify `backend/src/app.js` mounts with `authenticate`)
- [ ] (If required) role guard is enforced for receptionist-only access and returns 403 for wrong role
- [ ] `GET /api/appointments?phone=` returns 422 `{error:{code:"MISSING_PARAMS",field:"phone"}}` when phone missing
- [ ] Phone format validation returns 422 `{error:{code:"INVALID_PHONE",field:"phone"}}`
- [ ] `includeHistory=true` returns reschedule chain / non-confirmed statuses as intended
- [ ] `GET /api/appointments/:id` returns 404 `APPOINTMENT_NOT_FOUND` when missing
- [ ] Responses use `{ appointmentId, patientName, doctor, department, appointmentDate, slotTime, status, previousAppointmentId }` and exclude `patientPhone` and `patientPhoneHash`

## Frontend
- [ ] Appointment Lookup page is reachable for receptionist users (route added in `frontend/src/App.jsx`)
- [ ] Search supports both modes: by ID and by phone
- [ ] includeHistory toggle is available for phone search
- [ ] Loading, empty, and error states are implemented

## Tests
- [ ] Integration tests added/updated and passing: `npm run test:integration`
- [ ] E2E tests added/updated and passing (if Playwright configured): `npx playwright test`
- [ ] Tests assert phone is not present in responses

## Docs
- [ ] `artifacts/design-docs/tech-design-EPMCDMETST-70758.md` updated if implementation deviates
- [ ] Confluence page `[EPMCDMETST-70758] Technical Design` reflects the latest design
