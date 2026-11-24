import { test, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
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
  if(process.env.CAMP_MENU_ROUTE === '1')await page.route(gameURL, route => route.fulfill({status:200,contentType:'text/html',body:html}));
});
test.afterEach(async ({page}) => { expect(errors.get(page)||[]).toEqual([]); });
async function open(page) {
  if(!booted.has(page)) {
    await page.addInitScript(() => { const value=sessionStorage.getItem('camp-next-save');if(value){localStorage.setItem('avel-demo-v1',value);sessionStorage.removeItem('camp-next-save');} });
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
function save({name='Rowan',area='camp',encounters='off',level=50,player,npcMovement='still'}={}) {
  const game=c.Ee({storage:null,seed:7321,roundDelay:0});game.beginAdventure({...c.R,name});game.skipIntro();game.configure({encounters,battleSpeed:3,npcMovement});
  const state=game.state;state.area=area;state.player=player||freePoint(area);state.flags.briefed=true;state.campaign.stage=9;state.campaign.switches=plain(c.h);state.flags.completed=false;
  for(const hero of [...state.heroes]) {state.hx[hero.id]=c.l.xp_thresholds[level-1];state.heroes[state.heroes.indexOf(hero)]=c.be(hero.id,level,hero.equipment,state.profile,state.partyJobs[hero.id]);}
  return plain(state);
}
async function load(page,state) {
  if(!booted.has(page))await open(page);
  await page.evaluate(value=>sessionStorage.setItem('camp-next-save',JSON.stringify(value)),state);
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


const baseline = process.env.CAMP_MENU_BASELINE === '1';
const menuNames=['Items / Equipment','Skills','Jobs','Status','Area / World Map','Journal','Wayfarer Journal','System'];
const durable = state => plain({heroes:state.heroes,profile:state.profile,partyJobs:state.partyJobs,campaign:state.campaign,gold:state.gold,inventory:state.inventory,hx:state.hx,sp:state.sp,gr:state.gr,learnedSpells:state.learnedSpells,settings:state.settings,area:state.area,player:state.player,rng:state.rng,steps:state.steps});
const townPositions = page => page.evaluate(()=>window.__AVEL__.map().entities.filter(entity=>entity.npcRoaming).map(({id,x,y})=>({id,x,y})));
async function seedTitle(page,state) {
  if(!booted.has(page))await open(page);
  await page.evaluate(value=>sessionStorage.setItem('camp-next-save',JSON.stringify(value)),state);
  const response=await page.reload();expect(digest(await response.body())).toBe(gameHash);await page.waitForFunction(()=>window.__AVEL__?.map);
  await expect(page.locator('.title-screen')).toBeVisible();
}
async function newAdventure(page,name='Elara') {
  await page.locator('[data-front="new"]').click();await page.locator('#hero-name').fill(name);await page.locator('[data-front="next"]').click();
  await page.locator('[data-job="scout"]').click();await page.locator('[data-front="next"]').click();
  await page.locator('[data-creator-job-hero="Iona"]').selectOption('spellblade');await page.locator('[data-front="begin"]').click();
  await expect(page.locator('[data-intro="skip"]')).toBeVisible();await page.locator('[data-intro="skip"]').click();await settled(page);
}
async function moonCutout(page,info) {
  const moon=page.locator('[data-camp-moon]');await expect(moon).toBeVisible();
  const result=await moon.evaluate(async node=>{
    const svg=node.ownerSVGElement,mask=svg.querySelector('#camp-moon-cutout'),hole=mask&&[...mask.querySelectorAll('circle')].find(circle=>['black','#000','#000000'].includes((circle.getAttribute('fill')||'').toLowerCase()));
    if(!mask||!hole)return{mask:false};
    const maskRef=node.getAttribute('mask')||'',cx=node.cx.baseVal.value,cy=node.cy.baseVal.value,r=node.r.baseVal.value,hx=hole.cx.baseVal.value,hy=hole.cy.baseVal.value,box=svg.viewBox.baseVal;
    const isolated=`<svg xmlns="http://www.w3.org/2000/svg" width="${box.width}" height="${box.height}" viewBox="${box.x} ${box.y} ${box.width} ${box.height}"><defs>${mask.outerHTML}</defs>${node.outerHTML}</svg>`;
    const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(isolated);});
    const canvas=document.createElement('canvas');canvas.width=box.width;canvas.height=box.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const distance=Math.hypot(cx-hx,cy-hy)||1,bright={x:cx+(cx-hx)/distance*r*.85,y:cy+(cy-hy)/distance*r*.85};
    return{mask:maskRef.includes('camp-moon-cutout'),holeAlpha:ctx.getImageData(Math.round(hx),Math.round(hy),1,1).data[3],crescentAlpha:ctx.getImageData(Math.round(bright.x),Math.round(bright.y),1,1).data[3],opaqueOldDisc:[...svg.querySelectorAll('circle[fill="#273951"]')].filter(circle=>!circle.closest('mask')).length};
  });
  expect(result.mask,'moon actually references its cutout mask').toBe(true);expect(result.holeAlpha,'cutout is transparent, not a painted dark cover').toBe(0);expect(result.crescentAlpha,'crescent remains visibly painted').toBeGreaterThan(150);expect(result.opaqueOldDisc).toBe(0);
  await writeFile(info.outputPath('moon-cutout-evidence.json'),JSON.stringify(result,null,2)+'\n');await moon.screenshot({path:info.outputPath('desktop-moon-cutout.png')});
}
async function titleFromGame(page) {
  await page.locator('[data-panel="help"]').first().click();await page.locator('[data-front="title"]').click();await expect(page.locator('.title-screen')).toBeVisible();
}
async function party(page) {
  await page.locator('[data-panel="menu"]').first().click();await expect(page.locator('.party-menu-layout')).toBeVisible();
}
async function returnFromLedger(page) {
  const button=baseline?page.locator('[data-close]').first():page.locator('.ledger-return');await button.scrollIntoViewIfNeeded();await button.click();await expect(page.locator('.modal')).toBeHidden();
}
async function assertVitals(page,state) {
  for(const hero of state.heroes){const row=page.locator(`[data-status-hero="${hero.id}"]`);await expect(row).toContainText(hero.name);await expect(row).toContainText(`${hero.hp} / ${hero.maxHp}`);await expect(row).toContainText(`${hero.mp} / ${hero.maxMp}`);await expect(row.locator('.party-menu-meter.hp')).toBeVisible();await expect(row.locator('.party-menu-meter.mp')).toBeVisible();}
  for(const name of menuNames)await expect(page.locator('.party-menu-layout').getByRole('button',{name,exact:true})).toBeVisible();
  if(!baseline)await expect(page.locator('[data-ledger-context]')).toBeVisible();await noOverflow(page);
}
async function clickTile(page,point) {
  const position=await page.evaluate(point=>{const canvas=document.querySelector('#game-world canvas'),box=canvas.getBoundingClientRect(),v=window.__AVEL__.viewport();return{x:box.left+((point.x+.5)*v.tile+v.ox-v.scrollX)*v.zoom*box.width/canvas.width,y:box.top+((point.y+.5)*v.tile+v.oy-v.scrollY)*v.zoom*box.height/canvas.height};},point);
  await page.mouse.click(position.x,position.y);
}

test('fresh title offers clear new adventure actions and four-member creation',async({page},info)=>{
  await open(page);await expect(page.locator('.title-screen')).toBeVisible();await expect(page.locator('[data-front="new"]')).toBeVisible();await expect(page.locator('[data-front="continue"]')).toHaveCount(0);
  if(!baseline)await expect(page.locator('[data-camp-journey]')).toHaveCount(0);
  if(!baseline){const guide=page.locator('.camp-how-guide'),summary=guide.locator('summary');await summary.focus();await page.keyboard.press('Enter');await expect(guide).toHaveAttribute('open','');await expect(page.locator('.title-screen')).toBeVisible();await page.keyboard.press('Enter');await expect(guide).not.toHaveAttribute('open','');await page.locator('[data-front="new"]').focus();await page.keyboard.press('Tab');await expect(summary).toBeFocused();}
  if(!baseline)await moonCutout(page,info);await shot(page,info,'desktop-title-new');await page.setViewportSize({width:390,height:844});await noOverflow(page);await shot(page,info,'mobile-title-new');
  const start=page.locator('[data-front="new"]');await start.focus();await page.keyboard.press('Enter');await expect(page.locator('#hero-name')).toBeFocused();
  await page.locator('[data-front="cancel"]').first().click();await newAdventure(page,'Elara');const state=await snapshot(page);
  expect(state.profile.name).toBe('Elara');expect(state.profile.job).toBe('scout');expect(state.partyJobs.Iona).toBe('spellblade');expect(state.mode).toBe('explore');await noOverflow(page);
});

test('saved title shows the real journey and Continue resumes it without changing progress',async({page},info)=>{
  const state=save({name:'Aster Vale',area:'dunmere',level:7});state.campaign.stage=3;state.gold=733;
  await seedTitle(page,state);await expect(page.locator('[data-front="continue"]')).toBeVisible();await expect(page.locator('.title-screen')).toContainText('Aster Vale');
  if(!baseline){await expect(page.locator('[data-camp-journey]')).toBeVisible();await expect(page.locator('.camp-journey-location')).toContainText(c.f[state.area].name);await expect(page.locator('.camp-journey-chapter')).toContainText(c.m[state.campaign.stage]);}
  await shot(page,info,'desktop-title-current-journey');await page.setViewportSize({width:390,height:844});await noOverflow(page);await shot(page,info,'mobile-title-current-journey');
  const before=durable(await snapshot(page));await page.locator('[data-front="continue"]').click();await settled(page);expect(durable(await snapshot(page))).toEqual(before);
  await titleFromGame(page);await expect(page.locator('[data-front="continue"]')).toBeVisible();await page.locator('[data-front="continue"]').click();await settled(page);expect(durable(await snapshot(page))).toEqual(before);
  const complete=save({name:'Aster Vale',level:35});complete.campaign.stage=10;complete.flags.completed=true;await seedTitle(page,complete);if(!baseline){await expect(page.locator('.camp-journey-chapter')).toContainText(c.m[10]);await expect(page.locator('[data-camp-journey]')).not.toContainText('11 / 10');}await shot(page,info,'completed-journey-title');
});

test('new-adventure previews and cancellation preserve an existing journey until Begin',async({page},info)=>{
  const state=save({name:'Rowan',area:'shop-dunmere-magic',level:5});state.gold=981;state.heroes[0].hp=43;state.heroes[0].mp=2;
  await seedTitle(page,state);const before=durable(await snapshot(page));
  await page.locator('[data-front="new"]').click();await page.locator('#hero-name').fill('New Traveler');await page.locator('[data-front="next"]').click();await page.locator('[data-job="arcanist"]').click();await page.locator('[data-front="next"]').click();
  await expect(page.locator('.overwrite-note')).toBeVisible();await shot(page,info,'new-adventure-preview-preserves-journey');await page.locator('[data-front="cancel"]').first().click();expect(durable(await snapshot(page))).toEqual(before);
  await page.reload();await expect(page.locator('.title-screen')).toContainText('Rowan');await page.locator('[data-front="continue"]').click();await settled(page);expect(durable(await snapshot(page))).toEqual(before);
});

test('travel ledger resources context and eight destinations remain readable and keyboard usable',async({page},info)=>{
  const state=save({level:5});state.heroes[0].hp=43;state.heroes[0].mp=2;state.heroes[1].status='poison';state.heroes[1].mp=3;state.heroes[2].mp=4;state.heroes[3].mp=5;await load(page,state);
  const before=durable(await snapshot(page));await party(page);await assertVitals(page,state);await expect(page.locator('[data-status-hero="Tavin"]')).toContainText('Poisoned');await shot(page,info,'desktop-travel-ledger');
  const first=page.locator('.party-menu-layout').getByRole('button',{name:menuNames[0],exact:true}),second=page.locator('.party-menu-layout').getByRole('button',{name:menuNames[1],exact:true});await first.focus();await page.keyboard.press('Tab');await expect(second).toBeFocused();
  for(const name of menuNames){await close(page);await party(page);await page.locator('.party-menu-layout').getByRole('button',{name,exact:true}).click();await expect(page.locator('.modal')).toBeVisible();await noOverflow(page);}
  await close(page);await party(page);await page.setViewportSize({width:390,height:844});await assertVitals(page,state);await shot(page,info,'mobile-travel-ledger');await page.locator('[data-status-hero="Soren"]').scrollIntoViewIfNeeded();await expect(page.locator('[data-status-hero="Soren"]')).toBeInViewport();await shot(page,info,'mobile-travel-ledger-roster');
  await returnFromLedger(page);await expect(page.locator('[data-panel="menu"]').first()).toBeFocused();expect(durable(await snapshot(page))).toEqual(before);
  await party(page);await page.keyboard.press('Escape');await expect(page.locator('.modal')).toBeHidden();await expect(page.locator('[data-panel="menu"]').first()).toBeFocused();
});

test('opening the ledger pauses citizens and closing it resumes without clicking the playfield',async({page},info)=>{
  await load(page,save({level:5,player:{x:11,y:14,facing:'up'},npcMovement:'wander'}));await page.locator('#game-world canvas').focus();
  const original=await townPositions(page);expect(original.length).toBeGreaterThan(0);await expect.poll(async()=>JSON.stringify(await townPositions(page)),{timeout:15000}).not.toBe(JSON.stringify(original));
  await party(page);const paused=await townPositions(page),before=durable(await snapshot(page));await page.waitForTimeout(2800);expect(await townPositions(page)).toEqual(paused);expect(durable(await snapshot(page))).toEqual(before);await shot(page,info,'ledger-pauses-town');
  await returnFromLedger(page);await expect.poll(async()=>JSON.stringify(await townPositions(page)),{timeout:15000}).not.toBe(JSON.stringify(paused));expect((await snapshot(page)).rng).toBe(before.rng);expect((await snapshot(page)).steps).toBe(before.steps);
});

test('new menus retain shop inventory and battle flows with context-specific ledger return',async({page},info)=>{
  const record=c.settlementShopRecords.find(record=>record.parent==='camp'&&record.kind==='weapon');const state=save({area:'camp',level:5,player:{...plain(record.approach),facing:'up'}});state.gold=3000;state.heroes[0].hp=43;state.inventory.POTION=5;await load(page,state);
  await walk(page,'ArrowUp');await expect.poll(async()=>(await snapshot(page)).area).toBe(record.area);await settled(page);await party(page);if(!baseline)await expect(page.locator('[data-ledger-context]')).toContainText(/shop|armorer|counter/i);await returnFromLedger(page);
  const npc=(await page.evaluate(()=>window.__AVEL__.map())).entities.find(entity=>entity.id===record.merchantId);await clickTile(page,npc);await expect(page.locator('#dialog-title')).toHaveText('Weapon Shop');
  const beforeBuy=await snapshot(page);await page.locator('[data-buy="R01_COMMON_CHARM"]').click();const bought=await snapshot(page);expect(bought.inventory.R01_COMMON_CHARM).toBe((beforeBuy.inventory.R01_COMMON_CHARM||0)+1);expect(bought.gold).toBeLessThan(beforeBuy.gold);await page.locator('[data-command="dismiss"]').first().click();
  await party(page);await page.locator('.party-menu-layout').getByRole('button',{name:'Items / Equipment',exact:true}).click();await page.locator('[data-pack-view="supplies"]').click();await expect(page.locator('[data-recovery-preview="POTION"]')).toBeVisible();await page.locator('[data-use="POTION"]').click();expect((await snapshot(page)).heroes[0].hp).toBe(103);expect((await snapshot(page)).inventory.POTION).toBe(4);await close(page);
  await formation(page,4);const battleBefore=durable(await snapshot(page));await party(page);await assertVitals(page,await snapshot(page));await expect(page.locator('.party-menu-layout').getByRole('button',{name:'Items / Equipment',exact:true})).toBeDisabled();await expect(page.locator('.party-menu-layout').getByRole('button',{name:'Skills',exact:true})).toBeDisabled();
  if(!baseline){await expect(page.locator('[data-ledger-context]')).toContainText(/round|battle|encounter/i);await expect(page.locator('.ledger-return')).toContainText(/battle/i);}await shot(page,info,'battle-travel-ledger');await returnFromLedger(page);expect(durable(await snapshot(page))).toEqual(battleBefore);await attackRound(page);expect(['battle','victory']).toContain((await snapshot(page)).mode);
});

test('narrow short and reduced-motion menus remain standalone with session-only play',async({page},info)=>{
  const foreign=[];await page.route('**/*',route=>{if(new URL(route.request().url()).origin!==new URL(gameURL).origin){foreign.push(route.request().url());return route.abort();}return route.fallback();});
  await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:320,height:740});
  await page.addInitScript(()=>{Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new Error('Storage unavailable in bounded QA fixture');}});});
  await open(page);await noOverflow(page);await shot(page,info,'narrow-session-title');await newAdventure(page,'Elara');await expect(page.locator('#save-status')).toContainText(/session only|unavailable/i);
  await party(page);await assertVitals(page,await snapshot(page));await shot(page,info,'narrow-travel-ledger');await returnFromLedger(page);
  await titleFromGame(page);await expect(page.locator('[data-front="continue"]')).toBeVisible();if(!baseline)await expect(page.locator('[data-camp-journey]')).not.toContainText(/saved on|last saved/i);await noOverflow(page);await page.locator('[data-front="continue"]').click();await settled(page);
  await page.setViewportSize({width:844,height:390});await party(page);await noOverflow(page);const returnButton=baseline?page.locator('[data-close]').first():page.locator('.ledger-return');await returnButton.scrollIntoViewIfNeeded();await expect(returnButton).toBeInViewport();await shot(page,info,'landscape-travel-ledger');await returnButton.click();await expect(page.locator('.modal')).toBeHidden();expect(foreign).toEqual([]);
});
