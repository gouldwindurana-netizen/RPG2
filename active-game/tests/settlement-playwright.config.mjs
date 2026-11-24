import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'settlement-browser.spec.mjs', outputDir: './settlement-browser-artifacts',
  timeout: 120000, expect: { timeout: 12000 }, workers: 1, reporter: 'list',
  use: { viewport: { width: 1280, height: 1000 },
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] },
    screenshot: 'only-on-failure', trace: 'retain-on-failure' },
});
