import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const gameURL = process.env.GAME_URL || 'http://127.0.0.1:5173/';
const gameFile = process.env.GAME_HTML || new URL('../The_Road_Beyond_the_Bells.html', import.meta.url);
const html = await readFile(gameFile, 'utf8');
const digest = value => createHash('sha256').update(value).digest('hex');
const gameHash = digest(html);
const c = vm.createContext({ structuredClone });
vm.runInContext(html.slice(html.indexOf('var l={schemaVersion'), html.indexOf('var De=new Set')), c, { timeout: 5000 });
const plain = value => JSON.parse(JSON.stringify(value));
const snapshot = page => page.evaluate(() => window.__AVEL__.snapshot());
const dirs = [['up',0,-1],['down',0,1],['left',-1,0],['right',1,0]];
const keys = { up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight' };
const booted = new WeakSet(), errors = new WeakMap();

test.beforeEach(async ({page}) => {
  const list=[];errors.set(page,list);page.on('pageerror', error => list.push(error.message));
  if(process.env.VISUAL_ROUTE === '1')await page.route(gameURL, route => route.fulfill({status:200,contentType:'text/html',body:html}));
});
test.afterEach(async ({page}) => { expect(errors.get(page)||[]).toEqual([]); });
async function open(page) {
  if(!booted.has(page)) {
    await page.addInitScript(() => { const value=sessionStorage.getItem('visual-next-save');if(value){localStorage.setItem('avel-demo-v1',value);sessionStorage.removeItem('visual-next-save');} });
    booted.add(page);
  }
  const response=await page.goto(gameURL);expect(digest(await response.body()),'tested page uses recorded build').toBe(gameHash);
  await page.waitForFunction(() => window.__AVEL__?.map);
}
async function settled(page) { await page.waitForFunction(() => {const v=window.__AVEL__?.viewport(),s=window.__AVEL__?.snapshot();return v&&s&&v.area===s.area&&!v.transitioning;}); }
function freePoint(area,wanted={x:11,y:10}) {
  const map=c.he[area],available=[];
  for(let y=1;y<map.height-1;y++)for(let x=1;x<map.width-1;x++)
    if(c.q.includes(map.tiles[y]?.[x])&&!map.entities.some(e=>e.x===x&&e.y===y))available.push({x,y,facing:'right'});
  return available.sort((a,b)=>Math.abs(a.x-wanted.x)+Math.abs(a.y-wanted.y)-Math.abs(b.x-wanted.x)-Math.abs(b.y-wanted.y))[0];
}
function save({area='camp',encounters='off',level=50,player}={}) {
  const game=c.Ee({storage:null,seed:7321,roundDelay:0});game.beginAdventure({...c.R,name:'Rowan'});game.skipIntro();game.configure({encounters,battleSpeed:3});
  const state=game.state;state.area=area;state.player=player||freePoint(area);state.flags.briefed=true;state.campaign.stage=9;state.campaign.switches=plain(c.h);state.flags.completed=false;
  for(const hero of [...state.heroes]) {state.hx[hero.id]=c.l.xp_thresholds[level-1];state.heroes[state.heroes.indexOf(hero)]=c.be(hero.id,level,hero.equipment,state.profile,state.partyJobs[hero.id]);}
  return plain(state);
}
async function load(page,state) {
  if(!booted.has(page))await open(page);
  await page.evaluate(value=>sessionStorage.setItem('visual-next-save',JSON.stringify(value)),state);
  const response=await page.reload();expect(digest(await response.body())).toBe(gameHash);
  await page.locator('[data-front="continue"]').click();await settled(page);expect((await snapshot(page)).area).toBe(state.area);
}
async function noOverflow(page) {
  const v=await page.evaluate(()=>({width:innerWidth,body:document.body.scrollWidth,root:document.documentElement.scrollWidth}));
  expect(v.body).toBeLessThanOrEqual(v.width+1);expect(v.root).toBeLessThanOrEqual(v.width+1);
}
async function shot(page,info,name) {await page.screenshot({path:info.outputPath(name+'.png'),fullPage:true});}
async function close(page) {for(let i=0;i<3&&await page.locator('.modal').isVisible();i++){await page.keyboard.press('Escape');await page.waitForTimeout(60);}await expect(page.locator('.modal')).toBeHidden();}
function beside(area,id) {
  const map=c.he[area],entity=map.entities.find(e=>e.id===id);expect(entity,id).toBeTruthy();
  for(const [direction,dx,dy]of dirs) {
    const point={x:entity.x+dx,y:entity.y+dy,facing:{up:'down',down:'up',left:'right',right:'left'}[direction]};
    if(!c.q.includes(map.tiles[point.y]?.[point.x]))continue;
    if(map.entities.some(other=>other.id!==id&&Math.abs(other.x-point.x)+Math.abs(other.y-point.y)<=1))continue;
    return point;
  }
  throw Error('No unique approach '+id);
}
function walkStep(area,region) {
  const map=c.he[area];
  for(let y=1;y<map.height-1;y++)for(let x=1;x<map.width-1;x++)for(const[direction,dx,dy]of dirs) {
    if(!c.q.includes(map.tiles[y]?.[x])||!c.q.includes(map.tiles[y+dy]?.[x+dx])||c.p(area,x+dx,y+dy)||region&&c.M(area,x+dx,y+dy)!==region)continue;
    if(map.entities.some(e=>Math.abs(e.x-(x+dx))+Math.abs(e.y-(y+dy))<=3))continue;
    return{point:{x,y,facing:direction},direction};
  }
  throw Error('No battle step '+area);
}
function seedFor(state,action,wanted) {
  for(let seed=1;seed<150000;seed++) {
    const game=c.Ee({storage:null,seed,roundDelay:0});game.beginAdventure({...c.R,name:'Seed fixture'});game.skipIntro();Object.assign(game.state,plain(state),{rng:seed});
    action(game);const battle=game.state.battle;
    if(battle&&battle.kind==='normal'&&battle.enemies.length===wanted)return seed;
  }
  throw Error('No seeded '+wanted+' formation');
}
async function walk(page,key) {
  const before=(await snapshot(page)).steps;await page.locator('#game-world canvas').focus();await page.keyboard.down(key);
  try {await expect.poll(async()=>(await snapshot(page)).steps).toBeGreaterThan(before);}finally{await page.keyboard.up(key);}
}
async function formation(page,count,area='works-depth-3',region='R01') {
  const step=walkStep(area,region),state=save({area,encounters:'classic',player:step.point});state.encounterSteps=17;
  state.rng=seedFor(state,game=>game.move(step.direction),count);await load(page,state);await walk(page,keys[step.direction]);
  await expect.poll(async()=>(await snapshot(page)).mode).toBe('battle');const battle=(await snapshot(page)).battle;expect(battle.enemies).toHaveLength(count);
  await expect(page.locator('[data-command="attack"]')).toBeVisible();await geometry(page,battle);return battle;
}
async function geometry(page,battle) {
  await page.waitForFunction(n=>window.__AVEL__.viewport().actors?.length===n,battle.enemies.length+4);
  const view=await page.evaluate(()=>window.__AVEL__.viewport());expect(view.battlefield.explorationEntitiesVisible).toBe(false);
  for(const actor of view.actors)for(const key of ['sprite','label','bar',...['readout','shadow'].filter(key=>actor[key])]) {
    const r=actor[key];expect(r,actor.id+key).toBeTruthy();
    expect(r.x,actor.id+key+'left').toBeGreaterThanOrEqual(actor.cell.x-1);
    expect(r.y,actor.id+key+'top').toBeGreaterThanOrEqual(actor.cell.y-1);
    expect(r.x+r.w,actor.id+key+'right').toBeLessThanOrEqual(actor.cell.x+actor.cell.w+1);
    expect(r.y+r.h,actor.id+key+'bottom').toBeLessThanOrEqual(actor.cell.y+actor.cell.h+1);
  }
  await expect(page.locator('.touch-pad')).toBeHidden();
  for(const hero of (await snapshot(page)).heroes)await expect(page.locator(`[data-hero="${hero.id}"]`)).toContainText(String(hero.mp));
  await noOverflow(page);
}
async function attackRound(page) {
  for(const hero of (await snapshot(page)).heroes.filter(h=>h.hp>0&&h.status!=='sleep')) {
    await page.locator(`[data-hero="${hero.id}"]`).click();await page.locator('[data-command="attack"]').click();await page.locator('[data-target]').first().click();
  }
  await page.locator('[data-command="resolve"]').click();await expect.poll(async()=>{const s=await snapshot(page);return s.mode!=='battle'||s.battle.phase==='planning';}).toBe(true);
}

test('title and four-member creation keep clear actions and usable mobile choices',async({page},info)=>{
  await open(page);await expect(page.locator('[data-front="new"]')).toBeVisible();await shot(page,info,'desktop-title');
  await page.setViewportSize({width:390,height:844});await noOverflow(page);await shot(page,info,'mobile-title');await page.setViewportSize({width:1280,height:1000});
  await page.locator('[data-front="new"]').click();await page.locator('#hero-name').fill('Rowan');await page.locator('[data-front="next"]').click();
  await page.locator('[data-job="scout"]').click();await shot(page,info,'desktop-job-selection');await page.locator('[data-front="next"]').click();
  await page.setViewportSize({width:390,height:844});await page.locator('[data-creator-job-hero="Iona"]').selectOption('spellblade');await noOverflow(page);await shot(page,info,'mobile-party-creation');
  await page.locator('[data-front="begin"]').click();await expect(page.locator('[data-intro="skip"]')).toBeVisible();await page.locator('[data-intro="skip"]').click();await settled(page);
  expect((await snapshot(page)).profile.name).toBe('Rowan');expect((await snapshot(page)).partyJobs.Iona).toBe('spellblade');await noOverflow(page);
});

test('town world and dungeon art preserve exploration input and modal boundaries',async({page},info)=>{
  await load(page,save({level:5}));await shot(page,info,'desktop-town');
  await page.locator('[data-panel="inventory"]').last().click();const before=(await snapshot(page)).player;await page.keyboard.down('ArrowRight');await page.waitForTimeout(250);await page.keyboard.up('ArrowRight');expect((await snapshot(page)).player).toEqual(before);await close(page);
  await load(page,save({area:'overworld',player:freePoint('overworld',{x:8,y:31})}));await shot(page,info,'desktop-overworld');
  await load(page,save({area:'heart-depth-7',player:freePoint('heart-depth-7',{x:4,y:18})}));await shot(page,info,'desktop-deep-dungeon');
  await page.setViewportSize({width:390,height:844});await noOverflow(page);await shot(page,info,'mobile-deep-dungeon');
  await page.locator('[data-panel="worldmap"]').first().click();await expect(page.locator('.modal')).toBeVisible();await noOverflow(page);await shot(page,info,'mobile-area-map');await close(page);
});

test('one and four foe battles keep actors resources and command resolution readable',async({page},info)=>{
  await formation(page,1);await shot(page,info,'desktop-one-foe');
  for(let i=0;i<8&&(await snapshot(page)).mode==='battle';i++)await attackRound(page);
  expect((await snapshot(page)).mode).toBe('victory');await expect(page.locator('.touch-pad')).toBeHidden();await page.locator('[data-command="continue"]').click();await settled(page);
  await formation(page,4,'orchard','R04');await shot(page,info,'desktop-four-foes');await attackRound(page);expect(['battle','victory']).toContain((await snapshot(page)).mode);
});

test('eight and nine foe mobile battles preserve target scrolling and cell geometry',async({page},info)=>{
  await page.setViewportSize({width:390,height:844});let battle=await formation(page,8,'works-depth-3','R01');await shot(page,info,'mobile-eight-foes');
  await page.locator('[data-command="attack"]').click();const last=page.locator('[data-target]').last();await last.scrollIntoViewIfNeeded();await expect(last).toBeVisible();await last.click();expect((await snapshot(page)).battle.plans.Mara.target).toBe(battle.enemies.at(-1).id);
  battle=await formation(page,9,'heart-depth-8','R06');await shot(page,info,'mobile-nine-foes');await geometry(page,battle);
});

test('weapon shops keep comparisons quantity buying and a reachable dismissal',async({page},info)=>{
  const shop=c.he.camp.entities.find(e=>e.shopKind==='weapon'),state=save({level:5,player:beside('camp',shop.id)});state.gold=3000;await load(page,state);
  await page.locator('#game-world canvas').focus();await page.keyboard.press('e');await expect(page.locator('#dialog-title')).toHaveText('Weapon Shop');
  await page.locator('[data-shop-hero="Mara"]').click();await page.locator('[data-gear-slot="charm"]').click();await expect(page.locator('[data-shop-compare="Mara"]').first()).toBeVisible();await shot(page,info,'desktop-weapon-shop');
  await page.setViewportSize({width:390,height:844});await noOverflow(page);await shot(page,info,'mobile-weapon-shop');
  const item='R01_COMMON_CHARM',old=(await snapshot(page)).inventory[item]||0;await page.locator(`[data-buy="${item}"]`).click();expect((await snapshot(page)).inventory[item]).toBe(old+1);
  const dismiss=page.locator('[data-command="dismiss"]').first();await dismiss.scrollIntoViewIfNeeded();await dismiss.click();expect((await snapshot(page)).message).toBeNull();
  const skillShop=c.he.camp.entities.find(e=>e.shopKind==='magic');await load(page,save({level:5,player:beside('camp',skillShop.id)}));await page.locator('#game-world canvas').focus();await page.keyboard.press('e');await expect(page.locator('#dialog-title')).toHaveText('Skill Shop');await noOverflow(page);await shot(page,info,'mobile-skill-shop');await page.locator('[data-command="dismiss"]').first().click();
});

test('inventory jobs and journal show resources collection and preserve saves',async({page},info)=>{
  await page.setViewportSize({width:390,height:844});const state=save({level:5});state.heroes[0].hp=43;state.heroes[0].mp=2;state.inventory.POTION=5;await load(page,state);
  await page.locator('[data-panel="inventory"]').last().click();await page.locator('[data-pack-view="supplies"]').click();await expect(page.locator('[data-inventory-target="Mara"]')).toContainText('43 /');await expect(page.locator('[data-recovery-preview="POTION"]')).toBeVisible();await noOverflow(page);await shot(page,info,'mobile-inventory-recovery');
  await page.locator('[data-use="POTION"]').click();const healed=await snapshot(page);expect(healed.heroes[0].hp).toBe(103);expect(healed.inventory.POTION).toBe(4);await close(page);
  await page.keyboard.press('Escape');await page.locator('[data-panel="jobs"]').click();await expect(page.locator('[data-apply-job]')).toBeVisible();await noOverflow(page);await shot(page,info,'mobile-jobs-preview');await close(page);
  await page.keyboard.press('Escape');await page.locator('[data-panel="guide"]').last().click();await expect(page.locator('[data-regional-rare="R01"]')).toContainText('pieces');await noOverflow(page);await shot(page,info,'mobile-field-journal');await close(page);
  await page.reload();await page.locator('[data-front="continue"]').click();await settled(page);expect((await snapshot(page)).heroes[0].hp).toBe(103);expect((await snapshot(page)).heroes[0].mp).toBe(2);
});

test('reduced motion and short landscape keep essential controls reachable',async({page},info)=>{
  const foreign=[];await page.route('**/*',route=>{if(new URL(route.request().url()).origin!==new URL(gameURL).origin){foreign.push(route.request().url());return route.abort();}return route.fallback();});
  await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:844,height:390});await load(page,save({level:5}));
  expect(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);await noOverflow(page);await shot(page,info,'landscape-exploration');
  await page.locator('[data-panel="inventory"]').last().click();await noOverflow(page);const closeButton=page.locator('[data-close]').first();await closeButton.scrollIntoViewIfNeeded();await expect(closeButton).toBeVisible();await shot(page,info,'landscape-inventory');await closeButton.click();await expect(page.locator('.modal')).toBeHidden();
  await formation(page,4);await noOverflow(page);await page.locator('[data-command="attack"]').scrollIntoViewIfNeeded();await expect(page.locator('[data-command="attack"]')).toBeVisible();await shot(page,info,'landscape-battle');expect(foreign,'standalone game requests no foreign assets').toEqual([]);
});
