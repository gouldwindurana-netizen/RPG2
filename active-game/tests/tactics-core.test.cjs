'use strict';

// Compare planning feedback with the shipped engine, not copied combat rules.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(process.env.GAME_HTML || path.join(__dirname, '..', 'The_Road_Beyond_the_Bells.html'), 'utf8');
const coreStart = html.indexOf('var l={schemaVersion');
const coreEnd = html.indexOf('var De=new Set', coreStart);
const uiStart = html.indexOf('function tacticalIntelUI(state)');
const uiEnd = html.indexOf('function Bt(){', uiStart);
assert.ok(coreStart >= 0 && coreEnd > coreStart && uiStart >= 0 && uiEnd > uiStart);
const plain = value => JSON.parse(JSON.stringify(value));
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[character]);

function setup() {
  const context = vm.createContext({ structuredClone });
  vm.runInContext(html.slice(coreStart, coreEnd), context, { timeout: 5000 });
  context.Q = escape;
  vm.runInContext(html.slice(uiStart, uiEnd), context, { timeout: 5000 });
  const game = context.Ee({ storage: null, seed: 7321, roundDelay: 0 });
  game.beginAdventure({ ...context.R, name: 'Rowan' }); game.skipIntro();
  const enemy = context.encounterUnit({ template: 'R01_E2', size: 'small', unit: 'regular', rank: 'base' }, 0);
  enemy.weakness = ['light', 'pierce']; enemy.resistance = ['dark'];
  game.state.mode = 'battle';
  game.state.battle = { encounterId: 'tactics-probe', title: 'Tactics probe', regionId: 'R01', kind: 'normal',
    phase: 'planning', round: 1, enemies: [enemy], plans: {}, log: [] };
  return { context, game, enemy };
}

test('undiscovered enemies reveal only visible battle information and reading is pure', () => {
  const { context, game, enemy } = setup();
  const before = JSON.stringify(game.state), notes = context.tacticalIntel(game.state);
  assert.equal(notes.available, true);
  assert.equal(notes.round, 1);
  assert.equal(notes.enemies[0].id, enemy.id);
  assert.equal(notes.enemies[0].hp, enemy.hp);
  assert.equal(notes.enemies[0].intent, enemy.intent);
  assert.equal(notes.enemies[0].known, false);
  assert.deepEqual(plain(notes.enemies[0].weakness), []);
  assert.deepEqual(plain(notes.enemies[0].resistance), []);
  assert.equal('attack' in notes.enemies[0], false);
  assert.equal('defense' in notes.enemies[0], false);
  assert.deepEqual(plain(notes.heroes.map(hero => hero.attackType)), ['slash', 'pierce', 'blunt', 'blunt']);
  assert.equal(JSON.stringify(game.state), before);
});

test('field notes require the exact defeated regional catalog and rank, then copy current affinities', () => {
  const { context, game, enemy } = setup();
  game.state.wayfarer.bestiary['R01|R01_E2|ashen'] = { defeated: 3 };
  game.state.wayfarer.bestiary['R02|R02_E2|base'] = { defeated: 3 };
  assert.equal(context.tacticalIntel(game.state).enemies[0].known, false);
  game.state.wayfarer.bestiary['R01|R01_E2|base'] = { defeated: 1 };
  const notes = context.tacticalIntel(game.state);
  assert.equal(notes.enemies[0].known, true);
  assert.deepEqual(plain(notes.enemies[0].weakness), ['light', 'pierce']);
  notes.enemies[0].weakness.push('fire');
  assert.deepEqual(plain(enemy.weakness), ['light', 'pierce'], 'UI data cannot mutate enemy affinity arrays');
});

test('boss aliases, separate voices and rare encounters use their real saved catalog keys', () => {
  const { context, game, enemy } = setup();
  game.state.battle.kind = 'boss'; game.state.battle.encounterId = 'bailiff';
  game.state.wayfarer.bestiary['R01|B_R01_BAILIFF|boss'] = { defeated: 1 };
  assert.equal(context.tacticalIntel(game.state).enemies[0].known, true);
  game.state.battle.regionId = 'R06'; game.state.battle.encounterId = 'B_R06_CHOIR';
  game.state.wayfarer.bestiary['R06|B_R06_CHOIR|boss'] = { defeated: 3 };
  game.state.battle.enemies = [0, 1, 2].map(index => ({ ...enemy, id: 'B_R06_CHOIR_' + index }));
  assert.equal(context.tacticalIntel(game.state).enemies.every(foe => foe.known), true);
  game.state.battle.kind = 'rare'; game.state.battle.regionId = 'R01'; game.state.battle.encounterId = 'silver';
  game.state.wayfarer.bestiary['R01|R01_RARE|rare'] = { defeated: 1 };
  assert.equal(context.tacticalIntel(game.state).enemies.every(foe => foe.known), true);
});

test('tactics availability follows the planning boundary without changing enemy data', () => {
  const { context, game } = setup();
  game.state.battle.phase = 'resolving'; assert.equal(context.tacticalIntel(game.state).available, false);
  game.state.mode = 'victory'; assert.equal(context.tacticalIntel(game.state).available, false);
  game.state.mode = 'explore'; game.state.battle = null;
  assert.equal(context.tacticalIntel(game.state).available, false);
  assert.deepEqual(plain(context.tacticalIntel(game.state).enemies), []);
});

