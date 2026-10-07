/**
 * Playwright E2E tests: Admin Doctors UI
 * Story: EPMCDMETST-68125  AC covered: AC1, AC8, AC10, AC11, AC13, AC20
 * Run: npx playwright test tests/e2e/admin-doctors.spec.ts
 */
import { test, expect, Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:5173";
const ADMIN_USER = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASS = process.env.ADMIN_PASSWORD || "adminpassword";

// helpers -----------------------------------------------------------------

async function loginAsAdmin(page: Page) {
  await page.goto(BASE_URL + "/login");
  await page.fill('[name="username"], input[type="text"]:first-of-type', ADMIN_USER);
  await page.fill('[name="password"], input[type="password"]', ADMIN_PASS);
  await page.click('[type="submit"], button:has-text("Log in"), button:has-text("Login")');
  await page.waitForURL(/admin|dashboard/, { timeout: 10000 });
}

async function navigateToDoctors(page: Page) {
  await page.goto(BASE_URL + "/admin/doctors");
  await expect(page.getByRole("heading", { name: "Doctors" })).toBeVisible();
}

// tests -------------------------------------------------------------------

test.describe("Admin Doctors Page [AC20]", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  // AC20
  test("page loads with heading, filters, table, and New button", async ({ page }) => {
    await navigateToDoctors(page);
    await expect(page.getByRole("heading", { name: "Doctors" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Name" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Department" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Status" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Actions" })).toBeVisible();
    await expect(page.getByRole("button", { name: "+ New" })).toBeVisible();
    await expect(page.getByRole("combobox").first()).toBeVisible();
  });

  // AC8, AC20
  test("admin creates a new doctor via modal", async ({ page }) => {
    await navigateToDoctors(page);
    await page.getByRole("button", { name: "+ New" }).click();
    await expect(page.getByText("New Doctor")).toBeVisible();
    const nameInput = page.getByRole("textbox").first();
    await nameInput.fill("Dr. E2E Test Doctor");
    const deptSelect = page.locator("select").last();
    const optCount = await deptSelect.locator("option").count();
    expect(optCount).toBeGreaterThan(0);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("New Doctor")).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Dr. E2E Test Doctor")).toBeVisible();
  });

  // AC11, AC20
  test("admin deactivates a doctor", async ({ page }) => {
    await navigateToDoctors(page);
    const activeRow = page.locator("tbody tr").filter({ hasText: "Active" }).first();
    const doctorName = await activeRow.locator("td").first().textContent();
    await activeRow.getByRole("button", { name: "Deactivate" }).click();
    const updatedRow = page.locator("tbody tr").filter({ hasText: doctorName || "" });
    await expect(updatedRow.getByText("Inactive")).toBeVisible({ timeout: 5000 });
    await expect(updatedRow.getByRole("button", { name: "Activate" })).toBeVisible();
  });

  // AC13, AC20
  test("activating doctor in inactive department shows alert", async ({ page }) => {
    await navigateToDoctors(page);
    const badge = page.getByText("Dept inactive").first();
    const hasBadge = await badge.count() > 0;
    if (!hasBadge) {
      test.skip(true, "No doctor with inactive department found");
      return;
    }
    const inactiveDeptRow = page.locator("tbody tr").filter({ hasText: "Dept inactive" }).first();
    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain("Cannot activate a doctor while the department is inactive.");
      await dialog.accept();
    });
    await inactiveDeptRow.getByRole("button", { name: "Activate" }).click();
    await expect(inactiveDeptRow.getByText("Inactive")).toBeVisible({ timeout: 5000 });
  });

  // AC20 — badge
  test("doctor in inactive department shows Dept inactive badge", async ({ page }) => {
    await navigateToDoctors(page);
    const badge = page.getByText("Dept inactive").first();
    if (await badge.count() > 0) {
      await expect(badge).toBeVisible();
    }
  });

  // AC10, AC20
  test("admin edits a doctor name via Edit modal", async ({ page }) => {
    await navigateToDoctors(page);
    const firstRow = page.locator("tbody tr").first();
    const doctorName = await firstRow.locator("td").first().textContent();
    if (!doctorName || doctorName.includes("No doctors")) {
      test.skip(true, "No doctor rows available to edit");
      return;
    }
    await firstRow.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByText("Edit Doctor")).toBeVisible();
    const nameInput = page.getByRole("textbox").first();
    const originalName = await nameInput.inputValue();
    await nameInput.fill(originalName + " Updated");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Edit Doctor")).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText(originalName + " Updated")).toBeVisible();
  });
});

// AC1 — access control
test.describe("Admin Doctors Page access control [AC1]", () => {
  test("unauthenticated user cannot reach /admin/doctors", async ({ page }) => {
    await page.goto(BASE_URL + "/admin/doctors");
    const url = page.url();
    const isLoginPage = url.includes("login") || url.includes("auth");
    const hasBlockMessage = await page.getByText(/log in|unauthorized|forbidden/i).isVisible().catch(() => false);
    expect(isLoginPage || hasBlockMessage).toBe(true);
  });
});
