'use strict';
// Exercise the exact formation and scenery selectors shipped in the game. Real
// Phaser image/text bounds and screenshots are checked by the browser suite.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const test = require('node:test');
const html = fs.readFileSync(process.env.GAME_HTML || path.join(__dirname,'..','The_Road_Beyond_the_Bells.html'),'utf8');
const start = html.indexOf('enemySlots(enemies){');
const end = html.indexOf('refreshBattle(e){',start);
assert.ok(start>=0 && end>start && html.slice(start,end).includes('battleTexture(info){'),'current side-view renderer is shipped');
let rendered;
const context = vm.createContext({
  M: area=>({works:'R01',tollhouse:'R02',granary:'R03',orchard:'R04',crown:'R05',heart:'R06'}[area]||'R01'),
  dungeonInfo(area,x,y){
    const root=area.split('-depth-')[0],roots=['works','tollhouse','granary','orchard','crown','heart'];
    if(!roots.includes(root)||(['orchard','crown'].includes(root)&&!area.includes('-depth-')&&x<19))return null;
    return {root,region:{works:'R01',tollhouse:'R02',granary:'R03',orchard:'R04',crown:'R05',heart:'R06'}[root],floor:Number(area.split('-depth-')[1]||1),total:{works:3,tollhouse:4,granary:5,orchard:6,crown:7,heart:8}[root]};
  },
  Ke(seed){let value=seed>>>0;return()=>((value=Math.imul(value,1664525)+1013904223>>>0)/4294967296)},
  J(ctx,color,x,y,w,h){ctx.calls.push(['rect',color,x,y,w,h])},
  Ge(scene,key,width,height,paint){const ctx={calls:[],beginPath(){},moveTo(){},lineTo(){},stroke(){},closePath(){},fill(){},fillRect(x,y,w,h){this.calls.push(['fill',x,y,w,h])},createLinearGradient(){return{addColorStop(){}}}};paint(ctx);rendered={key,width,height,calls:ctx.calls};},
});
const Scene=vm.runInContext('(class {'+html.slice(start,end)+'})',context);
const scene=new Scene();
const formation=(small,large)=>[...Array.from({length:large},(_,i)=>({id:'large'+i,size:'large',rank:'base'})),...Array.from({length:small},(_,i)=>({id:'small'+i,size:'small',rank:'base'}))];
const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
function cells(enemies){return enemies.map(enemy=>scene.enemySlots(enemies).get(enemy.id))}
function validate(enemies){
  const slots=scene.enemySlots(enemies),rects=[...slots.values()];assert.equal(slots.size,enemies.length);
  for(const cell of rects){assert.ok(cell.x>=30&&cell.y>=75);assert.ok(cell.x+cell.w<=560&&cell.y+cell.h<=515);assert.ok(cell.w>=128&&cell.h>=128);}
  for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++)assert.equal(overlaps(rects[i],rects[j]),false);
}
for(let n=1;n<=9;n++)test(`${n} small enemies use complete nonoverlapping left-hand cells`,()=>validate(formation(n,0)));
for(let n=1;n<=4;n++)test(`${n} large enemies use complete nonoverlapping left-hand cells`,()=>validate(formation(0,n)));
for(let large=1;large<=2;large++)for(let small=1;small<=6;small++)test(`${large} large plus ${small} small keeps both formations in their own space`,()=>validate(formation(small,large)));
test('one enemy is centered vertically and two/three enemies use centered vertical columns',()=>{
  const one=cells(formation(1,0))[0];assert.ok(Math.abs(one.x+one.w/2-294)<10);assert.ok(Math.abs(one.y+one.h/2-300)<10);
  for(const count of [2,3]){const group=cells(formation(count,0));assert.equal(new Set(group.map(cell=>cell.x+cell.w/2)).size,1);assert.ok(group[0].y<group.at(-1).y);}
});
test('seven and eight enemies balance occupied columns around their center',()=>{
  for(const count of [7,8]){const group=cells(formation(count,0)),center=group.reduce((sum,cell)=>sum+cell.x+cell.w/2,0)/count;assert.ok(Math.abs(center-296)<1);}
});
test('defeated enemies retain holes without moving the surviving enemies',()=>{
  const group=formation(6,2),before=JSON.stringify([...scene.enemySlots(group)]);group[0].hp=0;group[4].hp=0;assert.equal(JSON.stringify([...scene.enemySlots(group)]),before);
});
test('all four heroes have persistent ascending right-hand cells and fit 32x40 source art',()=>{
  const heroes=['Mara','Tavin','Iona','Soren'].map(id=>({id})),slots=[...scene.heroSlots(heroes).values()];
  assert.equal(slots.length,4);
  slots.forEach((cell,index)=>{assert.ok(cell.x>=700&&cell.x+cell.w<=950);assert.ok(cell.y>=75&&cell.y+cell.h<=515);assert.ok(cell.baseY-cell.y>=40*1.5);if(index)assert.ok(slots[index-1].y+slots[index-1].h<=cell.y);});
  const centers=slots.map(cell=>cell.x+cell.w/2);assert.ok(Math.max(...centers)-Math.min(...centers)<=30);
  heroes[0].hp=0;assert.equal(JSON.stringify([...scene.heroSlots(heroes).values()]),JSON.stringify(slots));
});
function state(area,region='R01',x=20,y=10){return{area,player:{x,y},battle:{regionId:region}}}
function backdrop(s,tile='g'){scene.readMap=()=>({tiles:Array.from({length:40},()=>tile.repeat(70))});return scene.battleBackdrop(s)}
for(const [region,terrain] of [['R01','grassland'],['R03','marsh'],['R04','orchard-field'],['R05','highland'],['R06','pale-field']])test(`${region} outdoors selects an exterior ${terrain} scene`,()=>{const info=backdrop(state('overworld',region));assert.equal(info.environment,'exterior');assert.equal(info.terrain,terrain);assert.equal(info.sourceArea,'overworld');assert.equal(info.floor,0)});
test('forest terrain and shoreline have distinct exterior scenes',()=>{
  assert.equal(backdrop(state('overworld'),'f').terrain,'forest');
  const rows=Array.from({length:40},()=>Array(70).fill('g'));rows[10][19]='w';rows[9][20]='w';scene.readMap=()=>({tiles:rows.map(row=>row.join(''))});assert.equal(scene.battleBackdrop(state('overworld')).terrain,'shore');
});
for(const root of ['works','tollhouse','granary','orchard','crown','heart'])test(`${root} interiors select original dungeon scenery and a deeper variant`,()=>{
  const upper=backdrop(state(root)),total={works:3,tollhouse:4,granary:5,orchard:6,crown:7,heart:8}[root],deep=backdrop(state(root+'-depth-'+total));
  assert.equal(upper.environment,'interior');assert.equal(upper.terrain,root);assert.equal(upper.floor,1);assert.equal(deep.floor,total);assert.notEqual(upper.texture,deep.texture);assert.ok(deep.texture.endsWith('-deep'));
});
test('safe orchard/crown courts stay exterior when coordinates are supplied',()=>{for(const root of ['orchard','crown'])assert.equal(backdrop(state(root,'R04',4,6)).environment,'exterior')});
test('each terrain and dungeon backdrop draws a standalone full-field original texture',()=>{
  const infos=[...['R01','R03','R04','R05','R06'].map(region=>backdrop(state('overworld',region))),backdrop(state('overworld'),'f'),...['works','tollhouse','granary','orchard','crown','heart'].map(root=>backdrop(state(root)))];
  const keys=new Set();for(const info of infos){const key=scene.battleTexture(info);assert.equal(rendered.key,key);assert.equal(rendered.width,960);assert.equal(rendered.height,576);assert.ok(rendered.calls.length>100);keys.add(key)}assert.equal(keys.size,infos.length);
});
test('rear scenery is proportionally compressed so every battle row stands below the floor horizon',()=>{
  for(const info of [backdrop(state('overworld')),backdrop(state('works')),backdrop(state('heart-depth-8'))]){
    assert.equal(info.groundY,124);
    scene.battleTexture(info);
    assert.ok(rendered.calls.some(draw=>draw[0]==='rect'&&draw[3]===124&&draw[4]===960&&draw[5]===452),'floor fills the field from its raised horizon');
    for(const cell of scene.heroSlots(['Mara','Tavin','Iona','Soren'].map(id=>({id}))).values())assert.ok(cell.baseY>info.groundY);
    for(let count=1;count<=9;count++)for(const cell of scene.enemySlots(formation(count,0)).values())assert.ok((cell.baseY??cell.y+cell.h-58)>info.groundY);
  }
});
test('shipped renderer switches backdrop each battle refresh and clears it for exploration',()=>{
  assert.ok(html.includes('refreshBattle(e){let t=e.battle;this.battleSceneInfo=this.battleBackdrop(e)'));
  assert.ok(html.includes('else{this.battleSceneInfo=null;let t=Qe(this,this.readMap(),e.area);'));
  assert.ok(html.includes('explorationEntitiesVisible:[...this.sprites.values(),...this.scenery].some(object=>object.visible)'));
});

