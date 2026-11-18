import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const gameURL = process.env.GAME_URL || 'http://127.0.0.1:5173/';
const gameFile = process.env.GAME_HTML || new URL('../The_Road_Beyond_the_Bells.html', import.meta.url);
const snapshot = page => page.evaluate(() => window.__AVEL__.snapshot());
const visibleMap = page => page.evaluate(() => window.__AVEL__.map());
const viewport = page => page.evaluate(() => window.__AVEL__.viewport());
const heroes = ['Mara', 'Tavin', 'Iona', 'Soren'];
const directions = [['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0]];
const keys = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
const plain = value => JSON.parse(JSON.stringify(value));
let engineCore;
const pageErrors = new WeakMap();

test.beforeEach(async ({ page }) => {
  const errors = []; pageErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
});
test.afterEach(async ({ page }) => { expect(pageErrors.get(page) || []).toEqual([]); });

async function core() {
  if (!engineCore) {
    const html = await readFile(gameFile, 'utf8');
    const start = html.indexOf('var l={schemaVersion'), end = html.indexOf('var De=new Set', start);
    expect(start).toBeGreaterThanOrEqual(0); expect(end).toBeGreaterThan(start);
    engineCore = vm.createContext({ structuredClone });
    vm.runInContext(html.slice(start, end), engineCore, { timeout: 5000 });
  }
  return engineCore;
}

async function settled(page) {
  await page.waitForFunction(() => {
    const view = window.__AVEL__?.viewport(), state = window.__AVEL__?.snapshot();
    return view && state && view.area === state.area && !view.transitioning;
  });
}

async function newHero(page, job = 'warden', difficulty) {
  await page.addInitScript(() => {
    const fixture = sessionStorage.getItem('polish-next-save');
    if (fixture) {
      localStorage.setItem('avel-demo-v1', fixture);
      sessionStorage.removeItem('polish-next-save');
    }
  });
  const response = await page.goto(gameURL);
  const digest = bytes => createHash('sha256').update(bytes).digest('hex');
  expect(digest(await response.body()), 'normal preview serves the authoritative game').toBe(digest(await readFile(gameFile)));
  await page.waitForFunction(() => window.__AVEL__?.map);
  await page.locator('[data-front="new"]').click();
  await page.locator('#hero-name').fill('Rowan');
  if (difficulty) await page.locator(`[data-diff-start="${difficulty}"]`).click();
  await page.locator('[data-front="next"]').click();
  await page.locator(`[data-job="${job}"]`).click();
  await page.locator('[data-front="next"]').click();
  await page.locator('[data-front="begin"]').click();
  await page.locator('[data-intro="skip"]').click();
  await settled(page);
  await page.locator('[data-panel="help"]').last().click();
  await page.locator('[data-speed="3"]').click();
  await page.locator('[data-encounters="off"]').click();
  await page.locator('[data-close]').click();
}

// These save fixtures isolate later floors and formations. Traversal, shop
// purchases, targeting and reloads still use real player input. They do not
// represent a campaign playthrough or award resources in the shipped game.
async function fixture(page, change) {
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('avel-demo-v1')));
  change(saved);
  await page.evaluate(value => sessionStorage.setItem('polish-next-save', JSON.stringify(value)), saved);
  await page.reload();
  await page.locator('[data-front="continue"]').click();
  await settled(page);
}

async function step(page, direction) {
  await settled(page); const before = await snapshot(page);
  await page.locator('#game-world canvas').focus();
  await page.keyboard.down(keys[direction]);
  try {
    await page.waitForFunction(before => {
      const s = window.__AVEL__.snapshot();
      return s.area !== before.area || s.player.x !== before.player.x || s.player.y !== before.player.y || s.mode === 'battle' || !!s.message;
    }, before, { timeout: 3500 });
  } finally { await page.keyboard.up(keys[direction]); }
  await settled(page);
}

