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
function fresh(job = 'warden') {
  const context = vm.createContext({ structuredClone });
  vm.runInContext(core, context, { timeout: 3000 });
  context.Q = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const saved = new Map();
  const storage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, String(value)) };
  const game = context.Ee({ storage, seed: 7321, roundDelay: 0 });
  game.beginAdventure({ ...context.R, name: 'Rowan', job });
  game.skipIntro();
  return { game, context, saved, serialized: () => storage.getItem(context.G), reload: () => context.Ee({ storage, seed: 7321 }) };
}

test('shop shows the customized hero name and keeps names escaped', () => {
  const { context, game } = fresh();
  let preview = context.sI(game.state, 'R02_COMMON_HEAD');
  assert.match(preview, />Rowan ▲/);
  assert.doesNotMatch(preview, />Mara /);
  game.state.heroes[0].name = '<img src=x>';
  preview = context.sI(game.state, 'R02_COMMON_HEAD');
  assert.match(preview, /&lt;img src=x&gt;/);
  assert.doesNotMatch(preview, /<img/);
});

test('shop downgrades include defense stats absent from the offered item', () => {
  const { context, game } = fresh();
  game.state.inventory.QUEST_HALDEN_CLOAK = 1;
  assert.equal(game.equip('Mara', 'QUEST_HALDEN_CLOAK'), true);
  const preview = context.sI(game.state, 'R02_COMMON_MANTLE');
  assert.match(preview, /data-shop-compare="Mara">Rowan ▼ \(MDEF -2\)/);
  assert.doesNotMatch(preview, /data-shop-compare="Mara">Rowan ＝/);
});

test('shop calls a gain and a loss a trade-off, even when total stats tie', () => {
  const { context, game } = fresh();
  game.state.inventory.QUEST_FIELD_SATCHEL = 1;
  assert.equal(game.equip('Iona', 'QUEST_FIELD_SATCHEL'), true);
  const preview = context.sI(game.state, 'R02_COMMON_CHARM');
  assert.match(preview, /data-shop-compare="Iona">Iona ↔ \(MDEF \+1, MAG -1\)/);
});

for (const [slot, id] of [
  ['weapon', 'R02_MARA_WEAPON'], ['body', 'R02_MARA_BODY'],
  ['head', 'R02_COMMON_HEAD'], ['mantle', 'R02_COMMON_MANTLE'], ['charm', 'R02_COMMON_CHARM'],
]) {
  test(`${slot}: shop comparison is read-only and uses the worn slot`, () => {
    const { context, game } = fresh();
    game.state.inventory[id] = 1;
    assert.equal(game.equip('Mara', id), true);
    const before = JSON.stringify(game.state);
    const preview = context.sI(game.state, id);
    assert.match(preview, /data-shop-compare="Mara">Rowan ＝<\/span>/);
    assert.equal(JSON.stringify(game.state), before);
  });
}

test('invalid shop quantities never change or replace a valid saved game', () => {
  const { context, game, serialized } = fresh();
  game.state.gold = 1000;
  assert.equal(game.save(), true);
  const beforeState = JSON.stringify(game.state), beforeSave = serialized();
  for (const quantity of [NaN, Infinity, -Infinity, 1.5, 0.5, -1, 0, '5', 'bogus', null, {}, []]) {
    assert.equal(game.buy('POTION', quantity), false, String(quantity));
    assert.equal(JSON.stringify(game.state), beforeState);
    assert.equal(serialized(), beforeSave);
    assert.ok(context.we(serialized(), 7321));
  }
});

test('valid quantity and Max retain affordability, stack caps, owned copies and reload', () => {
  const { context, game, reload } = fresh();
  game.state.gold = 10000;
  game.state.message = { speaker: 'Weapon Shop', text: 'Equipment.' };
  assert.equal(game.buy('R01_COMMON_CHARM', 4), 4);
  for (const hero of game.state.heroes) assert.equal(game.equip(hero.id, 'R01_COMMON_CHARM'), true);
  assert.equal(game.state.inventory.R01_COMMON_CHARM, 8, 'starting worn copies remain owned');
  game.state.message = { speaker: 'Item Shop', text: 'Supplies.' };
  game.state.inventory.POTION = 98;
  const before = game.state.gold;
  assert.equal(game.buy('POTION', 'max'), 1);
  assert.equal(game.state.inventory.POTION, 99);
  assert.equal(game.state.gold, before - 30);
  assert.equal(game.buy('POTION', 'max'), false);
  game.state.inventory.POTION = 0;
  game.state.gold = 61;
  assert.equal(game.buy('POTION', 'max'), 2);
  assert.equal(game.state.gold, 1);
  assert.equal(game.buy('POTION'), false);
  const restored = reload();
  assert.equal(restored.state.mode, 'explore');
  assert.deepEqual(plain(restored.state.inventory), plain(game.state.inventory));
  assert.equal(restored.state.gold, 1);
  assert.ok(restored.state.heroes.every(hero => hero.equipment.charm === 'R01_COMMON_CHARM'));
  assert.deepEqual(plain(restored.state.learnedSpells), plain(game.state.learnedSpells));
});
