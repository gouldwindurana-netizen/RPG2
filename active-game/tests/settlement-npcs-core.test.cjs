'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const html = fs.readFileSync(process.env.GAME_HTML || path.join(__dirname, '..', 'The_Road_Beyond_the_Bells.html'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));

function setup(area = 'camp') {
  const c = vm.createContext({structuredClone});
  vm.runInContext(html.slice(html.indexOf('var l={schemaVersion'), html.indexOf('var De=new Set')), c);
  const saved = new Map();
  const storage = {getItem: key => saved.get(key) ?? null, setItem: (key,value) => saved.set(key,String(value))};
  const game = c.Ee({storage, seed:7321, roundDelay:0});
  game.beginAdventure({...c.R,name:'Rowan',job:'warden'}); game.skipIntro();
  game.configure({encounters:'off'}); game.state.area=area; game.state.player={x:11,y:14,facing:'right'};
  return {c,game,storage,saved,reload:()=>c.Ee({storage,seed:7321,roundDelay:0})};
}
function citizen(game,id) {return game.map().entities.find(entity=>entity.id===id);}
function roam(game,n=30) {let moved=0;for(let i=0;i<n;i++)moved+=+game.wanderStep();return moved;}

test('new adventures and older saves receive a valid optional movement preference',()=>{
  const f=setup(); assert.equal(f.game.state.settings.npcMovement,'wander'); f.game.save();
  const legacy=JSON.parse(f.saved.get(f.c.G));delete legacy.settings.npcMovement;f.saved.set(f.c.G,JSON.stringify(legacy));
  let loaded=f.reload();assert.equal(loaded.state.mode,'explore');assert.equal(loaded.state.settings.npcMovement,'wander');
  legacy.settings.npcMovement={invalid:true};f.saved.set(f.c.G,JSON.stringify(legacy));loaded=f.reload();
  assert.equal(loaded.state.mode,'explore');assert.equal(loaded.state.settings.npcMovement,'wander');
  assert.equal(loaded.state.gold,legacy.gold);assert.deepEqual(plain(loaded.state.inventory),legacy.inventory);
});

test('movement preference validates input and Still persists without teleporting existing citizens',()=>{
  const f=setup();assert.ok(roam(f.game)>0);const before=plain(citizen(f.game,'courier-keeper'));
  f.game.configure({npcMovement:'invalid',battleSpeed:3});assert.equal(f.game.state.settings.battleSpeed,1);
  f.game.configure({npcMovement:'still'});assert.equal(f.game.wanderStep(),false);
  assert.deepEqual(plain(citizen(f.game,'courier-keeper')),before);assert.equal(f.reload().state.settings.npcMovement,'still');
  f.game.configure({npcMovement:'wander'});assert.equal(f.game.state.settings.npcMovement,'wander');
});

test('town movement changes authoritative positions without spending resources steps or gameplay randomness',()=>{
  const f=setup('dunmere'), before=JSON.stringify(f.game.state), originals=JSON.stringify(f.c.he.dunmere);
  const start=plain(f.game.map().entities);assert.ok(roam(f.game,80)>0);
  assert.ok(f.game.map().entities.some(entity=>{const old=start.find(item=>item.id===entity.id);return entity.npcRoaming&&(entity.x!==old.x||entity.y!==old.y)}));
  assert.equal(JSON.stringify(f.game.state),before);assert.equal(JSON.stringify(f.c.he.dunmere),originals);
  assert.ok(f.game.map().entities.find(entity=>entity.id==='courier-witness').npcRoaming);
});

test('repeated wandering stays close to home on safe open unoccupied tiles',()=>{
  for(const area of ['camp','dunmere','fen','orchard','veyr']){
    const f=setup(area);let moved=0;
    for(let i=0;i<150;i++){
      moved+=+f.game.wanderStep();const map=f.game.map();
      for(const entity of map.entities.filter(entity=>entity.npcRoaming)){
        const home=f.c.he[area].entities.find(item=>item.id===entity.id);
        assert.ok(Math.abs(entity.x-home.x)+Math.abs(entity.y-home.y)<=2);
        assert.ok(f.c.q.includes(map.tiles[entity.y][entity.x]));assert.equal(f.c.p(area,entity.x,entity.y),true);
        assert.equal(map.entities.some(other=>other.id!==entity.id&&other.x===entity.x&&other.y===entity.y),false);
        assert.notDeepEqual([entity.x,entity.y],[f.game.state.player.x,f.game.state.player.y]);
      }
    }
    assert.ok(moved>0,`${area} has space for a short walk`);
  }
});

