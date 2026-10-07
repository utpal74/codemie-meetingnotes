function createError(code, status, message, field = null) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  err.field = field;
  return err;
}

const Errors = {
  SLOT_UNAVAILABLE: () =>
    createError('SLOT_UNAVAILABLE', 409, 'The selected slot is already booked. Please choose another time.', 'slotTime'),
  APPOINTMENT_NOT_FOUND: () =>
    createError('APPOINTMENT_NOT_FOUND', 404, 'No appointment found for the given ID or phone number.'),
  INVALID_PHONE: () =>
    createError('INVALID_PHONE', 422, 'Phone number must be a 10-digit Indian mobile number.', 'patientPhone'),
  INVALID_DATE: () =>
    createError('INVALID_DATE', 422, 'Appointment date must be today or a future weekday (Mon–Sat).', 'appointmentDate'),
  APPOINTMENT_ALREADY_CANCELLED: () =>
    createError('APPOINTMENT_ALREADY_CANCELLED', 409, 'This appointment is already cancelled.'),
  UNAUTHORIZED: () =>
    createError('UNAUTHORIZED', 401, 'Authentication required. Please log in.'),
  INVALID_CREDENTIALS: () =>
    createError('INVALID_CREDENTIALS', 401, 'Invalid username or password.'),
};

module.exports = { createError, Errors };
