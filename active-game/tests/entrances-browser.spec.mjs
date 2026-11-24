import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

// Declared save fixtures establish location/resources. Every crossing, purchase
// and conversation below uses real player input, with read-only snapshots.
const gameURL = process.env.GAME_URL || 'http://127.0.0.1:5173/';
const gameFile = process.env.GAME_HTML || new URL('../The_Road_Beyond_the_Bells.html', import.meta.url);
const html = await readFile(gameFile, 'utf8');
const oldHTML = await readFile(new URL('../entrances-baseline.html', import.meta.url), 'utf8');
const digest = value => createHash('sha256').update(value).digest('hex');
const gameHash = digest(html);
const engine = source => {
  const context = vm.createContext({ structuredClone });
  vm.runInContext(source.slice(source.indexOf('var l={schemaVersion'), source.indexOf('var De=new Set')), context, { timeout: 5000 });
  return context;
};
const c = engine(html), old = engine(oldHTML);
const plain = value => JSON.parse(JSON.stringify(value));
const towns = ['camp', 'dunmere', 'fen', 'orchard', 'crown', 'veyr'];
const directions = [['up',0,-1], ['down',0,1], ['left',-1,0], ['right',1,0]];
const arrows = { up:'ArrowUp', down:'ArrowDown', left:'ArrowLeft', right:'ArrowRight' };
const snapshot = page => page.evaluate(() => window.__AVEL__.snapshot());
const map = page => page.evaluate(() => window.__AVEL__.map());
const booted = new WeakSet(), errors = new WeakMap();
const buildings = () => Array.from(c.buildingEntrances || []);

test.beforeEach(async ({ page }) => {
  const list = []; errors.set(page, list);
  page.on('pageerror', error => list.push(error.message));
});
test.afterEach(async ({ page }) => { expect(errors.get(page) || []).toEqual([]); });

