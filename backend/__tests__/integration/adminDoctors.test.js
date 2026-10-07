const request = require('supertest');
const app = require('../../src/app');
const prisma = require('../../src/lib/prisma');

describe('Admin Doctors API', () => {
  let admin;
  let dept;

  beforeAll(async () => {
    admin = request.agent(app);
    await admin.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
    dept = await prisma.department.create({ data: { name: 'TestDept Doctors' } });
  });

  afterAll(async () => {
    await prisma.doctor.deleteMany({ where: { name: { contains: 'TestDr' } } });
    await prisma.department.deleteMany({ where: { name: { in: ['TestDept Doctors'] } } });
  });

  test('can create a doctor', async () => {
    const res = await admin.post('/api/admin/doctors').send({ name: 'TestDr One', departmentId: dept.id });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('TestDr One');
    expect(res.body.departmentId).toBe(dept.id);
    expect(res.body.isActive).toBe(true);
  });

  test('cannot activate a doctor when department is inactive', async () => {
    const created = await admin.post('/api/admin/doctors').send({ name: 'TestDr Two', departmentId: dept.id });
    const doctorId = created.body.id;

    // deactivate department
    await admin.patch(`/api/admin/departments/${dept.id}/status`).send({ isActive: false });

    const res = await admin.patch(`/api/admin/doctors/${doctorId}/status`).send({ isActive: true });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DEPARTMENT_INACTIVE');

    // re-activate department for cleanup / other tests
    await admin.patch(`/api/admin/departments/${dept.id}/status`).send({ isActive: true });
  });

  test('receptionist doctor list excludes inactive doctors and inactive departments', async () => {
    const created = await admin.post('/api/admin/doctors').send({ name: 'TestDr Three', departmentId: dept.id });
    const doctorId = created.body.id;

    await admin.patch(`/api/admin/doctors/${doctorId}/status`).send({ isActive: false });

    const receptionist = request.agent(app);
    await receptionist.post('/api/auth/login').send({ username: 'receptionist', password: 'admin123' });
    const listRes = await receptionist.get(`/api/doctors?departmentId=${dept.id}`);
    expect(listRes.status).toBe(200);
    const names = listRes.body.map((d) => d.name);
    expect(names).not.toContain('TestDr Three');

    // make department inactive and ensure list empty
    await admin.patch(`/api/admin/departments/${dept.id}/status`).send({ isActive: false });
    const listRes2 = await receptionist.get(`/api/doctors?departmentId=${dept.id}`);
    expect(listRes2.status).toBe(200);
    expect(listRes2.body.length).toBe(0);

    await admin.patch(`/api/admin/departments/${dept.id}/status`).send({ isActive: true });
  });
});
