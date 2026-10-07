const request = require('supertest');
const app = require('../../src/app');
const prisma = require('../../src/lib/prisma');

let agent;
let cardioDoctor;

const FUTURE_DATE = '2027-06-14'; // Monday, well in the future
const SUNDAY_DATE = '2027-06-13'; // Sunday

beforeAll(async () => {
  agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username: 'receptionist', password: 'admin123' });
  cardioDoctor = await prisma.doctor.findFirst({ where: { name: 'Dr. Arjun Mehta' } });
});

beforeEach(async () => {
  await prisma.smsLog.deleteMany();
  await prisma.appointment.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/slots', () => {
  test('returns 18 slots for a fresh doctor+date', async () => {
    const res = await agent.get('/api/slots').query({ doctorId: cardioDoctor.id, date: FUTURE_DATE });
    expect(res.status).toBe(200);
    expect(res.body.availableSlots).toHaveLength(18);
    expect(res.body.availableSlots[0]).toBe('10:00');
    expect(res.body.availableSlots[17]).toBe('18:30');
  });

  test('excludes an already-booked slot', async () => {
    await agent.post('/api/appointments').send({
      patientName: 'Test Patient',
      patientPhone: '9000000001',
      doctorId: cardioDoctor.id,
      appointmentDate: FUTURE_DATE,
      slotTime: '14:00',
    });
    const res = await agent.get('/api/slots').query({ doctorId: cardioDoctor.id, date: FUTURE_DATE });
    expect(res.status).toBe(200);
    expect(res.body.availableSlots).toHaveLength(17);
    expect(res.body.availableSlots).not.toContain('14:00');
  });

  test('restores a cancelled slot to available', async () => {
    const bookRes = await agent.post('/api/appointments').send({
      patientName: 'Test Patient',
      patientPhone: '9000000002',
      doctorId: cardioDoctor.id,
      appointmentDate: FUTURE_DATE,
      slotTime: '15:30',
    });
    const id = bookRes.body.appointmentId;
    await agent.patch(`/api/appointments/${id}/cancel`);

    const slotsRes = await agent.get('/api/slots').query({ doctorId: cardioDoctor.id, date: FUTURE_DATE });
    expect(slotsRes.body.availableSlots).toContain('15:30');
    expect(slotsRes.body.availableSlots).toHaveLength(18);
  });

  test('422 when doctorId is missing', async () => {
    const res = await agent.get('/api/slots').query({ date: FUTURE_DATE });
    expect(res.status).toBe(422);
  });

  test('422 when date is missing', async () => {
    const res = await agent.get('/api/slots').query({ doctorId: cardioDoctor.id });
    expect(res.status).toBe(422);
  });

  test('422 for a Sunday date', async () => {
    const res = await agent.get('/api/slots').query({ doctorId: cardioDoctor.id, date: SUNDAY_DATE });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_DATE');
  });

  test('401 without auth', async () => {
    const res = await request(app)
      .get('/api/slots')
      .query({ doctorId: cardioDoctor.id, date: FUTURE_DATE });
    expect(res.status).toBe(401);
  });
});
