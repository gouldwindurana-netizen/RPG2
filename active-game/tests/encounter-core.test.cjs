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
  assert.ok(context.encounterTables, 'encounter expansion is integrated');
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
  let entity = context.he[area]?.entities.find(entity => entity.id === id);
  if (!entity) {
    const located = Object.entries(context.he).find(([, map]) => map.entities.some(candidate => candidate.id === id));
    assert.ok(located, `${id} exists on an authored map`);
    area = located[0]; entity = located[1].entities.find(candidate => candidate.id === id);
  }
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

test('every fixed regional formation respects NES-sized bounds and uses its region only', () => {
  const { context } = createGame();
  const counts = new Set();
  for (const [region, rows] of Object.entries(context.encounterTables)) {
    assert.ok(rows.length >= 10, region);
    assert.equal(rows.reduce((sum, row) => sum + row.weight, 0), 100);
    const commonWeight = rows.filter(row => row.members.length >= 2 && row.members.length <= 4)
      .reduce((sum, row) => sum + row.weight, 0);
    assert.ok(commonWeight >= 75, `${region}: common encounters are 2–4 enemies`);
    for (const row of rows) {
      bounds(row.members);
      counts.add(row.members.length);
      assert.ok(row.members.every(member => member.template.startsWith(region + '_')));
      const units = row.members.map(context.encounterUnit);
      assert.equal(new Set(units.map(enemy => enemy.id)).size, units.length);
      assert.ok(units.every(enemy => enemy.hp > 0 && enemy.rewardXp > 0 && enemy.rewardGold > 0));
    }
  }
  assert.deepEqual([...counts].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  for (const members of Object.values(context.authoredFormations)) bounds(members);
});

test('early roads exclude deep swarms and progression uses story and floors rather than hero level or visible patrol clears', () => {
  const { context, game } = createGame();
  at(game, 'overworld', { x: 8, y: 32 });
  const initial = plain(context.encounterEligible('R01', game.state));
  assert.ok(initial.every(row => row.members.length <= 4));
  game.state.heroes.forEach(hero => hero.level = 50);
  assert.deepEqual(plain(context.encounterEligible('R01', game.state)), initial);
  at(game, 'works');
  assert.ok(context.encounterEligible('R01', game.state).every(row => row.members.length <= 4));
  assert.ok(context.encounterEligible('R01', game.state).every(row => row.members.length <= 4), 'the approach remains a training floor');
  at(game, 'works-depth-2');
  assert.equal(game.state.cleared.length, 0, 'fresh classic play has no visible-patrol clears');
  assert.ok(context.encounterEligible('R01', game.state).some(row => row.members.length === 6), 'descending alone unlocks the first deeper groups');
  assert.ok(context.encounterEligible('R01', game.state).every(row => row.members.length <= 6));
  game.state.campaign.stage = 2;
  assert.ok(context.encounterEligible('R01', game.state).every(row => row.members.length <= 6), 'wide swarms still require the lower level');
  at(game, 'works-depth-3');
  assert.ok(context.encounterEligible('R01', game.state).some(row => row.members.length === 9));
  assert.ok(context.encounterEligible('R01', game.state).some(row => row.members.filter(m => m.size === 'large').length === 4));
  const roll = context.encounterFormation('R01', game.state, () => 0.99999);
  assert.equal(roll.id, 'R01_ashen-watch');
  assert.ok(context.encounterTables.R03.some(row=>row.members.some(member=>member.rank==='crested')));
  assert.ok(context.encounterTables.R01.some(row=>row.members.some(member=>member.rank==='ashen')));
});

test('same-template swarm units have distinct IDs and fixed lighter individual budgets', () => {
  const { context } = createGame();
  const row = context.encounterTables.R01.find(row => row.id.endsWith('swarm-nine'));
  const units = row.members.map(context.encounterUnit);
  assert.equal(units.length, 9);
  assert.equal(new Set(units.map(unit => unit.id)).size, 9);
  const full = context.Te('R01_E3', 0);
  assert.ok(units.every(unit => unit.maxHp < full.maxHp && unit.attack < full.attack));
  const spoils = context.encounterSpoils(units.map(enemy => ({ ...enemy, hp: 0 })));
  assert.ok(spoils.xp < context.se[0] * 4 * 2, 'nine wisps stay below two full normal encounter budgets');
  assert.equal(Math.floor(spoils.xp / 4), 20, 'the reduced opening swarm payout still grants a useful but modest training reward');
});

test('contributions track count, type, size and rank; living enemies contribute nothing', () => {
  const { context } = createGame();
  const member = { template: 'R02_E1', size: 'small', unit: 'regular', rank: 'base' };
  const base = context.encounterUnit(member, 0);
  const ashen = context.encounterUnit({ ...member, rank: 'ashen' }, 1);
  const large = context.encounterUnit({ ...member, size: 'large' }, 2);
  const swarm = context.encounterUnit({ ...member, unit: 'swarm' }, 3);
  assert.ok(ashen.rewardXp > base.rewardXp && large.rewardXp > base.rewardXp && swarm.rewardXp < base.rewardXp);
  const one = context.encounterSpoils([{ ...base, hp: 0 }]);
  const two = context.encounterSpoils([{ ...base, hp: 0 }, { ...ashen, hp: 0 }, large]);
  assert.equal(two.count, 2);
  assert.equal(two.xp, base.rewardXp + ashen.rewardXp);
  assert.equal(two.gold, base.rewardGold + ashen.rewardGold);
  assert.ok(two.xp > one.xp);
  assert.deepEqual(plain(context.encounterSpoils([])), { count: 0, xp: 0, gold: 0 });
});

test('victory sums enemy contributions, shares over survivors, pays no fallen EXP, and commits once', async () => {
  const { context, game, reload } = createGame();
  const battle = begin(context, game, 'works', 'encounter2');
  const totalXp = battle.enemies.reduce((sum, enemy) => sum + enemy.rewardXp, 0);
  const totalGold = battle.enemies.reduce((sum, enemy) => sum + enemy.rewardGold, 0);
  const before = plain(game.state);
  await rewardFixture(game, ['Soren']);
  for (const hero of game.state.heroes) assert.equal(game.state.hx[hero.id] - before.hx[hero.id],
    hero.job === 'arcanist' ? 0 : Math.floor(totalXp / 3));
  assert.equal(game.state.gold - before.gold, totalGold);
  assert.match(game.state.reward.lines[0], new RegExp(`3 enemies defeated: ${totalXp} total EXP and ${totalGold} gold`));
  assert.match(game.state.reward.lines[1], /fallen heroes earn none/);
  const paid = plain({ hx: game.state.hx, gold: game.state.gold });
  await game.resolveRound();
  assert.deepEqual(plain({ hx: game.state.hx, gold: game.state.gold }), paid);
  const restored = reload();
  assert.equal(restored.state.mode, 'victory');
  restored.continue();
  await restored.resolveRound();
  assert.deepEqual(plain({ hx: restored.state.hx, gold: restored.state.gold }), paid);
});

test('reduced authored boss and rare budgets allocate once across all voices', async () => {
  for (const [area, id, xp, gold] of [['works', 'bailiff', 88 * 4, 200],
    ['camp', 'silver', 42 * 4, 140], ['heart', 'B_R06_CHOIR', 1500 * 4, 2000],
    ['heart', 'B_R06_VALE', 0, 0]]) {
    const { context, game } = createGame();
    game.state.campaign.stage = 9;
    game.state.campaign.switches = plain(context.h).filter(id => id !== 'ending_seen');
    game.state.hunts.R01.ready = true;
    const battle = begin(context, game, area, id);
    const reducedXp = Math.floor(xp * .65), reducedGold = Math.floor(gold * .75);
    assert.equal(battle.enemies.reduce((sum, enemy) => sum + enemy.rewardXp, 0), reducedXp);
    assert.equal(battle.enemies.reduce((sum, enemy) => sum + enemy.rewardGold, 0), reducedGold);
    assert.ok(battle.enemies.every(enemy => enemy.size === 'large'));
    if (id === 'B_R06_CHOIR') assert.equal(battle.enemies.length, 3);
    const before = game.state.gold;
    await rewardFixture(game);
    assert.equal(game.state.gold - before, reducedGold);
    assert.ok(Object.values(game.state.hx).every(value => value === Math.floor(reducedXp / 4)));
  }
});

test('successful escape and defeat award neither EXP nor gold', async () => {
  for (const outcome of ['flee', 'defeat']) {
    const { context, game } = createGame();
    begin(context, game, 'works', 'encounter1');
    const before = plain({ hx: game.state.hx, gold: game.state.gold });
    if (outcome === 'flee') {
      game.state.rng = 1;
      await game.flee();
      assert.equal(game.state.mode, 'explore');
    } else {
      for (const hero of game.state.heroes) hero.hp = 0;
      await game.resolveRound();
      assert.equal(game.state.mode, 'defeat');
      game.continue();
    }
    assert.deepEqual(plain({ hx: game.state.hx, gold: game.state.gold }), before);
  }
});

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

function trainingFight(context, game, area = 'works') {
  clearMessages(game); at(game, area);
  const map = game.map(); let pair;
  for (let y = 1; y < map.height - 1 && !pair; y++) for (let x = 1; x < map.width - 2 && !pair; x++) {
    const points = [{ x, y }, { x: x + 1, y }];
    if (points.every(point => 'gdsfb'.includes(map.tiles[point.y][point.x]) && !context.p(area, point.x, point.y) &&
      !map.entities.some(entity => entity.kind !== 'enemy' && Math.abs(entity.x - point.x) + Math.abs(entity.y - point.y) <= 2))) pair = points;
  }
  assert.ok(pair, `${area} has repeatable ordinary training`);
  game.state.player = { ...pair[0], facing: 'right' }; game.configure({ encounters: 'classic' });
  for (let steps = 0; steps < 40 && game.state.mode === 'explore'; steps++) game.move(steps % 2 ? 'left' : 'right');
  assert.equal(game.state.mode, 'battle', 'training uses the walking encounter trigger');
}
async function prepareOpening(context, game, reports = []) {
  let count = 0;
  while (game.state.heroes.some(hero => hero.level < 4) && count++ < 30) {
    normalRest(game); trainingFight(context, game); reports.push(await actualBattle(context, game)); finish(game);
  }
  assert.ok(game.state.heroes.every(hero => hero.level >= 4), 'earned training reaches the tested preparation level');
  return count;
}

test('fresh starter party earns its R01 levels through actual battles and can defeat Bailiff with normal recovery', async t => {
  const { context, game } = createGame(7321);
  const reports = [];
  for (let i = 1; i <= 6; i++) {
    if (i === 1 || i === 3 || i === 5) normalRest(game);
    begin(context, game, 'works', `encounter${i}`);
    reports.push(await actualBattle(context, game));
    finish(game);
  }
  assert.ok(game.state.heroes.every(hero => hero.level === 3), 'six opening victories now stop at level three');
  const training = await prepareOpening(context, game, reports);
  assert.ok(training > 0 && training <= 12, 'a deliberate but bounded grind prepares the first guardian');
  const beforeBoss = game.state.heroes.map(hero => hero.level);
  normalRest(game);
  // Spend earned money through normal shop controls, without adding supplies.
  assert.equal(game.buy('POTION', 3), 3);
  begin(context, game, 'works', 'bailiff');
  reports.push(await actualBattle(context, game));
  assert.ok(beforeBoss.every(level => level >= 4 && level <= 5));
  assert.ok(game.state.heroes.every(hero => hero.level >= 4 && hero.level <= 6));
  assert.ok(game.state.heroes.every(hero => hero.hp > 0), 'the tested route keeps every hero earning EXP');
  assert.ok(game.state.gold >= 200, 'earned gold covers supplies and leaves room for spell shopping');
  t.diagnostic(JSON.stringify(reports));
});

function openService(context,game,area,kind){
  clearMessages(game);
  const npc=context.he[area].entities.find(entity=>entity.shopKind===kind);
  assert.ok(npc,`${area} has a real ${kind} shop`);
  at(game,area,{x:npc.x,y:npc.y+1});
  game.interact(npc.id);
  assert.equal(game.state.message?.speaker,{weapon:'Weapon Shop',magic:'Skill Shop',items:'Item Shop'}[kind]);
}
function gearUp(context,game,area,tier){
  openService(context,game,area,'weapon');
  // Buy ordinary regional weapons before armor; never manufacture money/stock.
  for(const slot of ['weapon','body'])for(const id of ['Tavin','Mara','Soren','Iona']){
    const hero=game.state.heroes.find(hero=>hero.id===id);
    const source=context.V(hero.job).starterSourceHero.toUpperCase();
    const itemId=`R0${tier}_${source}_${slot.toUpperCase()}`;
    if(hero.equipment[slot]===itemId)continue;
    const offer=context.fe(game.state).find(offer=>offer.itemId===itemId);
    assert.ok(offer,itemId);
    if(game.state.gold>=offer.price+40&&game.buy(itemId,1))assert.equal(game.equip(id,itemId),true);
  }
  clearMessages(game);
}
function learnAvailable(context,game,area,ids){
  openService(context,game,area,'magic');
  for(const [heroId,spellId]of ids){
    const offer=context.spellOffers(game.state,heroId).find(offer=>offer.spellId===spellId);
    // Plan purchases around the paid regional inn rather than spend its reserve.
    if(offer&&!offer.known&&offer.unlocked&&game.state.gold>=offer.price+20)assert.equal(game.buySpell(heroId,spellId),true);
  }
  clearMessages(game);
}
function speak(context,game,area,id){
  const npc=context.he[area].entities.find(entity=>entity.id===id);assert.ok(npc,id);
  at(game,area,{x:npc.x-1,y:npc.y});game.interact(id);clearMessages(game);
}

test('an earned-level party can prepare through real shops and clear R02 without extra EXP or money',async t=>{
  const {context,game}=createGame(7321),reports=[];
  for(let i=1;i<=6;i++){normalRest(game);begin(context,game,'works',`encounter${i}`);await actualBattle(context,game);finish(game);}
  await prepareOpening(context,game);normalRest(game);begin(context,game,'works','bailiff');await actualBattle(context,game);finish(game);
  speak(context,game,'camp','bessa');assert.equal(game.state.campaign.stage,2);
  speak(context,game,'dunmere','leth');assert.equal(game.state.campaign.stage,3);
  learnAvailable(context,game,'camp',[['Soren','spark'],['Soren','frost'],['Soren','wave'],['Iona','renew']]);
  assert.ok(game.state.learnedSpells.Soren.includes('spark'));
  for(let fights=0;game.state.heroes.some(hero=>hero.level<9)&&fights<36;fights++){
    gearUp(context,game,'dunmere',2);
    learnAvailable(context,game,'dunmere',[['Soren','wave'],['Iona','renew']]);
    normalRest(game,'dunmere');
    trainingFight(context,game,'tollhouse');reports.push(await actualBattle(context,game));finish(game);
  }
  assert.ok(game.state.heroes.every(hero=>hero.level>=9),'regional battles earn boss-ready levels');
  learnAvailable(context,game,'dunmere',[['Soren','wave'],['Iona','renew']]);
  assert.ok(game.state.learnedSpells.Soren.includes('wave'));
  gearUp(context,game,'dunmere',2);normalRest(game,'dunmere');
  begin(context,game,'tollhouse','B_R02_TOLL');reports.push(await actualBattle(context,game));
  assert.ok(game.state.heroes.every(hero=>hero.hp>0),'no fallen hero required recovery after the sampled path');
  assert.ok(game.state.gold>=20,'ordinary rewards still cover another inn stay');
  t.diagnostic(JSON.stringify({r02Battles:reports,gear:game.state.heroes.map(hero=>({name:hero.name,level:hero.level,equipment:hero.equipment})),known:game.state.learnedSpells,gold:game.state.gold}));
});

// These declared late-game loadout fixtures probe combat bounds, not a claim of
// having played the whole campaign. Stats/MP come from the actual class
// derivation and ordinary regional shop items; no HP/attack values are inflated.
function fixedRegionalParty(context,game,region,level){
  const xp=context.l.xp_thresholds[level-1];game.state.hx=Object.fromEntries(game.state.heroes.map(hero=>[hero.id,xp]));game.state.xp=xp;
  game.state.heroes=game.state.heroes.map(hero=>{
    const source=context.V(hero.job).starterSourceHero.toUpperCase();
    const equipment={weapon:`${region}_${source}_WEAPON`,body:`${region}_${source}_BODY`,head:`${region}_COMMON_HEAD`,mantle:`${region}_COMMON_MANTLE`,charm:`${region}_COMMON_CHARM`};
    for(const id of Object.values(equipment))game.state.inventory[id]=(game.state.inventory[id]??0)+1;
    return context.be(hero.id,level,equipment,game.state.profile);
  });
  game.state.learnedSpells=Object.fromEntries(game.state.heroes.map(hero=>[hero.id,context.te.filter(spell=>context.H(hero,spell)&&context.skillUnlocked(hero,spell)).map(spell=>spell.id)]));
  game.state.campaign.stage=8;game.state.campaign.switches=plain(context.h).filter(id=>id!=='ending_seen');
}
function startFixedFormation(context,game,region,kind){
  const roots={R02:'tollhouse',R03:'granary',R04:'orchard',R05:'crown',R06:'heart'};
  const root=roots[region],area=`${root}-depth-${context.dungeonInfo(root).total}`;
  const row=context.encounterTables[region].find(row=>row.id===`${region}_${kind}`);assert.ok(row);
  at(game,area,{x:5,y:18});
  const eligible=context.encounterEligible(region,game.state),index=eligible.findIndex(candidate=>candidate.id===row.id);
  assert.ok(index>=0,`${region}/${kind} is available at this real dungeon depth`);
  const before=eligible.slice(0,index).reduce((sum,candidate)=>sum+candidate.weight,0);
  const total=eligible.reduce((sum,candidate)=>sum+candidate.weight,0),low=before/total,high=(before+row.weight)/total;
  const advance=seed=>{let value=seed;value^=value<<13;value^=value>>>17;value^=value<<5;return(value>>>0)/4294967296;};
  let seed=1;while(!(advance(seed)>=low&&advance(seed)<high)&&seed<2000000)seed++;
  assert.ok(seed<2000000,'deterministic formation seed exists');game.state.rng=seed;
  const patrol=context.he[area].entities.find(entity=>entity.kind==='enemy');assert.ok(patrol);
  begin(context,game,area,patrol.id);
  return game.state.battle;
}

test('largest allowed regional groups fit declared ordinary shop-loadout combat budgets',async t=>{
  const samples=[];
  for(const [region,level]of [['R02',9],['R03',15],['R04',21],['R05',27],['R06',33]])for(const kind of ['swarm-nine','four-guards','guarded-swarm']){
    const {context,game}=createGame(7321);fixedRegionalParty(context,game,region,level);
    const battle=startFixedFormation(context,game,region,kind);
    assert.equal(battle.formationId,`${region}_${kind}`,'the requested real table row was rolled');
    const result=await actualBattle(context,game,35);assert.ok(game.state.heroes.every(hero=>hero.hp>0),`${region}/${kind} sampled party survives`);samples.push({region,kind,count:result.count,rounds:result.rounds,level,gold:result.gold});
  }
  t.diagnostic(JSON.stringify(samples));
});

for(const job of ['warden','striker','scout','mender','arcanist','spellblade'])test(`${job} lead clears the opening formation sequence and boss with earned resources`,async()=>{
  const {context,game}=createGame(7321,job);
  for(let i=1;i<=6;i++){if(i===1||i===3||i===5)normalRest(game);begin(context,game,'works',`encounter${i}`);await actualBattle(context,game);finish(game);}
  await prepareOpening(context,game);normalRest(game);assert.equal(game.buy('POTION',3),3);begin(context,game,'works','bailiff');await actualBattle(context,game);
  assert.ok(game.state.heroes.every(hero=>hero.hp>0),`${job} tested route keeps the party alive`);
  assert.ok(game.state.heroes.every(hero=>hero.level>=4&&hero.level<=6));
});
