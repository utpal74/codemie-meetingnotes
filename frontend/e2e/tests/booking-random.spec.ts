import { test, expect } from '@playwright/test';
import { APPT_ID, DEPT, DOCTOR, apiError, appointment, json, mockBase, mockBooking, nextSunday, type Recorder } from '../support/mockApi';
import { fillBooking, submitBooking } from '../support/bookingForm';

// AC-1 / AC-3 (UI): receptionist can leave doctor and/or slot to the system and sees the confirmation.
// All /api traffic is stubbed, so these specs verify the UI contract (request payload + rendering), not the backend.

let rec: Recorder;

test.beforeEach(async ({ page }) => {
  rec = await mockBase(page);
});

test.describe('Any doctor + any slot', () => {
  test('sends department only and shows the system-assigned doctor and slot', async ({ page }) => {
    await mockBooking(page, rec, (route) =>
      json(route, appointment({ doctor: 'Dr. Assigned By System', slotTime: '16:30' }), 201)
    );

    await fillBooking(page, { anyDoctor: true, anySlot: true });
    await expect(page.locator('select').nth(1)).toBeDisabled();
    await expect(page.locator('select').nth(2)).toBeDisabled();
    await submitBooking(page);

    await expect(page.getByText('Appointment Confirmed')).toBeVisible();
    await expect(page.getByText(APPT_ID)).toBeVisible();
    await expect(page.getByText('Dr. Assigned By System')).toBeVisible();
    await expect(page.getByText('16:30')).toBeVisible();
    await expect(page.getByText(DEPT.name, { exact: true })).toBeVisible();

    expect(rec.bookingBodies).toHaveLength(1);
    const body = rec.bookingBodies[0];
    expect(body.departmentId).toBe(DEPT.id);
    expect(body).not.toHaveProperty('doctorId');
    expect(body).not.toHaveProperty('slotTime');
    expect(rec.slotRequests).toBe(0);
  });

  test('confirmation panel shows the SMS banner and lets the receptionist book another', async ({ page }) => {
    await mockBooking(page, rec, (route) => json(route, appointment(), 201));
    await fillBooking(page, { anyDoctor: true, anySlot: true });
    await submitBooking(page);

    await expect(page.getByTestId('sms-banner')).toHaveAttribute('data-sms-state', 'SENT');
    await page.getByRole('button', { name: 'Book another' }).click();
    await expect(page.getByRole('button', { name: 'Confirm Appointment' })).toBeVisible();
    await expect(page.getByPlaceholder('Full name')).toHaveValue('');
  });
});

test.describe('Doctor chosen, any slot', () => {
  test('sends doctorId without slotTime and does not fetch slots', async ({ page }) => {
    await mockBooking(page, rec, (route) => json(route, appointment({ slotTime: '10:30' }), 201));

    await fillBooking(page, { anySlot: true });
    await expect(page.locator('select').nth(2)).toBeDisabled();
    await submitBooking(page);

    await expect(page.getByText('Appointment Confirmed')).toBeVisible();
    const body = rec.bookingBodies[0];
    expect(body.doctorId).toBe(DOCTOR.id);
    expect(body).not.toHaveProperty('slotTime');
    expect(rec.slotRequests).toBe(0);
  });
});

test.describe('Doctor and slot chosen (existing flow)', () => {
  test('loads slots for the doctor and sends both doctorId and slotTime', async ({ page }) => {
    await mockBooking(page, rec, (route) => json(route, appointment(), 201));

    await fillBooking(page, { slot: '14:00' });
    expect(rec.slotRequests).toBeGreaterThan(0);
    await submitBooking(page);

    await expect(page.getByText('Appointment Confirmed')).toBeVisible();
    expect(rec.bookingBodies[0]).toMatchObject({
      patientName: 'Ravi Kumar',
      patientPhone: '9876543210',
      doctorId: DOCTOR.id,
      slotTime: '14:00',
    });
  });

  test('toggling Any doctor off again re-enables the doctor select', async ({ page }) => {
    await page.goto('/');
    await page.locator('select').nth(0).selectOption(DEPT.id);
    const anyDoctor = page.getByLabel(/Any doctor/);
    await anyDoctor.check();
    await expect(page.locator('select').nth(1)).toBeDisabled();
    await anyDoctor.uncheck();
    await expect(page.locator('select').nth(1)).toBeEnabled();
  });
});

test.describe('Error handling', () => {
  test('409 NO_SLOTS_AVAILABLE is shown under the slot field and the form is kept', async ({ page }) => {
    await mockBooking(page, rec, (route) =>
      apiError(route, 409, 'NO_SLOTS_AVAILABLE', 'No slots are available on the selected date.', 'slotTime')
    );
    await fillBooking(page, { anySlot: true });
    await submitBooking(page);

    await expect(page.getByText('No slots are available on the selected date.')).toBeVisible();
    await expect(page.getByText('Appointment Confirmed')).toHaveCount(0);
    await expect(page.getByPlaceholder('Full name')).toHaveValue('Ravi Kumar');
  });

  test('409 NO_DOCTOR_AVAILABLE is shown under the department field', async ({ page }) => {
    await mockBooking(page, rec, (route) =>
      apiError(route, 409, 'NO_DOCTOR_AVAILABLE', 'No doctor is available in this department for the requested time.', 'departmentId')
    );
    await fillBooking(page, { anyDoctor: true, anySlot: true });
    await submitBooking(page);

    await expect(page.getByText('No doctor is available in this department for the requested time.')).toBeVisible();
  });

  test('409 SLOT_UNAVAILABLE (lost race) is shown to the receptionist', async ({ page }) => {
    await mockBooking(page, rec, (route) =>
      apiError(route, 409, 'SLOT_UNAVAILABLE', 'The selected slot is already booked. Please choose another time.', 'slotTime')
    );
    await fillBooking(page, { slot: '14:00' });
    await submitBooking(page);

    await expect(page.getByText('The selected slot is already booked. Please choose another time.')).toBeVisible();
  });

  test('error without a field falls back to the global banner', async ({ page }) => {
    await mockBooking(page, rec, (route) => apiError(route, 500, 'INTERNAL_ERROR', 'An unexpected error occurred'));
    await fillBooking(page, { anyDoctor: true, anySlot: true });
    await submitBooking(page);

    await expect(page.getByText('An unexpected error occurred')).toBeVisible();
  });

  test('picking a Sunday shows the warning and does not request slots', async ({ page }) => {
    await fillBooking(page, { date: nextSunday() });
    await expect(page.getByText('Sundays are not available. Please pick another date.')).toBeVisible();
    expect(rec.slotRequests).toBe(0);
  });
});

// Known gap (see test report): with Any doctor checked and Any slot unchecked the slot select stays
// disabled (slots are only fetched for a chosen doctor) yet the form posts slotTime: "" and the API answers 422.
test.fixme('Any doctor without Any slot should not post an empty slotTime', async ({ page }) => {
  await mockBooking(page, rec, (route) => json(route, appointment(), 201));
  await fillBooking(page, { anyDoctor: true });
  await submitBooking(page);
  expect(rec.bookingBodies[0]).not.toHaveProperty('slotTime', '');
});
