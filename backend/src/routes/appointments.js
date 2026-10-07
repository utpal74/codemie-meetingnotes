const { Router } = require('express');
const AppointmentService = require('../services/AppointmentService');
const NotificationService = require('../services/NotificationService');
const { validate } = require('../middleware/validate');
const { BookAppointmentSchema, RescheduleSchema } = require('../schemas');
const { decryptPhone } = require('../helpers/crypto');

const router = Router();

function toPublic(appt) {
  return {
    appointmentId: appt.id,
    patientName: appt.patientName,
    doctorId: appt.doctor?.id,
    doctor: appt.doctor?.name,
    department: appt.doctor?.department?.name,
    appointmentDate: appt.appointmentDate,
    slotTime: appt.slotTime,
    status: appt.status,
    createdAt: appt.createdAt,
    previousAppointmentId: appt.previousAppointmentId,
  };
}

router.post('/', validate(BookAppointmentSchema), async (req, res, next) => {
  try {
    const appointment = await AppointmentService.createAppointment(req.body);
    const smsStatus = await NotificationService.sendBookingSms(appointment);
    res.status(201).json({ ...toPublic(appointment), smsStatus });
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { phone, includeHistory } = req.query;
    if (!phone) {
      return res.status(422).json({
        error: { code: 'MISSING_PARAMS', message: 'phone query parameter is required', field: 'phone' },
      });
    }
    const appointments = await AppointmentService.findByPhone(phone, {
      includeHistory: includeHistory === 'true',
    });
    res.json(appointments.map(toPublic));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const appointment = await AppointmentService.findById(req.params.id);
    res.json(toPublic(appointment));
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/cancel', async (req, res, next) => {
  try {
    const appointment = await AppointmentService.cancelAppointment(req.params.id);
    const smsStatus = await NotificationService.sendCancelSms(appointment);
    res.json({ ...toPublic(appointment), smsStatus });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/reschedule', validate(RescheduleSchema), async (req, res, next) => {
  try {
    const appointment = await AppointmentService.rescheduleAppointment(req.params.id, req.body);
    const smsStatus = await NotificationService.sendRescheduleSms(appointment);
    res.status(201).json({ ...toPublic(appointment), smsStatus });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
