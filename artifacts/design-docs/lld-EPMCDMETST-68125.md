# LLD — Admin Departments & Doctors Management

**Jira:** EPMCDMETST-68125  
**Source design artifact ref:** tech-design-EPMCDMETST-68125

## 1. Scope overview
Low-level design for implementing Admin CRUD and activation toggles for Departments & Doctors, plus booking UI/API filtering.

## 2. Backend design
### 2.1 Routes
Observed existing routes:
- `backend/src/routes/departments.js`
- `backend/src/routes/doctors.js`

Proposed additions:
- `backend/src/routes/admin/departments.js`
- `backend/src/routes/admin/doctors.js`

Mounting (example):
- `app.use('/api/admin/departments', authenticate, requireAdmin, adminDepartmentsRouter)`
- `app.use('/api/admin/doctors', authenticate, requireAdmin, adminDoctorsRouter)`

### 2.2 Middleware
- Existing: `backend/src/middleware/authenticate.js`
- Proposed: `backend/src/middleware/requireAdmin.js`

`requireAdmin` responsibilities:
- Inspect `req.session` (or decoded token if repo uses JWT elsewhere).
- Fail with `Errors.FORBIDDEN()` (or similar) if not admin.

Session contract (to confirm in code):
- `req.session.authenticated: boolean` (observed)
- Add/expect `req.session.user.role === 'ADMIN'` (or similar) for role checks.

### 2.3 Validation
Use existing validation approach:
- There is a validation middleware: `backend/src/middleware/validate.js` (observed via coverage output).
- There are schemas in `backend/src/schemas/index.js` (observed via coverage output).

Proposed schemas:
- `DepartmentCreateSchema`: `{ name: string (trim, min 1, max 100) }`
- `DepartmentUpdateSchema`: `{ name?: string, active?: boolean }` (but toggling is via dedicated endpoint)
- `DoctorCreateSchema`: `{ name: string, departmentId: uuid }`
- `DoctorUpdateSchema`: `{ name?: string, departmentId?: uuid }`

### 2.4 Services
- Update `DoctorService.js` to support:
  - `listPublic({ departmentId? })` → active doctors only
  - `listAdmin({ includeInactive=true })`
- Create a `DepartmentService.js` or implement directly in admin routes.

### 2.5 Error handling
Use existing error envelope (already used by `authenticate`):
```json
{ "error": { "code": "...", "message": "...", "field": null } }
```

Standardize common errors:
- 400 validation error (field indicated)
- 401 unauthorized
- 403 forbidden
- 404 not found
- 409 conflict for duplicate department names

### 2.6 Case-insensitive unique department name
Preferred (Postgres): unique index on `lower(name)`.
- If Prisma migration cannot express this cleanly, add a raw SQL migration.

Fallback (app-level):
- Normalize input: `normalized = name.trim()` and either:
  - store `name` as-is but check `lower(name)` on create/update
  - or add `nameNormalized` column and enforce unique on it

## 3. Frontend design
### 3.1 Routes/pages
Proposed routes:
- `/admin/departments`
- `/admin/doctors`

Guard:
- `AdminRoute` checks user role and redirects/blocks.

### 3.2 Components
- `<AdminLayout />` with nav tabs.
- `<DepartmentList />` table:
  - Name
  - Status pill (Active/Inactive)
  - Actions: Edit, Deactivate/Activate
- `<DepartmentForm />` (create/edit)
- `<DoctorList />` table:
  - Name
  - Department
  - Status
  - Actions
- `<DoctorForm />` with department dropdown.

### 3.3 Data fetching
- Use existing fetch layer (to confirm; likely `fetch`/axios).
- Admin endpoints:
  - `GET /api/admin/departments`
  - `POST /api/admin/departments`
  - ...

### 3.4 Booking flow changes
Where booking UI currently loads departments/doctors, ensure:
- Only active departments are shown.
- Doctor dropdown is filtered to active doctors (and active department).
- If user has a stale selection (deep link / cached state), show a friendly error and request re-selection.

## 4. Migration & deployment (LLD)
- Create Prisma migration(s) in `backend/prisma/migrations/*`.
- Add unique index migration for department name.
- Deploy backend first (so API supports both new/old fields if needed), then frontend.

## 5. Testing plan (LLD)
- Unit tests:
  - `requireAdmin` middleware
  - name normalization helper
- Integration tests:
  - Admin create/update with duplicates → 409
  - Public lists exclude inactive
- E2E:
  - Admin deactivates doctor → booking cannot choose that doctor

## 6. HITL checkpoints
- Confirm role claim name in session with auth owner.
- Confirm DB approach for case-insensitive unique index.
- Confirm admin UX (table columns, search/filter needs).
