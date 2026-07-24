import { defineConfig, devices } from "@playwright/test";

const CI = !!process.env.CI;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: CI ? 4 : undefined,
  timeout: 90_000,
  expect: { timeout: 7_000 },

  reporter: CI
    ? [
        ["github"],
        ["html", { open: "never" }],
        ["json", { outputFile: "results.json" }],
      ]
    : [["list"], ["html", { open: "never" }]],

  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{-projectName}{ext}",

  use: {
    trace: CI ? "on-first-retry" : "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    ignoreHTTPSErrors: true,
    actionTimeout: 10_000,
    navigationTimeout: 45_000,
  },

  projects: [
    // Desktop-viewport checks. The bulk of the checklist lives here.
    {
      name: "checks",
      testMatch: /(smoke|seo|a11y|content|links|media|layout|flows)\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },

    // The Mobile section of the checklist. Phone viewport, real touch emulation.
    {
      name: "responsive",
      testMatch: /responsive\.spec\.ts/,
      use: { ...devices["iPhone 13"] },
    },

    // Visual regression across viewports.
    {
      name: "desktop",
      testMatch: /visual\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "tablet",
      testMatch: /visual\.spec\.ts/,
      use: { ...devices["iPad (gen 7)"] },
    },
    {
      name: "mobile",
      testMatch: /visual\.spec\.ts/,
      use: { ...devices["iPhone 13"] },
    },

    // Cross-browser (checklist: Chrome, Brave, Safari, Mozilla).
    // Brave is Chromium — the `checks` project is a close proxy, not identical.
    // Uncomment to enable; these then run on every `npx playwright test`.
    // { name: 'firefox', testMatch: /smoke\.spec\.ts/, use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit',  testMatch: /smoke\.spec\.ts/, use: { ...devices['Desktop Safari'] } },
  ],
});
