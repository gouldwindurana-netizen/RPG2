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

async function newHero(page, job = 'warden') {
  await page.addInitScript(() => {
    const fixture = sessionStorage.getItem('depth-next-save');
    if (fixture) {
      localStorage.setItem('avel-demo-v1', fixture);
      sessionStorage.removeItem('depth-next-save');
    }
  });
  const response = await page.goto(gameURL);
  const digest = bytes => createHash('sha256').update(bytes).digest('hex');
  expect(digest(await response.body()), 'normal preview serves the authoritative game').toBe(digest(await readFile(gameFile)));
  await page.waitForFunction(() => window.__AVEL__?.map);
  await page.locator('[data-front="new"]').click();
  await page.locator('#hero-name').fill('Wayfarer');
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
  await page.evaluate(value => sessionStorage.setItem('depth-next-save', JSON.stringify(value)), saved);
  await page.reload();
  await page.locator('[data-front="continue"]').click();
  await settled(page);
}

async function dismiss(page) {
  for (let n = 0; n < 60 && (await snapshot(page)).message; n++) await page.locator('[data-command="dismiss"]').click();
  expect((await snapshot(page)).message).toBeNull();
}

function route(map, start, goals, targetExit) {
  const key = p => `${p.x},${p.y}`, targets = new Set(goals.map(key));
  const queue = [{ ...start, path: [] }], seen = new Set([key(start)]);
  while (queue.length) {
    const current = queue.shift();
    if (targets.has(key(current))) return current.path;
    for (const [direction, dx, dy] of directions) {
      const next = { x: current.x + dx, y: current.y + dy };
      if (seen.has(key(next)) || !'gdsfb'.includes(map.tiles[next.y]?.[next.x] || '?')) continue;
      if (map.entities.some(e => e.x === next.x && e.y === next.y && e.id !== targetExit)) continue;
      seen.add(key(next)); queue.push({ ...next, path: [...current.path, direction] });
    }
  }
  throw new Error(`No route in ${map.area} from ${key(start)} to ${goals.map(key).join('|')}`);
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

async function walkTo(page, goals, targetExit, expectedArea) {
  const initial = (await snapshot(page)).area;
  // Replan from actual position: a browser input can legitimately span two
  // movement ticks, so a fixed list of key directions is not reliable.
  for (let attempts = 0; attempts < 180; attempts++) {
    const state = await snapshot(page);
    if (state.area !== initial) {
      if (expectedArea) expect(state.area).toBe(expectedArea);
      return;
    }
    const path = route(await visibleMap(page), state.player, goals, targetExit);
    if (!path.length) return;
    await step(page, path[0]);
    expect((await snapshot(page)).mode).toBe('explore');
    await dismiss(page);
  }
  throw new Error(`Movement exceeded bounded route in ${initial}`);
}

async function interact(page, id) {
  await dismiss(page);
  const map = await visibleMap(page), entity = map.entities.find(e => e.id === id);
  expect(entity, id).toBeTruthy();
  await walkTo(page, directions.map(([, dx, dy]) => ({ x: entity.x + dx, y: entity.y + dy })));
  await page.locator('#game-world canvas').focus(); await page.keyboard.press('e');
  await expect.poll(async () => !!(await snapshot(page)).message || (await snapshot(page)).mode === 'battle').toBe(true);
}

async function cross(page, id, destination) {
  const current = await visibleMap(page), entity = current.entities.find(e => e.id === id);
  expect(entity).toBeTruthy();
  await walkTo(page, [entity], id, destination);
  await expect.poll(async () => (await snapshot(page)).area).toBe(destination);
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

async function geometry(page, battle) {
  await page.waitForFunction(n => window.__AVEL__.viewport().actors?.length >= n, battle.enemies.length + 4);
  const view = await viewport(page), actors = view.actors;
  const enemies = actors.filter(actor => battle.enemies.some(e => e.id === actor.id));
  const party = heroes.map(id => actors.find(actor => actor.id === id));
  expect(enemies).toHaveLength(battle.enemies.length); expect(party.every(Boolean)).toBe(true);
  for (const actor of enemies) {
    expect(actor.cell.x).toBeGreaterThanOrEqual(28);
    expect(actor.cell.x + actor.cell.w).toBeLessThanOrEqual(560);
    expect(actor.cell.y).toBeGreaterThanOrEqual(75);
    expect(actor.cell.y + actor.cell.h).toBeLessThanOrEqual(516);
  }
  for (const actor of party) {
    expect(actor.cell.x).toBeGreaterThanOrEqual(700);
    expect(actor.cell.x + actor.cell.w).toBeLessThanOrEqual(980);
    expect(actor.cell.y).toBeGreaterThanOrEqual(75);
    expect(actor.cell.y + actor.cell.h).toBeLessThanOrEqual(516);
  }
  for (const actor of [...enemies, ...party]) {
    expect(actor.cell, `${actor.id} has a bounded cell`).toBeTruthy();
    for (const rect of [actor.sprite, actor.label, actor.bar]) {
      expect(rect.x, `${actor.id} left`).toBeGreaterThanOrEqual(actor.cell.x - 1);
      expect(rect.y, `${actor.id} top`).toBeGreaterThanOrEqual(actor.cell.y - 1);
      expect(rect.x + rect.w, `${actor.id} right`).toBeLessThanOrEqual(actor.cell.x + actor.cell.w + 1);
      expect(rect.y + rect.h, `${actor.id} bottom`).toBeLessThanOrEqual(actor.cell.y + actor.cell.h + 1);
    }
  }
  const nonoverlap = list => {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i].cell, b = list[j].cell;
      expect(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, `${list[i].id}/${list[j].id}`).toBe(true);
    }
  };
  nonoverlap(enemies); nonoverlap(party);
  expect(Math.max(...party.map(a => a.sprite.x)) - Math.min(...party.map(a => a.sprite.x))).toBeLessThanOrEqual(70);
  for (let i = 1; i < party.length; i++) expect(party[i].cell.y).toBeGreaterThan(party[i - 1].cell.y);
  expect(Math.min(...party.map(a => a.cell.x))).toBeGreaterThan(Math.max(...enemies.map(a => a.cell.x + a.cell.w)));
  await page.locator('[data-command="attack"]').click();
  await expect(page.locator('[data-target]')).toHaveCount(battle.enemies.length);
  await page.locator('[data-command="back"]').click();
  return view;
}

