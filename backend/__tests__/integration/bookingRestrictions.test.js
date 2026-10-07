const request = require('supertest');
const app = require('../../src/app');
const prisma = require('../../src/lib/prisma');

describe('Booking restrictions for inactive doctor/department', () => {
  let receptionist;
  let admin;
  let dept;
  let doctor;

  const DATE = '2027-07-05'; // Monday

  beforeAll(async () => {
    receptionist = request.agent(app);
    await receptionist.post('/api/auth/login').send({ username: 'receptionist', password: 'admin123' });

    admin = request.agent(app);
    await admin.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    dept = await prisma.department.create({ data: { name: 'TestDept BookingRestrict' } });
    doctor = await prisma.doctor.create({ data: { name: 'TestDr BookingRestrict', departmentId: dept.id } });
  });

  afterAll(async () => {
    await prisma.appointment.deleteMany({ where: { doctorId: doctor?.id } });
    await prisma.doctor.deleteMany({ where: { id: doctor?.id } });
    await prisma.department.deleteMany({ where: { id: dept?.id } });
  });

  beforeEach(async () => {
    await prisma.smsLog.deleteMany();
    await prisma.appointment.deleteMany({});

    // reset active
    await prisma.department.update({ where: { id: dept.id }, data: { isActive: true } });
    await prisma.doctor.update({ where: { id: doctor.id }, data: { isActive: true } });
  });

  test('cannot create a new booking when doctor is inactive', async () => {
    await admin.patch(`/api/admin/doctors/${doctor.id}/status`).send({ isActive: false });

    const res = await receptionist.post('/api/appointments').send({
      patientName: 'Ravi Kumar',
      patientPhone: '9876543210',
      doctorId: doctor.id,
      appointmentDate: DATE,
      slotTime: '10:00',
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DOCTOR_INACTIVE');
  });

  test('cannot create a new booking when department is inactive', async () => {
    await admin.patch(`/api/admin/departments/${dept.id}/status`).send({ isActive: false });

    const res = await receptionist.post('/api/appointments').send({
      patientName: 'Ravi Kumar',
      patientPhone: '9876543210',
      doctorId: doctor.id,
      appointmentDate: DATE,
      slotTime: '10:30',
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DEPARTMENT_INACTIVE');
  });

  test('historical appointment remains fetchable even after doctor/department deactivated', async () => {
    const created = await receptionist.post('/api/appointments').send({
      patientName: 'Ravi Kumar',
      patientPhone: '9876543210',
      doctorId: doctor.id,
      appointmentDate: DATE,
      slotTime: '11:00',
    });
    expect(created.status).toBe(201);

    const apptId = created.body.appointmentId;

    await admin.patch(`/api/admin/doctors/${doctor.id}/status`).send({ isActive: false });
    await admin.patch(`/api/admin/departments/${dept.id}/status`).send({ isActive: false });

    const fetched = await receptionist.get(`/api/appointments/${apptId}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.appointmentId).toBe(apptId);
    expect(fetched.body.doctorId).toBe(doctor.id);
  });
});
