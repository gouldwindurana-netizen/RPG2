'use strict';

// Execute the shipped engine and authored travel records. The declared late-road
// fixture isolates travel gates; it is not an earned campaign playthrough.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(process.env.GAME_HTML || path.join(root, 'The_Road_Beyond_the_Bells.html'), 'utf8');
const baseline = fs.readFileSync(path.join(root, 'entrances-baseline.html'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const directions = [['up', 0, -1], ['right', 1, 0], ['down', 0, 1], ['left', -1, 0]];

function context(source = html) {
  const c = vm.createContext({ structuredClone });
  vm.runInContext(source.slice(source.indexOf('var l={schemaVersion'), source.indexOf('var De=new Set')), c, { timeout: 5000 });
  return c;
}
function setup(source = html) {
  const c = context(source), saves = new Map();
  const storage = { getItem: key => saves.get(key) ?? null, setItem: (key, value) => saves.set(key, String(value)) };
  const game = c.Ee({ storage, seed: 7321, roundDelay: 0 });
  game.beginAdventure({ ...c.R, name: 'Rowan' }); game.skipIntro();
  game.configure({ encounters: 'classic', npcMovement: 'still' });
  return { c, game, saves, storage, reload: () => c.Ee({ storage, seed: 7321, roundDelay: 0 }) };
}
function dismiss(game) { for (let count = 0; game.state.message && count < 50; count++) game.dismiss(); assert.equal(game.state.message, null); }
function resources(game) {
  return plain(Object.fromEntries(['gold', 'xp', 'hx', 'heroes', 'inventory', 'campaign', 'flags', 'learnedSpells', 'partyJobs', 'difficulty', 'sp', 'gr', 'seen', 'wayfarer', 'setAcquired', 'overworldReturn'].map(key => [key, game.state[key]])));
}
function place(game, area, point, facing = 'up') {
  dismiss(game); game.state.area = area; game.state.player = { x: point.x, y: point.y, facing }; game.state.mode = 'explore';
}
function route(c, game, target, allowTargetEntity = true) {
  const map = game.map(), start = game.state.player, visited = new Set([`${start.x},${start.y}`]);
  const queue = [{ x: start.x, y: start.y, path: [] }];
  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
    if (current.x === target.x && current.y === target.y) return current.path;
    for (const [name, dx, dy] of directions) {
      const x = current.x + dx, y = current.y + dy, key = `${x},${y}`;
      if (visited.has(key) || !c.q.includes(map.tiles[y]?.[x])) continue;
      if (map.entities.some(entity => entity.x === x && entity.y === y && !(allowTargetEntity && x === target.x && y === target.y))) continue;
      visited.add(key); queue.push({ x, y, path: [...current.path, name] });
    }
  }
  assert.fail(`No real path in ${map.area} from ${start.x},${start.y} to ${target.x},${target.y}`);
}
function walk(c, game, target, allowTargetEntity = true) { for (const direction of route(c, game, target, allowTargetEntity)) game.move(direction); }
function enter(fix, entry) {
  place(fix.game, entry.parent, entry.approach);
  fix.game.move('up');
  assert.equal(fix.game.state.area, entry.area);
  assert.deepEqual(plain({ x: fix.game.state.player.x, y: fix.game.state.player.y }), plain(entry.entry));
  assert.equal(fix.game.state.battle, null);
}
function leave(fix, entry) {
  dismiss(fix.game);
  const exit = fix.game.map().entities.find(entity => entity.id === entry.exitId);
  walk(fix.c, fix.game, exit);
  assert.equal(fix.game.state.area, entry.parent);
  assert.deepEqual(plain(fix.game.state.player), { ...plain(entry.approach), facing: 'down' });
}
function saved(fix) { assert.equal(fix.game.save(), true); return fix.saves.get(fix.c.G); }

test('all buildings have real paired thresholds, with centered Reedbank facades', () => {
  const c = context(), old = context(baseline);
  assert.equal(c.buildingEntrances.length, 14);
  assert.equal(c.settlementShopRecords.length, 12);
  assert.equal(c.buildingEntrances.filter(entry => entry.parent === 'camp').length, 4);
  for (const entry of c.buildingEntrances) {
    const outer = c.he[entry.parent], inside = c.he[entry.area];
    const door = outer.entities.find(entity => entity.id === entry.doorId);
    const exit = inside.entities.find(entity => entity.id === entry.exitId);
    assert.ok(door && exit);
    assert.equal(entry.door.y, entry.bounds.bottom);
    assert.ok(entry.door.x >= entry.bounds.left && entry.door.x <= entry.bounds.right);
    if (entry.parent === 'camp') assert.equal(entry.door.x, (entry.bounds.left + entry.bounds.right) / 2);
    assert.deepEqual(plain(entry.approach), { x: entry.door.x, y: entry.door.y + 1 });
    assert.ok(c.q.includes(outer.tiles[entry.door.y][entry.door.x]));
    assert.ok(c.q.includes(outer.tiles[entry.approach.y][entry.approach.x]));
    assert.equal(inside.safe, true); assert.equal(c.M(entry.area, entry.entry.x, entry.entry.y), entry.region);
    assert.deepEqual(plain(c.g[entry.exitId]), { area: entry.parent, ...plain(entry.approach), facing: 'down' });
    if (entry.kind !== 'shelter') {
      const previous = old.settlementShopRecords.find(record => record.merchantId === entry.merchantId);
      assert.ok(previous); assert.equal(entry.area, previous.area); assert.equal(entry.region, previous.region);
      assert.equal(entry.door.y, previous.door.y - 1);
      assert.equal(Object.values(c.he).flatMap(map => map.entities).filter(entity => entity.id === entry.merchantId).length, 1);
      assert.ok(inside.entities.some(entity => entity.id === entry.merchantId && entity.shopKind === entry.kind));
    }
  }
});

test('all four starting buildings are reached by real paths from the watchfire and return to their own approaches', () => {
  const fix = setup(), buildings = fix.c.buildingEntrances.filter(entry => entry.parent === 'camp');
  for (const entry of buildings) {
    place(fix.game, 'camp', { x: 11, y: 10 });
    const before = resources(fix.game), rng = fix.game.state.rng;
    walk(fix.c, fix.game, entry.door);
    assert.equal(fix.game.state.area, entry.area);
    assert.equal(fix.game.state.mode, 'explore');
    assert.equal(fix.game.state.rng, rng);
    leave(fix, entry);
    assert.deepEqual(resources(fix.game), before);
  }
});

test('all starting building approaches connect to the town streets without grass gaps', () => {
  const c = context(), map = c.he.camp;
  for (const entry of c.buildingEntrances.filter(entry => entry.parent === 'camp')) {
    const pending = [entry.approach], seen = new Set();
    while (pending.length) {
      const point = pending.pop(), key = `${point.x},${point.y}`;
      if (seen.has(key) || !'dsb'.includes(map.tiles[point.y]?.[point.x] ?? '?')) continue;
      seen.add(key);
      for (const [, dx, dy] of directions) pending.push({ x: point.x + dx, y: point.y + dy });
    }
    assert.ok(seen.has('12,10'), `${entry.name} has a continuous path to the square`);
  }
});

test('every relocated shop can be walked through, used at its original keeper, and exited without changing travel resources', () => {
  const fix = setup();
  for (const entry of fix.c.buildingEntrances.filter(entry => entry.kind !== 'shelter')) {
    fix.game.state.area = entry.parent; fix.c.depthVisit(fix.game.state);
    const before = resources(fix.game), rng = fix.game.state.rng;
    enter(fix, entry);
    const keeper = fix.game.map().entities.find(entity => entity.id === entry.merchantId);
    walk(fix.c, fix.game, { x: keeper.x, y: keeper.y + 1 }, false);
    fix.game.interact(keeper.id);
    assert.equal(fix.game.state.message?.speaker, entry.kind === 'magic' ? 'Skill Shop' : 'Weapon Shop');
    dismiss(fix.game); leave(fix, entry);
    assert.equal(fix.game.state.rng, rng);
    assert.deepEqual(resources(fix.game), before);
  }
});

test('Reedbank boardwalk and the six town western exits share a safe outward/inward travel rule', () => {
  const fix = setup(), old = context(baseline);
  fix.game.state.campaign.stage = 9;
  fix.game.state.campaign.switches = plain(fix.c.h).filter(id => id !== 'ending_seen');
  fix.game.state.flags.briefed = true; fix.game.state.flags.completed = false;
  for (let x = 0; x <= 8; x++) assert.equal(fix.c.he.camp.tiles[14][x], 'b');
  assert.equal(fix.c.he.camp.entities.some(entity => entity.kind === 'exit' && entity.x === 28 && entity.y === 14), false);
  for (const town of ['camp', 'dunmere', 'fen', 'orchard', 'crown', 'veyr']) {
    const site = fix.c.k.find(site => site.area === town), exit = fix.c.he[town].entities.find(entity => entity.id === `world-${town}`);
    assert.deepEqual(plain({ x: exit.x, y: exit.y }), { x: 2, y: 14 });
    assert.deepEqual(plain(fix.c.g[`enter-${town}`]), { ...plain(old.g[`enter-${town}`]), x: 3, y: 14, facing: 'right' });
    assert.deepEqual(plain(fix.c.g[exit.id]), plain(old.g[exit.id]), 'the overworld site approach is preserved');
    const outside = { x: site.x, y: site.y + 1 };
    place(fix.game, 'overworld', outside);
    fix.game.state.overworldReturn = { ...outside };
    const before = resources(fix.game), rng = fix.game.state.rng;
    fix.game.state.encounterSteps = 17; fix.game.move('up');
    assert.equal(fix.game.state.area, town);
    assert.deepEqual(plain(fix.game.state.player), { x: 3, y: 14, facing: 'right' });
    assert.equal(fix.game.state.encounterSteps, 0); assert.equal(fix.game.state.rng, rng);
    fix.game.move('left');
    assert.equal(fix.game.state.area, 'overworld');
    assert.deepEqual(plain({ x: fix.game.state.player.x, y: fix.game.state.player.y }), outside);
    assert.equal(fix.game.state.encounterSteps, 0); assert.equal(fix.game.state.rng, rng);
    assert.deepEqual(resources(fix.game), before);
  }
  assert.equal(fix.c.k.length, 10);
  assert.deepEqual(plain(fix.c.k), plain(old.k));
  assert.equal(fix.c.g['road-dunmere'].minStage, old.g['road-dunmere'].minStage);
  for (const key of Object.keys(old.g).filter(key => /^(road|pass|ferry|gate)-/.test(key))) assert.deepEqual(plain(fix.c.g[key]), plain(old.g[key]), key);
});

test('the two new residents provide repeatable conversations without rewards, progression, or recovery', () => {
  const fix = setup();
  for (const entry of fix.c.buildingEntrances.filter(entry => entry.kind === 'shelter')) {
    enter(fix, entry);
    for (const hero of fix.game.state.heroes) { hero.hp = Math.max(1, hero.maxHp - 13); hero.mp = 0; hero.status = 'poison'; }
    const resident = fix.game.map().entities.find(entity => entity.id === entry.residentId);
    walk(fix.c, fix.game, { x: resident.x, y: resident.y + 1 }, false);
    const before = resources(fix.game), checkpoint = plain(fix.game.state.safeReturn);
    for (let count = 0; count < 3; count++) {
      fix.game.interact(resident.id);
      assert.equal(fix.game.state.message?.speaker, entry.residentName);
      assert.equal(fix.game.state.reward, null);
      dismiss(fix.game);
      fix.game.rest();
      assert.equal(fix.game.state.message, null);
      assert.deepEqual(resources(fix.game), before);
      assert.deepEqual(plain(fix.game.state.safeReturn), checkpoint);
    }
    assert.match(fix.c.buildingInteriorObjective(fix.game.state)[1], /south door.*Reedbank/);
    leave(fix, entry);
  }
});

test('genuine prior saves on exactly the eight newly blocked wall cells relocate only the player and checkpoint', () => {
  const current = context(), expected = [
    [11, 4, 10, 6], [11, 5, 10, 6], [22, 4, 23, 6], [22, 5, 23, 6],
    [17, 4, 18, 6], [17, 5, 18, 6], [18, 14, 17, 16], [18, 15, 17, 16],
  ];
  assert.deepEqual(plain(current.entranceLegacyCells.map(cell => [cell.x, cell.y, cell.to.x, cell.to.y]).sort()), expected.sort());
  for (const [x, y, toX, toY] of expected) {
    const legacy = setup(baseline);
    assert.ok(legacy.c.q.includes(legacy.c.he.camp.tiles[y][x]));
    legacy.game.state.player = { x, y, facing: 'left' };
    legacy.game.state.safeReturn = { area: 'camp', x, y };
    legacy.game.state.gold = 733; legacy.game.state.inventory.POTION = 7;
    legacy.game.state.heroes[0].hp -= 13; legacy.game.state.heroes[0].mp = 2; legacy.game.state.heroes[0].status = 'poison';
    const before = resources(legacy.game), raw = saved(legacy);
    const restored = current.Ee({ storage: { getItem: () => raw, setItem: () => {} }, seed: 7321, roundDelay: 0 });
    assert.equal(restored.state.mode, 'explore'); assert.equal(restored.state.area, 'camp');
    assert.deepEqual(plain(restored.state.player), { x: toX, y: toY, facing: 'left' });
    assert.deepEqual(plain(restored.state.safeReturn), { area: 'camp', x: toX, y: toY });
    assert.deepEqual(resources(restored), before);
  }
});

test('old eastern arrivals, old shop approaches and unrelated invalid-save rejection remain unchanged', () => {
  const c = context();
  for (const [x, y] of [[27, 14], [28, 14], [10, 7], [23, 7], [11, 10]]) {
    const legacy = setup(baseline); legacy.game.state.player = { x, y, facing: 'up' }; legacy.game.state.safeReturn = { area: 'camp', x: 27, y: 14 };
    const raw = saved(legacy), restored = c.we(raw, 7321);
    assert.ok(restored); assert.deepEqual(plain(restored.player), { x, y, facing: 'up' });
    assert.deepEqual(plain(restored.safeReturn), { area: 'camp', x: 27, y: 14 });
  }
  const legacy = setup(baseline), value = JSON.parse(saved(legacy));
  for (const corrupt of [state => { state.player = { x: 1, y: 5, facing: 'up' }; }, state => { state.area = 'missing-area'; }, state => { state.inventory.UNKNOWN_ITEM = 1; }, state => { state.version = 999; }]) {
    const copy = plain(value); corrupt(copy); assert.equal(c.we(JSON.stringify(copy), 7321), null);
  }
});

test('known-cell recovery is scoped separately to the camp player and camp checkpoint', () => {
  const c = context();
  const town = setup(baseline);
  town.game.state.area = 'dunmere'; town.game.state.player = { x: 11, y: 4, facing: 'down' };
  town.game.state.safeReturn = { area: 'camp', x: 11, y: 4 };
  const restored = c.we(saved(town), 7321);
  assert.ok(restored);
  assert.deepEqual(plain(restored.player), { x: 11, y: 4, facing: 'down' });
  assert.deepEqual(plain(restored.safeReturn), { area: 'camp', x: 10, y: 6 });
  const camp = setup(baseline);
  camp.game.state.player = { x: 11, y: 4, facing: 'right' };
  camp.game.state.safeReturn = { area: 'dunmere', x: 11, y: 4 };
  const separate = c.we(saved(camp), 7321);
  assert.ok(separate);
  assert.deepEqual(plain(separate.player), { x: 10, y: 6, facing: 'right' });
  assert.deepEqual(plain(separate.safeReturn), { area: 'dunmere', x: 11, y: 4 });
});

test('all fourteen new and existing interiors save and reload at safe, usable room positions', () => {
  const fix = setup();
  for (const entry of fix.c.buildingEntrances) {
    enter(fix, entry);
    const before = resources(fix.game), point = plain(fix.game.state.player);
    saved(fix); const restored = fix.reload();
    assert.equal(restored.state.area, entry.area); assert.equal(restored.state.mode, 'explore');
    assert.deepEqual(plain(restored.state.player), point); assert.deepEqual(resources(restored), before);
    const exit = restored.map().entities.find(entity => entity.id === entry.exitId);
    walk(fix.c, restored, exit); assert.equal(restored.state.area, entry.parent);
  }
});

test('the painted opening is contained in, and clicks into, the authored threshold cell', () => {
  const c = context();
  const start = html.indexOf('function entranceOpeningGeometry('), end = html.indexOf('function entranceViewport(', start);
  assert.ok(start >= 0 && end > start);
  vm.runInContext(html.slice(start, end), c);
  for (const entry of c.buildingEntrances) {
    const opening = c.entranceOpeningGeometry(entry, 9, 18);
    assert.ok(opening.x >= 9 + entry.door.x * 30);
    assert.ok(opening.y >= 18 + entry.door.y * 30);
    assert.ok(opening.x + opening.w <= 9 + (entry.door.x + 1) * 30);
    assert.ok(opening.y + opening.h <= 18 + (entry.door.y + 1) * 30);
    assert.equal(Math.floor((opening.x + opening.w / 2 - 9) / 30), entry.door.x);
    assert.equal(Math.floor((opening.y + opening.h / 2 - 18) / 30), entry.door.y);
  }
});

test('entrance corrections do not change item, skill, enemy, progression, or story-switch catalogues', () => {
  const c = context(), old = context(baseline);
  for (const name of ['l', 'd', 'ee', 'te', 'h']) assert.deepEqual(plain(c[name]), plain(old[name]), name);
});
