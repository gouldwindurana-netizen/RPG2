'use strict';
// Structural layout checks use the renderer method shipped in the HTML.
// Browser checks separately verify Phaser's actual text and image bounds.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const test = require('node:test');
const html = fs.readFileSync(process.env.GAME_HTML || path.join(__dirname, '..', 'The_Road_Beyond_the_Bells.html'), 'utf8');
const start = html.indexOf('enemySlots(enemies){');
const end = html.indexOf('refreshBattle(e){', start);
assert.ok(start >= 0 && end > start, 'shipped formation layout method exists');
const Scene = vm.runInNewContext('(class {' + html.slice(start, end) + '})');
const scene = new Scene();
const intersects = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
function formation(small, large) {
  return [...Array.from({length:large}, (_,i)=>({id:'large-'+i, size:'large', rank:'base'})),
    ...Array.from({length:small}, (_,i)=>({id:'small-'+i, size:'small', rank:'base'}))];
}
function validate(enemies) {
  const slots = scene.enemySlots(enemies);
  assert.equal(slots.size, enemies.length, 'every enemy has a unique slot');
  const cells = enemies.map(enemy => slots.get(enemy.id));
  for (const cell of cells) {
    assert.ok(cell.x >= 30 && cell.y >= 75, 'slot begins inside the enemy battlefield');
    assert.ok(cell.x + cell.w <= 560 && cell.y + cell.h <= 515, 'slot stays left of the heroes and above the HUD');
    assert.ok(cell.w >= 128 && cell.h >= 128, 'slot reserves readable sprite and label space');
    assert.ok(Number.isFinite(cell.x + cell.y + cell.w + cell.h));
  }
  for(let i=0;i<cells.length;i++)for(let j=i+1;j<cells.length;j++)assert.equal(intersects(cells[i],cells[j]),false, 'enemy slots never overlap');
}
for (let count=1;count<=9;count++) test(`${count} small enemies have separate readable cells`,()=>validate(formation(count,0)));
for (let count=1;count<=4;count++) test(`${count} large enemies have separate readable cells`,()=>validate(formation(0,count)));
for (let large=1;large<=2;large++)for(let small=1;small<=6;small++)test(`${large} large and ${small} small enemies fit the mixed layout`,()=>validate(formation(small,large)));
test('an untagged boss retains the large-enemy layout',()=>validate([{id:'bailiff',rank:'boss'},{id:'choir-1',rank:'boss'},{id:'choir-2',rank:'boss'}]));
test('defeated enemies keep their cells so formations do not shuffle mid-round',()=>{
  const enemies=formation(6,2), before=JSON.stringify([...scene.enemySlots(enemies)]);
  enemies[1].hp=0;enemies[5].hp=0;
  assert.equal(JSON.stringify([...scene.enemySlots(enemies)]),before);
});
const textureStart=html.indexOf('travelTexture(e,t){');
const textureEnd=html.indexOf('refreshWorld(e){',textureStart);
assert.ok(textureStart>=0&&textureEnd>textureStart,'shipped world texture selector exists');
const Selectors=vm.runInNewContext('(class {'+html.slice(textureStart,textureEnd)+'})',{Xe:()=> 'original-texture'});
const selector=new Selectors();selector.crossing=()=>null;
for(const kind of ['weapon','items','magic'])test(`${kind} shop has a distinct original stall texture`,()=>assert.equal(selector.travelTexture({kind:'npc',shopKind:kind},'camp'),'service-'+kind));
test('ordinary citizens keep their original appearance',()=>assert.equal(selector.travelTexture({kind:'npc',name:'Bessa',sprite:'bessa'},'camp'),'original-texture'));
