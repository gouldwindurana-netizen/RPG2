import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'equipment-browser.spec.mjs',
  outputDir: './artifacts',
  timeout: 45000,
  workers: 1,
  reporter: 'list',
  use: {
    viewport: { width: 1280, height: 900 },
    launchOptions: { executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
