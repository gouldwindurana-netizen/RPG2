'use strict';

// Use actual authored encounters and the shipped planning/resolution path.
// Sleeping enemy fixtures prevent damage while isolating recovery feedback;
// these checks do not claim a campaign progression playthrough.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const html = fs.readFileSync(process.env.GAME_HTML || path.join(__dirname, '..', 'The_Road_Beyond_the_Bells.html'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));

function setup() {
  const c = vm.createContext({ structuredClone });
  vm.runInContext(html.slice(html.indexOf('var l={schemaVersion'), html.indexOf('var De=new Set')), c, { timeout: 5000 });
  const game = c.Ee({ storage: null, seed: 7321, roundDelay: 0 });
  assert.equal(game.beginAdventure({ ...c.R, name: 'Rowan' }), true);
  game.skipIntro(); game.configure({ encounters: 'visible' });
  return { c, game, cues: [] };
}
function hero(fix, id) { return fix.game.state.heroes.find(h => h.id === id); }
function level(fix, id, value) {
  const old = hero(fix, id);
  fix.game.state.hx[id] = fix.c.l.xp_thresholds[value - 1];
  fix.game.state.heroes[fix.game.state.heroes.indexOf(old)] = fix.c.be(id, value, old.equipment, fix.game.state.profile, old.job);
}
function begin(fix) {
  const enemy = fix.c.he.works.entities.find(entity => entity.id === 'encounter1');
  fix.game.state.area = 'works'; fix.game.state.player = { x: enemy.x, y: enemy.y + 1, facing: 'up' };
  fix.game.state.flags.briefed = true; fix.game.interact('encounter1');
  assert.equal(fix.game.state.mode, 'battle');
  for (const foe of fix.game.state.battle.enemies) foe.status = 'sleep';
  fix.game.subscribe(() => {
    const cue = fix.game.state.battle?.cue;
    if (cue) fix.cues.push(plain(cue));
  });
}
async function use(fix, actorId, action) {
  assert.equal(fix.game.plan(actorId, action), true);
  for (const ally of fix.game.state.heroes) if (ally.id !== actorId && ally.hp > 0 && ally.status !== 'sleep')
    assert.equal(fix.game.plan(ally.id, { type: 'guard', target: ally.id }), true);
  await fix.game.resolveRound();
  assert.equal(fix.game.state.mode, 'battle');
  assert.equal(fix.game.state.battle.round, 2);
  return fix.cues.find(cue => cue.actor === actorId && cue.kind === 'heal');
}
function earnings(fix) { return plain({ gold: fix.game.state.gold, xp: fix.game.state.xp, hx: fix.game.state.hx }); }

for (const [itemId, amount] of [['SPARK_TEA', 20], ['DEEP_TEA', 60]]) {
  test(`${itemId} reports its actual bounded MP gain and consumes one copy without extra awards`, async () => {
    for (const missing of [amount, 7]) {
      const fix = setup(); level(fix, 'Soren', 17);
      const target = hero(fix, 'Soren'); target.mp = target.maxMp - missing;
      fix.game.state.inventory[itemId] = 2;
      const before = earnings(fix), inventory = plain(fix.game.state.inventory), hp = target.hp, mp = target.mp;
      begin(fix);
      const cue = await use(fix, 'Mara', { type: 'item', itemId, target: 'Soren' });
      assert.ok(cue, 'a successful recovery produces a feedback cue');
      assert.equal(target.mp - mp, Math.min(amount, missing));
      assert.equal(cue.amount, target.mp - mp, 'feedback shows restored MP rather than zero HP change');
      assert.equal(cue.resource, 'mp');
      assert.equal(cue.target, 'Soren');
      assert.equal(target.hp, hp);
      inventory[itemId]--;
      assert.deepEqual(plain(fix.game.state.inventory), inventory, 'one copy is consumed');
      assert.deepEqual(earnings(fix), before);
      assert.ok(fix.game.state.heroes.every(h => h.mp >= 0 && h.mp <= h.maxMp));
    }
  });
}

