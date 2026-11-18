import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const gameURL = process.env.GAME_URL || 'http://127.0.0.1:5173/';
const gameFile = process.env.GAME_HTML || new URL('../The_Road_Beyond_the_Bells.html', import.meta.url);
const legacyFile = new URL('../jobs-baseline.html', import.meta.url);
const snapshot = page => page.evaluate(() => window.__AVEL__.snapshot());
const plain = value => JSON.parse(JSON.stringify(value));
const ids = ['Mara','Tavin','Iona','Soren'];
const directions = [['up',0,-1],['down',0,1],['left',-1,0],['right',1,0]];
const errors = new WeakMap();
let engine;

test.beforeEach(async ({ page }) => { const found=[]; errors.set(page,found); page.on('pageerror', error => found.push(error.message)); });
test.afterEach(async ({ page }) => { expect(errors.get(page) || []).toEqual([]); });

async function core() {
  if (!engine) {
    const html = await readFile(gameFile,'utf8');
    engine = vm.createContext({ structuredClone });
    vm.runInContext(html.slice(html.indexOf('var l={schemaVersion'),html.indexOf('var De=new Set')),engine,{timeout:5000});
  }
  return engine;
}
async function settled(page) {
  await page.waitForFunction(() => { const v=window.__AVEL__?.viewport(),s=window.__AVEL__?.snapshot(); return v&&s&&v.area===s.area&&!v.transitioning; });
}
async function newHero(page, partyJobs = {}) {
  await page.addInitScript(() => {
    const value=sessionStorage.getItem('jobs-next-save');
    if(value){localStorage.setItem('avel-demo-v1',value);sessionStorage.removeItem('jobs-next-save');}
  });
  const response=await page.goto(gameURL),digest=bytes=>createHash('sha256').update(bytes).digest('hex');
  expect(digest(await response.body()),'normal preview serves authoritative bytes').toBe(digest(await readFile(gameFile)));
  await page.waitForFunction(()=>window.__AVEL__?.map);
  await page.locator('[data-front="new"]').click(); await page.locator('#hero-name').fill('Rowan');
  await page.locator('[data-front="next"]').click(); await page.locator('[data-job="warden"]').click();
  await page.locator('[data-front="next"]').click();
  for(const [id,job] of Object.entries(partyJobs)) await page.locator(`[data-creator-job-hero="${id}"]`).selectOption(job);
  await page.locator('[data-front="begin"]').click(); await page.locator('[data-intro="skip"]').click(); await settled(page);
  await page.locator('[data-panel="help"]').last().click();
  await page.locator('[data-speed="3"]').click(); await page.locator('[data-encounters="off"]').click();
  await page.locator('[data-close]').click();
  expect((await snapshot(page)).version).toBe(4);
}
async function rawFixture(page, save) {
  await page.evaluate(value=>sessionStorage.setItem('jobs-next-save',JSON.stringify(value)),save);
  await page.reload(); await page.locator('[data-front="continue"]').click(); await settled(page);
}
// These fixtures isolate levels, MP and locations. Purchases, job changes,
// targeting and casting still use real player input, not a mutation API.
async function fixture(page, change) {
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('avel-demo-v1')));
  change(saved); await rawFixture(page,saved);
}
async function dismiss(page) {
  for(let n=0;n<40&&(await snapshot(page)).message;n++)await page.locator('[data-command="dismiss"]').click();
  expect((await snapshot(page)).message).toBeNull();
}
function beside(c,area,id) {
  const map=c.he[area],entity=map.entities.find(e=>e.id===id); expect(entity,id).toBeTruthy();
  for(const [direction,dx,dy] of directions){
    const point={x:entity.x+dx,y:entity.y+dy,facing:{up:'down',down:'up',left:'right',right:'left'}[direction]};
    if(!c.q.includes(map.tiles[point.y]?.[point.x])||!c.p(area,point.x,point.y))continue;
    if(map.entities.some(e=>e.id!==id&&Math.abs(e.x-point.x)+Math.abs(e.y-point.y)<=1))continue;
    return point;
  }
  throw Error(`No unique safe approach for ${id}`);
}
function levelHero(c,state,id,level) {
  const old=state.heroes.find(hero=>hero.id===id);
  state.hx[id]=c.l.xp_thresholds[level-1];
  state.heroes[state.heroes.indexOf(old)]=plain(c.be(id,level,old.equipment,state.profile,state.partyJobs[id]));
}
async function openSkillShop(page) {
  const c=await core(),area='camp';
  const shop=c.he[area].entities.find(entity=>['skills','skill','magic'].includes(entity.shopKind)||entity.id.startsWith('magic-'));
  expect(shop).toBeTruthy();
  await fixture(page,state=>{state.area=area;state.player=beside(c,area,shop.id);});
  await page.locator('#game-world canvas').focus();await page.keyboard.press('e');
  await expect(page.locator('#dialog-title')).toHaveText('Skill Shop');
}
async function openJobs(page) {
  await page.keyboard.press('Escape'); await page.locator('[data-panel="jobs"]').click();
  await expect(page.locator('[data-apply-job]')).toBeVisible();
}
async function changeJob(page,id,job) {
  await page.locator(`[data-pack-hero="${id}"]`).click();
  await page.locator(`[data-party-job="${job}"]`).click();
  await expect(page.locator('[data-apply-job]')).toBeEnabled();
  await page.locator('[data-apply-job]').click();
  expect((await snapshot(page)).partyJobs[id]).toBe(job);
}
async function authoredBattle(page, change=()=>{}) {
  const c=await core(),map=Object.values(c.he).find(map=>map.entities.some(entity=>entity.id==='encounter1'));
  const foe=map.entities.find(entity=>entity.id==='encounter1');
  await fixture(page,state=>{
    state.area=map.area;state.player={x:foe.x,y:foe.y+1,facing:'up'};
    state.flags.briefed=true;state.settings.encounters='visible';state.settings.battleSpeed=3;change(state,c);
  });
  await page.locator('#game-world canvas').focus();await page.keyboard.press('e');
  await expect.poll(async()=>(await snapshot(page)).mode).toBe('battle');
  return(await snapshot(page)).battle;
}
async function guardOthers(page) {
  for(const hero of(await snapshot(page)).heroes)if(hero.hp>0&&hero.status!=='sleep'&&!(await snapshot(page)).battle.plans[hero.id]){
    await page.locator(`[data-hero="${hero.id}"]`).click();await page.locator('[data-command="guard"]').click();
  }
}
async function resolve(page) {
  await page.locator('[data-command="resolve"]').click();
  await expect.poll(async()=>{const s=await snapshot(page);return s.mode!=='battle'||s.battle.phase==='planning';}).toBe(true);
}
async function noOverflow(page) {
  const size=await page.evaluate(()=>({w:innerWidth,body:document.body.scrollWidth,root:document.documentElement.scrollWidth}));
  expect(size.body).toBeLessThanOrEqual(size.w+1);expect(size.root).toBeLessThanOrEqual(size.w+1);
}

