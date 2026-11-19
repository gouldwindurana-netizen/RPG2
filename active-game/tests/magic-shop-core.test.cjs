'use strict';

// Exercise the engine shipped inside the standalone HTML, never a source-tree proxy.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const htmlPath = path.resolve(process.env.GAME_HTML || path.join(__dirname, '..', 'The_Road_Beyond_the_Bells.html'));
const html = fs.readFileSync(htmlPath, 'utf8');
const start = html.indexOf('var l={schemaVersion');
const end = html.indexOf('var De=new Set', start);
assert.ok(start >= 0 && end > start);
const core = html.slice(start, end);
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
  const game = context.Ee({ storage, seed: 7321, roundDelay: 0 });
  assert.equal(game.beginAdventure({ ...context.R, name: 'Rowan', job }), true);
  game.skipIntro();
  return { context, game, storage, serialized: () => storage.getItem(context.G), reload: () => context.Ee({ storage, seed: 7321, roundDelay: 0 }) };
}

// Real pre-MP saves keep their charge-era schema. Do not fabricate them by
// merely changing the version number of a current MP save.
function createLegacyGame() {
  const legacyPath = path.join(__dirname, '..', 'jobs-baseline.html');
  const old = fs.readFileSync(legacyPath, 'utf8');
  const context = vm.createContext({ structuredClone });
  vm.runInContext(old.slice(old.indexOf('var l={schemaVersion'), old.indexOf('var De=new Set')), context, { timeout: 3000 });
  const saved = new Map(), storage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, String(value)) };
  const game = context.Ee({ storage, seed: 7321, roundDelay: 0 });
  game.beginAdventure({ ...context.R, name: 'Before MP', job: 'warden' }); game.skipIntro();
  return { context, game, serialized: () => storage.getItem(context.G) };
}

function hero(game, id) { return game.state.heroes.find(candidate => candidate.id === id); }
function spell(context, id) { return context.te.find(candidate => candidate.id === id); }
function visitShop(game, kind, region = 1, context) {
  game.state.area = ['camp', 'dunmere', 'fen', 'orchard', 'crown', 'veyr'][region - 1];
  const npc = context?.he[game.state.area].entities.find(entity => entity.shopKind === 'magic');
  game.state.player = npc ? { x: npc.x, y: npc.y + 1, facing: 'up' } : { x: 11, y: 10, facing: 'right' };
  game.state.message = { speaker: `${kind} Shop`, text: 'Shop test.' };
}
function setLevel(fixture, id, level) {
  const { game, context } = fixture;
  game.state.hx[id] = context.l.xp_thresholds[level - 1];
  const current = hero(game, id);
  game.state.heroes[game.state.heroes.indexOf(current)] = context.be(id, level, current.equipment, game.state.profile);
}
function planningBattle(game) {
  game.state.message = null;
  game.state.mode = 'battle';
  game.state.battle = {
    encounterId: 'test', title: 'Test', kind: 'normal', regionId: 'R01',
    round: 1, phase: 'planning', plans: {}, log: [],
    enemies: [{ id: 'test-enemy', name: 'Training Target', hp: 100000, maxHp: 100000, attack: 0, defense: 0, family: 'REEDBACK', weakness: [], resistance: [], rank: 'base', status: null }],
  };
}

for (const [job, initial] of [
  ['warden', ['shield-bash']], ['striker', ['power-strike']], ['scout', ['quickshot']],
  ['mender', ['mend']], ['arcanist', ['ember']], ['spellblade', ['mend', 'ember', 'arc-slash']],
]) {
  test(`fresh ${job} learns only starter skills and keeps stable hero IDs`, () => {
    const { game, context } = createGame(job);
    assert.deepEqual(plain(game.state.learnedSpells), { Mara: initial, Tavin: ['power-strike'], Iona: ['mend'], Soren: ['ember'] });
    assert.equal(game.state.heroes[0].name, 'Rowan');
    assert.equal(context.knowsSpell(game.state, hero(game, 'Mara'), spell(context, 'mend')), initial.includes('mend'));
    assert.equal(context.H(hero(game, 'Iona'), spell(context, 'shelter')), true, 'job eligibility is separate from learning');
    assert.equal(context.knowsSpell(game.state, hero(game, 'Iona'), spell(context, 'shelter')), false);
  });
}

