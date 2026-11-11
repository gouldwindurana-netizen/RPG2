import { test, expect, type Page } from '@playwright/test';
import type { GameState, HeroId, CharacterProfile } from '../src/contracts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const snapshot = (page: Page) => page.evaluate(() => (window as unknown as { __AVEL__: { snapshot(): GameState } }).__AVEL__.snapshot());
async function dismissMessages(page: Page) {
  for (let i = 0; i < 20 && await page.locator('[data-command="dismiss"]').count(); i++) {
    await page.locator('[data-command="dismiss"]').click();
  }
}
async function resume(page: Page) {
  if(await page.locator('[data-front="continue"]').count())await page.locator('[data-front="continue"]').click();
  await dismissMessages(page);
}
async function settings(page:Page,encounters:'visible'|'classic'|'off',speed?:1|2|3) {
  await page.locator('[data-panel="help"]').first().click();
  await page.locator(`[data-encounters="${encounters}"]`).click();
  if(speed)await page.locator(`[data-speed="${speed}"]`).click();
  await page.locator('[data-close]').click();
}
async function newAdventure(page: Page, options:Partial<CharacterProfile>&{skip?:boolean;encounters?:'visible'|'classic'|'off'}={}) {
  await page.goto('/');
  await expect(page.locator('[data-front="new"]')).toBeVisible();
  await page.locator('[data-front="new"]').click();
  await page.locator('#hero-name').fill(options.name??'Lyra');
  if(options.pronouns)await page.locator(`[data-custom="pronouns"][data-value="${options.pronouns}"]`).click();
  await page.locator('[data-front="next"]').click();
  await page.locator(`[data-job="${options.job??'warden'}"]`).click();
  await page.locator('[data-front="next"]').click();
  for(const key of ['skin','hair','hairStyle','cloak'] as const)if(options[key])await page.locator(`[data-custom="${key}"][data-value="${options[key]}"]`).click();
  await page.locator('[data-front="begin"]').click();
  await expect(page.locator('[data-intro="next"]')).toBeVisible();
  if(options.skip!==false){
    await page.locator('[data-intro="skip"]').click();
    await expect.poll(async()=>(await snapshot(page)).mode).toBe('explore');
    await settings(page,options.encounters??'visible',3);
  }
}
async function tile(page: Page, x: number, y: number) {
  const canvas = page.locator('#game-world canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Game canvas is not visible');
  await page.mouse.click(box.x + (x + .5) * 30 / 960 * box.width,
    box.y + (18 + (y + 1) * 30 - 2) / 576 * box.height);
}
async function visit(page: Page, x: number, y: number, done: (state: GameState) => boolean) {
  await dismissMessages(page);
  await tile(page, x, y);
  await expect.poll(async () => done(await snapshot(page)), { timeout: 15_000 }).toBe(true);
}
async function plan(page: Page, hero: HeroId, type: 'attack' | 'guard' | 'spell' | 'item', target?: string, spell?: string) {
  await page.locator(`[data-hero="${hero}"]`).click();
  if (type === 'guard') { await page.locator('[data-command="guard"]').click(); return; }
  await page.locator(`[data-command="${type === 'spell' ? 'magic' : type === 'item' ? 'items' : 'attack'}"]`).click();
  if (type === 'spell') await page.locator(`[data-spell="${spell}"]`).click();
  if (type === 'item') await page.locator('[data-battle-item="POTION"]').click();
  if (target) await page.locator(`[data-target="${target}"]`).click();
}
async function finishBattle(page: Page, capture?: string) {
  for (let round = 0; round < 45; round++) {
    const state = await snapshot(page);
    if (state.mode !== 'battle') break;
    expect(state.battle?.phase).toBe('planning');
    const battle = state.battle!;
    const target = battle.enemies.find(e => e.hp > 0)!;
    const wounded = state.heroes.filter(h => h.hp > 0).sort((a,b) => a.hp/a.maxHp - b.hp/b.maxHp)[0];
    for (const hero of state.heroes) {
      if (hero.hp <= 0 || hero.status === 'sleep') continue;
      if (battle.kind !== 'normal' && battle.round % 2 === 0) await plan(page, hero.id, 'guard');
      else if (hero.id === 'Iona' && wounded.hp < wounded.maxHp * .6 && hero.charges[0]) await plan(page,hero.id,'spell',wounded.id,'mend');
      else if (wounded.hp < wounded.maxHp * .3 && (state.inventory.POTION ?? 0) > 0 && hero.id === 'Iona') await plan(page,hero.id,'item',wounded.id);
      else if (hero.id === 'Soren' && hero.charges[0]) await plan(page,hero.id,'spell',target.id,target.weakness.includes('frost')?'frost':target.weakness.includes('lightning')?'spark':'ember');
      else await plan(page,hero.id,'attack',target.id);
    }
    if (round === 0 && capture) await page.screenshot({ path: capture, fullPage: true });
    await expect(page.locator('[data-command="resolve"]')).toBeEnabled();
    await page.locator('[data-command="resolve"]').click();
    await expect.poll(async () => { const current=await snapshot(page); return current.mode !== 'battle' || current.battle?.phase === 'planning'; }, {timeout: 15_000}).toBe(true);
  }
  const result=await snapshot(page);
  expect(result.mode).toBe('victory');
  if (result.reward?.choices.length) await page.locator(`[data-claim="${result.reward.choices[0]}"]`).click();
  await page.locator('[data-command="continue"]').click();
  await dismissMessages(page);
}

