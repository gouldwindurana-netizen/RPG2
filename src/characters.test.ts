import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, SPELLS, SAVE_KEY, getItem, canCast, isEquipmentAllowed } from './engine';
import { DEFAULT_PROFILE, LEGACY_PROFILE, JOBS, normalizeProfile, getIntroSteps } from './characters';
import type { CharacterProfile, DemoEngine, JobId } from './contracts';

class MemoryStorage implements Storage {
  data=new Map<string,string>();get length(){return this.data.size;}clear(){this.data.clear();}getItem(key:string){return this.data.get(key)??null;}key(i:number){return [...this.data.keys()][i]??null;}removeItem(key:string){this.data.delete(key);}setItem(key:string,value:string){this.data.set(key,value);}
}
function setup(job:JobId='warden',storage:Storage|null=null) {
  const engine=createEngine({storage,roundDelay:0,seed:12345});
  engine.beginAdventure({...DEFAULT_PROFILE,name:'Lyra',job});engine.skipIntro();engine.configure({encounters:'visible'});return engine;
}
function beside(engine:DemoEngine,id:string){engine.dismiss();engine.state.area='works';const entity=engine.map().entities.find(e=>e.id===id)!;assert.ok(entity);engine.state.player={x:entity.x-1,y:entity.y,facing:'right'};engine.interact(id);}

test('profile validation accepts bounded Unicode names and rejects markup, bad enums, and empty input',()=>{
  assert.equal(normalizeProfile({...DEFAULT_PROFILE,name:'  Éli O’Neil  '})?.name,'Éli O’Neil');
  for(const patch of [{name:''},{name:'   '},{name:'a'.repeat(15)},{name:'<img>'},{name:'a\nb'},{job:'archmage'},{skin:'#fff'},{hairStyle:'script'},{pronouns:'other'}])assert.equal(normalizeProfile({...DEFAULT_PROFILE,...patch}),null);
});

test('all six job choices have distinct mechanics and profile appearance survives a save',()=>{
  const signatures=new Set<string>();
  for(const job of JOBS){
    const storage=new MemoryStorage();const engine=setup(job.id,storage);const lead=engine.state.heroes[0];
    assert.equal(lead.name,'Lyra');assert.equal(lead.job,job.id);assert.equal(lead.role,job.name);
    assert.ok(isEquipmentAllowed(lead,getItem(lead.equipment.weapon)!));
    signatures.add(JSON.stringify([lead.maxHp,lead.attack,lead.defense,lead.accuracy,lead.hits,lead.charges]));
    for(const spell of SPELLS)assert.equal(canCast(lead,spell),job.spellIds.includes(spell.id));
    const restored=createEngine({storage});assert.equal(restored.state.heroes[0].job,job.id);assert.equal(restored.state.heroes[0].name,'Lyra');assert.deepEqual(restored.state.profile,engine.state.profile);
  }
  assert.equal(signatures.size,6);
});

test('new-game setup is transactional and opening scenes persist until completed',()=>{
  const storage=new MemoryStorage();let engine=createEngine({storage,roundDelay:0});
  assert.equal(engine.state.mode,'creation');assert.equal(engine.save(),false);
  const before=JSON.stringify(engine.state);assert.equal(engine.beginAdventure({...DEFAULT_PROFILE,name:'<bad>'}),false);assert.equal(JSON.stringify(engine.state),before);
  const profile:CharacterProfile={...DEFAULT_PROFILE,name:'Ren',job:'scout',pronouns:'they',skin:'deep',hair:'silver',cloak:'plum',hairStyle:'tied'};
  engine.beginAdventure(profile);engine.advanceIntro();engine.advanceIntro();
  engine=createEngine({storage,roundDelay:0});assert.equal(engine.state.mode,'intro');assert.equal(engine.state.introStep,2);assert.deepEqual(engine.state.profile,profile);
  while(engine.state.mode==='intro')engine.advanceIntro();
  assert.equal(engine.state.mode,'explore');assert.equal(engine.state.flags.briefed,false);assert.equal(engine.state.message,null);
  assert.ok(getIntroSteps(profile).some(step=>step.text.includes('their journey')));
  assert.deepEqual(getIntroSteps(profile).filter(step=>['Tavin','Iona','Soren'].includes(step.speaker)).map(step=>step.speaker),['Tavin','Iona','Soren']);
});

