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

const BookAppointmentSchema = z
  .object({
    patientName: z.string().trim().min(2, 'Patient name must be at least 2 characters'),
    patientPhone: z.string().regex(PHONE_REGEX, 'Must be a valid 10-digit Indian mobile number'),
    departmentId: z.string().regex(UUID_REGEX, 'Invalid department ID').optional(),
    doctorId: z.string().regex(UUID_REGEX, 'Invalid doctor ID').optional(),
    appointmentDate: z
      .string()
      .refine(isNotPast, { message: 'Appointment date cannot be in the past' })
      .refine(isWeekday, { message: 'Appointments are not available on Sundays' }),
    slotTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/, 'Slot time must be in HH:MM format')
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.doctorId && !data.departmentId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['departmentId'],
        message: 'Department is required when no doctor is selected',
      });
    }
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
