# Tech Design — EPMCDMETST-68125

**Story**: EPMCDMETST-68125 — Admin UI to manage Departments and Doctors (create/edit/activate/deactivate)

**Repo/Branch**: `utpal74/codemie-meetingnotes` — `feature/EPMCDMETST-68125-meetingnotes`

---

## 1. Goals / Non‑Goals

### Goals
- Add **Admin-only** configuration capability for:
  - **Departments**: create, edit (name), activate/deactivate
  - **Doctors**: create, edit (name, department), activate/deactivate
- Persist departments/doctors in **PostgreSQL** (via existing Prisma).
- Enforce constraints:
  - Department **name must be unique** (case-insensitive; see DB design).
  - Doctor must have **name** and **exactly one department**.
- Booking flow must:
  - Prevent using **inactive doctors or inactive departments** for **new bookings**.
  - Keep **historical appointments unchanged** (appointments referencing now-inactive entities still display).

### Non‑Goals
- Role management UI (creating admin users) — out of scope.
- Auditing/history tables for admin changes — out of scope (can be added later).
- Hard delete of departments/doctors — out of scope (we use soft disable via `is_active`).

---

## 2. Current Architecture & Patterns (repo inspection)

### Backend
- **Express 4** REST API under `backend/src`.
- **Prisma 5** to PostgreSQL; schema in `backend/prisma/schema.prisma`.
- **Zod** validation via `backend/src/middleware/validate.js` and `backend/src/schemas/*`.
- **Session-based auth** (`express-session`) with `authenticate` middleware.
- Current auth is a single “receptionist” identity (env-based) and `req.session.authenticated` boolean.

Existing domain models in Prisma already include `Department` and `Doctor` but **without** activation flags:
- `Department { id, name, doctors[] }` with `name @unique`
- `Doctor { id, name, departmentId, department }`

Routes already exist:
- `backend/src/routes/departments.js`
- `backend/src/routes/doctors.js`
- Booking/slots under `backend/src/routes/appointments.js`, `backend/src/routes/slots.js`

### Frontend
- **React 18 + Vite + React Router**.
- Tailwind CSS.
- Axios-based API calls.
- Existing receptionist flows (book/cancel/reschedule) already depend on department & doctor lists.

Implication: This story extends existing **Department/Doctor** modules instead of creating a parallel module.

---

## 3. High-Level Design (HLD)

### 3.1 Components

```text
Browser
  ├─ Receptionist UI
  │    └─ booking flow uses GET /api/departments + /api/doctors (active-only)
  └─ Admin UI
       └─ admin config pages use /api/admin/departments + /api/admin/doctors (includes inactive)

API (Express)
  ├─ Auth routes
  ├─ Public/Receptionist routes (existing)
  └─ Admin routes (new)
       ├─ Admin authz middleware (role guard)
       ├─ Departments CRUD + activation toggle
       └─ Doctors CRUD + activation toggle

DB (PostgreSQL via Prisma)
  ├─ Department (add isActive + timestamps)
  └─ Doctor (add isActive + timestamps)
```

### 3.2 AuthN/AuthZ approach

We keep existing **session authentication**, but introduce **roles** in-session:
- `req.session.user = { username, role }`
- Roles:
  - `RECEPTIONIST` — existing booking UI
  - `ADMIN` — config UI

Implementation impact:
- Update login endpoint to accept admin credentials OR create a new `/auth/admin/login`. For minimal disruption, we propose:
  - Extend `/api/auth/login` to authenticate either receptionist or admin.
  - Add env vars:
    - `ADMIN_USERNAME` (default `admin`)
    - `ADMIN_PASSWORD_HASH`

Add a new middleware:
- `requireRole('ADMIN')` used on all `/api/admin/*` endpoints.

If later the project introduces proper users table, this can be swapped without changing API contracts.

### 3.3 Booking flow behavior change

- For **new bookings** / slots lookup:
  - Only allow doctors where `doctor.isActive = true` AND `doctor.department.isActive = true`.
- For **historical appointments**:
  - When fetching appointment details, continue to join doctor/department even if inactive.
  - UI can optionally show a badge “Inactive” next to doctor/department.

---

## 4. Database Design (Prisma + PostgreSQL)

### 4.1 Schema changes

We add soft-disable flags and timestamps.

#### Department
- `isActive boolean default true`
- `createdAt timestamp default now()`
- `updatedAt timestamp @updatedAt`

Uniqueness:
- Requirement: unique department name.
- Prisma currently enforces `@unique name` which is **case-sensitive** in Postgres by default.

Decision:
- Enforce **case-insensitive uniqueness** using a computed unique index on `LOWER(name)`.
  - Prisma doesn’t support expression indexes directly in schema; we implement in a migration SQL step.
  - Additionally, application-level validation will normalize + check for duplicates.

#### Doctor
- `isActive boolean default true`
- `createdAt timestamp default now()`
- `updatedAt timestamp @updatedAt`

Relationship:
- `Doctor.departmentId` is required (already) → ensures exactly one department.

### 4.2 Prisma model (target)

