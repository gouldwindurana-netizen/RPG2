'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const htmlPath = path.resolve(process.env.GAME_HTML || path.join(__dirname, '..', 'The_Road_Beyond_the_Bells.html'));
const html = fs.readFileSync(htmlPath, 'utf8');
const core = html.slice(html.indexOf('var l={schemaVersion'), html.indexOf('var De=new Set'));
const plain = value => JSON.parse(JSON.stringify(value));

function fixture() {
  const context = vm.createContext({ structuredClone });
  vm.runInContext(core, context, { timeout: 3000, filename: htmlPath });
  const saves = new Map();
  const storage = { getItem: key => saves.get(key) ?? null,
    setItem: (key, value) => saves.set(key, String(value)), removeItem: key => saves.delete(key) };
  const game = context.Ee({ storage, seed: 7321, roundDelay: 0 });
  game.beginAdventure({ ...context.R, name: 'Rowan', job: 'warden' });
  game.skipIntro();
  return { context, game, reload: () => context.Ee({ storage, seed: 7321, roundDelay: 0 }) };
}

function battle(game, family = 'WISP', attack = 50, status = null) {
  game.state.message = null;
  game.state.mode = 'battle';
  game.state.battle = { encounterId: 'ward-probe', title: 'Ward probe', kind: 'normal',
    regionId: 'R01', round: 1, phase: 'planning', plans: {}, log: [],
    enemies: [{ id: 'probe', name: 'Probe', hp: 100000, maxHp: 100000, attack,
      defense: 0, family, weakness: [], resistance: [], rank: 'base', status, statusChance: 0 }] };
}

async function incoming(charm, family) {
  const { game } = fixture();
  game.state.inventory[charm] = 4;
  for (const hero of [...game.state.heroes]) assert.equal(game.equip(hero.id, charm), true);
  battle(game, family);
  const before = game.state.heroes.map(hero => hero.hp);
  for (const hero of game.state.heroes) game.plan(hero.id, { type: 'guard', target: hero.id });
  await game.resolveRound();
  return game.state.heroes.reduce((sum, hero, index) => sum + before[index] - hero.hp, 0);
}

test('ward equipment contributes to a derived stat and survives a normal save reload', () => {
  const { context, game, reload } = fixture();
  game.state.inventory.R02_COMMON_CHARM = 4;
  for (const hero of [...game.state.heroes]) game.equip(hero.id, 'R02_COMMON_CHARM');
  const restored = reload();
  assert.equal(restored.state.mode, 'explore');
  for (const hero of restored.state.heroes) {
    const expected = Object.values(hero.equipment).reduce((sum, id) => sum + (context.K(id).stats?.magicDefense ?? 0), 0);
    assert.equal(hero.magicDefense, expected);
    assert.equal(hero.magicDefense, 4);
  }
  assert.deepEqual(plain(restored.state.inventory), plain(game.state.inventory));
  assert.deepEqual(plain(restored.state.hx), plain(game.state.hx));
});

for (const family of ['WISP', 'CANTOR']) {
  test(`stronger wards reduce ${family} magical damage with the same seed and plans`, async () => {
    const starter = await incoming('R01_COMMON_CHARM', family);
    const upgrade = await incoming('R06_COMMON_CHARM', family);
    assert.ok(upgrade > 0, 'a ward is mitigation, not immunity');
    assert.ok(upgrade < starter, `${upgrade} should be below ${starter}`);
  });
}

test('ward-only upgrades leave physical damage unchanged', async () => {
  assert.equal(await incoming('R01_COMMON_CHARM', 'HOUND'), await incoming('R06_COMMON_CHARM', 'HOUND'));
});

for (const item of ['POTION', 'HIGH_POTION', 'MENDING_BALM', 'CAMP_MEAL']) {
  test(`${item} cannot waste a copy on a full-health or fallen field target`, () => {
    const { context, game } = fixture();
    const hero = game.state.heroes[0];
    game.state.inventory[item] = 2;
    assert.equal(context.consumableValid(game.state, item, hero), false);
    assert.equal(game.useItem(item, hero.id), false);
    assert.equal(game.state.inventory[item], 2);
    hero.hp = 0;
    assert.equal(game.useItem(item, hero.id), false);
    assert.equal(game.state.inventory[item], 2);
    hero.hp = 1;
    assert.equal(game.useItem(item, hero.id), true);
    assert.equal(game.state.inventory[item], 1);
    assert.ok(hero.hp > 1 && hero.hp <= hero.maxHp);
  });
}

test('packed meals restore the described 30 percent without restoring MP', () => {
  const { game, reload } = fixture();
  const hero = game.state.heroes[2];
  game.state.inventory.CAMP_MEAL = 1;
  hero.hp = 1;
  hero.mp = 0;
  assert.equal(game.useItem('CAMP_MEAL', hero.id), true);
  assert.equal(hero.hp, 1 + Math.floor(hero.maxHp * .3));
  assert.equal(hero.mp, 0);
  const restored = reload();
  assert.equal(restored.state.heroes[2].hp, hero.hp);
  assert.equal(restored.state.inventory.CAMP_MEAL, 0);
});

