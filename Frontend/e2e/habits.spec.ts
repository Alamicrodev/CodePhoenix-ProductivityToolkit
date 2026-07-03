import { expect, test } from "@playwright/test";

import { registerFreshUser } from "./helpers";

test("create a habit and mark it complete", async ({ page }) => {
  await registerFreshUser(page);

  await page.getByRole("link", { name: "Habits" }).click();
  await expect(page.getByText("No habits yet")).toBeVisible();

  await page.getByRole("button", { name: "New Habit" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Habit Name").fill("Evening walk");
  await dialog.getByRole("button", { name: "Create Habit" }).click();

  await expect(page.getByRole("heading", { name: "Evening walk" })).toBeVisible();

  await page.getByRole("button", { name: "Mark Complete" }).click();
  await expect(page.getByRole("button", { name: "Completed" })).toBeDisabled();

  // completion persists across a reload
  await page.reload();
  await expect(page.getByRole("button", { name: "Completed" })).toBeDisabled();
});
