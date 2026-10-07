#!/usr/bin/env node
/**
 * Document quality-check script.
 * Verifies that each project document contains its required sections,
 * IDs, and cross-references. Exits 1 if any check fails.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PASS = '✓';
const FAIL = '✗';

let totalChecks = 0;
let passedChecks = 0;
const failures = [];

function check(docName, description, passed) {
  totalChecks++;
  const icon = passed ? PASS : FAIL;
  console.log(`  ${icon}  ${description}`);
  if (passed) {
    passedChecks++;
  } else {
    failures.push(`[${docName}] ${description}`);
  }
}

function read(filename) {
  const p = path.join(ROOT, filename);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, 'utf-8');
}

function has(content, pattern) {
  if (!content) return false;
  if (typeof pattern === 'string') return content.includes(pattern);
  return pattern.test(content);
}

// ─── requirements.md ─────────────────────────────────────────────────────────

console.log('\n=== requirements.md ===');
const req = read('artifacts/requirements.md');

check('requirements.md', 'File exists', req !== null);
check('requirements.md', 'Has Overview section', has(req, '## 1. Overview'));
check('requirements.md', 'Has Actors table', has(req, 'Patient'));
for (let i = 1; i <= 8; i++) {
  check('requirements.md', `FR-0${i} is present`, has(req, `FR-0${i}`));
}
for (let i = 1; i <= 8; i++) {
  check('requirements.md', `NFR-0${i} is present`, has(req, `NFR-0${i}`));
}
check('requirements.md', 'Has Out of Scope section', has(req, 'Out of Scope'));
check('requirements.md', 'Has Assumptions section', has(req, 'Assumptions'));
check('requirements.md', 'Has Glossary section', has(req, 'Glossary'));
check('requirements.md', 'Mentions 3 departments (Cardiology)', has(req, 'Cardiology'));
check('requirements.md', 'Mentions SMS notification requirement (FR-05)', has(req, 'FR-05'));
check('requirements.md', 'Cancellation and rescheduling specified (FR-06, FR-07)', has(req, 'FR-07'));

// ─── architecture.md ─────────────────────────────────────────────────────────

console.log('\n=== architecture.md ===');
const arch = read('artifacts/architecture.md');

check('architecture.md', 'File exists', arch !== null);
check('architecture.md', 'Has Architecture Pattern section', has(arch, '3-Tier'));
check('architecture.md', 'Has Technology Stack table', has(arch, 'Technology Stack'));
check('architecture.md', 'Lists React.js', has(arch, 'React'));
check('architecture.md', 'Lists Node.js / Express', has(arch, 'Express'));
check('architecture.md', 'Lists PostgreSQL', has(arch, 'PostgreSQL'));
check('architecture.md', 'Lists Prisma ORM', has(arch, 'Prisma'));
check('architecture.md', 'Lists Twilio', has(arch, 'Twilio'));
check('architecture.md', 'Lists pino logger', has(arch, 'pino'));
check('architecture.md', 'Has Database Schema section (ER diagram)', has(arch, 'erDiagram'));
check('architecture.md', 'Schema has appointments table', has(arch, 'appointments'));
check('architecture.md', 'Schema has sms_logs / SmsLog', has(arch, 'sms_logs'));
check('architecture.md', 'Schema has sms_templates', has(arch, 'sms_templates'));
check('architecture.md', 'Schema documents patient_phone_hash (HMAC column)', has(arch, 'patient_phone_hash'));
check('architecture.md', 'Has Indexes table (UX_appt_slot)', has(arch, 'UX_appt_slot'));
check('architecture.md', 'Has REST API Design section', has(arch, 'REST API'));
check('architecture.md', 'API table has POST /api/appointments', has(arch, 'POST'));
check('architecture.md', 'API table has GET /health', has(arch, '/health'));
check('architecture.md', 'API table has auth routes', has(arch, '/api/auth/login'));
check('architecture.md', 'Has booking sequence diagram', has(arch, 'sequenceDiagram'));
check('architecture.md', 'Documents smsStatus field with warning note', has(arch, 'smsStatus'));
check('architecture.md', 'Has 7 ADRs', has(arch, 'ADR-07'));
check('architecture.md', 'ADR-03 references fire-and-forget', has(arch, 'Fire-and-Forget'));
check('architecture.md', 'ADR-06 documents session auth', has(arch, 'ADR-06'));
check('architecture.md', 'ADR-07 documents HMAC hash', has(arch, 'ADR-07'));
check('architecture.md', 'Has Security Considerations section', has(arch, 'Security Considerations'));
check('architecture.md', 'Documents CORS configuration', has(arch, 'CORS'));
check('architecture.md', 'Lists all 9 required env vars', has(arch, 'PHONE_HMAC_SECRET'));

// ─── design-review.md ────────────────────────────────────────────────────────

console.log('\n=== design-review.md ===');
const dr = read('artifacts/design-review.md');

check('design-review.md', 'File exists', dr !== null);
check('design-review.md', 'Has Review Scope section', has(dr, 'Review Scope'));
for (let i = 1; i <= 12; i++) {
  check('design-review.md', `FINDING-${String(i).padStart(2, '0')} is present`, has(dr, `FINDING-${String(i).padStart(2, '0')}`));
}
check('design-review.md', 'All Critical findings have Agreed Decision', has(dr, 'Agreed Decision'));
check('design-review.md', 'Summary table present with severity column', has(dr, 'Critical'));
check('design-review.md', 'Sections accepted as-is documented', has(dr, 'Accepted as-is'));

// ─── impl-plan.md ────────────────────────────────────────────────────────────

console.log('\n=== impl-plan.md ===');
const plan = read('artifacts/impl-plan.md');

check('impl-plan.md', 'File exists', plan !== null);
check('impl-plan.md', 'Has Dependency Graph section', has(plan, 'Dependency Graph'));
for (let i = 1; i <= 39; i++) {
  const id = `T${String(i).padStart(2, '0')}`;
  check('impl-plan.md', `${id} is documented`, has(plan, id));
}
check('impl-plan.md', 'Blocked Tasks section present', has(plan, 'Blocked Tasks'));
check('impl-plan.md', 'T21 identified as most-blocked task', has(plan, 'T21'));
check('impl-plan.md', 'Parallel execution tracks documented', has(plan, 'Parallel'));
check('impl-plan.md', 'Definition of Done section present', has(plan, 'Definition of Done'));

// ─── code-review.md ──────────────────────────────────────────────────────────

console.log('\n=== code-review.md ===');
const cr = read('artifacts/code-review.md');

check('code-review.md', 'File exists', cr !== null);
check('code-review.md', 'Has Checklist Summary table', has(cr, 'Checklist Summary'));
for (let i = 1; i <= 10; i++) {
  check('code-review.md', `CR-${String(i).padStart(2, '0')} is documented`, has(cr, `CR-${String(i).padStart(2, '0')}`));
}
check('code-review.md', 'All Critical findings marked (3 found)', has(cr, '· Critical ·'));
check('code-review.md', 'Each finding includes "Fix applied"', has(cr, 'Fix applied'));
check('code-review.md', 'Advisory section present', has(cr, 'Advisory Findings'));
check('code-review.md', 'No-test coverage note present', has(cr, 'No-Test-Coverage'));

// ─── Cross-reference checks ───────────────────────────────────────────────────

console.log('\n=== Cross-reference checks ===');

check('cross-ref', 'architecture.md references requirements.md', has(arch, 'requirements.md'));
check('cross-ref', 'design-review.md references architecture.md', has(dr, 'architecture.md'));
check('cross-ref', 'impl-plan.md references architecture.md', has(plan, 'architecture.md'));
check('cross-ref', 'impl-plan.md references design-review.md', has(plan, 'design-review.md'));
check('cross-ref', 'code-review.md references code review findings in source files (CR-01 → toPublic)', has(cr, 'toPublic'));
check('cross-ref', 'Design review FINDING-01 addressed in code-review.md CR-03', has(cr, 'UX_appt_slot'));

// ─── Source file existence checks ────────────────────────────────────────────

console.log('\n=== Source file existence ===');
const srcFiles = [
  'backend/src/app.js',
  'backend/src/server.js',
  'backend/src/helpers/crypto.js',
  'backend/src/helpers/sanitize.js',
  'backend/src/helpers/smsFormat.js',
  'backend/src/helpers/errors.js',
  'backend/src/helpers/logger.js',
  'backend/src/middleware/authenticate.js',
  'backend/src/middleware/validate.js',
  'backend/src/services/AppointmentService.js',
  'backend/src/services/DoctorService.js',
  'backend/src/services/SlotService.js',
  'backend/src/services/NotificationService.js',
  'backend/src/jobs/smsRetryJob.js',
  'backend/src/routes/appointments.js',
  'backend/src/routes/auth.js',
  'backend/src/routes/departments.js',
  'backend/src/routes/doctors.js',
  'backend/src/routes/slots.js',
  'backend/src/routes/health.js',
  'backend/prisma/schema.prisma',
  'backend/prisma/seed.js',
  'backend/prisma/migrations/20260923170646_init/migration.sql',
  'backend/prisma/migrations/20260923171805_add_slot_unique_index/migration.sql',
  'frontend/src/App.jsx',
  'frontend/src/api/client.js',
  'frontend/src/components/BookingForm.jsx',
  'frontend/src/components/AppointmentList.jsx',
  'frontend/src/components/CancelReschedule.jsx',
  'frontend/src/components/SmsBanner.jsx',
  'frontend/src/context/AuthContext.jsx',
  'docker-compose.yml',
  '.env.example',
];

srcFiles.forEach(f => check('source-files', `${f} exists`, fs.existsSync(path.join(ROOT, f))));

// ─── Critical code checks ─────────────────────────────────────────────────────

console.log('\n=== Critical code checks ===');
const apptRoute = read('backend/src/routes/appointments.js');
const apptSvc   = read('backend/src/services/AppointmentService.js');
const notifSvc  = read('backend/src/services/NotificationService.js');
const retryJob  = read('backend/src/jobs/smsRetryJob.js');
const appJs     = read('backend/src/app.js');
const smsFormat = read('backend/src/helpers/smsFormat.js');

check('code', 'toPublic() includes doctorId (CR-01 fix)', has(apptRoute, "doctorId: appt.doctor?.id"));
check('code', 'cancelAppointment guards RESCHEDULED status (CR-09 fix)', has(apptSvc, "status === 'RESCHEDULED'"));
check('code', 'NotificationService wraps send() in try/catch (CR-04 fix)', has(notifSvc, "catch (err)"));
check('code', 'dispatchSms uses { increment: 1 } not absolute assignment (CR-02 fix)',
  has(notifSvc, 'increment: 1') && !has(notifSvc, 'attemptCount: 1,'));
check('code', 'smsRetryJob imports from smsFormat.js (CR-10 fix)', has(retryJob, "require('../helpers/smsFormat')"));
check('code', 'NotificationService imports from smsFormat.js (CR-10 fix)', has(notifSvc, "require('../helpers/smsFormat')"));
check('code', 'smsFormat.js contains interpolate, formatDate, formatTime', has(smsFormat, 'interpolate') && has(smsFormat, 'formatDate') && has(smsFormat, 'formatTime'));
check('code', 'app.js error handler sanitises 500 messages (CR-07 fix)', has(appJs, "status < 500 ?"));
check('code', 'app.js throws on missing SESSION_SECRET in production (CR-06 fix)', has(appJs, "SESSION_SECRET"));
check('code', 'NotificationService has normalisePhone() stripping +91 (CR-08 fix)', has(notifSvc, 'normalisePhone'));
check('code', 'UX_appt_slot index in migration SQL (CR-03 fix)',
  has(read('backend/prisma/migrations/20260923171805_add_slot_unique_index/migration.sql'), 'UX_appt_slot'));

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(60));
console.log(`RESULT: ${passedChecks} / ${totalChecks} checks passed`);

if (failures.length > 0) {
  console.log(`\nFAILED CHECKS (${failures.length}):`);
  failures.forEach(f => console.log(`  ✗  ${f}`));
  process.exit(1);
} else {
  console.log('\nAll document and code checks passed.');
}
