// AC-6 / AC-7: cancel and reschedule trigger SMS; reschedule creates a new linked appointment.
const request = require('supertest');
const app = require('../../src/app');
const prisma = require('../../src/lib/prisma');

let agent;
let doctor;

const DATE_A = '2027-09-20'; // Monday
const DATE_B = '2027-09-21'; // Tuesday
const DATE_C = '2027-09-22'; // Wednesday
const PHONE = '9876500011';
const SMS_STATUSES = ['SENT', 'PENDING_RETRY', 'FAILED', 'DISABLED'];

const book = (overrides = {}) =>
  agent.post('/api/appointments').send({
    patientName: 'Sunita Rao',
    patientPhone: PHONE,
    doctorId: doctor.id,
    appointmentDate: DATE_A,
    slotTime: '13:00',
    ...overrides,
  });

const reschedule = (id, body = { appointmentDate: DATE_B, slotTime: '11:00' }) =>
  agent.patch(`/api/appointments/${id}/reschedule`).send(body);

const logsFor = (appointmentId) => prisma.smsLog.findMany({ where: { appointmentId } });

beforeAll(async () => {
  agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username: 'receptionist', password: 'admin123' });
  doctor = await prisma.doctor.findFirst({ where: { name: 'Dr. Arjun Mehta' } });
});

beforeEach(async () => {
  await prisma.smsLog.deleteMany();
  await prisma.appointment.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Booking SMS', () => {
  test('booking writes one BOOKING SmsLog row and exposes the status', async () => {
    const res = await book();
    expect(res.status).toBe(201);
    expect(SMS_STATUSES).toContain(res.body.smsStatus);
    const logs = await logsFor(res.body.appointmentId);
    expect(logs).toHaveLength(1);
    expect(logs[0].messageType).toBe('BOOKING');
  });
});

describe('Cancel + SMS (AC-6)', () => {
  test('cancel returns smsStatus and writes a CANCELLATION SmsLog row', async () => {
    const id = (await book()).body.appointmentId;
    const res = await agent.patch(`/api/appointments/${id}/cancel`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
    expect(SMS_STATUSES).toContain(res.body.smsStatus);
    const types = (await logsFor(id)).map((l) => l.messageType).sort();
    expect(types).toEqual(['BOOKING', 'CANCELLATION']);
  });

  test('SMS status endpoint reports the CANCELLATION message as latest', async () => {
    const id = (await book()).body.appointmentId;
    await agent.patch(`/api/appointments/${id}/cancel`);
    const res = await agent.get(`/api/appointments/${id}/sms`);
    expect(res.status).toBe(200);
    expect(res.body.appointmentId).toBe(id);
    expect(res.body.latest.messageType).toBe('CANCELLATION');
  });

  test('cancelled appointment leaves default phone lookup but shows with includeHistory', async () => {
    const id = (await book()).body.appointmentId;
    await agent.patch(`/api/appointments/${id}/cancel`);

    const def = await agent.get('/api/appointments').query({ phone: PHONE });
    expect(def.body).toHaveLength(0);

    const hist = await agent.get('/api/appointments').query({ phone: PHONE, includeHistory: 'true' });
    expect(hist.body).toHaveLength(1);
    expect(hist.body[0].status).toBe('CANCELLED');
  });
});

describe('Reschedule + SMS (AC-7)', () => {
  test('new appointment has a new id, is CONFIRMED and links to the original', async () => {
    const id = (await book()).body.appointmentId;
    const res = await reschedule(id);
    expect(res.status).toBe(201);
    expect(res.body.appointmentId).not.toBe(id);
    expect(res.body.status).toBe('CONFIRMED');
    expect(res.body.previousAppointmentId).toBe(id);
    expect(res.body.doctorId).toBe(doctor.id);
    expect(res.body.appointmentDate).toContain(DATE_B);
  });

  test('reschedule returns smsStatus and writes a RESCHEDULING SmsLog row on the NEW appointment', async () => {
    const id = (await book()).body.appointmentId;
    const res = await reschedule(id);
    expect(SMS_STATUSES).toContain(res.body.smsStatus);
    const newLogs = await logsFor(res.body.appointmentId);
    expect(newLogs).toHaveLength(1);
    expect(newLogs[0].messageType).toBe('RESCHEDULING');
  });

  test('SMS status endpoint for the new appointment reports RESCHEDULING', async () => {
    const id = (await book()).body.appointmentId;
    const newId = (await reschedule(id)).body.appointmentId;
    const res = await agent.get(`/api/appointments/${newId}/sms`);
    expect(res.status).toBe(200);
    expect(res.body.latest.messageType).toBe('RESCHEDULING');
  });

  test('original becomes RESCHEDULED and can no longer be cancelled', async () => {
    const id = (await book()).body.appointmentId;
    await reschedule(id);
    expect((await agent.get(`/api/appointments/${id}`)).body.status).toBe('RESCHEDULED');
    expect((await agent.patch(`/api/appointments/${id}/cancel`)).status).toBe(409);
  });

  test('chain A -> B -> C keeps each link and only the last stays CONFIRMED', async () => {
    const a = (await book()).body.appointmentId;
    const b = (await reschedule(a)).body.appointmentId;
    const c = (await reschedule(b, { appointmentDate: DATE_C, slotTime: '16:30' })).body;

    expect(c.previousAppointmentId).toBe(b);
    expect((await agent.get(`/api/appointments/${b}`)).body.previousAppointmentId).toBe(a);

    const stored = await prisma.appointment.findMany({ where: { id: { in: [a, b, c.appointmentId] } } });
    const byId = Object.fromEntries(stored.map((s) => [s.id, s.status]));
    expect(byId).toEqual({ [a]: 'RESCHEDULED', [b]: 'RESCHEDULED', [c.appointmentId]: 'CONFIRMED' });
  });
});

describe('Reschedule lookup and conflicts', () => {
  test('default lookup by phone returns only the new CONFIRMED appointment', async () => {
    const id = (await book()).body.appointmentId;
    const newId = (await reschedule(id)).body.appointmentId;
    const res = await agent.get('/api/appointments').query({ phone: PHONE });
    expect(res.body.map((a) => a.appointmentId)).toEqual([newId]);
    const hist = await agent.get('/api/appointments').query({ phone: PHONE, includeHistory: 'true' });
    expect(hist.body).toHaveLength(2);
  });

  test('rescheduling onto its own current slot is rejected with 409', async () => {
    const id = (await book()).body.appointmentId;
    const res = await reschedule(id, { appointmentDate: DATE_A, slotTime: '13:00' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SLOT_UNAVAILABLE');
    expect((await agent.get(`/api/appointments/${id}`)).body.status).toBe('CONFIRMED');
  });

  test('failed reschedule (slot taken) writes no RESCHEDULING SMS', async () => {
    await book({ patientPhone: '9111222333', appointmentDate: DATE_B, slotTime: '11:00' });
    const id = (await book()).body.appointmentId;
    const res = await reschedule(id);
    expect(res.status).toBe(409);
    expect(await prisma.smsLog.count({ where: { messageType: 'RESCHEDULING' } })).toBe(0);
  });
});

describe('Privacy', () => {
  test('responses never expose the patient phone number', async () => {
    const res = await book();
    expect(JSON.stringify(res.body)).not.toContain(PHONE);
    expect(res.body).not.toHaveProperty('patientPhone');
    expect(res.body).not.toHaveProperty('patientPhoneHash');
  });
});

describe('Known gap (documented, not asserted)', () => {
  test.todo('rescheduling an already CANCELLED appointment should be rejected (service does not check status today)');
});