test('major quest keepers merchants services and exits remain fixed',()=>{
  for(const area of ['camp','dunmere','fen','orchard','crown','veyr']){
    const f=setup(area), original=plain(f.game.map().entities);roam(f.game,150);
    for(const entity of f.game.map().entities.filter(entity=>!entity.npcRoaming)){
      const old=original.find(item=>item.id===entity.id);assert.deepEqual([entity.x,entity.y],[old.x,old.y],entity.id);
    }
  }
});

test('dialogues intros battles results and queued messages pause the engine movement tick',()=>{
  for(const mutate of [s=>{s.message={speaker:'Perrin',text:'Wait.'}},s=>{s.messageQueue.push({speaker:'Bessa',text:'Wait.'})},s=>{s.mode='intro'},s=>{s.mode='battle';s.battle={}},s=>{s.reward={choices:[]}},s=>{s.mode='victory'}]){
    const f=setup();f.game.map();mutate(f.game.state);const before=plain(f.game.map());assert.equal(f.game.wanderStep(),false);assert.deepEqual(plain(f.game.map()),before);
  }
});

test('approaching a citizen stops that citizen and interaction uses the moved position',()=>{
  const f=setup();let person=citizen(f.game,'courier-keeper');
  for(let i=0;i<100&&person.x===13&&person.y===7;i++){f.game.wanderStep();person=citizen(f.game,'courier-keeper')}
  assert.notDeepEqual([person.x,person.y],[13,7]);
  const map=f.game.map(), neighbor=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>({x:person.x+dx,y:person.y+dy})).find(pos=>f.c.q.includes(map.tiles[pos.y]?.[pos.x])&&!map.entities.some(e=>e.x===pos.x&&e.y===pos.y));
  assert.ok(neighbor);f.game.state.player={...neighbor,facing:'up'};const pos=[person.x,person.y];roam(f.game,25);
  person=citizen(f.game,'courier-keeper');assert.deepEqual([person.x,person.y],pos);
  f.game.interact(person.id);assert.ok(f.game.state.message);assert.equal(f.game.state.message.speaker,'Perrin');
  const stable=plain(f.game.map());roam(f.game,10);assert.deepEqual(plain(f.game.map()),stable);
});

test('collision follows moved NPCs and an emptied original home can be traversed',()=>{
  const f=setup();let person=citizen(f.game,'courier-keeper');
  for(let i=0;i<100&&person.x===13&&person.y===7;i++){f.game.wanderStep();person=citizen(f.game,'courier-keeper')}
  const neighbor=[[1,0,'left'],[-1,0,'right'],[0,1,'up'],[0,-1,'down']].find(([dx,dy])=>f.c.q.includes(f.game.map().tiles[person.y+dy]?.[person.x+dx])&&!f.game.map().entities.some(e=>e.x===person.x+dx&&e.y===person.y+dy));
  f.game.state.player={x:person.x+neighbor[0],y:person.y+neighbor[1],facing:'up'};const before=[f.game.state.player.x,f.game.state.player.y];f.game.move(neighbor[2]);assert.deepEqual([f.game.state.player.x,f.game.state.player.y],before);
  f.game.state.player={x:13,y:8,facing:'up'};f.game.move('up');assert.deepEqual([f.game.state.player.x,f.game.state.player.y],[13,7]);
});

test('saving on a vacated NPC home reloads the hero and relocates the ephemeral citizen safely',()=>{
  const f=setup();f.game.state.player={x:13,y:7,facing:'down'};assert.equal(f.game.save(),true);
  const reloaded=f.reload();assert.equal(reloaded.state.mode,'explore');assert.deepEqual(plain(reloaded.state.player),{x:13,y:7,facing:'down'});
  const person=citizen(reloaded,'courier-keeper');assert.notDeepEqual([person.x,person.y],[13,7]);
  assert.ok(reloaded.map().entities.every(e=>e.x!==13||e.y!==7));
});

test('interiors and dangerous maps do not gain wandering citizens and returning towns reset safely',()=>{
  const f=setup();roam(f.game);for(const area of ['works','overworld',...Object.keys(f.c.he).filter(id=>id.startsWith('shop-'))]){
    f.game.state.area=area;f.game.state.player={x:3,y:14,facing:'down'};assert.equal(f.game.wanderStep(),false);assert.equal(f.game.map().entities.some(e=>e.npcRoaming),false);
  }
  f.game.state.area='camp';f.game.state.player={x:13,y:7,facing:'down'};
  const person=citizen(f.game,'courier-keeper');assert.notDeepEqual([person.x,person.y],[13,7]);
});
