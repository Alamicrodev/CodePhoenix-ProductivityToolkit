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

  // The editor is the escalation from the quick-add, not a separate entry
  // point: the header button focuses the field, and Cmd/Ctrl+Enter hands the
  // draft off to the full editor.
  await page.getByRole("button", { name: /New task/ }).click();
  await expect(quickAdd).toBeFocused();

  await quickAdd.fill("Ship the e2e suite");
  await quickAdd.press("ControlOrMeta+Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByPlaceholder("Task title")).toHaveValue("Ship the e2e suite");
  await dialog.getByRole("button", { name: /Create task/ }).click();
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
  await expect(page.getByRole("heading", { name: "Edit task" })).toBeVisible();
});

test("quick-add hands off to the full editor, which edits via chips and saves with the keyboard", async ({
  page,
}) => {
  await registerFreshUser(page);
  await page.getByRole("link", { name: "Tasks" }).click();

  // ⌘↵ opens the editor pre-parsed instead of quick-adding
  const quickAdd = page.getByPlaceholder(/Add a task/);
  await quickAdd.fill("write launch email tomorrow !high #marketing");
  await quickAdd.press("ControlOrMeta+Enter");

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "New task" })).toBeVisible();
  await expect(dialog.getByPlaceholder("Task title")).toHaveValue("Write launch email");
  await expect(dialog.getByText("High", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Tomorrow", { exact: true })).toBeVisible();
  await expect(dialog.getByText("#marketing")).toBeVisible();
  await expect(quickAdd).toHaveValue("");

  // Property chips: set a time from the popover. The menus render into a
  // portal on document.body so they escape the modal's scroll box, which is
  // why they are addressed at page level rather than through `dialog`.
  await dialog.getByRole("button", { name: /^Time$/ }).click();
  await page.getByRole("menuitem", { name: "9:00 AM" }).click();
  await expect(dialog.getByText("9:00 AM")).toBeVisible();

  // Opening a menu must not make the editor scroll — an in-flow popover used
  // to grow the panel's scroll height and then get clipped by it.
  await dialog.getByRole("button", { name: /^Duration$/ }).click();
  await expect(page.getByRole("menuitem", { name: "1h 30m" })).toBeVisible();
  expect(
    await dialog.evaluate(el => el.scrollHeight <= el.clientHeight),
  ).toBe(true);
  await page.keyboard.press("Escape");

  // subtask checklist: ↵ appends and keeps the input ready
  const subtaskInput = dialog.getByPlaceholder(/Add a subtask/);
  await subtaskInput.fill("draft copy");
  await subtaskInput.press("Enter");
  await expect(dialog.getByText("0/1")).toBeVisible();
  await expect(subtaskInput).toHaveValue("");

  // ⌘↵ anywhere in the modal saves
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText("Write launch email")).toBeVisible();
  await expect(page.getByText("1 active · 0 done")).toBeVisible();

  // reopen: Esc closes an open popover first, a second Esc closes the modal
  await page.getByText("Write launch email").click();
  await expect(dialog.getByRole("heading", { name: "Edit task" })).toBeVisible();
  await dialog.getByRole("button", { name: "Tomorrow" }).click();
  await expect(page.getByRole("menuitem", { name: "Next week" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menuitem", { name: "Next week" })).not.toBeVisible();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});

test("row action opens the focus setup with the task preselected", async ({ page }) => {
  await registerFreshUser(page);
  await page.getByRole("link", { name: "Tasks" }).click();

  const quickAdd = page.getByPlaceholder(/Add a task/);
  await quickAdd.fill("deep work block !high");
  await quickAdd.press("Enter");
  await expect(page.getByText("Deep work block")).toBeVisible();

  await page.getByText("Deep work block").hover();
  await page
    .getByRole("button", { name: "Start focus session with: Deep work block" })
    .click();

  // lands on the focus page with the setup modal open and the task already ticked
  await expect(page.getByRole("dialog", { name: "New focus session" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Deep work block/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByText("1 task attached")).toBeVisible();
});
