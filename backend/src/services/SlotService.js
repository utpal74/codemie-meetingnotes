const prisma = require('../lib/prisma');
const DoctorService = require('./DoctorService');
const { Errors } = require('../helpers/errors');

const SLOT_START_HOUR = 10;
const SLOT_END_HOUR = 19;
const SLOT_DURATION_MIN = 30;

function generateAllSlots() {
  const slots = [];
  for (let h = SLOT_START_HOUR; h < SLOT_END_HOUR; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`);
    if (h * 60 + 30 < SLOT_END_HOUR * 60) {
      slots.push(`${String(h).padStart(2, '0')}:30`);
    }
  }
  return slots; // ['10:00','10:30',...,'18:00','18:30']
}

async function getAvailableSlots(doctorId, date) {
  // Prevent slot discovery for inactive doctors/departments (new bookings only)
  const doctor = await DoctorService.getActiveDoctorById(doctorId);
  if (!doctor) {
    const anyDoctor = await DoctorService.getDoctorById(doctorId);
    if (!anyDoctor) throw Errors.DOCTOR_NOT_FOUND();
    if (!anyDoctor.isActive) throw Errors.DOCTOR_INACTIVE();
    throw Errors.DEPARTMENT_INACTIVE();
  }

  const allSlots = generateAllSlots();
  const appointmentDate = new Date(date);

  const booked = await prisma.appointment.findMany({
    where: {
      doctorId,
      appointmentDate,
      status: 'CONFIRMED',
    },
    select: { slotTime: true },
  });

  const bookedSet = new Set(booked.map((a) => a.slotTime));
  return allSlots.filter((s) => !bookedSet.has(s));
}

function assignRandomSlot(availableSlots) {
  if (!availableSlots.length) return null;
  return availableSlots[Math.floor(Math.random() * availableSlots.length)];
}

function validateSlot(slotTime) {
  return generateAllSlots().includes(slotTime);
}

module.exports = { generateAllSlots, getAvailableSlots, assignRandomSlot, validateSlot };