test('Warden starts with a real martial skill and spends MP only when its round resolves',async({page},info)=>{
  await newHero(page);await authoredBattle(page);
  const before=await snapshot(page),warden=before.heroes[0];
  expect(warden.mp).toBe(warden.maxMp);expect(before.learnedSpells.Mara).toContain('shield-bash');
  await page.locator('[data-command="magic"]').click();
  await expect(page.locator('[data-spell="shield-bash"]')).toBeEnabled();
  await expect(page.locator('[data-spell="shield-bash"]')).toContainText('3 MP');
  await page.locator('[data-spell="shield-bash"]').click();await page.locator('[data-target]').first().click();
  expect((await snapshot(page)).heroes[0].mp).toBe(warden.mp);
  await guardOthers(page);await resolve(page);
  const after=await snapshot(page);expect(after.mode).toBe('battle');expect(after.heroes[0].mp).toBe(warden.mp-3);
  expect(after.sp.Mara['shield-bash']).toBe(1);expect(after.battle.log.join(' ')).toContain('Shield Bash');
  await expect(page.locator('[data-hero-mp="Mara"]')).toContainText(`${warden.mp-3}`);
  await page.screenshot({path:info.outputPath('martial-skill-mp-round.png'),fullPage:true});
});

test('Skill Shop teaches an unlocked martial technique once without refilling MP and saves it',async({page},info)=>{
  await newHero(page);const c=await core();
  await fixture(page,state=>{levelHero(c,state,'Mara',5);state.heroes[0].mp=3;state.gold=1000;});
  await openSkillShop(page);
  const before=await snapshot(page),offer=page.locator('[data-learn-skill="rally"]');
  await expect(offer).toBeEnabled();await offer.click();
  const after=await snapshot(page);expect(after.learnedSpells.Mara).toContain('rally');expect(after.gold).toBe(before.gold-100);
  expect(after.heroes[0].mp).toBe(3);await expect(page.locator('[data-learn-skill="rally"]')).toBeDisabled();
  await expect(page.locator('[data-hero-mp="Mara"]')).toHaveAttribute('data-max-mp',String(after.heroes[0].maxMp));
  await expect(page.locator('.skill-shop .shop-intro')).toContainText(`3 / ${after.heroes[0].maxMp} MP`);
  await page.screenshot({path:info.outputPath('skill-shop-martial-learning.png'),fullPage:true});
  await dismiss(page);await page.reload();await page.locator('[data-front="continue"]').click();await settled(page);
  const loaded=await snapshot(page);expect(loaded.learnedSpells.Mara).toContain('rally');expect(loaded.gold).toBe(after.gold);expect(loaded.heroes[0].mp).toBe(3);
});

