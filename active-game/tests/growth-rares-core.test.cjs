'use strict';

// Explicit region, seed and reward fixtures isolate repeatable rare selection,
// drop accounting and save migration; they do not claim a campaign playthrough.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(process.env.GAME_HTML || path.join(root, 'The_Road_Beyond_the_Bells.html'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
function context(source = html) {
  const c = vm.createContext({ structuredClone });
  vm.runInContext(source.slice(source.indexOf('var l={schemaVersion'), source.indexOf('var De=new Set')), c, { timeout: 5000 });
  return c;
}
function setup(source = html) {
  const c = context(source), saves = new Map();
  const storage = { getItem: key => saves.get(key) ?? null, setItem: (key, value) => saves.set(key, String(value)) };
  const game = c.Ee({ storage, seed: 7321, roundDelay: 0 });
  game.beginAdventure({ ...c.R, name: 'Rowan', job: 'warden' });
  game.skipIntro(); game.configure({ encounters: 'visible' });
  return { c, game, storage, reload: () => c.Ee({ storage, seed: 7321, roundDelay: 0 }) };
}
function dismiss(game) { while (game.state.message) game.dismiss(); }
function danger(fix, region) {
  const found = Object.entries(fix.c.he).flatMap(([area, map]) => map.entities.map(entity => ({ area, entity })))
    .find(({ area, entity }) => entity.kind === 'enemy' && fix.c.M(area, entity.x, entity.y) === region && !fix.c.p(area, entity.x, entity.y));
  assert.ok(found, `${region} has a dangerous authored patrol`);
  fix.game.state.area = found.area;
  fix.game.state.player = { x: found.entity.x, y: found.entity.y, facing: 'right' };
  dismiss(fix.game);
  return found.entity.id;
}
function rare(fix, region) {
  const id = danger(fix, region);
  fix.game.state.rng = 1; // First actual seeded draw is below5%.
  fix.game.interact(id);
  assert.equal(fix.game.state.mode, 'battle');
  assert.equal(fix.game.state.battle.kind, 'rare');
  assert.equal(fix.game.state.battle.encounterId, `${region}_RARE`);
  return id;
}
async function award(fix) {
  for (const enemy of fix.game.state.battle.enemies) enemy.hp = 0;
  for (const hero of fix.game.state.heroes) if (hero.hp > 0 && hero.status !== 'sleep') {
    assert.equal(fix.game.plan(hero.id, { type: 'guard', target: hero.id }), true);
  }
  await fix.game.resolveRound();
  assert.equal(fix.game.state.mode, 'victory');
}

test('each region selects its own fixed rare at5% without mission, cleared-rare or hunt-readiness gates', () => {
  const fix = setup();
  assert.equal(fix.c.regionalRareRate, .05);
  for (const region of fix.c.oe) {
    const id = danger(fix, region), catalog = fix.c.d.rares.find(enemy => enemy.region_id === region);
    for (const stage of [0, 10]) {
      fix.game.state.campaign.stage = stage;
      fix.game.state.hunts[region] = { ready: false, wins: 0 };
      fix.game.state.cleared.push(catalog.id);
      assert.equal(fix.c.regionalRareFor(fix.game.state, id, () => .049999).id, catalog.id);
      assert.equal(fix.c.regionalRareFor(fix.game.state, id, () => .05), null);
      assert.equal(fix.c.regionalRareFor(fix.game.state, id, () => .99), null);
    }
  }
});

test('safe towns, encounter-off, bosses and direct rare IDs never take a regional rare roll', () => {
  const fix = setup();
  let calls = 0;
  const roll = () => { calls++; return 0; };
  for (const area of ['camp', 'dunmere', 'fen', 'veyr']) {
    fix.game.state.area = area; fix.game.state.player = { x: 11, y: 10 };
    assert.equal(fix.c.regionalRareFor(fix.game.state, 'wild:R01:1', roll), null);
  }
  const id = danger(fix, 'R01');
  for (const forced of ['bailiff', 'B_R01_BAILIFF', 'R01_RARE', 'silver']) assert.equal(fix.c.regionalRareFor(fix.game.state, forced, roll), null);
  fix.game.state.settings.encounters = 'off';
  assert.equal(fix.c.regionalRareFor(fix.game.state, id, roll), null);
  assert.equal(calls, 0, 'ineligible interactions do not spend seeded random draws');
});

