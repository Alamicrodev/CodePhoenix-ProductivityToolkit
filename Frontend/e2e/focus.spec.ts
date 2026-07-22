import { expect, test } from "@playwright/test";

import { registerFreshUser } from "./helpers";

test("focus session lifecycle: plan, pause, resume, end", async ({ page }) => {
  await registerFreshUser(page);

  await page.getByRole("link", { name: "Focus" }).click();
  await expect(page.getByText(/No sessions yet/)).toBeVisible();

  // Quick-add plans and starts the session (30m total, 25/5 split)
  const quickAdd = page.getByPlaceholder(/Plan a session/);
  await quickAdd.fill("30m deep work, 25/5");
  await quickAdd.press("Enter");

  // active: countdown panel with Pause; the planner quick-add is gone
  await expect(page.getByRole("button", { name: /Pause/ })).toBeVisible();
  await expect(page.getByPlaceholder(/Plan a session/)).toHaveCount(0);

  await page.getByRole("button", { name: /Pause/ }).click();
  await expect(page.getByRole("button", { name: /Resume/ })).toBeVisible();
  await page.getByRole("button", { name: /Resume/ }).click();
  await expect(page.getByRole("button", { name: /Pause/ })).toBeVisible();

  await page.getByRole("button", { name: "End", exact: true }).click();
  // ended: planner returns and the session lands in history
  await expect(page.getByPlaceholder(/Plan a session/)).toBeVisible();
  await expect(page.getByText("ended early")).toBeVisible();
});
