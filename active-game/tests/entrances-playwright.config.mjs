import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir: '.', testMatch: 'entrances-browser.spec.mjs', outputDir: './entrances-browser-artifacts',
 timeout: 150000, expect: { timeout: 15000 }, workers: 1, reporter: 'list',
 use: { viewport: { width: 1280, height: 1000 }, hasTouch: true, launchOptions: { executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox','--disable-dev-shm-usage'] }, screenshot: 'only-on-failure', trace: 'retain-on-failure' }
});
