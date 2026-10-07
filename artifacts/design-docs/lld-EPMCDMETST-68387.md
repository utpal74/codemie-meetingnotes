# LLD — EPMCDMETST-68387: Admin manages SMS templates

## Backend design

### Routes
Create `backend/src/routes/admin/smsTemplates.js`:

- `GET /api/admin/sms-templates`
  - Auth: required.
  - Response: array of templates sorted by `messageType`.

- `PUT /api/admin/sms-templates/:messageType`
  - Auth: required.
  - Params:
    - `messageType`: `BOOKING | CANCELLATION | RESCHEDULING` (existing Prisma enum)
  - Body:
    - `templateBody`: string
  - Behavior:
    - validate length + placeholder tokens
    - `SmsTemplate.upsert({ where: { messageType }, create: { ... }, update: { ... } })`
    - clear NotificationService template cache

- `POST /api/admin/sms-templates/preview`
  - Auth: required.
  - Body:
    - `messageType` (optional; used only for UI convenience)
    - `templateBody`
    - `variables`: object
  - Behavior:
    - validate placeholders are allowed
    - render using provided variables

### Validation schemas (Zod)
Add to `backend/src/schemas/admin/index.js` (or new `smsTemplates.js` re-exported via admin index):

- `PutSmsTemplateSchema`
  - `params.messageType`: z.enum(["BOOKING","CANCELLATION","RESCHEDULING"])
  - `body.templateBody`: z.string().trim().min(1).max(500)

- `PreviewSmsTemplateSchema`
  - `body.templateBody`: z.string().trim().min(1).max(500)
  - `body.variables`: z.record(z.string(), z.string().optional()).default({})

### Placeholder parsing/rendering
Current helper: `backend/src/helpers/smsFormat.js` uses `{var}`.

Requirement: support `{{var}}` and allowed list:
- `patientName`
- `appointmentDate`
- `appointmentTime`
- `doctorName`
- `department`
- `appointmentId`

Design:
- Create new helper `backend/src/helpers/smsTemplate.js`:

```js
const ALLOWED_SMS_TEMPLATE_VARS = [
  'patientName',
  'appointmentDate',
  'appointmentTime',
  'doctorName',
  'department',
  'appointmentId',
];

function extractPlaceholders(template) {
  // supports {{var}} and {var}
}

function validatePlaceholders(template, allowed = ALLOWED_SMS_TEMPLATE_VARS) {
  // throws Errors.VALIDATION_ERROR (TBD) or returns list of unknown
}

function renderTemplate(template, vars, { mode = 'strict' } = {}) {
  // strict: unknown placeholder => throw
  // lenient: leave as-is
  // normalize: allow both syntaxes
}
```

Regex:
- Must match `{{\s*(\w+)\s*}}` and `\{(\w+)\}`.
- Avoid overlapping matches: run `{{}}` first, then `{}` but skip `{}` that are part of `{{}}` (simpler approach: replace `{{var}}` to sentinel `{var}` first).

Runtime mapping:
- In `NotificationService.send()` vars currently are `{ date, time }`.
- Update mapping to requested variable names:
  - `appointmentDate`: formatted date
  - `appointmentTime`: formatted time
- Maintain backward compatibility by still populating `date` and `time` for existing templates.

### NotificationService changes
`backend/src/services/NotificationService.js`:
- Add fallback defaults:
  - If DB template missing for a `messageType`, use a local default map.
  - (TBD) If an existing default/hardcoded template already exists elsewhere, reuse it.
- Clear cache:
  - Export `clearTemplateCache()` which sets `templateCache.data=null` and `expiresAt=0`.
  - Admin PUT endpoint calls it after successful write.
- Use new `renderTemplate()` instead of `interpolate()`.

## Frontend design

### New page
Add page component (path TBD based on current router layout):
- `frontend/src/pages/admin/SmsTemplatesPage.jsx`

Features:
- Table/list of message types and last updated timestamp.
- Editor for selected template.
- Helper panel showing allowed variables.
- Preview pane.

### API client
Add functions in existing API layer (TBD: locate `frontend/src/api` or similar) using axios:
- `getSmsTemplates()`
- `updateSmsTemplate(messageType, templateBody)`
- `previewSmsTemplate(templateBody, variables)`

### UX rules
- Disable Save when templateBody invalid/empty.
- Show placeholder errors returned from API.
- Show SMS length count (GSM-7 vs UCS-2 is out of scope; simple char count).

## Error handling
- For invalid `messageType`: 400.
- For unknown placeholders: 400 with field `templateBody`.
- For unauthenticated: 401.

## Testing
- Unit: placeholder extraction and rendering.
- Integration: admin routes require auth.
- Integration: NotificationService uses updated template when present and uses fallback when not.

## TBDs
- Where admin router is mounted and how auth is enforced for `/api/admin/*`.
- If there is an admin role; currently only authenticated session exists.
- Existing default templates content.
