import { expect, test } from "@playwright/test";

import { registerFreshUser } from "./helpers";

test("create a habit via the modal and check it in", async ({ page }) => {
  await registerFreshUser(page);

  await page.getByRole("link", { name: "Habits" }).click();
  await expect(page.getByText(/No habits yet/)).toBeVisible();

  await page.getByRole("button", { name: "New habit" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Habit Name").fill("Evening walk");
  await dialog.getByRole("button", { name: "Create Habit" }).click();

  await expect(page.getByText("Evening walk")).toBeVisible();

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

  await page.getByRole("button", { name: "New habit" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Habit Name").fill("Morning meditation");
  await dialog.getByRole("button", { name: "Create Habit" }).click();

  await page.getByText("Morning meditation").click();
  await expect(page.getByText("Habit strength")).toBeVisible();
  await expect(page.getByText("Current streak")).toBeVisible();
  await expect(page.getByText(/of \d+ days logged/)).toBeVisible();
});

test("C shortcut opens the new habit modal", async ({ page }) => {
  await registerFreshUser(page);
  await page.getByRole("link", { name: "Habits" }).click();
  // wait for the page (and its keydown listener) to be ready before pressing C
  await expect(page.getByRole("button", { name: "New habit" })).toBeVisible();

  await page.keyboard.press("c");
  await expect(page.getByRole("dialog").getByLabel("Habit Name")).toBeVisible();
});