test('regional offers retain all twenty-four magic skills and martial choices with pure job checks', () => {
  const { game, context } = createGame();
  const ids = new Set(), techniques = new Set();
  assert.equal(context.te.length, 40);
  assert.equal(context.te.filter(skill => skill.kind === 'magic').length, 24);
  assert.deepEqual(plain([...new Set(context.te.filter(skill => skill.kind === 'magic').map(candidate => candidate.tier))].sort((a,b) => a-b)), [1, 2, 3, 4, 5, 6, 7, 8]);
  for (let region = 1; region <= 6; region++) {
    visitShop(game, 'Skill', region, context);
    const before = JSON.stringify(game.state);
    for (const id of ['Iona', 'Soren', 'Tavin']) {
      for (const offer of context.spellOffers(game.state, id)) {
        const ability = spell(context, offer.spellId);
        assert.equal(context.H(hero(game, id), ability), true);
        assert.equal(offer.unlocked, true, 'the growth build uses travel rather than character-level gates');
        assert.ok(offer.known || Math.min(6, ability.tier) === region, `${offer.spellId} matches regional stock or known history`);
        (id === 'Tavin' ? techniques : ids).add(offer.spellId);
      }
    }
    assert.equal(JSON.stringify(game.state), before, 'reading offers never changes resources or history');
    assert.equal(context.spellOffers(game.state, 'nobody').length, 0);
  }
  assert.equal(ids.size, 24); assert.equal(techniques.size, 4);
  visitShop(game, 'Skill', 1, context);
  assert.equal(context.spellOffers(game.state, 'Iona').find(offer => offer.spellId === 'renew'), undefined);
  assert.equal(context.spellOffers(game.state, 'Iona').find(offer => offer.spellId === 'mend').known, true);
  visitShop(game, 'Skill', 2, context);
  assert.equal(context.spellOffers(game.state, 'Iona').find(offer => offer.spellId === 'renew').unlocked, true);
  assert.equal(hero(game, 'Iona').level, 1);
});

test('learning charges gold once for the selected hero, saves, and never refills MP', () => {
  const { game, context, reload } = createGame('mender');
  visitShop(game, 'Skill');
  const offer = context.spellOffers(game.state, 'Iona').find(offer => offer.spellId === 'shelter');
  assert.equal(offer.price, 35);
  game.state.gold = offer.price - 1;
  assert.equal(game.buySpell('Iona', 'shelter'), false);
  assert.equal(game.state.gold, offer.price - 1);
  game.state.gold = 100;
  hero(game, 'Iona').mp = 0;
  const inventoryBefore = plain(game.state.inventory);
  const hxBefore = plain(game.state.hx);
  assert.equal(game.buySpell('Iona', 'shelter'), true);
  assert.equal(game.state.gold, 100 - offer.price);
  assert.equal(hero(game, 'Iona').mp, 0, 'learning does not restore spent MP');
  assert.equal(context.knowsSpell(game.state, hero(game, 'Iona'), spell(context, 'shelter')), true);
  assert.equal(context.knowsSpell(game.state, hero(game, 'Mara'), spell(context, 'shelter')), false, 'same-job heroes learn independently');
  assert.equal(game.buySpell('Iona', 'shelter'), false);
  assert.equal(game.state.gold, 100 - offer.price, 'duplicate purchase does not charge gold');
  assert.deepEqual(plain(game.state.inventory), inventoryBefore);
  assert.deepEqual(plain(game.state.hx), hxBefore);
  const restored = reload();
  assert.equal(restored.state.mode, 'explore');
  assert.deepEqual(plain(restored.state.learnedSpells), plain(game.state.learnedSpells));
  assert.equal(hero(restored, 'Iona').mp, 0);
});

