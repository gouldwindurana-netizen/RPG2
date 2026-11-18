import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const gameURL = process.env.GAME_URL || 'http://127.0.0.1:5173/';
const gameFile = process.env.GAME_HTML || new URL('../The_Road_Beyond_the_Bells.html', import.meta.url);
const snapshot = page => page.evaluate(() => window.__AVEL__.snapshot());
const visibleMap = page => page.evaluate(() => window.__AVEL__.map());
const directions = [['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0]];
const keys = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
const plain = value => JSON.parse(JSON.stringify(value));
const errors = new WeakMap();
let engineCore;
test.beforeEach(async ({ page }) => {
  const found = []; errors.set(page, found); page.on('pageerror', error => found.push(error.message));
});
test.afterEach(async ({ page }) => { expect(errors.get(page) || []).toEqual([]); });

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
async function newHero(page) {
  await page.addInitScript(() => {
    const fixture = sessionStorage.getItem('engagement-next-save');
    if (fixture) { localStorage.setItem('avel-demo-v1', fixture); sessionStorage.removeItem('engagement-next-save'); }
  });
  const response = await page.goto(gameURL);
  const digest = bytes => createHash('sha256').update(bytes).digest('hex');
  expect(digest(await response.body()), 'normal preview serves the selected game').toBe(digest(await readFile(gameFile)));
  await page.waitForFunction(() => window.__AVEL__?.map);
  await page.locator('[data-front="new"]').click(); await page.locator('#hero-name').fill('Rowan');
  await page.locator('[data-front="next"]').click(); await page.locator('[data-job="warden"]').click();
  await page.locator('[data-front="next"]').click(); await page.locator('[data-front="begin"]').click();
  await page.locator('[data-intro="skip"]').click(); await settled(page);
  await page.locator('[data-panel="help"]').last().click();
  await page.locator('[data-speed="3"]').click(); await page.locator('[data-encounters="off"]').click();
  await page.locator('[data-close]').click();
}
// Position and progression fixtures isolate UI/save behavior. They never claim a
// campaign playthrough; all actual acceptance, casting, combat and payouts use UI.
async function fixture(page, change) {
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('avel-demo-v1')));
  change(save); await page.evaluate(value => sessionStorage.setItem('engagement-next-save', JSON.stringify(value)), save);
  await page.reload(); await page.locator('[data-front="continue"]').click(); await settled(page);
}
async function dismiss(page) {
  for (let n = 0; n < 40 && (await snapshot(page)).message; n++) await page.locator('[data-command="dismiss"]').click();
  expect((await snapshot(page)).message).toBeNull();
}
function route(map, start, goals) {
  const key = p => `${p.x},${p.y}`, targets = new Set(goals.map(key));
  const queue = [{ ...start, path: [] }], seen = new Set([key(start)]);
  while (queue.length) {
    const at = queue.shift(); if (targets.has(key(at))) return at.path;
    for (const [direction, dx, dy] of directions) {
      const next = { x: at.x + dx, y: at.y + dy };
      if (seen.has(key(next)) || !'gdsfb'.includes(map.tiles[next.y]?.[next.x] || '?')) continue;
      if (map.entities.some(entity => entity.x === next.x && entity.y === next.y)) continue;
      seen.add(key(next)); queue.push({ ...next, path: [...at.path, direction] });
    }
  }
  throw Error(`No route in ${map.area} from ${key(start)}`);
}
async function step(page, direction) {
  await settled(page); const before = await snapshot(page);
  await page.locator('#game-world canvas').focus(); await page.keyboard.down(keys[direction]);
  try {
    await page.waitForFunction(old => {
      const now = window.__AVEL__.snapshot();
      return now.area !== old.area || now.player.x !== old.player.x || now.player.y !== old.player.y || now.mode !== old.mode || !!now.message;
    }, before, { timeout: 4000 });
  } finally { await page.keyboard.up(keys[direction]); }
  await settled(page);
}
async function approach(page, id) {
  const original = (await snapshot(page)).area;
  for (let attempt = 0; attempt < 100; attempt++) {
    const state = await snapshot(page), map = await visibleMap(page), entity = map.entities.find(candidate => candidate.id === id);
    expect(state.area).toBe(original); expect(entity, id).toBeTruthy();
    if (Math.abs(state.player.x - entity.x) + Math.abs(state.player.y - entity.y) <= 1) return;
    const goals = directions.map(([, dx, dy]) => ({ x: entity.x + dx, y: entity.y + dy }));
    const path = route(map, state.player, goals); expect(path.length).toBeGreaterThan(0);
    await step(page, path[0]);
  }
  throw Error(`Could not approach ${id}`);
}
async function interact(page, id) {
  await approach(page, id); await page.locator('#game-world canvas').focus(); await page.keyboard.press('e');
  await expect.poll(async () => !!(await snapshot(page)).message || (await snapshot(page)).mode === 'battle').toBe(true);
}
async function openBoard(page, region = 'R01') {
  await interact(page, `wayfarer-board-${region}`);
  await expect(page.locator('#dialog-title')).toHaveText('Wayfarer Board');
  await expect(page.locator('[data-wayfarer-journal="board"]')).toBeVisible();
}
function boardApproach(c, regionId) {
  const region = c.wayfarerRegions.find(region => region.id === regionId), map = c.he[region.town];
  const board = map.entities.find(entity => entity.id === `wayfarer-board-${regionId}`);
  for (const [direction, dx, dy] of directions) {
    const point = { x: board.x + dx, y: board.y + dy, facing: { up: 'down', down: 'up', left: 'right', right: 'left' }[direction] };
    if (!c.q.includes(map.tiles[point.y]?.[point.x]) || !c.p(region.town, point.x, point.y)) continue;
    if (map.entities.some(entity => entity.id !== board.id && Math.abs(entity.x - point.x) + Math.abs(entity.y - point.y) <= 1)) continue;
    return { area: region.town, player: point };
  }
  throw Error(`No unambiguous safe board approach in ${regionId}`);
}
async function journal(page, tab = 'commissions') {
  await page.keyboard.press('Escape'); await page.locator('[data-panel="wayfarer"]').click();
  await page.locator(`[data-wayfarer-tab="${tab}"]`).click();
}
async function noOverflow(page) {
  const size = await page.evaluate(() => ({ width: innerWidth, body: document.body.scrollWidth, root: document.documentElement.scrollWidth }));
  expect(size.body).toBeLessThanOrEqual(size.width + 1); expect(size.root).toBeLessThanOrEqual(size.width + 1);
}
async function finishBattle(page) {
  for (let round = 0; round < 35; round++) {
    const state = await snapshot(page); if (state.mode !== 'battle') break;
    await page.locator('[data-command="quick"]').click();
    const iona = state.heroes.find(hero => hero.id === 'Iona');
    const wounded = state.heroes.filter(hero => hero.hp > 0).sort((a,b) => a.hp/a.maxHp-b.hp/b.maxHp)[0];
    if (iona.hp > 0 && !['sleep', 'silence'].includes(iona.status) && iona.charges[0] > 0 && wounded.hp < wounded.maxHp*.45) {
      await page.locator('[data-hero="Iona"]').click(); await page.locator('[data-command="magic"]').click();
      await page.locator('[data-spell="mend"]').click(); await page.locator(`[data-target="${wounded.id}"]`).click();
    }
    await page.locator('[data-command="resolve"]').click();
    await expect.poll(async () => { const next = await snapshot(page); return next.mode !== 'battle' || next.battle.phase === 'planning'; }).toBe(true);
  }
  expect((await snapshot(page)).mode).toBe('victory');
}
const resources = state => plain({ gold: state.gold, inventory: state.inventory, hx: state.hx, xp: state.xp,
  heroes: state.heroes.map(hero => ({ id: hero.id, hp: hero.hp, charges: hero.charges, status: hero.status })),
  stage: state.campaign.stage, switches: state.campaign.switches, flags: state.flags, sp: state.sp });