test('a successful condition item has status feedback when it changes no HP', async () => {
  const fix = setup(), target = hero(fix, 'Mara'); target.status = 'poison';
  fix.game.state.inventory.ANTIDOTE = 2;
  const hp = target.hp, mp = fix.game.state.heroes.map(h => h.mp), before = earnings(fix);
  begin(fix);
  const cue = await use(fix, 'Tavin', { type: 'item', itemId: 'ANTIDOTE', target: 'Mara' });
  assert.ok(cue); assert.equal(cue.resource, 'status'); assert.equal(cue.amount, 0);
  assert.equal(cue.target, 'Mara'); assert.equal(target.status, null); assert.equal(target.hp, hp);
  assert.equal(fix.game.state.inventory.ANTIDOTE, 1);
  assert.deepEqual(fix.game.state.heroes.map(h => h.mp), mp);
  assert.deepEqual(earnings(fix), before);
});

test('Mend feedback equals HP actually restored, including maximum-HP clipping', async () => {
  for (const missing of [80, 5]) {
    const fix = setup(), target = hero(fix, 'Mara'), caster = hero(fix, 'Iona');
    target.hp = target.maxHp - missing;
    const hp = target.hp, mp = caster.mp, inventory = plain(fix.game.state.inventory), before = earnings(fix);
    begin(fix);
    const cue = await use(fix, 'Iona', { type: 'spell', spellId: 'mend', target: 'Mara' });
    assert.ok(cue); assert.equal(cue.target, 'Mara');
    assert.equal(cue.amount, target.hp - hp, 'cue includes job/magic modifiers and the actual HP cap');
    assert.ok(cue.amount > 0 && cue.amount <= missing);
    assert.equal(caster.mp, mp - fix.c.skillCost(fix.c.te.find(skill => skill.id === 'mend')));
    assert.equal(fix.game.state.sp.Iona.mend, 1);
    assert.deepEqual(plain(fix.game.state.inventory), inventory);
    assert.deepEqual(earnings(fix), before);
  }
});

test('group recovery feedback follows the first ally actually healed', async () => {
  const fix = setup(); level(fix, 'Iona', 5);
  fix.game.state.learnedSpells.Iona.push('renew');
  const target = hero(fix, 'Tavin'), caster = hero(fix, 'Iona'); target.hp = 10;
  hero(fix, 'Soren').hp = 5;
  const hp = target.hp, leaderHp = hero(fix, 'Mara').hp, mp = caster.mp, before = earnings(fix);
  begin(fix);
  const cue = await use(fix, 'Iona', { type: 'spell', spellId: 'renew', target: 'all' });
  assert.ok(cue); assert.equal(hero(fix, 'Mara').hp, leaderHp);
  assert.equal(cue.target, 'Tavin', 'a full-health leader should not receive another ally\'s recovery number');
  assert.equal(cue.amount, target.hp - hp);
  assert.ok(cue.amount > 0);
  assert.equal(caster.mp, mp - fix.c.skillCost(fix.c.te.find(skill => skill.id === 'renew')));
  assert.equal(fix.game.state.sp.Iona.renew, 1, 'group recovery progresses once');
  assert.deepEqual(earnings(fix), before);
});

test('Cleanse reports a condition recovery instead of a zero-HP miss', async () => {
  const fix = setup(); level(fix, 'Iona', 9);
  fix.game.state.learnedSpells.Iona.push('cleanse');
  const target = hero(fix, 'Mara'), caster = hero(fix, 'Iona'); target.status = 'poison';
  const hp = target.hp, mp = caster.mp, before = earnings(fix);
  begin(fix);
  const cue = await use(fix, 'Iona', { type: 'spell', spellId: 'cleanse', target: 'Mara' });
  assert.ok(cue); assert.equal(cue.resource, 'status'); assert.equal(cue.amount, 0);
  assert.equal(target.status, null); assert.equal(target.hp, hp);
  assert.equal(caster.mp, mp - fix.c.skillCost(fix.c.te.find(skill => skill.id === 'cleanse')));
  assert.equal(fix.game.state.sp.Iona.cleanse, 1);
  assert.deepEqual(earnings(fix), before);
});