// Exploration floors also inherit the correct dungeon materials. They must
// retain their own cache keys and supplied geometry rather than reuse a root
// floor's canvas, which would draw the wrong doors and corridors.
const explorationStart=html.indexOf('var Ze={');
const explorationEnd=html.indexOf('function $e(',explorationStart);
assert.ok(explorationStart>=0&&explorationEnd>explorationStart);
vm.runInContext(html.slice(explorationStart,explorationEnd),context);
function exploration(area,tiles=['#####','#gfw#','#####']){
  const ctx={calls:[],drawImage(){}};
  const renderer={textures:{
    exists(){return false},
    remove(){},
    get(){return{getSourceImage(){return{}}}},
    createCanvas(){return{getContext(){return ctx},refresh(){}}},
  }};
  const result=context.Qe(renderer,{width:tiles[0].length,height:tiles.length,tiles},area);
  return{result,rectangles:ctx.calls};
}
for(const root of ['works','tollhouse','granary','orchard','crown','heart'])test(`${root} deeper exploration keeps its regional palette and indoor wall material`,()=>{
  const total={works:3,tollhouse:4,granary:5,orchard:6,crown:7,heart:8}[root];
  const {result,rectangles}=exploration(root+'-depth-'+total);
  assert.equal(result.key,`world-${root}-depth-${total}`);
  assert.ok(rectangles.some(draw=>draw[1]===context.Ze[root][0]),'regional floor palette is used');
  assert.ok(rectangles.some(draw=>draw[1]==='#465b5e'),'interior wall material is used');
  assert.ok(rectangles.some(draw=>draw[1]==='#69776d'),'interior stone floor material is used');
});
test('separate floor IDs keep their own texture identity and actual map geometry',()=>{
  const first=exploration('heart-depth-2',['####','#gf#','####']);
  const second=exploration('heart-depth-8',['######','#gffw#','######']);
  assert.notEqual(first.result.key,second.result.key);
  assert.notEqual(first.result.ox,second.result.ox);
  assert.notDeepEqual(first.rectangles,second.rectangles);
});
test('orchard and crown base maps retain their exterior service-court material',()=>{
  for(const root of ['orchard','crown']){
    const {rectangles}=exploration(root);
    assert.ok(rectangles.some(draw=>draw[1]===context.Ze[root][0]));
    assert.ok(rectangles.some(draw=>draw[1]==='#6a7c74'),'base court keeps exterior walls');
  }
});
