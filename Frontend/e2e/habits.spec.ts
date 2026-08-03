import { expect, test } from "@playwright/test";

import { registerFreshUser } from "./helpers";

// Matrix day-cells label themselves "<local date key> - <status>" (HabitDayCell).
function todayKey() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

test("creates a habit from the quick-add and parses schedule tokens", async ({ page }) => {
  await registerFreshUser(page);

  await page.getByRole("link", { name: "Habits" }).click();
  await expect(page.getByText("Press C to add your first habit.")).toBeVisible();

  // Plain Enter creates inline and keeps focus, so a run of habits can be typed
  // straight through. This is condition (b) of the audit's B-3 modal ruling.
  const quickAdd = page.getByPlaceholder(/Add a habit/);
  await quickAdd.fill("Evening walk every weekday");
  await quickAdd.press("Enter");

  await expect(page.getByRole("link", { name: "Evening walk" })).toBeVisible();
  await expect(quickAdd).toHaveValue("");
  await expect(quickAdd).toBeFocused();

  // Page shortcuts stay suppressed while the quick-add has focus.
  await quickAdd.press("c");
  await expect(quickAdd).toHaveValue("c");
});

test("checks in from the matrix and it survives a reload", async ({ page }) => {
  await registerFreshUser(page);

  await page.getByRole("link", { name: "Habits" }).click();
  const quickAdd = page.getByPlaceholder(/Add a habit/);
  // No schedule token on purpose: activeDays [] is active every day, so this
  // cell stays toggleable whichever day the suite happens to run.
  await quickAdd.fill("Drink water");
  await quickAdd.press("Enter");
  await expect(page.getByRole("link", { name: "Drink water" })).toBeVisible();

  const cell = page.locator(`button[title="${todayKey()} - pending"]`);
  await cell.click();
  await expect(page.locator(`button[title="${todayKey()} - completed"]`)).toBeVisible();

  await page.reload();
  await expect(page.locator(`button[title="${todayKey()} - completed"]`)).toBeVisible();
});

test("⌘↵ opens the full editor seeded from the quick-add draft", async ({ page }) => {
  await registerFreshUser(page);

  await page.getByRole("link", { name: "Habits" }).click();
  const quickAdd = page.getByPlaceholder(/Add a habit/);
  await quickAdd.fill("meditate 10m every weekday");
  await quickAdd.press("ControlOrMeta+Enter");

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "New habit" })).toBeVisible();
  // The parsed draft carries over: title cleaned up, weekdays preselected.
  await expect(dialog.getByLabel("Habit title")).toHaveValue("Meditate 10m");
  await expect(dialog.getByRole("button", { name: "Monday" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(dialog.getByRole("button", { name: "Sunday" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(quickAdd).toHaveValue("");

  // Adjust something only the full editor exposes, then save with ⌘↵.
  await dialog.getByLabel("Habit description").fill("Ten quiet minutes");
  await page.keyboard.press("ControlOrMeta+Enter");

  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("link", { name: "Meditate 10m" })).toBeVisible();
});