function state({ context=c, area='camp', player={x:11,y:10,facing:'up'}, level=5, encounters='off' }={}) {
  const game = context.Ee({ storage:null, seed:7321, roundDelay:0 });
  game.beginAdventure({ ...context.R, name:'Roadwalker' });
  game.skipIntro(); game.configure({ encounters, battleSpeed:3, npcMovement:'still' });
  const value = game.state;
  value.area = area; value.player = plain(player); value.gold = 633;
  value.flags.briefed = true; value.flags.completed = false;
  value.campaign.stage = 9; value.campaign.switches = plain(context.h);
  for (const hero of [...value.heroes]) {
    value.hx[hero.id] = context.l.xp_thresholds[level-1];
    value.heroes[value.heroes.indexOf(hero)] = context.be(hero.id, level, hero.equipment, value.profile, value.partyJobs[hero.id]);
  }
  return plain(value);
}
function resources(value) {
  return plain({ gold:value.gold, inventory:value.inventory, profile:value.profile, partyJobs:value.partyJobs,
    heroes:value.heroes, hx:value.hx, learnedSpells:value.learnedSpells, sp:value.sp, gr:value.gr,
    switches:value.campaign.switches, stage:value.campaign.stage, flags:value.flags, cleared:value.cleared,
    wildBattles:value.campaign.wildBattles, rng:value.rng });
}
async function open(page) {
  if (!booted.has(page)) {
    await page.addInitScript(() => {
      const next = sessionStorage.getItem('entrances-next-save');
      if (next) {
        localStorage.setItem('avel-demo-v1', next);
        sessionStorage.removeItem('entrances-next-save');
      }
    });
    booted.add(page);
  }
  const response = await page.goto(gameURL);
  expect(digest(await response.body()), 'preview is exact final game').toBe(gameHash);
  await page.waitForFunction(() => window.__AVEL__?.map);
}
async function settled(page) {
  await page.waitForFunction(() => {
    const v = window.__AVEL__?.viewport(), s = window.__AVEL__?.snapshot();
    return v && s && v.area === s.area && !v.transitioning;
  });
}
async function load(page, value) {
  if (!booted.has(page)) await open(page);
  await page.evaluate(save => sessionStorage.setItem('entrances-next-save', JSON.stringify(save)), value);
  const response = await page.reload(); expect(digest(await response.body())).toBe(gameHash);
  await page.locator('[data-front="continue"]').click();
  await settled(page);
  expect((await snapshot(page)).area).toBe(value.area);
}
async function noOverflow(page) {
  const size = await page.evaluate(() => ({ width:innerWidth, body:document.body.scrollWidth, root:document.documentElement.scrollWidth }));
  expect(size.body).toBeLessThanOrEqual(size.width+1);
  expect(size.root).toBeLessThanOrEqual(size.width+1);
}
async function shot(page, info, name) {
  await settled(page);
  await page.screenshot({ path:info.outputPath(name+'.png'), fullPage:true });
}
async function expectArea(page, area) {
  await expect.poll(async () => (await snapshot(page)).area).toBe(area);
  await settled(page);
  expect((await snapshot(page)).mode).toBe('explore');
  expect((await snapshot(page)).battle).toBeNull();
}
async function screenWorld(page, point) {
  return page.evaluate(point => {
    const canvas = document.querySelector('#game-world canvas'), box = canvas.getBoundingClientRect();
    const v = window.__AVEL__.viewport();
    return { x:box.left+(point.x-v.scrollX)*v.zoom*box.width/canvas.width,
      y:box.top+(point.y-v.scrollY)*v.zoom*box.height/canvas.height };
  }, point);
}
async function clickTile(page, tile, touch=false) {
  const point = await page.evaluate(tile => {
    const v = window.__AVEL__.viewport();
    return { x:v.ox+(tile.x+.5)*v.tile, y:v.oy+(tile.y+.5)*v.tile };
  }, tile);
  const screen = await screenWorld(page, point);
  if (touch) await page.touchscreen.tap(screen.x, screen.y); else await page.mouse.click(screen.x, screen.y);
}
async function visibleOpening(page, record, touch=false) {
  await settled(page);
  const value = await page.evaluate(id => window.__AVEL__.viewport().entrances?.find(entry => entry.id === id), record.doorId);
  expect(value, 'painted entrance metadata '+record.doorId).toBeTruthy();
  expect(value.door).toEqual(plain(record.door));
  const opening = value.opening, point = { x:opening.x+opening.w/2, y:opening.y+opening.h/2 };
  const view = await page.evaluate(() => window.__AVEL__.viewport());
  expect(Math.floor((point.x-view.ox)/view.tile)).toBe(record.door.x);
  expect(Math.floor((point.y-view.oy)/view.tile)).toBe(record.door.y);
  const screen = await screenWorld(page, point);
  if (touch) await page.touchscreen.tap(screen.x,screen.y); else await page.mouse.click(screen.x,screen.y);
  await expectArea(page, record.area);
}
async function step(page, direction) {
  await settled(page);
  const before = await snapshot(page);
  await page.locator('#game-world canvas').focus();
  await page.keyboard.down(arrows[direction]);
  try {
    await page.waitForFunction(previous => {
      const s = window.__AVEL__.snapshot();
      return s.area !== previous.area || s.player.x !== previous.player.x || s.player.y !== previous.player.y;
    }, before, { timeout:5000 });
  } finally { await page.keyboard.up(arrows[direction]); }
  await settled(page);
}
async function leaveBuilding(page, record, touch=false) {
  const exit = (await map(page)).entities.find(entity => entity.id === record.exitId);
  expect(exit).toBeTruthy(); await clickTile(page, exit, touch); await expectArea(page, record.parent);
  expect((await snapshot(page)).player).toMatchObject(plain(record.approach));
  await page.waitForTimeout(300);
  expect((await snapshot(page)).area).toBe(record.parent);
}
async function talk(page, id) {
  const npc = (await map(page)).entities.find(entity => entity.id === id);
  expect(npc).toBeTruthy(); await clickTile(page, npc);
  await expect.poll(async () => !!(await snapshot(page)).message).toBe(true);
}
async function dismiss(page) {
  for (let i=0;i<25 && (await snapshot(page)).message;i++) await page.locator('[data-command="dismiss"]').first().click();
  expect((await snapshot(page)).message).toBeNull();
}

