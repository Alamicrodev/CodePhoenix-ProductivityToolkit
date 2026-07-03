import { expect, test } from "@playwright/test";

import { registerFreshUser } from "./helpers";

test("create a task, complete it, and see it persist across a reload", async ({ page }) => {
  await registerFreshUser(page);

  await page.getByRole("link", { name: "Tasks" }).click();
  await expect(page.getByText("0 active tasks")).toBeVisible();

  await page.getByRole("button", { name: "New Task" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder(/Complete project proposal/).fill("Ship the e2e suite");
  await dialog.getByRole("button", { name: "Create Task" }).click();

  await expect(page.getByText("1 active task")).toBeVisible();
  await expect(page.getByText("Ship the e2e suite")).toBeVisible();

  await page.getByRole("checkbox").click();
  await expect(page.getByText(/1 completed/)).toBeVisible();

  // persistence: the completed task must survive a full reload
  await page.reload();
  await expect(page.getByText("Completed Tasks (1)")).toBeVisible();
  await expect(page.getByText("0 active tasks")).toBeVisible();
});
