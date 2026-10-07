const { BookAppointmentSchema, RescheduleSchema, LoginSchema } = require('../../src/schemas');

const FUTURE_WEEKDAY = '2027-06-14'; // a Monday well in the future
const FUTURE_SUNDAY  = '2027-06-13'; // the Sunday before

function parse(schema, data) {
  return schema.safeParse(data);
}

describe('BookAppointmentSchema', () => {
  const valid = {
    patientName: 'Ravi Kumar',
    patientPhone: '9876543210',
    doctorId: '00000000-0000-0000-0000-000000000001',
    appointmentDate: FUTURE_WEEKDAY,
    slotTime: '14:30',
  };

  test('accepts a fully valid booking request', () => {
    expect(parse(BookAppointmentSchema, valid).success).toBe(true);
  });

  test('rejects a phone number with fewer than 10 digits', () => {
    const r = parse(BookAppointmentSchema, { ...valid, patientPhone: '987654' });
    expect(r.success).toBe(false);
    expect(r.error.errors[0].path[0]).toBe('patientPhone');
  });

  test('rejects a phone number starting with 5 (not a valid Indian mobile)', () => {
    const r = parse(BookAppointmentSchema, { ...valid, patientPhone: '5876543210' });
    expect(r.success).toBe(false);
  });

  test('rejects a phone number with more than 10 digits', () => {
    const r = parse(BookAppointmentSchema, { ...valid, patientPhone: '98765432101' });
    expect(r.success).toBe(false);
  });

  test('rejects a Sunday appointment date', () => {
    const r = parse(BookAppointmentSchema, { ...valid, appointmentDate: FUTURE_SUNDAY });
    expect(r.success).toBe(false);
    expect(r.error.errors[0].message).toMatch(/Sunday/i);
  });

  test('rejects a past appointment date', () => {
    const r = parse(BookAppointmentSchema, { ...valid, appointmentDate: '2020-01-01' });
    expect(r.success).toBe(false);
    expect(r.error.errors[0].message).toMatch(/past/i);
  });

  test('rejects a patient name shorter than 2 characters', () => {
    const r = parse(BookAppointmentSchema, { ...valid, patientName: 'X' });
    expect(r.success).toBe(false);
    expect(r.error.errors[0].path[0]).toBe('patientName');
  });

  test('rejects an invalid doctorId (not a UUID)', () => {
    const r = parse(BookAppointmentSchema, { ...valid, doctorId: 'not-a-uuid' });
    expect(r.success).toBe(false);
    expect(r.error.errors[0].path[0]).toBe('doctorId');
  });

  test('rejects a slotTime not in HH:MM format', () => {
    const r = parse(BookAppointmentSchema, { ...valid, slotTime: '2:30pm' });
    expect(r.success).toBe(false);
    expect(r.error.errors[0].path[0]).toBe('slotTime');
  });
});

describe('RescheduleSchema', () => {
  const valid = { appointmentDate: FUTURE_WEEKDAY, slotTime: '11:00' };

  test('accepts valid reschedule data', () => {
    expect(parse(RescheduleSchema, valid).success).toBe(true);
  });

  test('rejects a Sunday date', () => {
    const r = parse(RescheduleSchema, { ...valid, appointmentDate: FUTURE_SUNDAY });
    expect(r.success).toBe(false);
  });

  test('rejects a past date', () => {
    const r = parse(RescheduleSchema, { ...valid, appointmentDate: '2020-06-01' });
    expect(r.success).toBe(false);
  });
});

describe('LoginSchema', () => {
  test('accepts valid credentials', () => {
    expect(parse(LoginSchema, { username: 'receptionist', password: 'admin123' }).success).toBe(true);
  });

  test('rejects empty username', () => {
    const r = parse(LoginSchema, { username: '', password: 'admin123' });
    expect(r.success).toBe(false);
    expect(r.error.errors[0].path[0]).toBe('username');
  });

  test('rejects empty password', () => {
    const r = parse(LoginSchema, { username: 'receptionist', password: '' });
    expect(r.success).toBe(false);
    expect(r.error.errors[0].path[0]).toBe('password');
  });
});
