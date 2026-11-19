'use strict';
// Exercise the shipped engine. Explicit local states isolate the uploaded
// encounter and save regressions without claiming an earned campaign route.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const html = fs.readFileSync(process.env.GAME_HTML || path.join(__dirname, '..', 'The_Road_Beyond_the_Bells.html'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
function setup() {
  const c = vm.createContext({structuredClone});
  vm.runInContext(html.slice(html.indexOf('var l={schemaVersion'), html.indexOf('var De=new Set')), c);
  const saves = new Map(), storage = {getItem: key => saves.get(key) ?? null, setItem: (key,value) => saves.set(key,String(value))};
  const game = c.Ee({storage, seed:7321, roundDelay:0});
  assert.equal(game.beginAdventure(c.R), true); game.skipIntro(); game.configure({encounters:'visible'});
  return {c, game, storage, saved:()=>JSON.parse(saves.get(c.G)), reload:()=>c.Ee({storage, seed:7321, roundDelay:0})};
}
function near(fix, id) {
  const entry = Object.entries(fix.c.he).find(([,map])=>map.entities.some(entity=>entity.id===id));
  assert.ok(entry, id); const [area,map] = entry, entity = map.entities.find(entity=>entity.id===id);
  const point = [[-1,0],[1,0],[0,-1],[0,1]].map(([dx,dy])=>({x:entity.x+dx,y:entity.y+dy})).find(point=>fix.c.q.includes(map.tiles[point.y]?.[point.x])&&!map.entities.some(e=>e.x===point.x&&e.y===point.y));
  assert.ok(point, 'walkable approach');
  Object.assign(fix.game.state,{mode:'explore',area,player:{...point,facing:'right'},message:null,reward:null});
  return entity;
}
async function victory(fix) {
  const battle=fix.game.state.battle;
  for(const hero of fix.game.state.heroes) assert.equal(fix.game.plan(hero.id,{type:'guard',target:hero.id}),true);
  for(const enemy of battle.enemies) enemy.hp=0;
  await fix.game.resolveRound();
  assert.equal(fix.game.state.mode,'victory');
}
function addGrowth(fix) {
  const bonus={hp:12,mp:3,atk:2,def:1,mag:1,acc:2,u:{lost:24,spent:9,atk:4}};
  fix.game.state.gr.Mara=bonus;
  const old=fix.game.state.heroes[0],derived=fix.c.be(old.id,old.level,old.equipment,fix.game.state.profile,old.job);
  fix.game.state.heroes[0]={...derived,hp:old.hp,mp:old.mp,status:old.status};
  return bonus;
}

test('visible patrol encounters start without the uploaded undefined-helper exception',()=>{
  const fix=setup(); near(fix,'encounter1');
  assert.doesNotThrow(()=>fix.game.interact('encounter1'));
  assert.equal(fix.game.state.mode,'battle'); assert.equal(fix.game.state.battle.phase,'planning');
  assert.ok(fix.game.state.battle.enemies.length>0); assert.ok(fix.game.state.battle.enemies.every(enemy=>Number.isFinite(enemy.hp)&&enemy.hp>0));
});

test('walking encounters cross the trigger into a complete planning state',()=>{
  const fix=setup(), map=fix.c.he['works-depth-2'];
  let route;
  for(let y=1;y<map.height-1&&!route;y++)for(let x=1;x<map.width-2&&!route;x++){
    const points=[{x,y},{x:x+1,y}];
    if(points.every(p=>fix.c.q.includes(map.tiles[p.y]?.[p.x])&&!map.entities.some(e=>Math.abs(e.x-p.x)+Math.abs(e.y-p.y)<=2)))route=points;
  }
  assert.ok(route);fix.game.configure({encounters:'classic'});
  Object.assign(fix.game.state,{area:'works-depth-2',player:{...route[0],facing:'right'},encounterSteps:17});
  assert.doesNotThrow(()=>fix.game.move('right'));
  assert.equal(fix.game.state.mode,'battle');assert.equal(fix.game.state.battle.phase,'planning');
  assert.equal(fix.game.state.battle.regionId,'R01');
});

test('ordinary battle resolution, reward dismissal and reload return to exploration',async()=>{
  const fix=setup();near(fix,'encounter1');fix.game.interact('encounter1');await victory(fix);
  assert.ok(fix.game.state.reward.lines.some(line=>line.includes('EXP')));
  fix.game.continue();assert.equal(fix.game.state.mode,'explore');assert.equal(fix.game.state.battle,null);
  const loaded=fix.reload();assert.equal(loaded.state.mode,'explore');assert.equal(loaded.state.area,'works');
});

test('automatic cache equipment uses a real regional item and remains equipable after reload',()=>{
  const fix=setup();near(fix,'chest');fix.game.interact('chest');
  assert.equal(fix.game.state.mode,'victory');assert.equal(Object.hasOwn(fix.game.state.inventory,'undefined'),false);
  assert.equal(fix.game.state.inventory.R01_SET_CHARM,1);assert.ok(fix.game.state.setAcquired.includes('R01_SET_CHARM'));
  assert.ok(fix.game.state.reward.lines.some(line=>line.includes(fix.c.K('R01_SET_CHARM').name)));
  fix.game.continue();assert.equal(fix.game.equip('Mara','R01_SET_CHARM'),true);
  const loaded=fix.reload();assert.equal(loaded.state.mode,'explore');assert.equal(loaded.state.heroes[0].equipment.charm,'R01_SET_CHARM');
});