test('all four Reedbank buildings open at their visible thresholds and return beside the same entrance', async ({ page }, info) => {
  const records = buildings().filter(record => record.parent === 'camp');
  expect(records).toHaveLength(4);
  await load(page, state()); await shot(page, info, 'desktop-reedbank-entrances');
  for (const record of records) {
    const initial = state(); await load(page, initial);
    const before = resources(await snapshot(page));
    await visibleOpening(page, record);
    expect((await map(page)).safe).toBe(true);
    await expect(page.locator('[data-command="rest"]')).toHaveCount(0);
    if (record.kind === 'shelter') {
      expect((await map(page)).entities.some(entity => entity.shopKind)).toBe(false);
      if (record.residentId) {
        await talk(page, record.residentId); await dismiss(page);
      }
      await shot(page, info, record.area+'-interior');
    }
    expect(resources(await snapshot(page))).toEqual(before);
    await leaveBuilding(page, record);
    expect(resources(await snapshot(page))).toEqual(before);
  }
});

test('all twelve city shop openings share the facade threshold and retain their original merchant service', async ({ page }, info) => {
  expect(c.settlementShopRecords).toHaveLength(12);
  for (const record of c.settlementShopRecords) {
    expect(record.door.y).toBe(5); expect(record.approach.y).toBe(6);
    const initial = state({ area:record.parent, player:{...plain(record.approach),facing:'up'} });
    await load(page, initial); await step(page,'up'); await expectArea(page,record.area);
    const inside = await map(page);
    expect(inside.entities.filter(entity=>entity.shopKind)).toHaveLength(1);
    expect(inside.entities.find(entity=>entity.id===record.merchantId)?.shopKind).toBe(record.kind);
    expect(resources(await snapshot(page))).toEqual(resources(initial));
    await leaveBuilding(page,record);
  }
  const record = c.settlementShopRecords.find(record=>record.parent==='camp'&&record.kind==='weapon');
  await load(page,state({player:{...plain(record.approach),facing:'up'}}));
  await visibleOpening(page,record); await talk(page,record.merchantId);
  await expect(page.locator('#dialog-title')).toHaveText('Weapon Shop');
  const before = await snapshot(page), item='R01_COMMON_CHARM';
  await page.locator('[data-gear-slot="charm"]').click();
  await page.locator('[data-shop-qty="5"]').click(); await page.locator('[data-buy="'+item+'"]').click();
  const after = await snapshot(page);
  expect(after.inventory[item]).toBe((before.inventory[item]||0)+5);
  expect(after.gold).toBeLessThan(before.gold);
  expect(after.heroes).toEqual(before.heroes);
  await shot(page,info,'desktop-aligned-shop-service'); await dismiss(page);
});

test('every city uses the same western route and arrival pause without crossing-step encounters', async ({ page }, info) => {
  for (const town of towns) {
    const site = c.k.find(site=>site.area===town), exit = c.he[town].entities.find(entity=>entity.id==='world-'+town);
    expect(exit).toMatchObject({x:2,y:14,travelKind:'field-exit'});
    expect(c.g[site.id]).toMatchObject({x:3,y:14,facing:'right'});
    const initial = state({area:town,encounters:'classic',player:{x:3,y:14,facing:'left'}});
    await load(page,initial); const before = resources(await snapshot(page));
    if (town==='camp') await shot(page,info,'desktop-reedbank-boardwalk-exit');
    await step(page,'left'); await expectArea(page,'overworld');
    expect((await snapshot(page)).player).toMatchObject({ x:c.g[exit.id].x, y:c.g[exit.id].y });
    expect(resources(await snapshot(page))).toEqual(before);
    await page.waitForTimeout(350); expect((await snapshot(page)).area).toBe('overworld');
    await page.locator('#game-world canvas').focus(); await page.keyboard.down('ArrowUp');
    try {
      // The held key intentionally keeps the arrival-release gate active.
      // Observe the new area without waiting for that gate to clear first.
      await expect.poll(async () => (await snapshot(page)).area).toBe(town);
      await page.waitForTimeout(450);
      expect((await snapshot(page)).player).toMatchObject({x:3,y:14,facing:'right'});
      expect((await snapshot(page)).battle).toBeNull();
    } finally { await page.keyboard.up('ArrowUp'); }
    await settled(page);
    expect(resources(await snapshot(page))).toEqual(before);
  }
});

