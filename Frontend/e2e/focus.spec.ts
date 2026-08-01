import { expect, test } from "@playwright/test";

import { registerFreshUser } from "./helpers";

test("focus session lifecycle: start, pause, resume, quit", async ({ page }) => {
  await registerFreshUser(page);

  await page.getByRole("link", { name: "Focus" }).click();
  await expect(page.getByRole("heading", { name: "No active session" })).toBeVisible();

  // Setup is one modal now; the defaults (2h at 50/10) are enough to start.
  await page.getByRole("button", { name: "Start focus session" }).click();
  await expect(page.getByRole("dialog", { name: "New focus session" })).toBeVisible();
  await page.getByRole("button", { name: "Start session" }).click();

  // Active: the phase label names the block and the empty state is gone.
  await expect(page.getByText(/Focus · block 1 of/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "No active session" })).toBeHidden();

  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByText("Paused — the plan holds its place")).toBeVisible();

  await page.getByRole("button", { name: "Resume" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();

  await page.getByRole("button", { name: "End session" }).click();
  await page.getByRole("menuitem", { name: "Quit session" }).click();

  // Quit leaves a summary you can dismiss back to the empty state.
  await expect(page.getByRole("heading", { name: "Session quit" })).toBeVisible();
  await page.getByRole("button", { name: "Dismiss" }).click();
  await expect(page.getByRole("heading", { name: "No active session" })).toBeVisible();
});

test("attaching a task from the setup modal carries it into the session", async ({ page }) => {
  await registerFreshUser(page);

  await page.getByRole("link", { name: "Tasks" }).click();
  await page.getByPlaceholder(/Add a task/i).fill("Write the launch note");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Write the launch note")).toBeVisible();

  await page.getByRole("link", { name: "Focus" }).click();
  await page.getByRole("button", { name: "Start focus session" }).click();

  // Tick the task in the picker, then confirm it rides into the running session.
  await page.getByRole("button", { name: /Write the launch note/ }).click();
  await expect(page.getByText("1 task attached")).toBeVisible();
  await page.getByRole("button", { name: "Start session" }).click();

  await expect(page.getByText(/In this session · 0 of 1 done/)).toBeVisible();
  await page.getByRole("checkbox", { name: "Complete Write the launch note" }).click();
  await expect(page.getByText(/In this session · 1 of 1 done/)).toBeVisible();
});