test('first expedition supports spell combat and saved exploration checkpoints', async ({ page }) => {
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await newAdventure(page);
  await expect(page.locator('#game-world canvas')).toBeVisible();
  await page.screenshot({ path: 'test-results/camp-desktop.png', fullPage:true });
  await visit(page,14,9,s=>s.flags.briefed);
  await dismissMessages(page);
  await visit(page,28,8,s=>s.area==='works');
  await dismissMessages(page);
  await page.screenshot({ path:'test-results/works-desktop.png',fullPage:true });
  await visit(page,6,13,s=>s.mode==='battle');
  await finishBattle(page,'test-results/battle-desktop.png');
  expect((await snapshot(page)).xp).toBe(28);
  await page.reload();await resume(page);
  expect((await snapshot(page)).cleared).toContain('encounter1');
  expect((await snapshot(page)).xp).toBe(28);
  expect((await snapshot(page)).campaign.stage).toBe(0);
  expect((await snapshot(page)).flags.completed).toBe(false);
  await visit(page,2,15,s=>s.area==='camp');
  await page.locator('[data-command="rest"]').click();await dismissMessages(page);
  expect((await snapshot(page)).heroes.every(h=>h.hp===h.maxHp)).toBe(true);
  expect(errors).toEqual([]);
});

test('mobile is playable and menus remain within viewport', async ({page})=>{
  await page.setViewportSize({width:390,height:844});await newAdventure(page);
  await expect(page.locator('#game-world canvas')).toBeVisible();
  await expect(page.locator('[data-move="right"]')).toBeVisible();
  const initial=(await snapshot(page)).player.x;await page.locator('[data-move="right"]').click();
  expect((await snapshot(page)).player.x).toBe(initial+1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/camp-mobile.png',fullPage:true});
  await page.locator('#pack-button').click();await expect(page.getByRole('heading',{name:'What we carry'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/pack-mobile.png',fullPage:true});
  await page.locator('[data-close]').click();
});

test('shop purchases work and single-ally healing opens target selection', async ({page})=>{
  await newAdventure(page);
  await visit(page,16,12,s=>s.message?.speaker==='Quartermaster');
  const supplies=(await snapshot(page)).inventory.POTION;
  await page.locator('[data-buy="POTION"]').click();
  expect((await snapshot(page)).inventory.POTION).toBe(supplies+1);
  expect((await snapshot(page)).gold).toBe(30);
  await dismissMessages(page);
  await visit(page,14,9,s=>s.flags.briefed);await dismissMessages(page);
  await visit(page,28,8,s=>s.area==='works');await dismissMessages(page);
  await visit(page,6,13,s=>s.mode==='battle');
  await plan(page,'Iona','spell','Mara','mend');
  expect((await snapshot(page)).battle?.plans.Iona).toMatchObject({type:'spell',spellId:'mend',target:'Mara'});
});

test('single-file production build boots without external requests',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const unexpected:string[]=[];
  // Managed Chrome blocks file://. Fulfill only the initial HTML request and
  // abort every other request to verify the exact production artifact offline.
  await page.route('**/*',route=>{
    if(route.request().isNavigationRequest())return route.fulfill({contentType:'text/html',body:readFileSync(resolve('dist/index.html'),'utf8')});
    unexpected.push(route.request().url());return route.abort();
  });
  await page.goto('http://avel-demo.invalid/');
  await expect(page.locator('#game-world canvas')).toBeVisible();
  await expect(page.locator('[data-front="new"]')).toBeVisible();
  expect((await snapshot(page)).heroes.length).toBe(4);
  expect(errors).toEqual([]);
  expect(unexpected).toEqual([]);
});


test('custom hero creation introduces the party and persists profile and prologue progress',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  await page.screenshot({path:'test-results/title-desktop.png',fullPage:true});
  await page.locator('[data-front="new"]').click();
  await expect(page.locator('[data-custom="pronouns"]')).toHaveCount(2);
  await expect(page.locator('[data-custom="pronouns"][data-value="they"]')).toHaveCount(0);
  const before=(await snapshot(page)).player;
  await page.locator('#hero-name').fill('Rowan');
  await page.locator('#hero-name').press('ArrowRight');
  expect((await snapshot(page)).player).toEqual(before);
  await page.locator('[data-custom="pronouns"][data-value="he"]').click();
  await page.locator('[data-front="next"]').click();
  await page.locator('[data-job="spellblade"]').click();
  await page.screenshot({path:'test-results/jobs-desktop.png',fullPage:true});
  await page.locator('[data-front="next"]').click();
  for(const [key,value] of [['skin','deep'],['hair','silver'],['cloak','plum'],['hairStyle','tied']])await page.locator(`[data-custom="${key}"][data-value="${value}"]`).click();
  await page.screenshot({path:'test-results/appearance-desktop.png',fullPage:true});
  await page.locator('[data-front="begin"]').click();
  await expect(page.locator('#prologue-speaker')).toHaveText('The Road Beyond the Bells');
  await page.locator('[data-intro="next"]').click();
  await expect(page.locator('#prologue-speaker')).toHaveText('Rowan');
  await expect(page.locator('.prologue-content')).toContainText('his journey');
  await page.screenshot({path:'test-results/prologue-hero.png',fullPage:true});
  await page.locator('[data-intro="next"]').click();
  await page.locator('[data-intro="next"]').click();
  await expect(page.locator('#prologue-speaker')).toHaveText('Tavin');
  await page.reload();await resume(page);
  await expect(page.locator('#prologue-speaker')).toHaveText('Tavin');
  for(const name of ['Iona','Soren','Bessa','The First Watch']){
    await page.locator('[data-intro="next"]').click();
    await expect(page.locator('#prologue-speaker')).toHaveText(name);
  }
  await page.locator('[data-intro="next"]').click();
  await expect.poll(async()=>(await snapshot(page)).mode).toBe('explore');
  const expected={name:'Rowan',job:'spellblade',pronouns:'he',skin:'deep',hair:'silver',cloak:'plum',hairStyle:'tied'};
  expect((await snapshot(page)).profile).toEqual(expected);
  await expect(page.locator('[data-hero="Mara"] .hero-name')).toContainText('Rowan');
  await page.reload();await resume(page);
  expect((await snapshot(page)).profile).toEqual(expected);
  expect((await snapshot(page)).heroes[0].job).toBe('spellblade');
  expect(errors).toEqual([]);
});

test('custom jobs control the lead hero spell menu',async({page})=>{
  await newAdventure(page,{name:'Sable',job:'mender'});
  await visit(page,14,9,s=>s.flags.briefed);await dismissMessages(page);
  await visit(page,28,8,s=>s.area==='works');await dismissMessages(page);
  await visit(page,6,13,s=>s.mode==='battle');
  await plan(page,'Mara','spell','Mara','mend');
  expect((await snapshot(page)).battle?.plans.Mara).toMatchObject({type:'spell',spellId:'mend',target:'Mara'});
  await page.screenshot({path:'test-results/custom-mender-battle.png',fullPage:true});
  await newAdventure(page,{name:'Flint',job:'striker'});
  await visit(page,14,9,s=>s.flags.briefed);await dismissMessages(page);
  await visit(page,28,8,s=>s.area==='works');await dismissMessages(page);
  await visit(page,6,13,s=>s.mode==='battle');
  await page.locator('[data-hero="Mara"]').click();
  await expect(page.locator('[data-command="magic"]')).toBeDisabled();
  expect((await snapshot(page)).heroes[0].job).toBe('striker');
  expect((await snapshot(page)).heroes[0].hits).toBeGreaterThanOrEqual(2);
});

test('classic encounters trigger from walking and off mode suppresses ordinary encounters',async({page})=>{
  await newAdventure(page,{encounters:'off'});
  await visit(page,14,9,s=>s.flags.briefed);await dismissMessages(page);
  await visit(page,28,8,s=>s.area==='works');await dismissMessages(page);
  for(const [x,y] of [[8,14],[8,10],[5,10],[8,14],[8,10],[5,10]])await visit(page,x,y,s=>s.player.x===x&&s.player.y===y);
  expect((await snapshot(page)).mode).toBe('explore');
  expect((await snapshot(page)).encounterSteps).toBe(0);
  await settings(page,'classic',3);
  for(const [x,y] of [[8,14],[8,10],[5,10],[8,14],[8,10],[5,10],[8,14],[8,10]]){
    await tile(page,x,y);
    await expect.poll(async()=>{const s=await snapshot(page);return s.mode==='battle'||s.player.x===x&&s.player.y===y;},{timeout:15000}).toBe(true);
    if((await snapshot(page)).mode==='battle')break;
  }
  const state=await snapshot(page);
  expect(state.mode).toBe('battle');
  expect(state.settings.encounters).toBe('classic');
  expect(state.battle?.encounterId).toMatch(/^encounter[1-6]$/);
  expect(state.settings.battleSpeed).toBe(3);
  for(const hero of state.heroes)if(hero.hp>0)await plan(page,hero.id,'guard');
  await page.locator('[data-command="resolve"]').click();
  await expect.poll(async()=>(await snapshot(page)).battle?.phase).toBe('planning');
  await page.locator('[data-command="repeat"]').click();
  expect(Object.values((await snapshot(page)).battle!.plans).every(action=>action?.type==='guard')).toBe(true);
  expect(Object.keys((await snapshot(page)).battle!.plans)).toHaveLength(4);
});

test('battle menus support arrow keys, confirmation, and backing out of targeting',async({page})=>{
  await newAdventure(page);
  await visit(page,14,9,s=>s.flags.briefed);await dismissMessages(page);
  await visit(page,28,8,s=>s.area==='works');await dismissMessages(page);
  await visit(page,6,13,s=>s.mode==='battle');
  await page.locator('[data-hero="Iona"]').click();
  await page.locator('[data-command="magic"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-spell="mend"]')).toBeVisible();
  await page.locator('[data-spell="mend"]').focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('[data-spell="shelter"]')).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('[data-spell="mend"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-target="Mara"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-target="Mara"]')).toHaveCount(0);
  await expect(page.locator('[data-command="attack"]')).toBeVisible();
});