test('all eight magic tiers can be learned through regional stores without restoring MP', () => {
  const { game, context, reload } = createGame();
  game.state.gold = 100000;
  for (const id of ['Iona', 'Soren']) hero(game, id).mp = 0;
  for (let region = 1; region <= 6; region++) {
    visitShop(game, 'Skill', region, context);
    for (const id of ['Iona', 'Soren']) {
      for (const offer of context.spellOffers(game.state, id)) {
        assert.equal(offer.unlocked, true);
        if (!offer.known) assert.equal(game.buySpell(id, offer.spellId), true, `${id}/${offer.spellId}`);
      }
      assert.equal(hero(game, id).mp, 0);
      assert.equal(hero(game, id).level, 1, 'regional access replaces level prerequisites');
    }
  }
  for (const id of ['Iona', 'Soren']) assert.equal(game.state.learnedSpells[id].length, 14);
  const restored = reload();
  assert.equal(restored.state.mode, 'explore');
  assert.deepEqual(plain(restored.state.learnedSpells), plain(game.state.learnedSpells));
  assert.equal(hero(restored, 'Iona').maxMp, hero(game, 'Iona').maxMp);
  assert.equal(hero(restored, 'Soren').mp, 0);
});

test('purchase rejects wrong jobs, out-of-region stock, absent merchants, and unknown IDs', () => {
  const { game } = createGame('spellblade');
  game.state.gold = 100000;
  visitShop(game, 'Skill');
  for (const [id, spellId] of [['Mara', 'shelter'], ['Tavin', 'ember'], ['Iona', 'ember'], ['Soren', 'mend'], ['Iona', 'renew'], ['Soren', 'aurora'], ['Iona', 'unknown'], ['missing', 'mend']]) {
    assert.equal(game.buySpell(id, spellId), false, `${id}/${spellId}`);
  }
  const before = plain(game.state.learnedSpells);
  game.state.message = null;
  assert.equal(game.buySpell('Iona', 'shelter'), false);
  visitShop(game, 'Item');
  assert.equal(game.buySpell('Iona', 'shelter'), false);
  visitShop(game, 'Skill');
  game.state.area = 'works';
  game.state.player = { x: 13, y: 10, facing: 'right' };
  assert.equal(game.buySpell('Iona', 'shelter'), false, 'unsafe location cannot become a merchant by dialogue alone');
  assert.deepEqual(plain(game.state.learnedSpells), before);
  assert.equal(game.state.gold, 100000);
});

test('field healing needs learning and still respects silence, MP and targets', () => {
  const fixture = createGame();
  const { game, context } = fixture;
  setLevel(fixture, 'Iona', 5);
  hero(game, 'Mara').hp -= 30;
  assert.equal(game.castField('Iona', 'renew', 'Mara'), false, 'level growth alone grants no skill');
  visitShop(game, 'Skill', 2, context);
  game.state.gold = 1000;
  assert.equal(game.buySpell('Iona', 'renew'), true);
  game.dismiss();
  hero(game, 'Iona').status = 'silence';
  assert.equal(game.castField('Iona', 'renew', 'Mara'), false);
  hero(game, 'Iona').status = null;
  const mp = hero(game, 'Iona').mp, cost = context.skillCost(spell(context, 'renew'));
  assert.equal(game.castField('Iona', 'renew', 'Mara'), true);
  assert.equal(hero(game, 'Iona').mp, mp - cost);
  assert.equal(hero(game, 'Mara').hp, hero(game, 'Mara').maxHp);
  assert.equal(game.castField('Iona', 'renew', 'Mara'), false, 'full-health party consumes no MP');
  assert.equal(hero(game, 'Iona').mp, mp - cost);
});

test('battle planning and repeat reject unlearned spells and respect silence', () => {
  const { game } = createGame();
  planningBattle(game);
  const action = { type: 'spell', spellId: 'spark', target: 'test-enemy' };
  assert.equal(game.plan('Soren', action), false);
  game.state.battle.lastPlans = { Soren: action };
  game.repeatPlans();
  assert.equal(game.state.battle.plans.Soren.type, 'attack', 'repeat falls back through normal validation');
  hero(game, 'Soren').status = 'silence';
  assert.equal(game.plan('Soren', { ...action, spellId: 'ember' }), false);
  hero(game, 'Soren').status = null;
  assert.equal(game.plan('Soren', { ...action, spellId: 'ember' }), true);
});

