'use strict';

// Cast the shipped battle spell, then use its ordinary retreat/save path.
// The isolated enemy is inert so the recovery amount is directly observable.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(process.env.GAME_HTML || path.join(__dirname, '..', 'The_Road_Beyond_the_Bells.html'), 'utf8');

function setup(spellId, practice) {
  const start = html.indexOf('var l={schemaVersion');
  const end = html.indexOf('var De=new Set', start);
  assert.ok(start >= 0 && end > start);
  const context = vm.createContext({ structuredClone });
  vm.runInContext(html.slice(start, end), context, { timeout: 5000 });
  const saves = new Map();
  const storage = { getItem: key => saves.get(key) ?? null, setItem: (key, value) => saves.set(key, String(value)) };
  const game = context.Ee({ storage, seed: 7321, roundDelay: 0 });
  game.beginAdventure({ ...context.R, name: 'Rowan' }); game.skipIntro();
  const old = game.state.heroes.find(hero => hero.id === 'Iona');
  game.state.hx.Iona = context.l.xp_thresholds[30];
  const caster = context.be('Iona', 31, old.equipment, game.state.profile);
  game.state.heroes[game.state.heroes.indexOf(old)] = caster;
  game.state.learnedSpells.Iona.push(spellId);
  game.state.sp = { Iona: { [spellId]: practice } };
  const target = game.state.heroes[0]; target.hp = 0; target.status = 'poison';
  game.state.mode = 'battle';
  game.state.battle = { encounterId: 'rebirth-recovery-probe', title: 'Recovery probe', kind: 'normal', regionId: 'R01',
    round: 1, phase: 'planning', plans: {}, log: [], enemies: [{ id: 'inert', name: 'Inert target',
      hp: 100000, maxHp: 100000, attack: 0, defense: 0, family: 'HOUND', rank: 'base',
      weakness: [], resistance: [], status: 'sleep', statusChance: 0 }] };
  return { context, game, caster, target, storage,
    reload: () => context.Ee({ storage, seed: 7321, roundDelay: 0 }) };
}

async function cast(fix, spellId) {
  const { game } = fix;
  assert.equal(game.plan('Iona', { type: 'spell', spellId, target: 'Mara' }), true);
  for (const hero of game.state.heroes) if (hero.hp > 0 && hero.id !== 'Iona')
    assert.equal(game.plan(hero.id, { type: 'guard', target: hero.id }), true);
  await game.resolveRound();
  assert.equal(game.state.mode, 'battle');
  assert.equal(game.state.battle.phase, 'planning');
}

for (const [startingCasts, attainedLevel] of [[1, 2], [239, 16], [240, 16]]) {
  test(`Rebirth at spell level ${attainedLevel}, from ${startingCasts} casts, caps HP and survives retreat/reload`, async () => {
    const fix = setup('rebirth', startingCasts);
    const mp = fix.caster.mp, cost = fix.context.skillCost(fix.context.te.find(skill => skill.id === 'rebirth'));
    await cast(fix, 'rebirth');
    assert.equal(fix.target.hp, fix.target.maxHp, 'growth cannot create HP above the hero maximum');
    assert.equal(fix.target.status, null);
    assert.equal(fix.caster.mp, mp - cost);
    assert.equal(fix.game.state.sp.Iona.rebirth, startingCasts + 1);
    assert.equal(fix.context.sLv(fix.game.state, fix.caster, fix.context.te.find(spell => spell.id === 'rebirth')), attainedLevel);
    fix.game.state.rng = 1; // First legal normal retreat succeeds with this seed.
    await fix.game.flee();
    assert.equal(fix.game.state.mode, 'explore');
    assert.equal(fix.game.state.battle, null);
    assert.equal(fix.game.save(), true);
    const loaded = fix.reload();
    assert.equal(loaded.state.mode, 'explore', 'the save must import rather than reset to character creation');
    assert.equal(loaded.state.heroes[0].hp, loaded.state.heroes[0].maxHp);
    assert.equal(loaded.state.sp.Iona.rebirth, startingCasts + 1);
    assert.equal(loaded.state.heroes.find(hero => hero.id === 'Iona').mp, mp - cost);
  });
}

test('Revive still benefits from spell growth up to its permitted health cap', async () => {
  const fix = setup('revive', 239);
  await cast(fix, 'revive');
  // Level sixteen multiplies its original 35 percent power by 2.5, rounded to 88.
  assert.equal(fix.target.hp, Math.round(fix.target.maxHp * .88));
  assert.ok(fix.target.hp > Math.round(fix.target.maxHp * .35));
  assert.ok(fix.target.hp <= fix.target.maxHp);
});