test('all companions can choose jobs during creation and change them without MP farming or lost copies',async({page},info)=>{
  const created={Tavin:'scout',Iona:'arcanist',Soren:'warden'};await newHero(page,created);
  for(const[id,job]of Object.entries(created))expect((await snapshot(page)).partyJobs[id]).toBe(job);
  await fixture(page,state=>{
    state.inventory.R02_COMMON_CHARM=4;
    for(const hero of state.heroes){hero.equipment.charm='R02_COMMON_CHARM';hero.hp=Math.max(1,hero.hp-20);hero.mp=2;}
    state.sp.Iona={ember:7};
  });
  const before=await snapshot(page);await openJobs(page);
  await changeJob(page,'Tavin','arcanist');await changeJob(page,'Iona','mender');await changeJob(page,'Soren','scout');
  await changeJob(page,'Tavin','scout');await changeJob(page,'Tavin','arcanist');
  const after=await snapshot(page);
  expect(after.heroes.map(hero=>hero.mp)).toEqual([2,2,2,2]);
  expect(after.inventory).toEqual(before.inventory);expect(after.hx).toEqual(before.hx);expect(after.sp.Iona.ember).toBe(7);
  expect(after.learnedSpells.Iona).toContain('ember');expect(after.learnedSpells.Iona).toContain('mend');
  expect(after.heroes.every(hero=>hero.equipment.charm==='R02_COMMON_CHARM')).toBe(true);
  expect(after.inventory.R02_COMMON_CHARM).toBe(4);
  for(const hero of after.heroes)expect(hero.hp).toBeLessThanOrEqual(before.heroes.find(old=>old.id===hero.id).hp);
  await page.screenshot({path:info.outputPath('party-job-preview-and-history.png'),fullPage:true});
  await page.locator('[data-close]').click();await page.reload();await page.locator('[data-front="continue"]').click();await settled(page);
  const loaded=await snapshot(page);expect(loaded.partyJobs).toEqual(after.partyJobs);expect(loaded.inventory).toEqual(after.inventory);
  expect(loaded.heroes.map(hero=>hero.mp)).toEqual([2,2,2,2]);expect(loaded.learnedSpells).toEqual(after.learnedSpells);
});

