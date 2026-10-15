const request = require('supertest');
const app = require('../../src/app');
const prisma = require('../../src/lib/prisma');

const ID = '00000000-0000-4000-8000-000000000000';

afterAll(async () => {
  await prisma.$disconnect();
});

describe('appointment endpoints require authentication', () => {
  const cases = [
    ['post', '/api/appointments'],
    ['get', '/api/appointments?phone=9876543210'],
    ['get', `/api/appointments/${ID}`],
    ['get', `/api/appointments/${ID}/sms`],
    ['patch', `/api/appointments/${ID}/cancel`],
    ['patch', `/api/appointments/${ID}/reschedule`],
    ['get', '/api/slots?doctorId=x&date=2027-08-02'],
  ];

  test.each(cases)('%s %s -> 401 UNAUTHORIZED envelope', async (method, url) => {
    const res = await request(app)[method](url).send({});
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(res.body.error.field).toBeNull();
  });
});
