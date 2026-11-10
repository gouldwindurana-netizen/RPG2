import { test, expect, type Page } from '@playwright/test';
import type { GameState, HeroId } from '../src/contracts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const snapshot = (page: Page) => page.evaluate(() => (window as unknown as { __AVEL__: { snapshot(): GameState } }).__AVEL__.snapshot());
async function dismissMessages(page: Page) {
  for (let i = 0; i < 5 && await page.locator('[data-command="dismiss"]').count(); i++) {
    await page.locator('[data-command="dismiss"]').click();
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

test('expedition plays through camp, spell combat, save/reload, rescue, and ending', async ({ page }) => {
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('#game-world canvas')).toBeVisible();
  await dismissMessages(page);
  await page.screenshot({ path: 'test-results/camp-desktop.png', fullPage:true });
  await visit(page,14,9,s=>s.flags.briefed);
  await dismissMessages(page);
  await visit(page,28,8,s=>s.area==='works');
  await dismissMessages(page);
  await page.screenshot({ path:'test-results/works-desktop.png',fullPage:true });
  const enemies=[[6,13],[6,6],[13,11],[16,4],[25,12],[25,6]];
  for (let i=0;i<enemies.length;i++) {
    const [x,y]=enemies[i];
    await visit(page,x,y,s=>s.mode==='battle');
    await finishBattle(page,i===0?'test-results/battle-desktop.png':undefined);
    console.log(`Completed ordinary encounter ${i+1}/6 through UI`);
    if(i===0){
      expect((await snapshot(page)).xp).toBe(28);
      await page.reload();await dismissMessages(page);
      expect((await snapshot(page)).cleared).toContain('encounter1');
      expect((await snapshot(page)).xp).toBe(28);
    }
    // Recovery uses the same visible walk and camp action available to players.
    await visit(page,2,15,s=>s.area==='camp');
    await page.locator('[data-command="rest"]').click();await dismissMessages(page);
    expect((await snapshot(page)).heroes.every(h=>h.hp===h.maxHp)).toBe(true);
    await visit(page,28,8,s=>s.area==='works');await dismissMessages(page);
  }
  await visit(page,16,13,s=>s.mode==='victory');
  const chest=await snapshot(page);await page.locator(`[data-claim="${chest.reward!.choices[0]}"]`).click();
  await page.locator('[data-command="continue"]').click();
  await visit(page,27,3,s=>s.mode==='battle');
  await finishBattle(page,'test-results/boss-desktop.png');
  expect((await snapshot(page)).flags.bossDefeated).toBe(true);
  expect((await snapshot(page)).heroes.every(h=>h.level===5)).toBe(true);
  await visit(page,2,15,s=>s.area==='camp');await dismissMessages(page);
  await visit(page,14,9,s=>s.mode==='ending');
  await expect(page.getByRole('heading',{name:'Ring. Someone will come.'})).toBeVisible();
  await page.screenshot({path:'test-results/ending-desktop.png',fullPage:true});
  await page.locator('[data-command="continue"]').click();await dismissMessages(page);
  expect((await snapshot(page)).flags.completed).toBe(true);
  expect((await snapshot(page)).rareReady).toBe(true);
  expect(errors).toEqual([]);
});

test('mobile is playable and menus remain within viewport', async ({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');await dismissMessages(page);
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
  await page.goto('/');await dismissMessages(page);
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
  await dismissMessages(page);
  expect((await snapshot(page)).heroes.length).toBe(4);
  expect(errors).toEqual([]);
  expect(unexpected).toEqual([]);
});
