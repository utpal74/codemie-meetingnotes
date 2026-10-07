# Enhancements & Feature Gaps

**Last updated:** 2026-10-07  
**Applies to:** Doctor Appointment Booking System (phone-based receptionist workflow)

This document consolidates **feature gaps / enhancement opportunities** discovered by reviewing:
- `README.md`
- `artifacts/requirements.md`
- `CHANGELOG.md`
- `docs/input/user-story.txt` (initial user story intake)
- High-level repo structure (`backend/`, `frontend/`, `docs/templates/`)

It is intended to be a living backlog to support future user stories.

---

## 1) Current Functionality (Baseline)

### Actors
- **Patient** (calls clinic; no account)
- **Receptionist / Agent** (logs into web app; manages appointments)
- **System** (web UI + API + DB + SMS provider)

### Core workflows (v1)
- **Login** as receptionist (single account).
- **Book appointment**: pick department → pick doctor (optional) → pick date → pick slot (optional; otherwise system picks).
- **Lookup appointment**: by appointment ID or phone number.
- **Cancel appointment**: mark `CANCELLED`, free slot.
- **Reschedule appointment**: create new appointment, link to original, free old slot.
- **SMS notification** after booking/cancel/reschedule via Twilio with retry job + SMS logs.

### Non-functional baseline
- Performance targets: booking < 3s, slot lookup < 1s.
- Security: phone encryption at rest; masked logs; session auth.

---

## 2) Incoming Feature Requests / Enhancement Signals Found in Repo

### 2.1 Explicit “Known Limitations (v1)” (from `CHANGELOG.md`)
These are already identified gaps for a v2+ roadmap:
- Patient-facing self-booking portal (web/mobile)
- Payment / insurance integration
- Medical record integration
- Multi-receptionist / multi-user auth (beyond a single receptionist account)
- IVR / voice bot integration

### 2.2 Requirement-driven “deferred/unspecified implementation”
- **NFR-07 doctor/department configurability**: requirement says configurable without code change; verify there is an admin UI or config mechanism (docs don’t mention one).
- **SMS templates editable without code change**: requirement explicitly calls for editability; confirm whether there is an admin screen or DB CRUD for templates (docs mention templates table/cache but no UI).

### 2.3 Repo naming / positioning mismatch
- Repo name is `codemie-meetingnotes`, but the product is a doctor appointment booking system. This is a documentation/discoverability gap (recommend rename or explain rationale in README).

---

## 3) High-Value Feature Gaps (Candidate Enhancements)

### 3.1 Multi-user receptionist accounts + roles
**Problem:** v1 appears to support a single receptionist login.

**Enhancement:**
- Create multiple receptionist users.
- Role-based access (e.g., Receptionist, Supervisor/Admin).
- Audit fields: createdBy/updatedBy on appointments.

**Why:** supports NFR scalability (10 receptionists) more realistically and improves traceability.

### 3.2 Admin configuration UI (doctors/departments/SMS templates)
**Problem:** requirements demand configurability “without code change” but README focuses on seeded data.

**Enhancement:**
- Admin screens + API endpoints to manage:
  - Departments
  - Doctors (active/inactive, working days/hours)
  - SMS templates (per event type)

### 3.3 Slot rules & clinic calendar exceptions
**Problem:** slot rules are fixed (Mon–Sat only, fixed hours). Real clinics have holidays and doctor-specific availability.

**Enhancement:**
- Holiday/closure calendar.
- Doctor leave / per-doctor working hours.
- Support timezone explicitly (IST) in UI and API.

### 3.4 Patient history + duplicate detection
**Problem:** receptionist only searches by phone/ID; no consolidated patient history view.

**Enhancement:**
- Patient profile keyed by phone hash.
- Timeline: previous appointments and statuses.

### 3.5 Notifications beyond SMS + delivery visibility
**Problem:** SMS retries exist, but receptionist needs clear visibility and optional alternatives.

**Enhancement:**
- Resend SMS button.
- Delivery status refresh/poll.
- Optional channels (WhatsApp/email) as future, but at least improve visibility.

### 3.6 Operational controls & observability
**Problem:** production support needs better admin/ops tooling.

**Enhancement:**
- Dashboard for failed SMS, retry counts, recent errors.
- Exportable logs or admin report for daily appointments.
- Rate limit tuning + per-route metrics.

### 3.7 Data retention & compliance controls
**Problem:** compliance mentioned, but operational controls are not documented.

**Enhancement:**
- Data retention policy (e.g., delete/anonymize after X months).
- DSAR workflows: export/delete patient data by phone.
- Consent logging for SMS notifications.

---

## 4) Open Questions / Assumptions to Validate

1. Is the repo name intentionally generic (`codemie-meetingnotes`) for a broader capstone template, or should it be renamed to match the product?
2. Does the current implementation already satisfy NFR-07 (config without code change) via DB/admin endpoints, or is it only seeded?
3. Is “10 concurrent receptionists” meant to be:
   - 10 sessions sharing one account, or
   - 10 unique user accounts?
4. Should reschedule create a new appointment ID (current requirement says yes) or update the existing appointment (common alternative)?

---

## 5) Candidate User Story Inputs (ready-to-draft)

### Story A — Multi-receptionist accounts
- **Current behavior:** Single receptionist login; no per-user attribution.
- **Proposed enhancement:** Support multiple receptionist users with role-based access and audit fields.
- **Assumptions:** Clinic wants traceability per booking/cancel/reschedule; password reset handled by admin.

### Story B — Admin manage doctors/departments/SMS templates
- **Current behavior:** Departments/doctors are seeded; templates exist but edit path is unclear.
- **Proposed enhancement:** Admin UI/API to CRUD departments/doctors/templates without code changes.
- **Assumptions:** Only supervisors/admins can modify catalog/templates; changes apply immediately.

### Story C — Clinic holidays & doctor availability
- **Current behavior:** Fixed Mon–Sat scheduling and fixed slot window.
- **Proposed enhancement:** Configurable closures and doctor-specific schedules/leave.
- **Assumptions:** Slots should be generated from rules, not hard-coded.
