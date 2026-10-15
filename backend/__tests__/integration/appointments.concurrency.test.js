// AC-4: prevent double booking under true concurrency; map serialization failures to 409 envelope.
const request = require('supertest');
const app = require('../../src/app');
const prisma = require('../../src/lib/prisma');

let agent;
let doctor;

const DATE = '2027-09-06'; // Monday
const DATE_B = '2027-09-07'; // Tuesday
const PARALLEL = 6;

const phone = (i) => `98765432${String(10 + i).padStart(2, '0')}`;

const booking = (i, overrides = {}) => ({
  patientName: `Parallel Patient ${i}`,
  patientPhone: phone(i),
  doctorId: doctor.id,
  appointmentDate: DATE,
  slotTime: '10:00',
  ...overrides,
});

const confirmedCount = (where) => prisma.appointment.count({ where: { status: 'CONFIRMED', ...where } });

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

describe('Concurrent booking of the same slot (AC-4)', () => {
  test(`${PARALLEL} simultaneous bookings: exactly one 201, the rest 409 SLOT_UNAVAILABLE`, async () => {
    const responses = await Promise.all(
      Array.from({ length: PARALLEL }, (_, i) => agent.post('/api/appointments').send(booking(i)))
    );

    const statuses = responses.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(PARALLEL - 1);

    for (const r of responses.filter((x) => x.status === 409)) {
      expect(r.body.error.code).toBe('SLOT_UNAVAILABLE');
      expect(r.body.error.field).toBe('slotTime');
      expect(r.body.error.message).toEqual(expect.any(String));
    }
  });

  test('database holds exactly one CONFIRMED row for the contested slot', async () => {
    await Promise.all(Array.from({ length: PARALLEL }, (_, i) => agent.post('/api/appointments').send(booking(i))));
    const count = await confirmedCount({ doctorId: doctor.id, appointmentDate: new Date(DATE), slotTime: '10:00' });
    expect(count).toBe(1);
  });

  test('the same slot for a different doctor never 5xx and at least one succeeds', async () => {
    const other = await prisma.doctor.findFirst({ where: { id: { not: doctor.id } } });
    const [a, b] = await Promise.all([
      agent.post('/api/appointments').send(booking(1)),
      agent.post('/api/appointments').send(booking(2, { doctorId: other.id })),
    ]);
    // Serializable isolation may reject one with 409 on predicate-lock overlap; nothing may 5xx.
    expect([201, 409]).toContain(a.status);
    expect([201, 409]).toContain(b.status);
    expect([a.status, b.status]).toContain(201);
  });

  test('simultaneous bookings of different slots for one doctor never 5xx and match DB state', async () => {
    const slots = ['10:00', '10:30', '11:00', '11:30'];
    const responses = await Promise.all(
      slots.map((slotTime, i) => agent.post('/api/appointments').send(booking(i, { slotTime })))
    );
    for (const r of responses) expect([201, 409]).toContain(r.status);
    expect(responses.some((r) => r.status === 201)).toBe(true);
    expect(await confirmedCount({ doctorId: doctor.id, appointmentDate: new Date(DATE) })).toBe(
      responses.filter((r) => r.status === 201).length
    );
  });

  test('concurrent "any slot" bookings never produce a duplicate (doctor, date, slot)', async () => {
    const responses = await Promise.all(
      Array.from({ length: PARALLEL }, (_, i) =>
        agent.post('/api/appointments').send({
          patientName: `Auto ${i}`,
          patientPhone: phone(i),
          doctorId: doctor.id,
          appointmentDate: DATE,
        })
      )
    );
    for (const r of responses) expect([201, 409]).toContain(r.status);

    const rows = await prisma.appointment.findMany({
      where: { doctorId: doctor.id, appointmentDate: new Date(DATE), status: 'CONFIRMED' },
      select: { slotTime: true },
    });
    const slots = rows.map((r) => r.slotTime);
    expect(new Set(slots).size).toBe(slots.length);
    expect(slots.length).toBe(responses.filter((r) => r.status === 201).length);
  });
});

describe('Concurrent reschedule into the same slot (AC-4 / AC-7)', () => {
  test('two appointments rescheduling to one slot: exactly one wins, loser stays CONFIRMED', async () => {
    const a = await agent.post('/api/appointments').send(booking(1, { slotTime: '12:00' }));
    const b = await agent.post('/api/appointments').send(booking(2, { slotTime: '12:30' }));
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);

    const target = { appointmentDate: DATE_B, slotTime: '15:00' };
    const results = await Promise.all([
      agent.patch(`/api/appointments/${a.body.appointmentId}/reschedule`).send(target),
      agent.patch(`/api/appointments/${b.body.appointmentId}/reschedule`).send(target),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const loser = results.find((r) => r.status === 409);
    expect(loser.body.error.code).toBe('SLOT_UNAVAILABLE');

    expect(await confirmedCount({ doctorId: doctor.id, appointmentDate: new Date(DATE_B), slotTime: '15:00' })).toBe(1);

    // The losing original must not have been flipped to RESCHEDULED (transaction rolled back).
    const loserOriginalId = results[0].status === 409 ? a.body.appointmentId : b.body.appointmentId;
    const loserOriginal = await agent.get(`/api/appointments/${loserOriginalId}`);
    expect(loserOriginal.body.status).toBe('CONFIRMED');
  });
});
