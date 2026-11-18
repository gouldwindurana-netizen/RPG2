import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: ['expansion-browser.spec.mjs', 'equipment-browser.spec.mjs', 'travel-browser.spec.mjs'], outputDir: './expansion-artifacts',
  timeout: 120000, workers: 1, reporter: 'list',
  use: { viewport: { width: 1280, height: 1000 },
    launchOptions: { executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] },
    screenshot: 'only-on-failure', trace: 'retain-on-failure' },
});