function freeStep(c, area, { tile, region } = {}) {
  const map = c.he[area];
  for (let y = 1; y < map.tiles.length - 1; y++) for (let x = 1; x < map.tiles[y].length - 1; x++) {
    if (tile && map.tiles[y][x] !== tile || !c.q.includes(map.tiles[y][x]) || c.p(area, x, y) || region && c.M(area, x, y) !== region) continue;
    for (const [direction, dx, dy] of directions) {
      const nx = x + dx, ny = y + dy;
      if (!c.q.includes(map.tiles[ny]?.[nx]) || c.p(area, nx, ny) || tile && map.tiles[ny][nx] !== tile) continue;
      if (map.entities.some(e => Math.abs(e.x - nx) + Math.abs(e.y - ny) <= 3 || e.x === x && e.y === y)) continue;
      return { player: { x, y, facing: direction }, direction };
    }
  }
  throw new Error(`No ordinary battle step in ${area}`);
}

function roll(seed) { let x = seed; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; }

async function formation(page, { count = 2, suffix, area = 'works-depth-3', tile, region = 'R01' } = {}) {
  const c = await core(), point = freeStep(c, area, { tile, region });
  let selected;
  await fixture(page, state => {
    state.area = area; state.player = point.player;
    state.flags.briefed = true; state.flags.bossDefeated = true; state.flags.completed = false;
    state.campaign.stage = 9; state.campaign.switches = plain(c.h);
    state.cleared = [...new Set([...state.cleared, ...Array.from({ length: 6 }, (_, i) => `encounter${i + 1}`), 'bailiff'])];
    state.settings.encounters = 'classic'; state.settings.battleSpeed = 3; state.encounterSteps = 17;
    const rows = Array.from(c.encounterEligible(region, state));
    selected = rows.find(row => suffix ? row.id.endsWith(suffix) : row.members.length === count && row.members.every(m => m.rank === 'base'));
    expect(selected, `${region} ${count} ${suffix || ''} exists`).toBeTruthy();
    const total = rows.reduce((sum, row) => sum + row.weight, 0);
    let low = 0;
    for (const row of rows) { if (row.id === selected.id) break; low += row.weight; }
    let seed = 1; while (seed < 1000000 && !(roll(seed) * total >= low && roll(seed) * total < low + selected.weight)) seed++;
    expect(seed).toBeLessThan(1000000); state.rng = seed;
  });
  await step(page, point.direction);
  await expect.poll(async () => (await snapshot(page)).mode).toBe('battle');
  const battle = (await snapshot(page)).battle;
  expect(battle.formationId).toBe(selected.id);
  expect(battle.enemies).toHaveLength(selected.members.length);
  return battle;
}


// Fixture levels, equipment and conditions deliberately isolate the UI. These
// checks do not simulate or claim a whole-campaign progression playthrough.
function levelHero(c, state, id, level) {
  const hero = state.heroes.find(h => h.id === id);
  state.hx[id] = c.l.xp_thresholds[level - 1];
  state.heroes[state.heroes.indexOf(hero)] = plain(c.be(id, level, hero.equipment, state.profile));
}
async function focusedVisible(page, container) {
  return page.evaluate(selector => {
    const item = document.activeElement, parent = item?.closest(selector);
    if (!parent) return false;
    const r = item.getBoundingClientRect(), p = parent.getBoundingClientRect();
    return r.top >= p.top - 1 && r.bottom <= p.bottom + 1 && r.top >= -1 && r.bottom <= innerHeight + 1;
  }, container);
}
async function noHorizontalOverflow(page) {
  const size = await page.evaluate(() => ({ width: innerWidth, body: document.body.scrollWidth, root: document.documentElement.scrollWidth }));
  expect(size.body).toBeLessThanOrEqual(size.width + 1);
  expect(size.root).toBeLessThanOrEqual(size.width + 1);
}

