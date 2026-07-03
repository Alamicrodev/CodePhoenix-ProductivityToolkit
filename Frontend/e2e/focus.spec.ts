import { expect, test } from "@playwright/test";

import { registerFreshUser } from "./helpers";

test("focus session lifecycle: start, pause, resume, quit", async ({ page }) => {
  await registerFreshUser(page);

  await page.getByRole("link", { name: "Focus" }).click();
  await page.getByRole("button", { name: "Start New Focus Session" }).click();
  await expect(page.getByRole("heading", { name: "Create Focus Session" })).toBeVisible();
  await page.getByRole("button", { name: "Start Session" }).click();

  // active: timer panel is up, and a second session cannot be started
  await expect(page.getByRole("heading", { name: "Focus period in progress" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start New Focus Session" })).toBeDisabled();

  await page.getByRole("button", { name: "Pause Session" }).click();
  // paused: resume appears in the panel (and in the history card — scope to first)
  await page.getByRole("button", { name: "Resume Session" }).first().click();
  await expect(page.getByRole("button", { name: "Pause Session" })).toBeVisible();

  await page.getByRole("button", { name: "Quit Session" }).click();
  // quit: back to the empty state and a new session may start
  await expect(page.getByRole("button", { name: "Create A Focus Session" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start New Focus Session" })).toBeEnabled();
});
