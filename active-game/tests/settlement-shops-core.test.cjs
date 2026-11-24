'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(process.env.GAME_HTML||path.join(root,'The_Road_Beyond_the_Bells.html'),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
function context(source=html){const c=vm.createContext({structuredClone});vm.runInContext(source.slice(source.indexOf('var l={schemaVersion'),source.indexOf('var De=new Set')),c,{timeout:5000});return c;}
function setup(source=html){const c=context(source),saves=new Map(),storage={getItem:id=>saves.get(id)??null,setItem:(id,value)=>saves.set(id,String(value))};const game=c.Ee({storage,roundDelay:0});game.beginAdventure({...c.R,name:'Rowan'});game.skipIntro();game.configure({encounters:'classic'});game.state.gold=10000;return{c,game,saves,storage,reload:()=>c.Ee({storage,roundDelay:0})};}
function enter(fix,record){const{game}=fix;game.state.message=null;game.state.messageQueue=[];game.state.area=record.parent;game.state.player={...record.approach,facing:'up'};game.move('up');assert.equal(game.state.area,record.area);return game;}
function approachKeeper(game){for(let i=0;i<7;i++)game.move('up');assert.deepEqual(plain(game.state.player),{x:12,y:6,facing:'up'});}
function walkOut(game,record){game.state.message=null;for(let y=game.state.player.y;y<14;y++)game.move('down');assert.equal(game.state.area,record.parent);assert.deepEqual(plain(game.state.player),{...plain(record.approach),facing:'down'});}

test('twelve building-based stores move each existing keeper into one safe regional room without adding world sites',()=>{
 const c=context();assert.equal(c.settlementShopRecords.length,12);assert.equal(c.k.length,10);
 for(const record of c.settlementShopRecords){const town=c.he[record.parent],room=c.he[record.area],entrance=town.entities.find(e=>e.id===record.doorId),exit=room.entities.find(e=>e.id===record.exitId);assert.equal(room.kind,'shop');assert.equal(room.safe,true);assert.equal(c.M(record.area,12,6),record.region);assert.equal(c.p(record.area,12,6),true);assert.equal(town.entities.some(e=>e.id===record.merchantId),false);assert.equal(Object.values(c.he).flatMap(map=>map.entities).filter(e=>e.id===record.merchantId).length,1);assert.ok(room.entities.find(e=>e.id===record.merchantId&&e.shopKind===record.kind&&e.shopkeeper));assert.equal(entrance.destination,record.area);assert.equal(exit.destination,record.parent);assert.ok(c.q.includes(town.tiles[entrance.y][entrance.x]));assert.ok(c.q.includes(room.tiles[exit.y][exit.x]));assert.deepEqual(plain(c.g[record.exitId]),{area:record.parent,...plain(record.approach),facing:'down'});}
});

test('walking into and out of every shop preserves combat resources, RNG, story and the overworld approach',()=>{
 const fix=setup();for(const record of fix.c.settlementShopRecords){fix.game.state.area=record.parent;fix.c.depthVisit(fix.game.state);const before=plain({rng:fix.game.state.rng,gold:fix.game.state.gold,heroes:fix.game.state.heroes,hx:fix.game.state.hx,campaign:fix.game.state.campaign,overworldReturn:fix.game.state.overworldReturn,inventory:fix.game.state.inventory});enter(fix,record);assert.equal(fix.game.state.battle,null);assert.equal(fix.game.map().kind,'shop');assert.equal(fix.game.state.encounterSteps,0);walkOut(fix.game,record);assert.deepEqual(plain({rng:fix.game.state.rng,gold:fix.game.state.gold,heroes:fix.game.state.heroes,hx:fix.game.state.hx,campaign:fix.game.state.campaign,overworldReturn:fix.game.state.overworldReturn,inventory:fix.game.state.inventory}),before);}
});

test('a weapon merchant is reached inside, sells only equipment and maintains shared copy accounting',()=>{
 const fix=setup(),record=fix.c.settlementShopRecords.find(r=>r.parent==='camp'&&r.kind==='weapon');enter(fix,record);assert.equal(fix.game.state.message,null);fix.game.interact(record.merchantId);assert.equal(fix.game.state.message,null,'keeper is not usable from the door');approachKeeper(fix.game);fix.game.interact(record.merchantId);assert.equal(fix.game.state.message.speaker,'Weapon Shop');const id='R01_MARA_WEAPON',before=fix.game.state.inventory[id],gold=fix.game.state.gold;assert.equal(fix.game.buy('POTION',1),false);assert.equal(fix.game.buy(id,2),2);assert.equal(fix.game.state.inventory[id],before+2);assert.ok(fix.game.state.gold<gold);assert.equal(fix.c.eqAvailable(fix.game.state,id),fix.c.eqOwned(fix.game.state,id)-fix.c.eqUsed(fix.game.state,id));
});

test('skill merchants retain region-tier stock and learning spends gold without restoring MP',()=>{
 const fix=setup(),record=fix.c.settlementShopRecords.find(r=>r.parent==='dunmere'&&r.kind==='magic');enter(fix,record);approachKeeper(fix.game);fix.game.state.heroes[0].mp=1;fix.game.interact(record.merchantId);assert.equal(fix.game.state.message.speaker,'Skill Shop');assert.ok(fix.c.skillOffers(fix.game.state,'Mara').some(o=>o.skillId==='rally'&&!o.known));assert.equal(fix.game.buySkill('Mara','rally'),true);assert.equal(fix.game.state.heroes[0].mp,1);assert.ok(fix.game.state.learnedSpells.Mara.includes('rally'));assert.equal(fix.game.buy('POTION',1),false);assert.equal(fix.game.buySkill('Mara','rally'),false);
});