test('the regional roll keeps its exact5% budget and does not scale the rare with hero level', () => {
  const fix = setup(), id = danger(fix, 'R03');
  const low = plain(fix.c.regionalRareFor(fix.game.state, id, () => 0));
  fix.game.state.heroes.forEach(hero => { hero.level = 50; });
  assert.deepEqual(plain(fix.c.regionalRareFor(fix.game.state, id, () => 0)), low);
  let count = 0;
  for (let i = 0; i < 10000; i++) if (fix.c.regionalRareFor(fix.game.state, id, () => (i + .5) / 10000)) count++;
  assert.equal(count, 500);
});

test('playable maps never show the old post-mission stationary rare even for old ready saves', () => {
  const fix = setup();
  for (const region of fix.c.oe) fix.game.state.hunts[region] = { ready: true, wins: 12 };
  fix.game.state.rareReady = true;
  for (const area of Object.keys(fix.c.he)) {
    fix.game.state.area = area;
    assert.ok(fix.game.map().entities.every(entity => entity.kind !== 'rare'), area);
  }
});

test('each region gives all three missing set pieces before balanced extra copies, without changing worn gear', () => {
  const fix = setup(), beforeGear = plain(fix.game.state.heroes.map(hero => hero.equipment));
  for (const region of fix.c.oe) {
    const drops = [0, .99999, .4].map(value => fix.c.regionalRareDrop(fix.game.state, region, () => value));
    assert.equal(new Set(drops.map(item => item.id)).size, 3);
    assert.ok(drops.every(item => item.region_id === region && item.set_id && item.unique_per_save === false));
    const summary = fix.c.regionalRareSummary(fix.game.state, region);
    assert.equal(summary.discovered, 3); assert.equal(summary.complete, true);
    for (let i = 0; i < 3; i++) fix.c.regionalRareDrop(fix.game.state, region, () => .99999);
    assert.ok(fix.c.regionalSetPieces(region).every(item => fix.game.state.inventory[item.id] === 2));
  }
  assert.equal(new Set(fix.game.state.setAcquired).size, 18);
  assert.deepEqual(plain(fix.game.state.heroes.map(hero => hero.equipment)), beforeGear);
});

test('only regional set uniqueness metadata changes; other equipment rules and uploaded stats remain', () => {
  const fix = setup(), original = context(fs.readFileSync(path.join(root, 'growth-baseline.html'), 'utf8'));
  const changed = fix.c.ee.filter(item => item.unique_per_save !== original.K(item.id)?.unique_per_save);
  assert.equal(changed.length, 18);
  assert.ok(changed.every(item => item.set_id && fix.c.oe.includes(item.region_id)));
  for (const item of fix.c.ee) assert.deepEqual(plain(item.stats ?? {}), plain(original.K(item.id).stats ?? {}), item.id);
});

test('real rare victories award exactly one region piece, remain repeatable, and cannot pay twice', async () => {
  for (const region of ['R01', 'R02', 'R03', 'R04', 'R05', 'R06']) {
    const fix = setup(), originalCleared = plain(fix.game.state.cleared);
    for (let wins = 1; wins <= 4; wins++) {
      const patrolId = rare(fix, region);
      await award(fix);
      assert.equal(fix.game.state.reward.source, 'rare');
      assert.equal(fix.game.state.reward.choices.length, 0);
      const total = fix.c.regionalSetPieces(region).reduce((sum, item) => sum + (fix.game.state.inventory[item.id] ?? 0), 0);
      assert.equal(total, wins);
      const before = plain({ inventory: fix.game.state.inventory, gold: fix.game.state.gold, hx: fix.game.state.hx });
      await fix.game.resolveRound();
      assert.deepEqual(plain({ inventory: fix.game.state.inventory, gold: fix.game.state.gold, hx: fix.game.state.hx }), before);
      fix.game.continue(); dismiss(fix.game);
      assert.ok(fix.game.map().entities.some(entity => entity.id === patrolId));
      assert.deepEqual(plain(fix.game.state.cleared), originalCleared);
    }
    assert.equal(fix.game.state.setAcquired.length, 3);
    const loaded = fix.reload();
    assert.equal(loaded.state.mode, 'explore');
    assert.deepEqual(plain(loaded.state.inventory), plain(fix.game.state.inventory));
    assert.deepEqual(plain(loaded.state.setAcquired), plain(fix.game.state.setAcquired));
  }
});

