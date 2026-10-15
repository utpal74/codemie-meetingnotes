const { Prisma } = require('@prisma/client');
const prisma = require('../lib/prisma');
const { encryptPhone, hashPhone } = require('../helpers/crypto');
const SlotService = require('./SlotService');
const DoctorService = require('./DoctorService');
const { Errors } = require('../helpers/errors');
const logger = require('../helpers/logger');

const APPOINTMENT_INCLUDE = {
  doctor: { include: { department: true } },
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function insertConfirmed({ patientName, patientPhone, doctorId, date, slotTime }) {
  try {
    return await prisma.$transaction(
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
  } catch (err) {
    if (err.code === 'SLOT_UNAVAILABLE') throw err;
    // Serialization failure (P2034) — another concurrent booking won the race
    if (err.code === 'P2034') throw Errors.SLOT_UNAVAILABLE();
    throw err;
  }
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Picks a random doctor in the department who can take the booking
// (free at slotTime when given, otherwise with at least one open slot).
async function pickDoctor(departmentId, date, slotTime) {
  const doctors = await DoctorService.listDoctors(departmentId);
  if (!doctors.length) throw Errors.NO_DOCTOR_AVAILABLE();

  let sawOpenSlot = false;
  for (const doctor of shuffle(doctors)) {
    const open = await SlotService.getAvailableSlots(doctor.id, date);
    if (open.length) sawOpenSlot = true;
    if (slotTime ? open.includes(slotTime) : open.length) return doctor.id;
  }
  throw slotTime || sawOpenSlot ? Errors.NO_DOCTOR_AVAILABLE() : Errors.NO_SLOTS_AVAILABLE();
}

const MAX_AUTO_ATTEMPTS = 3;

async function createAppointment({ patientName, patientPhone, departmentId, doctorId, appointmentDate, slotTime }) {
  if (slotTime && !SlotService.validateSlot(slotTime)) {
    throw Errors.INVALID_DATE();
  }

  const date = new Date(appointmentDate);

  if (doctorId && !(await DoctorService.getDoctorById(doctorId))) {
    throw Errors.DOCTOR_NOT_FOUND();
  }

  // Fully specified request: single attempt, conflicts surface as 409 to the caller.
  if (doctorId && slotTime) {
    return insertConfirmed({ patientName, patientPhone, doctorId, date, slotTime });
  }

  // A random pick can lose a race with a concurrent booking; re-pick a few times before giving up.
  let lastErr;
  for (let attempt = 0; attempt < MAX_AUTO_ATTEMPTS; attempt++) {
    const resolvedDoctorId = doctorId || (await pickDoctor(departmentId, appointmentDate, slotTime));
    let resolvedSlot = slotTime;
    if (!resolvedSlot) {
      const open = await SlotService.getAvailableSlots(resolvedDoctorId, appointmentDate);
      resolvedSlot = SlotService.assignRandomSlot(open);
      if (!resolvedSlot) throw Errors.NO_SLOTS_AVAILABLE();
    }

    try {
      return await insertConfirmed({
        patientName,
        patientPhone,
        doctorId: resolvedDoctorId,
        date,
        slotTime: resolvedSlot,
      });
    } catch (err) {
      if (err.code !== 'SLOT_UNAVAILABLE') throw err;
      lastErr = err;
    }
  }
  throw lastErr;
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
