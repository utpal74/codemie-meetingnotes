import type { Page, Route } from '@playwright/test';

export const DEPT = { id: '11111111-1111-4111-8111-111111111111', name: 'Cardiology' };
export const DOCTOR = { id: '22222222-2222-4222-8222-222222222222', name: 'Dr. Arjun Mehta' };
export const APPT_ID = '33333333-3333-4333-8333-333333333333';
export const NEW_APPT_ID = '44444444-4444-4444-8444-444444444444';
export const SLOTS = ['10:00', '10:30', '14:00'];

export type Json = Record<string, unknown>;

/** Next occurrence of the given weekday (0=Sun..6=Sat), at least 2 days ahead, as yyyy-MM-dd (local). */
export function nextWeekday(dow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  while (d.getDay() !== dow) d.setDate(d.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const nextMonday = () => nextWeekday(1);
export const nextSunday = () => nextWeekday(0);

export const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

export const apiError = (route: Route, status: number, code: string, message: string, field: string | null = null) =>
  json(route, { error: { code, message, field } }, status);

export function appointment(overrides: Json = {}): Json {
  return {
    appointmentId: APPT_ID,
    patientName: 'Ravi Kumar',
    doctorId: DOCTOR.id,
    doctor: DOCTOR.name,
    department: DEPT.name,
    appointmentDate: `${nextMonday()}T00:00:00.000Z`,
    slotTime: '14:00',
    status: 'CONFIRMED',
    createdAt: new Date().toISOString(),
    previousAppointmentId: null,
    smsStatus: 'SENT',
    ...overrides,
  };
}

export interface Recorder {
  bookingBodies: Json[];
  slotRequests: number;
  smsPolls: number;
}

/** Stubs auth + reference data. Returns counters so specs can assert on traffic. */
export async function mockBase(page: Page): Promise<Recorder> {
  const rec: Recorder = { bookingBodies: [], slotRequests: 0, smsPolls: 0 };

  await page.route((u) => u.pathname === '/api/auth/me', (r) => json(r, { authenticated: true }));
  await page.route((u) => u.pathname === '/api/departments', (r) => json(r, [DEPT]));
  await page.route((u) => u.pathname === '/api/doctors', (r) => json(r, [DOCTOR]));
  await page.route((u) => u.pathname === '/api/slots', (r) => {
    rec.slotRequests += 1;
    return json(r, { date: nextMonday(), doctorId: DOCTOR.id, availableSlots: SLOTS });
  });
  return rec;
}

/** Stubs POST /api/appointments; the handler decides the response. */
export async function mockBooking(
  page: Page,
  rec: Recorder,
  respond: (route: Route, body: Json) => Promise<void> | void
) {
  await page.route((u) => u.pathname === '/api/appointments', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const body = route.request().postDataJSON() as Json;
    rec.bookingBodies.push(body);
    return respond(route, body);
  });
}

/** Stubs GET /api/appointments/:id/sms with a sequence of responses (last one repeats). */
export async function mockSmsStatus(page: Page, rec: Recorder, id: string, sequence: Json[]) {
  await page.route((u) => u.pathname === `/api/appointments/${id}/sms`, (route) => {
    const body = sequence[Math.min(rec.smsPolls, sequence.length - 1)];
    rec.smsPolls += 1;
    return json(route, body);
  });
}

export const smsStatusBody = (status: 'PENDING' | 'SENT' | 'FAILED', attemptCount: number, failedAfterRetries: boolean, id = APPT_ID): Json => ({
  appointmentId: id,
  latest: { messageType: 'BOOKING', status, attemptCount, updatedAt: new Date().toISOString() },
  failedAfterRetries,
});
