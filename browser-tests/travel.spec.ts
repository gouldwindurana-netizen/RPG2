import {test,expect,type Page} from '@playwright/test';
import type {GameState,GameMap} from '../src/contracts';

const currentMap=(page:Page)=>page.evaluate(()=>(window as unknown as {__AVEL__:{map():GameMap}}).__AVEL__.map());
type Viewport={area:string;tile:number;ox:number;oy:number;scrollX:number;scrollY:number;zoom:number;transitioning?:boolean};
const snapshot=(page:Page)=>page.evaluate(()=>(window as unknown as {__AVEL__:{snapshot():GameState}}).__AVEL__.snapshot());
const viewport=(page:Page)=>page.evaluate(()=>(window as unknown as {__AVEL__:{viewport():Viewport}}).__AVEL__.viewport());
const at=(x:number,y:number)=>(s:GameState)=>s.player.x===x&&s.player.y===y;
async function ready(page:Page){await expect.poll(async()=>!(await viewport(page)).transitioning).toBe(true);}
async function dismiss(page:Page){for(let i=0;i<30&&await page.locator('[data-command="dismiss"]').count();i++)await page.locator('[data-command="dismiss"]').click();}
async function configure(page:Page,mode:'classic'|'off'){
  await page.locator('[data-panel="help"]').first().click();
  await page.locator(`[data-encounters="${mode}"]`).click();await page.locator('[data-close]').click();
}
async function start(page:Page){
  await page.goto('http://127.0.0.1:5173/');await page.locator('[data-front="new"]').click();await page.locator('#hero-name').fill('Rin');
  await page.locator('[data-front="next"]').click();await page.locator('[data-front="next"]').click();
  await page.locator('[data-front="begin"]').click();await page.locator('[data-intro="skip"]').click();
  await ready(page);await configure(page,'off');
}
async function tile(page:Page,x:number,y:number,touch=false){
  await ready(page);const view=await viewport(page),box=await page.locator('#game-world canvas').boundingBox();if(!box)throw Error('Missing canvas');
  const px=box.x+(view.ox+(x+.5)*view.tile-view.scrollX)*view.zoom/960*box.width;
  const py=box.y+(view.oy+(y+1)*view.tile-2-view.scrollY)*view.zoom/576*box.height;
  if(touch)await page.touchscreen.tap(px,py);else await page.mouse.click(px,py);
}
async function visit(page:Page,x:number,y:number,done:(s:GameState)=>boolean,touch=false){
  await dismiss(page);await tile(page,x,y,touch);await expect.poll(async()=>done(await snapshot(page)),{timeout:20_000}).toBe(true);await ready(page);
}
async function entity(page:Page,id:string,done:(s:GameState)=>boolean,touch=false){
  const s=await snapshot(page),e=(await currentMap(page)).entities.find(e=>e.id===id);if(!e)throw Error(`Missing ${s.area}/${id}`);await visit(page,e.x,e.y,done,touch);
}
async function resume(page:Page){await page.locator('[data-front="continue"]').click();await dismiss(page);await ready(page);}

