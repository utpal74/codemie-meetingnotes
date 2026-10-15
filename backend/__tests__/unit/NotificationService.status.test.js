// Unit tests (no database): failedAfterRetries derivation for GET /api/appointments/:id/sms (AC-9).
jest.mock('../../src/lib/prisma', () => ({
  smsLog: { findFirst: jest.fn(), update: jest.fn() },
  smsTemplate: { findMany: jest.fn() },
}));

const prisma = require('../../src/lib/prisma');
const NotificationService = require('../../src/services/NotificationService');

const log = (status, attemptCount) => ({
  id: 'log-1',
  messageType: 'BOOKING',
  status,
  attemptCount,
  updatedAt: new Date('2027-01-01T00:00:00Z'),
});

beforeEach(() => jest.resetAllMocks());

describe('NotificationService.getLatestSmsStatus', () => {
  test('queries the newest log for the appointment', async () => {
    prisma.smsLog.findFirst.mockResolvedValue(null);
    await NotificationService.getLatestSmsStatus('appt-1');
    expect(prisma.smsLog.findFirst).toHaveBeenCalledWith({
      where: { appointmentId: 'appt-1' },
      orderBy: { createdAt: 'desc' },
    });
  });

  test('no log -> latest null, failedAfterRetries false', async () => {
    prisma.smsLog.findFirst.mockResolvedValue(null);
    expect(await NotificationService.getLatestSmsStatus('appt-1')).toEqual({
      appointmentId: 'appt-1',
      latest: null,
      failedAfterRetries: false,
    });
  });

  test.each([
    ['FAILED', 1, false],
    ['FAILED', 2, false],
    ['FAILED', 3, true],
    ['FAILED', 4, true],
    ['SENT', 3, false],
    ['PENDING', 3, false],
    ['PENDING', 0, false],
  ])('%s with %i attempts -> failedAfterRetries=%s', async (status, attempts, expected) => {
    prisma.smsLog.findFirst.mockResolvedValue(log(status, attempts));
    const res = await NotificationService.getLatestSmsStatus('appt-1');
    expect(res.failedAfterRetries).toBe(expected);
    expect(res.latest).toEqual({
      messageType: 'BOOKING',
      status,
      attemptCount: attempts,
      updatedAt: expect.any(Date),
    });
  });

  test('response shape is { appointmentId, latest, failedAfterRetries } and omits internal ids', async () => {
    prisma.smsLog.findFirst.mockResolvedValue(log('FAILED', 3));
    const res = await NotificationService.getLatestSmsStatus('appt-1');
    expect(Object.keys(res).sort()).toEqual(['appointmentId', 'failedAfterRetries', 'latest']);
    expect(res.latest).not.toHaveProperty('id');
    expect(res.latest).not.toHaveProperty('twilioMessageSid');
  });
});

describe('NotificationService.dispatchSms without Twilio configured', () => {
  test('marks the log FAILED, increments attempts and reports DISABLED', async () => {
    const saved = { sid: process.env.TWILIO_ACCOUNT_SID, tok: process.env.TWILIO_AUTH_TOKEN };
    process.env.TWILIO_ACCOUNT_SID = '';
    process.env.TWILIO_AUTH_TOKEN = '';
    prisma.smsLog.update.mockResolvedValue({});
    const status = await NotificationService.dispatchSms('9876543210', 'hello', 'log-9');
    expect(status).toBe('DISABLED');
    expect(prisma.smsLog.update).toHaveBeenCalledWith({
      where: { id: 'log-9' },
      data: { status: 'FAILED', attemptCount: { increment: 1 } },
    });
    process.env.TWILIO_ACCOUNT_SID = saved.sid;
    process.env.TWILIO_AUTH_TOKEN = saved.tok;
  });
});