test('390px keyboard target navigation reveals the first and ninth enemy', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await newHero(page); const battle = await formation(page, { count: 9 });
  await page.locator('[data-command="attack"]').click();
  await expect(page.locator('[data-target]').first()).toBeFocused();
  for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowDown');
  await expect(page.locator('[data-target]').last()).toBeFocused();
  expect(await focusedVisible(page, '.target-list')).toBe(true);
  expect(await page.locator('.target-list').evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  await page.screenshot({ path: info.outputPath('mobile-last-target-visible.png'), fullPage: true });
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('[data-target]').first()).toBeFocused();
  expect(await focusedVisible(page, '.target-list')).toBe(true);
  await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter');
  expect((await snapshot(page)).battle.plans.Mara.target).toBe(battle.enemies[8].id);
  await expect(page.locator('[data-command="attack"]')).toBeFocused();
  await noHorizontalOverflow(page);
});

test('Quick and Clear plan preserve the keyboard command cursor', async ({ page }) => {
  await newHero(page); await formation(page, { count: 2 });
  await page.locator('[data-command="quick"]').focus(); await page.keyboard.press('Enter');
  expect(Object.keys((await snapshot(page)).battle.plans)).toHaveLength(4);
  await expect(page.locator('[data-command="resolve"]')).toBeFocused();
  await page.locator('[data-hero="Mara"]').click();
  await page.locator('[data-command="undo"]').focus(); await page.keyboard.press('Enter');
  expect(Object.keys((await snapshot(page)).battle.plans)).toHaveLength(3);
  await expect(page.locator('[data-command="attack"]')).toBeFocused();
  await expect(page.locator('[data-command="resolve"]')).toBeDisabled();
});

test('390px keyboard navigation keeps the last learned battle spell in view', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await newHero(page); const c = await core();
  await fixture(page, state => {
    levelHero(c, state, 'Iona', 31);
    const iona = state.heroes.find(h => h.id === 'Iona');
    state.learnedSpells.Iona = Array.from(c.te).filter(spell => c.H(iona, spell)).map(spell => spell.id);
  });
  await formation(page, { count: 2 });
  await page.locator('[data-hero="Iona"]').click(); await page.locator('[data-command="magic"]').click();
  const spells = page.locator('[data-spell]:not([disabled])'), count = await spells.count();
  expect(count).toBeGreaterThan(5); await expect(spells.first()).toBeFocused();
  for (let i = 1; i < count; i++) await page.keyboard.press('ArrowDown');
  await expect(spells.last()).toBeFocused(); expect(await focusedVisible(page, '.ability-list')).toBe(true);
  await page.screenshot({ path: info.outputPath('mobile-last-spell-visible.png'), fullPage: true });
  await page.keyboard.press('Escape'); await expect(page.locator('[data-command="attack"]')).toBeFocused();
});

test('field medicine shows unavailable uses and never spends an ineffective supply', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 }); await newHero(page);
  await page.locator('[data-panel="inventory"]').click();
  for (const item of ['POTION', 'ANTIDOTE', 'REVIVAL_SALT']) await expect(page.locator(`[data-use="${item}"]`)).toBeDisabled();
  await page.locator('[data-close]').click();
  await fixture(page, state => { const hero = state.heroes[0]; hero.hp -= 50; hero.status = 'poison'; });
  const before = await snapshot(page); await page.locator('[data-panel="inventory"]').click();
  await expect(page.locator('[data-use="POTION"]')).toBeEnabled(); await page.locator('[data-use="POTION"]').click();
  await expect(page.locator('[data-use="POTION"]')).toBeDisabled();
  await expect(page.locator('[data-use="ANTIDOTE"]')).toBeEnabled(); await page.locator('[data-use="ANTIDOTE"]').click();
  await expect(page.locator('[data-use="ANTIDOTE"]')).toBeDisabled();
  const after = await snapshot(page); expect(after.heroes[0].hp).toBe(after.heroes[0].maxHp); expect(after.heroes[0].status).toBeNull();
  expect(after.inventory.POTION).toBe(before.inventory.POTION - 1); expect(after.inventory.ANTIDOTE).toBe(before.inventory.ANTIDOTE - 1);
  expect(after.inventory.REVIVAL_SALT).toBe(before.inventory.REVIVAL_SALT);
  await page.locator('[data-use="POTION"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('mobile-field-supplies.png'), fullPage: true });
  await noHorizontalOverflow(page);
});

