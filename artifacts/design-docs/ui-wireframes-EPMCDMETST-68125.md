# UI Wireframes — Admin Departments & Doctors Management

**Jira:** EPMCDMETST-68125

> Wireframes are provided as text/ASCII so they can be pasted into Confluence.

## 1. Admin navigation
```
+----------------------------------------------------+
| Admin                                               |
| [Departments]  [Doctors]                            |
+----------------------------------------------------+
```

## 2. Departments list
```
+--------------------------------------------------------------+
| Departments                                      [ + New ]    |
+--------------------------------------------------------------+
| Name                      | Status   | Actions               |
|--------------------------------------------------------------|
| Cardiology                | Active   | Edit  Deactivate       |
| Pediatrics                | Inactive | Edit  Activate         |
+--------------------------------------------------------------+
| (Optional) Search: [__________]  Filter: [All|Active|Inactive]|
+--------------------------------------------------------------+
```

### Department form (Create/Edit)
```
+--------------------------------------+
| Department                            |
+--------------------------------------+
| Name: [__________________________]   |
|                                      |
|                 [Cancel] [Save]      |
+--------------------------------------+
```

## 3. Doctors list
```
+--------------------------------------------------------------------------+
| Doctors                                                     [ + New ]     |
+--------------------------------------------------------------------------+
| Name                | Department      | Status   | Actions                |
|--------------------------------------------------------------------------|
| Dr. Smith           | Cardiology      | Active   | Edit  Deactivate        |
| Dr. Patel           | Pediatrics      | Inactive | Edit  Activate          |
+--------------------------------------------------------------------------+
| (Optional) Search: [__________]  Filter Dept: [All v]  Status: [All v]    |
+--------------------------------------------------------------------------+
```

### Doctor form (Create/Edit)
```
+-------------------------------------------+
| Doctor                                     |
+-------------------------------------------+
| Name:        [________________________]   |
| Department:  [ Select department     v ]   |
|                                           |
|                      [Cancel] [Save]      |
+-------------------------------------------+
```

## 4. Booking flow (public) — changes
### Department selection
- Display only **Active** departments.
- If no active departments exist, show empty state:
  - "No departments available right now. Please try again later."

### Doctor selection
- Display only **Active** doctors.
- Additionally, hide doctors whose department is inactive.

### Error/edge UI
If a user tries to book with a now-inactive doctor/department (stale UI state):
- Show inline error banner:
  - "Selected doctor is no longer available. Please choose another doctor."
- Reset selection to prompt re-selection.

## 5. HITL checkpoints (UI)
- Confirm whether Admin area should be linked from main navigation or hidden behind direct URL.
- Confirm whether to allow delete vs soft-deactivate only.
- Confirm whether to show counts (e.g., doctors per department).