test('genuine old Reedbank saves retain progress at the eastern approach and normalize only newly blocked footprints', async ({ page }, info) => {
  const blocked=[];
  for(let y=0;y<old.he.camp.height;y++)for(let x=0;x<old.he.camp.width;x++)
    if(old.q.includes(old.he.camp.tiles[y][x])&&!c.q.includes(c.he.camp.tiles[y][x]))blocked.push({x,y});
  expect(blocked.length).toBeGreaterThan(0);
  for(const point of [{x:27,y:14},...blocked]) {
    const initial=state({context:old,player:{...point,facing:'left'},level:7}); initial.gold=733;
    initial.safeReturn={area:'camp',...point}; await load(page,initial);
    const loaded=await snapshot(page);
    expect(resources(loaded)).toEqual(resources(initial));
    expect(c.q.includes(c.he.camp.tiles[loaded.player.y][loaded.player.x])).toBe(true);
    expect(c.q.includes(c.he.camp.tiles[loaded.safeReturn.y][loaded.safeReturn.x])).toBe(true);
    if(point.x===27&&point.y===14)expect(loaded.player).toEqual(initial.player);
    else expect({x:loaded.player.x,y:loaded.player.y}).not.toEqual(point);
  }
  await shot(page,info,'legacy-reedbank-journey-preserved');
});

test('mobile touch follows real openings and the area map shows the connected western boardwalk', async ({ page }, info) => {
  await page.setViewportSize({width:390,height:844}); await load(page,state());
  await noOverflow(page); await shot(page,info,'mobile-reedbank-entrances-and-exit');
  await page.locator('[data-panel="worldmap"]').first().click();
  await expect(page.locator('.modal')).toBeVisible(); await noOverflow(page); await shot(page,info,'mobile-reedbank-area-map');
  await page.locator('[data-close]').first().click();
  const record=buildings().find(record=>record.parent==='camp'&&record.kind==='shelter');
  await visibleOpening(page,record,true); await noOverflow(page); await shot(page,info,'mobile-shelter-interior');
  const before=resources(await snapshot(page));
  await page.reload(); await page.locator('[data-front="continue"]').click(); await settled(page);
  expect((await snapshot(page)).area).toBe(record.area); expect(resources(await snapshot(page))).toEqual(before);
  await leaveBuilding(page,record,true); await noOverflow(page);
  const exit=(await map(page)).entities.find(entity=>entity.id==='world-camp');
  await clickTile(page,exit,true); await expectArea(page,'overworld'); await noOverflow(page);
  expect((await snapshot(page)).player).toMatchObject({x:8,y:33});
});

test('a new hero can meet Bessa and follow the corrected exit to Merewatch and back', async ({ page }, info) => {
  await open(page); await page.locator('[data-front="new"]').click(); await page.locator('#hero-name').fill('Wayfinder');
  await page.locator('[data-front="next"]').click(); await page.locator('[data-front="next"]').click();
  await page.locator('[data-front="begin"]').click(); await page.locator('[data-intro="skip"]').click(); await settled(page);
  await talk(page,'bessa'); await dismiss(page); expect((await snapshot(page)).flags.briefed).toBe(true);
  await page.locator('[data-panel="help"]').first().click(); await page.locator('[data-encounters="off"]').click();
  await page.locator('[data-close]').first().click();
  let exit=(await map(page)).entities.find(entity=>entity.id==='world-camp'); await clickTile(page,exit); await expectArea(page,'overworld');
  let site=(await map(page)).entities.find(entity=>entity.id==='enter-works'); await clickTile(page,site); await expectArea(page,'works');
  exit=(await map(page)).entities.find(entity=>entity.id==='world-works'); await clickTile(page,exit); await expectArea(page,'overworld');
  site=(await map(page)).entities.find(entity=>entity.id==='enter-camp'); await clickTile(page,site); await expectArea(page,'camp');
  expect((await snapshot(page)).player).toMatchObject({x:3,y:14,facing:'right'});
  expect((await snapshot(page)).profile.name).toBe('Wayfinder'); await shot(page,info,'new-hero-western-return');
});