test('new interior saves and open merchant messages reload without changing owned equipment or progress',()=>{
 const fix=setup(),record=fix.c.settlementShopRecords.find(r=>r.parent==='fen'&&r.kind==='weapon');enter(fix,record);approachKeeper(fix.game);fix.game.interact(record.merchantId);fix.game.buy('R03_MARA_WEAPON',1);assert.equal(fix.game.save(),true);const before=plain(fix.game.state),restored=fix.reload();assert.equal(restored.state.area,record.area);assert.deepEqual(plain(restored.state.player),before.player);assert.equal(restored.state.message.speaker,'Weapon Shop');assert.deepEqual(plain(restored.state.inventory),before.inventory);assert.deepEqual(plain(restored.state.heroes),before.heroes);assert.deepEqual(plain(restored.state.campaign),before.campaign);restored.dismiss();walkOut(restored,record);
});

test('genuine preceding saves at exterior shop approaches and with an open shop remain valid',()=>{
 const previous=fs.readFileSync(path.join(root,'settlement-baseline.html'),'utf8'),legacy=setup(previous);legacy.game.state.area='camp';legacy.game.state.player={x:10,y:7,facing:'up'};legacy.game.interact('weapon-camp');assert.equal(legacy.game.state.message.speaker,'Weapon Shop');legacy.game.save();const c=context(),saved=legacy.saves.get(legacy.c.G),restored=c.Ee({storage:{getItem:()=>saved,setItem:()=>{}},roundDelay:0});assert.equal(restored.state.area,'camp');assert.equal(restored.state.message.speaker,'Weapon Shop');assert.deepEqual(plain(restored.state.player),{x:10,y:7,facing:'up'});assert.deepEqual(plain(restored.state.inventory),plain(legacy.game.state.inventory));restored.dismiss();restored.move('up');assert.equal(restored.state.area,'camp','old approach remains outside the corrected threshold');assert.deepEqual(plain(restored.state.player),{x:10,y:6,facing:'up'});restored.move('up');assert.equal(restored.state.area,'shop-camp-weapon');
});

test('outdoor item counters keep their original location and merchant behavior',()=>{
 const fix=setup();for(const parent of ['camp','dunmere','fen','orchard','crown','veyr']){const merchant=fix.c.he[parent].entities.find(e=>e.kind==='npc'&&e.shopKind==='items');assert.ok(merchant);fix.game.state.area=parent;fix.game.state.player={x:merchant.x,y:merchant.y+1,facing:'up'};fix.game.state.message=null;fix.game.interact(merchant.id);assert.equal(fix.game.state.message.speaker,'Item Shop');const count=fix.game.state.inventory.POTION;assert.equal(fix.game.buy('POTION',1),1);assert.equal(fix.game.state.inventory.POTION,count+1);fix.game.dismiss();}
});

test('counter walls, shopkeeper and room edges block travel without blocking the exit route',()=>{
 const fix=setup(),record=fix.c.settlementShopRecords[0];enter(fix,record);approachKeeper(fix.game);const point=plain(fix.game.state.player);fix.game.move('up');assert.deepEqual(plain(fix.game.state.player),point,'merchant cannot be walked through');fix.game.move('left');assert.equal(fix.game.state.player.x,11);fix.game.move('up');assert.equal(fix.game.state.player.y,6,'counter wall blocks north');fix.game.move('right');walkOut(fix.game,record);
});

test('shops provide no inn service: rest retains gold, HP, MP, conditions and checkpoint',()=>{
 for(const parent of ['camp','dunmere','fen','orchard','crown','veyr'])for(const kind of ['weapon','magic']){
  const fix=setup(),record=fix.c.settlementShopRecords.find(r=>r.parent===parent&&r.kind===kind);enter(fix,record);
  for(const hero of fix.game.state.heroes){hero.hp=Math.max(1,hero.maxHp-10);hero.mp=0;hero.status='poison';}
  const before=plain({gold:fix.game.state.gold,heroes:fix.game.state.heroes,safeReturn:fix.game.state.safeReturn,inventory:fix.game.state.inventory});
  fix.game.rest();assert.equal(fix.game.state.message,null);assert.deepEqual(plain({gold:fix.game.state.gold,heroes:fix.game.state.heroes,safeReturn:fix.game.state.safeReturn,inventory:fix.game.state.inventory}),before);
 }
});

test('outdoor shelter prices and recovery remain unchanged while shop objectives explain the local counter and doorway',()=>{
 for(const [parent,price]of [['camp',0],['dunmere',20]]){
  const fix=setup(),record=fix.c.settlementShopRecords.find(r=>r.parent===parent&&r.kind==='magic');enter(fix,record);const objective=plain(fix.c.settlementShopObjective(fix.game.state));assert.equal(objective[0],'Skill Shop');assert.match(objective[1],/skillkeeper at the north counter/);assert.match(objective[1],/Walk through the south door/);assert.ok(objective[1].includes(fix.c.f[parent].name));walkOut(fix.game,record);
  for(const hero of fix.game.state.heroes){hero.hp=Math.max(1,hero.maxHp-10);hero.mp=0;hero.status='poison';}const gold=fix.game.state.gold;fix.game.rest();assert.equal(fix.game.state.gold,gold-price);assert.equal(fix.game.state.message.speaker,'A Safe Shelter');for(const hero of fix.game.state.heroes){assert.equal(hero.hp,hero.maxHp);assert.equal(hero.mp,hero.maxMp);assert.equal(hero.status,null);}
 }
});