test('shared supplies exclude another hero reservation but retain the selected hero edit', () => {
  const { context, game } = setup();
  game.state.inventory.POTION = 1;
  const before = JSON.stringify({ inventory: game.state.inventory, heroes: game.state.heroes });
  assert.equal(game.plan('Mara', { type: 'item', itemId: 'POTION', target: 'Mara' }), true, 'full-health anticipatory healing remains legal');
  const editing = context.tacticalItemStock(game.state, 'POTION', 'Mara');
  assert.deepEqual(plain(editing), { owned: 1, reserved: 0, available: 1, usable: true });
  const next = context.tacticalItemStock(game.state, 'POTION', 'Tavin');
  assert.deepEqual(plain(next), { owned: 1, reserved: 1, available: 0, usable: false });
  assert.equal(game.plan('Tavin', { type: 'item', itemId: 'POTION', target: 'Mara' }), false);
  assert.equal(JSON.stringify({ inventory: game.state.inventory, heroes: game.state.heroes }), before, 'planning and feedback spend no supplies or HP');
  game.undo('Mara');
  assert.equal(context.tacticalItemStock(game.state, 'POTION', 'Tavin').usable, true);
});

test('every battle consumable target agrees with actual engine acceptance for live, conditioned and fallen allies', () => {
  const { context, game } = setup();
  game.state.heroes.find(hero => hero.id === 'Tavin').hp = 0;
  game.state.heroes.find(hero => hero.id === 'Iona').status = 'poison';
  game.state.heroes.find(hero => hero.id === 'Soren').status = 'silence';
  for (const id of context.ue) {
    game.state.inventory[id] = 2;
    for (const target of game.state.heroes) {
      game.state.battle.plans = {};
      const action = { type: 'item', itemId: id, heroId: 'Mara', target: target.id };
      const valid = context.tacticalTargetValid(game.state, action, target);
      assert.equal(game.plan('Mara', action), valid, `${id} on ${target.id}`);
    }
  }
});

test('spell target feedback agrees with learned healing, cure and revive plans without rejecting full-health reservations', () => {
  const { context, game } = setup();
  const iona = game.state.heroes.find(hero => hero.id === 'Iona');
  game.state.heroes[game.state.heroes.indexOf(iona)] = context.be('Iona', 31, iona.equipment, game.state.profile);
  const caster = game.state.heroes.find(hero => hero.id === 'Iona');
  game.state.learnedSpells.Iona = context.te.filter(spell => context.H(caster, spell)).map(spell => spell.id);
  game.state.heroes[0].hp = 0;
  game.state.heroes.find(hero => hero.id === 'Tavin').status = 'sleep';
  game.state.heroes.find(hero => hero.id === 'Soren').status = 'poison';
  for (const id of ['mend', 'cleanse', 'revive', 'rebirth']) {
    for (const target of game.state.heroes) {
      game.state.battle.plans = {};
      const action = { type: 'spell', spellId: id, heroId: 'Iona', target: target.id };
      assert.equal(context.tacticalTargetValid(game.state, action, target), game.plan('Iona', action), `${id} on ${target.id}`);
    }
  }
});

test('curatives need a matching condition, meals stay field-only, and MP tea follows actor and mana eligibility', () => {
  const { context, game } = setup();
  for (const id of ['ANTIDOTE', 'SOOTHING_DRAUGHT', 'CLEAR_TONIC', 'REVIVAL_SALT', 'CAMP_MEAL', 'SPARK_TEA']) game.state.inventory[id] = 1;
  for (const id of ['ANTIDOTE', 'SOOTHING_DRAUGHT', 'CLEAR_TONIC', 'REVIVAL_SALT', 'CAMP_MEAL', 'SPARK_TEA'])
    assert.equal(context.tacticalItemStock(game.state, id, 'Mara').usable, false, id);
  game.state.heroes[1].status = 'sleep';
  assert.equal(context.tacticalItemStock(game.state, 'SOOTHING_DRAUGHT', 'Mara').usable, true);
  game.state.heroes[0].status = 'sleep';
  assert.equal(context.tacticalItemStock(game.state, 'SOOTHING_DRAUGHT', 'Mara').usable, false, 'sleeping actor cannot choose a use');
  const markup = context.tacticalBattleItemsUI(game.state, 'Mara');
  assert.doesNotMatch(markup, /data-battle-item="CAMP_MEAL"/);
  assert.match(markup, /data-battle-item="SPARK_TEA"[^>]*disabled/, 'a sleeping actor cannot spend an MP tea');
  game.state.heroes[0].status = null;
  game.state.heroes.find(hero => hero.id === 'Soren').mp--;
  assert.equal(context.tacticalItemStock(game.state, 'SPARK_TEA', 'Mara').usable, true);
  assert.doesNotMatch(context.tacticalBattleItemsUI(game.state, 'Mara').match(/<button data-battle-item="SPARK_TEA"[^>]*>/)[0], /disabled/);
});

test('tactical text is escaped, unknown affinities stay undisclosed and reservation quantities remain visible', () => {
  const { context, game, enemy } = setup();
  enemy.displayName = '<img src=x onerror=alert(1)>'; enemy.intent = '<script>alert(1)</script>';
  game.state.heroes[0].name = '<b>Rowan</b>';
  const before = JSON.stringify(game.state), markup = context.tacticalIntelUI(game.state);
  assert.match(markup, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(markup, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(markup, /&lt;b&gt;Rowan&lt;\/b&gt;/);
  assert.match(markup, /data-tactical-known="false"/);
  assert.doesNotMatch(markup, /<dt>Weakness<\/dt>|<dt>Resists<\/dt>/);
  assert.equal(JSON.stringify(game.state), before);
  game.state.inventory.POTION = 1; game.state.battle.plans.Mara = { type: 'item', itemId: 'POTION', target: 'Mara' };
  const supplyMarkup = context.tacticalBattleItemsUI(game.state, 'Tavin');
  assert.match(supplyMarkup, /data-battle-item="POTION" data-owned="1" data-reserved="1" data-available="0" disabled/);
  assert.match(supplyMarkup, /0 available · 1 reserved \/ 1 owned/);
});
