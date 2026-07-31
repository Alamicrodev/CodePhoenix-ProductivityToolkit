import { Page, expect } from "@playwright/test";

/** Registers a brand-new user through the signup form and lands on the dashboard. */
export async function registerFreshUser(page: Page, name = "E2E Tester") {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = "e2epassword123";

  await page.goto("/register");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("heading", { name: "Today", level: 1 })).toBeVisible();
  return { email, password, name };
}
