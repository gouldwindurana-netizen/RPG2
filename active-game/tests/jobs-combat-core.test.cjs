'use strict';

// Resolve real planned rounds from the shipped standalone engine. These inert
// battle/level fixtures isolate skill rules; they are not campaign playthroughs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const file = path.resolve(process.env.GAME_HTML || path.join(root, 'The_Road_Beyond_the_Bells.html'));
const html = fs.readFileSync(file, 'utf8');
const baseline = fs.readFileSync(path.join(root, 'jobs-baseline.html'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const techniques = [
  ['warden', 'shield-bash', 1, 3], ['warden', 'rally', 5, 5],
  ['warden', 'guardian-strike', 9, 7], ['warden', 'iron-cyclone', 17, 10],
  ['striker', 'power-strike', 1, 3], ['striker', 'sweeping-kick', 5, 5],
  ['striker', 'twin-fang', 9, 7], ['striker', 'driving-finish', 17, 10],
  ['scout', 'quickshot', 1, 3], ['scout', 'scatter-volley', 5, 5],
  ['scout', 'precision-strike', 9, 7], ['scout', 'horizon-shot', 17, 10],
  ['spellblade', 'arc-slash', 1, 3], ['spellblade', 'runic-sweep', 5, 5],
  ['spellblade', 'warding-circle', 9, 7], ['spellblade', 'runebreaker', 17, 10],
];

function setup(job = 'warden', source = html, level = 17) {
  const context = vm.createContext({ structuredClone });
  const start = source.indexOf('var l={schemaVersion'), end = source.indexOf('var De=new Set', start);
  assert.ok(start >= 0 && end > start, 'standalone engine is present');
  vm.runInContext(source.slice(start, end), context, { timeout: 5000, filename: file });
  const game = context.Ee({ storage: null, seed: 7321, roundDelay: 0 });
  assert.equal(game.beginAdventure({ ...context.R, name: 'Rowan', job }), true);
  game.skipIntro();
  levelHero(context, game, 'Mara', level, job);
  return { context, game };
}

function levelHero(context, game, id, level, job) {
  const old = game.state.heroes.find(hero => hero.id === id);
  game.state.hx[id] = context.l.xp_thresholds[level - 1];
  if (game.state.partyJobs) game.state.partyJobs[id] = job;
  if (id === 'Mara') game.state.profile.job = job;
  const hero = context.be(id, level, old.equipment, game.state.profile, job);
  game.state.heroes[game.state.heroes.indexOf(old)] = hero;
  return hero;
}

function hero(fix, id = 'Mara') { return fix.game.state.heroes.find(hero => hero.id === id); }
function skill(fix, id) {
  const found = fix.context.te.find(skill => skill.id === id);
  assert.ok(found, `catalog contains ${id}`);
  return found;
}
function learn(fix, actorId, skillId) {
  if (!fix.game.state.learnedSpells[actorId].includes(skillId)) fix.game.state.learnedSpells[actorId].push(skillId);
}

function battle(fix, count = 3, options = {}) {
  fix.game.state.message = null; fix.game.state.reward = null; fix.game.state.mode = 'battle';
  fix.game.state.battle = {
    encounterId: 'job-skill-probe', title: 'Skill probe', regionId: 'R01', kind: 'normal',
    round: 1, phase: 'planning', plans: {}, log: [],
    enemies: Array.from({ length: count }, (_, index) => ({
      id: `probe-${index}`, name: `Probe ${index + 1}`, hp: 100000, maxHp: 100000,
      attack: options.attack ?? 0, defense: options.defense ?? 10,
      family: 'HOUND', rank: 'base', status: options.status === undefined ? 'sleep' : options.status,
      statusChance: 0, weakness: options.weakness ?? [], resistance: options.resistance ?? [],
      rewardXp: 0, rewardGold: 0,
    })),
  };
  return fix.game.state.battle;
}

function queueOthers(fix, actorId, type = 'guard') {
  for (const ally of fix.game.state.heroes) if (ally.id !== actorId && ally.hp > 0 && ally.status !== 'sleep')
    assert.equal(fix.game.plan(ally.id, { type, target: type === 'attack' ? 'probe-0' : ally.id }), true);
}

async function cast(fix, actorId, skillId, target) {
  const choice = skill(fix, skillId);
  target ??= choice.target === 'allEnemies' || choice.target === 'allAllies' ? 'all' : 'probe-0';
  assert.equal(fix.game.plan(actorId, { type: 'spell', spellId: skillId, target }), true, `${actorId} plans ${skillId}`);
  queueOthers(fix, actorId);
  await fix.game.resolveRound();
  return choice;
}

function resources(fix) {
  return plain({ gold: fix.game.state.gold, hx: fix.game.state.hx, xp: fix.game.state.xp, inventory: fix.game.state.inventory });
}

test('forty unique skills retain all old magic and give each martial job four MP techniques', () => {
  const fix = setup();
  assert.equal(fix.context.te.length, 40);
  assert.equal(new Set(fix.context.te.map(skill => skill.id)).size, 40);
  assert.equal(fix.context.te.filter(skill => skill.kind === 'magic').length, 24);
  assert.equal(fix.context.te.filter(skill => skill.kind === 'technique').length, 16);
  for (const [job, id, levelRequired, mpCost] of techniques) {
    const choice = skill(fix, id);
    assert.equal(choice.kind, 'technique');
    assert.deepEqual(plain(choice.jobs), [job]);
    assert.equal(choice.levelRequired, levelRequired);
    assert.equal(fix.context.skillCost(choice), mpCost);
    assert.ok(Number.isInteger(choice.price) && choice.price > 0);
  }
  const old = setup('warden', baseline);
  for (const previous of old.context.te) {
    const current = skill(fix, previous.id);
    for (const key of ['name', 'tier', 'target', 'effect', 'power', 'element'])
      assert.deepEqual(current[key], previous[key], `${previous.id}/${key} remains authored`);
    assert.ok(Number.isInteger(fix.context.skillCost(current)) && fix.context.skillCost(current) > 0);
  }
});

for (const [job, id] of techniques) {
  test(`${job}/${id} spends MP once, progresses once and affects the intended targets`, async () => {
    const fix = setup(job); const actor = hero(fix); learn(fix, actor.id, id);
    const encounter = battle(fix), choice = skill(fix, id);
    if (choice.effect === 'protect') fix.game.state.heroes[1].hp -= 10;
    const before = resources(fix), mana = actor.mp;
    const health = fix.game.state.heroes.map(hero => hero.hp);
    assert.equal(fix.game.plan(actor.id, { type: 'spell', spellId: id, target: choice.target === 'enemy' ? 'probe-0' : 'all' }), true);
    assert.equal(actor.mp, mana, 'planning does not spend MP');
    assert.equal(fix.game.state.sp[actor.id]?.[id] ?? 0, 0, 'planning grants no practice');
    queueOthers(fix, actor.id); await fix.game.resolveRound();
    assert.equal(fix.game.state.mode, 'battle');
    assert.equal(actor.mp, mana - fix.context.skillCost(choice));
    assert.equal(fix.game.state.sp[actor.id][id], 1, 'group targets grant only one practice use');
    const damage = encounter.enemies.map(enemy => enemy.maxHp - enemy.hp);
    if (choice.effect === 'protect') {
      assert.ok(damage.every(amount => amount === 0));
      assert.deepEqual(fix.game.state.heroes.map(hero => hero.hp), health, 'guard skills do not heal or refill');
      assert.ok(encounter.log.some(line => line.includes(choice.name)));
    } else if (choice.target === 'allEnemies') assert.ok(damage.every(amount => amount > 0));
    else {
      assert.ok(damage[0] > 0);
      assert.deepEqual(damage.slice(1), [0, 0], 'single-target skill leaves other foes untouched');
    }
    assert.deepEqual(resources(fix), before, 'skills do not create inventory, EXP or gold');
  });
}

test('MP, job, learning and sleep gates refuse plans while learned skills have no level gate', () => {
  const fix = setup('warden', html, 1); const actor = hero(fix); battle(fix);
  const before = resources(fix);
  learn(fix, actor.id, 'shield-bash'); actor.mp = 2;
  assert.equal(fix.game.plan(actor.id, { type: 'spell', spellId: 'shield-bash', target: 'probe-0' }), false);
  actor.mp = actor.maxMp;
  for (const id of ['power-strike']) {
    learn(fix, actor.id, id);
    assert.equal(fix.game.plan(actor.id, { type: 'spell', spellId: id, target: 'probe-0' }), false, id);
  }
  learn(fix, actor.id, 'guardian-strike');
  assert.equal(actor.level, 1);
  assert.equal(fix.game.plan(actor.id, { type: 'spell', spellId: 'guardian-strike', target: 'probe-0' }), true);
  fix.game.undo(actor.id);
  assert.equal(fix.game.state.battle.plans[actor.id], undefined);
  fix.game.state.learnedSpells.Mara = [];
  assert.equal(fix.game.plan(actor.id, { type: 'spell', spellId: 'shield-bash', target: 'probe-0' }), false);
  learn(fix, actor.id, 'shield-bash'); actor.status = 'sleep';
  assert.equal(fix.game.plan(actor.id, { type: 'spell', spellId: 'shield-bash', target: 'probe-0' }), false);
  assert.deepEqual(plain(fix.game.state.battle.plans), {});
  assert.equal(fix.game.state.sp.Mara?.['shield-bash'] ?? 0, 0);
  assert.deepEqual(resources(fix), before);
});

test('silence blocks magic but permits a learned martial technique', async () => {
  const martial = setup('warden'); const fighter = hero(martial);
  fighter.status = 'silence'; learn(martial, 'Mara', 'shield-bash'); battle(martial, 1);
  const before = fighter.mp;
  await cast(martial, 'Mara', 'shield-bash');
  assert.equal(fighter.mp, before - 3);
  assert.ok(martial.game.state.battle.enemies[0].hp < 100000);
  const magical = setup('arcanist'); const caster = hero(magical);
  caster.status = 'silence'; learn(magical, 'Mara', 'ember'); battle(magical, 1);
  const mana = caster.mp;
  assert.equal(magical.game.plan('Mara', { type: 'spell', spellId: 'ember', target: 'probe-0' }), false);
  assert.equal(caster.mp, mana);
  assert.equal(magical.game.state.sp.Mara?.ember ?? 0, 0);
});

test('execution rechecks MP and silence instead of spending into a negative pool', async () => {
  for (const [job, id, changed] of [['warden','shield-bash','mp'], ['arcanist','ember','silence']]) {
    const fix = setup(job); const actor = hero(fix); learn(fix, actor.id, id); battle(fix, 1);
    assert.equal(fix.game.plan(actor.id, { type: 'spell', spellId: id, target: 'probe-0' }), true);
    if (changed === 'mp') actor.mp = fix.context.skillCost(skill(fix, id)) - 1;
    else actor.status = 'silence';
    const mana = actor.mp;
    queueOthers(fix, actor.id); await fix.game.resolveRound();
    assert.equal(actor.mp, mana);
    assert.equal(fix.game.state.battle.enemies[0].hp, 100000);
    assert.equal(fix.game.state.sp[actor.id]?.[id] ?? 0, 0);
  }
});

test('changed healing and cure targets keep their MP and grant no practice', async () => {
  for (const id of ['mend', 'cleanse']) {
    const fix = setup(); const caster = levelHero(fix.context, fix.game, 'Iona', 17, 'mender');
    const target = hero(fix); learn(fix, 'Iona', id); battle(fix, 1);
    target.hp -= 10; if (id === 'cleanse') target.status = 'poison';
    assert.equal(fix.game.plan('Iona', { type: 'spell', spellId: id, target: target.id }), true);
    if (id === 'mend') target.hp = 0; else target.status = null;
    const mana = caster.mp;
    queueOthers(fix, 'Iona'); await fix.game.resolveRound();
    assert.equal(caster.mp, mana);
    assert.equal(fix.game.state.sp.Iona?.[id] ?? 0, 0);
  }
});

test('a single-target technique retargets a fallen foe without paying twice', async () => {
  const fix = setup('striker'); const actor = hero(fix); learn(fix, 'Mara', 'power-strike');
  const encounter = battle(fix, 2), mana = actor.mp;
  assert.equal(fix.game.plan('Mara', { type: 'spell', spellId: 'power-strike', target: 'probe-0' }), true);
  encounter.enemies[0].hp = 0;
  queueOthers(fix, 'Mara'); await fix.game.resolveRound();
  assert.ok(encounter.enemies[1].hp < 100000);
  assert.equal(actor.mp, mana - 3);
  assert.equal(fix.game.state.sp.Mara['power-strike'], 1);
});

async function techniqueDamage(id, options = {}) {
  const [job] = techniques.find(([, candidate]) => candidate === id);
  const fix = setup(job); learn(fix, 'Mara', id); battle(fix, 1, options);
  if (options.practice !== undefined) fix.game.state.sp.Mara = { [id]: options.practice };
  await cast(fix, 'Mara', id);
  return 100000 - fix.game.state.battle.enemies[0].hp;
}

test('physical affinities, piercing and mastery remain meaningful while damage stays positive', async () => {
  const neutral = await techniqueDamage('power-strike');
  const weak = await techniqueDamage('power-strike', { weakness: ['pierce'] });
  const resisted = await techniqueDamage('power-strike', { resistance: ['pierce'] });
  assert.ok(weak > neutral && neutral > resisted && resisted > 0);
  const precisionClear = await techniqueDamage('precision-strike', { defense: 0 });
  const precisionArmor = await techniqueDamage('precision-strike', { defense: 30 });
  const quickClear = await techniqueDamage('quickshot', { defense: 0 });
  const quickArmor = await techniqueDamage('quickshot', { defense: 30 });
  assert.ok(precisionArmor / precisionClear > quickArmor / quickClear, 'piercing preserves a larger fraction of damage through armor');
  assert.ok(await techniqueDamage('precision-strike', { defense: 100000 }) > 0, 'extreme armor cannot create healing or zero damage');
  assert.ok(await techniqueDamage('power-strike', { practice: 1 }) > neutral, 'the cast reaching spell level two gains the existing mastery bonus');
});

for (const [job, id] of [['warden', 'rally'], ['spellblade', 'warding-circle']]) {
  test(`${id} protects another ally from an announced strike without healing`, async () => {
    async function run(useSkill) {
      const fix = setup(job); learn(fix, 'Mara', id); battle(fix, 1, { attack: 30, status: null });
      fix.game.state.rng = 3254; // Mara acts before the enemy, which targets Soren.
      const actor = hero(fix), mana = actor.mp;
      assert.equal(fix.game.plan('Mara', useSkill ? { type: 'spell', spellId: id, target: 'all' } : { type: 'guard', target: 'Mara' }), true);
      queueOthers(fix, 'Mara', 'attack');
      await fix.game.resolveRound();
      assert.equal(actor.mp, mana - (useSkill ? fix.context.skillCost(skill(fix, id)) : 0));
      return { hp: hero(fix, 'Soren').hp, maximum: hero(fix, 'Soren').maxHp };
    }
    const guarded = await run(true), ordinary = await run(false);
    assert.ok(guarded.hp > ordinary.hp, 'group protection benefits the exposed companion');
    assert.ok(guarded.hp < guarded.maximum, 'protection mitigates rather than healing or granting immunity');
  });
}

test('repeating unaffordable skills falls back to a valid free attack and never spends during planning', () => {
  const fix = setup('striker'); const actor = hero(fix); learn(fix, 'Mara', 'power-strike'); battle(fix, 1);
  fix.game.state.battle.lastPlans = { Mara: { type: 'spell', spellId: 'power-strike', target: 'probe-0' } };
  actor.mp = 0;
  fix.game.repeatPlans();
  assert.equal(fix.game.state.battle.plans.Mara.type, 'attack');
  assert.equal(actor.mp, 0);
  assert.equal(fix.game.state.sp.Mara?.['power-strike'] ?? 0, 0);
});

test('basic attacks and guarding remain free and retain the previous deterministic round', async () => {
  const next = setup(), previous = setup('warden', baseline);
  for (const fix of [next, previous]) {
    battle(fix, 1);
    assert.equal(fix.game.plan('Mara', { type: 'attack', target: 'probe-0' }), true);
    queueOthers(fix, 'Mara');
  }
  const mana = next.game.state.heroes.map(hero => hero.mp), before = resources(next);
  await next.game.resolveRound(); await previous.game.resolveRound();
  assert.deepEqual(next.game.state.heroes.map(hero => hero.mp), mana);
  assert.equal(next.game.state.battle.enemies[0].hp, previous.game.state.battle.enemies[0].hp);
  assert.equal(next.game.state.rng, previous.game.state.rng);
  assert.deepEqual(resources(next), before);
  assert.deepEqual(plain(next.game.state.sp), {});
});

for (const id of ['ember', 'wave']) {
  test(`existing ${id} damage and mastery keep their authored effect while paying MP`, async () => {
    const next = setup('arcanist'), previous = setup('arcanist', baseline);
    for (const fix of [next, previous]) {
      learn(fix, 'Mara', id); battle(fix, 3, { weakness: ['lightning'], resistance: ['frost'] });
    }
    const mana = hero(next).mp;
    await cast(next, 'Mara', id); await cast(previous, 'Mara', id);
    assert.deepEqual(next.game.state.battle.enemies.map(enemy => enemy.hp), previous.game.state.battle.enemies.map(enemy => enemy.hp));
    assert.deepEqual(plain(next.game.state.sp), plain(previous.game.state.sp));
    assert.equal(hero(next).mp, mana - next.context.skillCost(skill(next, id)));
  });
}
