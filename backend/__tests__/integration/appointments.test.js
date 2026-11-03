const request = require('supertest');
const app = require('../../src/app');
const prisma = require('../../src/lib/prisma');

let agent;
let doctor;

const DATE_A = '2027-07-05'; // Monday
const DATE_B = '2027-07-06'; // Tuesday
const SUNDAY = '2027-07-04'; // Sunday

const makeBooking = (overrides = {}) => ({
  patientName: 'Ravi Kumar',
  patientPhone: '9876543210',
  doctorId: doctor?.id,
  appointmentDate: DATE_A,
  slotTime: '14:00',
  ...overrides,
});

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

// ─── Happy Path ───────────────────────────────────────────────────────────────

describe('POST /api/appointments — booking', () => {
  test('201 creates a CONFIRMED appointment', async () => {
    const res = await agent.post('/api/appointments').send(makeBooking());
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('CONFIRMED');
    expect(res.body.appointmentId).toBeDefined();
  });

  test('response includes doctorId (CR-01 fix)', async () => {
    const res = await agent.post('/api/appointments').send(makeBooking());
    expect(res.body.doctorId).toBe(doctor.id);
  });

  test('response includes smsStatus field', async () => {
    const res = await agent.post('/api/appointments').send(makeBooking());
    expect(['SENT', 'PENDING_RETRY', 'FAILED', 'DISABLED']).toContain(res.body.smsStatus);
  });

  test('response includes correct doctor name and department', async () => {
    const res = await agent.post('/api/appointments').send(makeBooking());
    expect(res.body.doctor).toBe('Dr. Arjun Mehta');
    expect(res.body.department).toBe('Cardiology');
  });
});

// ─── Lookup ───────────────────────────────────────────────────────────────────

