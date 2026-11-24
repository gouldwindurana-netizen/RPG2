'use strict';

// Check the uploaded difficulty changes against the shipped standalone engine.
// Position/combat fixtures isolate systems; these are not a full campaign run.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { visitShop } = require('./shop-fixture.cjs');
const root = path.resolve(__dirname, '..');
const htmlPath = process.env.GAME_HTML || path.join(root, 'The_Road_Beyond_the_Bells.html');
const plain = value => JSON.parse(JSON.stringify(value));
function contextFor(file = htmlPath) {
  const html = fs.readFileSync(file, 'utf8');
  const first = html.indexOf('var l={schemaVersion'), last = html.indexOf('var De=new Set', first);
  assert.ok(first >= 0 && last > first);
  const context = vm.createContext({ structuredClone });
  vm.runInContext(html.slice(first, last), context, { timeout: 5000, filename: file });
  return context;
}
function fixture(job = 'warden', file) {
  const context = contextFor(file);
  const saved = new Map();
  const storage = { getItem: key => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, String(value)), removeItem: key => saved.delete(key) };
  const game = context.Ee({ storage, seed: 7321, roundDelay: 0 });
  game.beginAdventure({ ...context.R, name: 'Rowan', job }); game.skipIntro();
  return { context, game, storage, saved,
    reload: () => context.Ee({ storage, seed: 7321, roundDelay: 0 }) };
}
function hero(game, id) { return game.state.heroes.find(candidate => candidate.id === id); }
function setLevel(fix, id, level) {
  const old = hero(fix.game, id);
  fix.game.state.hx[id] = fix.context.l.xp_thresholds[level - 1];
  fix.game.state.heroes[fix.game.state.heroes.indexOf(old)] = fix.context.be(id, level, old.equipment, fix.game.state.profile);
}
function authored(fix, id = 'encounter3') {
  const { context, game } = fix;
  game.state.message = null; game.configure({ encounters: 'visible' });
  game.state.area = 'works';
  const entity = context.he.works.entities.find(candidate => candidate.id === id);
  game.state.player = { x: entity.x, y: entity.y + 1, facing: 'up' };
  game.interact(id); assert.equal(game.state.mode, 'battle');
  return game.state.battle;
}
function practiceBattle(game, count = 1) {
  game.state.message = null; game.state.mode = 'battle';
  game.state.battle = { encounterId: 'practice-probe', title: 'Practice probe', kind: 'normal',
    regionId: 'R01', round: 1, phase: 'planning', plans: {}, log: [],
    enemies: Array.from({ length: count }, (_, index) => ({ id: `target-${index}`, name: 'Training Target',
      hp: 100000, maxHp: 100000, attack: 0, defense: 0, family: 'HOUND',
      weakness: [], resistance: [], rank: 'base', status: 'sleep', statusChance: 0 })) };
}
function guards(game, caster = 'Iona') {
  for (const ally of game.state.heroes) if (ally.id !== caster)
    assert.equal(game.plan(ally.id, { type: 'guard', target: ally.id }), true);
}

const sets = [
  [{ defense: 4, magicDefense: 2 }, { defense: 3, attack: 2 }, { magicDefense: 4, magic: 2 }],
  [{ defense: 7, magicDefense: 4 }, { defense: 6, attack: 4 }, { magicDefense: 8, magic: 4 }],
  [{ defense: 12, magicDefense: 6 }, { defense: 10, attack: 6 }, { magicDefense: 14, magic: 6 }],
  [{ defense: 18, magicDefense: 9 }, { defense: 15, attack: 8 }, { magicDefense: 21, magic: 8 }],
  [{ defense: 25, magicDefense: 13 }, { defense: 21, attack: 10 }, { magicDefense: 29, magic: 10 }],
  [{ defense: 34, magicDefense: 17 }, { defense: 28, attack: 14 }, { magicDefense: 39, magic: 14 }],
];
test('all eighteen uploaded regional set stats are retained with repeatable party-copy rules', () => {
  const context = contextFor();
  sets.forEach((slots, index) => slots.forEach((stats, slot) => {
    const item = context.K(`R0${index + 1}_SET_${['HEAD', 'MANTLE', 'CHARM'][slot]}`);
    assert.deepEqual(plain(item.stats), stats);
    assert.equal(item.unique_per_save, false); assert.equal(item.sellable, false);
  }));
});

