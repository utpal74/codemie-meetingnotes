import { test, expect, type Page } from '@playwright/test';
import { APPT_ID, appointment, json, mockBase, mockBooking, mockSmsStatus, smsStatusBody, type Recorder } from '../support/mockApi';
import { fillBooking, submitBooking } from '../support/bookingForm';

// AC-9 (UI): SMS delivery state is shown after booking and escalates when retries are exhausted.
// The hook polls GET /api/appointments/:id/sms every 15 s; page.clock fast-forwards that timer.
// All /api traffic is stubbed.

let rec: Recorder;

test.beforeEach(async ({ page }) => {
  rec = await mockBase(page);
});

async function bookWithSms(page: Page, smsStatus: string) {
  await mockBooking(page, rec, (route) => json(route, appointment({ smsStatus }), 201));
  await fillBooking(page, { anyDoctor: true, anySlot: true });
  await submitBooking(page);
  await expect(page.getByText('Appointment Confirmed')).toBeVisible();
}

const banner = (page: Page) => page.getByTestId('sms-banner');

test.describe('Initial state from the booking response', () => {
  test('SENT is green and never polls', async ({ page }) => {
    await page.clock.install();
    await mockSmsStatus(page, rec, APPT_ID, [smsStatusBody('SENT', 1, false)]);
    await bookWithSms(page, 'SENT');

    await expect(banner(page)).toHaveAttribute('data-sms-state', 'SENT');
    await expect(banner(page)).toContainText('SMS sent to the patient');
    await page.clock.runFor(60_000);
    expect(rec.smsPolls).toBe(0);
  });

  test('DISABLED is shown as a grey informational banner', async ({ page }) => {
    await bookWithSms(page, 'DISABLED');
    await expect(banner(page)).toHaveAttribute('data-sms-state', 'DISABLED');
    await expect(banner(page)).toContainText('SMS notifications are disabled');
  });

  test('PENDING_RETRY is amber with a status role', async ({ page }) => {
    await page.clock.install();
    await mockSmsStatus(page, rec, APPT_ID, [smsStatusBody('PENDING', 1, false)]);
    await bookWithSms(page, 'PENDING_RETRY');

    await expect(banner(page)).toHaveAttribute('data-sms-state', 'PENDING_RETRY');
    await expect(banner(page)).toHaveAttribute('role', 'status');
    await expect(banner(page)).toContainText('SMS still sending');
  });

  test('FAILED asks the receptionist to inform the patient verbally', async ({ page }) => {
    await page.clock.install();
    await mockSmsStatus(page, rec, APPT_ID, [smsStatusBody('FAILED', 1, false)]);
    await bookWithSms(page, 'FAILED');

    await expect(banner(page)).toHaveAttribute('data-sms-state', 'FAILED');
    await expect(banner(page)).toContainText('inform the patient verbally');
  });
});

test.describe('Polling transitions', () => {
  test('PENDING_RETRY turns green once the backend reports SENT', async ({ page }) => {
    await page.clock.install();
    await mockSmsStatus(page, rec, APPT_ID, [smsStatusBody('SENT', 2, false)]);
    await bookWithSms(page, 'PENDING_RETRY');

    await page.clock.runFor(15_000);
    await expect(banner(page)).toHaveAttribute('data-sms-state', 'SENT');
    const polls = rec.smsPolls;
    await page.clock.runFor(45_000);
    expect(rec.smsPolls).toBe(polls); // polling stops after success
  });

  test('FAILED escalates to FAILED_AFTER_RETRIES (alert, no dismiss) and polling stops', async ({ page }) => {
    await page.clock.install();
    await mockSmsStatus(page, rec, APPT_ID, [smsStatusBody('FAILED', 3, true)]);
    await bookWithSms(page, 'FAILED');
    await expect(page.getByRole('button', { name: 'Dismiss' })).toBeVisible();

    await page.clock.runFor(15_000);
    await expect(banner(page)).toHaveAttribute('data-sms-state', 'FAILED_AFTER_RETRIES');
    await expect(banner(page)).toHaveAttribute('role', 'alert');
    await expect(banner(page)).toContainText('SMS failed after retries');
    await expect(banner(page)).toContainText('contact patient manually');
    await expect(page.getByRole('button', { name: 'Dismiss' })).toHaveCount(0);

    const polls = rec.smsPolls;
    await page.clock.runFor(60_000);
    expect(rec.smsPolls).toBe(polls);
  });

  test('keeps polling while the backend still reports PENDING', async ({ page }) => {
    await page.clock.install();
    await mockSmsStatus(page, rec, APPT_ID, [smsStatusBody('PENDING', 1, false), smsStatusBody('PENDING', 2, false), smsStatusBody('SENT', 3, false)]);
    await bookWithSms(page, 'PENDING_RETRY');

    await page.clock.runFor(15_000);
    await expect(banner(page)).toHaveAttribute('data-sms-state', 'PENDING_RETRY');
    await page.clock.runFor(15_000);
    await page.clock.runFor(15_000);
    await expect(banner(page)).toHaveAttribute('data-sms-state', 'SENT');
    expect(rec.smsPolls).toBe(3);
  });

  test('a transient polling error does not clear the banner', async ({ page }) => {
    await page.clock.install();
    await page.route((u) => u.pathname === `/api/appointments/${APPT_ID}/sms`, (route) => route.abort());
    await bookWithSms(page, 'FAILED');

    await page.clock.runFor(15_000);
    await expect(banner(page)).toHaveAttribute('data-sms-state', 'FAILED');
  });
});

test.describe('Dismissal', () => {
  test('a non-critical banner can be dismissed', async ({ page }) => {
    await bookWithSms(page, 'DISABLED');
    await page.getByRole('button', { name: 'Dismiss' }).click();
    await expect(banner(page)).toHaveCount(0);
  });
});
