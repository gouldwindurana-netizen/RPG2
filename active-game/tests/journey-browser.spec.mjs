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
    const fixture = sessionStorage.getItem('journey-next-save');
    if (fixture) { localStorage.setItem('avel-demo-v1', fixture); sessionStorage.removeItem('journey-next-save'); }
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
  change(save); await page.evaluate(value => sessionStorage.setItem('journey-next-save', JSON.stringify(value)), save);
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

async function authoredBattle(page, change = () => {}) {
  const c = await core();
  const map = Object.values(c.he).find(map => map.entities.some(entity => entity.id === 'encounter1'));
  const enemy = map.entities.find(entity => entity.id === 'encounter1');
  await fixture(page, state => {
    state.area = map.area; state.player = { x: enemy.x, y: enemy.y + 1, facing: 'up' };
    state.flags.briefed = true; state.settings.encounters = 'visible'; state.settings.battleSpeed = 3;
    change(state, c);
  });
  await page.locator('#game-world canvas').focus(); await page.keyboard.press('e');
  await expect.poll(async () => (await snapshot(page)).mode).toBe('battle');
  return (await snapshot(page)).battle;
}
async function acceptAtBoard(page, id = 'R01-patrol') {
  await openBoard(page); await page.locator(`[data-commission-accept="${id}"]`).click();
  await page.locator('[data-board-close]').click();
}
async function pin(page, id = 'R01-patrol') {
  await journal(page); await page.locator(`[data-commission-track="${id}"]`).click();
  expect((await snapshot(page)).wayfarer.tracked).toBe(id); await page.locator('[data-close]').click();
}

test('battle tactics use discovered exact-rank notes without changing the planned round', async ({ page }, info) => {
  await newHero(page);
  const unknown = await authoredBattle(page), before = await snapshot(page);
  await page.locator('[data-panel="tactics"]').click();
  await expect(page.locator('.tactics-modal')).toBeVisible();
  await expect(page.locator('[data-tactical-enemy]')).toHaveCount(unknown.enemies.length);
  await expect(page.locator('[data-tactical-known="false"]')).toHaveCount(unknown.enemies.length);
  await expect(page.locator('.tactics-modal')).toContainText('Affinities not yet recorded');
  expect(await snapshot(page)).toEqual(before);
  await page.keyboard.press('Escape'); await expect(page.locator('.tactics-modal')).toHaveCount(0);
  expect(await snapshot(page)).toEqual(before);
  const known = await authoredBattle(page, state => {
    for (const enemy of unknown.enemies)
      state.wayfarer.bestiary[`${unknown.regionId}|${enemy.templateId}|${enemy.rank}`] = { defeated: 1 };
  });
  const stable = await snapshot(page); await page.locator('[data-panel="tactics"]').click();
  await expect(page.locator('[data-tactical-known="true"]')).toHaveCount(known.enemies.length);
  for (const affinity of new Set(known.enemies.flatMap(enemy => enemy.weakness)))
    await expect(page.locator('.tactics-modal')).toContainText(affinity);
  expect(await snapshot(page)).toEqual(stable);
  await page.screenshot({ path: info.outputPath('known-battle-tactics.png'), fullPage: true });
  await page.locator('[data-close]').click(); expect(await snapshot(page)).toEqual(stable);
});

