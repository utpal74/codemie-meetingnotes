# Wireframes — EPMCDMETST-68387: Admin manages SMS templates

## Admin > SMS Templates page
Route: `/admin/sms-templates` (TBD: confirm existing admin routing)

### Layout
```
+--------------------------------------------------------------+
| Admin / SMS Templates                                        |
+--------------------------------------------------------------+
| Templates                      | Editor / Preview            |
|-------------------------------|------------------------------|
| [BOOKING]      Updated: ...   | Message Type: BOOKING        |
| [CANCELLATION] Updated: ...   |                              |
| [RESCHEDULING] Updated: ...   | Template Body:               |
|                               | +--------------------------+ |
|                               | | Hi {{patientName}}, ...  | |
|                               | |                          | |
|                               | +--------------------------+ |
|                               | Allowed variables:           |
|                               |  - {{patientName}}           |
|                               |  - {{appointmentDate}}       |
|                               |  - {{appointmentTime}}       |
|                               |  - {{doctorName}}            |
|                               |  - {{department}}            |
|                               |  - {{appointmentId}}         |
|                               |                              |
|                               | Preview inputs:              |
|                               |  patientName [____]          |
|                               |  appointmentDate [____]      |
|                               |  appointmentTime [____]      |
|                               |  doctorName [____]           |
|                               |  department [____]           |
|                               |  appointmentId [____]        |
|                               |                              |
|                               | [Preview]  [Save Changes]    |
|                               |                              |
|                               | Rendered preview:            |
|                               | +--------------------------+ |
|                               | | Hi Ava, your appointment..| |
|                               | +--------------------------+ |
+--------------------------------------------------------------+
```

### States
- Loading templates: skeleton rows.
- Empty DB (no rows): show “No templates found” + button “Create defaults” (TBD; optional).
- Validation error from API: inline error below textarea.
- Unsaved changes prompt when switching messageType.

### Accessibility
- Textarea labeled.
- Buttons have aria-label.
- Error text associated via `aria-describedby`.

## Navigation
- Add link in Admin nav (TBD: locate existing nav component).

