import { test, expect, type Page } from '@playwright/test';
import type { GameState, HeroId } from '../src/contracts';

type Viewport = { area:string; tile:number; ox:number; oy:number; scrollX:number; scrollY:number; zoom:number; width:number; height:number };
const snapshot = (page:Page) => page.evaluate(() => (window as unknown as {__AVEL__:{snapshot():GameState}}).__AVEL__.snapshot());
const viewport = (page:Page) => page.evaluate(() => (window as unknown as {__AVEL__:{viewport():Viewport}}).__AVEL__.viewport());

async function dismiss(page:Page) {
  for(let i=0;i<30&&await page.locator('[data-command="dismiss"]').count();i++)await page.locator('[data-command="dismiss"]').click();
  expect((await snapshot(page)).message).toBeNull();
}
async function configure(page:Page,encounters:'classic'|'visible'|'off') {
  await page.locator('[data-panel="help"]').first().click();
  await page.locator(`[data-encounters="${encounters}"]`).click();
  await page.locator('[data-speed="3"]').click();
  await page.locator('[data-close]').click();
}
async function clickTile(page:Page,x:number,y:number) {
  const box=await page.locator('#game-world canvas').boundingBox();
  if(!box)throw Error('The playfield is not visible');
  const view=await viewport(page);
  const screenX=(view.ox+(x+.5)*view.tile-view.scrollX)*view.zoom;
  const screenY=(view.oy+(y+1)*view.tile-2-view.scrollY)*view.zoom;
  expect(screenX,`Tile ${x},${y} must be inside the following camera`).toBeGreaterThan(0);
  expect(screenX).toBeLessThan(960);
  expect(screenY).toBeGreaterThan(0);
  expect(screenY).toBeLessThan(576);
  await page.mouse.click(box.x+screenX/960*box.width,box.y+screenY/576*box.height);
}
async function visit(page:Page,x:number,y:number,done:(s:GameState)=>boolean) {
  await dismiss(page);
  await clickTile(page,x,y);
  await expect.poll(async()=>done(await snapshot(page)),{timeout:20_000}).toBe(true);
}
const at=(x:number,y:number)=>(s:GameState)=>s.player.x===x&&s.player.y===y;
async function plan(page:Page,hero:HeroId,type:'attack'|'guard'|'spell'|'item',target?:string,id?:string) {
  await page.locator(`[data-hero="${hero}"]`).click();
  await page.locator(`[data-command="${type==='spell'?'magic':type==='item'?'items':type}"]`).click();
  if(type==='spell')await page.locator(`[data-spell="${id}"]`).click();
  if(type==='item')await page.locator(`[data-battle-item="${id??'POTION'}"]`).click();
  if(target)await page.locator(`[data-target="${target}"]`).click();
}
async function collect(page:Page) {
  await dismiss(page);
  const state=await snapshot(page);
  expect(state.mode).toBe('victory');
  if(state.reward?.choices.length)await page.locator(`[data-claim="${state.reward.choices[0]}"]`).click();
  await page.locator('[data-command="continue"]').click();
  await dismiss(page);
}
async function battle(page:Page,capture?:string) {
  for(let round=0;round<60;round++) {
    const state=await snapshot(page);
    if(state.mode!=='battle')break;
    expect(state.battle?.phase).toBe('planning');
    const fight=state.battle!;
    const enemy=fight.enemies.find(e=>e.hp>0)!;
    const wounded=state.heroes.filter(h=>h.hp>0).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
    for(const hero of state.heroes) {
      if(hero.hp<=0||hero.status==='sleep')continue;
      if(fight.kind!=='normal'&&fight.round%2===0)await plan(page,hero.id,'guard');
      else if(hero.id==='Iona'&&wounded.hp<wounded.maxHp*.65&&hero.charges[0]&&hero.status!=='silence')await plan(page,hero.id,'spell',wounded.id,'mend');
      else if(hero.id==='Iona'&&wounded.hp<wounded.maxHp*.4&&(state.inventory.POTION??0)>0)await plan(page,hero.id,'item',wounded.id,'POTION');
      else if(hero.id==='Soren'&&hero.charges[0]&&hero.status!=='silence')await plan(page,hero.id,'spell',enemy.id,enemy.weakness.includes('frost')?'frost':enemy.weakness.includes('lightning')?'spark':'ember');
      else await plan(page,hero.id,'attack',enemy.id);
    }
    if(round===0&&capture)await page.screenshot({path:capture,fullPage:true});
    await expect(page.locator('[data-command="resolve"]')).toBeEnabled();
    await page.locator('[data-command="resolve"]').click();
    await expect.poll(async()=>{const s=await snapshot(page);return s.mode!=='battle'||s.battle?.phase==='planning';},{timeout:15_000}).toBe(true);
  }
  await collect(page);
}
async function rest(page:Page) {
  await page.locator('[data-command="rest"]').click();
  await dismiss(page);
  expect((await snapshot(page)).heroes.every(h=>h.hp===h.maxHp&&h.charges.every((n,i)=>n===h.maxCharges[i]))).toBe(true);
}
async function enterTown(page:Page) {
  await visit(page,8,21,at(8,21));
  await visit(page,8,20,s=>s.area==='dunmere');
}
async function buyEquipment(page:Page) {
  await visit(page,10,12,s=>s.message?.speaker==='Quartermaster');
  const priorities=['R02_MARA_WEAPON','R02_TAVIN_WEAPON','R02_SOREN_WEAPON','R02_IONA_BODY','R02_SOREN_BODY','R02_MARA_BODY','R02_TAVIN_BODY','R02_IONA_WEAPON'];
  const bought:string[]=[];
  for(const id of priorities) {
    if((await snapshot(page)).inventory[id])continue;
    const button=page.locator(`[data-buy="${id}"]`);
    if(await button.count()&&await button.isEnabled()&&(await snapshot(page)).gold>265){await button.click();bought.push(id);}
  }
  await dismiss(page);
  if(!bought.length)return;
  await page.locator('#pack-button').click();
  for(const id of bought) {
    const hero=id.split('_')[1];
    const heroId=hero[0]+hero.slice(1).toLowerCase();
    await page.locator(`[data-pack-hero="${heroId}"]`).click();
    await page.locator(`[data-equip="${id}"]`).click();
  }
  await page.locator('[data-close]').click();
}

