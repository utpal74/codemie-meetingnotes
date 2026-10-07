# API Spec — Admin Departments & Doctors Management

**Jira:** EPMCDMETST-68125

## Conventions
- Base URL: `/<backend-base>/api` (confirm actual mount).
- Response envelope for errors (existing):
```json
{ "error": { "code": "...", "message": "...", "field": null } }
```
- Auth:
  - Admin endpoints require `authenticate` + `requireAdmin`.

## Data models (API)
### Department
```json
{
  "id": "uuid",
  "name": "Cardiology",
  "active": true,
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

### Doctor
```json
{
  "id": "uuid",
  "name": "Dr. Smith",
  "departmentId": "uuid",
  "active": true,
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

## Admin endpoints (protected)
### Departments
#### GET `/api/admin/departments`
- Query params:
  - `includeInactive` (optional, default `true`)
- 200 Response: `Department[]`

#### POST `/api/admin/departments`
- Body:
```json
{ "name": "Cardiology" }
```
- 201 Response: `Department`
- Errors:
  - 409 duplicate name (case-insensitive)

#### PUT `/api/admin/departments/:id`
- Body:
```json
{ "name": "New name" }
```
- 200 Response: `Department`

#### PATCH `/api/admin/departments/:id/activate`
- 200 Response: `Department`

#### PATCH `/api/admin/departments/:id/deactivate`
- 200 Response: `Department`
- Additional behavior:
  - Does **not** delete department.
  - If department is deactivated, public booking must not show it.

#### DELETE `/api/admin/departments/:id`
- 204 Response (no content)
- Constraints:
  - If doctors exist in department, either:
    - reject with 409, or
    - cascade delete (NOT recommended)
  - Prefer: reject delete and use deactivate.

### Doctors
#### GET `/api/admin/doctors`
- Query params:
  - `includeInactive` (optional, default `true`)
  - `departmentId` (optional)
- 200 Response: `Doctor[]`

#### POST `/api/admin/doctors`
- Body:
```json
{ "name": "Dr. Smith", "departmentId": "uuid" }
```
- 201 Response: `Doctor`

#### PUT `/api/admin/doctors/:id`
- Body:
```json
{ "name": "Dr. Smith", "departmentId": "uuid" }
```
- 200 Response: `Doctor`

#### PATCH `/api/admin/doctors/:id/activate`
- 200 Response: `Doctor`

#### PATCH `/api/admin/doctors/:id/deactivate`
- 200 Response: `Doctor`

#### DELETE `/api/admin/doctors/:id`
- 204 Response
- Constraint: if doctor has appointments, prefer reject with 409 and require deactivate.

## Public endpoints (booking)
### GET `/api/departments`
- Returns only active departments.
- 200 Response: `Department[]`

### GET `/api/doctors`
- Query params:
  - `departmentId` (optional)
- Returns only active doctors whose department is also active.
- 200 Response: `Doctor[]`

## Booking enforcement
Where appointments are created (existing `backend/src/routes/appointments.js`):
- On create/reschedule, verify:
  - doctor is active
  - doctor.department is active
- If not, respond with 409 or 400:
  - `code`: `DOCTOR_INACTIVE` / `DEPARTMENT_INACTIVE`

## HITL checkpoints
- Decide delete semantics (allow delete vs only deactivate).
- Decide whether public endpoints require authentication.