test('mobile character creation stays within the viewport',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');
  await page.screenshot({path:'test-results/title-mobile.png',fullPage:true});
  await page.locator('[data-front="new"]').click();
  await expect(page.locator('[data-custom="pronouns"]')).toHaveCount(2);
  await expect(page.locator('[data-custom="pronouns"][data-value="they"]')).toHaveCount(0);
  await page.locator('#hero-name').fill('   ');
  await expect(page.locator('[data-front="next"]')).toBeDisabled();
  await page.locator('#hero-name').fill('Nia');
  await expect(page.locator('[data-front="next"]')).toBeEnabled();
  await page.locator('[data-front="next"]').click();
  await page.locator('[data-job="scout"]').click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/jobs-mobile.png',fullPage:true});
  await page.locator('[data-front="next"]').click();
  await page.locator('[data-custom="cloak"][data-value="blue"]').click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/appearance-mobile.png',fullPage:true});
  await page.locator('[data-front="begin"]').click();
  await expect(page.locator('[data-intro="next"]')).toBeVisible();
  await page.screenshot({path:'test-results/prologue-mobile.png',fullPage:true});
});

test('classic party menus expose status, field magic, and an observational world map',async({page})=>{
  await newAdventure(page);
  await page.locator('#game-world canvas').focus();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading',{name:'Party',exact:true})).toBeVisible();
  await expect(page.locator('.menu-party-row')).toHaveCount(4);
  const style=await page.locator('.party-menu-modal').evaluate(element=>{
    const css=getComputedStyle(element);
    return {background:css.backgroundImage,border:css.borderTopWidth,color:css.color};
  });
  expect(style.background).toContain('gradient');expect(style.border).toBe('3px');expect(style.color).not.toBe('rgb(0, 0, 0)');
  await page.screenshot({path:'test-results/classic-menu-desktop.png',fullPage:true});
  await page.locator('.classic-menu-options [data-panel="status"]').click();
  await expect(page.getByRole('heading',{name:'Status',exact:true})).toBeVisible();
  await expect(page.locator('.status-stats')).toContainText('Next level');
  await expect(page.locator('.charge-table > div')).toHaveCount(8);
  await page.keyboard.press('Escape');
  await page.locator('.classic-menu-options [data-panel="magic"]').click();
  await page.locator('[data-pack-hero="Iona"]').click();
  const before=await snapshot(page);
  await page.locator('[data-field-spell="mend"]').click();
  await expect(page.locator('[data-field-target]')).toHaveCount(4);
  await page.locator('[data-field-target="Mara"]').click();
  expect((await snapshot(page)).heroes[2].charges).toEqual(before.heroes[2].charges);
  await page.locator('[data-close]').click();
  await page.locator('#game-world canvas').focus();await page.keyboard.press('m');
  await expect(page.getByRole('img',{name:'World map of Avel with the party marked by a white diamond'})).toBeVisible();
  await expect(page.locator('.atlas-places > div')).toHaveCount(6);
  expect((await snapshot(page)).player).toEqual(before.player);
  await page.screenshot({path:'test-results/world-map-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/world-map-mobile.png',fullPage:true});
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading',{name:'Party',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/classic-menu-mobile.png',fullPage:true});
});

