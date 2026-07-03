import { defineConfig, devices } from "@playwright/test";

// E2E smoke suite. Expects the full docker compose stack to be running:
//   docker compose up -d   (frontend :5173, backend :8000, postgres :5432)
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