test('insufficient MP blocks skills while silence blocks magic and leaves martial skills usable',async({page})=>{
  await newHero(page);await authoredBattle(page,state=>{state.heroes[0].mp=2;});
  await page.locator('[data-command="magic"]').click();await expect(page.locator('[data-spell="shield-bash"]')).toBeDisabled();
  await page.keyboard.press('Escape');await expect(page.locator('[data-command="attack"]')).toBeEnabled();
  await page.locator('[data-command="guard"]').click();expect((await snapshot(page)).battle.plans.Mara.type).toBe('guard');
  expect((await snapshot(page)).heroes[0].mp).toBe(2);
  await authoredBattle(page,state=>{state.heroes[0].mp=3;state.heroes[0].status='silence';state.heroes.find(hero=>hero.id==='Soren').status='silence';state.heroes.find(hero=>hero.id==='Iona').mp=0;});
  const before=await snapshot(page);await page.locator('[data-command="magic"]').click();
  await expect(page.locator('[data-spell="shield-bash"]')).toBeEnabled();
  await page.locator('[data-spell="shield-bash"]').click();await page.locator('[data-target]').first().click();
  await page.locator('[data-hero="Soren"]').click();await page.locator('[data-command="magic"]').click();
  await expect(page.locator('[data-spell="ember"]')).toBeDisabled();
  await page.locator('[data-hero="Iona"]').click();await page.locator('[data-command="magic"]').click();
  await expect(page.locator('[data-spell="mend"]')).toBeDisabled();await page.keyboard.press('Escape');
  await guardOthers(page);await resolve(page);
  expect((await snapshot(page)).heroes[0].mp).toBe(before.heroes[0].mp-3);
});

test('an actual previous charge-based save imports as MP without losing equipment or progress',async({page},info)=>{
  await newHero(page);
  const html=await readFile(legacyFile,'utf8'),c=vm.createContext({structuredClone});
  vm.runInContext(html.slice(html.indexOf('var l={schemaVersion'),html.indexOf('var De=new Set')),c,{timeout:5000});
  const old=c.Ee({storage:null,seed:7321,roundDelay:0});old.beginAdventure({...c.R,name:'Legacy Rowan'});old.skipIntro();old.configure({encounters:'off'});
  old.state.gold=733;old.state.difficulty='hard';old.state.sp.Soren={ember:17};old.state.inventory.R02_COMMON_CHARM=4;
  for(const hero of old.state.heroes)hero.equipment.charm='R02_COMMON_CHARM';
  old.state.heroes.find(hero=>hero.id==='Iona').charges.fill(0);
  const prior=plain(old.state);expect(prior.version).toBe(3);await rawFixture(page,prior);
  const loaded=await snapshot(page);expect(loaded.version).toBe(4);expect(loaded.gold).toBe(733);expect(loaded.difficulty).toBe('hard');
  expect(loaded.hx).toEqual(prior.hx);expect(loaded.inventory).toEqual(prior.inventory);expect(loaded.sp).toEqual(prior.sp);
  expect(loaded.heroes.find(hero=>hero.id==='Iona').mp).toBe(0);
  expect(loaded.heroes.find(hero=>hero.id==='Soren').mp).toBe(loaded.heroes.find(hero=>hero.id==='Soren').maxMp);
  expect(loaded.heroes.every(hero=>hero.equipment.charm==='R02_COMMON_CHARM')).toBe(true);
  await page.locator('[data-panel="inventory"]').click();await expect(page.locator('.loadout')).toContainText('MP');
  await page.screenshot({path:info.outputPath('migrated-mp-save.png'),fullPage:true});
});