test('Spark Tea restores the selected unlocked tier and survives reload', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 }); await newHero(page); const c = await core();
  await fixture(page, state => {
    levelHero(c, state, 'Iona', 5); const iona = state.heroes.find(h => h.id === 'Iona');
    iona.charges[0] = iona.maxCharges[0]; iona.charges[1] = 0; state.inventory.SPARK_TEA = 2;
  });
  await page.locator('[data-panel="inventory"]').click(); await page.locator('[data-pack-hero="Iona"]').click();
  await expect(page.locator('[data-use="SPARK_TEA"][data-use-tier="1"]')).toBeDisabled();
  await expect(page.locator('[data-use="SPARK_TEA"][data-use-tier="2"]')).toBeEnabled();
  await expect(page.locator('[data-use="SPARK_TEA"][data-use-tier="3"]')).toHaveCount(0);
  const before = await snapshot(page); await page.locator('[data-use="SPARK_TEA"][data-use-tier="2"]').click();
  const after = await snapshot(page), hero = after.heroes.find(h => h.id === 'Iona');
  expect(hero.charges[1]).toBe(1); expect(hero.charges[0]).toBe(before.heroes.find(h => h.id === 'Iona').charges[0]);
  expect(after.inventory.SPARK_TEA).toBe(1);
  await page.locator('[data-use="SPARK_TEA"]').first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('mobile-tea-tier-choice.png'), fullPage: true });
  await page.reload(); await page.locator('[data-front="continue"]').click();
  const restored = await snapshot(page); expect(restored.heroes.find(h => h.id === 'Iona').charges).toEqual(hero.charges); expect(restored.inventory.SPARK_TEA).toBe(1);
});

test('390px equipment shop uses hero names and explicit mixed stat changes', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 }); await newHero(page);
  await fixture(page, state => {
    state.gold = 1000; state.area = 'dunmere'; state.player = { x: 7, y: 7, facing: 'up' };
    state.inventory.QUEST_HALDEN_CLOAK = 1; state.inventory.QUEST_FIELD_SATCHEL = 1;
    state.heroes[0].equipment.mantle = 'QUEST_HALDEN_CLOAK';
    state.heroes.find(h => h.id === 'Iona').equipment.charm = 'QUEST_FIELD_SATCHEL';
  });
  await page.locator('[data-command="interact"]').click(); await expect(page.locator('#dialog-title')).toHaveText('Weapon Shop');
  const mantle = page.locator('[data-buy="R02_COMMON_MANTLE"]').locator('..'), charm = page.locator('[data-buy="R02_COMMON_CHARM"]').locator('..');
  await expect(mantle.locator('[data-shop-compare="Mara"]')).toContainText('Rowan');
  await expect(mantle.locator('[data-shop-compare="Mara"]')).toContainText('MDEF -2');
  await expect(charm.locator('[data-shop-compare="Iona"]')).toContainText('↔');
  await expect(charm.locator('[data-shop-compare="Iona"]')).toContainText('MDEF +1');
  await expect(charm.locator('[data-shop-compare="Iona"]')).toContainText('MAG -1');
  await charm.scrollIntoViewIfNeeded(); await page.screenshot({ path: info.outputPath('mobile-shop-tradeoffs.png'), fullPage: true });
  const width = await charm.evaluate(el => ({ client: el.clientWidth, scroll: el.scrollWidth })); expect(width.scroll).toBeLessThanOrEqual(width.client + 1);
  await page.locator('[data-command="dismiss"]').click(); await page.locator('[data-panel="inventory"]').click();
  await expect(page.locator('.loadout')).toContainText('MDEF');
  await page.keyboard.press('Escape'); await expect(page.locator('#dialog-title')).toHaveText('Party');
  await page.locator('[data-panel="status"]').click(); await expect(page.locator('[role="dialog"]')).toContainText('Magic defense');
  await page.screenshot({ path: info.outputPath('mobile-status-magic-defense.png'), fullPage: true });
  await page.keyboard.press('Escape'); await expect(page.locator('#dialog-title')).toHaveText('Party');
  await page.keyboard.press('Escape'); await expect(page.locator('[role="dialog"]')).toHaveCount(0);
  await expect(page.locator('[data-panel="inventory"]')).toBeFocused(); await noHorizontalOverflow(page);
});

