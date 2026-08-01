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
  await expect(page.getByText("Press C to add your first habit.")).toBeVisible();

  // Creation is the inline quick-add, not a modal. Schedule tokens are parsed
  // out of the draft, and the field keeps focus so a run of habits can be
  // typed straight through.
  const quickAdd = page.getByPlaceholder(/Add a habit/);
  await quickAdd.fill("Evening walk every weekday");
  await quickAdd.press("Enter");

  await expect(page.getByRole("link", { name: "Evening walk" })).toBeVisible();
  await expect(quickAdd).toHaveValue("");
  await expect(quickAdd).toBeFocused();

  // The row's check-in circle marks today.
  await page.getByRole("checkbox", { name: "Check in: Evening walk" }).click();
  await expect(page.getByRole("checkbox", { name: "Undo check-in: Evening walk" })).toBeVisible();

  // completion persists across a reload
  await page.reload();
  await expect(page.getByRole("checkbox", { name: "Undo check-in: Evening walk" })).toBeVisible();
});

test("V switches to the matrix, which shows the same check-in", async ({ page }) => {
  await registerFreshUser(page);

  await page.getByRole("link", { name: "Habits" }).click();
  const quickAdd = page.getByPlaceholder(/Add a habit/);
  await quickAdd.fill("Evening walk");
  await quickAdd.press("Enter");
  await page.getByRole("checkbox", { name: "Check in: Evening walk" }).click();

  // Shortcuts stay suppressed while the quick-add has focus.
  await quickAdd.press("v");
  await expect(quickAdd).toHaveValue("v");
  await quickAdd.clear();
  await quickAdd.press("Escape");

  await page.keyboard.press("v");
  await expect(page.locator(`button[title="${todayKey()} - completed"]`)).toBeVisible();
});
