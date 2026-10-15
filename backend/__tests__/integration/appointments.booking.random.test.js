const request = require('supertest');
const app = require('../../src/app');
const prisma = require('../../src/lib/prisma');
const SlotService = require('../../src/services/SlotService');

let agent;
let doctor;

const DATE = '2027-08-02'; // Monday

const base = (overrides = {}) => ({
  patientName: 'Ravi Kumar',
  patientPhone: '9876543210',
  appointmentDate: DATE,
  ...overrides,
});

const fillSlots = (slots) =>
  prisma.appointment.createMany({
    data: slots.map((slotTime, i) => ({
      patientName: `Filler ${i}`,
      patientPhone: 'x',
      patientPhoneHash: `filler-${i}`,
      doctorId: doctor.id,
      appointmentDate: new Date(DATE),
      slotTime,
      status: 'CONFIRMED',
    })),
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

describe('POST /api/appointments — optional doctor / slot', () => {
  test('201 department only: assigns a doctor from that department and a valid slot', async () => {
    const res = await agent.post('/api/appointments').send(base({ departmentId: doctor.departmentId }));
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('CONFIRMED');
    const assigned = await prisma.doctor.findUnique({ where: { id: res.body.doctorId } });
    expect(assigned.departmentId).toBe(doctor.departmentId);
    expect(SlotService.validateSlot(res.body.slotTime)).toBe(true);
  });

  test('201 doctor without slot: assigns an open slot for that doctor', async () => {
    const res = await agent.post('/api/appointments').send(base({ doctorId: doctor.id }));
    expect(res.status).toBe(201);
    expect(res.body.doctorId).toBe(doctor.id);
    expect(SlotService.validateSlot(res.body.slotTime)).toBe(true);
  });

  test('201 department + slot without doctor: honours the requested slot', async () => {
    const res = await agent
      .post('/api/appointments')
      .send(base({ departmentId: doctor.departmentId, slotTime: '12:30' }));
    expect(res.status).toBe(201);
    expect(res.body.slotTime).toBe('12:30');
  });

  test('201 explicit doctor + slot still works (backward compatible)', async () => {
    const res = await agent.post('/api/appointments').send(base({ doctorId: doctor.id, slotTime: '14:00' }));
    expect(res.status).toBe(201);
    expect(res.body.doctorId).toBe(doctor.id);
    expect(res.body.slotTime).toBe('14:00');
  });

  test('auto-assigned slot is never one that is already booked', async () => {
    const [keep, ...rest] = SlotService.generateAllSlots();
    await fillSlots(rest);
    const res = await agent.post('/api/appointments').send(base({ doctorId: doctor.id }));
    expect(res.status).toBe(201);
    expect(res.body.slotTime).toBe(keep);
  });

  test('409 NO_SLOTS_AVAILABLE when the chosen doctor is fully booked', async () => {
    await fillSlots(SlotService.generateAllSlots());
    const res = await agent.post('/api/appointments').send(base({ doctorId: doctor.id }));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NO_SLOTS_AVAILABLE');
    expect(res.body.error.field).toBe('slotTime');
  });

  test('422 when neither doctor nor department is supplied', async () => {
    const res = await agent.post('/api/appointments').send(base());
    expect(res.status).toBe(422);
    expect(res.body.error.field).toBe('departmentId');
  });

  test('404 DOCTOR_NOT_FOUND for an unknown doctor id', async () => {
    const res = await agent
      .post('/api/appointments')
      .send(base({ doctorId: '00000000-0000-4000-8000-000000000000', slotTime: '14:00' }));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('DOCTOR_NOT_FOUND');
  });
});
