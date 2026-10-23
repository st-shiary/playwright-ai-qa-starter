import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  // Tests are independent, so they run in parallel. Each test logs in on its own.
  fullyParallel: true,
  forbidOnly: isCI, // fail CI if someone leaves test.only in the code
  retries: isCI ? 1 : 0, // one retry in CI; a test that needs it is reported as "flaky"
  workers: isCI ? 2 : undefined,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    // Machine-readable report: read by scripts/ai-triage.ts to write the bug report
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL: 'https://www.saucedemo.com',
    // The sample shop marks elements with data-test="..." instead of data-testid
    testIdAttribute: 'data-test',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Uncomment to run on more browsers (this is how a Regression Suite package differs):
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