test('difficulty choices scale new enemies once and leave reward contributions unchanged', () => {
  const expected = { easy: { hp: 1, atk: 1, def: 1 }, normal: { hp: 1.35, atk: 1.25, def: 1.15 },
    hard: { hp: 1.8, atk: 1.6, def: 1.3 }, hell: { hp: 2.6, atk: 2.2, def: 1.6 } };
  const baseline = fixture(); baseline.game.setDifficulty('easy');
  const first = plain(authored(baseline));
  for (const [difficulty, multiplier] of Object.entries(expected)) {
    const fix = fixture(); assert.equal(fix.game.setDifficulty(difficulty), true);
    const battle = authored(fix);
    battle.enemies.forEach((enemy, index) => {
      const original = first.enemies[index];
      assert.equal(enemy.hp, Math.round(original.maxHp * multiplier.hp));
      assert.equal(enemy.maxHp, enemy.hp);
      assert.equal(enemy.attack, Math.round(original.attack * multiplier.atk));
      assert.equal(enemy.defense, Math.round(original.defense * multiplier.def));
    });
    assert.equal(battle.rewardXp, first.rewardXp); assert.equal(battle.rewardGold, first.rewardGold);
  }
});

test('difficulty is persisted, invalid choices are rejected, and earned resources stay intact', () => {
  const fix = fixture(), { game, reload } = fix;
  const before = plain({ gold: game.state.gold, hx: game.state.hx, inventory: game.state.inventory });
  for (const value of ['normal', 'hard', 'hell', 'easy']) {
    assert.equal(game.setDifficulty(value), true); assert.equal(reload().state.difficulty, value);
  }
  for (const value of [null, '', 'HARD', 'nightmare', {}, 1]) assert.equal(game.setDifficulty(value), false);
  assert.deepEqual(plain({ gold: game.state.gold, hx: game.state.hx, inventory: game.state.inventory }), before);
});

test('new light and dark spells retain school, tier and eligible jobs and require learning', () => {
  const fix = fixture('mender'), { context, game } = fix;
  for (const [id, element, tier, target, power] of [['lumen', 'light', 1, 'enemy', 13], ['umbra', 'dark', 1, 'enemy', 13],
    ['radiance', 'light', 3, 'allEnemies', 30], ['nightfall', 'dark', 3, 'allEnemies', 30]]) {
    const spell = context.te.find(candidate => candidate.id === id);
    assert.ok(spell); assert.equal(spell.element, element); assert.equal(spell.tier, tier);
    assert.equal(spell.target, target); assert.equal(spell.power, power);
    for (const id of ['Mara', 'Iona', 'Soren']) {
      assert.equal(context.H(hero(game, id), spell), true);
      assert.equal(context.knowsSpell(game.state, hero(game, id), spell), false);
      const offer = context.spellOffers(game.state, id).find(candidate => candidate.spellId === spell.id);
      if (tier === 1) { assert.ok(offer); assert.equal(offer.unlocked, true); }
      else assert.equal(offer, undefined, 'higher-tier skills belong to their region store');
    }
    assert.equal(context.H(hero(game, 'Tavin'), spell), false);
  }
  game.state.message = { speaker: 'Skill Shop', text: 'Shop fixture.' }; game.state.gold = 5000;
  assert.equal(game.buySpell('Iona', 'radiance'), false, 'R01 does not sell the R03 skill');
  assert.equal(game.buySpell('Iona', 'lumen'), true);
  assert.equal(game.buySpell('Iona', 'lumen'), false);
  assert.equal(context.knowsSpell(game.state, hero(game, 'Soren'), context.te.find(s => s.id === 'lumen')), false);
  // Reaching the regional merchant replaces character-level purchase gates.
  visitShop(context, game, 'fen', 'magic');
  assert.equal(hero(game, 'Iona').level, 1);
  assert.equal(game.buySpell('Iona', 'radiance'), true);
  assert.ok(fix.reload().state.learnedSpells.Iona.includes('radiance'));
});

test('one successful area spell gains one practice count and applies its attained level once', async () => {
  const fix = fixture(), { context, game } = fix;
  setLevel(fix, 'Iona', 9);
  game.state.learnedSpells.Iona.push('radiance'); game.state.sp = { Iona: { radiance: 1 } };
  practiceBattle(game, 3);
  const caster = hero(game, 'Iona'), mp = caster.mp;
  assert.equal(game.plan('Iona', { type: 'spell', spellId: 'radiance', target: 'all' }), true);
  guards(game); await game.resolveRound();
  assert.equal(game.state.sp.Iona.radiance, 2, 'count per cast, not per target');
  assert.equal(context.sLv(game.state, caster, context.te.find(s => s.id === 'radiance')), 2);
  assert.equal(caster.mp, mp - context.skillCost(context.te.find(skill => skill.id === 'radiance')));
  const expected = Math.round((30 + caster.magic * 2) * .7 * 1.1);
  for (const enemy of game.state.battle.enemies) assert.equal(enemy.maxHp - enemy.hp, expected);
});