test('a new hero walks to the notice board and accepts saved optional work without spending resources', async ({ page }, info) => {
  await newHero(page); const before = resources(await snapshot(page));
  await openBoard(page); await expect(page.locator('[data-commission-id]')).toHaveCount(3);
  await page.locator('[data-commission-accept="R01-patrol"]').click();
  await expect(page.locator('[data-commission-id="R01-patrol"] .wayfarer-badge')).toHaveText('In progress');
  await expect(page.locator('[data-commission-id="R01-patrol"]')).toBeFocused();
  await expect(page.locator('[data-commission-claim="R01-patrol"]')).toBeDisabled();
  expect(resources(await snapshot(page))).toEqual(before);
  expect((await snapshot(page)).wayfarer.accepted['R01-patrol']).toBe(0);
  await page.screenshot({ path: info.outputPath('new-hero-board-accepted.png'), fullPage: true });
  await page.locator('[data-command="dismiss"]').click();
  await page.locator('#game-world canvas').screenshot({ path: info.outputPath('town-notice-board.png') });
  await page.reload(); await page.locator('[data-front="continue"]').click(); await settled(page);
  await openBoard(page); await expect(page.locator('[data-commission-id="R01-patrol"] .wayfarer-badge')).toHaveText('In progress');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-wayfarer-journal="board"]')).toHaveCount(0);
  expect((await snapshot(page)).message).toBeNull();
});

