# API Spec — EPMCDMETST-68387: Admin manages SMS templates

Base path (as used in repo): `/api`

Auth: Session cookie. All endpoints below require authenticated session.

## Data types

### MessageType (enum)
Existing Prisma enum:
- `BOOKING`
- `CANCELLATION`
- `RESCHEDULING`

### SmsTemplate
```json
{
  "id": "uuid",
  "messageType": "BOOKING",
  "templateBody": "Hello {{patientName}} ...",
  "updatedAt": "2026-10-07T12:34:56.000Z"
}
```

### Allowed variables
- `patientName`
- `appointmentDate`
- `appointmentTime`
- `doctorName`
- `department`
- `appointmentId`

Placeholders syntax:
- Preferred: `{{variable}}` (whitespace allowed)
- Back-compat: `{variable}`

---

## GET /api/admin/sms-templates
List all templates.

### Response 200
```json
[
  {
    "id": "...",
    "messageType": "BOOKING",
    "templateBody": "...",
    "updatedAt": "..."
  }
]
```

---

## PUT /api/admin/sms-templates/:messageType
Create or update a template.

### Path params
- `messageType`: `BOOKING|CANCELLATION|RESCHEDULING`

### Body
```json
{
  "templateBody": "Hi {{patientName}}, your appointment is on {{appointmentDate}} at {{appointmentTime}} with {{doctorName}} ({{department}}). Ref: {{appointmentId}}"
}
```

### Response 200
```json
{
  "id": "...",
  "messageType": "BOOKING",
  "templateBody": "...",
  "updatedAt": "..."
}
```

### Errors
- 400 `VALIDATION_ERROR` (unknown placeholders, body length)
- 401 `UNAUTHORIZED`

---

## POST /api/admin/sms-templates/preview
Render a template with variables; does not persist.

### Body
```json
{
  "messageType": "BOOKING",
  "templateBody": "Hi {{patientName}} ...",
  "variables": {
    "patientName": "Ava",
    "appointmentDate": "12-10-2026",
    "appointmentTime": "10:30 AM",
    "doctorName": "Dr. Rao",
    "department": "Cardiology",
    "appointmentId": "APPT-123"
  }
}
```

### Response 200
```json
{
  "rendered": "Hi Ava ...",
  "unknownPlaceholders": [],
  "usedPlaceholders": ["patientName","appointmentDate","appointmentTime"]
}
```

### Errors
- 400 `VALIDATION_ERROR`
- 401 `UNAUTHORIZED`

---

## Notes
- Server should reject templates containing placeholders not in allowed list.
- Server should allow saving templates even if not all allowed variables are present; rendering will leave missing variables as the original token in *lenient* mode (runtime), but preview/save is *strict*.
