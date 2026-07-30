import { expect, test } from "@playwright/test";

import { registerFreshUser } from "./helpers";

test("quick-add and modal create tasks, completion persists across a reload", async ({ page }) => {
  await registerFreshUser(page);

  await page.getByRole("link", { name: "Tasks" }).click();
  await expect(page.getByText("0 active · 0 done")).toBeVisible();

  // quick-add: token parsing, field stays focused and clears
  const quickAdd = page.getByPlaceholder(/Add a task/);
  await quickAdd.fill("pay rent tomorrow !high");
  await quickAdd.press("Enter");
  await expect(page.getByText("Pay rent")).toBeVisible();
  await expect(page.getByText("1 active · 0 done")).toBeVisible();
  await expect(quickAdd).toHaveValue("");

  // modal path still works
  await page.getByRole("button", { name: "New task" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder(/Complete project proposal/).fill("Ship the e2e suite");
  await dialog.getByRole("button", { name: "Create Task" }).click();
  await expect(page.getByText("2 active · 0 done")).toBeVisible();

  // complete the quick-added task (sorted first: it has a due date)
  await page.getByRole("checkbox", { name: "Complete task: Pay rent" }).click();
  await expect(page.getByText("1 active · 1 done")).toBeVisible();

  // persistence: the completed task must survive a full reload
  await page.reload();
  await expect(page.getByText("1 active · 1 done")).toBeVisible();
  await expect(page.getByText("Completed · 1")).toBeVisible();

  // expanding the completed section reveals the struck-through task
  await page.getByText("Completed · 1").click();
  await expect(page.getByText("Pay rent")).toBeVisible();
});
