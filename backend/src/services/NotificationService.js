const prisma = require('../lib/prisma');
const { decryptPhone } = require('../helpers/crypto');
const { interpolate, formatDate, formatTime } = require('../helpers/smsFormat');
const logger = require('../helpers/logger');

let twilioClient = null;

function getTwilioClient() {
  if (twilioClient) return twilioClient;
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) return null;
  const twilio = require('twilio');
  twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  return twilioClient;
}

// 5-minute in-memory template cache
const templateCache = { data: null, expiresAt: 0 };

async function getTemplates() {
  if (templateCache.data && Date.now() < templateCache.expiresAt) {
    return templateCache.data;
  }
  const templates = await prisma.smsTemplate.findMany();
  templateCache.data = Object.fromEntries(templates.map((t) => [t.messageType, t.templateBody]));
  templateCache.expiresAt = Date.now() + 5 * 60 * 1000;
  return templateCache.data;
}

function normalisePhone(raw) {
  // Strip any existing country-code prefix before prepending +91
  return raw.replace(/^\+?91/, '');
}

async function dispatchSms(phone, body, logId) {
  const client = getTwilioClient();
  if (!client) {
    logger.warn('SMS skipped — Twilio not configured');
    await prisma.smsLog.update({
      where: { id: logId },
      data: { status: 'FAILED', attemptCount: { increment: 1 } },
    });
    return 'DISABLED';
  }

  try {
    const result = await Promise.race([
      client.messages.create({ to: `+91${normalisePhone(phone)}`, from: process.env.TWILIO_PHONE_NUMBER, body }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Twilio timeout')), 2000)),
    ]);
    await prisma.smsLog.update({
      where: { id: logId },
      data: { status: 'SENT', twilioMessageSid: result.sid, attemptCount: { increment: 1 } },
    });
    return 'SENT';
  } catch (err) {
    logger.error({ err: err.message }, 'SMS dispatch failed');
    await prisma.smsLog.update({
      where: { id: logId },
      data: { status: 'FAILED', attemptCount: { increment: 1 } },
    });
    return 'FAILED';
  }
}

async function send(appointment, messageType) {
  try {
    const templates = await getTemplates();
    const template = templates[messageType];
    if (!template) {
      logger.error({ messageType }, 'SMS template not found');
      return 'FAILED';
    }

    const doctor = appointment.doctor;
    const department = doctor?.department;
    const vars = {
      patientName: appointment.patientName,
      doctorName: doctor?.name ?? 'Doctor',
      department: department?.name ?? 'Clinic',
      date: formatDate(appointment.appointmentDate),
      time: formatTime(appointment.slotTime),
      appointmentId: appointment.id,
    };
    const body = interpolate(template, vars);

    const logEntry = await prisma.smsLog.create({
      data: { appointmentId: appointment.id, messageType, status: 'PENDING', attemptCount: 0 },
    });

    const phone = decryptPhone(appointment.patientPhone);

    // Fire and forget — do not await full result in request path
    const resultPromise = dispatchSms(phone, body, logEntry.id);
    resultPromise.catch((err) => logger.error({ err }, 'dispatchSms background error'));

    // Return optimistic status after short race
    const status = await Promise.race([
      resultPromise,
      new Promise((resolve) => setTimeout(() => resolve('PENDING_RETRY'), 2500)),
    ]);

    return status;
  } catch (err) {
    logger.error({ err }, 'NotificationService.send failed — SMS not sent');
    return 'FAILED';
  }
}

module.exports = {
  sendBookingSms: (appt) => send(appt, 'BOOKING'),
  sendCancelSms: (appt) => send(appt, 'CANCELLATION'),
  sendRescheduleSms: (appt) => send(appt, 'RESCHEDULING'),
  dispatchSms,
  getTemplates,
};
