import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const gameFile = process.env.GAME_FILE || 'The_Road_Beyond_the_Bells.html';
const gameURL = `http://127.0.0.1:5190/${gameFile}`;
const snapshot = page => page.evaluate(() => window.__AVEL__.snapshot());
const visibleMap = page => page.evaluate(() => window.__AVEL__.map());
const directions = [['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0]];
const arrows = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
const areas = ['camp', 'works', 'dunmere', 'tollhouse', 'fen', 'granary', 'orchard', 'crown', 'veyr', 'heart'];
const allSwitches = ['leth_records', 'sen_briefed', 'regional_feeders_retired', 'evacuation_ready'];

async function settled(page) {
  await page.waitForFunction(() => {
    const viewport = window.__AVEL__?.viewport();
    return viewport && viewport.area === window.__AVEL__.snapshot().area && !viewport.transitioning;
  });
}

async function newHero(page, { url = gameURL, intro = false } = {}) {
  await page.addInitScript(() => {
    const fixture = sessionStorage.getItem('travel-next-save');
    if (fixture) {
      localStorage.setItem('avel-demo-v1', fixture);
      sessionStorage.removeItem('travel-next-save');
    }
  });
  await page.goto(url);
  await page.waitForFunction(() => window.__AVEL__?.map);
  await page.locator('[data-front="new"]').click();
  await page.locator('#hero-name').fill('Roadwalker');
  await page.locator('[data-front="next"]').click();
  await page.locator('[data-front="next"]').click();
  await page.locator('[data-front="begin"]').click();
  if (intro) {
    while ((await snapshot(page)).mode === 'intro') await page.locator('[data-intro="next"]').click();
  } else {
    await page.locator('[data-intro="skip"]').click();
  }
  await settled(page);
  expect((await snapshot(page)).area).toBe('camp');
}

// All changes below are explicitly scoped save fixtures. The first test obtains
// every story flag and performs every journey action through the player UI.
async function reloadFixture(page, change) {
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('avel-demo-v1')));
  change(save);
  await page.evaluate(save => sessionStorage.setItem('travel-next-save', JSON.stringify(save)), save);
  await page.reload();
  await page.locator('[data-front="continue"]').click();
  await settled(page);
}

async function setEncountersOff(page) {
  await page.locator('[data-panel="help"]').last().click();
  await page.locator('[data-encounters="off"]').click();
  await page.locator('[data-close]').click();
  expect((await snapshot(page)).settings.encounters).toBe('off');
}

function route(map, start, goals, targetExit) {
  const key = point => `${point.x},${point.y}`;
  const goalSet = new Set(goals.map(key));
  const queue = [{ x: start.x, y: start.y, path: [] }];
  const seen = new Set([key(start)]);
  while (queue.length) {
    const current = queue.shift();
    if (goalSet.has(key(current))) return current.path;
    for (const [direction, dx, dy] of directions) {
      const next = { x: current.x + dx, y: current.y + dy };
      if (seen.has(key(next)) || !'gdsfb'.includes(map.tiles[next.y]?.[next.x] || '?')) continue;
      if (map.entities.some(entity => entity.x === next.x && entity.y === next.y && entity.id !== targetExit)) continue;
      seen.add(key(next));
      queue.push({ ...next, path: [...current.path, direction] });
    }
  }
  throw new Error(`No route from ${key(start)} to ${goals.map(key).join(' / ')} in ${map.area || map.name}`);
}

async function stepKey(page, direction) {
  await settled(page);
  const before = await snapshot(page);
  await page.locator('#game-world canvas').focus();
  await page.keyboard.down(arrows[direction]);
  try {
    await page.waitForFunction(before => {
      const state = window.__AVEL__.snapshot();
      return state.area !== before.area || state.player.x !== before.player.x || state.player.y !== before.player.y || !!state.message;
    }, before, { timeout: 2500 });
  } finally {
    await page.keyboard.up(arrows[direction]);
  }
  await settled(page);
}

