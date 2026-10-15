import type { Page } from '@playwright/test';
import { DEPT, DOCTOR, nextMonday } from './mockApi';

/** Fills the receptionist booking form. Labels in the app are not bound to inputs, so use structural locators. */
export async function fillBooking(
  page: Page,
  opts: { anyDoctor?: boolean; anySlot?: boolean; slot?: string; date?: string } = {}
) {
  await page.goto('/');
  await page.getByPlaceholder('Full name').fill('Ravi Kumar');
  await page.getByPlaceholder('9876543210').fill('9876543210');
  await page.locator('select').nth(0).selectOption(DEPT.id);
  await page.locator('input[type="date"]').fill(opts.date ?? nextMonday());

  if (opts.anyDoctor) {
    await page.getByLabel(/Any doctor/).check();
  } else {
    await page.locator('select').nth(1).selectOption(DOCTOR.id);
  }

  if (opts.anySlot) {
    await page.getByLabel(/Any available slot/).check();
  } else if (opts.slot) {
    await page.locator('select').nth(2).selectOption(opts.slot);
  }
}

export const submitBooking = (page: Page) => page.getByRole('button', { name: 'Confirm Appointment' }).click();