test('390px job, MP, skill and preparation panels remain readable with a visible close control',async({page},info)=>{
  await page.setViewportSize({width:390,height:844});await newHero(page);
  await openJobs(page);await page.locator('[data-pack-hero="Iona"]').click();await page.locator('[data-party-job="warden"]').click();
  await noOverflow(page);await expect(page.locator('[data-job-preview="warden"]')).toBeVisible();
  await page.screenshot({path:info.outputPath('mobile-party-job-preview.png'),fullPage:true});await page.locator('[data-close]').click();
  await page.locator('[data-panel="worldmap"]').click();await expect(page.locator('[data-expedition-mp]')).toHaveCount(4);
  await noOverflow(page);await page.screenshot({path:info.outputPath('mobile-mp-preparation.png'),fullPage:true});await page.locator('[data-close]').click();
  await authoredBattle(page);await page.locator('[data-command="magic"]').click();await expect(page.locator('[data-spell="shield-bash"]')).toBeVisible();
  await noOverflow(page);await page.screenshot({path:info.outputPath('mobile-martial-skills.png'),fullPage:true});
  expect(await page.locator('[data-hero-mp]').count()).toBe(4);
});

test('field MP tea cannot be wasted and ordinary shelter rest restores the party MP pools',async({page},info)=>{
  await newHero(page);await fixture(page,state=>{state.heroes[0].mp=2;state.inventory.SPARK_TEA=2;});
  await page.locator('[data-panel="inventory"]').click();await expect(page.locator('[data-use="SPARK_TEA"]')).toBeEnabled();
  const before=await snapshot(page);await page.locator('[data-use="SPARK_TEA"]').click();
  const after=await snapshot(page);expect(after.heroes[0].mp).toBe(after.heroes[0].maxMp);expect(after.inventory.SPARK_TEA).toBe(before.inventory.SPARK_TEA-1);
  await expect(page.locator('[data-use="SPARK_TEA"]')).toBeDisabled();await expect(page.locator('[data-use-tier]')).toHaveCount(0);
  await page.locator('[data-use="SPARK_TEA"]').scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('mp-tea-field-use.png'),fullPage:true});
  await page.locator('[data-close]').click();await fixture(page,state=>{for(const hero of state.heroes){hero.mp=0;hero.hp-=5;} });
  const gold=(await snapshot(page)).gold;await page.locator('[data-command="rest"]').click();await dismiss(page);
  const rested=await snapshot(page);expect(rested.heroes.every(hero=>hero.mp===hero.maxMp&&hero.hp===hero.maxHp)).toBe(true);expect(rested.gold).toBe(gold);
  await page.reload();await page.locator('[data-front="continue"]').click();await settled(page);
  expect((await snapshot(page)).heroes.every(hero=>hero.mp===hero.maxMp)).toBe(true);
});

