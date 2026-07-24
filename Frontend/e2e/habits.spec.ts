import { expect, test } from "@playwright/test";

import { registerFreshUser } from "./helpers";

// Matrix day-cells label themselves "<local date key> - <status>" (HabitDayCell).
function todayKey() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

test("create a habit and mark it complete", async ({ page }) => {
  await registerFreshUser(page);

  await page.getByRole("link", { name: "Habits" }).click();
  await expect(page.getByText("No habits yet")).toBeVisible();

  await page.getByRole("button", { name: "New Habit" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Habit Name").fill("Evening walk");
  await dialog.getByRole("button", { name: "Create Habit" }).click();

  // The default matrix view lists the habit as a link to its detail page.
  await expect(page.getByRole("link", { name: "Evening walk" })).toBeVisible();

  // Completing today means toggling today's cell in the matrix.
  await page.locator(`button[title="${todayKey()} - pending"]`).click();
  await expect(page.locator(`button[title="${todayKey()} - completed"]`)).toBeVisible();

  // completion persists across a reload
  await page.reload();
  await expect(page.locator(`button[title="${todayKey()} - completed"]`)).toBeVisible();
});
