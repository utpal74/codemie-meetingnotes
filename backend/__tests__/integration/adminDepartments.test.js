const request = require('supertest');
const app = require('../../src/app');
const prisma = require('../../src/lib/prisma');

describe('Admin Departments API', () => {
  let admin;

  beforeAll(async () => {
    admin = request.agent(app);
    await admin.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
  });

  afterAll(async () => {
    // cleanup departments created in this file
    await prisma.doctor.deleteMany({});
    await prisma.department.deleteMany({ where: { name: { contains: 'TestDept' } } });
  });

  test('FORBIDDEN for receptionist user', async () => {
    const receptionist = request.agent(app);
    await receptionist.post('/api/auth/login').send({ username: 'receptionist', password: 'admin123' });
    const res = await receptionist.get('/api/admin/departments');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  test('can create a department', async () => {
    const res = await admin.post('/api/admin/departments').send({ name: 'TestDept One' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('TestDept One');
    expect(res.body.isActive).toBe(true);
  });

  test('duplicate department name is rejected case-insensitively', async () => {
    await admin.post('/api/admin/departments').send({ name: 'TestDept Two' });
    const res = await admin.post('/api/admin/departments').send({ name: 'testdept two' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DEPARTMENT_NAME_TAKEN');
  });

  test('status toggle updates isActive and receptionist list excludes inactive departments', async () => {
    const created = await admin.post('/api/admin/departments').send({ name: 'TestDept Three' });
    const id = created.body.id;

    const toggled = await admin.patch(`/api/admin/departments/${id}/status`).send({ isActive: false });
    expect(toggled.status).toBe(200);
    expect(toggled.body.isActive).toBe(false);

    const receptionist = request.agent(app);
    await receptionist.post('/api/auth/login').send({ username: 'receptionist', password: 'admin123' });
    const listRes = await receptionist.get('/api/departments');
    expect(listRes.status).toBe(200);
    const names = listRes.body.map((d) => d.name);
    expect(names).not.toContain('TestDept Three');
  });
});
