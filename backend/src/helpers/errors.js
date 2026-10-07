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
  FORBIDDEN: () =>
    createError('FORBIDDEN', 403, 'You do not have permission to perform this action.'),
  DEPARTMENT_NAME_TAKEN: () =>
    createError('DEPARTMENT_NAME_TAKEN', 409, 'Department name must be unique (case-insensitive).', 'name'),
  DEPARTMENT_NOT_FOUND: () =>
    createError('DEPARTMENT_NOT_FOUND', 404, 'Department not found.'),
  DEPARTMENT_INACTIVE: () =>
    createError('DEPARTMENT_INACTIVE', 409, 'Cannot use an inactive department.', 'departmentId'),
  DOCTOR_NOT_FOUND: () =>
    createError('DOCTOR_NOT_FOUND', 404, 'Doctor not found.'),
  DOCTOR_INACTIVE: () =>
    createError('DOCTOR_INACTIVE', 409, 'Cannot book an appointment with an inactive doctor.', 'doctorId'),
};

module.exports = { createError, Errors };
