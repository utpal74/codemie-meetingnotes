const request = require('supertest');
const app = require('../../src/app');

describe('Auth — POST /api/auth/login & /api/auth/logout', () => {
  describe('login', () => {
    test('200 with correct credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'receptionist', password: 'admin123' });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Login successful');
    });

    test('sets an httpOnly cookie on success', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'receptionist', password: 'admin123' });
      expect(res.headers['set-cookie']).toBeDefined();
      const cookie = res.headers['set-cookie'][0];
      expect(cookie).toContain('HttpOnly');
    });

    test('401 with wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'receptionist', password: 'wrongpassword' });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    test('401 with wrong username', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'admin123' });
      expect(res.status).toBe(401);
    });

    test('422 with empty username', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: '', password: 'admin123' });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('422 with missing body fields', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({});
      expect(res.status).toBe(422);
    });
  });

  describe('protected route enforcement', () => {
    test('GET /api/departments without auth → 401', async () => {
      const res = await request(app).get('/api/departments');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    test('GET /api/departments with valid session → 200', async () => {
      const agent = request.agent(app);
      await agent.post('/api/auth/login').send({ username: 'receptionist', password: 'admin123' });
      const res = await agent.get('/api/departments');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('GET /health is publicly accessible without auth → 200', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('logout', () => {
    test('200 when logged in', async () => {
      const agent = request.agent(app);
      await agent.post('/api/auth/login').send({ username: 'receptionist', password: 'admin123' });
      const res = await agent.post('/api/auth/logout');
      expect(res.status).toBe(200);
    });

    test('after logout, protected routes return 401', async () => {
      const agent = request.agent(app);
      await agent.post('/api/auth/login').send({ username: 'receptionist', password: 'admin123' });
      await agent.post('/api/auth/logout');
      const res = await agent.get('/api/departments');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    test('returns authenticated:false when not logged in', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.body.authenticated).toBe(false);
    });

    test('returns authenticated:true when logged in', async () => {
      const agent = request.agent(app);
      await agent.post('/api/auth/login').send({ username: 'receptionist', password: 'admin123' });
      const res = await agent.get('/api/auth/me');
      expect(res.body.authenticated).toBe(true);
    });
  });
});
