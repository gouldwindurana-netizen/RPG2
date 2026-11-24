'use strict';

// These fixtures exercise the actual bundled map, travel, event and save rules.
// They isolate progression states; they do not claim an earned-level campaign run.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const file = process.env.GAME_HTML || path.join(__dirname, '..', 'The_Road_Beyond_the_Bells.html');
const html = fs.readFileSync(file, 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const dirs = [['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0]];
const totals = { works: 3, tollhouse: 4, granary: 5, orchard: 6, crown: 7, heart: 8 };

function contextFor(text) {
  const start = text.indexOf('var l={schemaVersion'), end = text.indexOf('var De=new Set', start);
  assert.ok(start >= 0 && end > start);
  const context = vm.createContext({ structuredClone });
  vm.runInContext(text.slice(start, end), context, { timeout: 5000 });
  return context;
}
function create(text = html, saved) {
  const context = contextFor(text), saves = new Map();
  if (saved) saves.set('avel-demo-v1', saved);
  const storage = { getItem: key => saves.get(key) ?? null, setItem: (key, value) => saves.set(key, String(value)), removeItem: key => saves.delete(key) };
  const game = context.Ee({ storage, seed: 7321, roundDelay: 0 });
  if (!saved) {
    game.beginAdventure({ ...context.R, name: 'Arin' });
    game.skipIntro();
    game.configure({ encounters: 'off' });
  }
  return { context, game, saves, reload: () => context.Ee({ storage, seed: 7321, roundDelay: 0 }) };
}
function fixture(game, area, point = { x: 4, y: 18 }) {
  game.state.area = area;
  game.state.player = { ...point, facing: 'right' };
  game.state.mode = 'explore';
  game.state.message = null;
  game.state.messageQueue = [];
  game.state.reward = null;
  game.state.battle = null;
  game.state.flags.briefed = true;
}
function drain(game) { for (let n = 0; game.state.message && n < 50; n++) game.dismiss(); assert.equal(game.state.message, null); }
function reachable(context, map, start, targetExit) {
  const seen = new Set([`${start.x},${start.y}`]), queue = [start];
  for (let i = 0; i < queue.length; i++) for (const [, dx, dy] of dirs) {
    const p = { x: queue[i].x + dx, y: queue[i].y + dy }, key = `${p.x},${p.y}`;
    if (seen.has(key) || !context.q.includes(map.tiles[p.y]?.[p.x])) continue;
    if (map.entities.some(e => e.x === p.x && e.y === p.y && e.id !== targetExit)) continue;
    seen.add(key); queue.push(p);
  }
  return seen;
}
function adjacentReached(seen, entity) { return dirs.some(([, dx, dy]) => seen.has(`${entity.x + dx},${entity.y + dy}`)); }
function approach(context, game, id) {
  drain(game);
  const map = game.map(), entity = map.entities.find(e => e.id === id);
  assert.ok(entity, `${game.state.area}/${id} exists`);
  const p = dirs.map(([, dx, dy]) => ({ x: entity.x + dx, y: entity.y + dy })).find(p => context.q.includes(map.tiles[p.y]?.[p.x]) && !map.entities.some(e => e.x === p.x && e.y === p.y));
  assert.ok(p, `${id} has a free adjacent tile`);
  game.state.player = { ...p, facing: 'right' };
  game.interact(id);
  return entity;
}
function reserves(game) { return plain({ heroes: game.state.heroes, hx: game.state.hx, gold: game.state.gold, inventory: game.state.inventory }); }

test('six dungeon roots have 3 through 8 real floors without adding exterior destinations', () => {
  const { context: c } = create();
  assert.equal(c.k.length, 10);
  assert.equal(Object.keys(c.dungeonAreas).length, 33);
  for (const [root, total] of Object.entries(totals)) for (let floor = 1; floor <= total; floor++) {
    const area = floor === 1 ? root : `${root}-depth-${floor}`, map = c.he[area], info = c.dungeonInfo(area);
    assert.ok(map, area);
    assert.deepEqual(plain({ root: info.root, floor: info.floor, total: info.total }), { root, floor, total });
    assert.equal(c.M(area, 4, 18), info.region);
    assert.equal(map.area, area);
    if (floor > 1) { assert.equal(map.kind, 'dungeon'); assert.equal(map.width, 40); assert.equal(map.height, 24); }
  }
});

test('old base maps keep story entities and saved floor while building merchants relocate intact', () => {
  const { context: c } = create(), old = contextFor(fs.readFileSync(path.join(__dirname, '..', 'depth-baseline.html'), 'utf8'));
  const relocated = new Set(Object.values(c.dungeonCatalog).flatMap(data => Object.values(data.bosses).flat()));
  for (const root of Object.keys(totals)) {
    for (const entity of old.he[root].entities.filter(e => !relocated.has(e.id))) {
      const store = c.settlementShopRecords?.find(record => record.parent === root && record.merchantId === entity.id);
      if (store) {
        const matches = Object.entries(c.he).flatMap(([area, map]) => map.entities.filter(candidate => candidate.id === entity.id).map(found => ({ area, found })));
        assert.equal(matches.length, 1, `${entity.id} remains one original merchant`);
        assert.equal(matches[0].area, store.area);
        assert.equal(matches[0].found.kind, entity.kind);
        assert.equal(matches[0].found.shopKind, entity.shopKind);
        assert.equal(matches[0].found.sprite, entity.sprite);
        const door = c.he[root].entities.find(candidate => candidate.id === store.doorId);
        assert.ok(door, `${root} retains the original building entrance`);
        assert.deepEqual(plain({ x: door.x, y: door.y }), { x: entity.x, y: entity.y - 1 }, 'threshold is in the facade rather than below it');
        assert.deepEqual(plain(store.door), { x: door.x, y: door.y });
        assert.deepEqual(plain(store.approach), { x: door.x, y: door.y + 1 });
        assert.ok(c.q.includes(c.he[root].tiles[door.y][door.x]));
      } else {
        const found = c.he[root].entities.find(e => e.id === entity.id);
        assert.ok(found, `${root}/${entity.id}`);
        assert.deepEqual(plain({ x: found.x, y: found.y }), { x: entity.x, y: entity.y });
      }
    }
    for (let y = 0; y < old.he[root].height; y++) for (let x = 0; x < old.he[root].width; x++) {
      if (old.q.includes(old.he[root].tiles[y][x])) assert.ok(c.q.includes(c.he[root].tiles[y][x]), `${root} old tile ${x},${y}`);
    }
  }
});

test('bosses occupy their intended deep floors once and keep the original story conditions', () => {
  const { context: c } = create();
  for (const [root, data] of Object.entries(c.dungeonCatalog)) for (const [floor, ids] of Object.entries(data.bosses)) for (const id of ids) {
    const matches = Object.entries(c.he).flatMap(([area, map]) => map.entities.filter(e => e.id === id).map(e => ({ area, entity: e })));
    assert.equal(matches.length, 1, id);
    assert.equal(matches[0].area, `${root}-depth-${floor}`);
    assert.ok(c._[id], `${id} keeps authored stage/switch guards`);
  }
  assert.equal(c.g['depth-down-heart-4'].requiredSwitch, 'choir_defeated');
  assert.equal(c.g['depth-down-heart-6'].requiredSwitch, 'vale_defeated');
});

test('every paired stair crosses and retraces without healing, MP refill or encounter RNG', () => {
  const { context: c, game: g, reload } = create();
  g.state.campaign.stage = 9; g.state.campaign.switches = plain(c.h);
  g.state.heroes[0].hp = 41; g.state.heroes[2].mp = 1;
  for (const [root, total] of Object.entries(totals)) for (let floor = 1; floor < total; floor++) {
    const area = floor === 1 ? root : `${root}-depth-${floor}`;
    fixture(g, area, floor === 1 ? { x: 26, y: 3 } : { x: 34, y: 5 });
    const before = reserves(g), rng = g.state.rng, outside = plain(g.state.overworldReturn);
    g.move('right');
    assert.equal(g.state.area, `${root}-depth-${floor + 1}`);
    assert.deepEqual(plain(g.state.player), { x: 4, y: 18, facing: 'right' });
    assert.equal(g.state.rng, rng); assert.equal(g.state.encounterSteps, 0);
    assert.deepEqual(reserves(g), before); assert.deepEqual(plain(g.state.overworldReturn), outside);
    assert.ok(g.state.campaign.switches.includes(`depth_${root}_${floor + 1}_seen`));
    assert.equal(g.save(), true);
    const restored = reload(); assert.equal(restored.state.area, g.state.area); assert.deepEqual(reserves(restored), before);
    g.move('left'); assert.equal(g.state.area, area);
    assert.deepEqual(plain({ x: g.state.player.x, y: g.state.player.y }), floor === 1 ? { x: 26, y: 3 } : { x: 34, y: 5 });
    assert.deepEqual(reserves(g), before); assert.equal(g.state.rng, rng);
  }
});

test('new floors have reachable supplies, records, controls and far stairs when their locks open', () => {
  const { context: c, game: g } = create();
  g.state.campaign.stage = 9;
  for (const area of Object.keys(c.dungeonAreas).filter(area => area.includes('-depth-'))) {
    fixture(g, area); g.state.campaign.switches = [];
    let map = g.map(), seen = reachable(c, map, g.state.player);
    const wheel = map.entities.find(e => e.depthWheel);
    if (wheel) assert.ok(adjacentReached(seen, wheel), `${area} first wheel reachable`);
    for (const entity of map.entities.filter(e => e.depthWheel || e.depthLever)) {
      if (entity.depthWheel) g.state.campaign.switches.push(entity.depthWheel);
      if (entity.depthLever) g.state.campaign.switches.push(entity.depthLever);
    }
    map = g.map(); seen = reachable(c, map, g.state.player);
    for (const entity of map.entities) assert.ok(adjacentReached(seen, entity), `${area}/${entity.id} reachable after controls`);
    const cache = map.entities.find(e => e.depthSupplies), info = c.dungeonInfo(area);
    if (info.floor >= 3) assert.ok(cache.x >= 10, `${area} supplies require a branch detour`);
  }
});

test('later floors require ordered cross-locks without cutting off the retreat stairs', () => {
  const { context: c, game: g } = create();
  for (const area of Object.keys(c.dungeonAreas).filter(area => c.dungeonInfo(area).floor >= 4)) {
    fixture(g, area); g.state.campaign.switches = [];
    let map = g.map(), up = map.entities.find(e => e.stairDirection === 'up' && e.travelKind === 'stairs'), seen = reachable(c, map, g.state.player);
    const far = map.entities.find(e => e.stairDirection === 'down' && e.id.startsWith('depth-down-')) || map.entities.find(e => e.kind === 'boss');
    assert.ok(adjacentReached(seen, up), `${area} retreat starts open`);
    assert.equal(adjacentReached(seen, far), false, `${area} lower lock is a real bottleneck`);
    approach(c, g, `depth-wheel-${c.dungeonInfo(area).root}-${c.dungeonInfo(area).floor}`); drain(g);
    fixture(g, area); map = g.map(); seen = reachable(c, map, g.state.player);
    if (c.dungeonInfo(area).floor >= 6) {
      assert.equal(adjacentReached(seen, far), false, `${area} upper lock also matters`);
      const upper = map.entities.find(e => e.id.startsWith('depth-upper-wheel-'));
      assert.ok(adjacentReached(seen, upper), `${area} eastern wheel is reachable after first lock`);
      const barrier = map.entities.find(e => e.id.startsWith('depth-upper-gate-'));
      assert.match(c.depthEvent(barrier.id, g.state).messages[0].text, /eastern inspection room/);
      approach(c, g, upper.id); drain(g); fixture(g, area); map = g.map(); seen = reachable(c, map, g.state.player);
    }
    assert.ok(adjacentReached(seen, far), `${area} far stair or guardian reachable after locks`);
    assert.ok(adjacentReached(seen, up), `${area} retreat stays open`);
  }
});

test('service lifts latch permanently and return to their own floor without recovery', () => {
  const { context: c, game: g, reload } = create();
  g.state.campaign.stage = 9;
  for (const [root, total] of Object.entries(totals)) for (let floor = 3; floor <= total; floor++) {
    const area = `${root}-depth-${floor}`, key = `depth_${root}_${floor}_shortcut`;
    fixture(g, area, { x: 32, y: 6 }); g.state.campaign.switches = [];
    const before = reserves(g);
    approach(c, g, `depth-lever-${root}-${floor}`); drain(g);
    assert.ok(g.state.campaign.switches.includes(key));
    const lift = g.map().entities.find(e => e.id === `depth-shortcut-${root}-${floor}`);
    approach(c, g, lift.id); assert.equal(g.state.area, root);
    assert.deepEqual(reserves(g), before); assert.equal(g.save(), true);
    const restored = reload(); assert.ok(restored.state.campaign.switches.includes(key));
    const returning = restored.map().entities.find(e => e.id === `depth-return-${root}-${floor}`);
    assert.ok(returning);
    approach(c, restored, returning.id); assert.equal(restored.state.area, area); assert.deepEqual(reserves(restored), before);
  }
});

test('branch caches grant their supplies once, survive reload, and restore no HP or MP', () => {
  const { context: c, game: g, reload } = create();
  fixture(g, 'granary-depth-5'); g.state.heroes[0].hp = 31; g.state.heroes[2].mp = 1;
  const before = reserves(g), cache = g.map().entities.find(e => e.depthSupplies);
  approach(c, g, cache.id); assert.equal(g.state.mode, 'victory');
  assert.deepEqual(plain(g.state.heroes), before.heroes); assert.deepEqual(plain(g.state.hx), before.hx); assert.equal(g.state.gold, before.gold);
  for (const [id, amount] of Object.entries(cache.depthSupplies)) assert.equal(g.state.inventory[id], (before.inventory[id] ?? 0) + amount);
  assert.ok(g.state.campaign.openedChests.includes(cache.id));
  const after = reserves(g), restored = reload(); assert.equal(restored.state.mode, 'victory'); restored.continue(); drain(restored);
  assert.equal(restored.map().entities.some(e => e.id === cache.id), false); assert.deepEqual(reserves(restored), after);
});

test('floor evidence is original, once recorded and retained with new patrol clears after reload', () => {
  const { context: c, game: g, reload } = create();
  fixture(g, 'heart-depth-7'); g.state.campaign.stage = 9;
  const note = g.map().entities.find(e => e.depthRecord), before = reserves(g);
  approach(c, g, note.id); assert.match(g.state.message.text, /receiving signal|evacuation wards/); drain(g);
  assert.ok(g.state.campaign.switches.includes('depth_heart_7_record'));
  g.state.cleared.push('depth-patrol-heart-7-0'); g.save();
  const restored = reload(); assert.ok(restored.state.campaign.switches.includes('depth_heart_7_record')); assert.ok(restored.state.cleared.includes('depth-patrol-heart-7-0'));
  approach(c, restored, note.id); assert.match(restored.state.message.text, /already|copied/); drain(restored);
  assert.equal(restored.state.campaign.switches.filter(id => id === 'depth_heart_7_record').length, 1); assert.deepEqual(reserves(restored), before);
});

test('regional planning is available in towns and keeps service courts safe', () => {
  const { context: c, game: g } = create();
  for (const [town, root] of Object.entries({ camp: 'works', dunmere: 'tollhouse', fen: 'granary', orchard: 'orchard', crown: 'crown', veyr: 'heart' })) {
    fixture(g, town, { x: 8, y: 14 }); const plan = c.dungeonPlan(g.state);
    assert.equal(plan.info.root, root); assert.equal(plan.info.total, totals[root]); assert.equal(plan.nearby, true);
    assert.ok(plan.supplies.length >= 3); assert.ok(plan.supplies.every(item => item.owned === (g.state.inventory[item.itemId] ?? 0)));
    assert.match(plan.goals[0], /Reach floor/);
    assert.equal(c.p(town, 8, 14), true); assert.equal(c.dungeonInfo(town, 8, 14), null);
  }
  fixture(g, 'heart-depth-8'); const plan = c.dungeonPlan(g.state); assert.equal(plan.info.floor, 8); assert.equal(plan.currentFloor, true);
  assert.ok(plan.floors.slice(1, 7).every(floor => floor.title.startsWith('Uncharted')));
});

test('floor depth unlocks regional groups without scaling enemies to the party', () => {
  const { context: c, game: g } = create(); g.state.campaign.stage = 9; g.state.cleared = ['encounter1', 'encounter2'];
  for (const [root, total] of Object.entries(totals)) {
    const region = c.dungeonInfo(root).region;
    fixture(g, root, { x: 27, y: 3 }); assert.ok(c.encounterEligible(region, g.state).every(row => !row.deep));
    fixture(g, `${root}-depth-${total}`); const rows = c.encounterEligible(region, g.state);
    assert.ok(rows.some(row => row.members.length === 9)); assert.ok(rows.some(row => row.members.some(member => member.rank === 'ashen')));
    const before = plain(rows); g.state.heroes.forEach(hero => hero.level = 50); assert.deepEqual(plain(c.encounterEligible(region, g.state)), before);
  }
});

test('a fresh classic expedition can meet light deep groups on floor two without authored patrol clears', () => {
  const { context: c, game: g } = create();
  g.configure({ encounters: 'classic' });
  fixture(g, 'works-depth-2');
  assert.deepEqual(plain(g.state.cleared), []);
  assert.equal(g.state.campaign.stage, 0);
  const rows = c.encounterEligible('R01', g.state);
  assert.ok(rows.some(row => row.deep && row.members.length >= 5));
  assert.ok(rows.every(row => row.members.length <= 6));
  assert.equal(rows.some(row => row.id.endsWith('four-guards')), false);
  fixture(g, 'works', { x: 27, y: 3 });
  assert.ok(c.encounterEligible('R01', g.state).every(row => !row.deep));
});

test('old v1/v2/v3 base positions and completed opening rescue import without replay or lost resources', () => {
  const baseline = fs.readFileSync(path.join(__dirname, '..', 'depth-baseline.html'), 'utf8');
  for (const version of [1, 2, 3]) {
    const old = create(baseline), saved = old.game.state;
    saved.version = version; saved.area = 'works'; saved.player = { x: 27, y: 3, facing: 'left' }; saved.flags.briefed = true; saved.flags.bossDefeated = true;
    saved.campaign.stage = 1; saved.campaign.switches = ['orren_rescued']; saved.cleared = ['bailiff']; old.game.save();
    const imported = create(html, old.saves.get('avel-demo-v1')).game;
    assert.equal(imported.state.mode, 'explore'); assert.equal(imported.state.area, 'works'); assert.deepEqual(plain(imported.state.player), saved.player);
    assert.equal(imported.state.flags.bossDefeated, true); assert.ok(imported.state.cleared.includes('bailiff')); assert.ok(imported.state.campaign.switches.includes('orren_rescued'));
    assert.deepEqual(plain(imported.state.inventory), plain(saved.inventory)); assert.deepEqual(plain(imported.state.hx), plain(saved.hx)); assert.equal(imported.state.gold, saved.gold);
    fixture(imported, 'works-depth-3'); assert.equal(imported.map().entities.some(e => e.id === 'bailiff'), false);
  }
});
