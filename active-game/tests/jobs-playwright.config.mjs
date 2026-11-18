import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'jobs-browser.spec.mjs', outputDir: './jobs-browser-artifacts',
  timeout: 150000, expect: { timeout: 12000 }, workers: 1, reporter: 'list',
  use: { viewport: { width: 1280, height: 1000 },
    launchOptions: { executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] },
    screenshot: 'only-on-failure', trace: 'retain-on-failure' },
});