async function walkTo(page, point, targetExit) {
  const initialArea = (await snapshot(page)).area;
  // A held key may span two movement ticks under automation. Replan from the
  // actual position instead of assuming every press advances exactly one tile.
  for (let attempt = 0; attempt < 180; attempt++) {
    const state = await snapshot(page);
    if (state.area !== initialArea) return;
    const path = route(await visibleMap(page), state.player, [point], targetExit);
    if (!path.length) return;
    await stepKey(page, path[0]);
  }
  throw new Error(`Bounded route did not reach ${point.x},${point.y} in ${initialArea}`);
}

async function approach(page, id) {
  const initialArea = (await snapshot(page)).area;
  for (let attempt = 0; attempt < 180; attempt++) {
    const state = await snapshot(page), map = await visibleMap(page);
    expect(state.area, `approach ${id} stays in its current area`).toBe(initialArea);
    const entity = map.entities.find(entity => entity.id === id);
    expect(entity, `${id} exists in ${state.area}`).toBeTruthy();
    const goals = directions.map(([, dx, dy]) => ({ x: entity.x + dx, y: entity.y + dy }));
    const path = route(map, state.player, goals);
    if (!path.length) return entity;
    await stepKey(page, path[0]);
  }
  throw new Error(`Bounded route did not approach ${id} in ${initialArea}`);
}

async function tilePosition(page, point) {
  await settled(page);
  return page.evaluate(point => {
    const canvas = document.querySelector('#game-world canvas');
    const box = canvas.getBoundingClientRect();
    const view = window.__AVEL__.viewport();
    return {
      x: box.left + ((point.x + .5) * view.tile + view.ox - view.scrollX) * view.zoom * box.width / canvas.width,
      y: box.top + ((point.y + .5) * view.tile + view.oy - view.scrollY) * view.zoom * box.height / canvas.height,
    };
  }, point);
}

async function clickTile(page, point, touch = false) {
  const position = await tilePosition(page, point);
  if (touch) await page.touchscreen.tap(position.x, position.y);
  else await page.mouse.click(position.x, position.y);
}

async function expectArea(page, area) {
  await page.waitForFunction(area => window.__AVEL__.snapshot().area === area, area);
  await settled(page);
  expect((await snapshot(page)).mode).toBe('explore');
  expect((await snapshot(page)).battle).toBeNull();
}

async function clickExit(page, id, expectedArea, touch = false) {
  const entity = (await visibleMap(page)).entities.find(entity => entity.id === id);
  expect(entity).toBeTruthy();
  const steps = (await snapshot(page)).steps;
  await clickTile(page, entity, touch);
  await expectArea(page, expectedArea);
  expect((await snapshot(page)).steps).toBeGreaterThan(steps);
}

async function screenshot(page, testInfo, filename) {
  await settled(page);
  await page.screenshot({ path: testInfo.outputPath(filename), fullPage: true });
}

test('new hero plays prologue, talks to Bessa and walks Reedbank → world → Merewatch → world → Reedbank', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await newHero(page, { intro: true });
  expect((await snapshot(page)).flags.briefed).toBe(false);
  await approach(page, 'bessa');
  await page.keyboard.press('e');
  await expect(page.locator('#dialog-title')).toContainText('Bessa');
  while ((await snapshot(page)).message) await page.locator('[data-command="dismiss"]').click();
  expect((await snapshot(page)).flags.briefed).toBe(true);
  await setEncountersOff(page);
  const camp = await visibleMap(page);
  expect(camp.entities.filter(entity => entity.kind === 'exit').map(entity => entity.id)).toEqual(['world-camp']);
  await screenshot(page, testInfo, '01-reedbank-after-bessa.png');
  await clickExit(page, 'world-camp', 'overworld');
  expect((await snapshot(page)).campaign.stage).toBe(0);
  await screenshot(page, testInfo, '02-overworld-first-road.png');
  const worksSite = (await visibleMap(page)).entities.find(entity => entity.id === 'enter-works');
  await approach(page, 'enter-works');
  await clickExit(page, 'enter-works', 'works');
  await screenshot(page, testInfo, '03-merewatch-entrance.png');
  await walkTo(page, { x: 2, y: 15 }, 'world-works');
  await expectArea(page, 'overworld');
  const returnState = await snapshot(page);
  expect(Math.abs(returnState.player.x - worksSite.x) + Math.abs(returnState.player.y - worksSite.y)).toBe(1);
  const persisted = { area: returnState.area, player: returnState.player, overworldReturn: returnState.overworldReturn, profile: returnState.profile, hx: returnState.hx, heroes: returnState.heroes, inventory: returnState.inventory };
  await page.reload();
  await page.locator('[data-front="continue"]').click();
  await settled(page);
  const restored = await snapshot(page);
  expect({ area: restored.area, player: restored.player, overworldReturn: restored.overworldReturn, profile: restored.profile, hx: restored.hx, heroes: restored.heroes, inventory: restored.inventory }).toEqual(persisted);
  await approach(page, 'enter-camp');
  await clickExit(page, 'enter-camp', 'camp');
  await page.locator('[data-panel="worldmap"]').click();
  await page.locator('[data-map-view="world"]').click();
  await expect(page.locator('[data-map-site]')).toHaveCount(10);
  expect(await page.locator('[data-map-site]').evaluateAll(elements => elements.map(element => element.dataset.mapSite))).toEqual(areas);
  await expect(page.locator('[data-map-site="orchard"]')).toContainText('Road / refuge');
  await expect(page.locator('[data-map-site="crown"]')).toContainText('Road / refuge');
  await expect(page.locator('.world-atlas g')).toHaveCount(10);
  await screenshot(page, testInfo, '04-world-map-ten-sites.png');
  expect(errors).toEqual([]);
});