test('uncast, unlearned, silenced, and depleted spells never gain practice', async () => {
  for (const reason of ['unlearned', 'silence', 'depleted']) {
    const { game } = fixture(); practiceBattle(game);
    game.state.learnedSpells.Iona.push('lumen');
    const caster = hero(game, 'Iona');
    if (reason === 'unlearned') {
      assert.equal(game.plan('Iona', { type: 'spell', spellId: 'umbra', target: 'target-0' }), false);
      game.plan('Iona', { type: 'guard', target: 'Iona' });
    } else {
      assert.equal(game.plan('Iona', { type: 'spell', spellId: 'lumen', target: 'target-0' }), true);
      if (reason === 'silence') caster.status = 'silence'; else caster.mp = 0;
    }
    guards(game); await game.resolveRound();
    assert.equal(game.state.sp?.Iona?.lumen ?? 0, 0, reason);
    assert.equal(game.state.sp?.Iona?.umbra ?? 0, 0, reason);
  }
});

test('battle recovery gains practice once while field casting retains uploaded battle-only progression', async () => {
  const { game } = fixture(); const caster = hero(game, 'Iona'), target = hero(game, 'Mara');
  target.hp = 1;
  assert.equal(game.castField('Iona', 'mend', 'Mara'), true);
  assert.equal(game.state.sp?.Iona?.mend ?? 0, 0);
  target.hp = 1; caster.mp = caster.maxMp;
  practiceBattle(game);
  assert.equal(game.plan('Iona', { type: 'spell', spellId: 'mend', target: 'Mara' }), true);
  guards(game); await game.resolveRound();
  assert.equal(game.state.sp.Iona.mend, 1);
});

test('physical family strengths retain uploaded damage types and weakness priority', () => {
  const fix = fixture(), { context, game } = fix;
  assert.deepEqual(plain(context.PHYS), { warden: 'slash', striker: 'pierce', mender: 'blunt', arcanist: 'blunt', scout: 'pierce', spellblade: 'slash' });
  for (const id of ['encounter1', 'encounter2', 'encounter3', 'encounter4']) {
    game.state.mode = 'explore'; game.state.battle = null;
    for (const enemy of authored(fix, id).enemies) {
      const family = context.FAMW[enemy.family];
      for (const weak of family?.w || []) assert.ok(enemy.weakness.includes(weak));
      for (const resist of family?.r || []) assert.equal(enemy.resistance.includes(resist), !enemy.weakness.includes(resist));
      assert.equal(new Set(enemy.weakness).size, enemy.weakness.length);
      assert.equal(enemy.resistance.some(value => enemy.weakness.includes(value)), false);
    }
  }
});

test('pre-difficulty deep saves migrate safely without changing equipment, resources, or story', () => {
  const { context, game, storage, reload } = fixture();
  game.state.area = 'heart-depth-8'; game.state.player = { x: 4, y: 18, facing: 'right' };
  game.state.campaign.stage = 9; game.state.gold = 733;
  game.state.campaign.switches.push('depth_heart_8_shortcut'); game.save();
  const saved = JSON.parse(storage.getItem(context.G)); delete saved.difficulty; delete saved.sp;
  storage.setItem(context.G, JSON.stringify(saved));
  const loaded = reload();
  assert.equal(loaded.state.mode, 'explore'); assert.equal(loaded.state.area, saved.area);
  assert.equal(loaded.state.difficulty, 'easy'); assert.equal(loaded.state.gold, 733);
  assert.deepEqual(plain(loaded.state.inventory), saved.inventory); assert.deepEqual(plain(loaded.state.hx), saved.hx);
  assert.deepEqual(plain(loaded.state.heroes.map(h => h.equipment)), saved.heroes.map(h => h.equipment));
  assert.ok(loaded.state.campaign.switches.includes('depth_heart_8_shortcut'));
});

test('valid spell practice and difficulty reload alongside new deep-floor progress', () => {
  const { context, game, reload } = fixture();
  game.state.difficulty = 'hell'; game.state.sp = { Iona: { mend: 17, radiance: 239 }, Soren: { ember: 240 } };
  game.state.area = 'works-depth-3'; game.state.player = { x: 4, y: 18, facing: 'right' }; game.save();
  const loaded = reload();
  assert.equal(loaded.state.area, 'works-depth-3'); assert.equal(loaded.state.difficulty, 'hell');
  assert.equal(loaded.state.sp.Iona.mend, 17); assert.equal(loaded.state.sp.Iona.radiance, 239);
  assert.equal(loaded.state.sp.Soren.ember, 240);
  assert.equal(context.sLv(loaded.state, hero(loaded, 'Soren'), context.te.find(s => s.id === 'ember')), 16);
});

