'use strict';

// Exercise the shipped standalone bundle, including its existing save/mod data.
// Set GAME_HTML to another HTML path to compare a previous standalone build.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const htmlPath = process.env.GAME_HTML
  ? path.resolve(process.env.GAME_HTML)
  : path.resolve(__dirname, '..', 'The_Road_Beyond_the_Bells.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const coreStart = html.indexOf('var l={schemaVersion');
const coreEnd = html.indexOf('var De=new Set', coreStart);
assert.ok(coreStart >= 0 && coreEnd > coreStart, 'standalone engine boundaries exist');
const core = html.slice(coreStart, coreEnd);

const plain = value => JSON.parse(JSON.stringify(value));

function createGame(job = 'warden') {
  const context = vm.createContext({ structuredClone });
  vm.runInContext(core, context, { timeout: 3000, filename: htmlPath });
  const saved = new Map();
  const storage = {
    getItem: key => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, String(value)),
    removeItem: key => saved.delete(key),
  };
  const game = context.Ee({ storage, seed: 7321 });
  assert.equal(game.beginAdventure({ ...context.R, name: 'Rowan', job }), true);
  game.skipIntro();
  assert.equal(game.state.mode, 'explore');
  return {
    context,
    game,
    storage,
    serialized: () => storage.getItem(context.G),
    reload: () => context.Ee({ storage, seed: 7321 }),
  };
}

const slotCases = [
  { slot: 'weapon', id: 'R02_TAVIN_WEAPON', job: 'striker', eligible: ['Mara', 'Tavin'] },
  { slot: 'body', id: 'R02_TAVIN_BODY', job: 'striker', eligible: ['Mara', 'Tavin'] },
  { slot: 'head', id: 'R02_COMMON_HEAD', job: 'warden', eligible: ['Mara', 'Tavin', 'Iona', 'Soren'] },
  { slot: 'mantle', id: 'R02_COMMON_MANTLE', job: 'warden', eligible: ['Mara', 'Tavin', 'Iona', 'Soren'] },
  { slot: 'charm', id: 'R02_COMMON_CHARM', job: 'warden', eligible: ['Mara', 'Tavin', 'Iona', 'Soren'] },
];

function wearers(game, slot, id) {
  return plain(game.state.heroes.filter(hero => hero.equipment[slot] === id).map(hero => hero.id));
}

for (const fixture of slotCases) {
  test(`${fixture.slot}: four owned copies equip independently and survive reload`, () => {
    const { game, context, reload } = createGame(fixture.job);
    const xpByHero = { Mara: 12, Tavin: 52, Iona: 130, Soren: 256 };
    game.state.hx = { ...xpByHero };
    game.state.xp = 777;
    game.state.settings = { battleSpeed: 3, encounters: 'off' };
    game.state.inventory[fixture.id] = 4;
    const inventoryBefore = plain(game.state.inventory);
    const eligible = game.state.heroes
      .filter(hero => context.U(hero, context.K(fixture.id)))
      .map(hero => hero.id);
    assert.deepEqual(plain(eligible), fixture.eligible);

    for (const heroId of fixture.eligible) {
      assert.equal(game.equip(heroId, fixture.id), true, `${heroId} can use its own copy`);
      assert.equal(game.state.inventory[fixture.id], 4, 'equipping retains total ownership');
    }
    assert.deepEqual(wearers(game, fixture.slot, fixture.id), fixture.eligible);
    assert.deepEqual(plain(game.state.inventory), inventoryBefore);
    assert.equal(game.save(), true);

    const restored = reload();
    assert.equal(restored.state.mode, 'explore', 'save must validate instead of resetting the journey');
    assert.deepEqual(wearers(restored, fixture.slot, fixture.id), fixture.eligible);
    assert.deepEqual(plain(restored.state.inventory), inventoryBefore);
    assert.deepEqual(plain(restored.state.hx), xpByHero, 'per-hero EXP mod is preserved');
    assert.equal(restored.state.xp, 777);
    assert.deepEqual(plain(restored.state.settings), { battleSpeed: 3, encounters: 'off' });
    assert.equal(restored.state.profile.name, 'Rowan');
    assert.equal(restored.state.profile.job, fixture.job);
    assert.deepEqual(plain(restored.state.heroes.map(hero => hero.level)), [2, 3, 4, 5]);
  });

  test(`${fixture.slot}: exhaustion blocks phantom copies and replacement releases one`, () => {
    const { game } = createGame(fixture.job);
    const [first, second] = fixture.eligible;
    const starter = game.state.heroes.find(hero => hero.id === first).equipment[fixture.slot];
    game.state.inventory[fixture.id] = 0;
    assert.equal(game.equip(first, fixture.id), false, 'unowned item is unavailable');
    game.state.inventory[fixture.id] = 1;
    assert.equal(game.equip(first, fixture.id), true);
    assert.equal(game.equip(second, fixture.id), false, 'one owned copy cannot outfit two heroes');
    assert.equal(game.state.inventory[fixture.id], 1);
    assert.deepEqual(wearers(game, fixture.slot, fixture.id), [first]);
    assert.equal(game.equip(first, starter), true, 'return to the still-owned starter item');
    assert.equal(game.equip(second, fixture.id), true, 'released copy becomes available');
    assert.deepEqual(wearers(game, fixture.slot, fixture.id), [second]);
    assert.equal(game.state.inventory[fixture.id], 1);
  });

  test(`${fixture.slot}: selling removes only unused copies`, () => {
    const { game } = createGame(fixture.job);
    const [first, second] = fixture.eligible;
    const starter = game.state.heroes.find(hero => hero.id === first).equipment[fixture.slot];
    game.state.inventory[fixture.id] = 2;
    assert.equal(game.equip(first, fixture.id), true);
    assert.equal(game.equip(second, fixture.id), true);
    const originalGold = game.state.gold;
    assert.equal(game.sell(fixture.id), false, 'equipped copies cannot be sold');
    assert.equal(game.state.gold, originalGold);
    assert.equal(game.equip(first, starter), true);
    assert.equal(game.sell(fixture.id), true, 'released copy can be sold');
    assert.equal(game.state.inventory[fixture.id], 1);
    assert.ok(game.state.gold > originalGold);
    assert.deepEqual(wearers(game, fixture.slot, fixture.id), [second]);
    assert.equal(game.sell(fixture.id), false, 'last equipped copy stays owned');
  });

  test(`${fixture.slot}: equipment UI explains owned, equipped, and available copies`, () => {
    const { game, context } = createGame(fixture.job);
    const [first, second] = fixture.eligible;
    context.Q = String; // The outer page's text escaper; fixture names contain no markup.
    context.eqS = fixture.slot;
    game.state.inventory[fixture.id] = 4;
    assert.equal(game.equip(first, fixture.id), true);
    const hero = game.state.heroes.find(candidate => candidate.id === second);
    const markup = context.eqUI(game.state, hero, [context.K(fixture.id)], second);
    assert.ok(markup.includes('Owned 4'));
    assert.ok(markup.includes('Equipped 1'));
    assert.ok(markup.includes('Available 3'));
    const button = markup.match(new RegExp(`<button class="small-button" data-equip="${fixture.id}"([^>]*)>([^<]*)</button>`));
    assert.ok(button);
    assert.equal(button[1].includes('disabled'), false, 'another owned copy has an enabled Equip button');
    assert.equal(button[2], 'Equip');
  });
}

test('actual regional shop buys four copies without confusing equipped and owned counts', () => {
  const { game, context, reload } = createGame();
  const destination = context.g['enter-dunmere'];
  game.state.area = destination.area;
  game.state.player = { x: destination.x, y: destination.y, facing: 'down' };
  game.state.gold = 100000;
  const itemId = 'R02_COMMON_HEAD';
  const offer = context.fe(game.state).find(item => item.itemId === itemId);
  assert.ok(offer, 'the regional shop actually offers the item');
  assert.equal(game.state.inventory[itemId] ?? 0, 0);
  assert.equal(game.buy(itemId, 4), 4);
  assert.equal(game.state.inventory[itemId], 4);
  assert.equal(game.state.gold, 100000 - 4 * offer.price);
  for (const hero of game.state.heroes) assert.equal(game.equip(hero.id, itemId), true);
  assert.equal(game.state.inventory[itemId], 4);
  const restored = reload();
  assert.equal(restored.state.mode, 'explore');
  assert.deepEqual(wearers(restored, 'head', itemId), ['Mara', 'Tavin', 'Iona', 'Soren']);
});

test('class restrictions remain effective for manual equips and optimization', () => {
  const { game } = createGame('striker');
  game.state.inventory.R06_MARA_WEAPON = 4;
  game.state.inventory.R06_MARA_BODY = 4;
  game.state.inventory.R02_TAVIN_WEAPON = 2;
  game.state.inventory.R02_TAVIN_BODY = 2;
  const originalIona = plain(game.state.heroes.find(hero => hero.id === 'Iona').equipment);
  assert.equal(game.equip('Iona', 'R06_MARA_WEAPON'), false);
  assert.equal(game.equip('Mara', 'R06_MARA_BODY'), false, 'custom Striker keeps Striker eligibility');
  game.optimize('all');
  for (const id of ['Mara', 'Tavin']) {
    const hero = game.state.heroes.find(candidate => candidate.id === id);
    assert.equal(hero.equipment.weapon, 'R02_TAVIN_WEAPON');
    assert.equal(hero.equipment.body, 'R02_TAVIN_BODY');
  }
  assert.deepEqual(plain(game.state.heroes.find(hero => hero.id === 'Iona').equipment), originalIona);
});

test('unique set pieces stay single-owner and save validation rejects duplicated gear', () => {
  const { game, context, serialized } = createGame();
  const itemId = 'R01_SET_HEAD';
  game.state.inventory[itemId] = 1;
  game.state.setAcquired.push(itemId);
  assert.equal(game.equip('Mara', itemId), true);
  assert.equal(game.equip('Tavin', itemId), false);
  assert.equal(game.sell(itemId), false);
  assert.equal(game.buy(itemId, 4), false, 'unique pieces are absent from ordinary shops');
  assert.equal(game.save(), true);
  assert.ok(context.we(serialized(), 7321));

  const duplicateUnique = JSON.parse(serialized());
  duplicateUnique.inventory[itemId] = 2;
  assert.equal(context.we(JSON.stringify(duplicateUnique), 7321), null);

  const overEquipped = JSON.parse(serialized());
  overEquipped.heroes[1].equipment.head = itemId;
  assert.equal(context.we(JSON.stringify(overEquipped), 7321), null);

  const incompatible = JSON.parse(serialized());
  incompatible.heroes[2].equipment.weapon = incompatible.heroes[0].equipment.weapon;
  assert.equal(context.we(JSON.stringify(incompatible), 7321), null);

  const missingAcquisition = JSON.parse(serialized());
  missingAcquisition.setAcquired = [];
  assert.equal(context.we(JSON.stringify(missingAcquisition), 7321), null);
});

test('ordinary equipped totals cannot exceed inventory in saved games', () => {
  const { game, context, serialized } = createGame();
  game.state.inventory.R02_COMMON_CHARM = 4;
  for (const hero of game.state.heroes) assert.equal(game.equip(hero.id, 'R02_COMMON_CHARM'), true);
  const malformed = JSON.parse(serialized());
  malformed.inventory.R02_COMMON_CHARM = 3;
  assert.equal(context.we(JSON.stringify(malformed), 7321), null);
});

test('unique copy limits and unsellable quest equipment remain enforced in memory', () => {
  const { game } = createGame();
  game.state.inventory.R01_SET_HEAD = 4;
  game.state.setAcquired.push('R01_SET_HEAD');
  assert.equal(game.equip('Mara', 'R01_SET_HEAD'), true);
  assert.equal(game.equip('Tavin', 'R01_SET_HEAD'), false, 'surplus malformed quantity cannot clone a unique piece');
  game.state.inventory.QUEST_HALDEN_CLOAK = 1;
  const beforeGold = game.state.gold;
  assert.equal(game.sell('QUEST_HALDEN_CLOAK'), false);
  assert.equal(game.state.gold, beforeGold, 'unsellable quest prices cannot corrupt the gold total');
  assert.equal(game.state.inventory.QUEST_HALDEN_CLOAK, 1);
});

test('Optimize All distributes four stronger charms and preserves their ownership on reload', () => {
  const { game, reload } = createGame();
  game.state.inventory.R02_COMMON_CHARM = 4;
  assert.equal(game.optimize('all'), true);
  assert.deepEqual(wearers(game, 'charm', 'R02_COMMON_CHARM'), ['Mara', 'Tavin', 'Iona', 'Soren']);
  assert.equal(game.state.inventory.R02_COMMON_CHARM, 4);
  const restored = reload();
  assert.equal(restored.state.mode, 'explore');
  assert.deepEqual(wearers(restored, 'charm', 'R02_COMMON_CHARM'), ['Mara', 'Tavin', 'Iona', 'Soren']);
});

test('optimization accepts mixed defense/magic improvements and leaves equal-score gear in place', () => {
  const { game } = createGame();
  game.state.inventory.R02_COMMON_MANTLE = 1;
  game.state.inventory.QUEST_HALDEN_CLOAK = 1;
  assert.equal(game.equip('Mara', 'R02_COMMON_MANTLE'), true);
  assert.equal(game.optimize('Mara'), true);
  assert.equal(game.state.heroes[0].equipment.mantle, 'QUEST_HALDEN_CLOAK', 'same DEF plus MDEF is an upgrade');

  game.state.inventory.QUEST_FIELD_SATCHEL = 1;
  assert.equal(game.optimize('Iona'), true);
  assert.equal(game.state.heroes[2].equipment.charm, 'QUEST_FIELD_SATCHEL', 'MAG plus MDEF is scored together');

  game.state.inventory.R02_SOREN_WEAPON = 1;
  game.state.inventory.QUEST_ANET_FOCUS = 1;
  assert.equal(game.equip('Soren', 'R02_SOREN_WEAPON'), true);
  game.optimize('Soren');
  assert.equal(game.state.heroes[3].equipment.weapon, 'R02_SOREN_WEAPON', 'equal ATK+MAG score leaves equipped gear unchanged');
  const before = plain(game.state.heroes.map(hero => hero.equipment));
  game.optimize('all');
  assert.deepEqual(plain(game.state.heroes.map(hero => hero.equipment)), before, 'repeating optimization does not reshuffle ties');
});

test('Optimize All respects scarce ordinary copies and unique set restrictions', () => {
  const { game } = createGame('striker');
  game.state.inventory.R02_COMMON_CHARM = 2;
  game.state.inventory.R03_TAVIN_WEAPON = 1;
  game.state.inventory.R03_TAVIN_BODY = 1;
  game.state.inventory.R01_SET_HEAD = 1;
  game.state.setAcquired.push('R01_SET_HEAD');
  game.optimize('all');
  assert.equal(wearers(game, 'charm', 'R02_COMMON_CHARM').length, 2);
  assert.equal(wearers(game, 'weapon', 'R03_TAVIN_WEAPON').length, 1);
  assert.equal(wearers(game, 'body', 'R03_TAVIN_BODY').length, 1);
  assert.equal(wearers(game, 'head', 'R01_SET_HEAD').length, 1);
  assert.equal(game.state.inventory.R02_COMMON_CHARM, 2);
  assert.equal(game.state.inventory.R03_TAVIN_WEAPON, 1);
  assert.equal(game.state.inventory.R03_TAVIN_BODY, 1);
  assert.equal(game.state.inventory.R01_SET_HEAD, 1);
});