test('an earlier saved character migrates without losing identity or supplies',async({page})=>{
  await newAdventure(page,{name:'Ember',pronouns:'he',job:'scout'});
  const original=await snapshot(page);
  const legacy=JSON.parse(JSON.stringify(original));
  legacy.version=2;
  for(const field of ['campaign','safeReturn','overworldReturn','messageQueue','hunts'])delete legacy[field];
  // This fixture changes only the storage schema; HP, EXP and items come from play.
  await page.evaluate(save=>localStorage.setItem('avel-demo-v1',JSON.stringify(save)),legacy);
  await page.reload();await resume(page);
  const loaded=await snapshot(page);
  expect(loaded.version).toBe(3);expect(loaded.profile).toEqual(original.profile);
  expect(loaded.heroes).toEqual(original.heroes);expect(loaded.inventory).toEqual(original.inventory);
  expect(loaded.campaign.stage).toBe(0);expect(loaded.xp).toBe(original.xp);
  // Opening and canceling creation must keep the migrated journey available.
  await page.locator('[data-panel="help"]').first().click();
  await page.locator('[data-front="title"]').click();
  await page.locator('[data-front="new"]').click();
  await page.locator('#hero-name').fill('Unconfirmed');
  await page.locator('[data-front="cancel"]').first().click();
  await page.locator('[data-front="continue"]').click();
  expect((await snapshot(page)).profile.name).toBe('Ember');
});