test('shared battle MP tea uses a normal item action and restores only the chosen depleted ally',async({page},info)=>{
  await newHero(page);await authoredBattle(page,state=>{state.inventory.SPARK_TEA=1;state.heroes.find(hero=>hero.id==='Iona').mp=0;state.settings.battleSpeed=1;});
  const before=await snapshot(page);await page.locator('[data-hero="Tavin"]').click();await page.locator('[data-command="items"]').click();
  await expect(page.locator('[data-battle-item="SPARK_TEA"]')).toBeEnabled();await page.locator('[data-battle-item="SPARK_TEA"]').click();
  await expect(page.locator('[data-target="Mara"]')).toBeDisabled();await expect(page.locator('[data-target="Iona"]')).toBeEnabled();
  await page.locator('[data-target="Iona"]').click();await guardOthers(page);
  await page.locator('[data-command="resolve"]').click();
  const cueHandle=await page.waitForFunction(()=>{
    const cue=window.__AVEL__?.snapshot().battle?.cue;
    return cue?.resource==='mp'?cue:null;
  },null,{polling:'raf'});
  const cue=await cueHandle.jsonValue();
  expect(cue.kind).toBe('heal');expect(cue.amount).toBe(Math.min(20,before.heroes.find(hero=>hero.id==='Iona').maxMp));
  await page.screenshot({path:info.outputPath('battle-mp-tea-floating-cue.png'),fullPage:true});
  await expect.poll(async()=>{const s=await snapshot(page);return s.mode!=='battle'||s.battle.phase==='planning';}).toBe(true);
  const after=await snapshot(page);expect(after.mode).toBe('battle');expect(after.inventory.SPARK_TEA).toBe(0);
  expect(after.heroes.find(hero=>hero.id==='Iona').mp).toBe(Math.min(20,after.heroes.find(hero=>hero.id==='Iona').maxMp));
  for(const id of ['Mara','Tavin','Soren'])expect(after.heroes.find(hero=>hero.id===id).mp).toBe(before.heroes.find(hero=>hero.id===id).mp);
  await page.screenshot({path:info.outputPath('battle-mp-tea-recovery.png'),fullPage:true});
});

test('weapon selection compares the chosen traveler and quantity purchases keep four charm copies usable',async({page},info)=>{
  await newHero(page); const c=await core(),area='dunmere';
  const shop=c.he[area].entities.find(entity=>entity.shopKind==='weapon'); expect(shop).toBeTruthy();
  // A declared shop fixture provides spending money and regional access. It
  // tests buying/copy rules, not campaign income or a route to Dunmere.
  await fixture(page,state=>{state.area=area;state.player=beside(c,area,shop.id);state.campaign.stage=2;state.gold=10000;});
  await page.locator('#game-world canvas').focus();await page.keyboard.press('e');
  await expect(page.locator('#dialog-title')).toHaveText('Weapon Shop');
  await page.locator('[data-shop-hero="Iona"]').click();await page.locator('[data-gear-slot="weapon"]').click();
  const compatible=page.locator('[data-compatible-only]');
  if(await compatible.getAttribute('aria-pressed')!=='true')await compatible.click();
  const state=await snapshot(page),oldWeapon=c.K(state.heroes.find(hero=>hero.id==='Iona').equipment.weapon).name;
  const offered=page.locator('[data-shop-item="R02_IONA_WEAPON"]');
  await expect(offered).toBeVisible();await expect(offered).toContainText(oldWeapon);
  await expect(offered.locator('[data-shop-compare="Iona"]')).toContainText('Iona');
  await expect(page.locator('[data-buy="R02_MARA_WEAPON"]')).toHaveCount(0);
  await page.setViewportSize({width:390,height:844});await offered.scrollIntoViewIfNeeded();await noOverflow(page);
  await page.screenshot({path:info.outputPath('mobile-selected-weapon-comparison.png'),fullPage:true});
  await page.locator('[data-gear-slot="head"]').click();await page.locator('[data-shop-qty="5"]').click();
  await expect(page.locator('[data-buy="R02_COMMON_HEAD"]')).toContainText('×5');
  await page.locator('[data-buy="R02_COMMON_HEAD"]').click();
  expect((await snapshot(page)).inventory.R02_COMMON_HEAD).toBe(5);
  await page.locator('[data-gear-slot="charm"]').click();await page.locator('[data-shop-qty="1"]').click();
  for(let copy=0;copy<4;copy++)await page.locator('[data-buy="R02_COMMON_CHARM"]').click();
  expect((await snapshot(page)).inventory.R02_COMMON_CHARM).toBe(4);
  await page.locator('[data-gear-slot="body"]').click();await page.locator('[data-shop-qty="max"]').click();
  const bodyId='R02_IONA_BODY',bodyBuy=page.locator(`[data-buy="${bodyId}"]`),bodyRow=page.locator(`[data-shop-item="${bodyId}"]`);
  await bodyBuy.focus();await page.keyboard.press('Enter');
  await expect(bodyBuy).toBeDisabled();await expect(bodyRow).toBeFocused();await noOverflow(page);
  const bought=await snapshot(page);expect(bought.inventory[bodyId]).toBeGreaterThan(0);
  expect(bought.inventory.R02_COMMON_CHARM).toBe(4);
  await dismiss(page);await page.locator('[data-panel="inventory"]').click();
  await page.locator('[data-pack-view="equipment"]').click();await page.locator('[data-optimize="all"]').click();
  const equipped=await snapshot(page);
  expect(equipped.heroes.every(hero=>hero.equipment.charm==='R02_COMMON_CHARM')).toBe(true);
  expect(equipped.inventory.R02_COMMON_CHARM).toBe(4);expect(equipped.inventory.R02_COMMON_HEAD).toBe(5);
  await page.locator('[data-close]').click();await page.reload();await page.locator('[data-front="continue"]').click();await settled(page);
  const loaded=await snapshot(page);expect(loaded.heroes.map(hero=>hero.equipment)).toEqual(equipped.heroes.map(hero=>hero.equipment));
  expect(loaded.inventory).toEqual(equipped.inventory);
});

