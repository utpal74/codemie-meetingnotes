import { test, expect, type Page } from '@playwright/test';
import { APPT_ID, NEW_APPT_ID, apiError, appointment, json, mockBase, nextMonday, type Recorder } from '../support/mockApi';

// AC-5 / AC-6 / AC-7 (UI): lookup, cancel and reschedule from the receptionist screens.
// All /api traffic is stubbed; these specs verify rendering and request shape, not backend behaviour.

let rec: Recorder;

test.beforeEach(async ({ page }) => {
  rec = await mockBase(page);
});

async function stubLookup(page: Page, results: unknown[]) {
  await page.route((u) => u.pathname === '/api/appointments', (route) =>
    route.request().method() === 'GET' ? json(route, results) : route.fallback()
  );
  await page.route((u) => u.pathname === `/api/appointments/${APPT_ID}`, (route) =>
    route.request().method() === 'GET' ? json(route, results[0]) : route.fallback()
  );
}

async function search(page: Page, query: string) {
  await page.goto('/appointments');
  await page.getByPlaceholder('Phone number or Appointment ID').fill(query);
  await page.getByRole('button', { name: 'Search' }).click();
}

async function openManage(page: Page) {
  await search(page, '9876543210');
  await page.getByRole('button', { name: /Manage/ }).click();
}

test.describe('Lookup', () => {
  test('search by phone shows the appointment card with a Manage link', async ({ page }) => {
    await stubLookup(page, [appointment()]);
    await search(page, '9876543210');

    await expect(page.getByText('Ravi Kumar')).toBeVisible();
    await expect(page.getByText(APPT_ID)).toBeVisible();
    await expect(page.getByText('CONFIRMED')).toBeVisible();
    await expect(page.getByText('Dr. Arjun Mehta')).toBeVisible();
    await expect(page.getByRole('button', { name: /Manage/ })).toBeVisible();
  });

  test('search by appointment id calls GET /api/appointments/:id', async ({ page }) => {
    let byIdCalls = 0;
    await page.route((u) => u.pathname === `/api/appointments/${APPT_ID}`, (route) => {
      byIdCalls += 1;
      return json(route, appointment());
    });
    await search(page, APPT_ID);

    await expect(page.getByText('Ravi Kumar')).toBeVisible();
    expect(byIdCalls).toBe(1);
  });

  test('unknown phone shows No appointments found', async ({ page }) => {
    await stubLookup(page, []);
    await search(page, '9000099999');
    await expect(page.getByText('No appointments found.')).toBeVisible();
  });

  test('unknown id surfaces the 404 message', async ({ page }) => {
    await page.route((u) => u.pathname === `/api/appointments/${APPT_ID}`, (route) =>
      apiError(route, 404, 'APPOINTMENT_NOT_FOUND', 'No appointment found for the given ID or phone number.')
    );
    await search(page, APPT_ID);
    await expect(page.getByText('No appointment found for the given ID or phone number.')).toBeVisible();
  });

  test('cancelled appointments are listed but cannot be managed', async ({ page }) => {
    await stubLookup(page, [appointment({ status: 'CANCELLED' })]);
    await search(page, '9876543210');
    await expect(page.getByText('CANCELLED')).toBeVisible();
    await expect(page.getByRole('button', { name: /Manage/ })).toHaveCount(0);
  });
});

test.describe('Cancel', () => {
  test('confirming the dialog cancels, shows the result and the SMS banner', async ({ page }) => {
    await stubLookup(page, [appointment()]);
    let cancelCalls = 0;
    await page.route((u) => u.pathname === `/api/appointments/${APPT_ID}/cancel`, (route) => {
      cancelCalls += 1;
      return json(route, appointment({ status: 'CANCELLED', smsStatus: 'SENT' }));
    });
    page.once('dialog', (d) => d.accept());

    await openManage(page);
    await page.getByRole('button', { name: 'Cancel Appointment' }).click();

    await expect(page.getByText('Appointment Cancelled')).toBeVisible();
    await expect(page.getByTestId('sms-banner')).toHaveAttribute('data-sms-state', 'SENT');
    expect(cancelCalls).toBe(1);
  });

  test('dismissing the dialog sends nothing', async ({ page }) => {
    await stubLookup(page, [appointment()]);
    let cancelCalls = 0;
    await page.route((u) => u.pathname === `/api/appointments/${APPT_ID}/cancel`, (route) => {
      cancelCalls += 1;
      return json(route, appointment({ status: 'CANCELLED' }));
    });
    page.once('dialog', (d) => d.dismiss());

    await openManage(page);
    await page.getByRole('button', { name: 'Cancel Appointment' }).click();

    await expect(page.getByRole('button', { name: 'Cancel Appointment' })).toBeVisible();
    expect(cancelCalls).toBe(0);
  });

  test('409 already cancelled is shown as an error and the card stays', async ({ page }) => {
    await stubLookup(page, [appointment()]);
    await page.route((u) => u.pathname === `/api/appointments/${APPT_ID}/cancel`, (route) =>
      apiError(route, 409, 'APPOINTMENT_ALREADY_CANCELLED', 'This appointment is already cancelled.')
    );
    page.once('dialog', (d) => d.accept());

    await openManage(page);
    await page.getByRole('button', { name: 'Cancel Appointment' }).click();

    await expect(page.getByText('This appointment is already cancelled.')).toBeVisible();
  });
});