for (const [item, amount] of [['SPARK_TEA', 20], ['DEEP_TEA', 60]]) {
  test(`${item} restores its bounded MP amount in the field and battle and persists`, async () => {
    const { context, game, reload } = fixture();
    const index = 2, old = game.state.heroes[index];
    game.state.hx[old.id] = context.l.xp_thresholds[16];
    const hero = game.state.heroes[index] = context.be(old.id, 17, old.equipment, game.state.profile);
    hero.mp = 0;
    game.state.inventory[item] = 4;
    assert.equal(game.useItem(item, hero.id), true);
    assert.equal(game.state.inventory[item], 3);
    assert.equal(hero.mp, Math.min(hero.maxMp, amount));
    const saved = reload();
    assert.equal(saved.state.mode, 'explore');
    assert.equal(saved.state.heroes[index].mp, hero.mp);
    assert.equal(saved.state.inventory[item], 3);
    hero.mp = hero.maxMp;
    assert.equal(game.useItem(item, hero.id), false, 'full MP does not waste a tea');
    hero.mp = hero.maxMp - 1;
    assert.equal(game.useItem(item, hero.id), true);
    assert.equal(hero.mp, hero.maxMp, 'restoration cannot overfill the MP pool');
    assert.equal(game.state.inventory[item], 2);
    hero.hp = 0; hero.mp = 0;
    assert.equal(game.useItem(item, hero.id), false, 'no tea for a fallen hero');
    hero.hp = hero.maxHp;
    assert.equal(game.useItem(item, 'missing'), false);
    battle(game, 'HOUND', 0, 'sleep');
    assert.equal(game.useItem(item, hero.id), false, 'field method cannot bypass battle planning');
    assert.equal(game.plan(hero.id, { type: 'item', itemId: item, target: hero.id }), true);
    assert.equal(hero.mp, 0, 'planning reserves the tea without restoring MP early');
    assert.equal(game.state.inventory[item], 2);
    for (const ally of game.state.heroes) if (ally.id !== hero.id) game.plan(ally.id, { type: 'guard', target: ally.id });
    await game.resolveRound();
    assert.equal(hero.mp, Math.min(hero.maxMp, amount));
    assert.equal(game.state.inventory[item], 1);
  });
}

test('unknown utilities and inapplicable curatives remain intact', () => {
  const { context, game } = fixture();
  const hero = game.state.heroes[0];
  for (const item of ['WARD_SMOKE', 'SURVEY_CHALK', 'ANTIDOTE', 'SOOTHING_DRAUGHT', 'CLEAR_TONIC', 'REVIVAL_SALT']) {
    game.state.inventory[item] = 2;
    assert.equal(context.consumableValid(game.state, item, hero), false);
    assert.equal(game.useItem(item, hero.id), false);
    assert.equal(game.state.inventory[item], 2);
  }
  hero.status = 'poison';
  assert.equal(game.useItem('ANTIDOTE', hero.id), true);
  assert.equal(hero.status, null);
  assert.equal(game.state.inventory.ANTIDOTE, 1);
});

test('full-health battle recovery can be planned, but a redundant heal keeps the item', async () => {
  const { context, game } = fixture();
  battle(game, 'HOUND', 0, 'sleep');
  const hero = game.state.heroes[0];
  const before = game.state.inventory.POTION;
  assert.equal(context.consumableValid(game.state, 'POTION', hero, { battlePlanning: true }), true);
  assert.equal(game.plan(hero.id, { type: 'item', itemId: 'POTION', target: hero.id }), true);
  for (const ally of game.state.heroes.slice(1)) game.plan(ally.id, { type: 'guard', target: ally.id });
  await game.resolveRound();
  assert.equal(hero.hp, hero.maxHp);
  assert.equal(game.state.inventory.POTION, before);
  assert.ok(game.state.battle.log.some(line => line.includes('The item is kept.')));
});

test('two reserved heals spend only one copy if the first finishes the recovery', async () => {
  const { game } = fixture();
  const hero = game.state.heroes[0];
  hero.hp -= 10;
  battle(game, 'HOUND', 0, 'sleep');
  game.state.inventory.POTION = 2;
  assert.equal(game.plan('Mara', { type: 'item', itemId: 'POTION', target: hero.id }), true);
  assert.equal(game.plan('Iona', { type: 'item', itemId: 'POTION', target: hero.id }), true);
  for (const id of ['Tavin', 'Soren']) game.plan(id, { type: 'guard', target: id });
  await game.resolveRound();
  assert.equal(hero.hp, hero.maxHp);
  assert.equal(game.state.inventory.POTION, 1);
});
