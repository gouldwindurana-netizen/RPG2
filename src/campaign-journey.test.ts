import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, ITEMS, SPELLS, canCast, isEquipmentAllowed, shopOffers } from './engine';
import { DEFAULT_PROFILE } from './characters';
import type { Area, DemoEngine, Direction, Hero, HeroId } from './contracts';

class MemoryStorage implements Storage {
  private data = new Map<string,string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key:string) { return this.data.get(key) ?? null; }
  key(index:number) { return [...this.data.keys()][index] ?? null; }
  removeItem(key:string) { this.data.delete(key); }
  setItem(key:string,value:string) { this.data.set(key,value); }
}

// This journey never assigns simulation state. Every gain and story flag comes
// from the same movement, planning, shopping, recovery, and save APIs as the UI.
test('a fresh party walks all six regions and completes the campaign using earned levels and equipment', async t => {
  const storage = new MemoryStorage();
  let engine = createEngine({ storage, roundDelay:0, seed:12345 });
  assert.equal(engine.beginAdventure({...DEFAULT_PROFILE,name:'Ari'}),true);
  engine.skipIntro();
  engine.configure({encounters:'visible',battleSpeed:3});
  const battles:Record<string,number> = {};
  let fieldCasts = 0;
  const dismissAll = () => { for(let i=0;engine.state.message&&i<50;i++)engine.dismiss();assert.equal(engine.state.message,null); };
  function walkToEntity(id:string) {
    assert.equal(engine.state.mode,'explore',`walk to ${id}`);
    assert.equal(engine.state.message,null,`no dialogue blocks ${id}`);
    const map=engine.map(), entity=map.entities.find(e=>e.id===id);
    assert.ok(entity,`${engine.state.area}/${id} exists`);
    const dirs:[Direction,number,number][]=[['right',1,0],['left',-1,0],['down',0,1],['up',0,-1]];
    const start=engine.state.player;
    const queue=[{x:start.x,y:start.y,path:[] as Direction[]}];
    const visited=new Set<string>();
    let path:Direction[]|undefined;
    while(queue.length){
      const node=queue.shift()!,key=`${node.x},${node.y}`;
      if(visited.has(key))continue;
      visited.add(key);
      if(Math.abs(node.x-entity.x)+Math.abs(node.y-entity.y)<=1){path=node.path;break;}
      for(const [direction,dx,dy]of dirs){
        const x=node.x+dx,y=node.y+dy;
        if(!'gdsfb'.includes(map.tiles[y]?.[x]??'!')||map.entities.some(e=>e.x===x&&e.y===y&&e.kind!=='exit'))continue;
        queue.push({x,y,path:[...node.path,direction]});
      }
    }
    assert.ok(path,`${engine.state.area}/${id} reachable from ${start.x},${start.y}`);
    for(const direction of path)engine.move(direction);
    assert.equal(engine.state.mode,'explore',`travel to ${id} stays in exploration with visible encounters`);
    assert.ok(Math.abs(engine.state.player.x-entity.x)+Math.abs(engine.state.player.y-entity.y)<=1,`arrived at ${id}`);
  }
  function interact(id:string) { walkToEntity(id);engine.interact(id); }
  function speak(id:string) { interact(id);dismissAll(); }
  function exit(id:string,area:Area) { interact(id);assert.equal(engine.state.area,area,`travel ${id}`);dismissAll(); }
  function checkpoint() {
    assert.equal(engine.save(),true);
    const expected=structuredClone(engine.state);
    engine=createEngine({storage,roundDelay:0});
    assert.equal(engine.state.mode,expected.mode,'checkpoint mode survives');
    assert.deepEqual(engine.state.campaign,expected.campaign,'earned campaign progress survives');
    assert.equal(engine.state.xp,expected.xp,'earned EXP survives');
    assert.equal(engine.state.gold,expected.gold,'earned gold survives');
    assert.deepEqual(engine.state.heroes,expected.heroes,'equipment and resources survive');
    assert.deepEqual(engine.state.player,expected.player,'world position survives');
  }
  function rest(id:string) {
    walkToEntity(id);engine.interact(id);
    assert.ok(engine.state.message,`${id} provides an actual recovery conversation`);dismissAll();
    assert.ok(engine.state.heroes.every(h=>h.hp===h.maxHp&&h.status===null),'ordinary lodging restores the party');
    assert.ok(engine.state.heroes.every(h=>h.charges.every((n,i)=>n===h.maxCharges[i])),'lodging restores all charge tiers');
  }
  function equipSet() {
    for(const id of engine.state.setAcquired)engine.equip('Mara',id);
  }
  function shopUpgrades() {
    const region=Number(engine.state.area==='camp'?1:engine.state.area==='dunmere'?2:engine.state.area==='fen'?3:engine.state.area==='orchard'?4:engine.state.area==='crown'?5:6);
    const offers=shopOffers(engine.state);
    assert.ok(offers.length,'regional service exposes supplies and equipment');
    // Buy each current-region weapon/body as the normal battle budget permits.
    // Striker weapons go first: extra hits make them a useful early investment.
    for(const heroId of ['Tavin','Mara','Soren','Iona'] as HeroId[]){
      const hero=engine.state.heroes.find(h=>h.id===heroId)!;
      for(const slot of ['weapon','body'] as const){
        const item=ITEMS.find(item=>item.id.startsWith(`R0${region}_`)&&!item.set_id&&item.slot===slot&&isEquipmentAllowed(hero,item));
        if(!item||hero.equipment[slot]===item.id)continue;
        const offer=offers.find(row=>row.itemId===item.id);
        if(offer&&engine.state.gold>=offer.price+Number(region)*10){
          assert.equal(engine.buy(item.id),true,`buy ${item.id}`);
          assert.equal(engine.equip(hero.id,item.id),true,`equip ${item.id}`);
        }
      }
    }
    for(const [itemId,desired]of [['HIGH_POTION',3],['REVIVAL_SALT',2],['CLEAR_TONIC',2],['ANTIDOTE',2]]as const){
      const offer=offers.find(row=>row.itemId===itemId);
      if(!offer)continue;
      while((engine.state.inventory[itemId]??0)<desired&&engine.state.gold>offer.price+region*10)assert.equal(engine.buy(itemId),true);
    }
  }
  function recoverField() {
    for(const target of engine.state.heroes){
      const healer=engine.state.heroes.find(h=>h.id==='Iona')!;
      if(target.hp===0){
        const revive=SPELLS.filter(sp=>sp.effect==='revive'&&canCast(healer,sp)&&healer.charges[sp.tier-1]>0).at(-1);
        if(revive&&engine.castField(healer.id,revive.id,target.id))fieldCasts++;
        else engine.useItem('REVIVAL_SALT',target.id);
      }
      if(target.status){
        if(engine.castField('Iona','cleanse',target.id))fieldCasts++;
        else engine.useItem(target.status==='poison'?'ANTIDOTE':target.status==='silence'?'CLEAR_TONIC':'SOOTHING_DRAUGHT',target.id);
      }
      if(target.hp>0&&target.hp<target.maxHp*.8){
        const heal=SPELLS.filter(sp=>sp.effect==='heal'&&sp.target==='ally'&&canCast(healer,sp)&&healer.charges[sp.tier-1]>0).at(-1);
        if(heal&&engine.castField(healer.id,heal.id,target.id))fieldCasts++;
      }
    }
  }
  async function fight(id:string) {
    interact(id);
    assert.equal(engine.state.mode,'battle',`start actual fight ${id}`);
    const region=engine.state.battle!.regionId!;
    battles[region]=(battles[region]??0)+1;
    for(let round=0;round<100&&engine.state.mode==='battle';round++){
      const battle=engine.state.battle!, enemies=battle.enemies.filter(e=>e.hp>0), target=enemies[0];
      const wounded=engine.state.heroes.filter(h=>h.hp>0).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
      for(const hero of engine.state.heroes){
        if(hero.hp<=0||hero.status==='sleep')continue;
        let planned=false;
        const magic=SPELLS.filter(sp=>canCast(hero,sp)&&hero.charges[sp.tier-1]>0&&hero.status!=='silence');
        const fallen=engine.state.heroes.find(h=>h.hp===0);
        const revive=magic.filter(sp=>sp.effect==='revive').at(-1);
        const heals=magic.filter(sp=>sp.effect==='heal');
        if(fallen&&revive)planned=engine.plan(hero.id,{type:'spell',spellId:revive.id,target:fallen.id});
        if(!planned&&hero.id==='Iona'&&wounded.hp<wounded.maxHp*.55&&heals.length){
          const many=engine.state.heroes.filter(h=>h.hp>0&&h.hp<h.maxHp*.7).length>=2;
          const heal=(many?heals.filter(sp=>sp.target==='allAllies'):heals.filter(sp=>sp.target==='ally')).at(-1)??heals.at(-1)!;
          planned=engine.plan(hero.id,{type:'spell',spellId:heal.id,target:heal.target==='allAllies'?'all':wounded.id});
        }
        // Announced heavy rounds are guarded, except for urgent recovery above.
        if(!planned&&battle.kind!=='normal'&&battle.round%2===0)planned=engine.plan(hero.id,{type:'guard',target:hero.id});
        if(!planned&&hero.id==='Soren'){
          const spells=magic.filter(sp=>sp.effect==='damage');
          const ranked=spells.map(sp=>({sp,score:((sp.power??12)+hero.magic*2)*(target.weakness.includes(sp.element??'')?1.65:target.resistance.includes(sp.element??'')?.5:1)*(sp.target==='allEnemies'?enemies.length*.7:1)})).sort((a,b)=>b.score-a.score);
          const spell=ranked[0]?.sp;
          if(spell)planned=engine.plan(hero.id,{type:'spell',spellId:spell.id,target:spell.target==='allEnemies'?'all':target.id});
        }
        if(!planned&&wounded.hp<wounded.maxHp*.3&&(engine.state.inventory.HIGH_POTION??0)>0)planned=engine.plan(hero.id,{type:'item',itemId:'HIGH_POTION',target:wounded.id});
        if(!planned)planned=engine.plan(hero.id,{type:'attack',target:target.id});
        assert.equal(planned,true,`legal action ${id}/${hero.id}`);
      }
      await engine.resolveRound();
    }
    assert.equal(engine.state.mode,'victory',`${id} won at Lv ${engine.state.heroes[0].level}: ${engine.state.battle?.log.join(' | ')}`);
    if(engine.state.reward!.choices.length)engine.claim(engine.state.reward!.choices[0]);
    engine.continue();dismissAll();
    if(engine.state.mode==='explore'){equipSet();recoverField();}
  }
  function claimCache(id:string) { interact(id);assert.equal(engine.state.mode,'victory');assert.ok(engine.state.reward!.choices.length);engine.claim(engine.state.reward!.choices[0]);engine.continue();dismissAll();equipSet(); }
  function gateBlocked(id:string) { const before={area:engine.state.area,x:engine.state.player.x,y:engine.state.player.y};interact(id);assert.ok(engine.state.message,`${id} explains its closed gate`);assert.equal(engine.state.area,before.area);dismissAll(); }

  // Opening: all six authored fights, real walking back for each free recovery.
  gateBlocked('world-camp');speak('bessa');speak('lantern');
  for(let i=1;i<=6;i++){
    exit('toWorks','works');
    if(i===1)claimCache('chest');
    await fight(`encounter${i}`);
    exit('toCamp','camp');rest('fire');
  }
  exit('toWorks','works');await fight('bailiff');assert.equal(engine.state.campaign.stage,1);
  exit('toCamp','camp');speak('bessa');assert.equal(engine.state.campaign.stage,2);assert.equal(engine.state.flags.completed,false);rest('fire');checkpoint();
  exit('world-camp','overworld');exit('road-dunmere','overworld');exit('enter-dunmere','dunmere');
  gateBlocked('town-tollhouse');speak('leth');assert.equal(engine.state.campaign.stage,3);

  // Each region's normal rewards support its advertised boss level. Purchases
  // use earned money; all recovery follows physical return routes.
  for(let i=0;i<8;i++){
    walkToEntity('shop-R02');shopUpgrades();rest('inn-R02');exit('town-tollhouse','tollhouse');
    if(i===0)claimCache('cache-R02');
    await fight('R02_patrol_a');exit('world-tollhouse','overworld');exit('enter-dunmere','dunmere');
  }
  walkToEntity('shop-R02');shopUpgrades();rest('inn-R02');exit('town-tollhouse','tollhouse');
  await fight('B_R02_TOLL');speak('neri-rescue');assert.equal(engine.state.campaign.stage,4);checkpoint();
  exit('world-tollhouse','overworld');exit('ferry-fen','overworld');exit('enter-fen','fen');speak('sen');
  for(let i=0;i<8;i++){
    walkToEntity('shop-R03');shopUpgrades();rest('inn-R03');exit('town-granary','granary');
    if(i===0)claimCache('cache-R03');
    await fight('R03_patrol_a');exit('world-granary','overworld');exit('enter-fen','fen');
  }
  walkToEntity('shop-R03');shopUpgrades();rest('inn-R03');exit('town-granary','granary');await fight('B_R03_SILT');
  exit('world-granary','overworld');exit('enter-fen','fen');speak('sen');assert.equal(engine.state.campaign.stage,5);checkpoint();
  exit('world-fen','overworld');exit('pass-orchard','overworld');exit('enter-orchard','orchard');claimCache('cache-R04');
  for(let i=0;i<8;i++){walkToEntity('shop-R04');shopUpgrades();rest('inn-R04');await fight('R04_patrol_a');}
  walkToEntity('shop-R04');shopUpgrades();rest('inn-R04');await fight('B_R04_HART');speak('orchard-keeper');assert.equal(engine.state.campaign.stage,6);checkpoint();
  exit('world-orchard','overworld');exit('road-crown','overworld');exit('enter-crown','crown');claimCache('cache-R05');
  for(let i=0;i<8;i++){walkToEntity('shop-R05');shopUpgrades();rest('inn-R05');await fight('R05_patrol_a');}
  walkToEntity('shop-R05');shopUpgrades();rest('inn-R05');await fight('B_R05_CENSER');speak('halden');assert.equal(engine.state.campaign.stage,7);checkpoint();
  exit('world-crown','overworld');exit('gate-veyr','overworld');exit('enter-veyr','veyr');
  gateBlocked('town-heart');speak('veyr-leth');speak('veyr-neri');speak('veyr-bessa');assert.equal(engine.state.campaign.stage,8);claimCache('cache-R06');
  for(let i=0;i<8;i++){
    walkToEntity('shop-R06');shopUpgrades();rest('inn-R06');exit('town-heart','heart');
    await fight('R06_patrol_a');exit('world-heart','overworld');exit('enter-veyr','veyr');
  }
  walkToEntity('shop-R06');shopUpgrades();rest('inn-R06');exit('town-heart','heart');
  gateBlocked('B_R06_HEART');await fight('B_R06_CHOIR');rest('heart-relief');await fight('B_R06_VALE');assert.equal(engine.state.campaign.stage,9);rest('heart-relief');await fight('B_R06_HEART');
  assert.equal(engine.state.mode,'ending');assert.equal(engine.state.campaign.stage,10);assert.equal(engine.state.flags.completed,true);assert.ok(engine.state.heroes[0].level>=34);
  checkpoint();engine.continue();dismissAll();assert.equal(engine.state.mode,'explore','postgame is playable after closing the ending');
  exit('world-heart','overworld');exit('enter-veyr','veyr');speak('veyr-bessa');assert.equal(engine.state.mode,'explore','postgame conversations do not repeat the ending');checkpoint();
  assert.ok(fieldCasts>0,'real field magic was used during the expedition');
  t.diagnostic(`Campaign cleared at level ${engine.state.heroes[0].level}, ${engine.state.xp} EXP, ${engine.state.steps} walked tiles; battles ${JSON.stringify(battles)}, field casts ${fieldCasts}.`);
});