test.describe('Cancel with persistent SMS failure (AC-9)', () => {
  test('SMS that failed after retries shows the red manual-contact alert', async ({ page }) => {
    await stubLookup(page, [appointment()]);
    await page.route((u) => u.pathname === `/api/appointments/${APPT_ID}/cancel`, (route) =>
      json(route, appointment({ status: 'CANCELLED', smsStatus: 'FAILED' }))
    );
    await page.route((u) => u.pathname === `/api/appointments/${APPT_ID}/sms`, (route) =>
      json(route, {
        appointmentId: APPT_ID,
        latest: { messageType: 'CANCELLATION', status: 'FAILED', attemptCount: 3, updatedAt: new Date().toISOString() },
        failedAfterRetries: true,
      })
    );
    await page.clock.install();
    page.once('dialog', (d) => d.accept());

    await openManage(page);
    await page.getByRole('button', { name: 'Cancel Appointment' }).click();
    await expect(page.getByTestId('sms-banner')).toHaveAttribute('data-sms-state', 'FAILED');

    await page.clock.runFor(15_000);
    const banner = page.getByTestId('sms-banner');
    await expect(banner).toHaveAttribute('data-sms-state', 'FAILED_AFTER_RETRIES');
    await expect(banner).toHaveAttribute('role', 'alert');
    await expect(banner).toContainText('contact patient manually');
  });
});

test.describe('Reschedule', () => {
  async function openReschedule(page: Page) {
    await stubLookup(page, [appointment()]);
    await openManage(page);
    await page.getByRole('button', { name: 'Reschedule' }).click();
    await page.locator('input[type="date"]').fill(nextMonday());
  }

  test('picking a new date and slot creates a linked appointment and shows the SMS banner', async ({ page }) => {
    let patchBody: Record<string, unknown> | undefined;
    await page.route((u) => u.pathname === `/api/appointments/${APPT_ID}/reschedule`, (route) => {
      patchBody = route.request().postDataJSON();
      return json(route, appointment({ appointmentId: NEW_APPT_ID, previousAppointmentId: APPT_ID, slotTime: '10:30' }), 201);
    });

    await openReschedule(page);
    await page.locator('select').selectOption('10:30');
    await page.getByRole('button', { name: 'Confirm Reschedule' }).click();

    await expect(page.getByText('Appointment Rescheduled')).toBeVisible();
    await expect(page.getByText(NEW_APPT_ID)).toBeVisible();
    await expect(page.getByTestId('sms-banner')).toHaveAttribute('data-sms-state', 'SENT');
    expect(patchBody).toEqual({ appointmentDate: nextMonday(), slotTime: '10:30' });
  });

  test('slot conflict (409) is shown and the form stays open', async ({ page }) => {
    await page.route((u) => u.pathname === `/api/appointments/${APPT_ID}/reschedule`, (route) =>
      apiError(route, 409, 'SLOT_UNAVAILABLE', 'The selected slot is already booked. Please choose another time.', 'slotTime')
    );

    await openReschedule(page);
    await page.locator('select').selectOption('14:00');
    await page.getByRole('button', { name: 'Confirm Reschedule' }).click();

    await expect(page.getByText('The selected slot is already booked. Please choose another time.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm Reschedule' })).toBeVisible();
  });

  test('Confirm Reschedule is disabled until a slot is chosen', async ({ page }) => {
    await openReschedule(page);
    await expect(page.getByRole('button', { name: 'Confirm Reschedule' })).toBeDisabled();
  });

  test('leaving reschedule mode returns to the Reschedule / Cancel choices', async ({ page }) => {
    await openReschedule(page);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Reschedule' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel Appointment' })).toBeVisible();
  });
});
