# Doctor Appointment Booking System — Requirements

**Version:** 1.0  
**Date:** 2026-09-23  
**Status:** Approved  

---

## 1. Overview

A phone-based appointment booking system that allows patients to call in, provide their details, and get a confirmed appointment with a doctor. An SMS notification is sent to the patient after booking. Patients can also cancel or reschedule via phone.

---

## 2. Actors

| Actor | Description |
|---|---|
| Patient | Person calling to book, cancel, or reschedule an appointment |
| Receptionist / Agent | Staff member who receives the call and uses the system to manage appointments |
| System | The appointment booking application |

---

## 3. Functional Requirements

### FR-01 — Receive Incoming Call & Collect Patient Details
- The receptionist receives the patient's phone call.
- The system provides a form/screen to capture:
  - Patient full name (mandatory)
  - Patient phone number (mandatory, 10-digit Indian mobile number)
  - Preferred department or doctor name (mandatory)
- No patient registration or login is required.

### FR-02 — Department and Doctor Catalogue

The system supports the following departments and doctors:

| Department | Doctor |
|---|---|
| Cardiology | Dr. Arjun Mehta, Dr. Nisha Kapoor |
| General Medicine | Dr. Priya Sharma, Dr. Suresh Iyer |
| Bone Health (Orthopaedics) | Dr. Rajesh Patel, Dr. Ananya Bose |

- The receptionist selects the department from a dropdown.
- If the patient requests a specific doctor, the receptionist selects that doctor.
- If no specific doctor is requested, the system randomly assigns an available doctor from the chosen department.

### FR-03 — Appointment Slot Assignment
- Available slot window: **10:00 AM to 7:00 PM**, Monday to Saturday.
- Slot duration: **30 minutes**.
- Available slots per doctor per day: 10:00, 10:30, 11:00 … 18:30 (18 slots).
- The system randomly assigns a free slot from the available slots for the chosen doctor on the chosen date.
- The receptionist can override and manually pick a slot if the patient requests a specific time.
- A slot already booked cannot be double-booked.

### FR-04 — Appointment Confirmation
- On confirmation, the system creates an appointment record with:
  - Appointment ID (auto-generated, unique)
  - Patient name
  - Patient phone number
  - Department
  - Doctor name
  - Appointment date and time slot
  - Booking timestamp
  - Status: `CONFIRMED`
- The system displays the confirmed appointment details to the receptionist.

### FR-05 — SMS Notification on Booking
- After confirmation, the system automatically sends an SMS to the patient's phone number.
- SMS content:

  ```
  Dear [Patient Name], your appointment is confirmed.
  Doctor: [Doctor Name] | Dept: [Department]
  Date & Time: [DD-MM-YYYY] at [HH:MM AM/PM]
  Appointment ID: [ID]
  To cancel or reschedule, please call us.
  - HealthCare Clinic
  ```

- SMS delivery is triggered immediately after booking confirmation.
- Provider: SMS gateway (e.g., Twilio / AWS SNS — to be finalised during implementation).

### FR-06 — Appointment Cancellation
- A patient may call to cancel an appointment.
- The receptionist looks up the appointment by Appointment ID or patient phone number.
- The receptionist marks the appointment as `CANCELLED`.
- The system releases the slot back to the available pool.
- An SMS is sent to the patient confirming cancellation:

  ```
  Dear [Patient Name], your appointment (ID: [ID]) on [DD-MM-YYYY] at [HH:MM AM/PM]
  with [Doctor Name] has been cancelled.
  - HealthCare Clinic
  ```

### FR-07 — Appointment Rescheduling
- A patient may call to reschedule an existing appointment.
- The receptionist looks up the appointment by Appointment ID or patient phone number.
- The system assigns a new random available slot (or the receptionist selects one).
- The old slot is released; a new appointment record is created with status `CONFIRMED`.
- An SMS is sent to the patient with the updated appointment details:

  ```
  Dear [Patient Name], your appointment has been rescheduled.
  Doctor: [Doctor Name] | Dept: [Department]
  New Date & Time: [DD-MM-YYYY] at [HH:MM AM/PM]
  New Appointment ID: [ID]
  - HealthCare Clinic
  ```

### FR-08 — Appointment Lookup
- The receptionist can search for an appointment by:
  - Appointment ID
  - Patient phone number
- The system displays the appointment details and current status.

---

## 4. Non-Functional Requirements

### NFR-01 — Performance
- Appointment booking (form submission to SMS trigger) must complete within **3 seconds** under normal load.
- Slot availability lookup must respond within **1 second**.

### NFR-02 — Availability
- The system must be available during clinic operating hours: **Monday to Saturday, 9:00 AM to 8:00 PM IST**.
- Target uptime: **99.5%** during operating hours.

### NFR-03 — Reliability & SMS Delivery
- SMS notifications must be delivered within **60 seconds** of booking confirmation.
- Failed SMS attempts must be retried at least **3 times** before marking as failed.
- Failed SMS deliveries must be logged and flagged to the receptionist.

### NFR-04 — Usability
- The receptionist-facing UI must be simple enough to use without training — core booking flow must complete in **under 2 minutes**.
- All mandatory fields must be clearly indicated.
- Confirmation and error messages must be human-readable.

### NFR-05 — Data Security
- Patient data (name, phone number) must be stored in an encrypted database (AES-256 at rest).
- Phone numbers must not be exposed in application logs.
- All API communication must use HTTPS/TLS 1.2+.

### NFR-06 — Scalability
- The system must support at least **10 concurrent receptionist sessions** without performance degradation.
- The appointment data store must handle a minimum of **500 appointments per day**.

### NFR-07 — Maintainability
- Doctor and department data must be configurable without a code change (e.g., via a config file or admin screen).
- SMS templates must be configurable without a code change.

### NFR-08 — Compliance
- Patient data handling must comply with applicable healthcare data privacy regulations (e.g., India's **Digital Personal Data Protection Act, 2023**).
- Patient data must not be shared with third parties other than the SMS gateway (and only the phone number is shared for delivery).

---

## 5. Out of Scope (v1)

The following are explicitly **not** in scope for version 1:

- Online / web or mobile self-booking by the patient
- Payment or insurance processing
- Doctor notes, prescriptions, or medical records
- Multi-location or multi-branch support
- In-person check-in or queue management
- WhatsApp, email, or push notification channels
- Doctor-facing portal or calendar
- Automated IVR / voice bot (call is handled by a human receptionist)

---

## 6. Assumptions

1. The clinic operates Monday–Saturday, 10 AM–7 PM for appointments.
2. Each appointment slot is 30 minutes.
3. All patients have an Indian mobile number capable of receiving SMS.
4. The receptionist uses a web browser to access the system.
5. A single receptionist desk is in scope for v1 (multi-desk is a future enhancement).
6. Date of appointment defaults to **today** unless the patient specifies otherwise; the receptionist can change it.

---

## 7. Glossary

| Term | Definition |
|---|---|
| Slot | A 30-minute time window available for a single appointment |
| Appointment ID | System-generated unique identifier for each appointment |
| Agent / Receptionist | Clinic staff who manages the booking system on behalf of the patient |
| SMS Gateway | Third-party service used to deliver text messages (e.g., Twilio, AWS SNS) |