```prisma
model Department {
  id        String   @id @default(uuid())
  name      String
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  doctors Doctor[]

  @@index([isActive])
}

model Doctor {
  id           String        @id @default(uuid())
  name         String
  departmentId String
  isActive     Boolean       @default(true)
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  department   Department    @relation(fields: [departmentId], references: [id])
  appointments Appointment[]

  @@index([departmentId])
  @@index([isActive])
}
```

### 4.3 Migration notes (SQL)

We keep current `name @unique` for backwards compatibility but add case-insensitive uniqueness.

Migration SQL (Postgres):

```sql
-- make sure no duplicates exist ignoring case before applying
CREATE UNIQUE INDEX IF NOT EXISTS "UX_department_name_lower" ON "Department" (LOWER(name));
```

If duplicates exist, migration must be preceded by a cleanup script (not expected due to seed data).

### 4.4 Referential integrity

- Doctors reference Department by FK; cannot point to non-existent department.
- Deactivating a department does **not** delete doctors; it just blocks usage in new bookings.
- Optionally, when deactivating a department, UI warns if there are active doctors; API can either:
  - allow deactivation anyway (doctors effectively unusable), or
  - require deactivating doctors first.

Decision (simpler): allow department deactivation without cascading, but booking filter checks both.

---

## 5. API Design (REST)

### 5.1 Route grouping

- Receptionist/public lists (existing):
  - `GET /api/departments` → active-only
  - `GET /api/doctors` → active-only (+ department active)

- Admin configuration (new):
  - `GET /api/admin/departments` → include inactive
  - `POST /api/admin/departments`
  - `PATCH /api/admin/departments/:id`
  - `PATCH /api/admin/departments/:id/status` (activate/deactivate)

  - `GET /api/admin/doctors` → include inactive
  - `POST /api/admin/doctors`
  - `PATCH /api/admin/doctors/:id`
  - `PATCH /api/admin/doctors/:id/status`

### 5.2 DTOs & validation (Zod)

#### Department DTOs
- Create:
  - `name: string` (trimmed, min 2, max 100)
- Update:
  - `name?: string` (same constraints)
- Status:
  - `isActive: boolean`

Uniqueness validation:
- On create/update, check case-insensitive uniqueness:
  - normalize: `normalized = name.trim()` and compare by `LOWER(name)` query.
  - If conflict: respond 409 with `DEPARTMENT_NAME_TAKEN`.

#### Doctor DTOs
- Create:
  - `name: string` (trimmed, min 2, max 100)
  - `departmentId: uuid string`
- Update:
  - `name?: string`
  - `departmentId?: uuid string`
- Status:
  - `isActive: boolean`

Validation rules:
- departmentId must exist (409/404). Prefer 404 `DEPARTMENT_NOT_FOUND`.
- If doctor is activated while department inactive, reject with 409 `DEPARTMENT_INACTIVE`.

### 5.3 Response shapes

Follow existing convention (observed across routes):
- success → JSON object or array
- failures → `{ error: { code, message, field } }`

Examples:

```json
{ "id": "...", "name": "Cardiology", "isActive": true }
```

```json
{ "error": { "code": "DEPARTMENT_NAME_TAKEN", "message": "Department name must be unique", "field": "name" } }
```

### 5.4 AuthZ middleware

Add `backend/src/middleware/requireRole.js`:

```js
function requireRole(role) {
  return (req, res, next) => {
    if (!req.session?.authenticated) return unauthorized(...);
    if (req.session.user?.role !== role) return forbidden(...);
    next();
  };
}
```

Admin routes will use:
- `authenticate` (existing) + `requireRole('ADMIN')`, or merge into one.

---

## 6. Frontend Design

### 6.1 Routes

Add admin route group under React Router:
- `/admin` (layout page)
- `/admin/departments`
- `/admin/doctors`

Guarding:
- Use `/api/auth/me` expanded to include role:
  - `{ authenticated: true, role: 'ADMIN' | 'RECEPTIONIST' }`
- Frontend `RequireAdmin` route wrapper redirects non-admin users.

### 6.2 Components

- `src/pages/admin/AdminHomePage.jsx` (links/cards to config sections)
- `src/pages/admin/DepartmentsPage.jsx`
  - table list, search
  - create modal
  - edit modal
  - toggle active
- `src/pages/admin/DoctorsPage.jsx`
  - table list (doctor name, department, status)
  - create/edit form (department dropdown)
  - toggle active

Shared UI pieces (reuse existing patterns):
- `Button`, `Modal`, `Toast` (if present), otherwise minimal local components.
- API client: reuse existing axios instance.

### 6.3 Wireframes (ASCII)

#### Admin Home

```text
+------------------------------------------------------+
| Header: Codemie Clinics            [Logout]          |
+------------------------------------------------------+
| Admin Configuration                                  |
|                                                      |
|  [ Manage Departments ]   [ Manage Doctors ]         |
|                                                      |
+------------------------------------------------------+
```

#### Manage Departments