test('walking thresholds connect world, town, shop and inn without return loops',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await start(page);
  expect((await snapshot(page)).campaign.stage).toBe(0);
  await visit(page,27,14,at(27,14));await page.locator('#game-world canvas').focus();
  await page.keyboard.down('ArrowRight');await expect.poll(async()=>(await snapshot(page)).area).toBe('overworld');
  const arrived=await snapshot(page);await page.waitForTimeout(700);await page.keyboard.up('ArrowRight');
  expect((await snapshot(page)).player).toEqual(arrived.player);await ready(page);
  expect((await snapshot(page)).message).toBeNull();expect((await snapshot(page)).battle).toBeNull();
  await page.screenshot({path:'test-results/travel-world-desktop.png',fullPage:true});
  await visit(page,8,28,at(8,28));await page.locator('#game-world canvas').focus();await page.keyboard.press('ArrowUp',{delay:100});
  await expect.poll(async()=>!!(await snapshot(page)).message).toBe(true);
  expect((await snapshot(page)).area).toBe('overworld');expect((await snapshot(page)).player).toMatchObject({x:8,y:28});
  await expect(page.locator('.dialogue-text')).toContainText('Bessa');await dismiss(page);
  await entity(page,'enter-camp',s=>s.area==='camp');
  const outside=(await snapshot(page)).overworldReturn;
  await page.screenshot({path:'test-results/travel-town-desktop.png',fullPage:true});
  await entity(page,'door-camp-shop',s=>s.area==='camp-shop');
  await entity(page,'merchant',s=>s.message?.speaker==='Quartermaster');
  await expect(page.locator('[data-shop-filter="supplies"]')).toBeVisible();
  await page.locator('[data-shop-filter="weapons"]').click();await expect(page.locator('[data-buy="POTION"]')).toHaveCount(0);
  await page.screenshot({path:'test-results/travel-shop-desktop.png',fullPage:true});
  await page.locator('[data-shop-filter="supplies"]').click();
  const beforeBuy=await snapshot(page);await page.locator('[data-buy="POTION"]').click();
  expect((await snapshot(page)).inventory.POTION).toBe(beforeBuy.inventory.POTION+1);expect((await snapshot(page)).gold).toBe(beforeBuy.gold-30);
  await dismiss(page);const saved=await snapshot(page);await page.reload();await resume(page);
  expect((await snapshot(page)).area).toBe('camp-shop');expect((await snapshot(page)).inventory).toEqual(saved.inventory);
  expect((await snapshot(page)).overworldReturn).toEqual(outside);
  await visit(page,10,11,at(10,11));await page.locator('#game-world canvas').focus();await page.keyboard.press('ArrowDown',{delay:100});
  await expect.poll(async()=>(await snapshot(page)).area).toBe('camp');await ready(page);
  await entity(page,'door-camp-inn',s=>s.area==='camp-inn');
  await entity(page,'inn-R01',s=>s.message?.speaker==='Innkeeper');
  const beforeRest=await snapshot(page);await expect(page.locator('[data-command="rest"]')).toBeEnabled();
  await page.screenshot({path:'test-results/travel-inn-desktop.png',fullPage:true});
  await dismiss(page);expect((await snapshot(page)).gold).toBe(beforeRest.gold);
  await entity(page,'inn-R01',s=>s.message?.speaker==='Innkeeper');await page.locator('[data-command="rest"]').click();await dismiss(page);
  expect((await snapshot(page)).gold).toBe(beforeRest.gold);expect((await snapshot(page)).safeReturn.area).toBe('camp-inn');
  await configure(page,'classic');const wins=(await snapshot(page)).campaign.wildBattles;
  for(const [x,y]of [[8,10],[13,10],[8,10],[13,10]])await visit(page,x,y,at(x,y));
  expect((await snapshot(page)).campaign.wildBattles).toBe(wins);expect((await snapshot(page)).encounterSteps).toBe(0);
  await page.reload();await resume(page);expect((await snapshot(page)).area).toBe('camp-inn');
  await entity(page,'leave-camp-inn',s=>s.area==='camp');
  expect((await snapshot(page)).overworldReturn).toEqual(outside);
  await entity(page,'world-camp',s=>s.area==='overworld');
  const returned=await snapshot(page);expect(returned.player).toMatchObject(outside);expect(returned.mode).toBe('explore');
  await ready(page);await page.waitForTimeout(350);expect((await snapshot(page)).area).toBe('overworld');expect(errors).toEqual([]);
});

test('touch travel and local maps remain usable with reduced motion',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  const page=await context.newPage(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    await start(page);await visit(page,27,14,at(27,14),true);
    const right=await page.locator('[data-move="right"]').boundingBox();if(!right)throw Error('Missing touch direction control');
    await page.touchscreen.tap(right.x+right.width/2,right.y+right.height/2);
    await expect.poll(async()=>(await snapshot(page)).area).toBe('overworld');await ready(page);
    await entity(page,'enter-camp',s=>s.area==='camp',true);await entity(page,'door-camp-shop',s=>s.area==='camp-shop',true);
    await entity(page,'merchant',s=>s.message?.speaker==='Quartermaster',true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:'test-results/travel-shop-mobile.png',fullPage:true});await dismiss(page);
    await page.locator('[data-panel="localmap"]').first().click();await expect(page.locator('[aria-modal="true"]')).toContainText('Reedbank');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:'test-results/travel-local-map-mobile.png',fullPage:true});await page.locator('[data-close]').click();
    await entity(page,'leave-camp-shop',s=>s.area==='camp',true);await entity(page,'door-camp-inn',s=>s.area==='camp-inn',true);
    await entity(page,'inn-R01',s=>s.message?.speaker==='Innkeeper',true);
    await page.screenshot({path:'test-results/travel-inn-mobile.png',fullPage:true});await page.locator('[data-command="rest"]').click();await dismiss(page);
    await entity(page,'leave-camp-inn',s=>s.area==='camp',true);await entity(page,'world-camp',s=>s.area==='overworld',true);
    expect((await snapshot(page)).mode).toBe('explore');expect(errors).toEqual([]);
  }finally{await context.close();}
});