test('a continuous road journey rescues Orren and Neri and opens the Alder Fen ferry',async({page})=>{
  test.setTimeout(900_000);
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');await page.locator('[data-front="new"]').click();
  await page.locator('#hero-name').fill('Lyra');
  await page.locator('[data-custom="pronouns"][data-value="she"]').click();
  await page.locator('[data-front="next"]').click();
  await page.locator('[data-job="warden"]').click();
  await page.locator('[data-front="next"]').click();
  await page.locator('[data-front="begin"]').click();
  await page.locator('[data-intro="skip"]').click();
  await configure(page,'visible');
  await visit(page,28,14,s=>Boolean(s.message));
  expect((await snapshot(page)).area).toBe('camp');
  await expect(page.locator('.dialogue-text')).toContainText('Orren');
  await dismiss(page);
  await visit(page,14,9,s=>s.flags.briefed);await dismiss(page);
  await visit(page,28,8,s=>s.area==='works');
  for(const [x,y] of [[6,13],[6,6],[13,11],[16,4],[25,12],[25,6]]) {
    await visit(page,x,y,s=>s.mode==='battle');await battle(page);
    await visit(page,2,15,s=>s.area==='camp');await rest(page);
    await visit(page,28,8,s=>s.area==='works');
  }
  await visit(page,16,13,s=>s.mode==='victory');await collect(page);
  await visit(page,27,3,s=>s.mode==='battle');await battle(page,'test-results/boss-desktop.png');
  expect((await snapshot(page)).campaign.stage).toBe(1);
  expect((await snapshot(page)).heroes.every(h=>h.level===5)).toBe(true);
  await visit(page,2,15,s=>s.area==='camp');
  await visit(page,14,9,s=>s.campaign.stage===2);await dismiss(page);
  expect((await snapshot(page)).mode).toBe('explore');
  expect((await snapshot(page)).flags.completed).toBe(false);
  await rest(page);
  await configure(page,'off');
  await visit(page,28,14,s=>s.area==='overworld');
  const south=await viewport(page);expect(south.height).toBeGreaterThan(576);expect(south.scrollY).toBeGreaterThan(0);
  await page.screenshot({path:'test-results/overworld-south.png',fullPage:true});
  await visit(page,8,29,at(8,29));
  await visit(page,8,27,at(8,25));
  await visit(page,8,21,at(8,21));
  expect((await viewport(page)).scrollY).toBeLessThan(south.scrollY);
  await page.screenshot({path:'test-results/overworld-salt-road.png',fullPage:true});
  await visit(page,23,21,s=>Boolean(s.message));
  expect((await snapshot(page)).player.x).toBeLessThan(24);
  await expect(page.locator('.dialogue-text')).toContainText('Neri');await dismiss(page);
  await enterTown(page);
  await configure(page,'classic');
  const beforeTown=(await snapshot(page)).campaign.wildBattles;
  for(const [x,y] of [[8,14],[20,14],[8,14],[20,14]])await visit(page,x,y,at(x,y));
  expect((await snapshot(page)).campaign.wildBattles).toBe(beforeTown);
  expect((await snapshot(page)).encounterSteps).toBe(0);
  await visit(page,28,8,s=>Boolean(s.message));
  expect((await snapshot(page)).area).toBe('dunmere');await dismiss(page);
  await visit(page,14,9,s=>s.campaign.stage===3);await dismiss(page);
  await buyEquipment(page);await rest(page);
  await configure(page,'off');
  await visit(page,2,14,s=>s.area==='overworld');
  // Training uses ordinary walking encounters and paid inns, with no edited stats.
  let trained=0;
  while((await snapshot(page)).heroes[0].level<9) {
    expect(trained++).toBeLessThan(12);
    await configure(page,'classic');
    for(let leg=0;leg<8&&(await snapshot(page)).mode==='explore';leg++) {
      const x=leg%2?8:18;
      await clickTile(page,x,21);
      await expect.poll(async()=>{const s=await snapshot(page);return s.mode==='battle'||at(x,21)(s);},{timeout:20_000}).toBe(true);
    }
    const encounter=await snapshot(page);
    expect(encounter.mode).toBe('battle');expect(encounter.battle?.regionId).toBe('R02');
    await battle(page,trained===1?'test-results/salt-road-battle.png':undefined);
    await configure(page,'off');await enterTown(page);
    await rest(page);await buyEquipment(page);
    await visit(page,2,14,s=>s.area==='overworld');
  }
  await enterTown(page);await rest(page);
  await visit(page,28,8,s=>s.area==='tollhouse');
  await visit(page,26,5,s=>Boolean(s.message));
  expect((await snapshot(page)).campaign.stage).toBe(3);await dismiss(page);
  await visit(page,27,3,s=>s.mode==='battle');
  expect((await snapshot(page)).battle?.encounterId).toBe('B_R02_TOLL');
  await battle(page,'test-results/toll-collector-battle.png');
  expect((await snapshot(page)).campaign.switches).toContain('toll_defeated');
  await visit(page,26,5,s=>s.campaign.stage===4);await dismiss(page);
  expect((await snapshot(page)).campaign.switches).toContain('neri_rescued');
  await visit(page,2,14,s=>s.area==='overworld');
  await visit(page,23,21,s=>s.player.x===26&&s.player.y===21);
  await visit(page,28,22,s=>s.area==='fen');
  await page.screenshot({path:'test-results/alder-fen-arrival.png',fullPage:true});
  const saved=await snapshot(page);
  await page.reload();await page.locator('[data-front="continue"]').click();await dismiss(page);
  const loaded=await snapshot(page);
  expect(loaded.area).toBe('fen');expect(loaded.campaign).toEqual(saved.campaign);
  expect(loaded.profile.name).toBe('Lyra');expect(loaded.xp).toBe(saved.xp);
  expect(loaded.flags.completed).toBe(false);expect(errors).toEqual([]);
});
