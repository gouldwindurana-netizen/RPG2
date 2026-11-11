import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, MAPS, SAVE_KEY, shopOffers, SPELLS } from './engine';
import { DEFAULT_PROFILE, canCast } from './characters';
import { isSafeLocation, TRANSITIONS } from './campaign';
import type { Area, DemoEngine } from './contracts';

class MemoryStorage implements Storage {
  data=new Map<string,string>();get length(){return this.data.size;}clear(){this.data.clear();}getItem(k:string){return this.data.get(k)??null;}key(i:number){return [...this.data.keys()][i]??null;}removeItem(k:string){this.data.delete(k);}setItem(k:string,v:string){this.data.set(k,v);}
}
function start(storage:Storage|null=null){const e=createEngine({storage,seed:321,roundDelay:0});e.beginAdventure(DEFAULT_PROFILE);e.skipIntro();e.configure({encounters:'visible'});return e;}
function drain(e:DemoEngine){while(e.state.message)e.dismiss();}
function beside(e:DemoEngine,area:Area,id:string){drain(e);e.state.area=area;const entity=e.map().entities.find(x=>x.id===id)!;assert.ok(entity,id);e.state.player={x:entity.x-1,y:entity.y,facing:'right'};e.interact(id);}
async function win(e:DemoEngine,area:Area,id:string){beside(e,area,id);assert.equal(e.state.mode,'battle');for(const enemy of e.state.battle!.enemies){enemy.hp=1;enemy.attack=0;}const target=e.state.battle!.enemies[0].id;for(const hero of e.state.heroes)e.plan(hero.id,{type:'attack',target});await e.resolveRound();assert.equal(e.state.mode,'victory');if(e.state.reward!.choices.length)e.claim(e.state.reward!.choices[0]);e.continue();drain(e);}

for(const version of [1,2])test(`version ${version} completed chapter migrates twice without ending or losing resources`,()=>{
  const storage=new MemoryStorage(),e=start(storage);e.state.flags.bossDefeated=true;e.state.flags.completed=true;e.state.cleared=['bailiff'];e.state.heroes[0].hp=37;e.state.inventory.HIGH_POTION=2;e.save();
  const old=JSON.parse(storage.getItem(SAVE_KEY)!);old.version=version;old.mode='ending';storage.setItem(SAVE_KEY,JSON.stringify(old));
  const migrated=createEngine({storage});assert.equal(migrated.state.campaign.stage,2);assert.equal(migrated.state.mode,'explore');assert.equal(migrated.state.flags.completed,false);assert.equal(migrated.state.heroes[0].hp,37);assert.equal(migrated.state.inventory.HIGH_POTION,2);assert.deepEqual(migrated.state.cleared,['bailiff']);
  assert.ok(migrated.state.campaign.switches.includes('orren_rescued'));assert.ok(migrated.state.campaign.switches.includes('reedbank_moved'));migrated.save();
  const twice=createEngine({storage});assert.equal(twice.state.campaign.stage,2);assert.equal(twice.state.heroes[0].hp,37);assert.equal(twice.state.inventory.HIGH_POTION,2);
});

test('final dialogue opens the ending once and postgame stays playable across reloads',()=>{
  const storage=new MemoryStorage(),e=start(storage);e.state.campaign.stage=10;e.state.flags.completed=true;e.state.campaign.switches=['heart_defeated'];e.state.message={speaker:'Bessa',text:'The road is open.'};e.state.messageQueue=[{speaker:'Ari',text:'Then we keep walking.'}];e.save();
  const resumed=createEngine({storage});resumed.dismiss();assert.equal(resumed.state.mode,'explore');assert.equal(resumed.state.message?.speaker,'Ari');resumed.dismiss();assert.equal(resumed.state.mode,'ending');assert.ok(resumed.state.campaign.switches.includes('ending_seen'));
  resumed.continue();drain(resumed);assert.equal(resumed.state.mode,'explore');beside(resumed,'camp','merchant');drain(resumed);assert.equal(resumed.state.mode,'explore');resumed.save();
  const postgame=createEngine({storage});assert.equal(postgame.state.mode,'explore');postgame.dismiss();assert.equal(postgame.state.mode,'explore');
});