test('a real victory advances accepted patrol work and records discovered enemy affinities', async ({ page }, info) => {
  await newHero(page); await openBoard(page); await page.locator('[data-commission-accept="R01-patrol"]').click();
  await page.locator('[data-command="dismiss"]').click(); const c = await core();
  const enemy = c.he.works.entities.find(entity => entity.id === 'encounter1'); expect(enemy).toBeTruthy();
  await fixture(page, state => {
    state.area = 'works'; state.player = { x: enemy.x - 1, y: enemy.y, facing: 'right' };
    state.flags.briefed = true; state.settings.encounters = 'visible';
  });
  await interact(page, 'encounter1');
  const battle = (await snapshot(page)).battle, count = battle.enemies.length;
  expect((await snapshot(page)).wayfarer.kills.R01).toBe(0);
  await finishBattle(page); expect((await snapshot(page)).wayfarer.kills.R01).toBe(count);
  expect(Object.values((await snapshot(page)).wayfarer.bestiary).reduce((sum, row) => sum + row.defeated, 0)).toBe(count);
  await page.locator('[data-command="continue"]').click(); await dismiss(page); await journal(page, 'bestiary');
  expect(await page.locator('[data-bestiary-key]').count()).toBeGreaterThan(0);
  await expect(page.locator('.wayfarer-bestiary')).toContainText('Weakness');
  await page.screenshot({ path: info.outputPath('earned-bestiary-notes.png'), fullPage: true });
  await page.reload(); await page.locator('[data-front="continue"]').click(); await settled(page);
  expect((await snapshot(page)).wayfarer.kills.R01).toBe(count);
  await journal(page); await expect(page.locator('[data-commission-id="R01-patrol"]')).toContainText(`${count} / 6`);
});

test('previously copied records earn exactly one board delivery and keep its reward after reload', async ({ page }, info) => {
  await newHero(page); const c = await core(), point = boardApproach(c, 'R01');
  await fixture(page, state => {
    state.area = point.area; state.player = point.player;
    state.campaign.switches.push('depth_works_2_record', 'depth_works_3_record');
  });
  await openBoard(page); await page.locator('[data-commission-accept="R01-survey"]').click();
  await expect(page.locator('[data-commission-id="R01-survey"] .wayfarer-badge')).toHaveText('Ready to deliver');
  const before = await snapshot(page);
  const contract = c.wayfarerSummary(before).contracts.find(contract => contract.id === 'R01-survey');
  await page.locator('[data-commission-claim="R01-survey"]').click(); const after = await snapshot(page);
  await expect(page.locator('[data-commission-id="R01-survey"]')).toBeFocused();
  expect(after.gold).toBe(before.gold + contract.reward.gold);
  for (const [id, amount] of Object.entries(contract.reward.items)) expect(after.inventory[id]).toBe((before.inventory[id] || 0) + amount);
  expect(after.hx).toEqual(before.hx); expect(after.sp).toEqual(before.sp);
  await expect(page.locator('[data-commission-id="R01-survey"] .wayfarer-badge')).toHaveText('Delivered');
  await expect(page.locator('[data-commission-claim="R01-survey"]')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('one-time-survey-delivered.png'), fullPage: true });
  await page.reload(); await page.locator('[data-front="continue"]').click(); await settled(page); await openBoard(page);
  expect((await snapshot(page)).gold).toBe(after.gold); expect((await snapshot(page)).inventory).toEqual(after.inventory);
  await expect(page.locator('[data-commission-id="R01-survey"] .wayfarer-badge')).toHaveText('Delivered');
  await expect(page.locator('[data-commission-claim="R01-survey"]')).toHaveCount(0);
});

