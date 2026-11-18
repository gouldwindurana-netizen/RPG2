import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, MAPS, restPrice, shopOffers } from './engine';
import { DEFAULT_PROFILE } from './characters';
import { TRANSITIONS } from './campaign';
import type { Area, DemoEngine, SettlementArea } from './contracts';

class MemoryStorage implements Storage {
  data=new Map<string,string>(); get length(){return this.data.size;}clear(){this.data.clear();}getItem(key:string){return this.data.get(key)??null;}key(index:number){return [...this.data.keys()][index]??null;}removeItem(key:string){this.data.delete(key);}setItem(key:string,value:string){this.data.set(key,value);}
}
function start(storage:Storage|null=null){const e=createEngine({storage,roundDelay:0,seed:2468});e.beginAdventure(DEFAULT_PROFILE);e.skipIntro();return e;}
function drain(e:DemoEngine){for(let i=0;e.state.message&&i<50;i++)e.dismiss();assert.equal(e.state.message,null);}
function at(e:DemoEngine,area:Area,x:number,y:number){drain(e);e.state.area=area;e.state.player={x,y,facing:'up'};}

// These small fixture tests isolate travel boundaries; the campaign journey
// separately earns every level and progression switch through ordinary play.
test('walking through a town gate transitions before encounter rolls and needs no interaction button',()=>{
  const e=start();at(e,'camp',27,14);e.state.encounterSteps=18;
  const rng=e.state.rng,steps=e.state.steps;e.move('right');
  assert.equal(e.state.area,'overworld');assert.equal(e.state.mode,'explore');assert.equal(e.state.message,null);
  assert.equal(e.state.rng,rng);assert.equal(e.state.encounterSteps,0);assert.equal(e.state.steps,steps+1);
  assert.ok(!MAPS.overworld.entities.some(entity=>entity.x===e.state.player.x&&entity.y===e.state.player.y));
  const before={...e.state.player};e.move('down');assert.equal(e.state.area,'overworld');assert.equal(e.state.player.y,before.y+1);
});

test('a blocked crossing keeps the approach tile and both dungeon entrances require the briefing',()=>{
  const e=start();at(e,'overworld',8,28);e.state.encounterSteps=18;const rng=e.state.rng,steps=e.state.steps;
  e.move('up');assert.equal(e.state.area,'overworld');assert.deepEqual({x:e.state.player.x,y:e.state.player.y},{x:8,y:28});
  assert.ok(e.state.message?.text.includes('convoy'));assert.equal(e.state.rng,rng);assert.equal(e.state.steps,steps);drain(e);
  at(e,'overworld',15,32);e.move('up');assert.equal(e.state.area,'overworld');assert.ok(e.state.message?.text.includes('Bessa'));drain(e);
  at(e,'camp',27,8);e.move('right');assert.equal(e.state.area,'camp');assert.ok(e.state.message?.text.includes('Bessa'));drain(e);
  e.state.flags.briefed=true;e.move('right');assert.equal(e.state.area,'works');assert.equal(e.state.message,null);
});

test('town, shop, inn and world returns retain the original outside approach across saves',()=>{
  const storage=new MemoryStorage();let e=start(storage);e.state.campaign.stage=2;at(e,'overworld',8,21);e.move('up');
  assert.equal(e.state.area,'dunmere');assert.deepEqual(e.state.overworldReturn,{x:8,y:21});
  at(e,'dunmere',7,7);e.move('up');assert.equal(e.state.area,'dunmere-shop');assert.deepEqual(e.state.overworldReturn,{x:8,y:21});
  assert.equal(e.save(),true);e=createEngine({storage,roundDelay:0});assert.equal(e.state.area,'dunmere-shop');
  assert.equal(e.state.safeReturn.area,'dunmere-shop');assert.deepEqual(e.state.overworldReturn,{x:8,y:21});
  e.move('down');assert.equal(e.state.area,'dunmere');assert.deepEqual({x:e.state.player.x,y:e.state.player.y},{x:7,y:7});
  at(e,'dunmere',15,7);e.move('up');assert.equal(e.state.area,'dunmere-inn');assert.deepEqual(e.state.overworldReturn,{x:8,y:21});
  at(e,'dunmere-inn',10,6);e.interact('inn-R02');assert.equal(e.state.message?.speaker,'Innkeeper');assert.ok(e.state.message?.text.includes('20 gold'));
  const before=e.state.gold;e.state.heroes[0].hp=1;e.rest();assert.equal(e.state.gold,before-20);assert.equal(e.state.heroes[0].hp,e.state.heroes[0].maxHp);drain(e);
  at(e,'dunmere-inn',10,11);e.move('down');assert.equal(e.state.area,'dunmere');
  at(e,'dunmere',3,14);e.move('left');assert.equal(e.state.area,'overworld');assert.deepEqual({x:e.state.player.x,y:e.state.player.y},{x:8,y:21});
  e.move('down');assert.equal(e.state.area,'overworld');assert.equal(e.state.player.y,22);
});

test('every settlement has safe, reloadable service rooms and a working exterior return',()=>{
  const storage=new MemoryStorage();let e=start(storage);
  for(const [index,parent]of (['camp','dunmere','fen','orchard','crown','veyr'] as SettlementArea[]).entries())for(const service of ['shop','inn'] as const){
    const area=`${parent}-${service}` as Area,door=MAPS[parent].entities.find(entity=>entity.id===`door-${parent}-${service}`)!;
    assert.ok(door,`${parent} has ${service} door`);assert.equal(door.kind,'exit');
    assert.equal(MAPS[area].parent,parent);assert.equal(MAPS[area].kind,'interior');assert.equal(MAPS[area].service,service);
    at(e,parent,door.x,door.y+1);e.state.encounterSteps=18;const rng=e.state.rng;e.move('up');assert.equal(e.state.area,area);
    e.move('up');e.move('down');assert.equal(e.state.mode,'explore');assert.equal(e.state.rng,rng,'interiors do not roll encounters');
    assert.equal(e.save(),true);e=createEngine({storage,roundDelay:0});assert.equal(e.state.area,area);assert.equal(e.state.safeReturn.area,area);
    assert.equal(restPrice(e.state),parent==='camp'?0:(index+1)*10);assert.ok(shopOffers(e.state).some(offer=>offer.itemId===`R0${index+1}_MARA_WEAPON`));
    const leave=MAPS[area].entities.find(entity=>entity.id===`leave-${parent}-${service}`)!;at(e,area,leave.x,leave.y-1);e.move('down');assert.equal(e.state.area,parent);
    assert.deepEqual({x:e.state.player.x,y:e.state.player.y},{x:TRANSITIONS[leave.id].x,y:TRANSITIONS[leave.id].y});
    assert.ok(!MAPS[parent].entities.some(entity=>entity.kind==='exit'&&entity.x===e.state.player.x&&entity.y===e.state.player.y));
  }
});