describe('GET /api/appointments', () => {
  test('GET /:id returns the appointment by ID', async () => {
    const booked = await agent.post('/api/appointments').send(makeBooking());
    const id = booked.body.appointmentId;
    const res = await agent.get(`/api/appointments/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.appointmentId).toBe(id);
    expect(res.body.patientName).toBe('Ravi Kumar');
  });

  test('GET ?phone= returns the appointment list', async () => {
    await agent.post('/api/appointments').send(makeBooking());
    const res = await agent.get('/api/appointments').query({ phone: '9876543210' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].patientName).toBe('Ravi Kumar');
  });

  test('GET ?phone= returns empty array for unknown phone', async () => {
    const res = await agent.get('/api/appointments').query({ phone: '9000099999' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  test('GET /:id → 404 for nonexistent ID', async () => {
    const res = await agent.get('/api/appointments/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('APPOINTMENT_NOT_FOUND');
  });

  test('GET without phone param → 422', async () => {
    const res = await agent.get('/api/appointments');
    expect(res.status).toBe(422);
  });
});

// ─── Cancellation ─────────────────────────────────────────────────────────────

describe('PATCH /api/appointments/:id/cancel', () => {
  test('200 cancels a CONFIRMED appointment', async () => {
    const booked = await agent.post('/api/appointments').send(makeBooking());
    const id = booked.body.appointmentId;
    const res = await agent.patch(`/api/appointments/${id}/cancel`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
  });

  test('cancelled slot becomes available again', async () => {
    const booked = await agent.post('/api/appointments').send(makeBooking());
    const id = booked.body.appointmentId;
    await agent.patch(`/api/appointments/${id}/cancel`);

    const slotsRes = await agent.get('/api/slots').query({ doctorId: doctor.id, date: DATE_A });
    expect(slotsRes.body.availableSlots).toContain('14:00');
  });

  test('409 when cancelling an already-CANCELLED appointment', async () => {
    const booked = await agent.post('/api/appointments').send(makeBooking());
    const id = booked.body.appointmentId;
    await agent.patch(`/api/appointments/${id}/cancel`);
    const res = await agent.patch(`/api/appointments/${id}/cancel`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('APPOINTMENT_ALREADY_CANCELLED');
  });

  test('409 when cancelling a RESCHEDULED appointment (CR-09 fix)', async () => {
    const booked = await agent.post('/api/appointments').send(makeBooking());
    const id = booked.body.appointmentId;
    await agent.patch(`/api/appointments/${id}/reschedule`).send({ appointmentDate: DATE_B, slotTime: '11:00' });
    const res = await agent.patch(`/api/appointments/${id}/cancel`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('APPOINTMENT_ALREADY_CANCELLED');
  });
});

// ─── Rescheduling ─────────────────────────────────────────────────────────────

describe('PATCH /api/appointments/:id/reschedule', () => {
  test('201 creates a new CONFIRMED appointment', async () => {
    const booked = await agent.post('/api/appointments').send(makeBooking());
    const id = booked.body.appointmentId;
    const res = await agent.patch(`/api/appointments/${id}/reschedule`).send({ appointmentDate: DATE_B, slotTime: '11:00' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('CONFIRMED');
    expect(res.body.slotTime).toBe('11:00');
  });

  test('new appointment links back via previousAppointmentId', async () => {
    const booked = await agent.post('/api/appointments').send(makeBooking());
    const id = booked.body.appointmentId;
    const res = await agent.patch(`/api/appointments/${id}/reschedule`).send({ appointmentDate: DATE_B, slotTime: '11:00' });
    expect(res.body.previousAppointmentId).toBe(id);
  });

  test('original appointment becomes RESCHEDULED', async () => {
    const booked = await agent.post('/api/appointments').send(makeBooking());
    const id = booked.body.appointmentId;
    await agent.patch(`/api/appointments/${id}/reschedule`).send({ appointmentDate: DATE_B, slotTime: '11:00' });
    const orig = await agent.get(`/api/appointments/${id}`);
    expect(orig.body.status).toBe('RESCHEDULED');
  });

  test('old slot freed, new slot consumed', async () => {
    const booked = await agent.post('/api/appointments').send(makeBooking());
    const id = booked.body.appointmentId;
    await agent.patch(`/api/appointments/${id}/reschedule`).send({ appointmentDate: DATE_B, slotTime: '11:00' });

    const slotsA = await agent.get('/api/slots').query({ doctorId: doctor.id, date: DATE_A });
    const slotsB = await agent.get('/api/slots').query({ doctorId: doctor.id, date: DATE_B });
    expect(slotsA.body.availableSlots).toContain('14:00');  // freed
    expect(slotsB.body.availableSlots).not.toContain('11:00'); // consumed
  });

  test('409 when rescheduling to an already-booked slot', async () => {
    await agent.post('/api/appointments').send(makeBooking({ slotTime: '11:00', appointmentDate: DATE_B }));
    const booked2 = await agent.post('/api/appointments').send(makeBooking({ patientPhone: '9111222333' }));
    const id2 = booked2.body.appointmentId;
    const res = await agent.patch(`/api/appointments/${id2}/reschedule`).send({ appointmentDate: DATE_B, slotTime: '11:00' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SLOT_UNAVAILABLE');
  });
});

// ─── Concurrency / Double-booking ─────────────────────────────────────────────

describe('Double-booking prevention (CR-03)', () => {
  test('two sequential bookings of the same slot — second gets 409', async () => {
    const booking = makeBooking({ slotTime: '16:00' });
    const r1 = await agent.post('/api/appointments').send(booking);
    const r2 = await agent.post('/api/appointments').send({ ...booking, patientPhone: '9111000001' });
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(409);
    expect(r2.body.error.code).toBe('SLOT_ALREADY_BOOKED');
    expect(r2.body.error.field).toBe('slotTime');
  });

  test('concurrent bookings of the same slot - exactly one 201, one 409 SLOT_ALREADY_BOOKED', async () => {
    const booking = makeBooking({ slotTime: '16:30' });
    const results = await Promise.all([
      agent.post('/api/appointments').send({ ...booking, patientPhone: '9111000002' }),
      agent.post('/api/appointments').send({ ...booking, patientPhone: '9111000003' }),
    ]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409]);
    const loser = results.find((r) => r.status === 409);
    expect(loser.body.error.code).toBe('SLOT_ALREADY_BOOKED');
    const confirmed = await prisma.appointment.count({
      where: { doctorId: doctor.id, slotTime: '16:30', status: 'CONFIRMED' },
    });
    expect(confirmed).toBe(1);
  });

  test('DB partial unique index rejects a second CONFIRMED row for the same slot', async () => {
    await agent.post('/api/appointments').send(makeBooking({ slotTime: '16:00' }));
    const first = await prisma.appointment.findFirst({ where: { slotTime: '16:00' } });
    await expect(
      prisma.appointment.create({
        data: {
          patientName: 'Dup',
          patientPhone: first.patientPhone,
          patientPhoneHash: first.patientPhoneHash,
          doctorId: first.doctorId,
          appointmentDate: first.appointmentDate,
          slotTime: '16:00',
          status: 'CONFIRMED',
        },
      })
    ).rejects.toMatchObject({ code: 'P2002' });
  });
});

// ─── Validation edge cases ─────────────────────────────────────────────────────

describe('Validation', () => {
  test('422 for Sunday appointment date', async () => {
    const res = await agent.post('/api/appointments').send(makeBooking({ appointmentDate: SUNDAY }));
    expect(res.status).toBe(422);
    expect(res.body.error.field).toBe('appointmentDate');
  });

  test('422 VALIDATION_ERROR on patientMobile for invalid phone number', async () => {
    const res = await agent.post('/api/appointments').send(makeBooking({ patientPhone: '12345' }));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.field).toBe('patientMobile');
  });

  test('422 VALIDATION_ERROR on patientMobile when sent as patientMobile', async () => {
    const { patientPhone, ...rest } = makeBooking();
    const res = await agent.post('/api/appointments').send({ ...rest, patientMobile: '12345' });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatchObject({ code: 'VALIDATION_ERROR', field: 'patientMobile' });
  });

  test('422 for missing required fields', async () => {
    const res = await agent.post('/api/appointments').send({});
    expect(res.status).toBe(422);
  });

  test('401 UNAUTHORIZED envelope when booking without auth', async () => {
    const res = await request(app).post('/api/appointments').send(makeBooking());
    expect(res.status).toBe(401);
    expect(res.body.error).toMatchObject({ code: 'UNAUTHORIZED', field: null });
    expect(typeof res.body.error.message).toBe('string');
  });
});

// EPMCDMETST-70806: patientMobile, role guard, SMS log

describe('POST /api/appointments - EPMCDMETST-70806', () => {
  test('201 when the mobile is sent as patientMobile', async () => {
    const { patientPhone, ...rest } = makeBooking({ slotTime: '15:00' });
    const res = await agent.post('/api/appointments').send({ ...rest, patientMobile: patientPhone });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('CONFIRMED');
  });

  test('booking stores a BOOKING SmsLog row for the appointment', async () => {
    const res = await agent.post('/api/appointments').send(makeBooking({ slotTime: '15:30' }));
    expect(res.status).toBe(201);
    const logs = await prisma.smsLog.findMany({ where: { appointmentId: res.body.appointmentId } });
    expect(logs).toHaveLength(1);
    expect(logs[0].messageType).toBe('BOOKING');
  });

  test('403 FORBIDDEN when the session has no RECEPTIONIST role', () => {
    const { requireRole } = require('../../src/middleware/authenticate');
    const req = { session: { authenticated: true, role: 'OTHER' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    requireRole('RECEPTIONIST')(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.objectContaining({ code: 'FORBIDDEN', field: null }),
    });
  });
});