test('creator Hard choice and Gear difficulty cycle persist after reload', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await newHero(page, 'warden', 'hard');
  expect((await snapshot(page)).difficulty).toBe('hard');
  await page.reload(); await page.locator('[data-front="continue"]').click();
  expect((await snapshot(page)).difficulty).toBe('hard');
  await page.locator('[data-panel="inventory"]').click();
  const difficulty = page.locator('[data-difficulty="cycle"]');
  await expect(difficulty).toHaveText('Hard');
  await difficulty.click(); await expect(difficulty).toHaveText('Hell');
  expect((await snapshot(page)).difficulty).toBe('hell');
  await expect(page.locator('[role="dialog"]')).toContainText('HP ×2.6');
  await page.screenshot({ path: info.outputPath('gear-difficulty-choice.png'), fullPage: true });
  await noHorizontalOverflow(page);
  await page.reload(); await page.locator('[data-front="continue"]').click();
  expect((await snapshot(page)).difficulty).toBe('hell');
});

test('purchased Lumen earns battle practice and preserves learning and casts after victory reload', async ({ page }, info) => {
  await newHero(page);
  await fixture(page, state => {
    state.area = 'camp'; state.player = { x: 23, y: 7, facing: 'up' };
  });
  await page.locator('[data-command="interact"]').click();
  await expect(page.locator('#dialog-title')).toHaveText('Magic Shop');
  await page.locator('[data-pack-hero="Soren"]').click();
  const before = await snapshot(page), buy = page.locator('[data-learn-spell="lumen"]');
  await expect(buy).toBeEnabled(); await buy.click();
  await expect(buy).toBeDisabled();
  expect((await snapshot(page)).gold).toBe(before.gold - 35);
  expect((await snapshot(page)).learnedSpells.Soren).toContain('lumen');
  await page.locator('[data-command="dismiss"]').click();
  await formation(page, { count: 2 });
  for (const hero of heroes.slice(0, 3)) {
    await page.locator(`[data-hero="${hero}"]`).click(); await page.locator('[data-command="guard"]').click();
  }
  await page.locator('[data-hero="Soren"]').click(); await page.locator('[data-command="magic"]').click();
  await expect(page.locator('[data-spell="lumen"]')).toContainText('Spell Lv 1');
  await page.locator('[data-spell="lumen"]').click(); await page.locator('[data-target]').first().click();
  await page.locator('[data-command="resolve"]').click();
  await expect.poll(async () => (await snapshot(page)).sp?.Soren?.lumen).toBe(1);
  await page.waitForFunction(() => {
    const state = window.__AVEL__.snapshot(); return state.mode !== 'battle' || state.battle?.phase === 'planning';
  });
  for (let round = 0; round < 10 && (await snapshot(page)).mode === 'battle'; round++) {
    await page.locator('[data-command="quick"]').click(); await page.locator('[data-command="resolve"]').click();
    await page.waitForFunction(() => {
      const state = window.__AVEL__.snapshot(); return state.mode !== 'battle' || state.battle?.phase === 'planning';
    });
  }
  expect((await snapshot(page)).mode).toBe('victory');
  await page.locator('[data-command="continue"]').click();
  await page.locator('[data-panel="menu"]').click(); await page.locator('[data-panel="magic"]').click();
  await page.locator('[data-pack-hero="Soren"]').click();
  await expect(page.locator('[data-field-spell="lumen"]')).toContainText('1 battle casts');
  await page.screenshot({ path: info.outputPath('learned-lumen-battle-practice.png'), fullPage: true });
  await page.reload(); await page.locator('[data-front="continue"]').click();
  const restored = await snapshot(page);
  expect(restored.learnedSpells.Soren).toContain('lumen'); expect(restored.sp.Soren.lumen).toBe(1);
});