test('legacy saves retain expedition progress, equipment and wounded resources',()=>{
  const storage=new MemoryStorage(),old=setup('warden',storage);
  old.state.profile={...LEGACY_PROFILE};old.state.heroes[0].name='Mara';old.state.xp=52;old.state.gold=125;old.state.cleared=['encounter1'];old.state.heroes[0].hp=42;
  old.save();const legacy=JSON.parse(storage.getItem(SAVE_KEY)!);legacy.version=1;
  delete legacy.profile;delete legacy.settings;delete legacy.encounterSteps;delete legacy.introStep;
  for(const hero of legacy.heroes){delete hero.name;delete hero.job;}
  storage.setItem(SAVE_KEY,JSON.stringify(legacy));const migrated=createEngine({storage});
  assert.equal(migrated.state.version,2);assert.equal(migrated.state.mode,'explore');assert.equal(migrated.state.xp,52);assert.equal(migrated.state.gold,125);assert.deepEqual(migrated.state.cleared,['encounter1']);assert.equal(migrated.state.heroes[0].hp,42);assert.equal(migrated.state.profile.name,'Mara');assert.equal(migrated.state.heroes[0].job,'warden');assert.equal(migrated.state.settings.encounters,'visible');
});

test('corrupt profile/settings cannot enter the save boundary',()=>{
  for(const alter of [(v:any)=>{v.profile.name='<script>';},(v:any)=>{v.settings.battleSpeed='2';},(v:any)=>{v.introStep=-1;},(v:any)=>{v.encounterSteps=99;}]){
    const storage=new MemoryStorage();setup('mender',storage);const saved=JSON.parse(storage.getItem(SAVE_KEY)!);alter(saved);storage.setItem(SAVE_KEY,JSON.stringify(saved));assert.equal(createEngine({storage}).state.mode,'creation');
  }
});

test('class permissions depend on selected job, not the old stable hero identifier',()=>{
  const mender=setup('mender');assert.equal(mender.equip('Mara','R01_IONA_WEAPON'),true);assert.equal(mender.equip('Mara','R01_MARA_WEAPON'),false);
  beside(mender,'encounter1');assert.equal(mender.plan('Mara',{type:'spell',spellId:'mend',target:'Tavin'}),true);assert.equal(mender.plan('Mara',{type:'spell',spellId:'spark',target:mender.state.battle!.enemies[0].id}),false);
  const blade=setup('spellblade');assert.equal(blade.state.heroes[0].maxCharges[0],1);assert.ok(canCast(blade.state.heroes[0],SPELLS.find(s=>s.id==='ember')!));assert.equal(canCast(blade.state.heroes[0],SPELLS.find(s=>s.id==='spark')!),false);
});

test('classic walking encounters are seeded, bounded and absent in camp or disabled mode',()=>{
  const engine=setup();engine.configure({encounters:'classic'});
  assert.equal(engine.map().entities.some(e=>e.kind==='enemy'),false);
  engine.state.area='works';engine.state.player={x:7,y:13,facing:'right'};
  for(let i=0;i<18 && engine.state.mode==='explore';i++)engine.move(i%2?'left':'right');
  assert.equal(engine.state.mode,'battle');assert.equal(engine.state.battle!.kind,'normal');
  const off=setup();off.configure({encounters:'off'});off.state.area='works';off.state.player={x:7,y:13,facing:'right'};
  for(let i=0;i<50;i++)off.move(i%2?'left':'right');assert.equal(off.state.mode,'explore');assert.ok(off.map().entities.some(e=>e.kind==='boss'));
  off.state.area='camp';off.state.player={x:11,y:10,facing:'right'};off.configure({encounters:'classic'});for(let i=0;i<40;i++)off.move(i%2?'left':'right');assert.equal(off.state.mode,'explore');
});

