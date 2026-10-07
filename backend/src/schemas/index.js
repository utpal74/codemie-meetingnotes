const { z } = require('zod');

const PHONE_REGEX = /^[6-9]\d{9}$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isWeekday(dateStr) {
  const d = new Date(dateStr);
  const day = d.getUTCDay(); // 0=Sun, 6=Sat
  return day !== 0;
}

function isNotPast(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d >= today;
}

const LoginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

const BookAppointmentSchema = z.object({
  patientName: z.string().min(2, 'Patient name must be at least 2 characters'),
  patientPhone: z.string().regex(PHONE_REGEX, 'Must be a valid 10-digit Indian mobile number'),
  doctorId: z.string().regex(UUID_REGEX, 'Invalid doctor ID'),
  appointmentDate: z
    .string()
    .refine(isNotPast, { message: 'Appointment date cannot be in the past' })
    .refine(isWeekday, { message: 'Appointments are not available on Sundays' }),
  slotTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Slot time must be in HH:MM format'),
});

const RescheduleSchema = z.object({
  appointmentDate: z
    .string()
    .refine(isNotPast, { message: 'Appointment date cannot be in the past' })
    .refine(isWeekday, { message: 'Appointments are not available on Sundays' }),
  slotTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Slot time must be in HH:MM format'),
});

module.exports = { LoginSchema, BookAppointmentSchema, RescheduleSchema };
