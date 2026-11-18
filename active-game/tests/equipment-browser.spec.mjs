import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const gameFile = process.env.GAME_FILE || 'The_Road_Beyond_the_Bells.html';
const gameURL = `http://127.0.0.1:5190/${gameFile}`;
const HEROES = ['Mara', 'Tavin', 'Iona', 'Soren'];
const SLOTS = ['weapon', 'body', 'head', 'mantle', 'charm'];
const snapshot = page => page.evaluate(() => window.__AVEL__.snapshot());
const copyRow = (page, id) => page.locator(`[data-equip="${id}"]`).locator('..');

// This is an equipment regression fixture, not a campaign/story playthrough.
// Profile, version 3, per-hero XP/hx, starter inventory and equipment originate
// from actual new-game UI. Only gold and shop location are changed below.
async function newStriker(page, url = gameURL) {
  await page.addInitScript(() => {
    const fixture = sessionStorage.getItem('equipment-next-save');
    if (fixture) {
      localStorage.setItem('avel-demo-v1', fixture);
      sessionStorage.removeItem('equipment-next-save');
    }
  });
  await page.goto(url);
  await page.waitForFunction(() => window.__AVEL__);
  await page.locator('[data-front="new"]').click();
  await page.locator('#hero-name').fill('Test Striker');
  await page.locator('[data-front="next"]').click();
  await page.locator('[data-job="striker"]').click();
  await page.locator('[data-front="next"]').click();
  await page.locator('[data-front="begin"]').click();
  await page.locator('[data-intro="skip"]').click();
  expect((await snapshot(page)).profile.job).toBe('striker');
}

async function reloadFixture(page, change) {
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('avel-demo-v1')));
  change(save);
  await page.evaluate(save => sessionStorage.setItem('equipment-next-save', JSON.stringify(save)), save);
  await page.reload();
  await page.locator('[data-front="continue"]').click();
}

async function shopFixture(page) {
  await newStriker(page);
  await reloadFixture(page, save => {
    save.gold = 100000;
    save.area = 'dunmere';
    save.player = { x: 7, y: 7, facing: 'up' };
  });
  const state = await snapshot(page);
  expect(state.version).toBe(3);
  expect(state.hx).toEqual({ Mara: 0, Tavin: 0, Iona: 0, Soren: 0 });
  await openShop(page);
}

async function openShop(page) {
  await page.locator('[data-command="interact"]').click();
  await expect(page.locator('#dialog-title')).toHaveText('Weapon Shop');
}

async function buyFour(page, id) {
  await expect(page.locator('[data-shop-qty="1"]')).toHaveClass(/\bon\b/);
  const before = (await snapshot(page)).inventory[id] || 0;
  for (let copy = 0; copy < 4; copy++) {
    await expect(page.locator(`[data-buy="${id}"]`)).toHaveText('Buy ×1');
    await page.locator(`[data-buy="${id}"]`).click();
  }
  expect((await snapshot(page)).inventory[id]).toBe(before + 4);
}

async function openPackFromShop(page) {
  await page.locator('[data-command="dismiss"]').click();
  await page.locator('[data-panel="inventory"]').click();
}

async function equip(page, hero, slot, item) {
  await page.locator(`[data-pack-hero="${hero}"]`).click();
  await page.locator(`[data-eq-slot="${slot}"]`).click();
  await expect(page.locator(`[data-equip="${item}"]`)).toBeEnabled();
  await page.locator(`[data-equip="${item}"]`).click();
  expect((await snapshot(page)).heroes.find(h => h.id === hero).equipment[slot]).toBe(item);
}

function expectedLoadouts() {
  return HEROES.map(hero => ({
    weapon: `R02_${hero === 'Mara' ? 'TAVIN' : hero.toUpperCase()}_WEAPON`,
    body: `R02_${hero === 'Mara' ? 'TAVIN' : hero.toUpperCase()}_BODY`,
    head: 'R02_COMMON_HEAD', mantle: 'R02_COMMON_MANTLE', charm: 'R02_COMMON_CHARM',
  }));
}

async function buyFullPartyUpgrades(page) {
  for (const slot of ['HEAD', 'MANTLE', 'CHARM']) await buyFour(page, `R02_COMMON_${slot}`);
  for (const slot of ['WEAPON', 'BODY']) {
    await buyFour(page, `R02_TAVIN_${slot}`);
    for (const hero of ['IONA', 'SOREN']) await page.locator(`[data-buy="R02_${hero}_${slot}"]`).click();
  }
}

