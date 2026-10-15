const request = require('supertest');
const app = require('../../src/app');
const prisma = require('../../src/lib/prisma');

let agent;
let appointmentId;

beforeAll(async () => {
  agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username: 'receptionist', password: 'admin123' });
  const doctor = await prisma.doctor.findFirst({ where: { name: 'Dr. Arjun Mehta' } });
  await prisma.smsLog.deleteMany();
  await prisma.appointment.deleteMany();
  const res = await agent.post('/api/appointments').send({
    patientName: 'Ravi Kumar',
    patientPhone: '9876543210',
    doctorId: doctor.id,
    appointmentDate: '2027-08-03',
    slotTime: '15:00',
  });
  appointmentId = res.body.appointmentId;
});

afterAll(async () => {
  await prisma.$disconnect();
});

const setLog = (data) => prisma.smsLog.updateMany({ where: { appointmentId }, data });

describe('GET /api/appointments/:id/sms', () => {
  test('404 for an unknown appointment', async () => {
    const res = await agent.get('/api/appointments/00000000-0000-4000-8000-000000000000/sms');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('APPOINTMENT_NOT_FOUND');
  });

  test('FAILED with fewer than 3 attempts is not failedAfterRetries', async () => {
    await setLog({ status: 'FAILED', attemptCount: 2 });
    const res = await agent.get(`/api/appointments/${appointmentId}/sms`);
    expect(res.status).toBe(200);
    expect(res.body.latest.status).toBe('FAILED');
    expect(res.body.failedAfterRetries).toBe(false);
  });

  test('FAILED with 3 attempts is failedAfterRetries', async () => {
    await setLog({ status: 'FAILED', attemptCount: 3 });
    const res = await agent.get(`/api/appointments/${appointmentId}/sms`);
    expect(res.body.latest.attemptCount).toBe(3);
    expect(res.body.failedAfterRetries).toBe(true);
  });

  test('SENT is never failedAfterRetries', async () => {
    await setLog({ status: 'SENT', attemptCount: 3 });
    const res = await agent.get(`/api/appointments/${appointmentId}/sms`);
    expect(res.body.failedAfterRetries).toBe(false);
  });

  test('no SMS log yet -> latest null', async () => {
    await prisma.smsLog.deleteMany({ where: { appointmentId } });
    const res = await agent.get(`/api/appointments/${appointmentId}/sms`);
    expect(res.status).toBe(200);
    expect(res.body.latest).toBeNull();
    expect(res.body.failedAfterRetries).toBe(false);
  });
});