async function finishBattle(page) {
  for (let round = 0; round < 35; round++) {
    const state = await snapshot(page);
    if (state.mode !== 'battle') break;
    await page.locator('[data-command="quick"]').click();
    const healer = state.heroes.find(h => h.id === 'Iona');
    const wounded = state.heroes.filter(h => h.hp > 0).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (healer.hp > 0 && !['sleep', 'silence'].includes(healer.status) && healer.charges[0] > 0 && wounded.hp < wounded.maxHp * .45) {
      await page.locator('[data-hero="Iona"]').click(); await page.locator('[data-command="magic"]').click();
      await page.locator('[data-spell="mend"]').click(); await page.locator(`[data-target="${wounded.id}"]`).click();
    }
    await expect(page.locator('[data-command="resolve"]')).toBeEnabled();
    await page.locator('[data-command="resolve"]').click();
    await expect.poll(async () => {
      const s = await snapshot(page); return s.mode !== 'battle' || s.battle.phase === 'planning';
    }).toBe(true);
  }
  expect((await snapshot(page)).mode).toBe('victory');
}

for (let count = 1; count <= 9; count++) test(`${count} enemies keep readable original slots and a four-person right column`, async ({ page }, info) => {
  await newHero(page);
  const battle = await formation(page, { count });
  await geometry(page, battle);
  await expect(page.locator('.touch-pad')).toBeHidden();
  await page.screenshot({ path: info.outputPath(`formation-${count}.png`), fullPage: true });
  await page.locator('#game-world canvas').screenshot({ path: info.outputPath(`formation-${count}-playfield.png`) });
});

for (const [suffix, count] of [['four-guards', 4], ['guarded-swarm', 8]]) test(`${suffix} fits its large and mixed enemy footprints`, async ({ page }, info) => {
  await newHero(page);
  const battle = await formation(page, { suffix });
  expect(battle.enemies).toHaveLength(count);
  await geometry(page, battle);
  await page.screenshot({ path: info.outputPath(`${suffix}.png`), fullPage: true });
});

test('battle scenes use actual outdoor terrain or dungeon origin instead of exploration tiles', async ({ page }, info) => {
  await newHero(page); expect((await viewport(page)).battlefield).toBeNull();
  const scenes = [];
  for (const [name, options] of [
    ['outdoor-grass', { area: 'overworld', tile: 'g', region: 'R01' }],
    ['outdoor-marsh', { area: 'overworld', tile: 'g', region: 'R03' }],
    ['bellworks-depth', { area: 'works-depth-3', region: 'R01' }],
    ['heart-depth', { area: 'heart-depth-8', region: 'R06' }],
  ]) {
    const battle = await formation(page, { count: 2, ...options });
    await geometry(page, battle);
    const scene = (await viewport(page)).battlefield;
    expect(scene.sourceArea).toBe(options.area);
    expect(scene.explorationEntitiesVisible).toBe(false);
    expect(scene.texture).toBeTruthy(); expect(scene.terrain).toBeTruthy();
    if (options.area.includes('-depth-')) expect(scene.floor).toBe(Number(options.area.split('-').at(-1)));
    scenes.push(scene);
    await page.locator('#game-world canvas').screenshot({ path: info.outputPath(`${name}.png`) });
  }
  expect(new Set(scenes.map(scene => scene.texture)).size).toBe(4);
});