test('Optimize all equips four purchased charms, including magic-defense-only upgrades', async ({ page }, testInfo) => {
  await shopFixture(page);
  await buyFour(page, 'R02_COMMON_CHARM');
  await openPackFromShop(page);
  await page.locator('[data-optimize="all"]').click();
  const state = await snapshot(page);
  expect(state.heroes.map(h => h.equipment.charm)).toEqual(Array(4).fill('R02_COMMON_CHARM'));
  await page.locator('[data-eq-slot="charm"]').click();
  await expect(copyRow(page, 'R02_COMMON_CHARM')).toContainText('Owned 4 · Equipped 4 · Available 0');
  await expect(copyRow(page, 'R02_COMMON_CHARM')).toContainText('Worn by Test Striker, Tavin, Iona, Soren');
  await expect(page.locator('[data-equip="R02_COMMON_CHARM"]')).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath('four-charms-optimized.png'), fullPage: true });
});

test('manual equipment uses owned copies across all five slots and preserves jobs and saves', async ({ page }) => {
  await shopFixture(page);
  await buyFullPartyUpgrades(page);
  await openPackFromShop(page);
  const loadouts = expectedLoadouts();
  for (let index = 0; index < HEROES.length; index++) {
    for (const slot of SLOTS) await equip(page, HEROES[index], slot, loadouts[index][slot]);
  }
  let state = await snapshot(page);
  expect(state.heroes.map(h => h.equipment)).toEqual(loadouts);
  await page.locator('[data-pack-hero="Iona"]').click();
  await page.locator('[data-eq-slot="weapon"]').click();
  await expect(page.locator('[data-equip="R02_TAVIN_WEAPON"]')).toBeDisabled();
  await expect(page.locator('[data-equip="R02_TAVIN_WEAPON"]')).toHaveText('Wrong job');
  await expect(copyRow(page, 'R02_TAVIN_WEAPON')).toContainText('Owned 4 · Equipped 2 · Available 2');
  await expect(copyRow(page, 'R02_TAVIN_WEAPON')).toContainText('Worn by Test Striker, Tavin');
  await expect(copyRow(page, 'R02_TAVIN_WEAPON')).toContainText('Not compatible with Mender');
  // Changing equipment returns the previous copy to the pack.
  await equip(page, 'Mara', 'head', 'R01_COMMON_HEAD');
  await expect(copyRow(page, 'R02_COMMON_HEAD')).toContainText('Owned 4 · Equipped 3 · Available 1');
  await equip(page, 'Mara', 'head', 'R02_COMMON_HEAD');
  await page.locator('[data-optimize="all"]').click();
  await expect(page.locator('#toast')).toContainText('No upgrade available from owned copies.');
  state = await snapshot(page);
  const retained = { profile: state.profile, hx: state.hx, heroes: state.heroes, inventory: state.inventory };
  await page.reload();
  await page.locator('[data-front="continue"]').click();
  state = await snapshot(page);
  expect({ profile: state.profile, hx: state.hx, heroes: state.heroes, inventory: state.inventory }).toEqual(retained);
  // Sell only the two unused shared-job copies, never the two worn ones.
  await openShop(page);
  await page.locator('[data-shop-tab="sell"]').click();
  for (const slot of ['WEAPON', 'BODY']) {
    const id = `R02_TAVIN_${slot}`;
    for (let i = 0; i < 2; i++) await page.locator(`[data-sell="${id}"]`).click();
    await expect(page.locator(`[data-sell="${id}"]`)).toHaveCount(0);
    expect((await snapshot(page)).inventory[id]).toBe(2);
  }
  await expect(page.locator('[data-sell="R02_COMMON_CHARM"]')).toHaveCount(0);
  expect((await snapshot(page)).heroes.map(h => h.equipment)).toEqual(loadouts);
});

test('Optimize all fills all five slots for each compatible job without consuming extra copies', async ({ page }) => {
  await shopFixture(page);
  await buyFullPartyUpgrades(page);
  await openPackFromShop(page);
  const inventory = (await snapshot(page)).inventory;
  await page.locator('[data-optimize="all"]').click();
  const state = await snapshot(page);
  expect(state.heroes.map(h => h.equipment)).toEqual(expectedLoadouts());
  expect(state.inventory).toEqual(inventory);
  for (const hero of state.heroes) {
    const equippedBefore = { ...hero.equipment };
    await page.locator(`[data-pack-hero="${hero.id}"]`).click();
    await page.locator(`[data-optimize="${hero.id}"]`).click();
    expect((await snapshot(page)).heroes.find(h => h.id === hero.id).equipment).toEqual(equippedBefore);
  }
});

