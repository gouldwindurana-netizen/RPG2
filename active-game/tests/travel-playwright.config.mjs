import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'travel-browser.spec.mjs',
  outputDir: './travel-artifacts',
  timeout: 90000,
  workers: 1,
  reporter: 'list',
  use: {
    viewport: { width: 1280, height: 900 },
    launchOptions: { executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