test('stairs descend and return physically, and a new interior floor survives reload without recovery', async ({ page }, info) => {
  await newHero(page);
  const c = await core(), entry = c.g['enter-works'];
  await fixture(page, state => {
    state.area = 'works'; state.player = { x: entry.x, y: entry.y, facing: 'up' };
    state.flags.briefed = true; state.campaign.stage = 1; state.settings.encounters = 'off';
  });
  const before = await snapshot(page);
  const down = (await visibleMap(page)).entities.find(e => e.kind === 'exit' && c.g[e.id]?.area === 'works-depth-2');
  expect(down, 'Merewatch has an actual lower-floor stair').toBeTruthy();
  await cross(page, down.id, 'works-depth-2');
  let second = await snapshot(page);
  expect(second.heroes.map(h => [h.hp, h.charges, h.status])).toEqual(before.heroes.map(h => [h.hp, h.charges, h.status]));
  expect(second.inventory).toEqual(before.inventory); expect(second.gold).toBe(before.gold);
  const position = second.player;
  await page.reload(); await page.locator('[data-front="continue"]').click(); await settled(page);
  second = await snapshot(page);
  expect(second.area).toBe('works-depth-2'); expect(second.player).toEqual(position);
  expect(second.hx).toEqual(before.hx); expect(second.learnedSpells).toEqual(before.learnedSpells);
  await page.screenshot({ path: info.outputPath('floor-two-after-reload.png'), fullPage: true });
  const up = (await visibleMap(page)).entities.find(e => e.kind === 'exit' && c.g[e.id]?.area === 'works');
  expect(up).toBeTruthy(); await cross(page, up.id, 'works');
  expect((await snapshot(page)).heroes.map(h => [h.hp, h.charges, h.status])).toEqual(before.heroes.map(h => [h.hp, h.charges, h.status]));
});

test('a deep-floor route lever opens a persistent return shortcut instead of restoring supplies', async ({ page }, info) => {
  await newHero(page);
  const c = await core(), area = 'works-depth-3', switchId = 'depth_works_3_shortcut';
  await fixture(page, state => {
    state.area = area; state.player = { x: 4, y: 18, facing: 'right' };
    state.flags.briefed = true; state.campaign.stage = 1; state.settings.encounters = 'off';
    state.campaign.switches = state.campaign.switches.filter(id => id !== switchId);
  });
  const before = await snapshot(page);
  await interact(page, 'depth-lever-works-3'); await dismiss(page);
  let state = await snapshot(page);
  expect(state.campaign.switches).toContain(switchId);
  expect(state.inventory).toEqual(before.inventory);
  expect(state.heroes.map(h => [h.hp, h.charges, h.status])).toEqual(before.heroes.map(h => [h.hp, h.charges, h.status]));
  await page.screenshot({ path: info.outputPath('opened-deep-shortcut.png'), fullPage: true });
  const outward = (await visibleMap(page)).entities.find(e => e.kind === 'exit' && c.g[e.id]?.area === 'works');
  expect(outward).toBeTruthy(); await cross(page, outward.id, 'works');
  const returning = (await visibleMap(page)).entities.find(e => e.kind === 'exit' && c.g[e.id]?.area === area);
  expect(returning, 'unlocked root shortcut returns to the discovered floor').toBeTruthy();
  await cross(page, returning.id, area);
  await page.reload(); await page.locator('[data-front="continue"]').click(); await settled(page);
  state = await snapshot(page); expect(state.area).toBe(area); expect(state.campaign.switches).toContain(switchId);
});

