const request = require('supertest');
const app = require('../../src/app');
const prisma = require('../../src/lib/prisma');

let agent;

beforeAll(async () => {
  agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username: 'receptionist', password: 'admin123' });
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ─── FR-02: Department and Doctor Catalogue ────────────────────────────────────

describe('GET /api/departments (FR-02)', () => {
  test('200 returns all seeded departments', async () => {
    const res = await agent.get('/api/departments');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(3);
  });

  test('each department has id, name, and doctors array', async () => {
    const res = await agent.get('/api/departments');
    res.body.forEach((dept) => {
      expect(dept).toHaveProperty('id');
      expect(dept).toHaveProperty('name');
      expect(Array.isArray(dept.doctors)).toBe(true);
    });
  });

  test('departments include Cardiology, General Medicine, Bone Health', async () => {
    const res = await agent.get('/api/departments');
    const names = res.body.map((d) => d.name);
    expect(names).toContain('Cardiology');
    expect(names).toContain('General Medicine');
    expect(names).toContain('Bone Health');
  });

  test('each department has at least 2 doctors', async () => {
    const res = await agent.get('/api/departments');
    res.body.forEach((dept) => {
      expect(dept.doctors.length).toBeGreaterThanOrEqual(2);
    });
  });

  test('401 without auth', async () => {
    const res = await request(app).get('/api/departments');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('GET /api/doctors (FR-02)', () => {
  test('200 returns all seeded doctors when no departmentId filter', async () => {
    const res = await agent.get('/api/doctors');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(6);
  });

  test('each doctor record has id, name, and department', async () => {
    const res = await agent.get('/api/doctors');
    res.body.forEach((doc) => {
      expect(doc).toHaveProperty('id');
      expect(doc).toHaveProperty('name');
      expect(doc).toHaveProperty('department');
      expect(doc.department).toHaveProperty('id');
      expect(doc.department).toHaveProperty('name');
    });
  });

  test('GET /api/doctors?departmentId=<id> filters by department', async () => {
    const depts = await agent.get('/api/departments');
    const cardiology = depts.body.find((d) => d.name === 'Cardiology');
    expect(cardiology).toBeDefined();

    const res = await agent.get('/api/doctors').query({ departmentId: cardiology.id });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    res.body.forEach((doc) => {
      expect(doc.department.name).toBe('Cardiology');
    });
  });

  test('GET /api/doctors?departmentId=<id> returns exactly the Cardiology doctors', async () => {
    const depts = await agent.get('/api/departments');
    const cardiology = depts.body.find((d) => d.name === 'Cardiology');

    const res = await agent.get('/api/doctors').query({ departmentId: cardiology.id });
    const names = res.body.map((d) => d.name);
    expect(names).toContain('Dr. Arjun Mehta');
    expect(names).toContain('Dr. Nisha Kapoor');
  });

  test('GET /api/doctors?departmentId=<unknown-uuid> returns empty array', async () => {
    const res = await agent.get('/api/doctors').query({ departmentId: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  test('401 without auth', async () => {
    const res = await request(app).get('/api/doctors');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
