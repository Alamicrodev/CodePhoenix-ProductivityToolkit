import { expect, test } from "@playwright/test";

import { registerFreshUser } from "./helpers";

test("quick-add a habit and check it in", async ({ page }) => {
  await registerFreshUser(page);

  await page.getByRole("link", { name: "Habits" }).click();
  await expect(page.getByText(/No habits yet/)).toBeVisible();

  // Quick-add parses the duration and frequency tokens
  const quickAdd = page.getByPlaceholder(/Add a habit/);
  await quickAdd.fill("evening walk 10m every weekday");
  await quickAdd.press("Enter");

  await expect(page.getByText("Evening walk")).toBeVisible();
  await expect(page.getByText("Weekdays · 10m")).toBeVisible();

  const checkin = page.getByRole("checkbox", { name: 'Check in "Evening walk"' });
  await checkin.click();
  await expect(checkin).toHaveAttribute("aria-checked", "true");

  // completion persists across a reload
  await page.reload();
  await expect(page.getByRole("checkbox", { name: 'Check in "Evening walk"' })).toHaveAttribute(
    "aria-checked",
    "true",
  );
});

test("habit detail shows the calendar and stats", async ({ page }) => {
  await registerFreshUser(page);
  await page.goto("/habits");

  const quickAdd = page.getByPlaceholder(/Add a habit/);
  await quickAdd.fill("morning meditation");
  await quickAdd.press("Enter");

  await page.getByText("Morning meditation").click();
  await expect(page.getByText("Habit strength")).toBeVisible();
  await expect(page.getByText("Current streak")).toBeVisible();
  await expect(page.getByText(/of \d+ days logged/)).toBeVisible();
});
