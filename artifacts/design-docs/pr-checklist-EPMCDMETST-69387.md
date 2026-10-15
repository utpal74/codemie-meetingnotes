# PR Checklist — EPMCDMETST-69387

## Scope & Requirements
- [ ] AC-1..AC-10 implemented and verified against Jira EPMCDMETST-69387
- [ ] Error envelope contract documented and consistent across endpoints
- [ ] SMS failure UX (AC-10) implemented with clear, non-blocking messaging
- [ ] No scope creep (queue/event-bus, self-service patient portal) introduced

## Backend
- [ ] DB migration includes `patientPhoneHash`, `smsStatus`, and required indexes
- [ ] Partial unique index `UX_appt_slot` prevents double booking
- [ ] Booking uses SERIALIZABLE transaction (or equivalent) and returns 409 on slot conflict
- [ ] Phone canonicalization + HMAC hashing used for all lookup queries
- [ ] Phone encryption used for storage/display; raw phone never logged
- [ ] SMS send is non-blocking; first attempt logged; retry worker runs with backoff and max attempts
- [ ] `/health` endpoint returns 200 only when DB reachable
- [ ] Auth middleware protects `/api/*` routes; allowlist limited to `/api/auth/login` and `/health`

## Frontend
- [ ] Booking flow supports phone-based lookup and booking
- [ ] Appointment details shows `smsStatus` and warning banner when not SENT (FAILED/PENDING_RETRY)
- [ ] Error handling uses backend error envelope codes (no string parsing)
- [ ] Loading/disabled states prevent double submits

## Tests
- [ ] Unit tests for phone helpers (mask/encrypt/hash) and error handler mapping
- [ ] Integration tests: lookup, slots, booking, reschedule, cancel
- [ ] Concurrency test: two parallel bookings for same slot => one succeeds, one 409
- [ ] Retry worker test: FAILED -> SENT and attempts exhausted -> FAILED

## Docs
- [ ] Tech design updated: `artifacts/design-docs/tech-design-EPMCDMETST-69387.md`
- [ ] Enhancement backlog updated if any follow-ups identified
- [ ] README/architecture links updated if API contracts changed
