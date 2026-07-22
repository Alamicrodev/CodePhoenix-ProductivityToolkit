import { expect, test } from "@playwright/test";

import { registerFreshUser } from "./helpers";

test("quick-add a task, complete it, and see it persist across a reload", async ({ page }) => {
  await registerFreshUser(page);

  await page.getByRole("link", { name: "Tasks" }).click();
  await expect(page.getByText("0 active · 0 done")).toBeVisible();

  // Quick-add parses "!high" into priority and keeps the field focused.
  const quickAdd = page.getByPlaceholder(/Add a task/);
  await quickAdd.fill("ship the e2e suite !high");
  await quickAdd.press("Enter");

  await expect(page.getByText("1 active · 0 done")).toBeVisible();
  await expect(page.getByText("Ship the e2e suite")).toBeVisible();
  await expect(quickAdd).toHaveValue("");

  await page.getByRole("checkbox", { name: 'Mark done "Ship the e2e suite"' }).click();
  await expect(page.getByText("0 active · 1 done")).toBeVisible();

  // persistence: the completed task must survive a full reload
  await page.reload();
  await expect(page.getByText("0 active · 1 done")).toBeVisible();
  await expect(page.getByRole("button", { name: /Completed · 1/ })).toBeVisible();
  await expect(page.getByText("Ship the e2e suite")).toBeVisible();
});

test("matrix view shows quadrants and the V shortcut toggles views", async ({ page }) => {
  await registerFreshUser(page);
  await page.goto("/tasks");

  const quickAdd = page.getByPlaceholder(/Add a task/);
  await quickAdd.fill("prepare investor update !high today");
  await quickAdd.press("Enter");
  await expect(page.getByText("1 active · 0 done")).toBeVisible();

  await page.getByRole("button", { name: "Matrix", exact: true }).click();
  await expect(page.getByText("Urgent & important", { exact: true })).toBeVisible();
  await expect(page.getByText("Prepare investor update")).toBeVisible();

  // V toggles back to list (global shortcut, not while typing)
  await page.keyboard.press("v");
  await expect(quickAdd).toBeVisible();
});