test('Merewatch briefing and the region-two crossing block on the approach with no threshold encounter', async ({ page }) => {
  await newHero(page);
  await reloadFixture(page, save => {
    save.area = 'overworld'; save.player = { x: 15, y: 32, facing: 'up' };
    save.encounterSteps = 17; save.settings.encounters = 'classic';
  });
  await stepKey(page, 'up');
  let state = await snapshot(page);
  expect(state.area).toBe('overworld');
  expect(state.player).toMatchObject({ x: 15, y: 32 });
  expect(state.battle).toBeNull();
  expect(state.message.text).toMatch(/Bessa/);
  await page.locator('[data-command="dismiss"]').click();
  await reloadFixture(page, save => {
    save.area = 'overworld'; save.player = { x: 8, y: 27, facing: 'up' };
    save.encounterSteps = 17; save.settings.encounters = 'classic';
  });
  await stepKey(page, 'up');
  state = await snapshot(page);
  expect(state.area).toBe('overworld');
  expect(state.player).toMatchObject({ x: 8, y: 27 });
  expect(state.battle).toBeNull();
  expect(state.message.text).toMatch(/Bessa|convoy/);
});

test('each of the ten canonical sites enters its local area and returns beside that same site', async ({ page }) => {
  await newHero(page);
  await reloadFixture(page, save => { save.area = 'overworld'; save.player = { x: 8, y: 33, facing: 'up' }; });
  const sites = (await visibleMap(page)).entities.filter(entity => entity.id.startsWith('enter-'));
  expect(sites).toHaveLength(10);
  expect(new Set(sites.map(entity => `${entity.x},${entity.y}`)).size).toBe(10);
  for (const site of sites) {
    const area = site.id.slice(6);
    await reloadFixture(page, save => {
      save.area = 'overworld'; save.player = { x: site.x, y: site.y + 1, facing: 'up' };
      save.campaign.stage = 10; save.campaign.switches = [...new Set([...save.campaign.switches, ...allSwitches])];
      save.flags.completed = true;
      save.flags.briefed = true; save.settings.encounters = 'classic'; save.encounterSteps = 17;
    });
    await stepKey(page, 'up');
    await expectArea(page, area);
    const local = await visibleMap(page);
    const exits = local.entities.filter(entity => entity.kind === 'exit' && entity.id.startsWith('world-'));
    expect(exits.map(entity => entity.id), `${area} has one canonical world exit`).toEqual([`world-${area}`]);
    for (const interior of local.entities.filter(entity => entity.kind === 'exit' && !entity.id.startsWith('world-'))) {
      expect(interior.travelKind, `${interior.id} is an authored stair or service lift`).toBe('stairs');
      expect(interior.destination === area || interior.destination?.startsWith(`${area}-depth-`), `${interior.id} stays in ${area}'s dungeon`).toBe(true);
    }
    const forbidden = ['toWorks', 'toCamp', 'town-tollhouse', 'town-granary', 'town-heart'];
    expect(local.entities.some(entity => forbidden.includes(entity.id))).toBe(false);
    const exit = exits[0];
    await clickExit(page, exit.id, 'overworld');
    const returned = await snapshot(page);
    expect(Math.abs(returned.player.x - site.x) + Math.abs(returned.player.y - site.y)).toBe(1);
    expect(returned.encounterSteps).toBe(0);
    await page.waitForTimeout(250);
    expect((await snapshot(page)).area).toBe('overworld');
    expect((await snapshot(page)).player).toEqual(returned.player);
  }
});