test('battle executor rechecks learning and handles forged or stale skill IDs without spending MP', async () => {
  const { game } = createGame();
  for (const spellId of ['spark', 'missing-spell']) {
    planningBattle(game);
    const mp = hero(game, 'Soren').mp;
    for (const candidate of game.state.heroes) assert.equal(game.plan(candidate.id, { type: 'guard', target: candidate.id }), true);
    game.state.battle.plans.Soren = { type: 'spell', spellId, target: 'test-enemy' };
    await game.resolveRound();
    assert.equal(hero(game, 'Soren').mp, mp);
    assert.equal(game.state.battle.enemies[0].hp, 100000);
    assert.ok(game.state.battle.log.some(line => line.includes('cannot use that skill') && line.includes('No MP spent')));
  }
});

test('a purchased battle skill casts and spends its MP cost once', async () => {
  const { game, context } = createGame();
  visitShop(game, 'Skill');
  assert.equal(game.buySpell('Soren', 'spark'), true);
  planningBattle(game);
  const mp = hero(game, 'Soren').mp, cost = context.skillCost(spell(context, 'spark'));
  for (const candidate of game.state.heroes) assert.equal(game.plan(candidate.id, { type: 'guard', target: candidate.id }), true);
  assert.equal(game.plan('Soren', { type: 'spell', spellId: 'spark', target: 'test-enemy' }), true);
  await game.resolveRound();
  assert.equal(hero(game, 'Soren').mp, mp - cost);
  assert.ok(game.state.battle.enemies[0].hp < 100000);
});

for (const version of [1, 2, 3]) {
  test(`legacy v${version} save grants every currently unlocked eligible spell using per-hero EXP`, () => {
    const fixture = createLegacyGame();
    const { game, serialized } = fixture;
    const { context } = createGame();
    setLevel(fixture, 'Iona', 9);
    setLevel(fixture, 'Soren', 5);
    game.state.xp = 99999;
    assert.equal(game.save(), true);
    const old = JSON.parse(serialized());
    old.version = version;
    delete old.learnedSpells;
    const migrated = context.we(JSON.stringify(old), 7321);
    assert.ok(migrated);
    assert.deepEqual(plain(migrated.learnedSpells.Iona), ['mend', 'shelter', 'lumen', 'umbra', 'radiance', 'nightfall', 'renew', 'cleanse', 'kindle']);
    assert.deepEqual(plain(migrated.learnedSpells.Soren), ['lumen', 'umbra', 'ember', 'spark', 'frost', 'wave']);
    assert.deepEqual(plain(migrated.learnedSpells.Mara), ['shield-bash']);
    assert.deepEqual(plain(migrated.learnedSpells.Tavin), ['power-strike']);
    assert.deepEqual(plain(migrated.hx), plain(game.state.hx));
    const normalized = context.we(JSON.stringify(migrated), 7321);
    assert.ok(normalized);
    assert.equal(normalized.version, 4);
    assert.deepEqual(plain(normalized.learnedSpells), plain(migrated.learnedSpells));
  });
}

test('learned skill history rejects malformed data, preserves cross-job history, and validates charge-era jobs', () => {
  const { game, context, serialized } = createGame();
  assert.equal(game.save(), true);
  const valid = JSON.parse(serialized());
  for (const mutate of [
    save => { save.learnedSpells = null; },
    save => { save.learnedSpells = []; },
    save => { delete save.learnedSpells.Mara; },
    save => { save.learnedSpells.Rowan = []; },
    save => { save.learnedSpells.Iona = 'mend'; },
    save => { save.learnedSpells.Iona = ['mend', 'mend']; },
    save => { save.learnedSpells.Iona = ['unknown']; },
    save => { save.learnedSpells.Soren = [12]; },
  ]) {
    const invalid = structuredClone(valid);
    mutate(invalid);
    assert.equal(context.we(JSON.stringify(invalid), 7321), null);
  }
  assert.ok(context.we(JSON.stringify(valid), 7321));
  const history = structuredClone(valid);
  history.learnedSpells.Iona.push('ember');
  const imported = context.we(JSON.stringify(history), 7321);
  assert.ok(imported, 'a current save can retain a skill learned under another job');
  assert.ok(imported.learnedSpells.Iona.includes('ember'));
  assert.equal(context.knowsSpell(imported, hero({ state: imported }, 'Iona'), spell(context, 'ember')), false,
    'retained learning cannot bypass current-job compatibility');
  const legacy = createLegacyGame(); legacy.game.save();
  const old = JSON.parse(legacy.serialized());
  old.learnedSpells.Iona = ['ember'];
  assert.equal(context.we(JSON.stringify(old), 7321), null, 'a charge-era save cannot invent incompatible learned magic');
});

