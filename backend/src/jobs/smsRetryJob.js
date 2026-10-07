const cron = require('node-cron');
const prisma = require('../lib/prisma');
const { decryptPhone } = require('../helpers/crypto');
const { interpolate, formatDate, formatTime } = require('../helpers/smsFormat');
const { dispatchSms, getTemplates } = require('../services/NotificationService');
const logger = require('../helpers/logger');

async function retryFailedSms() {
  const failed = await prisma.smsLog.findMany({
    where: { status: 'FAILED', attemptCount: { lt: 3 } },
    include: {
      appointment: { include: { doctor: { include: { department: true } } } },
    },
    take: 20,
  });

  if (!failed.length) return;
  logger.info({ count: failed.length }, 'SMS retry job: retrying failed messages');

  const templates = await getTemplates();

  for (const log of failed) {
    const appt = log.appointment;
    const template = templates[log.messageType];
    if (!template) continue;

    const body = interpolate(template, {
      patientName: appt.patientName,
      doctorName: appt.doctor?.name ?? 'Doctor',
      department: appt.doctor?.department?.name ?? 'Clinic',
      date: formatDate(appt.appointmentDate),
      time: formatTime(appt.slotTime),
      appointmentId: appt.id,
    });

    try {
      const phone = decryptPhone(appt.patientPhone);
      // dispatchSms handles its own attemptCount increment — do not pre-increment here
      await dispatchSms(phone, body, log.id);
    } catch (err) {
      logger.error({ logId: log.id, err: err.message }, 'SMS retry dispatch error');
    }
  }
}

function startRetryJob() {
  cron.schedule('*/5 * * * *', () => {
    retryFailedSms().catch((err) => logger.error({ err }, 'SMS retry job error'));
  });
  logger.info('SMS retry job scheduled (every 5 minutes)');
}

module.exports = { startRetryJob };