test('later-region and dungeon prerequisites remain enforced at their own world thresholds', async ({ page }) => {
  await newHero(page);
  await reloadFixture(page, save => { save.area = 'overworld'; save.player = { x: 8, y: 33, facing: 'up' }; });
  const world = await visibleMap(page);
  const cases = [
    ['ferry-fen', 3, [], /captives|Neri|ferry/i],
    ['pass-orchard', 4, [], /Sen|granary|shelter/i],
    ['road-crown', 5, [], /shelter|Orchard/i],
    ['gate-veyr', 6, ['regional_feeders_retired'], /Halden|handover/i],
    ['gate-veyr', 7, [], /Halden|handover/i],
    ['enter-tollhouse', 3, [], /Leth|records/i],
    ['enter-granary', 4, [], /Sen|granary/i],
    ['enter-heart', 8, [], /Leth|Neri|Bessa|patients/i],
  ];
  for (const [id, stage, switches, message] of cases) {
    const gate = world.entities.find(entity => entity.id === id);
    const neighbor = directions.map(([direction, dx, dy]) => ({
      direction: { up: 'down', down: 'up', left: 'right', right: 'left' }[direction],
      x: gate.x + dx, y: gate.y + dy,
    })).find(point => 'gdsfb'.includes(world.tiles[point.y]?.[point.x] || '?') && !world.entities.some(entity => entity.x === point.x && entity.y === point.y));
    expect(neighbor).toBeTruthy();
    await reloadFixture(page, save => {
      save.area = 'overworld'; save.player = { x: neighbor.x, y: neighbor.y, facing: neighbor.direction };
      save.campaign.stage = stage; save.campaign.switches = switches; save.flags.briefed = true;
      save.settings.encounters = 'classic'; save.encounterSteps = 17;
    });
    await stepKey(page, neighbor.direction);
    const state = await snapshot(page);
    expect(state.area, id).toBe('overworld');
    expect(state.player, id).toMatchObject({ x: neighbor.x, y: neighbor.y });
    expect(state.battle, id).toBeNull();
    expect(state.message?.text, id).toMatch(message);
    await page.locator('[data-command="dismiss"]').click();
  }
});

test('stale and foreign saved return coordinates fall back to the current area’s own site', async ({ page }) => {
  await newHero(page);
  // These are legal v3 coordinates from old saves. Malformed/water returns are
  // rejected by the existing save validator and are covered in engine tests.
  for (const overworldReturn of [{ x: 8, y: 32 }, { x: 15, y: 31 }, { x: 58, y: 6 }]) {
    await reloadFixture(page, save => {
      save.area = 'works'; save.player = { x: 3, y: 15, facing: 'left' };
      save.overworldReturn = overworldReturn; save.flags.briefed = true;
      save.settings.encounters = 'classic'; save.encounterSteps = 17;
    });
    await stepKey(page, 'left');
    await expectArea(page, 'overworld');
    const state = await snapshot(page);
    expect(Math.abs(state.player.x - 15) + Math.abs(state.player.y - 31)).toBe(1);
    expect(state.encounterSteps).toBe(0);
    const position = state.player;
    await page.reload();
    await page.locator('[data-front="continue"]').click();
    await settled(page);
    expect((await snapshot(page)).area).toBe('overworld');
    expect((await snapshot(page)).player).toEqual(position);
  }
});

