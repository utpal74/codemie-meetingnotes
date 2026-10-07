/**
 * Playwright E2E tests: Admin Departments UI
 * Story: EPMCDMETST-68125  AC covered: AC1, AC2, AC3, AC4, AC5, AC6, AC19
 *
 * Prerequisites:
 *   - Frontend running on BASE_URL (default: http://localhost:5173)
 *   - Backend running on API_URL (default: http://localhost:3000)
 *   - Seeded test data or admin can create departments via UI
 *
 * Run: npx playwright test tests/e2e/admin-departments.spec.ts
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

async function navigateToDepartments(page: Page) {
  await page.goto(BASE_URL + "/admin/departments");
  await expect(page.getByRole("heading", { name: "Departments" })).toBeVisible();
}

// tests -------------------------------------------------------------------

test.describe("Admin Departments Page [AC19]", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  // AC19
  test("page loads with heading, table, and New button", async ({ page }) => {
    await navigateToDepartments(page);
    await expect(page.getByRole("heading", { name: "Departments" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Name" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Status" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Actions" })).toBeVisible();
    await expect(page.getByRole("button", { name: "+ New" })).toBeVisible();
  });

  // AC2, AC19
  test("admin creates a new department via modal", async ({ page }) => {
    await navigateToDepartments(page);
    await page.getByRole("button", { name: "+ New" }).click();

    const modal = page.getByRole("dialog").or(page.locator(".modal, [data-modal]")).first();
    await expect(page.getByText("New Department")).toBeVisible();

    await page.getByRole("textbox").fill("Neurology Test Dept");
    await page.getByRole("button", { name: "Save" }).click();

    // modal should close and row should appear
    await expect(page.getByText("New Department")).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Neurology Test Dept")).toBeVisible();
    await expect(page.getByText("Active").first()).toBeVisible();
  });

  // AC3, AC19
  test("duplicate department name shows inline error", async ({ page }) => {
    await navigateToDepartments(page);
    // First create a department
    await page.getByRole("button", { name: "+ New" }).click();
    await page.getByRole("textbox").fill("Duplicate Test Dept");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("New Department")).not.toBeVisible({ timeout: 5000 });

    // Try to create with same name
    await page.getByRole("button", { name: "+ New" }).click();
    await page.getByRole("textbox").fill("Duplicate Test Dept");
    await page.getByRole("button", { name: "Save" }).click();

    // Modal should stay open with error
    await expect(page.getByText("New Department")).toBeVisible();
    await expect(page.getByText("Department name already exists.")).toBeVisible();
  });

  // AC19 — search filter
  test("search box filters departments by name", async ({ page }) => {
    await navigateToDepartments(page);
    const searchBox = page.getByPlaceholder(/search/i);
    await searchBox.fill("Card");

    // Only rows matching "Card" should be visible in tbody
    const rows = page.locator("tbody tr");
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      const text = await rows.nth(i).textContent();
      if (text && !text.toLowerCase().includes("card") && !text.includes("No departments")) {
        throw new Error("Unexpected row visible after search: " + text);
      }
    }
  });

  // AC4, AC19
  test("admin edits a department name via Edit modal", async ({ page }) => {
    await navigateToDepartments(page);

    // Create a department to edit
    await page.getByRole("button", { name: "+ New" }).click();
    await page.getByRole("textbox").fill("Edit Target Dept");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("New Department")).not.toBeVisible({ timeout: 5000 });

    // Find the row and click Edit
    const row = page.locator("tbody tr").filter({ hasText: "Edit Target Dept" });
    await row.getByRole("button", { name: "Edit" }).click();

    await expect(page.getByText("Edit Department")).toBeVisible();
    const nameInput = page.getByRole("textbox");
    await expect(nameInput).toHaveValue("Edit Target Dept");
    await nameInput.fill("Edited Dept Name");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText("Edit Department")).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Edited Dept Name")).toBeVisible();
  });

  // AC5, AC19
  test("admin deactivates an active department", async ({ page }) => {
    await navigateToDepartments(page);

    // Find an Active department row
    const row = page.locator("tbody tr").filter({ hasText: "Active" }).first();
    const deptName = await row.locator("td").first().textContent();
    await row.getByRole("button", { name: "Deactivate" }).click();

    // Row should now show Inactive
    const updatedRow = page.locator("tbody tr").filter({ hasText: deptName || "" });
    await expect(updatedRow.getByText("Inactive")).toBeVisible({ timeout: 5000 });
    await expect(updatedRow.getByRole("button", { name: "Activate" })).toBeVisible();
  });

  // AC6, AC19
  test("admin activates an inactive department", async ({ page }) => {
    await navigateToDepartments(page);

    // Find an Inactive department row
    const row = page.locator("tbody tr").filter({ hasText: "Inactive" }).first();
    const deptName = await row.locator("td").first().textContent();
    await row.getByRole("button", { name: "Activate" }).click();

    const updatedRow = page.locator("tbody tr").filter({ hasText: deptName || "" });
    await expect(updatedRow.getByText("Active")).toBeVisible({ timeout: 5000 });
    await expect(updatedRow.getByRole("button", { name: "Deactivate" })).toBeVisible();
  });
});

// AC1 — access control
test.describe("Admin Departments Page — access control [AC1]", () => {
  test("unauthenticated user cannot reach /admin/departments", async ({ page }) => {
    await page.goto(BASE_URL + "/admin/departments");
    // Should redirect to login or show 401/403 message
    const url = page.url();
    const isLoginPage = url.includes("login") || url.includes("auth");
    const hasBlockMessage = await page.getByText(/log in|unauthorized|forbidden/i).isVisible().catch(() => false);
    expect(isLoginPage || hasBlockMessage).toBe(true);
  });
});