test('repeat commands reuse legal actions and fall back when a spell has no charges',async()=>{
  const engine=setup('mender');beside(engine,'encounter1');
  const battle=engine.state.battle!;battle.enemies.forEach(e=>{e.hp=1000;e.attack=0;});
  for(const hero of engine.state.heroes)engine.plan(hero.id,{type:'guard',target:hero.id});
  engine.plan('Mara',{type:'spell',spellId:'mend',target:'Tavin'});await engine.resolveRound();
  engine.state.heroes[0].charges[0]=0;engine.repeatPlans();
  assert.equal(engine.state.battle!.phase,'planning');assert.equal(engine.state.battle!.plans.Mara?.type,'attack');assert.equal(engine.state.battle!.plans.Tavin?.type,'guard');
  assert.equal(engine.state.battle!.enemies[0].hp,1000);
});

test('custom hero display name reaches combat logs without changing action identifiers',async()=>{
  const engine=setup();beside(engine,'encounter1');const target=engine.state.battle!.enemies[0];
  for(const hero of engine.state.heroes)engine.plan(hero.id,{type:'attack',target:target.id});
  await engine.resolveRound();assert.ok(engine.state.battle!.log.some(line=>line.startsWith('Lyra attacks')));assert.ok(engine.state.heroes.some(h=>h.id==='Mara'));
});

test('repeat replaces partial reservations before replaying the previous item user',async()=>{
  const engine=setup('mender');beside(engine,'encounter1');
  engine.state.battle!.enemies.forEach(enemy=>{enemy.hp=1000;enemy.attack=0;});
  engine.state.inventory.POTION=2;
  for(const hero of engine.state.heroes)engine.plan(hero.id,{type:'guard',target:hero.id});
  engine.plan('Mara',{type:'item',itemId:'POTION',target:'Mara'});
  engine.plan('Tavin',{type:'attack',target:engine.state.battle!.enemies[0].id});
  await engine.resolveRound();
  assert.equal(engine.state.inventory.POTION,1);
  assert.equal(engine.plan('Tavin',{type:'item',itemId:'POTION',target:'Mara'}),true);
  engine.repeatPlans();
  assert.equal(engine.state.battle!.plans.Mara?.type,'item');
  assert.equal(engine.state.battle!.plans.Mara?.itemId,'POTION');
  assert.equal(engine.state.battle!.plans.Tavin?.type,'attack');
  assert.equal(engine.state.inventory.POTION,1);
});

test('every job can clear the authored expedition and boss using ordinary recovery',async()=>{
  for(const job of JOBS){
    const engine=setup(job.id);
    for(const id of ['encounter1','encounter2','encounter3','encounter4','encounter5','encounter6','bailiff']){
      beside(engine,id);
      for(let n=0;n<60 && engine.state.mode==='battle';n++){
        const battle=engine.state.battle!,enemy=battle.enemies.find(e=>e.hp>0)!;
        const wounded=engine.state.heroes.filter(h=>h.hp>0).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
        for(const hero of engine.state.heroes){
          if(hero.hp<=0 || hero.status==='sleep')continue;
          if(battle.kind==='boss' && battle.round%2===0)engine.plan(hero.id,{type:'guard',target:hero.id});
          else if(canCast(hero,SPELLS[0]) && hero.charges[0] && wounded.hp<wounded.maxHp*.6)engine.plan(hero.id,{type:'spell',spellId:'mend',target:wounded.id});
          else if(canCast(hero,SPELLS.find(s=>s.id==='spark')!) && hero.charges[0])engine.plan(hero.id,{type:'spell',spellId:enemy.weakness.includes('frost')?'frost':enemy.weakness.includes('lightning')?'spark':'ember',target:enemy.id});
          else if(hero.job==='spellblade' && hero.charges[0])engine.plan(hero.id,{type:'spell',spellId:'ember',target:enemy.id});
          else engine.plan(hero.id,{type:'attack',target:enemy.id});
        }
        await engine.resolveRound();
      }
      assert.equal(engine.state.mode,'victory',`${job.id} wins ${id}`);
      if(engine.state.reward!.choices.length)engine.claim(engine.state.reward!.choices[0]);engine.continue();engine.dismiss();engine.state.area='camp';engine.rest();engine.dismiss();
    }
    assert.ok(engine.state.flags.bossDefeated,job.id);
  }
});