test('the deepest local map shows stairs, eight floors, owned supplies and remaining charges', async ({ page }, info) => {
  await newHero(page);
  const c = await core();
  await fixture(page, state => {
    state.area = 'heart-depth-8'; state.player = { x: 4, y: 18, facing: 'right' };
    state.flags.briefed = true; state.campaign.stage = 9; state.settings.encounters = 'off';
    state.campaign.switches = plain(c.h);
    state.inventory.HIGH_POTION = 2; state.inventory.ANTIDOTE = 1;
    state.heroes.find(h => h.id === 'Iona').charges[0] = 0;
  });
  const before = await snapshot(page);
  await page.locator('[data-panel="worldmap"]').first().click();
  await page.locator('[data-map-view="area"]').click();
  await expect(page.locator('[data-local-map]')).toBeVisible();
  await expect(page.locator('[data-depth-floor]')).toContainText(/8/);
  await expect(page.locator('[data-map-stair="depth-up-heart-8"]')).toBeVisible();
  await expect(page.locator('[data-map-stair="depth-shortcut-heart-8"]')).toBeVisible();
  await expect(page.locator('[data-map-stair]:not([data-map-stair=""])')).toHaveCount(2);
  const plan = page.locator('[data-expedition-plan]'); await expect(plan).toBeVisible();
  await expect(plan.locator('[data-expedition-supply="HIGH_POTION"]')).toHaveAttribute('data-owned', '2');
  await expect(plan.locator('[data-expedition-supply="ANTIDOTE"]')).toHaveAttribute('data-owned', '1');
  await expect(plan.locator('[data-expedition-charges="Iona"]')).toContainText(/0\s*\/\s*2/);
  expect((await snapshot(page)).inventory).toEqual(before.inventory);
  expect((await snapshot(page)).gold).toBe(before.gold);
  await page.screenshot({ path: info.outputPath('deepest-floor-expedition-map.png'), fullPage: true });
  await page.locator('[data-map-view="world"]').click();
  await expect(page.locator('[data-world-site]')).toHaveCount(10);
  await expect(page.locator('[data-map-site]')).toHaveCount(10);
});

test('the separate shops and a learned spell still work in the selected game', async ({ page }, info) => {
  await newHero(page, 'arcanist');
  await fixture(page, state => { state.area = 'dunmere'; state.player = { x: 7, y: 7, facing: 'up' }; state.gold = 1000; });
  await interact(page, 'weapon-dunmere'); await expect(page.locator('#dialog-title')).toHaveText('Weapon Shop');
  await expect(page.locator('[data-buy="POTION"]')).toHaveCount(0);
  const before = await snapshot(page);
  await page.locator('[data-buy="R02_COMMON_CHARM"]').click();
  expect((await snapshot(page)).inventory.R02_COMMON_CHARM).toBe((before.inventory.R02_COMMON_CHARM || 0) + 1);
  await dismiss(page); await interact(page, 'shop-R02');
  await expect(page.locator('#dialog-title')).toHaveText('Item Shop');
  await expect(page.locator('[data-buy="R02_COMMON_CHARM"]')).toHaveCount(0);
  await page.locator('[data-buy="POTION"]').click();
  await dismiss(page); await interact(page, 'magic-dunmere');
  await page.locator('[data-pack-hero="Mara"]').click();
  const learning = await snapshot(page);
  await page.locator('[data-learn-spell="spark"]').click();
  const after = await snapshot(page);
  expect(after.learnedSpells.Mara).toContain('spark'); expect(after.gold).toBe(learning.gold - 35);
  expect(after.heroes[0].charges).toEqual(learning.heroes[0].charges);
  await dismiss(page); await page.reload(); await page.locator('[data-front="continue"]').click(); await settled(page);
  expect((await snapshot(page)).learnedSpells.Mara).toContain('spark');
  await page.screenshot({ path: info.outputPath('town-services-after-reload.png'), fullPage: true });
});

test('390px battle and dungeon planning fit the viewport and restore exploration controls after victory', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await newHero(page);
  await expect(page.locator('.touch-pad')).toBeVisible();
  const battle = await formation(page, { count: 9 }); await geometry(page, battle);
  const originalCells = Object.fromEntries((await viewport(page)).actors.map(actor => [actor.id, actor.cell]));
  await expect(page.locator('.touch-pad')).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: info.outputPath('mobile-nine-enemy-column.png'), fullPage: true });
  await finishBattle(page);
  await expect(page.locator('.touch-pad')).toBeHidden();
  expect((await viewport(page)).battlefield).toBeTruthy();
  for (const actor of (await viewport(page)).actors) expect(actor.cell, `${actor.id} keeps its slot after defeat`).toEqual(originalCells[actor.id]);
  await page.locator('[data-command="continue"]').click(); await settled(page);
  await expect(page.locator('.touch-pad')).toBeVisible(); expect((await viewport(page)).battlefield).toBeNull();
  await page.locator('[data-panel="worldmap"]').first().click();
  await page.locator('[data-map-view="area"]').click();
  await expect(page.locator('[data-local-map]')).toBeVisible();
  await expect(page.locator('[data-expedition-plan]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(await page.locator('[role="dialog"]').evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath('mobile-expedition-map.png'), fullPage: true });
  await page.locator('[data-expedition-plan]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('mobile-supply-reserves.png'), fullPage: true });
});
