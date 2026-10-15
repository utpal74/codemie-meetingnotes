// AC-2 (Mon-Sat 10:00-18:30, reject Sundays) and the error envelope { error: { code, message, field } }.
const request = require('supertest');
const app = require('../../src/app');
const prisma = require('../../src/lib/prisma');
const SlotService = require('../../src/services/SlotService');

let agent;
let doctor;

const MONDAY = '2027-09-13';
const SATURDAY = '2027-09-18';
const SUNDAY = '2027-09-19';
const UNKNOWN_UUID = '00000000-0000-4000-8000-000000000001';

const book = (overrides = {}) => ({
  patientName: 'Meera Nair',
  patientPhone: '9123456780',
  doctorId: doctor?.id,
  appointmentDate: MONDAY,
  slotTime: '14:00',
  ...overrides,
});

const expectEnvelope = (res, status, code, field) => {
  expect(res.status).toBe(status);
  expect(res.body.error.code).toBe(code);
  expect(res.body.error.message).toEqual(expect.any(String));
  expect(res.body.error).toHaveProperty('field');
  if (field !== undefined) expect(res.body.error.field).toBe(field);
};

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

describe('Sunday rejection (AC-2)', () => {
  test('POST doctor + slot on a Sunday -> 422 VALIDATION_ERROR on appointmentDate', async () => {
    const res = await agent.post('/api/appointments').send(book({ appointmentDate: SUNDAY }));
    expectEnvelope(res, 422, 'VALIDATION_ERROR', 'appointmentDate');
  });

  test('POST department only (any doctor) on a Sunday -> 422', async () => {
    const res = await agent
      .post('/api/appointments')
      .send(book({ appointmentDate: SUNDAY, doctorId: undefined, slotTime: undefined, departmentId: doctor.departmentId }));
    expectEnvelope(res, 422, 'VALIDATION_ERROR', 'appointmentDate');
  });

  test('reschedule to a Sunday -> 422 and the original stays CONFIRMED', async () => {
    const booked = await agent.post('/api/appointments').send(book());
    const id = booked.body.appointmentId;
    const res = await agent.patch(`/api/appointments/${id}/reschedule`).send({ appointmentDate: SUNDAY, slotTime: '11:00' });
    expectEnvelope(res, 422, 'VALIDATION_ERROR', 'appointmentDate');
    expect((await agent.get(`/api/appointments/${id}`)).body.status).toBe('CONFIRMED');
  });

  test('GET /api/slots for a Sunday -> 422 INVALID_DATE on date', async () => {
    const res = await agent.get('/api/slots').query({ doctorId: doctor.id, date: SUNDAY });
    expectEnvelope(res, 422, 'INVALID_DATE', 'date');
  });

  test('past date -> 422 VALIDATION_ERROR', async () => {
    const res = await agent.post('/api/appointments').send(book({ appointmentDate: '2020-06-01' }));
    expectEnvelope(res, 422, 'VALIDATION_ERROR', 'appointmentDate');
  });

  test('unparseable date string never produces a 5xx', async () => {
    const res = await agent.post('/api/appointments').send(book({ appointmentDate: 'not-a-date' }));
    expect(res.status).toBeLessThan(500);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe('Slot range 10:00-18:30 every 30 min (AC-2)', () => {
  test('GET /api/slots Monday lists 18 slots from 10:00 to 18:30', async () => {
    const res = await agent.get('/api/slots').query({ doctorId: doctor.id, date: MONDAY });
    expect(res.status).toBe(200);
    expect(res.body.availableSlots).toHaveLength(18);
    expect(res.body.availableSlots[0]).toBe('10:00');
    expect(res.body.availableSlots[17]).toBe('18:30');
  });

  test('GET /api/slots Saturday is a working day', async () => {
    const res = await agent.get('/api/slots').query({ doctorId: doctor.id, date: SATURDAY });
    expect(res.status).toBe(200);
    expect(res.body.availableSlots).toHaveLength(18);
  });

  test.each(['10:00', '18:30'])('boundary slot %s can be booked on a Saturday', async (slotTime) => {
    const res = await agent.post('/api/appointments').send(book({ slotTime, appointmentDate: SATURDAY }));
    expect(res.status).toBe(201);
    expect(res.body.slotTime).toBe(slotTime);
  });

  test.each(['09:30', '19:00', '10:15', '23:30'])('out-of-range / off-grid slot %s -> 422', async (slotTime) => {
    const res = await agent.post('/api/appointments').send(book({ slotTime }));
    expect(res.status).toBe(422);
    expect(res.body.error.field).toEqual(expect.any(String));
    expect(res.body.error.code).toMatch(/INVALID_DATE|VALIDATION_ERROR/);
  });

  test('malformed slot format 9am -> 422 VALIDATION_ERROR on slotTime', async () => {
    const res = await agent.post('/api/appointments').send(book({ slotTime: '9am' }));
    expectEnvelope(res, 422, 'VALIDATION_ERROR', 'slotTime');
  });

  test('reschedule to an out-of-range slot -> 422 and original untouched', async () => {
    const booked = await agent.post('/api/appointments').send(book());
    const id = booked.body.appointmentId;
    const res = await agent.patch(`/api/appointments/${id}/reschedule`).send({ appointmentDate: MONDAY, slotTime: '19:00' });
    expect(res.status).toBe(422);
    expect((await agent.get(`/api/appointments/${id}`)).body.status).toBe('CONFIRMED');
  });
});

describe('Random-assignment conflict errors', () => {
  test('unknown department with no doctor -> 409 NO_DOCTOR_AVAILABLE on departmentId', async () => {
    const res = await agent
      .post('/api/appointments')
      .send(book({ doctorId: undefined, slotTime: undefined, departmentId: UNKNOWN_UUID }));
    expectEnvelope(res, 409, 'NO_DOCTOR_AVAILABLE', 'departmentId');
  });

  test('requested slot taken for every doctor in the department -> 409 NO_DOCTOR_AVAILABLE', async () => {
    const doctors = await prisma.doctor.findMany({ where: { departmentId: doctor.departmentId } });
    await prisma.appointment.createMany({
      data: doctors.map((d, i) => ({
        patientName: `Filler ${i}`,
        patientPhone: 'x',
        patientPhoneHash: `err-filler-${i}`,
        doctorId: d.id,
        appointmentDate: new Date(MONDAY),
        slotTime: '11:00',
        status: 'CONFIRMED',
      })),
    });
    const res = await agent
      .post('/api/appointments')
      .send(book({ doctorId: undefined, departmentId: doctor.departmentId, slotTime: '11:00' }));
    expectEnvelope(res, 409, 'NO_DOCTOR_AVAILABLE', 'departmentId');
  });

  test('every doctor in the department fully booked for the day -> 409 NO_SLOTS_AVAILABLE', async () => {
    const doctors = await prisma.doctor.findMany({ where: { departmentId: doctor.departmentId } });
    const rows = [];
    doctors.forEach((d, di) =>
      SlotService.generateAllSlots().forEach((slotTime, si) =>
        rows.push({
          patientName: `Full ${di}-${si}`,
          patientPhone: 'x',
          patientPhoneHash: `full-${di}-${si}`,
          doctorId: d.id,
          appointmentDate: new Date(MONDAY),
          slotTime,
          status: 'CONFIRMED',
        })
      )
    );
    await prisma.appointment.createMany({ data: rows });
    const res = await agent
      .post('/api/appointments')
      .send(book({ doctorId: undefined, slotTime: undefined, departmentId: doctor.departmentId }));
    expectEnvelope(res, 409, 'NO_SLOTS_AVAILABLE', 'slotTime');
  });

  test('unknown doctorId -> 404 DOCTOR_NOT_FOUND on doctorId', async () => {
    const res = await agent.post('/api/appointments').send(book({ doctorId: UNKNOWN_UUID }));
    expectEnvelope(res, 404, 'DOCTOR_NOT_FOUND', 'doctorId');
  });

  test('malformed doctorId -> 422 VALIDATION_ERROR on doctorId', async () => {
    const res = await agent.post('/api/appointments').send(book({ doctorId: 'abc' }));
    expectEnvelope(res, 422, 'VALIDATION_ERROR', 'doctorId');
  });
});

describe('Lookup / slots parameter errors', () => {
  test('GET /api/appointments without phone -> 422 MISSING_PARAMS on phone', async () => {
    expectEnvelope(await agent.get('/api/appointments'), 422, 'MISSING_PARAMS', 'phone');
  });

  test('GET /api/slots without doctorId/date -> 422 MISSING_PARAMS', async () => {
    expectEnvelope(await agent.get('/api/slots'), 422, 'MISSING_PARAMS');
  });

  test('GET /api/slots with garbage date -> 422 INVALID_DATE', async () => {
    const res = await agent.get('/api/slots').query({ doctorId: doctor.id, date: 'nope' });
    expectEnvelope(res, 422, 'INVALID_DATE', 'date');
  });

  test('cancel / reschedule / sms for an unknown id -> 404 APPOINTMENT_NOT_FOUND', async () => {
    const id = UNKNOWN_UUID;
    expectEnvelope(await agent.patch(`/api/appointments/${id}/cancel`), 404, 'APPOINTMENT_NOT_FOUND');
    expectEnvelope(
      await agent.patch(`/api/appointments/${id}/reschedule`).send({ appointmentDate: MONDAY, slotTime: '11:00' }),
      404,
      'APPOINTMENT_NOT_FOUND'
    );
    expectEnvelope(await agent.get(`/api/appointments/${id}/sms`), 404, 'APPOINTMENT_NOT_FOUND');
  });
});
