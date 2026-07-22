import { expect, test } from "@playwright/test";

import { registerFreshUser } from "./helpers";

test("signup lands on the dashboard with the user in the sidebar", async ({ page }) => {
  const { email } = await registerFreshUser(page, "Signup Flow");
  await expect(page.getByText("Signup Flow")).toBeVisible();

  // email now lives on the Profile page rather than the sidebar
  await page.getByRole("link", { name: "Profile" }).click();
  await expect(page.getByText(email)).toBeVisible();
});

test("logout returns to login and the guard blocks protected routes", async ({ page }) => {
  await registerFreshUser(page);

  await page.goto("/profile");
  await page.getByRole("button", { name: "Log out" }).click();
  await page.waitForURL("**/login");

  // deep link to a protected route must bounce back to /login
  await page.goto("/tasks");
  await page.waitForURL("**/login");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("login rejects wrong credentials and accepts the right ones", async ({ page }) => {
  const { email, password } = await registerFreshUser(page);
  await page.goto("/profile");
  await page.getByRole("button", { name: "Log out" }).click();
  await page.waitForURL("**/login");

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("definitely-wrong-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  // stays on the login page and shows the backend error
  await expect(page.getByRole("alert")).toContainText("Incorrect email or password");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();

  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(url => !url.pathname.includes("login"));
  await expect(page.getByRole("link", { name: /Dashboard/ })).toBeVisible();
});
