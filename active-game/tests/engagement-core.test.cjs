'use strict';

// Exercise the shipped engine. Position and reward-isolation fixtures below do
// not claim a full regional campaign playthrough.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const file = process.env.GAME_HTML || path.join(root, 'The_Road_Beyond_the_Bells.html');
const html = fs.readFileSync(file, 'utf8');
const core = html.slice(html.indexOf('var l={schemaVersion'), html.indexOf('var De=new Set'));
const plain = value => JSON.parse(JSON.stringify(value));

function setup() {
  const context = vm.createContext({ structuredClone });
  vm.runInContext(core, context, { timeout: 5000 });
  const saves = new Map(), storage = {
    getItem: key => saves.get(key) ?? null,
    setItem: (key, value) => saves.set(key, String(value)),
  };
  const game = context.Ee({ storage, seed: 7321, roundDelay: 0 });
  game.beginAdventure({ ...context.R, name: 'Rowan' }); game.skipIntro();
  return { context, game, saves, reload: () => context.Ee({ storage, seed: 7321, roundDelay: 0 }) };
}
function clear(game) { while (game.state.message) game.dismiss(); }
function board(fix, regionId = 'R01') {
  const region = fix.context.wayfarerRegions.find(region => region.id === regionId);
  const { game } = fix;
  clear(game); game.state.campaign.stage = Math.max(game.state.campaign.stage, region.minStage);
  const entity = fix.context.he[region.town].entities.find(entity => entity.id === `wayfarer-board-${regionId}`);
  game.state.area = region.town; game.state.player = { x: entity.x, y: entity.y + 1, facing: 'up' };
  // The ordinary E interaction must select this board without an explicit ID.
  game.interact();
  assert.equal(game.state.message?.speaker, 'Wayfarer Board');
}
function begin(fix, id) {
  const { game, context } = fix;
  clear(game); game.configure({ encounters: 'visible' });
  if (id === 'silver' && context.regionalRareFor) { id = 'encounter1'; game.state.rng = 1; }
  const located = Object.values(context.he).flatMap(map => map.entities.map(entity => ({ map, entity }))).find(row => row.entity.id === id);
  assert.ok(located, id); game.state.area = located.map.area || 'works';
  game.state.player = { x: located.entity.x, y: located.entity.y + 1, facing: 'up' };
  game.interact(id); assert.equal(game.state.mode, 'battle');
  return game.state.battle;
}
async function isolatedWin(fix, id) {
  const battle = begin(fix, id);
  for (const hero of fix.game.state.heroes) assert.equal(fix.game.plan(hero.id, { type: 'guard', target: hero.id }), true);
  for (const enemy of battle.enemies) enemy.hp = 0;
  await fix.game.resolveRound(); assert.equal(fix.game.state.mode, 'victory');
  return battle;
}
function finish(game) {
  if (game.state.reward?.choices.length) game.claim(game.state.reward.choices[0]);
  game.continue(); clear(game);
}
function snapshotResources(game) {
  return plain({ gold: game.state.gold, inventory: game.state.inventory, hx: game.state.hx,
    heroes: game.state.heroes, learnedSpells: game.state.learnedSpells, difficulty: game.state.difficulty, sp: game.state.sp });
}