test('390px inventory shows current HP and capped recovery previews before and after supplies',async({page},info)=>{
  await page.setViewportSize({width:390,height:844});await newHero(page);
  await fixture(page,state=>{state.heroes[0].hp=43;state.heroes[0].mp=2;state.inventory.SPARK_TEA=2;});
  await page.locator('[data-panel="inventory"]').click();await page.locator('[data-pack-view="supplies"]').click();
  const target=page.locator('[data-inventory-target="Mara"]');
  await expect(target).toContainText('Rowan');await expect(target).toContainText('43 / 100 HP');
  await expect(target).toContainText('2 / 12 MP');
  const potion=page.locator('[data-recovery-preview="POTION"]');
  await expect(potion).toContainText('43 / 100 → 100 / 100 (+57)');
  await expect(potion).toContainText('3 healing unused');
  await noOverflow(page);await page.screenshot({path:info.outputPath('mobile-potion-recovery-preview.png'),fullPage:true});
  const before=await snapshot(page);await page.locator('[data-use="POTION"]').click();
  expect((await snapshot(page)).heroes[0].hp).toBe(100);
  expect((await snapshot(page)).inventory.POTION).toBe(before.inventory.POTION-1);
  await expect(target).toContainText('100 / 100 HP');await expect(page.locator('[data-use="POTION"]')).toBeDisabled();
  await expect(target).toBeFocused();
  await expect(page.locator('[data-recovery-preview="SPARK_TEA"]')).toContainText('2 / 12 → 12 / 12 (+10)');
  await page.locator('[data-use="SPARK_TEA"]').click();
  expect((await snapshot(page)).heroes[0].mp).toBe(12);expect((await snapshot(page)).inventory.SPARK_TEA).toBe(1);
  await expect(target).toContainText('12 / 12 MP');await expect(page.locator('[data-use="SPARK_TEA"]')).toBeDisabled();
  await noOverflow(page);await target.scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>!document.querySelector('#toast')?.classList.contains('visible'));
  await expect(page.locator('#toast')).toHaveCSS('opacity','0');
  await page.screenshot({path:info.outputPath('mobile-live-hp-mp-inventory.png'),fullPage:true});
  await page.locator('[data-close]').click();await page.reload();await page.locator('[data-front="continue"]').click();await settled(page);
  const loaded=await snapshot(page);expect(loaded.heroes[0].hp).toBe(100);expect(loaded.heroes[0].mp).toBe(12);
  expect(loaded.inventory.POTION).toBe(before.inventory.POTION-1);expect(loaded.inventory.SPARK_TEA).toBe(1);
});
