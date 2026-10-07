# HLD — Admin Departments & Doctors Management

**Jira:** EPMCDMETST-68125  
**Source design artifact ref:** tech-design-EPMCDMETST-68125  
**Repo:** `codemie-meetingnotes`

## 1. Scope overview
This change introduces an **Admin area** to manage **Departments** and **Doctors** with:
- CRUD for departments and doctors.
- Activate/deactivate toggles (soft-disable).
- Public booking surfaces only show **active** departments/doctors.

Non-goals:
- Reworking authentication provider.
- Changes to appointment scheduling logic (slots, conflicts), beyond filtering inactive entities.

## 2. Current architecture (as observed)
- **Frontend:** React app under `frontend/`.
- **Backend:** Express API under `backend/src/`.
- **DB:** Postgres via Prisma (`backend/prisma/schema.prisma`).
- Existing API routes include:
  - `backend/src/routes/departments.js`
  - `backend/src/routes/doctors.js`
  - `backend/src/routes/appointments.js`
- Existing auth middleware: `backend/src/middleware/authenticate.js` uses session state (`req.session.authenticated`).

## 3. Target architecture
### 3.1 Components
- **Backend**
  - Admin routes (new): `backend/src/routes/admin/departments.js`, `backend/src/routes/admin/doctors.js` (proposed)
  - Admin authorization middleware (new): `backend/src/middleware/requireAdmin.js` (proposed)
  - Service layer updates:
    - `backend/src/services/DoctorService.js` (filter active for public listing)
    - new `DepartmentService` or extend existing route handlers

- **Frontend**
  - Admin pages (new): `frontend/src/pages/admin/*` (proposed)
  - Shared components: table/list, status toggle, forms
  - Route guard (new): `frontend/src/routes/AdminRoute.tsx` (or existing route system)

### 3.2 Data flow
1. Admin logs in → session established.
2. Admin navigates to `/admin/departments` → frontend calls `GET /api/admin/departments`.
3. Admin toggles active → frontend calls `PATCH /api/admin/departments/:id/activate` (or `/deactivate`).
4. Public booking page calls `GET /api/departments` / `GET /api/doctors` → backend filters to active only.

## 4. Prisma / DB model changes (high level)
> Note: Repo currently uses `isActive` fields. Ticket wording asks for `active` boolean; we will **standardize on a single meaning**. The implementation-ready design proposes adding `active` while keeping backward compatibility if needed.

- Department
  - `active: Boolean @default(true)` (or rename existing `isActive`)
  - unique department name (case-insensitive where supported)
- Doctor
  - `active: Boolean @default(true)` (or rename existing `isActive`)
  - belongs to exactly one Department (`departmentId` already present)

Case-insensitive uniqueness recommendation:
- Postgres: create a unique index on `lower(name)`.

## 5. API surface (high level)
- **Admin (protected)** under `/api/admin/*`
  - Departments: list/create/update/delete, activate/deactivate
  - Doctors: list/create/update/delete, activate/deactivate
- **Public (unprotected or authenticated depending on existing)**
  - `GET /api/departments` returns active departments
  - `GET /api/doctors` returns active doctors (optionally by department)

## 6. Security / AuthZ (high level)
- Reuse `authenticate` middleware.
- Add `requireAdmin` middleware that checks role/claim from `req.session` (exact field must align with existing auth session payload).

## 7. Migration plan (high level)
1. Add/rename columns and indexes.
2. Backfill active=true.
3. Update public listing queries to filter `active`.
4. Deploy.

## 8. Testing (high level)
- Backend: route-level integration tests for admin endpoints and public filtering.
- Frontend: component tests for forms and booking flow filtering.
- End-to-end: Admin toggles doctor/department inactive → booking UI no longer shows them.

## 9. HITL checkpoints
- Review Prisma migration + index strategy with DB owner.
- Review admin authorization implementation with security/auth owner.
- UX review of admin forms and booking filtering behaviors.
