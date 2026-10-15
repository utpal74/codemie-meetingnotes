# Enhancement Backlog
| ID | Gap | Evidence | Related story | Priority (High/Med/Low) | Status (Open/Done) |
|---|---|---|---|---|---|
| G-01 | Define and document the standard error codes for appointment concurrency/double-booking conflicts (e.g., slot already booked) to ensure consistent API responses across book/reschedule flows. | Error code list in `backend/src/helpers/errors.js` (needs verification for booking conflict codes); AC requires HTTP 409 + standard error envelope. | EPMCDMETST-69392 | Med | Open |
| G-02 | Define and document how “SMS send failure is shown to the Receptionist” in the UI (banner/table/listing and where it is visible) so QA can validate the behavior end-to-end. | FR/NFR mention surfacing failures; specific UI behavior not described in `README.md` / `artifacts/requirements.md`. | EPMCDMETST-69392 | Med | Open |