test('a held movement key is released by a transition and resumes only after a fresh press', async ({ page }, testInfo) => {
  await newHero(page);
  await reloadFixture(page, save => { save.player = { x: 27, y: 14, facing: 'right' }; save.settings.encounters = 'off'; });
  await page.locator('#game-world canvas').focus();
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => window.__AVEL__.snapshot().area === 'overworld');
  const landed = (await snapshot(page)).player;
  await page.waitForTimeout(600);
  expect((await snapshot(page)).player).toEqual(landed);
  await page.keyboard.up('ArrowRight');
  await settled(page);
  await stepKey(page, 'up');
  await expectArea(page, 'camp');
  await screenshot(page, testInfo, '05-keyboard-return-to-reedbank.png');
});

test('390px touch controls, transparent pad gaps and reduced-motion transitions remain usable', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await newHero(page);
  await setEncountersOff(page);
  const before = await snapshot(page);
  await page.locator('[data-move="right"]').tap();
  await expect.poll(async () => (await snapshot(page)).player.x).toBe(before.player.x + 1);
  const gap = await page.locator('.touch-pad').evaluate(pad => {
    const box = pad.getBoundingClientRect();
    const button = pad.querySelector(':scope > button').getBoundingClientRect();
    const point = { x: box.left + 3, y: button.top + button.height / 2 };
    return { ...point, target: document.elementFromPoint(point.x, point.y)?.tagName };
  });
  expect(gap.target).toBe('CANVAS');
  await page.locator('#game-world canvas').evaluate(canvas => {
    canvas.dataset.travelGapPointer = '0';
    canvas.addEventListener('pointerdown', () => { canvas.dataset.travelGapPointer = '1'; }, { once: true });
  });
  await page.touchscreen.tap(gap.x, gap.y);
  await expect(page.locator('#game-world canvas')).toHaveAttribute('data-travel-gap-pointer', '1');
  await page.waitForTimeout(200);
  // Stop that distant pointer route by taking a native movement input.
  await page.locator('[data-move="right"]').tap();
  await reloadFixture(page, save => { save.player = { x: 27, y: 14, facing: 'right' }; });
  await page.locator('[data-move="right"]').tap();
  await expectArea(page, 'overworld');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await screenshot(page, testInfo, '06-mobile-overworld-390.png');
  await clickExit(page, 'enter-camp', 'camp', true);
  await screenshot(page, testInfo, '07-mobile-reedbank-touch-return.png');
  await context.close();
});

test('old saves already standing on an entrance or local exit can click that tile to travel', async ({ page }) => {
  await newHero(page);
  await reloadFixture(page, save => {
    save.area = 'overworld'; save.player = { x: 15, y: 31, facing: 'up' };
    save.settings.encounters = 'off'; save.flags.briefed = false;
  });
  await clickTile(page, { x: 15, y: 31 });
  await expect.poll(async () => (await snapshot(page)).message?.text).toMatch(/Bessa/);
  expect((await snapshot(page)).area).toBe('overworld');
  await page.locator('[data-command="dismiss"]').click();
  await reloadFixture(page, save => { save.flags.briefed = true; });
  await clickTile(page, { x: 15, y: 31 });
  await expectArea(page, 'works');
  await reloadFixture(page, save => { save.player = { x: 2, y: 15, facing: 'left' }; });
  await page.waitForTimeout(250);
  expect((await snapshot(page)).area).toBe('works');
  await clickTile(page, { x: 2, y: 15 });
  await expectArea(page, 'overworld');
  expect((await snapshot(page)).player).toMatchObject({ x: 15, y: 32 });
});

test('standalone travel boots with every secondary network request blocked', async ({ page }, testInfo) => {
  const url = 'http://127.0.0.1:5190/standalone-travel-document.html';
  const html = await readFile(new URL(`../${gameFile}`, import.meta.url), 'utf8');
  const requests = [], errors = [];
  page.on('request', request => { if (/^https?:/.test(request.url()) && request.url() !== url) requests.push(request.url()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => route.request().url() === url
    ? route.fulfill({ status: 200, contentType: 'text/html', body: html })
    : route.abort());
  await newHero(page, { url });
  await reloadFixture(page, save => { save.player = { x: 27, y: 14, facing: 'right' }; save.settings.encounters = 'off'; });
  await clickExit(page, 'world-camp', 'overworld');
  await screenshot(page, testInfo, '08-standalone-offline-overworld.png');
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});
