import { expect, test } from "@playwright/test";

import { registerFreshUser } from "./helpers";

test("session restores from the stored token after a reload", async ({ page }) => {
  const { name } = await registerFreshUser(page, "Reload Survivor");

  await page.reload();

  await expect(page.getByRole("link", { name: /Dashboard/ })).toBeVisible();
  await expect(page.getByText(name)).toBeVisible();
});
