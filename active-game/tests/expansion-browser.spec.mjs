import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const file = process.env.GAME_FILE || 'The_Road_Beyond_the_Bells.html';
const url = process.env.GAME_URL || `http://127.0.0.1:5190/${file}`;
const snapshot = page => page.evaluate(() => window.__AVEL__.snapshot());
const map = page => page.evaluate(() => window.__AVEL__.map());
const heroes = ['Mara', 'Tavin', 'Iona', 'Soren'];
const directions = [['up',0,-1],['down',0,1],['left',-1,0],['right',1,0]];
const keyFor = { up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight' };

async function settled(page) {
  await page.waitForFunction(() => {
    const view = window.__AVEL__?.viewport();
    return view && view.area === window.__AVEL__.snapshot().area && !view.transitioning;
  });
}
async function dismiss(page) {
  for(let i=0;i<40 && (await snapshot(page)).message;i++) await page.locator('[data-command="dismiss"]').click();
  expect((await snapshot(page)).message).toBeNull();
}
async function newGame(page,{job='warden',targetURL=url}={}) {
  await page.addInitScript(() => {
    const next = sessionStorage.getItem('expansion-next-save');
    if(next){localStorage.setItem('avel-demo-v1',next);sessionStorage.removeItem('expansion-next-save');}
  });
  await page.goto(targetURL);
  await page.waitForFunction(()=>window.__AVEL__?.map);
  await page.locator('[data-front="new"]').click();
  await page.locator('#hero-name').fill('Fieldwalker');
  await page.locator('[data-front="next"]').click();
  await page.locator(`[data-job="${job}"]`).click();
  await page.locator('[data-front="next"]').click();
  await page.locator('[data-front="begin"]').click();
  await page.locator('[data-intro="skip"]').click();
  await settled(page);
  await page.locator('[data-panel="help"]').last().click();
  await page.locator('[data-speed="3"]').click();
  await page.locator('[data-encounters="off"]').click();
  await page.locator('[data-close]').click();
}
// Focused save fixtures isolate shops, group layouts and later story conditions.
// They do not claim a complete campaign playthrough or alter damage during combat.
async function fixture(page,change) {
  const state = await page.evaluate(()=>JSON.parse(localStorage.getItem('avel-demo-v1')));
  change(state);
  await page.evaluate(state=>sessionStorage.setItem('expansion-next-save',JSON.stringify(state)),state);
  await page.reload();
  await page.locator('[data-front="continue"]').click();
  await settled(page);
}
function route(current,start,goals,exitId) {
  const key=p=>`${p.x},${p.y}`,targets=new Set(goals.map(key)),queue=[{...start,path:[]}],seen=new Set([key(start)]);
  while(queue.length){const point=queue.shift();if(targets.has(key(point)))return point.path;
    for(const[direction,dx,dy]of directions){const next={x:point.x+dx,y:point.y+dy};
      if(seen.has(key(next))||!'gdsfb'.includes(current.tiles[next.y]?.[next.x]||'?'))continue;
      if(current.entities.some(e=>e.x===next.x&&e.y===next.y&&e.id!==exitId))continue;
      seen.add(key(next));queue.push({...next,path:[...point.path,direction]});}}
  throw new Error(`Unreachable ${current.area}:${goals.map(key).join('|')}`);
}
async function step(page,direction) {
  await settled(page);const before=await snapshot(page);
  await page.locator('#game-world canvas').focus();await page.keyboard.down(keyFor[direction]);
  try{await page.waitForFunction(before=>{const s=window.__AVEL__.snapshot();return s.mode==='battle'||!!s.message||s.area!==before.area||s.player.x!==before.player.x||s.player.y!==before.player.y;},before,{timeout:3000});}
  finally{await page.keyboard.up(keyFor[direction]);}
  await settled(page);
}
async function interact(page,id) {
  await dismiss(page);const current=await map(page),state=await snapshot(page),entity=current.entities.find(e=>e.id===id);
  expect(entity,`${state.area}/${id}`).toBeTruthy();
  const path=route(current,state.player,directions.map(([,dx,dy])=>({x:entity.x+dx,y:entity.y+dy})));
  for(const direction of path)await step(page,direction);
  await page.locator('#game-world canvas').focus();await page.keyboard.press('e');
  await expect.poll(async()=>!!(await snapshot(page)).message||(await snapshot(page)).mode==='battle').toBe(true);
}
async function exit(page,id,destination) {
  await dismiss(page);const current=await map(page),state=await snapshot(page),entity=current.entities.find(e=>e.id===id);
  expect(entity).toBeTruthy();const path=route(current,state.player,[entity],id);
  for(const direction of path)await step(page,direction);
  await expect.poll(async()=>(await snapshot(page)).area).toBe(destination);await settled(page);
}
async function shopFixture(page,kind,{job='arcanist'}={}) {
  await newGame(page,{job});
  await fixture(page,state=>{state.gold=10000;state.area='dunmere';state.player={x:kind==='weapon'?7:kind==='magic'?24:10,y:kind==='items'?11:7,facing:kind==='items'?'down':'up'};});
  await interact(page,kind==='items'?'shop-R02':`${kind}-dunmere`);
  await expect(page.locator('#dialog-title')).toHaveText(kind==='weapon'?'Weapon Shop':kind==='items'?'Item Shop':'Magic Shop');
}
function xorshift(seed){let x=seed;x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296;}
async function formationFixture(page,formation) {
  const html=await readFile(new URL(`../${file}`, import.meta.url),'utf8'),start=html.indexOf('var l={schemaVersion'),end=html.indexOf('var De=new Set',start),context=vm.createContext({structuredClone});
  vm.runInContext(html.slice(start,end),context,{timeout:3000});
  await fixture(page,state=>{
    state.area='works';state.player={x:5,y:11,facing:'left'};state.flags.briefed=true;state.flags.bossDefeated=true;
    state.campaign.stage=2;state.flags.completed=false;state.campaign.switches=[...new Set([...state.campaign.switches,'orren_rescued','reedbank_moved'])];
    state.cleared=[...new Set([...state.cleared,...Array.from({length:6},(_,i)=>`encounter${i+1}`),'bailiff'])];
    state.settings.encounters='classic';state.settings.battleSpeed=3;state.encounterSteps=17;
    const rows=Array.from(context.encounterEligible('R01',state)),total=rows.reduce((sum,row)=>sum+row.weight,0);let low=0,high=0;
    for(const row of rows){high=low+row.weight;if(row.id.endsWith(formation))break;low=high;}
    if(high===low)throw new Error(`No ${formation}`);
    let seed=1;while(seed<1000000&&!(xorshift(seed)*total>=low&&xorshift(seed)*total<high))seed++;
    if(seed===1000000)throw new Error('No deterministic seed');state.rng=seed;
  });
  await step(page,'left');await expect.poll(async()=>(await snapshot(page)).mode).toBe('battle');
  const battle=(await snapshot(page)).battle;expect(battle.formationId).toBe(`R01_${formation}`);return battle;
}
async function assertBattleGeometry(page,battle) {
  await page.waitForFunction(n=>window.__AVEL__.viewport().actors?.length>=n,battle.enemies.length+4);
  const actors=await page.evaluate(()=>window.__AVEL__.viewport().actors),enemies=actors.filter(a=>battle.enemies.some(e=>e.id===a.id));
  expect(enemies).toHaveLength(battle.enemies.length);
  for(const actor of enemies){const c=actor.cell;expect(c).toBeTruthy();for(const rect of[actor.sprite,actor.label,actor.bar]){
    expect(rect.x,`${actor.id} left`).toBeGreaterThanOrEqual(c.x-1);expect(rect.y,`${actor.id} top`).toBeGreaterThanOrEqual(c.y-1);
    expect(rect.x+rect.w,`${actor.id} right`).toBeLessThanOrEqual(c.x+c.w+1);expect(rect.y+rect.h,`${actor.id} bottom`).toBeLessThanOrEqual(c.y+c.h+1);}
    expect(c.x).toBeGreaterThanOrEqual(30);expect(c.x+c.w).toBeLessThanOrEqual(560);expect(c.y+c.h).toBeLessThanOrEqual(516);}
  for(let i=0;i<enemies.length;i++)for(let j=i+1;j<enemies.length;j++){const a=enemies[i].cell,b=enemies[j].cell;expect(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y).toBe(true);}
  await page.locator('[data-command="attack"]').click();await expect(page.locator('[data-target]')).toHaveCount(battle.enemies.length);
  await page.locator('[data-command="back"]').click();
}
async function finishBattle(page) {
  for(let round=0;round<35;round++){
    const state=await snapshot(page);if(state.mode!=='battle')break;
    await expect(page.locator('[data-command="resolve"]')).not.toBeEnabled();
    await page.locator('[data-command="quick"]').click();
    const healer=state.heroes.find(h=>h.id==='Iona'),wounded=state.heroes.filter(h=>h.hp>0).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
    if(healer.hp>0&&healer.status!=='sleep'&&healer.status!=='silence'&&healer.charges[0]>0&&wounded.hp<wounded.maxHp*.45){
      await page.locator('[data-hero="Iona"]').click();await page.locator('[data-command="magic"]').click();await page.locator('[data-spell="mend"]').click();await page.locator(`[data-target="${wounded.id}"]`).click();}
    await expect(page.locator('[data-command="resolve"]')).toBeEnabled();await page.locator('[data-command="resolve"]').click();
    await expect.poll(async()=>{const s=await snapshot(page);return s.mode!=='battle'||s.battle.phase==='planning';}).toBe(true);
  }
  expect((await snapshot(page)).mode).toBe('victory');
}

test('weapon and item shops have separate stock and preserve actual purchases and copies',async({page},info)=>{
  await shopFixture(page,'weapon',{job:'striker'});
  await expect(page.locator('[data-buy="R02_COMMON_CHARM"]')).toBeVisible();await expect(page.locator('[data-buy="POTION"]')).toHaveCount(0);
  const before=await snapshot(page);await page.locator('[data-buy="R02_COMMON_CHARM"]').click();expect((await snapshot(page)).inventory.R02_COMMON_CHARM).toBe(1);expect((await snapshot(page)).gold).toBeLessThan(before.gold);
  await dismiss(page);await interact(page,'shop-R02');await expect(page.locator('#dialog-title')).toHaveText('Item Shop');
  await expect(page.locator('[data-buy="POTION"]')).toBeVisible();await expect(page.locator('[data-buy="R02_COMMON_CHARM"]')).toHaveCount(0);
  const amount=(await snapshot(page)).inventory.POTION;await page.locator('[data-buy="POTION"]').click();expect((await snapshot(page)).inventory.POTION).toBe(amount+1);
  await page.screenshot({path:info.outputPath('item-shop.png'),fullPage:true});
});

test('magic shop teaches a selected compatible hero once without refilling charges; learning survives reload and battle',async({page},info)=>{
  await shopFixture(page,'magic');await page.locator('[data-pack-hero="Mara"]').click();
  const before=await snapshot(page);expect(before.learnedSpells.Mara).toEqual(['ember']);
  await expect(page.locator('[data-learn-spell="spark"]')).toBeEnabled();await expect(page.locator('[data-learn-spell="blizzard"]')).toBeDisabled();
  await page.locator('[data-learn-spell="spark"]').click();let learned=await snapshot(page);expect(learned.learnedSpells.Mara).toContain('spark');expect(learned.gold).toBe(before.gold-35);expect(learned.heroes[0].charges).toEqual(before.heroes[0].charges);
  await expect(page.locator('[data-learn-spell="spark"]')).toBeDisabled();await page.locator('[data-pack-hero="Tavin"]').click();await expect(page.locator('[data-learn-spell]')).toHaveCount(0);
  await page.locator('[data-pack-hero="Iona"]').click();await expect(page.locator('[data-learn-spell="shelter"]')).toBeEnabled();await page.screenshot({path:info.outputPath('magic-shop-learning.png'),fullPage:true});
  await dismiss(page);await page.reload();await page.locator('[data-front="continue"]').click();expect((await snapshot(page)).learnedSpells.Mara).toContain('spark');
  await fixture(page,state=>{state.area='works';state.player={x:5,y:13,facing:'right'};state.flags.briefed=true;state.settings.encounters='visible';});
  await interact(page,'encounter1');const battle=(await snapshot(page)).battle;await page.locator('[data-hero="Mara"]').click();await page.locator('[data-command="magic"]').click();
  await expect(page.locator('[data-spell="frost"]')).toHaveCount(0);await page.locator('[data-spell="spark"]').click();await page.locator(`[data-target="${battle.enemies[0].id}"]`).click();
  for(const id of ['Tavin','Iona','Soren']){await page.locator(`[data-hero="${id}"]`).click();await page.locator('[data-command="guard"]').click();}
  const charges=(await snapshot(page)).heroes[0].charges[0];await page.locator('[data-command="resolve"]').click();await expect.poll(async()=>{const s=await snapshot(page);return s.mode!=='battle'||s.battle.phase==='planning';}).toBe(true);expect((await snapshot(page)).heroes[0].charges[0]).toBe(charges-1);
});

test('existing saves without learning data retain unlocked job spells and per-character progress',async({page})=>{
  await newGame(page,{job:'arcanist'});const before=await snapshot(page);
  await fixture(page,state=>{delete state.learnedSpells;});const restored=await snapshot(page);
  expect(restored.learnedSpells.Mara).toEqual(expect.arrayContaining(['ember','spark','frost']));expect(restored.learnedSpells.Iona).toEqual(expect.arrayContaining(['mend','shelter']));expect(restored.hx).toEqual(before.hx);expect(restored.inventory).toEqual(before.inventory);expect(restored.profile).toEqual(before.profile);
});

test('nine light enemies fit the battle grid and pay the sum of their actual defeated contributions',async({page},info)=>{
  await newGame(page);const battle=await formationFixture(page,'swarm-nine');expect(battle.enemies).toHaveLength(9);expect(battle.enemies.every(e=>e.size==='small')).toBe(true);
  await assertBattleGeometry(page,battle);await page.screenshot({path:info.outputPath('nine-small-enemies.png'),fullPage:true});
  const before=await snapshot(page),xp=battle.enemies.reduce((sum,e)=>sum+e.rewardXp,0),gold=battle.enemies.reduce((sum,e)=>sum+e.rewardGold,0);
  await finishBattle(page);const after=await snapshot(page),survivors=after.heroes.filter(h=>h.hp>0);expect(after.gold).toBe(before.gold+gold);expect(after.reward.lines.join(' ')).toContain('9 enemies defeated');expect(after.reward.lines.join(' ')).toContain(`${xp} total EXP`);
  for(const hero of after.heroes)expect(after.hx[hero.id]-before.hx[hero.id]).toBe(hero.hp>0?Math.floor(xp/survivors.length):0);
  await page.screenshot({path:info.outputPath('nine-enemy-reward.png'),fullPage:true});
});

for(const [formation,count,large]of[['four-guards',4,4],['guarded-swarm',8,2]])test(`${formation} uses nonoverlapping readable formation cells`,async({page},info)=>{
  await newGame(page);const battle=await formationFixture(page,formation);expect(battle.enemies).toHaveLength(count);expect(battle.enemies.filter(e=>e.size==='large')).toHaveLength(large);await assertBattleGeometry(page,battle);await page.screenshot({path:info.outputPath(`${formation}.png`),fullPage:true});
});

test('courier side story has a useful road discovery, pays once, and survives reload',async({page},info)=>{
  await newGame(page);await interact(page,'courier-keeper');await dismiss(page);expect((await snapshot(page)).campaign.switches).toContain('courier_started');
  await exit(page,'world-camp','overworld');await interact(page,'courier-waystone');await dismiss(page);expect((await snapshot(page)).campaign.switches).toContain('courier_parcel');
  // Story-stage fixture opens the next region; collection and delivery use NPC UI.
  await fixture(page,state=>{state.area='dunmere';state.player={x:3,y:14,facing:'right'};state.campaign.stage=2;state.flags.briefed=true;});
  const before=await snapshot(page);await interact(page,'courier-witness');await dismiss(page);const delivered=await snapshot(page);expect(delivered.campaign.switches).toContain('courier_delivered');expect(delivered.gold).toBeGreaterThanOrEqual(before.gold);
  await interact(page,'courier-witness');await dismiss(page);expect((await snapshot(page)).gold).toBe(delivered.gold);expect((await snapshot(page)).inventory).toEqual(delivered.inventory);
  await page.reload();await page.locator('[data-front="continue"]').click();expect((await snapshot(page)).campaign.switches).toContain('courier_delivered');await page.locator('[data-panel="guide"]').click();await expect(page.locator('[role="dialog"]')).toContainText(/courier/i);await page.screenshot({path:info.outputPath('expanded-side-story-journal.png'),fullPage:true});
});

test('single bridge and pass thresholds are connected two-way routes rather than duplicate markers',async({page})=>{
  await newGame(page);await fixture(page,state=>{state.area='overworld';state.player={x:8,y:27,facing:'up'};state.campaign.stage=2;state.flags.briefed=true;});
  const current=await map(page);expect(current.entities.some(e=>['road-reedbank','pass-fen','road-orchard','gate-crown'].includes(e.id))).toBe(false);expect(current.entities.find(e=>e.id==='road-dunmere')).toMatchObject({x:8,y:26});
  await step(page,'up');expect((await snapshot(page)).player).toMatchObject({x:8,y:25});await step(page,'down');expect((await snapshot(page)).player).toMatchObject({x:8,y:27});
});

test('390px large formations and shop windows stay within the viewport',async({page},info)=>{
  await page.setViewportSize({width:390,height:844});await shopFixture(page,'magic',{job:'warden'});await page.locator('[data-pack-hero="Iona"]').click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);expect(await page.locator('[role="dialog"]').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);await page.screenshot({path:info.outputPath('mobile-magic-shop.png'),fullPage:true});
  await dismiss(page);await expect(page.locator('.touch-pad')).toBeVisible();
  const battle=await formationFixture(page,'swarm-nine');await assertBattleGeometry(page,battle);await expect(page.locator('.touch-pad')).toBeHidden();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await page.screenshot({path:info.outputPath('mobile-nine-enemies.png'),fullPage:true});
  await finishBattle(page);await expect(page.locator('[data-command="continue"]')).toBeVisible();await expect(page.locator('.touch-pad')).toBeHidden();await page.screenshot({path:info.outputPath('mobile-battle-reward.png'),fullPage:true});
  await page.locator('[data-command="continue"]').click();await settled(page);expect((await snapshot(page)).mode).toBe('explore');await expect(page.locator('.touch-pad')).toBeVisible();
});

test('expanded standalone game boots without secondary network requests',async({page})=>{
  const offlineURL='http://127.0.0.1:5190/offline-expanded.html',html=await readFile(new URL(`../${file}`, import.meta.url),'utf8'),requests=[],errors=[];
  page.on('request',r=>{if(/^https?:/.test(r.url())&&r.url()!==offlineURL)requests.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.request().url()===offlineURL?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());await newGame(page,{targetURL:offlineURL});expect((await snapshot(page)).learnedSpells.Iona).toContain('mend');expect(requests).toEqual([]);expect(errors).toEqual([]);
});