test('fleeing and losing a regional rare grant no equipment or progress', async () => {
  for (const action of ['flee', 'defeat']) {
    const fix = setup(); rare(fix, 'R01');
    const before = plain({ inventory: fix.game.state.inventory, gold: fix.game.state.gold, hx: fix.game.state.hx, setAcquired: fix.game.state.setAcquired });
    if (action === 'flee') { await fix.game.flee(); assert.equal(fix.game.state.mode, 'explore'); }
    else {
      fix.game.state.heroes.forEach(hero => { hero.hp = 0; });
      await fix.game.resolveRound(); assert.equal(fix.game.state.mode, 'defeat');
    }
    assert.deepEqual(plain({ inventory: fix.game.state.inventory, gold: fix.game.state.gold, hx: fix.game.state.hx, setAcquired: fix.game.state.setAcquired }), before);
  }
});

test('four region-set copies equip four travelers and survive save/reload with ownership enforced', () => {
  const fix = setup(), id = 'R01_SET_HEAD';
  fix.game.state.inventory[id] = 4; fix.game.state.setAcquired.push(id);
  for (const hero of fix.game.state.heroes) assert.equal(fix.game.equip(hero.id, id), true);
  assert.equal(fix.c.eqUsed(fix.game.state, id), 4);
  assert.equal(fix.c.eqAvailable(fix.game.state, id), 0);
  const loaded = fix.reload();
  assert.equal(loaded.state.mode, 'explore');
  assert.ok(loaded.state.heroes.every(hero => hero.equipment.head === id));
  assert.equal(loaded.state.inventory[id], 4);
  const bad = JSON.parse(fix.storage.getItem(fix.c.G));
  bad.inventory[id] = 3;
  assert.equal(fix.c.we(JSON.stringify(bad), 7321), null, 'four wearers cannot share three copies');
});

test('legacy ready-hunt saves retain progress and owned equipment while rare selection ignores readiness', () => {
  const previous = setup(fs.readFileSync(path.join(root, 'growth-previous.html'), 'utf8'));
  previous.game.state.inventory.R01_SET_HEAD = 1;
  previous.game.state.setAcquired.push('R01_SET_HEAD');
  previous.game.state.gold = 733;
  previous.game.state.hunts.R01 = { ready: true, wins: 12 };
  previous.game.state.rareReady = true; previous.game.state.tracks = 12;
  previous.game.state.cleared.push('silver');
  assert.equal(previous.game.save(), true);
  const c = context(), game = c.Ee({ storage: previous.storage, seed: 7321, roundDelay: 0 });
  assert.equal(game.state.mode, 'explore');
  assert.equal(game.state.gold, 733); assert.equal(game.state.inventory.R01_SET_HEAD, 1);
  assert.deepEqual(plain(game.state.hunts.R01), { ready: true, wins: 12 });
  assert.ok(game.map().entities.every(entity => entity.kind !== 'rare'));
  const id = danger({ c, game }, 'R01');
  assert.equal(c.regionalRareFor(game.state, id, () => 0).id, 'R01_RARE');
});

test('full regional stacks cannot exceed99 and actual victory uses explicit fallback supplies', async () => {
  const fix = setup();
  for (const item of fix.c.regionalSetPieces('R01')) {
    fix.game.state.inventory[item.id] = 99; fix.game.state.setAcquired.push(item.id);
  }
  const before = fix.game.state.inventory.HIGH_POTION ?? 0;
  assert.equal(fix.c.regionalRareDrop(fix.game.state, 'R01', () => 0), null);
  rare(fix, 'R01'); await award(fix);
  assert.equal(fix.game.state.inventory.HIGH_POTION, before + 1);
  assert.ok(fix.game.state.reward.lines.some(line => line.includes('99 each') && line.includes('instead')));
  assert.ok(fix.c.regionalSetPieces('R01').every(item => fix.game.state.inventory[item.id] === 99));
});