test('battle supplies show shared reservations and reject invalid curative and revive targets', async ({ page }, info) => {
  await newHero(page);
  await authoredBattle(page, state => {
    state.inventory.POTION = 1; state.inventory.ANTIDOTE = 1; state.inventory.REVIVAL_SALT = 1;
    state.heroes.find(hero => hero.id === 'Iona').status = 'poison'; state.heroes.find(hero => hero.id === 'Soren').hp = 0;
  });
  const before = resources(await snapshot(page)); await page.locator('[data-command="items"]').click();
  const potion = page.locator('[data-battle-item="POTION"]');
  await expect(potion).toHaveAttribute('data-available', '1'); await potion.click();
  await expect(page.locator('[data-target="Soren"]')).toBeDisabled(); await page.locator('[data-target="Mara"]').click();
  expect((await snapshot(page)).battle.plans.Mara.itemId).toBe('POTION');
  await page.locator('[data-command="items"]').click();
  await expect(potion).toHaveAttribute('data-owned', '1'); await expect(potion).toHaveAttribute('data-reserved', '1');
  await expect(potion).toHaveAttribute('data-available', '0'); await expect(potion).toBeDisabled();
  await page.screenshot({ path: info.outputPath('reserved-battle-supply.png'), fullPage: true });
  await page.locator('[data-hero="Mara"]').click(); await page.locator('[data-command="items"]').click();
  await expect(potion).toHaveAttribute('data-available', '1'); await expect(potion).toBeEnabled();
  await page.locator('[data-hero="Tavin"]').click(); await page.locator('[data-command="items"]').click();
  await page.locator('[data-battle-item="ANTIDOTE"]').click();
  for (const id of ['Mara', 'Tavin', 'Soren']) await expect(page.locator(`[data-target="${id}"]`)).toBeDisabled();
  await expect(page.locator('[data-target="Iona"]')).toBeEnabled(); await page.locator('[data-target="Iona"]').click();
  await page.locator('[data-command="items"]').click(); await page.locator('[data-battle-item="REVIVAL_SALT"]').click();
  await expect(page.locator('[data-target="Soren"]')).toBeEnabled();
  for (const id of ['Mara', 'Tavin', 'Iona']) await expect(page.locator(`[data-target="${id}"]`)).toBeDisabled();
  expect(resources(await snapshot(page))).toEqual(before);
});

test('an accepted commission can be tracked, restored, opened from exploration and untracked', async ({ page }, info) => {
  await newHero(page); await acceptAtBoard(page);
  const before = resources(await snapshot(page)); await pin(page);
  await expect(page.locator('[data-tracked-commission="R01-patrol"]')).toContainText('A Safer First Road');
  await page.reload(); await page.locator('[data-front="continue"]').click(); await settled(page);
  expect((await snapshot(page)).wayfarer.tracked).toBe('R01-patrol');
  await expect(page.locator('[data-view-tracked="R01-patrol"]')).toBeVisible();
  await page.screenshot({ path: info.outputPath('tracked-exploration-objective.png'), fullPage: true });
  await page.locator('[data-view-tracked="R01-patrol"]').click();
  await expect(page.locator('[data-commission-untrack="R01-patrol"]')).toBeVisible();
  await expect(page.locator('[data-commission-id="R01-patrol"]')).toBeFocused();
  await page.locator('[data-commission-untrack="R01-patrol"]').click();
  expect((await snapshot(page)).wayfarer.tracked).toBeNull(); await page.locator('[data-close]').click();
  await expect(page.locator('[data-tracked-commission]')).toHaveCount(0); expect(resources(await snapshot(page))).toEqual(before);
});

test('delivering tracked evidence clears the pin and pays only the existing board reward once', async ({ page }, info) => {
  await newHero(page); const c = await core(), point = boardApproach(c, 'R01');
  await fixture(page, state => {
    state.area = point.area; state.player = point.player;
    state.campaign.switches.push('depth_works_2_record', 'depth_works_3_record');
  });
  await acceptAtBoard(page, 'R01-survey'); await pin(page, 'R01-survey');
  await expect(page.locator('[data-tracked-commission="R01-survey"]')).toContainText(/report|return|deliver/i);
  const before = await snapshot(page); await openBoard(page);
  await page.locator('[data-commission-claim="R01-survey"]').click(); const after = await snapshot(page);
  expect(after.wayfarer.tracked).toBeNull(); expect(after.gold).toBe(before.gold + 25);
  expect(after.inventory.CAMP_MEAL).toBe((before.inventory.CAMP_MEAL || 0) + 1);
  await expect(page.locator('[data-commission-claim="R01-survey"]')).toHaveCount(0);
  await page.locator('[data-board-close]').click(); await expect(page.locator('[data-tracked-commission]')).toHaveCount(0);
  await page.reload(); await page.locator('[data-front="continue"]').click(); await settled(page); await openBoard(page);
  expect((await snapshot(page)).wayfarer.tracked).toBeNull(); expect((await snapshot(page)).gold).toBe(after.gold);
  await expect(page.locator('[data-commission-claim="R01-survey"]')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('tracked-evidence-delivered.png'), fullPage: true });
});

