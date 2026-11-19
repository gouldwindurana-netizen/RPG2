import { test, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const gameURL = process.env.GAME_URL || 'http://127.0.0.1:5173/';
const gameFile = process.env.GAME_HTML || new URL('../The_Road_Beyond_the_Bells.html', import.meta.url);
const uploadFile = new URL('../growth-baseline.html', import.meta.url);
const snapshot = page => page.evaluate(() => window.__AVEL__.snapshot());
const plain = value => JSON.parse(JSON.stringify(value));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const directions = [['up',0,-1],['down',0,1],['left',-1,0],['right',1,0]];
const keys = {up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'};
const errors = new WeakMap();
const contexts = new Map();
const bootstrapped = new WeakSet();
let finalHash;

test.beforeEach(async ({page}) => { const found=[];errors.set(page,found);page.on('pageerror',error=>found.push(error.message)); });
test.afterEach(async ({page},info) => {
  if(info.title.startsWith('uploaded baseline'))expect(errors.get(page)).toContain('gRare is not defined');
  else expect(errors.get(page)||[]).toEqual([]);
});
async function core(file=gameFile) {
  if(!contexts.has(file)) {
    const html=await readFile(file,'utf8'),c=vm.createContext({structuredClone});
    vm.runInContext(html.slice(html.indexOf('var l={schemaVersion'),html.indexOf('var De=new Set')),c,{timeout:5000});
    contexts.set(file,c);
  }
  return contexts.get(file);
}
function baseSave(c,{level=50,area='works',encounters='visible',seed=7321}={}) {
  const game=c.Ee({storage:null,seed,roundDelay:0});game.beginAdventure({...c.R,name:'Rowan'});game.skipIntro();game.configure({encounters,battleSpeed:3});
  const state=game.state;state.area=area;state.flags.briefed=true;
  for(const hero of state.heroes) {
    state.hx[hero.id]=c.l.xp_thresholds[level-1];
    state.heroes[state.heroes.indexOf(hero)]=c.be(hero.id,level,hero.equipment,state.profile,state.partyJobs[hero.id]);
  }
  state.player={x:6,y:14,facing:'up'};
  return plain(state);
}
function beside(c,area,id) {
  const map=c.he[area],entity=map.entities.find(value=>value.id===id);expect(entity,id).toBeTruthy();
  for(const[direction,dx,dy]of directions) {
    const point={x:entity.x+dx,y:entity.y+dy,facing:{up:'down',down:'up',left:'right',right:'left'}[direction]};
    if(!c.q.includes(map.tiles[point.y]?.[point.x]))continue;
    if(map.entities.some(other=>other.id!==id&&Math.abs(other.x-point.x)+Math.abs(other.y-point.y)<=1))continue;
    return point;
  }
  throw Error(`No safe interaction approach for ${id}`);
}
function walkingStep(c,area) {
  const map=c.he[area];
  for(let y=1;y<map.height-1;y++)for(let x=1;x<map.width-1;x++)for(const[direction,dx,dy]of directions) {
    if(!c.q.includes(map.tiles[y]?.[x])||!c.q.includes(map.tiles[y+dy]?.[x+dx])||c.p(area,x+dx,y+dy))continue;
    if(map.entities.some(entity=>Math.abs(entity.x-(x+dx))+Math.abs(entity.y-(y+dy))<=2))continue;
    return{point:{x,y,facing:direction},direction};
  }
  throw Error(`No dangerous free walking step in ${area}`);
}
function seedFor(c,state,action,wantKind) {
  for(let seed=1;seed<100000;seed++) {
    const game=c.Ee({storage:null,seed,roundDelay:0});game.beginAdventure({...c.R,name:'Seed search'});game.skipIntro();
    Object.assign(game.state,plain(state),{rng:seed});
    action(game);
    if(game.state.battle?.kind===wantKind)return seed;
  }
  throw Error(`No actual-engine seed for ${wantKind}`);
}
async function settled(page) {
  await page.waitForFunction(()=>{const v=window.__AVEL__?.viewport(),s=window.__AVEL__?.snapshot();return v&&s&&v.area===s.area&&!v.transitioning;});
}
async function loadSave(page,state,{url=gameURL,html}={}) {
  if(!bootstrapped.has(page)) {
    await page.addInitScript(()=>{const value=sessionStorage.getItem('growth-next-save');if(value){localStorage.setItem('avel-demo-v1',value);sessionStorage.removeItem('growth-next-save');}});
    bootstrapped.add(page);
  }
  if(html)await page.route(url,route=>route.fulfill({status:200,contentType:'text/html',body:html}));
  let response=await page.goto(url);
  await page.waitForFunction(()=>window.__AVEL__?.map);
  if(!html) {
    const bytes=await readFile(gameFile);finalHash=digest(bytes);expect(digest(await response.body())).toBe(finalHash);
  }
  await page.evaluate(value=>sessionStorage.setItem('growth-next-save',JSON.stringify(value)),state);
  await page.reload();await page.locator('[data-front="continue"]').click();await settled(page);
  expect((await snapshot(page)).mode).toBe('explore');
  expect((await snapshot(page)).rng,'declared fixture seed survives unload save').toBe(state.rng);
}
async function interact(page) {await page.locator('#game-world canvas').focus();await page.keyboard.press('e');}
async function startVisible(page,state) {
  await loadSave(page,state);await interact(page);
  await expect.poll(async()=>(await snapshot(page)).mode).toBe('battle');
  await expect.poll(async()=>page.locator('[data-command="attack"]').isVisible()).toBe(true);
  await expect(page.locator('.touch-pad')).toBeHidden();
}
async function walk(page,key) {
  const steps=(await snapshot(page)).steps;await page.locator('#game-world canvas').focus();await page.keyboard.down(key);
  try {await expect.poll(async()=>(await snapshot(page)).steps).toBeGreaterThan(steps);}
  finally {await page.keyboard.up(key);}
}
async function attackRound(page) {
  const before=await snapshot(page);
  for(const hero of before.heroes.filter(hero=>hero.hp>0&&hero.status!=='sleep')) {
    await page.locator(`[data-hero="${hero.id}"]`).click();await page.locator('[data-command="attack"]').click();
    await page.locator('[data-target]').first().click();
  }
  await page.locator('[data-command="resolve"]').click();
  await expect.poll(async()=>{const state=await snapshot(page);return state.mode!=='battle'||state.battle.phase==='planning';}).toBe(true);
}
async function win(page) {
  for(let round=0;round<12&&(await snapshot(page)).mode==='battle';round++)await attackRound(page);
  expect((await snapshot(page)).mode).toBe('victory');
  await expect(page.locator('.touch-pad')).toBeHidden();
  await expect(page.locator('[data-command="continue"]')).toBeVisible();
}
async function continueJourney(page) {
  await page.locator('[data-command="continue"]').click();await settled(page);
  expect((await snapshot(page)).mode).toBe('explore');expect((await snapshot(page)).battle).toBeNull();
}
async function noOverflow(page) {
  const sizes=await page.evaluate(()=>({width:innerWidth,body:document.body.scrollWidth,root:document.documentElement.scrollWidth}));
  expect(sizes.body).toBeLessThanOrEqual(sizes.width+1);expect(sizes.root).toBeLessThanOrEqual(sizes.width+1);
}

test('uploaded baseline reproduces the encounter freeze with a missing helper',async({page},info)=>{
  const c=await core(uploadFile),state=baseSave(c,{level:5});state.player=beside(c,'works','encounter1');
  await loadSave(page,state,{url:new URL('baseline-freeze.html',gameURL).href,html:await readFile(uploadFile,'utf8')});
  await interact(page);await expect.poll(()=>errors.get(page)||[]).toContain('gRare is not defined');
  expect((await snapshot(page)).battle).toBeNull();
  await writeFile(info.outputPath('baseline-freeze-evidence.json'),JSON.stringify({uploadSha256:digest(await readFile(uploadFile)),pageErrors:errors.get(page),battle:(await snapshot(page)).battle},null,2));
});

test('classic walking starts a rendered battle and returns to exploration after victory',async({page},info)=>{
  const c=await core(),step=walkingStep(c,'works'),state=baseSave(c,{encounters:'classic'});
  state.player=step.point;state.encounterSteps=17;state.rng=seedFor(c,state,game=>game.move(step.direction),'normal');
  await loadSave(page,state);await walk(page,keys[step.direction]);
  await expect.poll(async()=>(await snapshot(page)).mode).toBe('battle');
  expect((await snapshot(page)).battle.kind).toBe('normal');
  await expect(page.locator('[data-command="attack"]')).toBeVisible();
  await page.screenshot({path:info.outputPath('desktop-classic-encounter.png'),fullPage:true});
  await win(page);const won=await snapshot(page);expect(won.reward.lines.join(' ')).toContain('EXP');
  await continueJourney(page);const before=(await snapshot(page)).steps;
  await walk(page,keys[{up:'down',down:'up',left:'right',right:'left'}[step.direction]]);
  expect((await snapshot(page)).steps).toBeGreaterThan(before);
});

test('visible patrol battle remains playable and readable at 390px',async({page},info)=>{
  await page.setViewportSize({width:390,height:844});const c=await core(),state=baseSave(c);
  state.player=beside(c,'works','encounter1');state.rng=seedFor(c,state,game=>game.interact('encounter1'),'normal');
  await startVisible(page,state);await noOverflow(page);
  const battle=await snapshot(page);expect(battle.battle.enemies.length).toBeGreaterThan(0);
  await page.locator('[data-command="magic"]').click();await expect(page.locator('[data-spell="shield-bash"]')).toBeVisible();
  await page.screenshot({path:info.outputPath('mobile-encounter-skills-and-party.png'),fullPage:true});
  await page.keyboard.press('Escape');await win(page);await continueJourney(page);await noOverflow(page);
});

test('rare victories complete a regional set and remain repeatable for party copies after reload',async({page},info)=>{
  const c=await core(),pieces=plain(c.regionalSetPieces('R01')),state=baseSave(c);
  expect(pieces).toHaveLength(3);state.player=beside(c,'works','encounter1');
  for(const piece of pieces)delete state.inventory[piece.id];state.setAcquired=[];
  let next=state;
  for(let hunt=0;hunt<4;hunt++) {
    next.rng=seedFor(c,next,game=>game.interact('encounter1'),'rare');
    const owned=pieces.map(piece=>next.inventory[piece.id]||0),gold=next.gold;
    await loadSave(page,next);
    await interact(page);await expect.poll(async()=>(await snapshot(page)).mode).toBe('battle');
    expect((await snapshot(page)).battle.kind).toBe('rare');
    expect((await snapshot(page)).battle.regionId).toBe('R01');
    if(hunt===0)await page.screenshot({path:info.outputPath('repeatable-regional-rare.png'),fullPage:true});
    await win(page);const won=await snapshot(page),after=pieces.map(piece=>won.inventory[piece.id]||0);
    expect(after.reduce((sum,count)=>sum+count,0)).toBe(owned.reduce((sum,count)=>sum+count,0)+1);
    expect(won.gold).toBeGreaterThan(gold);expect(won.reward.lines.join(' ')).toMatch(/set|found|drop/i);
    expect(won.inventory.undefined).toBeUndefined();
    if(hunt<3)expect(after.filter(Boolean).length).toBe(hunt+1);
    await continueJourney(page);next=await snapshot(page);next.player=beside(c,'works','encounter1');
    next.settings.encounters='visible';
  }
  expect(pieces.map(piece=>next.inventory[piece.id]||0).sort()).toEqual([1,1,2]);
  await page.reload();await page.locator('[data-front="continue"]').click();await settled(page);
  const saved=await snapshot(page);expect(pieces.map(piece=>saved.inventory[piece.id]||0).sort()).toEqual([1,1,2]);
  await page.locator('[data-panel="inventory"]').last().click();
  await page.screenshot({path:info.outputPath('farmed-regional-set-inventory.png'),fullPage:true});
});

test('safe towns have no post-mission rare markers or walking encounters',async({page},info)=>{
  const c=await core();
  for(const area of Object.keys(c.he)) {
    const game=c.Ee({storage:null,seed:7321,roundDelay:0});game.beginAdventure({...c.R,name:'Map check'});game.skipIntro();game.state.area=area;
    expect(plain(game.map().entities.filter(entity=>entity.kind==='rare')),area).toEqual([]);
  }
  const state=baseSave(c,{area:'camp',encounters:'classic',level:5});state.player={x:11,y:10,facing:'right'};state.encounterSteps=17;
  await loadSave(page,state);
  for(const direction of ['ArrowRight','ArrowLeft','ArrowRight','ArrowLeft'])await walk(page,direction);
  expect((await snapshot(page)).mode).toBe('explore');expect((await snapshot(page)).battle).toBeNull();
  expect(await page.evaluate(()=>window.__AVEL__.map().entities.filter(entity=>entity.kind==='rare'))).toEqual([]);
  await noOverflow(page);await page.screenshot({path:info.outputPath('desktop-town-exploration.png'),fullPage:true});
});

test('shop comparisons and mobile recovery information remain visible after visual polish',async({page},info)=>{
  const c=await core(),state=baseSave(c,{area:'camp',level:5}),shop=c.he.camp.entities.find(entity=>entity.shopKind==='weapon');
  state.gold=3000;state.player=beside(c,'camp',shop.id);state.heroes[0].hp=43;state.heroes[0].mp=2;
  await loadSave(page,state);await interact(page);await expect(page.locator('#dialog-title')).toHaveText('Weapon Shop');
  await page.locator('[data-shop-hero="Mara"]').click();await page.locator('[data-gear-slot="weapon"]').click();
  const comparison=page.locator('[data-shop-compare="Mara"]').first();await expect(comparison).toBeVisible();
  await page.screenshot({path:info.outputPath('desktop-readable-weapon-comparison.png'),fullPage:true});
  await page.locator('[data-command="dismiss"]').click();await page.setViewportSize({width:390,height:844});
  await page.locator('[data-panel="inventory"]').last().click();await page.locator('[data-pack-view="supplies"]').click();
  await expect(page.locator('[data-inventory-target="Mara"]')).toContainText('43 /');
  await expect(page.locator('[data-recovery-preview="POTION"]')).toBeVisible();await noOverflow(page);
  await page.screenshot({path:info.outputPath('mobile-readable-recovery-preview.png'),fullPage:true});
});

test('genuine uploaded growth save keeps earned growth, practice, copies and progress',async({page},info)=>{
  const c=await core(uploadFile),state=baseSave(c,{area:'camp',level:5});
  state.gr={Mara:{hp:4,mp:2,atk:1,def:1,mag:1,acc:1,u:{lost:4,spent:2,atk:3}}};c.GR=plain(state.gr);
  state.heroes=state.heroes.map(hero=>c.be(hero.id,hero.level,hero.equipment,state.profile,state.partyJobs[hero.id]));
  state.player={x:11,y:10,facing:'right'};state.settings.encounters='off';state.gold=733;state.sp.Soren={ember:17};
  state.inventory.R02_COMMON_CHARM=4;for(const hero of state.heroes)hero.equipment.charm='R02_COMMON_CHARM';
  await loadSave(page,state);const imported=await snapshot(page);
  expect(imported.gr).toEqual(state.gr);expect(imported.hx).toEqual(state.hx);expect(imported.gold).toBe(733);expect(imported.sp.Soren.ember).toBe(17);
  expect(imported.inventory.R02_COMMON_CHARM).toBe(4);expect(imported.heroes.every(hero=>hero.equipment.charm==='R02_COMMON_CHARM')).toBe(true);
  expect(imported.heroes[0].maxHp).toBe(state.heroes[0].maxHp);expect(imported.heroes[0].attack).toBe(state.heroes[0].attack);
  await page.locator('[data-panel="inventory"]').last().click();await page.screenshot({path:info.outputPath('preserved-growth-save.png'),fullPage:true});
});