test('automatic boss equipment resolves a valid item and saved collection record',async()=>{
  const fix=setup();near(fix,'bailiff');fix.game.interact('bailiff');
  assert.equal(fix.game.state.battle.kind,'boss');await victory(fix);
  assert.equal(Object.hasOwn(fix.game.state.inventory,'undefined'),false);
  assert.equal(fix.game.state.inventory.R01_SET_HEAD,1);assert.ok(fix.game.state.setAcquired.includes('R01_SET_HEAD'));
  fix.game.continue();while(fix.game.state.message)fix.game.dismiss();
  const loaded=fix.reload();assert.equal(loaded.state.mode,'explore');assert.equal(loaded.state.flags.bossDefeated,true);assert.equal(loaded.state.inventory.R01_SET_HEAD,1);
});

test('known malformed growth-build auto-loot key is repaired without discarding the journey',()=>{
  const fix=setup();fix.game.state.gold=733;fix.game.state.inventory.POTION=7;fix.game.state.inventory.undefined=1;
  fix.game.state.difficulty='hard';fix.game.state.sp.Mara={'shield-bash':7};fix.game.state.campaign.stage=2;fix.game.state.campaign.switches=['orren_rescued','reedbank_moved'];fix.game.save();
  const loaded=fix.reload();assert.equal(loaded.state.mode,'explore');assert.equal(loaded.state.gold,733);assert.equal(loaded.state.inventory.POTION,7);assert.equal(Object.hasOwn(loaded.state.inventory,'undefined'),false);
  assert.equal(loaded.state.difficulty,'hard');assert.equal(loaded.state.sp.Mara['shield-bash'],7);assert.equal(loaded.state.campaign.stage,2);
});

test('unrecognized inventory items remain invalid rather than silently accepted',()=>{
  const fix=setup();fix.game.state.inventory.NOT_A_GAME_ITEM=1;fix.game.save();
  assert.equal(fix.reload().state.mode,'creation');
});

test('valid earned growth bonuses and usage records survive save/reload',()=>{
  const fix=setup(), bonus=addGrowth(fix), before=plain(fix.game.state.heroes[0]);fix.game.save();
  const loaded=fix.reload();assert.equal(loaded.state.mode,'explore');assert.deepEqual(plain(loaded.state.gr.Mara),bonus);assert.deepEqual(plain(loaded.state.heroes[0]),before);
});

test('starting or resetting a journey cannot inherit the previous expedition growth',()=>{
  const fix=setup();addGrowth(fix);
  const starter=fix.c.be0('Mara',1,fix.game.state.heroes[0].equipment,fix.c.R,'warden');
  assert.equal(fix.game.beginAdventure({...fix.c.R,name:'New Rowan'}),true);
  assert.deepEqual(plain(fix.game.state.gr),{});assert.equal(fix.game.state.heroes[0].maxHp,starter.maxHp);assert.equal(fix.game.state.heroes[0].maxMp,starter.maxMp);assert.equal(fix.game.state.heroes[0].attack,starter.attack);
  addGrowth(fix);fix.game.reset();assert.deepEqual(plain(fix.game.state.gr),{});assert.equal(fix.game.state.heroes[0].maxHp,starter.maxHp);
});

test('malformed optional growth fields normalize without granting invalid bonuses or resetting valid progress',()=>{
  const fix=setup();fix.game.state.gold=321;
  fix.game.state.gr.Mara={hp:'bad',mp:-5,atk:NaN,def:1,mag:0,acc:999,u:{lost:12,spent:-1,atk:'3'}};
  fix.game.state.gr.Unknown={hp:100};fix.game.state.seen={REEDBACK:1,WISP:true,HOUND:'yes',Unknown:1};fix.game.save();
  const loaded=fix.reload();assert.equal(loaded.state.mode,'explore');assert.equal(loaded.state.gold,321);
  assert.deepEqual(plain(loaded.state.gr),{Mara:{hp:0,mp:0,atk:0,def:1,mag:0,acc:0,u:{lost:12,spent:0,atk:0}}});
  assert.deepEqual(plain(loaded.state.seen),{REEDBACK:1,WISP:1});
});

test('genuine legacy missing spellbooks preserve earned level unlocks without applying new unrestricted purchasing rules',()=>{
  const oldHtml=fs.readFileSync(path.join(__dirname,'..','jobs-baseline.html'),'utf8'), old=vm.createContext({structuredClone});
  vm.runInContext(oldHtml.slice(oldHtml.indexOf('var l={schemaVersion'),oldHtml.indexOf('var De=new Set')),old);
  const prior=old.Ee({storage:null,seed:7321});prior.beginAdventure({...old.R,job:'mender'});prior.skipIntro();
  const save=plain(prior.state);delete save.learnedSpells;
  const fix=setup(), loaded=fix.c.we(JSON.stringify(save),7321);assert.ok(loaded);
  for(const hero of loaded.heroes){
    const before=prior.state.heroes.find(h=>h.id===hero.id), previous=old.te.filter(skill=>old.H(before,skill)&&before.level>=(old.l.spell_tier_unlocks[skill.tier-1]??1)).map(skill=>skill.id);
    const expected=[...previous,...fix.c.starterSkillIds(hero.job).filter(id=>!previous.includes(id))];
    assert.deepEqual(plain(loaded.learnedSpells[hero.id]),plain(expected));
  }
  const high=fix.c.te.find(skill=>skill.id==='daybreak');
  assert.ok(high);assert.equal(fix.c.skillUnlocked(loaded.heroes[0],high),true,'uploaded no-level-lock behavior remains the current gameplay rule');
  assert.equal(loaded.learnedSpells.Mara.includes(high.id),false,'migration itself cannot grant unearned advanced magic');
});