```text
+------------------------------------------------------+
| Admin > Departments                   [ + New ]      |
+------------------------------------------------------+
| Search: [______________]                             |
|                                                      |
| Name                  Status      Actions            |
| ---------------------------------------------------  |
| Cardiology            Active      [Edit] [Deactivate] |
| Bone Health           Inactive    [Edit] [Activate]   |
|                                                      |
+------------------------------------------------------+

[New/Edit Modal]
+-----------------------------+
| Department name: [_______]  |
|                             |
|            [Cancel] [Save]  |
+-----------------------------+
```

#### Manage Doctors

```text
+------------------------------------------------------+
| Admin > Doctors                        [ + New ]     |
+------------------------------------------------------+
| Filters: Department [All v]  Status [All v]          |
| Search: [______________]                              |
|                                                      |
| Name              Department           Status Actions |
| ---------------------------------------------------- |
| Dr. Priya Sharma  General Medicine     Active [Edit]  |
| Dr. Rajesh Patel  Bone Health          Inactive[Act]  |
|                                                      |
+------------------------------------------------------+

[New/Edit Modal]
+---------------------------------------+
| Doctor name:      [______________]    |
| Department:       [Select v]          |
|                                       |
|                    [Cancel] [Save]    |
+---------------------------------------+
```

### 6.4 Booking flow UI change

Wherever receptionist chooses Department/Doctor:
- Department dropdown shows **active only**.
- Doctor dropdown shows active only and only for active departments.
- If an appointment detail page displays doctor/department, it should still show even if inactive.

---

## 7. Low-Level Design (LLD)

### 7.1 Backend files (proposed)

- `backend/prisma/schema.prisma`
  - Add `isActive`, `createdAt`, `updatedAt` fields to Department/Doctor.

- `backend/src/middleware/requireRole.js` (new)
  - role guard

- `backend/src/routes/admin/departments.js` (new)
- `backend/src/routes/admin/doctors.js` (new)
- `backend/src/routes/index.js`
  - mount `/api/admin/*`

- `backend/src/schemas/admin.js` or `backend/src/schemas/departments.js` additions
  - Zod schemas for create/update/status payloads

- Existing booking/list endpoints:
  - `backend/src/routes/departments.js` → change to `where: { isActive: true }`
  - `backend/src/routes/doctors.js` → filter doctor.isActive and department.isActive
  - Any slot computation that queries doctors must ensure the same filters.

### 7.2 Service layer changes

If services exist (they do: `DoctorService.js`, `SlotService.js`):
- Add helper in `DoctorService`:
  - `listActiveDoctors()` = `where { isActive: true, department: { isActive: true } }`
- Ensure SlotService uses active-doctor query.

### 7.3 Error codes

Add/standardize:
- `FORBIDDEN`
- `DEPARTMENT_NAME_TAKEN`
- `DEPARTMENT_NOT_FOUND`
- `DEPARTMENT_INACTIVE`
- `DOCTOR_NOT_FOUND`

---

## 8. Testing Strategy

### 8.1 Backend

- Unit tests (Jest):
  - Validation schemas (zod) for admin DTOs.
  - Role guard middleware:
    - unauthenticated → 401
    - authenticated receptionist → 403
    - authenticated admin → pass

- Integration tests (Supertest + test DB):
  - Admin departments:
    - create unique name; duplicate (case-insensitive) → 409
    - deactivate department; receptionist list excludes it
  - Admin doctors:
    - create doctor with valid department
    - deactivate doctor; receptionist doctor list excludes it
  - Booking endpoints:
    - cannot create booking for inactive doctor/department (expect 400/409 depending on existing conventions)

### 8.2 Frontend

If no test framework exists, scope is:
- Smoke tests by running `npm run build`.
- Optional: Add Playwright/Cypress later; not required by this story.

### 8.3 E2E

If the repo already has e2e, add scenarios:
- Admin toggles doctor inactive → receptionist cannot book with that doctor.

---

## 9. Implementation Plan (dependency ordered)

1. **Backend auth roles**
   - Extend session payload and `/api/auth/me` to include role.
   - Extend login to support admin credentials.

2. **DB migration**
   - Update Prisma models for `isActive` + timestamps.
   - Generate migration.
   - Add SQL for case-insensitive unique index on `Department` name.

3. **Admin APIs**
   - Add `requireRole` middleware.
   - Implement `/api/admin/departments` endpoints.
   - Implement `/api/admin/doctors` endpoints.

4. **Update receptionist endpoints**
   - Filter inactive departments/doctors.
   - Ensure booking creation validates doctor+department active.

5. **Frontend admin UI**
   - Add routes, pages, and API client functions.
   - Add role-based route guard.

6. **Tests**
   - Add/extend unit + integration tests per strategy.

7. **Docs**
   - Link design package in `docs/design.md`.
   - Ensure PR checklist exists.

---

## 10. Open Questions / Follow-ups

- Should department deactivation automatically deactivate all doctors? (Current design: no.)
- Should admins be able to view appointment counts per doctor/department? (Not required.)
- Do we need an audit trail for admin changes? (Not required.)