test('390px tracking and tactics fit without covering combat with the exploration goal', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 }); await newHero(page);
  await acceptAtBoard(page); await pin(page); await noOverflow(page);
  await expect(page.locator('#toast')).not.toHaveClass(/visible/);
  await page.screenshot({ path: info.outputPath('mobile-tracked-goal.png'), fullPage: true });
  await authoredBattle(page); await expect(page.locator('[data-tracked-commission]')).toHaveCount(0);
  await page.locator('[data-panel="tactics"]').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('.tactics-modal')).toBeVisible(); await noOverflow(page);
  const modalBounds = await page.locator('.tactics-modal').boundingBox();
  expect(modalBounds.y).toBeGreaterThanOrEqual(0);
  expect(modalBounds.y + modalBounds.height).toBeLessThanOrEqual(844);
  await page.screenshot({ path: info.outputPath('mobile-tactics-viewport.png') });
  await page.screenshot({ path: info.outputPath('mobile-battle-tactics.png'), fullPage: true });
  await page.keyboard.press('Escape'); await expect(page.locator('.tactics-modal')).toHaveCount(0);
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('BUTTON'); expect((await snapshot(page)).battle.round).toBe(1);
});

test('current-floor notes follow actual record, cache and lift discoveries and survive reload', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 }); await newHero(page);
  await fixture(page, state => {
    state.area = 'works-depth-3'; state.player = { x: 4, y: 18, facing: 'up' };
    state.flags.briefed = true; state.campaign.stage = 1; state.settings.encounters = 'off';
  });
  const reserves = state => plain(state.heroes.map(hero => ({ hp: hero.hp, charges: hero.charges })));
  const before = reserves(await snapshot(page));
  const openMap = async () => { await page.keyboard.press('m'); await expect(page.locator('[data-floor-survey="works-depth-3"]')).toBeVisible(); };
  await openMap();
  for (const id of ['records', 'caches', 'lifts']) await expect(page.locator(`[data-floor-note="${id}"]`)).toContainText('0 / 1');
  await expect(page.locator('[data-floor-note="locks"]')).toHaveCount(0); await page.locator('[data-close]').click();
  await interact(page, 'depth-note-works-3'); await dismiss(page);
  await approach(page, 'depth-cache-works-3'); await page.locator('#game-world canvas').focus(); await page.keyboard.press('e');
  await expect.poll(async () => (await snapshot(page)).mode).toBe('victory');
  await page.locator('[data-command="continue"]').click(); await settled(page);
  await interact(page, 'depth-lever-works-3'); await dismiss(page); expect(reserves(await snapshot(page))).toEqual(before);
  await openMap();
  for (const id of ['records', 'caches', 'lifts']) await expect(page.locator(`[data-floor-note="${id}"]`)).toContainText('1 / 1');
  await noOverflow(page); await page.screenshot({ path: info.outputPath('mobile-completed-floor-notes.png'), fullPage: true });
  await page.reload(); await page.locator('[data-front="continue"]').click(); await settled(page); await openMap();
  for (const id of ['records', 'caches', 'lifts']) await expect(page.locator(`[data-floor-note="${id}"]`)).toContainText('1 / 1');
  expect(reserves(await snapshot(page))).toEqual(before);
});

