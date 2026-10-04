import { defineConfig, devices } from '@playwright/test';

// The stack under test. CI starts it (docker compose, production builds) and sets BASE_URL.
// Locally, run the stack yourself or set E2E_WEB_SERVER to a command that serves a production build.
const baseURL = process.env.BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? '50%' : undefined,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : [['list'], ['html', { open: 'never' }]],
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled', caret: 'hide', scale: 'css' },
  },
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    // No traces, videos, or screenshots while signing in: they would record the test passwords in the report.
    { name: 'setup', testMatch: /.*\.setup\.ts/, use: { trace: 'off', video: 'off', screenshot: 'off' } },
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, dependencies: ['setup'] },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, dependencies: ['setup'] },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, dependencies: ['setup'] },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] }, dependencies: ['setup'] },
    { name: 'mobile-safari', use: { ...devices['iPhone 14'] }, dependencies: ['setup'] },
  ],
  webServer: process.env.E2E_WEB_SERVER
    ? { command: process.env.E2E_WEB_SERVER, url: baseURL, reuseExistingServer: !process.env.CI, timeout: 180_000 }
    : undefined,
});
