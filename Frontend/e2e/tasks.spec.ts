import { expect, test } from "@playwright/test";

import { registerFreshUser } from "./helpers";

test("quick-add and modal create tasks, completion persists across a reload", async ({ page }) => {
  await registerFreshUser(page);

  await page.getByRole("link", { name: "Tasks" }).click();
  await expect(page.getByText("0 active · 0 done")).toBeVisible();

  // quick-add: token parsing (priority, date, tag), field stays focused and clears
  const quickAdd = page.getByPlaceholder(/Add a task/);
  await quickAdd.fill("pay rent tomorrow !high #bills");
  await quickAdd.press("Enter");
  await expect(page.getByText("Pay rent")).toBeVisible();
  await expect(page.getByText("#bills")).toBeVisible();
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

test("keyboard shortcuts and command palette drive the page", async ({ page }) => {
  await registerFreshUser(page);
  await page.getByRole("link", { name: "Tasks" }).click();
  await expect(page.getByText("0 active · 0 done")).toBeVisible();

  // C focuses quick-add
  await page.keyboard.press("c");
  await expect(page.getByPlaceholder(/Add a task/)).toBeFocused();

  // Esc blurs; V switches to matrix and back
  await page.keyboard.press("Escape");
  await page.keyboard.press("v");
  await expect(page.getByText("Do first", { exact: true })).toBeVisible();
  await page.keyboard.press("v");
  await expect(page.getByPlaceholder(/Add a task/)).toBeVisible();

  // ⌘K/Ctrl+K opens the palette; a command switches views
  await page.keyboard.press("ControlOrMeta+k");
  const palette = page.getByPlaceholder("Type a command or search tasks…");
  await expect(palette).toBeVisible();
  await page.getByText("Switch to matrix view").click();
  await expect(page.getByText("Do first", { exact: true })).toBeVisible();

  // per-quadrant inline add creates a pre-filed task
  await page.getByRole("button", { name: /Add to Delegate/ }).click();
  await page.getByLabel("Add task to Delegate").fill("triage support inbox");
  await page.getByLabel("Add task to Delegate").press("Enter");
  await expect(page.getByText("Triage support inbox")).toBeVisible();

  // palette task search jumps to the edit modal
  await page.keyboard.press("ControlOrMeta+k");
  await palette.fill("triage");
  await page.getByRole("option", { name: /Triage support inbox/ }).click();
  await expect(page.getByRole("heading", { name: "Edit Task" })).toBeVisible();
});