test('390px journal tabs and region goals fit while shelter conversations respect chapter gates', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 }); await newHero(page); await journal(page);
  await expect(page.locator('[data-wayfarer-region]')).toHaveCount(6);
  for (const region of ['R01', 'R03', 'R06']) {
    await page.locator(`[data-wayfarer-region="${region}"]`).click();
    await expect(page.locator('[data-commission-id]')).toHaveCount(3); await noOverflow(page);
  }
  await page.screenshot({ path: info.outputPath('mobile-later-commission-goals.png'), fullPage: true });
  await page.locator('[data-wayfarer-tab="bestiary"]').click(); await expect(page.locator('.wayfarer-empty')).toContainText('first page'); await noOverflow(page);
  await page.locator('[data-wayfarer-tab="tales"]').click();
  await expect(page.locator('[data-camp-tale-card]')).toHaveCount(6);
  await expect(page.locator('[data-camp-tale="first-watch"]')).toBeEnabled();
  await expect(page.locator('[data-camp-tale="road-ahead"]')).toBeDisabled();
  await noOverflow(page); await page.screenshot({ path: info.outputPath('mobile-camp-tales.png'), fullPage: true });
  await page.locator('[data-close]').click(); await openBoard(page); await noOverflow(page);
  const closeBoard = page.getByRole('button', { name: 'Leave notice board', exact: true });
  await expect(closeBoard).toBeVisible();
  const closeBounds = await closeBoard.boundingBox();
  expect(closeBounds.y).toBeGreaterThanOrEqual(0);
  expect(closeBounds.y + closeBounds.height).toBeLessThanOrEqual(844);
  await page.screenshot({ path: info.outputPath('mobile-town-commissions.png'), fullPage: true });
  await closeBoard.click();
  expect((await snapshot(page)).message).toBeNull();
  await expect(page.locator('[data-wayfarer-journal]')).toHaveCount(0);
});

test('a shelter conversation uses the custom hero and saves heard history without healing or rewards', async ({ page }, info) => {
  await newHero(page);
  await fixture(page, state => { state.heroes[0].hp -= 10; state.heroes.find(hero => hero.id === 'Iona').charges[0] = 0; });
  const before = resources(await snapshot(page)); await journal(page, 'tales');
  await page.locator('[data-camp-tale="first-watch"]').click();
  const speakers = [], dialogue = [];
  for (let line = 0; line < 8 && (await snapshot(page)).message; line++) {
    speakers.push((await snapshot(page)).message.speaker); dialogue.push((await snapshot(page)).message.text);
    if (speakers.at(-1) === 'Rowan') await page.screenshot({ path: info.outputPath('custom-hero-shelter-conversation.png'), fullPage: true });
    await page.locator('[data-command="dismiss"]').click();
  }
  expect(speakers).toContain('Rowan'); expect(speakers).toContain('Tavin'); expect(dialogue).toHaveLength(4);
  expect(resources(await snapshot(page))).toEqual(before);
  expect((await snapshot(page)).campTalesHeard).toEqual(['first-watch']);
  await page.reload(); await page.locator('[data-front="continue"]').click(); await settled(page); await journal(page, 'tales');
  await expect(page.locator('[data-camp-tale-card="first-watch"] .wayfarer-badge')).toHaveText('Remembered');
  await page.locator('[data-camp-tale="first-watch"]').click(); await dismiss(page);
  expect(resources(await snapshot(page))).toEqual(before); expect((await snapshot(page)).campTalesHeard).toEqual(['first-watch']);
});

test('later boards keep story gates and claims stay unavailable in remote journal views', async ({ page }, info) => {
  await newHero(page); const point = boardApproach(await core(), 'R04'); await fixture(page, state => {
    // Isolate this board interaction from nearby people without inventing a
    // walkable coordinate; derive its real current map and safe adjacent tile.
    state.area = point.area; state.player = point.player;
  });
  await openBoard(page, 'R04');
  await expect(page.locator('[data-commission-accept]')).toHaveCount(0);
  await expect(page.locator('[data-commission-id="R04-patrol"]')).toContainText('Not yet available');
  await page.locator('[data-command="dismiss"]').click();
  await fixture(page, state => { state.campaign.stage = 5; state.flags.briefed = true; });
  await openBoard(page, 'R04'); await page.locator('[data-commission-accept="R04-patrol"]').click();
  await page.locator('[data-command="dismiss"]').click(); await journal(page);
  await page.locator('[data-wayfarer-region="R04"]').click();
  await expect(page.locator('[data-commission-id="R04-patrol"]')).toContainText('In progress');
  await expect(page.locator('[data-commission-claim]')).toHaveCount(0);
  await expect(page.locator('[data-commission-accept]')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('later-region-readonly-journal.png'), fullPage: true });
});
