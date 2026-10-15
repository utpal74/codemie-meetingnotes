// Unit tests (no database): random doctor / slot assignment, race retry and error mapping (AC-1, AC-4, AC-7).
jest.mock('../../src/lib/prisma', () => ({
  appointment: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
  $transaction: jest.fn(),
}));
jest.mock('../../src/services/DoctorService', () => ({
  listDoctors: jest.fn(),
  getDoctorById: jest.fn(),
}));

const prisma = require('../../src/lib/prisma');
const DoctorService = require('../../src/services/DoctorService');
const SlotService = require('../../src/services/SlotService');
const AppointmentService = require('../../src/services/AppointmentService');

const DEPT = '11111111-1111-4111-8111-111111111111';
const D1 = { id: 'doc-1' };
const D2 = { id: 'doc-2' };
const D3 = { id: 'doc-3' };
const ALL = SlotService.generateAllSlots();
const base = { patientName: 'Test Patient', patientPhone: '9876543210', appointmentDate: '2027-10-04' };

let tx;
let availability; // doctorId -> open slots
let created;

beforeEach(() => {
  jest.resetAllMocks();
  created = [];
  tx = {
    appointment: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(async ({ data }) => {
        created.push(data);
        return { id: 'new-id', ...data };
      }),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  prisma.$transaction.mockImplementation(async (fn) => fn(tx));
  DoctorService.getDoctorById.mockResolvedValue({ id: 'doc-1' });
  availability = { 'doc-1': ALL, 'doc-2': ALL, 'doc-3': ALL };
  jest.spyOn(SlotService, 'getAvailableSlots').mockImplementation(async (id) => availability[id] || []);
});

afterEach(() => jest.restoreAllMocks());

describe('createAppointment - fully specified request', () => {
  test('books exactly the given doctor and slot with a single transaction', async () => {
    await AppointmentService.createAppointment({ ...base, doctorId: 'doc-1', slotTime: '14:00' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(DoctorService.listDoctors).not.toHaveBeenCalled();
    expect(created[0]).toMatchObject({ doctorId: 'doc-1', slotTime: '14:00', status: 'CONFIRMED' });
  });

  test('never stores the plain phone number', async () => {
    await AppointmentService.createAppointment({ ...base, doctorId: 'doc-1', slotTime: '14:00' });
    expect(created[0].patientPhone).not.toBe('9876543210');
    expect(created[0].patientPhoneHash).toEqual(expect.any(String));
  });

  test('unknown doctor -> 404 DOCTOR_NOT_FOUND and no transaction', async () => {
    DoctorService.getDoctorById.mockResolvedValue(null);
    await expect(AppointmentService.createAppointment({ ...base, doctorId: 'nope', slotTime: '14:00' })).rejects.toMatchObject({
      status: 404,
      code: 'DOCTOR_NOT_FOUND',
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test.each(['09:30', '19:00', '10:15'])('slot %s outside 10:00-18:30 grid -> 422', async (slotTime) => {
    await expect(AppointmentService.createAppointment({ ...base, doctorId: 'doc-1', slotTime })).rejects.toMatchObject({
      status: 422,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test('existing CONFIRMED row -> 409 SLOT_UNAVAILABLE, not retried', async () => {
    tx.appointment.findFirst.mockResolvedValue({ id: 'taken' });
    await expect(AppointmentService.createAppointment({ ...base, doctorId: 'doc-1', slotTime: '14:00' })).rejects.toMatchObject({
      status: 409,
      code: 'SLOT_UNAVAILABLE',
      field: 'slotTime',
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  test('Prisma P2034 serialization failure is mapped to 409 SLOT_UNAVAILABLE', async () => {
    prisma.$transaction.mockRejectedValue(Object.assign(new Error('write conflict'), { code: 'P2034' }));
    await expect(AppointmentService.createAppointment({ ...base, doctorId: 'doc-1', slotTime: '14:00' })).rejects.toMatchObject({
      status: 409,
      code: 'SLOT_UNAVAILABLE',
    });
  });

  test('unexpected DB errors are not swallowed', async () => {
    prisma.$transaction.mockRejectedValue(Object.assign(new Error('connection lost'), { code: 'P1001' }));
    await expect(AppointmentService.createAppointment({ ...base, doctorId: 'doc-1', slotTime: '14:00' })).rejects.toMatchObject({
      code: 'P1001',
    });
  });
});

describe('createAppointment - random doctor (AC-1)', () => {
  test('department only: picks a doctor from that department and a valid slot', async () => {
    DoctorService.listDoctors.mockResolvedValue([D1, D2, D3]);
    await AppointmentService.createAppointment({ ...base, departmentId: DEPT });
    expect(DoctorService.listDoctors).toHaveBeenCalledWith(DEPT);
    expect(['doc-1', 'doc-2', 'doc-3']).toContain(created[0].doctorId);
    expect(ALL).toContain(created[0].slotTime);
  });

  test('only doctors free at the requested slot are eligible', async () => {
    DoctorService.listDoctors.mockResolvedValue([D1, D2, D3]);
    availability = { 'doc-1': ALL.filter((s) => s !== '12:00'), 'doc-2': ALL.filter((s) => s !== '12:00'), 'doc-3': ALL };
    for (let i = 0; i < 20; i++) {
      created.length = 0;
      await AppointmentService.createAppointment({ ...base, departmentId: DEPT, slotTime: '12:00' });
      expect(created[0].doctorId).toBe('doc-3');
      expect(created[0].slotTime).toBe('12:00');
    }
  });

  test('doctor choice is actually random across the department', async () => {
    DoctorService.listDoctors.mockResolvedValue([D1, D2, D3]);
    const seen = new Set();
    for (let i = 0; i < 80; i++) {
      created.length = 0;
      await AppointmentService.createAppointment({ ...base, departmentId: DEPT, slotTime: '12:00' });
      seen.add(created[0].doctorId);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  test('department with no doctors -> 409 NO_DOCTOR_AVAILABLE on departmentId', async () => {
    DoctorService.listDoctors.mockResolvedValue([]);
    await expect(AppointmentService.createAppointment({ ...base, departmentId: DEPT })).rejects.toMatchObject({
      status: 409,
      code: 'NO_DOCTOR_AVAILABLE',
      field: 'departmentId',
    });
  });

  test('requested slot busy for every doctor (others have open slots) -> NO_DOCTOR_AVAILABLE', async () => {
    DoctorService.listDoctors.mockResolvedValue([D1, D2]);
    availability = { 'doc-1': ALL.filter((s) => s !== '12:00'), 'doc-2': ALL.filter((s) => s !== '12:00') };
    await expect(AppointmentService.createAppointment({ ...base, departmentId: DEPT, slotTime: '12:00' })).rejects.toMatchObject({
      code: 'NO_DOCTOR_AVAILABLE',
    });
  });

  test('every doctor fully booked and no slot requested -> 409 NO_SLOTS_AVAILABLE', async () => {
    DoctorService.listDoctors.mockResolvedValue([D1, D2]);
    availability = { 'doc-1': [], 'doc-2': [] };
    await expect(AppointmentService.createAppointment({ ...base, departmentId: DEPT })).rejects.toMatchObject({
      status: 409,
      code: 'NO_SLOTS_AVAILABLE',
      field: 'slotTime',
    });
  });
});

describe('createAppointment - random slot (AC-1)', () => {
  test('doctor given, no slot: assigns one of the open slots only', async () => {
    availability['doc-1'] = ['15:00', '15:30'];
    for (let i = 0; i < 20; i++) {
      created.length = 0;
      await AppointmentService.createAppointment({ ...base, doctorId: 'doc-1' });
      expect(['15:00', '15:30']).toContain(created[0].slotTime);
    }
  });

  test('Math.random extremes pick the first and the last open slot', async () => {
    const rnd = jest.spyOn(Math, 'random');
    rnd.mockReturnValue(0);
    await AppointmentService.createAppointment({ ...base, doctorId: 'doc-1' });
    expect(created[0].slotTime).toBe('10:00');
    rnd.mockReturnValue(0.999999);
    await AppointmentService.createAppointment({ ...base, doctorId: 'doc-1' });
    expect(created[1].slotTime).toBe('18:30');
  });

  test('doctor given but fully booked -> 409 NO_SLOTS_AVAILABLE and no insert', async () => {
    availability['doc-1'] = [];
    await expect(AppointmentService.createAppointment({ ...base, doctorId: 'doc-1' })).rejects.toMatchObject({
      status: 409,
      code: 'NO_SLOTS_AVAILABLE',
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('createAppointment - race retry for auto-assigned picks', () => {
  test('retries after losing a race and succeeds on the next pick', async () => {
    tx.appointment.findFirst.mockResolvedValueOnce({ id: 'raced' }).mockResolvedValue(null);
    await AppointmentService.createAppointment({ ...base, doctorId: 'doc-1' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(created).toHaveLength(1);
  });

  test('gives up with 409 SLOT_UNAVAILABLE after 3 lost races', async () => {
    tx.appointment.findFirst.mockResolvedValue({ id: 'raced' });
    await expect(AppointmentService.createAppointment({ ...base, doctorId: 'doc-1' })).rejects.toMatchObject({
      status: 409,
      code: 'SLOT_UNAVAILABLE',
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });
});

describe('rescheduleAppointment (AC-7)', () => {
  const existing = {
    id: 'old-id',
    status: 'CONFIRMED',
    patientName: 'Test Patient',
    patientPhone: 'enc',
    patientPhoneHash: 'hash',
    doctorId: 'doc-1',
  };

  beforeEach(() => {
    prisma.appointment.findUnique.mockResolvedValue(existing);
  });

  test('marks the old row RESCHEDULED and creates a CONFIRMED row linked via previousAppointmentId', async () => {
    await AppointmentService.rescheduleAppointment('old-id', { appointmentDate: '2027-10-05', slotTime: '11:00' });
    expect(tx.appointment.update).toHaveBeenCalledWith({ where: { id: 'old-id' }, data: { status: 'RESCHEDULED' } });
    expect(created[0]).toMatchObject({
      doctorId: 'doc-1',
      slotTime: '11:00',
      status: 'CONFIRMED',
      previousAppointmentId: 'old-id',
      patientPhoneHash: 'hash',
    });
  });

  test('conflicting CONFIRMED row -> 409 SLOT_UNAVAILABLE before the old row is touched', async () => {
    tx.appointment.findFirst.mockResolvedValue({ id: 'someone-else' });
    await expect(
      AppointmentService.rescheduleAppointment('old-id', { appointmentDate: '2027-10-05', slotTime: '11:00' })
    ).rejects.toMatchObject({ status: 409, code: 'SLOT_UNAVAILABLE' });
    expect(tx.appointment.update).not.toHaveBeenCalled();
    expect(created).toHaveLength(0);
  });

  test('P2034 is mapped to 409 SLOT_UNAVAILABLE', async () => {
    prisma.$transaction.mockRejectedValue(Object.assign(new Error('write conflict'), { code: 'P2034' }));
    await expect(
      AppointmentService.rescheduleAppointment('old-id', { appointmentDate: '2027-10-05', slotTime: '11:00' })
    ).rejects.toMatchObject({ status: 409, code: 'SLOT_UNAVAILABLE' });
  });

  test('invalid slot -> 422 before any lookup', async () => {
    await expect(
      AppointmentService.rescheduleAppointment('old-id', { appointmentDate: '2027-10-05', slotTime: '19:00' })
    ).rejects.toMatchObject({ status: 422 });
    expect(prisma.appointment.findUnique).not.toHaveBeenCalled();
  });

  test('unknown appointment -> 404', async () => {
    prisma.appointment.findUnique.mockResolvedValue(null);
    await expect(
      AppointmentService.rescheduleAppointment('nope', { appointmentDate: '2027-10-05', slotTime: '11:00' })
    ).rejects.toMatchObject({ status: 404, code: 'APPOINTMENT_NOT_FOUND' });
  });
});

describe('cancelAppointment (AC-6)', () => {
  test('CONFIRMED -> CANCELLED', async () => {
    prisma.appointment.findUnique.mockResolvedValue({ id: 'a1', status: 'CONFIRMED' });
    prisma.appointment.update.mockResolvedValue({ id: 'a1', status: 'CANCELLED' });
    const res = await AppointmentService.cancelAppointment('a1');
    expect(prisma.appointment.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'CANCELLED' } }));
    expect(res.status).toBe('CANCELLED');
  });

  test.each(['CANCELLED', 'RESCHEDULED'])('%s -> 409 APPOINTMENT_ALREADY_CANCELLED, no update', async (status) => {
    prisma.appointment.findUnique.mockResolvedValue({ id: 'a1', status });
    await expect(AppointmentService.cancelAppointment('a1')).rejects.toMatchObject({
      status: 409,
      code: 'APPOINTMENT_ALREADY_CANCELLED',
    });
    expect(prisma.appointment.update).not.toHaveBeenCalled();
  });
});