test('six safe regional boards are reachable without adding world sites or blocking exits', () => {
  const { context } = setup();
  assert.equal(context.k.length, 10);
  for (const region of context.wayfarerRegions) {
    const map = context.he[region.town], board = map.entities.find(entity => entity.id === `wayfarer-board-${region.id}`);
    assert.ok(board); assert.equal(context.p(region.town, board.x, board.y), true);
    assert.equal(map.entities.filter(entity => entity.x === board.x && entity.y === board.y).length, 1);
    assert.equal(map.entities.some(entity => entity.id !== board.id && entity.kind === 'npc' &&
      Math.abs(entity.x - board.x) + Math.abs(entity.y - board.y) <= 2), false,
      `${region.id} board label and interaction approach are clear of other NPCs`);
    const entry = context.g[`enter-${region.town}`], queue = [{ x: entry.x, y: entry.y }], seen = new Set();
    while (queue.length) {
      const point = queue.shift(), key = `${point.x},${point.y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const x = point.x + dx, y = point.y + dy;
        if (!context.q.includes(map.tiles[y]?.[x] || '?') || map.entities.some(entity => entity.x === x && entity.y === y)) continue;
        queue.push({ x, y });
      }
    }
    for (const entity of map.entities.filter(entity => entity.wayfarerRegion || entity.kind === 'exit'))
      assert.ok([[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy]) => seen.has(`${entity.x + dx},${entity.y + dy}`)), `${region.id}/${entity.id} has a reachable approach`);
  }
});

test('eighteen local commissions have distinct authored goals and modest once-only supplies', () => {
  const { context, game } = setup();
  assert.equal(context.wayfarerContracts.length, 18);
  assert.equal(new Set(context.wayfarerContracts.map(contract => contract.id)).size, 18);
  for (const region of context.wayfarerRegions) {
    const summary = context.wayfarerSummary(game.state, region.id);
    assert.equal(summary.contracts.length, 3);
    assert.deepEqual(plain(summary.contracts.map(contract => contract.kind)), ['patrol','survey','recovery']);
    for (const contract of summary.contracts) {
      assert.ok(contract.reward.gold > 0 && contract.reward.gold <= 300);
      assert.equal(Object.hasOwn(contract.reward, 'xp'), false);
      assert.equal(contract.ready, false);
      for (const [id, quantity] of Object.entries(contract.reward.items)) {
        assert.equal(context.K(id).kind, 'consumable'); assert.ok(quantity >= 1 && quantity <= 2);
      }
    }
  }
});

test('acceptance requires the physical local board and the region story gate', () => {
  const fix = setup(), { game, context } = fix;
  const before = JSON.stringify(game.state);
  assert.equal(game.acceptCommission('R01-patrol'), false);
  assert.equal(JSON.stringify(game.state), before);
  board(fix);
  assert.equal(game.acceptCommission('R02-patrol'), false);
  assert.equal(game.acceptCommission('unknown'), false);
  assert.equal(game.acceptCommission('R01-patrol'), true);
  assert.equal(game.acceptCommission('R01-patrol'), false);
  assert.equal(context.wayfarerSummary(game.state).boardRegion, 'R01');
  game.state.player.x = 20;
  assert.equal(game.acceptCommission('R01-survey'), false);
  const dunmereBoard = context.he.dunmere.entities.find(entity => entity.wayfarerRegion === 'R02');
  game.state.area = 'dunmere'; game.state.player = { x:dunmereBoard.x,y:dunmereBoard.y+1,facing:'up' };
  game.state.message = { speaker:'Wayfarer Board', text:'Fixture' };
  assert.equal(game.acceptCommission('R02-patrol'), false);
  game.state.campaign.stage = 2;
  assert.equal(game.acceptCommission('R02-patrol'), true);
});

test('post-acceptance formation kills count every ordinary foe and pay no automatic commission reward', async () => {
  const fix = setup(), { context, game } = fix;
  await isolatedWin(fix, 'encounter1'); finish(game);
  board(fix); assert.equal(game.acceptCommission('R01-patrol'), true);
  assert.equal(game.state.wayfarer.accepted['R01-patrol'], 2);
  assert.equal(context.wayfarerSummary(game.state).contracts[0].progress[0].current, 0);
  const before = game.state.gold;
  const battle = await isolatedWin(fix, 'encounter3');
  assert.equal(game.state.wayfarer.kills.R01, 6);
  assert.equal(game.state.gold, before + battle.rewardGold, 'only ordinary battle gold pays at victory');
  const recorded = JSON.stringify(game.state.wayfarer);
  await game.resolveRound(); assert.equal(JSON.stringify(game.state.wayfarer), recorded);
  finish(game);
  board(fix); assert.equal(context.wayfarerSummary(game.state).contracts[0].progress[0].current, 4);
  assert.equal(game.claimCommission('R01-patrol'), false);
});

test('an ordinary fight won through actual planned attacks records earned bestiary knowledge', async () => {
  const fix = setup(), { context, game } = fix;
  const battle = begin(fix, 'encounter1');
  for (let round = 0; game.state.mode === 'battle' && round < 10; round++) {
    for (const hero of game.state.heroes) if (hero.hp > 0 && hero.status !== 'sleep')
      assert.equal(game.plan(hero.id, { type: 'attack', target: battle.enemies.find(enemy => enemy.hp > 0).id }), true);
    await game.resolveRound();
  }
  assert.equal(game.state.mode, 'victory');
  const summary = context.wayfarerSummary(game.state);
  assert.equal(summary.totalDefeated, 2); assert.equal(summary.bestiary.length, 1);
  assert.equal(summary.bestiary[0].defeated, 2);
  assert.equal(summary.bestiary[0].key, 'R01|R01_E2|base');
  assert.equal(summary.bestiary[0].name.endsWith(' 1'), false);
  assert.equal(Object.hasOwn(summary.bestiary[0], 'hp'), false, 'difficulty-dependent stats are not invented');
});

test('retreat and party defeat cannot credit commissions or reveal unearned enemy entries', async () => {
  const fix = setup(), { game } = fix;
  board(fix); game.acceptCommission('R01-patrol');
  begin(fix, 'encounter1');
  const before = plain(game.state.wayfarer); game.state.rng = 1;
  await game.flee(); assert.equal(game.state.mode, 'explore');
  assert.deepEqual(plain(game.state.wayfarer), before);
  begin(fix, 'encounter2');
  for (const hero of game.state.heroes) hero.hp = 0;
  await game.resolveRound(); assert.equal(game.state.mode, 'defeat');
  assert.deepEqual(plain(game.state.wayfarer), before);
});

test('bestiary separates palette ranks and includes boss and rare victory units without patrol credit', async () => {
  const fix = setup(), { game, context } = fix;
  await isolatedWin(fix, 'encounter5'); finish(game);
  let summary = context.wayfarerSummary(game.state);
  assert.ok(summary.bestiary.some(entry => entry.rank === 'ashen'));
  const ordinaryKills = game.state.wayfarer.kills.R01;
  await isolatedWin(fix, 'bailiff'); finish(game);
  game.state.hunts.R01.ready = true;
  await isolatedWin(fix, 'silver');
  summary = context.wayfarerSummary(game.state);
  assert.equal(summary.bestiary.find(entry => entry.rank === 'boss').key, 'R01|B_R01_BAILIFF|boss');
  assert.equal(summary.bestiary.find(entry => entry.rank === 'rare').key, 'R01|R01_RARE|rare');
  assert.equal(game.state.wayfarer.kills.R01, ordinaryKills);
});

test('prior record and lift discoveries satisfy survey and route goals without granting combat progress', () => {
  const fix = setup(), { game, context } = fix;
  game.state.campaign.switches.push('depth_works_2_record','depth_works_3_record','depth_works_3_shortcut');
  board(fix); game.acceptCommission('R01-survey'); game.acceptCommission('R01-recovery');
  const summary = context.wayfarerSummary(game.state);
  assert.equal(summary.contracts.find(contract => contract.kind === 'survey').ready, true);
  const recovery = summary.contracts.find(contract => contract.kind === 'recovery');
  assert.deepEqual(plain(recovery.progress.map(goal => goal.current)), [1,0]);
  assert.equal(recovery.ready, false);
});

test('all eighteen commission rewards claim once at their own board and preserve EXP and hero resources', () => {
  const fix = setup(), { game, context, reload } = fix;
  for (const region of context.wayfarerRegions) {
    board(fix, region.id);
    for (const contract of context.wayfarerSummary(game.state, region.id).contracts) game.acceptCommission(contract.id);
    game.state.wayfarer.kills[region.id] += 6;
    game.state.campaign.switches.push(`depth_${region.root}_2_record`,`depth_${region.root}_3_record`,`depth_${region.root}_3_shortcut`);
    for (const contract of context.wayfarerSummary(game.state, region.id).contracts) {
      assert.equal(contract.ready, true);
      const before = snapshotResources(game);
      assert.equal(game.claimCommission(contract.id), true);
      assert.equal(game.state.gold, before.gold + contract.reward.gold);
      for (const [id,quantity] of Object.entries(contract.reward.items)) assert.equal(game.state.inventory[id], (before.inventory[id] ?? 0) + quantity);
      assert.deepEqual(plain(game.state.hx), before.hx); assert.deepEqual(plain(game.state.heroes), before.heroes);
      assert.equal(game.claimCommission(contract.id), false);
    }
  }
  assert.equal(game.state.wayfarer.claimed.length, 18);
  const restored = reload(); assert.equal(restored.state.mode, 'explore');
  assert.deepEqual(plain(restored.state.wayfarer), plain(game.state.wayfarer));
});

test('claiming is atomic when a reward cannot fit its actual item stack limit or gold cap', () => {
  const fix = setup(), { game, context } = fix;
  board(fix); game.acceptCommission('R01-survey');
  game.state.campaign.switches.push('depth_works_2_record','depth_works_3_record');
  game.state.inventory.CAMP_MEAL = context.K('CAMP_MEAL').stack_limit;
  let before = snapshotResources(game);
  assert.match(context.wayfarerSummary(game.state).contracts[1].claimBlocked, /Make room/);
  assert.equal(game.claimCommission('R01-survey'), false);
  assert.deepEqual(snapshotResources(game), before); assert.equal(game.state.wayfarer.claimed.length, 0);
  game.state.inventory.CAMP_MEAL--; game.state.gold = 10000000;
  before = snapshotResources(game); assert.equal(game.claimCommission('R01-survey'), false);
  assert.deepEqual(snapshotResources(game), before);
  game.state.gold = 100; assert.equal(game.claimCommission('R01-survey'), true);
  assert.equal(game.state.inventory.CAMP_MEAL, context.K('CAMP_MEAL').stack_limit);
});

test('old saves inherit empty optional records while existing uploaded and equipment progress survives', () => {
  const fix = setup(), { game, context } = fix;
  game.state.inventory.R02_COMMON_CHARM = 4;
  for (const hero of game.state.heroes) assert.equal(game.equip(hero.id,'R02_COMMON_CHARM'), true);
  game.state.difficulty = 'hard'; game.state.sp = { Iona: { mend: 6 } };
  game.save(); const old = JSON.parse(fix.saves.get(context.G)); delete old.wayfarer;
  const restored = context.we(JSON.stringify(old), 7321);
  assert.ok(restored); assert.deepEqual(plain(restored.wayfarer), plain(context.wayfarerEmpty()));
  assert.equal(restored.inventory.R02_COMMON_CHARM, 4);
  assert.ok(restored.heroes.every(hero => hero.equipment.charm === 'R02_COMMON_CHARM'));
  assert.equal(restored.difficulty,'hard'); assert.deepEqual(plain(restored.sp), { Iona: { mend: 6 } });
});

test('malformed optional records are normalized and unknown catalog entries do not enter the journal', () => {
  const fix = setup(), { game, context } = fix;
  game.save(); const raw = JSON.parse(fix.saves.get(context.G));
  raw.wayfarer = { kills: {R01:9,R02:-2,R03:'4'}, accepted: {'R01-patrol':3,'R01-survey':99,evil:0},
    claimed:['R01-patrol','R01-patrol','evil',null], bestiary:{'R01|R01_E2|base':{defeated:2},'R01|R01_E2|base|duplicate':{defeated:9},'R01|unknown|base':{defeated:9},'R01|R01_E3|base':{defeated:NaN}} };
  const restored = context.we(JSON.stringify(raw),7321); assert.ok(restored);
  assert.deepEqual(plain(restored.wayfarer.accepted), {'R01-patrol':3,'R01-survey':9});
  assert.deepEqual(plain(restored.wayfarer.claimed), ['R01-patrol']);
  assert.equal(restored.wayfarer.kills.R02,0); assert.equal(restored.wayfarer.kills.R03,0);
  assert.deepEqual(Object.keys(restored.wayfarer.bestiary), ['R01|R01_E2|base']);
});

test('summary reads are pure and do not reveal a future foe before its first victory', () => {
  const { game, context } = setup();
  const before = JSON.stringify(game.state);
  for (const region of context.wayfarerRegions) {
    const summary = context.wayfarerSummary(game.state, region.id);
    assert.equal(summary.bestiary.length,0); assert.equal(summary.totalDefeated,0);
  }
  assert.equal(JSON.stringify(game.state),before);
});
