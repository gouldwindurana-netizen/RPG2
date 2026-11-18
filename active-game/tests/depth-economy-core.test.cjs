'use strict';

// Reward fixtures isolate accounting. Pacing below resolves actual unboosted
// battles with earned EXP, normal shelter rests, starter gear and paid supplies.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const htmlPath = process.env.GAME_HTML ? path.resolve(process.env.GAME_HTML)
  : path.resolve(__dirname, '..', 'The_Road_Beyond_the_Bells.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const start = html.indexOf('var l={schemaVersion');
const end = html.indexOf('var De=new Set', start);
assert.ok(start >= 0 && end > start);
const core = html.slice(start, end);
const plain = value => JSON.parse(JSON.stringify(value));

function createGame(seed = 7321, job = 'warden') {
  const context = vm.createContext({ structuredClone });
  vm.runInContext(core, context, { timeout: 3000, filename: htmlPath });
  assert.ok(context.rewardPacing, 'slower future earnings are integrated');
  const saves = new Map();
  const storage = { getItem: key => saves.get(key) ?? null,
    setItem: (key, value) => saves.set(key, String(value)), removeItem: key => saves.delete(key) };
  const game = context.Ee({ storage, seed, roundDelay: 0 });
  game.beginAdventure({ ...context.R, name: 'Rowan', job });
  game.skipIntro();
  game.configure({ encounters: 'visible' });
  return { context, game, storage, reload: () => context.Ee({ storage, seed, roundDelay: 0 }) };
}
function clearMessages(game) { while (game.state.message) game.dismiss(); }
function at(game, area, point = { x: 11, y: 10 }) {
  game.state.area = area;
  game.state.player = { ...point, facing: 'right' };
  clearMessages(game);
}
function begin(context, game, area, id) {
  clearMessages(game);
  const entity = context.he[area].entities.find(entity => entity.id === id);
  assert.ok(entity, `${area}/${id} exists`);
  at(game, area, entity);
  game.interact(id);
  assert.equal(game.state.mode, 'battle', `${id} starts a battle`);
  return game.state.battle;
}
function finish(game) {
  assert.equal(game.state.mode, 'victory');
  if (game.state.reward.choices.length) game.claim(game.state.reward.choices[0]);
  game.continue();
  clearMessages(game);
}
async function rewardFixture(game, fallen = []) {
  for (const hero of game.state.heroes) if (fallen.includes(hero.id)) hero.hp = 0;
  for (const enemy of game.state.battle.enemies) enemy.hp = 0;
  for (const hero of game.state.heroes) if (hero.hp > 0 && hero.status !== 'sleep') {
    assert.equal(game.plan(hero.id, { type: 'guard', target: hero.id }), true);
  }
  await game.resolveRound();
  assert.equal(game.state.mode, 'victory');
}

function bounds(members) {
  const small = members.filter(member => member.size === 'small').length;
  const large = members.filter(member => member.size === 'large').length;
  assert.ok(members.length >= 1);
  assert.ok(large ? small ? large <= 2 && small <= 6 : large <= 4 : small <= 9,
    `legal footprint: ${large} large / ${small} small`);
}

// Only use purchased/known spells once the companion spell-shop patch is present.
function canSpell(context, game, hero, id) {
  const spell = context.te.find(spell => spell.id === id);
  return spell && (context.canUseSkill
    ? context.canUseSkill(game.state, hero, spell)
    : context.knowsSpell(game.state, hero, spell) && hero.charges[spell.tier - 1] > 0 && hero.status !== 'silence');
}
async function actualBattle(context, game, maxRounds = 35) {
  const start = game.state.battle;
  const rounds = [];
  for (let i = 0; i < maxRounds && game.state.mode === 'battle'; i++) {
    const battle = game.state.battle;
    const targets = battle.enemies.filter(enemy => enemy.hp > 0).sort((a, b) => a.hp - b.hp);
    const wounded = game.state.heroes.filter(hero => hero.hp > 0).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
    const heavy = battle.kind !== 'normal' && battle.round % 2 === 0;
    for (const hero of game.state.heroes) {
      if (hero.hp <= 0 || hero.status === 'sleep') continue;
      let action = { type: 'attack', target: targets[0].id };
      const injured = wounded.filter(ally=>ally.hp<ally.maxHp*.8).length;
      const healId = (injured>=2?['daybreak','haven','renew','kindle','mend']:['kindle','mend','daybreak','haven','renew'])
        .find(id=>canSpell(context,game,hero,id));
      if ((hero.job === 'mender'||hero.job==='spellblade') && wounded[0].hp < wounded[0].maxHp * .7 && healId) {
        const spell=context.te.find(spell=>spell.id===healId);
        action = { type: 'spell', spellId: healId, target: spell.target==='allAllies'?'all':wounded[0].id };
      } else if (hero.job === 'mender' && wounded[0].hp < wounded[0].maxHp * .45 && game.state.inventory.POTION > 0)
        action = { type: 'item', itemId: 'POTION', target: wounded[0].id };
      else if (heavy) action = { type: 'guard', target: hero.id };
      else if (hero.job === 'arcanist') {
        const ids=targets.length>=2?['aurora','inferno','tempest','blizzard','wave','starfall','flare','frost','spark','ember']:['starfall','flare','frost','spark','ember'];
        const spellId=ids.find(id=>{const spell=context.te.find(spell=>spell.id===id);return canSpell(context,game,hero,id)&&!targets[0].resistance.includes(spell.element);});
        if(spellId){const spell=context.te.find(spell=>spell.id===spellId);action={type:'spell',spellId,target:spell.target==='allEnemies'?'all':targets[0].id};}
      }
      assert.equal(game.plan(hero.id, action), true);
    }
    rounds.push(battle.round);
    await game.resolveRound();
  }
  assert.equal(game.state.mode, 'victory', `${start.encounterId} actual combat finishes in ${maxRounds} rounds; ${start.log.join('\n')}`);
  return { id: start.encounterId, count: start.enemies.length, rounds: rounds.length,
    levels: game.state.heroes.map(hero => hero.level), hp: game.state.heroes.map(hero => hero.hp),
    xp: plain(game.state.hx), gold: game.state.gold };
}
function normalRest(game, area = 'camp') {
  assert.equal(game.state.mode, 'explore');
  at(game, area);
  const before = game.state.gold;
  game.rest();
  clearMessages(game);
  assert.ok(game.state.heroes.every(hero => hero.hp === hero.maxHp));
  assert.equal(before - game.state.gold, area === 'camp' ? 0 : 20);
}

function loadBaseline() {
  const raw = fs.readFileSync(path.resolve(__dirname, '..', 'depth-baseline.html'), 'utf8');
  const a = raw.indexOf('var l={schemaVersion'), b = raw.indexOf('var De=new Set', a);
  const context = vm.createContext({ structuredClone });
  vm.runInContext(raw.slice(a, b), context, { timeout: 3000 });
  return context;
}
function locate(context, id) {
  for (const [area, map] of Object.entries(context.he)) {
    const entity = map.entities.find(entity => entity.id === id);
    if (entity) return { area, entity };
  }
  throw new Error(`No encounter entity ${id}`);
}
function beginLocated(context, game, id) {
  const { area } = locate(context, id);
  return begin(context, game, area, id);
}
function service(context, game, area, kind) {
  clearMessages(game);
  const npc = context.he[area].entities.find(entity => entity.shopKind === kind);
  assert.ok(npc);
  at(game, area, { x: npc.x, y: npc.y + 1 });
  game.interact(npc.id);
  assert.equal(game.state.message.speaker, { items: 'Item Shop', weapon: 'Weapon Shop', magic: 'Skill Shop' }[kind]);
}

test('future regular contributions are reduced once while combat strength stays fixed', () => {
  const old = loadBaseline(), { context } = createGame();
  assert.deepEqual(plain(context.rewardPacing), { normal: { xp: .5, gold: .65 }, boss: { xp: .65, gold: .75 }, rare: { xp: .65, gold: .75 } });
  for (const [region, rows] of Object.entries(context.encounterTables)) for (const row of rows) {
    row.members.forEach((member, index) => {
      const before = old.encounterUnit(member, index), after = context.encounterUnit(member, index);
      assert.equal(after.rewardXp, Math.max(1, Math.floor(before.rewardXp * .5)), `${row.id} EXP`);
      assert.equal(after.rewardGold, Math.max(1, Math.floor(before.rewardGold * .65)), `${row.id} gold`);
      for (const field of ['maxHp', 'attack', 'defense', 'magic', 'speed', 'statusChance']) assert.equal(after[field], before[field], `${row.id} ${field}`);
    });
  }
});

test('boss, rare and multi-voice budgets reduce before allocation; zero rewards remain zero', async () => {
  for (const [id, priorXp, priorGold] of [['bailiff', 352, 200], ['silver', 168, 140], ['B_R06_CHOIR', 6000, 2000], ['B_R06_VALE', 0, 0]]) {
    const { context, game } = createGame();
    game.state.campaign.stage = 9;
    game.state.campaign.switches = plain(context.h).filter(id => id !== 'ending_seen');
    game.state.hunts.R01.ready = true;
    const battle = beginLocated(context, game, id);
    const xp = Math.floor(priorXp * .65), gold = Math.floor(priorGold * .75);
    assert.equal(battle.enemies.reduce((sum, enemy) => sum + enemy.rewardXp, 0), xp);
    assert.equal(battle.enemies.reduce((sum, enemy) => sum + enemy.rewardGold, 0), gold);
    const before = plain({ hx: game.state.hx, gold: game.state.gold });
    await rewardFixture(game);
    assert.equal(game.state.gold - before.gold, gold);
    for (const hero of game.state.heroes) assert.equal(game.state.hx[hero.id] - before.hx[hero.id], Math.floor(xp / 4));
    const paid = plain({ hx: game.state.hx, gold: game.state.gold });
    await game.resolveRound();
    assert.deepEqual(plain({ hx: game.state.hx, gold: game.state.gold }), paid);
  }
});

test('lower rewards still share only among survivors and do not pay on escape or defeat', async () => {
  for (const outcome of ['victory', 'flee', 'defeat']) {
    const { context, game } = createGame();
    const battle = beginLocated(context, game, 'encounter2');
    const xp = battle.enemies.reduce((sum, enemy) => sum + enemy.rewardXp, 0);
    const gold = battle.enemies.reduce((sum, enemy) => sum + enemy.rewardGold, 0);
    const before = plain({ hx: game.state.hx, gold: game.state.gold });
    if (outcome === 'victory') {
      await rewardFixture(game, ['Soren']);
      for (const hero of game.state.heroes) assert.equal(game.state.hx[hero.id] - before.hx[hero.id], hero.hp > 0 ? Math.floor(xp / 3) : 0);
      assert.equal(game.state.gold - before.gold, gold);
    } else if (outcome === 'flee') {
      game.state.rng = 1;
      await game.flee();
      assert.equal(game.state.mode, 'explore');
      assert.deepEqual(plain({ hx: game.state.hx, gold: game.state.gold }), before);
    } else {
      game.state.heroes.forEach(hero => hero.hp = 0);
      await game.resolveRound();
      assert.equal(game.state.mode, 'defeat');
      assert.deepEqual(plain({ hx: game.state.hx, gold: game.state.gold }), before);
    }
  }
});

test('existing earned EXP, gold, inventory, learned spells and prices do not change on reload', async () => {
  const { context, game, reload } = createGame();
  beginLocated(context, game, 'encounter1');
  await rewardFixture(game);
  finish(game);
  const before = plain({ hx: game.state.hx, xp: game.state.xp, gold: game.state.gold, inventory: game.state.inventory, known: game.state.learnedSpells });
  game.save();
  const restored = reload();
  assert.deepEqual(plain({ hx: restored.state.hx, xp: restored.state.xp, gold: restored.state.gold, inventory: restored.state.inventory, known: restored.state.learnedSpells }), before);
  const prior = loadBaseline();
  assert.deepEqual(plain(context.l.xp_thresholds), plain(prior.l.xp_thresholds));
  assert.deepEqual(plain(context.spellPrices), plain(prior.spellPrices));
  // The user's difficulty build deliberately strengthens regional set stats.
  // The MP update also changes the two existing teas' recovery descriptions.
  // Keep comparing every other field, including their prices and copy limits.
  assert.match(context.K('SPARK_TEA').effect, /Restore 20 MP/);
  assert.match(context.K('DEEP_TEA').effect, /Restore 60 MP/);
  assert.equal(context.K('CAMP_MEAL').effect, 'Restore 30% maximum HP to one living hero outside battle; no MP recovery.');
  const unchangedCatalogFields = items => plain(items).map(item => {
    if (item.set_id) delete item.stats;
    if (['SPARK_TEA','DEEP_TEA','CAMP_MEAL'].includes(item.id)) delete item.effect;
    return item;
  });
  assert.deepEqual(unchangedCatalogFields(context.u.items), unchangedCatalogFields(prior.u.items));
});

test('a preceding-build save keeps its original unreduced earnings exactly', async () => {
  const prior = loadBaseline(), { context } = createGame();
  const saves = new Map(), storage = { getItem: key => saves.get(key) ?? null, setItem: (key, value) => saves.set(key, String(value)) };
  const old = prior.Ee({ storage, seed: 7321, roundDelay: 0 });
  old.beginAdventure({ ...prior.R, name: 'Before', job: 'warden' }); old.skipIntro(); old.configure({ encounters: 'visible' });
  begin(prior, old, 'works', 'encounter1');
  await rewardFixture(old); finish(old); old.save();
  const before = plain({ hx: old.state.hx, xp: old.state.xp, gold: old.state.gold, inventory: old.state.inventory, known: old.state.learnedSpells });
  assert.equal(before.hx.Mara, 28, 'the fixture earned the prior full reward');
  const restored = context.Ee({ storage, seed: 7321, roundDelay: 0 });
  const expected = plain(before);
  for (const hero of restored.state.heroes) expected.known[hero.id] = [...new Set([...expected.known[hero.id], ...context.starterSkillIds(hero.job)])];
  assert.deepEqual(plain({ hx: restored.state.hx, xp: restored.state.xp, gold: restored.state.gold, inventory: restored.state.inventory, known: restored.state.learnedSpells }), expected,
    'migration retains all earned resources and learned magic, adding only each current job starter');
});

// These combat/economy probes use actual movement-triggered repeatable fights,
// real class derivation, learned spells, paid shops and ordinary shelter recovery.
// Position fixtures skip travel time; this does not claim a dungeon route playthrough.
function startTraining(context, game, area = 'works') {
  clearMessages(game);
  at(game, area);
  const map = game.map();
  let pair;
  for (let y = 1; y < map.height - 1 && !pair; y++) for (let x = 1; x < map.width - 2 && !pair; x++) {
    const points = [{ x, y }, { x: x + 1, y }];
    if (points.every(point => 'gdsfb'.includes(map.tiles[point.y][point.x]) && !context.p(area, point.x, point.y) &&
      !map.entities.some(entity => entity.kind !== 'enemy' && Math.abs(entity.x - point.x) + Math.abs(entity.y - point.y) <= 2))) pair = points;
  }
  assert.ok(pair, `${area} has a repeatable training corridor`);
  game.state.player = { ...pair[0], facing: 'right' };
  game.configure({ encounters: 'classic' });
  for (let steps = 0; steps < 40 && game.state.mode === 'explore'; steps++) game.move(steps % 2 ? 'left' : 'right');
  assert.equal(game.state.mode, 'battle', 'ordinary walking triggers the next encounter');
  return game.state.battle;
}

for (const job of ['warden', 'arcanist']) test(`${job} can grind, buy supplies and spells, and clear the opening boss with earned resources`, async t => {
  const { context, game } = createGame(7321, job), fights = [];
  for (let i = 1; i <= 6; i++) {
    normalRest(game);
    beginLocated(context, game, `encounter${i}`);
    fights.push(await actualBattle(context, game));
    finish(game);
  }
  const levelAfterAuthored = game.state.heroes[0].level;
  for (let count = 0; game.state.heroes[0].level < 4 && count < 30; count++) {
    normalRest(game);
    startTraining(context, game);
    fights.push(await actualBattle(context, game));
    finish(game);
  }
  assert.ok(levelAfterAuthored < 4, 'the original six fights no longer reach the tested level-four preparation band');
  assert.equal(game.state.heroes[0].level, 4);
  normalRest(game);
  service(context, game, 'camp', 'items');
  const beforeShopping = game.state.gold;
  assert.equal(game.buy('POTION', 4), 4);
  const potionSpend = beforeShopping - game.state.gold;
  clearMessages(game);
  service(context, game, 'camp', 'magic');
  const spellSpendBefore = game.state.gold;
  assert.equal(game.buySpell('Soren', 'spark'), true);
  assert.equal(game.buySpell('Iona', 'shelter'), true);
  if (job === 'arcanist') assert.equal(game.buySpell('Mara', 'frost'), true);
  const spellSpend = spellSpendBefore - game.state.gold;
  clearMessages(game);
  beginLocated(context, game, 'bailiff');
  const boss = await actualBattle(context, game);
  assert.ok(game.state.heroes.every(hero => hero.hp > 0));
  assert.ok(game.state.gold >= 20);
  t.diagnostic(JSON.stringify({ job, authoredFights: 6, trainingFights: fights.length - 6, levelAfterAuthored, boss, potionSpend, spellSpend, goldAfterBoss: game.state.gold }));
});

// This expedition starts at character creation and uses walking, real fights,
// stairs, cache/lever interactions, shopping and ordinary camp recovery. Unlike
// the focused probes above, it never replaces player coordinates or resources.
const steps = [['right',1,0],['down',0,1],['left',-1,0],['up',0,-1]];
function routeTo(map, start, goals, exitId) {
  const key = p => `${p.x},${p.y}`, targets = new Set(goals.map(key));
  const seen = new Set([key(start)]), queue = [{...start,path:[]}];
  for (let index=0;index<queue.length;index++) {
    const current=queue[index]; if(targets.has(key(current))) return current.path;
    for (const [direction,dx,dy] of steps) {
      const next={x:current.x+dx,y:current.y+dy},id=key(next);
      if(seen.has(id)||!'gdsfb'.includes(map.tiles[next.y]?.[next.x]||'?')) continue;
      if(map.entities.some(entity=>entity.x===next.x&&entity.y===next.y&&entity.id!==exitId)) continue;
      seen.add(id);queue.push({...next,path:[...current.path,direction]});
    }
  }
  throw new Error(`No walking route in ${map.area} from ${key(start)} to ${goals.map(key).join('|')}`);
}
async function settleExpedition(context, game, record) {
  if(game.state.mode==='battle') {
    record.battles.push(await actualBattle(context,game));finish(game);
  }
  clearMessages(game);
  for(const hero of game.state.heroes) {
    assert.ok(hero.hp>0,'this sampled expedition has no fallen traveler');
    const remedy={poison:'ANTIDOTE',sleep:'SOOTHING_DRAUGHT',silence:'CLEAR_TONIC'}[hero.status];
    if(remedy&&(game.state.inventory[remedy]??0)>0&&game.useItem(remedy,hero.id)) record.used[remedy]=(record.used[remedy]??0)+1;
    if(hero.hp<hero.maxHp*.6&&(game.state.inventory.POTION??0)>0&&game.useItem('POTION',hero.id))record.used.POTION=(record.used.POTION??0)+1;
  }
}
async function walkToEntity(context,game,id,record,{enter=false,keepMessage=false}={}) {
  const origin=game.state.area;
  for(let count=0;count<1000;count++) {
    await settleExpedition(context,game,record);
    if(enter&&game.state.area!==origin)return;
    const map=game.map(),entity=map.entities.find(entity=>entity.id===id);assert.ok(entity,`${game.state.area}/${id}`);
    const goals=enter?[entity]:steps.map(([,dx,dy])=>({x:entity.x+dx,y:entity.y+dy}));
    const path=routeTo(map,game.state.player,goals,enter?id:null);
    if(!path.length){
      assert.ok(!enter,'walking onto an exit must change floors');
      game.interact(id);
      if(game.state.mode==='battle'){record.battles.push(await actualBattle(context,game));finish(game);}
      else if(game.state.reward){finish(game);}
      if(!keepMessage)clearMessages(game);return;
    }
    const before={area:game.state.area,x:game.state.player.x,y:game.state.player.y};
    game.move(path[0]);record.walkingSteps++;
    assert.ok(game.state.area!==before.area||game.state.player.x!==before.x||game.state.player.y!==before.y||game.state.mode==='battle',`${id} walking makes progress`);
  }
  throw new Error(`Walking budget exceeded for ${id}`);
}

test('an earned-resource Warden expedition walks all three bellworks floors, opens a return lift, resupplies and defeats Bailiff',async t=>{
  const {context,game}=createGame(7321,'warden');
  game.configure({encounters:'classic'});
  const record={walkingSteps:0,battles:[],used:{},purchases:[],floors:[],returns:0};
  await walkToEntity(context,game,'bessa',record);
  assert.equal(game.state.flags.briefed,true);
  await walkToEntity(context,game,'magic-camp',record,{keepMessage:true});
  assert.equal(game.buySpell('Soren','spark'),true);record.purchases.push('Spark:35G');clearMessages(game);
  await walkToEntity(context,game,'world-camp',record,{enter:true});
  await walkToEntity(context,game,'enter-works',record,{enter:true});record.floors.push(game.state.area);
  await walkToEntity(context,game,'depth-down-works-1',record,{enter:true});record.floors.push(game.state.area);
  await walkToEntity(context,game,'depth-cache-works-2',record);
  await walkToEntity(context,game,'depth-note-works-2',record);
  await walkToEntity(context,game,'depth-down-works-2',record,{enter:true});record.floors.push(game.state.area);
  await walkToEntity(context,game,'depth-cache-works-3',record);
  await walkToEntity(context,game,'depth-note-works-3',record);
  await walkToEntity(context,game,'depth-lever-works-3',record);
  assert.ok(game.state.campaign.switches.includes('depth_works_3_shortcut'));
  const beforeRetreat=plain({hp:game.state.heroes.map(hero=>hero.hp),mp:game.state.heroes.map(hero=>hero.mp),gold:game.state.gold});
  await walkToEntity(context,game,'depth-shortcut-works-3',record,{enter:true});record.returns++;
  await walkToEntity(context,game,'world-works',record,{enter:true});
  await walkToEntity(context,game,'enter-camp',record,{enter:true});
  const beforeRest=plain({hp:game.state.heroes.map(hero=>hero.hp),mp:game.state.heroes.map(hero=>hero.mp)});
  await walkToEntity(context,game,'fire',record);
  assert.ok(game.state.heroes.every(hero=>hero.hp===hero.maxHp),'ordinary camp recovery restores the party');
  await walkToEntity(context,game,'merchant',record,{keepMessage:true});
  const goldBefore=game.state.gold;assert.equal(game.buy('POTION',4),4);assert.equal(goldBefore-game.state.gold,120);record.purchases.push('4 Potions:120G');clearMessages(game);
  await walkToEntity(context,game,'magic-camp',record,{keepMessage:true});
  assert.equal(game.buySpell('Iona','shelter'),true);record.purchases.push('Shelter:35G');clearMessages(game);
  await walkToEntity(context,game,'world-camp',record,{enter:true});
  await walkToEntity(context,game,'enter-works',record,{enter:true});
  await walkToEntity(context,game,'depth-return-works-3',record,{enter:true});
  const beforeBoss=plain({levels:game.state.heroes.map(hero=>hero.level),hp:game.state.heroes.map(hero=>hero.hp),gold:game.state.gold});
  await walkToEntity(context,game,'bailiff',record);
  assert.equal(game.state.flags.bossDefeated,true);assert.ok(game.state.cleared.includes('bailiff'));
  assert.deepEqual(record.floors,['works','works-depth-2','works-depth-3']);
  assert.equal(record.returns,1);assert.ok(record.walkingSteps>100);
  assert.ok(record.battles.length>=4,'real walking creates repeated resource expenditure');
  assert.ok(game.state.heroes.every(hero=>hero.hp>0));
  assert.ok(game.state.gold>=20,'the sampled earned-resource route retains a recovery fund');
  t.diagnostic(JSON.stringify({job:'warden',walkingSteps:record.walkingSteps,floors:record.floors,battles:record.battles.length,boss:record.battles.at(-1),used:record.used,purchases:record.purchases,beforeRetreat,beforeRest,beforeBoss,finalGold:game.state.gold,remaining:plain({POTION:game.state.inventory.POTION,ANTIDOTE:game.state.inventory.ANTIDOTE})}));
});