test('regional service zones sell their tier, charge rest, and restore local defeat checkpoints',()=>{
  const storage=new MemoryStorage(),e=start(storage);e.state.gold=10000;
  for(const [area,tier]of [['orchard',4],['crown',5]] as const){
    e.state.area=area;e.state.player={x:13,y:12,facing:'right'};assert.equal(isSafeLocation(area,13,12),true);const item=`R0${tier}_MARA_WEAPON`;assert.ok(shopOffers(e.state).some(row=>row.itemId===item));assert.equal(e.buy(item),true);
    const before=e.state.gold;e.state.heroes[0].hp=1;e.rest();assert.equal(e.state.gold,before-tier*10);assert.equal(e.state.heroes[0].hp,e.state.heroes[0].maxHp);drain(e);assert.equal(e.state.safeReturn.area,area);assert.equal(createEngine({storage}).state.safeReturn.area,area);
    e.state.player={x:23,y:10,facing:'right'};assert.equal(shopOffers(e.state).length,0);const damaged=e.state.heroes[0].hp=3;e.rest();assert.equal(e.state.heroes[0].hp,damaged);
  }
  e.state.gold=10000;e.state.heroes[0].hp=1;beside(e,'heart','heart-relief');assert.equal(e.state.heroes[0].hp,e.state.heroes[0].maxHp);assert.equal(e.state.safeReturn.area,'heart');drain(e);e.state.mode='defeat';e.continue();assert.equal(e.state.area,'heart');assert.equal(e.state.player.x,4);assert.equal(e.state.heroes[0].hp,e.state.heroes[0].maxHp);
});

test('all eight unlocked caster tiers have usable spells and field recovery spends charges once',()=>{
  const storage=new MemoryStorage(),base=start(storage);base.state.xp=64796;base.save();const e=createEngine({storage});e.rest();drain(e);
  for(const hero of [e.state.heroes[2],e.state.heroes[3]])for(let tier=1;tier<=8;tier++)assert.ok(SPELLS.some(s=>s.tier===tier&&canCast(hero,s)),`${hero.job} tier ${tier}`);
  const healer=e.state.heroes[2],target=e.state.heroes[0];target.hp=0;const charges=healer.charges[3];assert.equal(e.castField('Iona','revive','Mara'),true);assert.equal(healer.charges[3],charges-1);assert.ok(target.hp>0);assert.equal(e.castField('Iona','revive','Mara'),false);assert.equal(healer.charges[3],charges-1);
  target.status='poison';assert.equal(e.castField('Iona','cleanse','Mara'),true);assert.equal(target.status,null);target.hp=1;assert.equal(e.castField('Iona','daybreak','Mara'),true);assert.ok(target.hp>400);assert.equal(e.castField('Soren','aurora','Mara'),false);
});

test('regional hunts unlock after their story handoff and finish via twelve repeatable patrol wins',async()=>{
  const e=start();e.state.campaign.stage=6;e.state.cleared=['B_R05_CENSER'];
  await win(e,'crown','R05_patrol_a');assert.equal(e.state.hunts.R05.wins,0);e.state.campaign.stage=7;
  for(let i=0;i<12;i++)await win(e,'crown','R05_patrol_a');assert.equal(e.state.hunts.R05.wins,12);assert.equal(e.state.hunts.R05.ready,true);assert.equal(e.state.cleared.includes('R05_patrol_a'),false);
  await win(e,'crown','R05_RARE');assert.deepEqual(e.state.hunts.R05,{wins:0,ready:false});assert.equal(e.state.campaign.stage,7);
});

test('save boundaries validate world dimensions, region hunts, unique sets and queued dialogue',()=>{
  for(const alter of [(s:any)=>{s.area='overworld';s.player.x=64;},(s:any)=>{s.hunts.R06.wins=13;},(s:any)=>{s.campaign.wildBattles=-1;},(s:any)=>{s.messageQueue=[{speaker:'A',text:3}];},(s:any)=>{s.inventory.R06_SET_HEAD=2;s.setAcquired=['R06_SET_HEAD'];}]){
    const storage=new MemoryStorage(),e=start(storage);e.save();const saved=JSON.parse(storage.getItem(SAVE_KEY)!);alter(saved);storage.setItem(SAVE_KEY,JSON.stringify(saved));assert.equal(createEngine({storage}).state.mode,'creation');
  }
  assert.equal(MAPS.overworld.width,64);assert.equal(TRANSITIONS['enter-heart'].minStage,8);
});
