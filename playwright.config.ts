import { defineConfig, devices } from "@playwright/test";

const port = 4173;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "off",
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    // isMobile stays off so WebKit will deliver a wheel gesture. Mobile WebKit
    // in Playwright rejects the wheel and can only tap, not touch-move.
    // Viewport, scale, and user agent still match the phone.
    { name: "iphone-13", use: { ...devices["iPhone 13"], isMobile: false } },
    {
      name: "iphone-se",
      use: {
        ...devices["iPhone SE"],
        isMobile: false,
        viewport: { width: 375, height: 667 },
      },
    },
    {
      name: "iphone-se-touch",
      use: {
        ...devices["iPhone SE"],
        browserName: "chromium",
        defaultBrowserType: "chromium",
        viewport: { width: 375, height: 667 },
      },
    },
  ],
});
