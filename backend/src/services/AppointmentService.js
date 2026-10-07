const { Prisma } = require('@prisma/client');
const prisma = require('../lib/prisma');
const { encryptPhone, hashPhone } = require('../helpers/crypto');
const SlotService = require('./SlotService');
const { Errors } = require('../helpers/errors');
const logger = require('../helpers/logger');

const APPOINTMENT_INCLUDE = {
  doctor: { include: { department: true } },
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function createAppointment({ patientName, patientPhone, doctorId, appointmentDate, slotTime }) {
  if (!SlotService.validateSlot(slotTime)) {
    throw Errors.INVALID_DATE();
  }

  const date = new Date(appointmentDate);

  try {
    const appointment = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.appointment.findFirst({
          where: { doctorId, appointmentDate: date, slotTime, status: 'CONFIRMED' },
        });
        if (existing) throw Errors.SLOT_UNAVAILABLE();

        return tx.appointment.create({
          data: {
            patientName,
            patientPhone: encryptPhone(patientPhone),
            patientPhoneHash: hashPhone(patientPhone),
            doctorId,
            appointmentDate: date,
            slotTime,
            status: 'CONFIRMED',
          },
          include: APPOINTMENT_INCLUDE,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    return appointment;
  } catch (err) {
    if (err.code === 'SLOT_UNAVAILABLE') throw err;
    // Serialization failure (P2034) — another concurrent booking won the race
    if (err.code === 'P2034') throw Errors.SLOT_UNAVAILABLE();
    throw err;
  }
}

async function findById(id) {
  const appt = await prisma.appointment.findUnique({
    where: { id },
    include: APPOINTMENT_INCLUDE,
  });
  if (!appt) throw Errors.APPOINTMENT_NOT_FOUND();
  return appt;
}

async function findByPhone(phone, { includeHistory = false } = {}) {
  const hash = hashPhone(phone);
  const where = { patientPhoneHash: hash };
  if (!includeHistory) where.status = 'CONFIRMED';

  const appointments = await prisma.appointment.findMany({
    where,
    include: APPOINTMENT_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
  return appointments;
}

async function findByIdOrPhone(idOrPhone, opts = {}) {
  if (UUID_REGEX.test(idOrPhone)) return [await findById(idOrPhone)];
  return findByPhone(idOrPhone, opts);
}

async function cancelAppointment(id) {
  const appt = await findById(id);
  if (appt.status === 'CANCELLED' || appt.status === 'RESCHEDULED') {
    throw Errors.APPOINTMENT_ALREADY_CANCELLED();
  }

  return prisma.appointment.update({
    where: { id },
    data: { status: 'CANCELLED' },
    include: APPOINTMENT_INCLUDE,
  });
}

async function rescheduleAppointment(id, { appointmentDate, slotTime }) {
  if (!SlotService.validateSlot(slotTime)) throw Errors.INVALID_DATE();

  const existing = await findById(id);
  const newDate = new Date(appointmentDate);

  try {
    const newAppointment = await prisma.$transaction(
      async (tx) => {
        const conflict = await tx.appointment.findFirst({
          where: {
            doctorId: existing.doctorId,
            appointmentDate: newDate,
            slotTime,
            status: 'CONFIRMED',
          },
        });
        if (conflict) throw Errors.SLOT_UNAVAILABLE();

        await tx.appointment.update({ where: { id }, data: { status: 'RESCHEDULED' } });

        return tx.appointment.create({
          data: {
            patientName: existing.patientName,
            patientPhone: existing.patientPhone,
            patientPhoneHash: existing.patientPhoneHash,
            doctorId: existing.doctorId,
            appointmentDate: newDate,
            slotTime,
            status: 'CONFIRMED',
            previousAppointmentId: id,
          },
          include: APPOINTMENT_INCLUDE,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    return newAppointment;
  } catch (err) {
    if (err.code === 'SLOT_UNAVAILABLE') throw err;
    if (err.code === 'P2034') throw Errors.SLOT_UNAVAILABLE();
    throw err;
  }
}

module.exports = { createAppointment, findById, findByPhone, findByIdOrPhone, cancelAppointment, rescheduleAppointment };