test('shop quantity controls buy 1, 5, 10 and Max, respect 99 cap, and restore one sold copy', async ({ page }) => {
  await shopFixture(page);
  const id = 'R02_COMMON_CHARM';
  for (const [quantity, owned] of [[1, 1], [5, 6], [10, 16], ['max', 99]]) {
    await page.locator(`[data-shop-qty="${quantity}"]`).click();
    await page.locator(`[data-buy="${id}"]`).click();
    expect((await snapshot(page)).inventory[id]).toBe(owned);
  }
  await expect(page.locator(`[data-buy="${id}"]`)).toBeDisabled();
  await page.locator('[data-shop-tab="sell"]').click();
  const before = await snapshot(page);
  await page.locator(`[data-sell="${id}"]`).click();
  const sold = await snapshot(page);
  expect(sold.inventory[id]).toBe(98);
  expect(sold.gold).toBeGreaterThan(before.gold);
  await page.locator('[data-shop-tab="buy"]').click();
  await expect(page.locator(`[data-buy="${id}"]`)).toHaveText('Buy ×1');
  await page.locator(`[data-buy="${id}"]`).click();
  expect((await snapshot(page)).inventory[id]).toBe(99);
});

test('focused one-copy stock fixture cannot equip or sell copies already worn', async ({ page }) => {
  await shopFixture(page);
  await page.locator('[data-command="dismiss"]').click();
  // Separate boundary fixture; the purchase regression above never changes gear.
  await reloadFixture(page, save => { save.inventory.R02_COMMON_CHARM = 1; });
  await page.locator('[data-panel="inventory"]').click();
  await page.locator('[data-optimize="all"]').click();
  let state = await snapshot(page);
  expect(state.heroes.filter(h => h.equipment.charm === 'R02_COMMON_CHARM')).toHaveLength(1);
  expect(state.inventory.R02_COMMON_CHARM).toBe(1);
  await page.locator('[data-pack-hero="Soren"]').click();
  await page.locator('[data-eq-slot="charm"]').click();
  await expect(copyRow(page, 'R02_COMMON_CHARM')).toContainText('Owned 1 · Equipped 1 · Available 0');
  await expect(page.locator('[data-equip="R02_COMMON_CHARM"]')).toBeDisabled();
  await expect(page.locator('[data-equip="R02_COMMON_CHARM"]')).toHaveText('No free copy');
  await page.locator('[data-close]').click();
  await openShop(page);
  await page.locator('[data-shop-tab="sell"]').click();
  await expect(page.locator('[data-sell="R02_COMMON_CHARM"]')).toHaveCount(0);
  state = await snapshot(page);
  expect(state.heroes.filter(h => h.equipment.charm === 'R02_COMMON_CHARM')).toHaveLength(1);
});

test('390px mobile equipment menu and shop stay within viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await shopFixture(page);
  await buyFour(page, 'R02_COMMON_CHARM');
  const assertFits = async () => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    const dialog = await page.locator('[role="dialog"]').boundingBox();
    expect(dialog.x).toBeGreaterThanOrEqual(0);
    expect(dialog.x + dialog.width).toBeLessThanOrEqual(390);
    expect(await page.locator('[role="dialog"]').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  };
  await assertFits();
  await openPackFromShop(page);
  await page.locator('[data-eq-slot="charm"]').click();
  await page.locator('[data-optimize="all"]').click();
  await assertFits();
  await expect(page.locator('[data-equip="R02_COMMON_CHARM"]')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('mobile-equipment-390.png'), fullPage: true });
});

test('standalone HTML boots and starts a playable game with network access blocked', async ({ page }, testInfo) => {
  const requests = [];
  const errors = [];
  const offlineURL = 'http://127.0.0.1:5190/standalone-document.html';
  const html = await readFile(new URL(`../${gameFile}`, import.meta.url), 'utf8');
  page.on('request', request => { if (/^https?:/.test(request.url()) && request.url() !== offlineURL) requests.push(request.url()); });
  page.on('pageerror', error => errors.push(error.message));
  // Managed Chromium denies file:// navigation. Fulfill the main document from
  // its unmodified on-disk bytes and block every other request. This verifies
  // self-containment without altering browser policy or claiming a file:// run.
  await page.route('**/*', route => route.request().url() === offlineURL
    ? route.fulfill({ status: 200, contentType: 'text/html', body: html })
    : route.abort());
  await newStriker(page, offlineURL);
  await page.locator('[data-panel="inventory"]').click();
  await expect(page.locator('[data-eq-slot="weapon"]')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('standalone-pack.png'), fullPage: true });
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
  expect((await snapshot(page)).mode).toBe('explore');
});