test('weapon and item merchants isolate stock and sales while legacy quartermasters keep all stock', () => {
  const { game, context } = createGame();
  game.state.gold = 100000;
  visitShop(game, 'Weapon');
  const equipment = context.fe(game.state);
  assert.ok(equipment.length > 0);
  assert.deepEqual(plain([...new Set(equipment.map(offer => context.K(offer.itemId).slot))]).sort(), ['body', 'charm', 'head', 'mantle', 'weapon']);
  assert.ok(equipment.every(offer => context.K(offer.itemId).kind === 'equipment'));
  assert.equal(game.buy('POTION'), false);
  const itemId = 'R01_COMMON_HEAD';
  const inventoryBefore = game.state.inventory[itemId];
  assert.equal(game.buy(itemId, 4), 4);
  assert.equal(game.state.inventory[itemId], inventoryBefore + 4);
  assert.equal(game.sell('POTION'), false);
  assert.equal(game.sell(itemId), true);
  visitShop(game, 'Item');
  assert.ok(context.fe(game.state).every(offer => context.K(offer.itemId).kind === 'consumable'));
  assert.equal(game.buy(itemId), false);
  assert.equal(game.sell(itemId), false);
  assert.equal(game.buy('POTION', 5), 5);
  assert.equal(game.sell('POTION'), true);
  visitShop(game, 'Skill');
  assert.equal(context.fe(game.state).length, 0);
  assert.equal(game.buy(itemId), false);
  assert.equal(game.buy('POTION'), false);
  assert.equal(game.sell(itemId), false);
  assert.equal(game.sell('POTION'), false);
  game.state.message.speaker = 'Quartermaster';
  assert.ok(context.fe(game.state).some(offer => offer.itemId === 'POTION'));
  assert.ok(context.fe(game.state).some(offer => offer.itemId === itemId));
  assert.equal(game.buy(itemId), 1);
  assert.equal(game.buy('POTION'), 1);
});

test('merchant interaction recognizes shopKind and weapon-/magic- IDs before generic dialogue', () => {
  const { game, context } = createGame();
  const cases = [
    ['magic-test', undefined, 'Skill Shop'], ['weapon-test', undefined, 'Weapon Shop'],
    ['shop-test', undefined, 'Item Shop'], ['merchant', undefined, 'Item Shop'],
    ['custom-test', 'magic', 'Skill Shop'], ['custom-test', 'weapon', 'Weapon Shop'], ['custom-test', 'item', 'Item Shop'],
  ];
  const original = context.he.camp.entities;
  for (const [id, shopKind, speaker] of cases) {
    context.he.camp.entities = [{ id, shopKind, x: 12, y: 10, kind: 'npc', name: 'Vendor', hint: 'Wrong generic dialogue.' }];
    game.state.message = null;
    game.state.area = 'camp';
    game.state.player = { x: 11, y: 10, facing: 'right' };
    game.interact(id);
    assert.equal(game.state.message.speaker, speaker);
  }
  context.he.camp.entities = original;
});

test('category guards keep every equipped copy owned and allow only spare equipment sales', () => {
  const { game, reload } = createGame();
  const itemId = 'R02_COMMON_HEAD';
  game.state.inventory[itemId] = 4;
  for (const candidate of game.state.heroes) assert.equal(game.equip(candidate.id, itemId), true);
  visitShop(game, 'Weapon');
  const before = game.state.gold;
  assert.equal(game.sell(itemId), false);
  assert.equal(game.state.inventory[itemId], 4);
  game.state.inventory[itemId] = 5;
  assert.equal(game.sell(itemId), true);
  assert.equal(game.state.inventory[itemId], 4);
  assert.ok(game.state.gold > before);
  assert.equal(game.sell(itemId), false);
  const restored = reload();
  assert.equal(restored.state.mode, 'explore');
  assert.equal(restored.state.inventory[itemId], 4);
  assert.ok(restored.state.heroes.every(candidate => candidate.equipment.head === itemId));
});