test('malformed practice values cannot poison valid saved heroes or produce NaN magic', () => {
  const { context, game, storage, reload } = fixture();
  game.save(); const saved = JSON.parse(storage.getItem(context.G));
  saved.sp = { Mara: [], Tavin: 'broken', Iona: { mend: -99, lumen: 'oops', umbra: null, radiance: 2.5 }, Soren: { ember: 17, spark: {} }, nobody: { ember: 1 } };
  storage.setItem(context.G, JSON.stringify(saved));
  const loaded = reload(); assert.equal(loaded.state.mode, 'explore');
  assert.equal(loaded.state.sp.Soren.ember, 17, 'valid counts survive neighboring malformed fields');
  for (const traveler of loaded.state.heroes) for (const spell of context.te) {
    assert.ok(Number.isFinite(context.sLv(loaded.state, traveler, spell)));
    assert.ok(Number.isFinite(context.sMul(loaded.state, traveler, spell)));
  }
  assert.equal(loaded.state.sp.nobody, undefined);
  assert.equal(loaded.state.gold, saved.gold);
});

test('current thirty-three-floor world and lower future earnings survive the merge', () => {
  const context = contextFor();
  assert.equal(Object.keys(context.dungeonAreas).length, 33);
  assert.equal(context.k.length, 10);
  assert.deepEqual(plain(context.rewardPacing), { normal: { xp: .5, gold: .65 }, boss: { xp: .65, gold: .75 }, rare: { xp: .65, gold: .75 } });
  assert.ok(context.he['heart-depth-8']); assert.equal(context.dungeonInfo('heart-depth-8').floor, 8);
  assert.equal(typeof context.consumableValid, 'function', 'current no-waste fixes retained');
  assert.ok(context.be('Mara', 1, context.ye('Mara', context.R), context.R).magicDefense > 0);
});

test('an uploaded difficulty-build save imports its selected challenge and practice without resetting the journey', () => {
  const user = fixture('mender', path.join(root, 'difficulty-upload.html'));
  user.game.state.difficulty = 'hard';
  user.game.state.sp = { Mara: { mend: 7, lumen: 18 }, Iona: { mend: 31 }, Soren: { umbra: 2 } };
  user.game.state.learnedSpells.Mara.push('lumen'); user.game.state.learnedSpells.Soren.push('umbra');
  user.game.state.gold = 471; user.game.state.hx.Mara = 12;
  user.game.state.inventory.R02_COMMON_CHARM = 4;
  for (const traveler of [...user.game.state.heroes]) assert.equal(user.game.equip(traveler.id, 'R02_COMMON_CHARM'), true);
  user.game.save();
  const raw = user.storage.getItem(user.context.G), original = JSON.parse(raw);
  const context = contextFor();
  const saves = new Map([[context.G, raw]]);
  const storage = { getItem: key => saves.get(key) ?? null, setItem: (key, value) => saves.set(key, String(value)) };
  const loaded = context.Ee({ storage, seed: 7321, roundDelay: 0 });
  assert.equal(loaded.state.mode, 'explore'); assert.equal(loaded.state.gold, 471);
  assert.equal(loaded.state.difficulty, 'hard'); assert.deepEqual(plain(loaded.state.sp), original.sp);
  assert.deepEqual(plain(loaded.state.hx), original.hx);
  const expectedSkills = Object.fromEntries(loaded.state.heroes.map(traveler => [traveler.id,
    [...new Set([...original.learnedSpells[traveler.id], ...context.starterSkillIds(traveler.job)])]]));
  assert.deepEqual(plain(loaded.state.learnedSpells), expectedSkills,
    'the uploaded learned magic is preserved and only current basic job techniques are added');
  assert.deepEqual(plain(loaded.state.inventory), original.inventory);
  assert.ok(loaded.state.heroes.every(traveler => traveler.equipment.charm === 'R02_COMMON_CHARM'));
  assert.deepEqual(plain(loaded.state.profile), original.profile);
});

test('difficulty cannot change during messages, combat, results, or the prologue', () => {
  for (const mode of ['battle', 'victory', 'defeat', 'intro', 'ending', 'creation']) {
    const { game } = fixture(); game.state.mode = mode;
    const previous = game.state.difficulty;
    assert.equal(game.setDifficulty('hell'), false, mode); assert.equal(game.state.difficulty, previous);
  }
  const { game } = fixture(); game.state.message = { speaker: 'Speaker', text: 'Message' };
  assert.equal(game.setDifficulty('hard'), false); game.state.message = null;
  game.state.reward = { title: 'Cache', choices: [], lines: [] };
  assert.equal(game.setDifficulty('hard'), false);
});
