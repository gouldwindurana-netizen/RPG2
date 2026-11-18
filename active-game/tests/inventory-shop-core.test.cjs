'use strict';

// Exercise the real catalog, copy counts and item engine through the new read-
// only helpers. Browser checks own layout, input and focus evidence.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const file = process.env.GAME_HTML || path.join(__dirname, '..', 'The_Road_Beyond_the_Bells.html');
const html = fs.readFileSync(file, 'utf8');
const start = html.indexOf('var l={schemaVersion'), end = html.indexOf('var De=new Set', start);
const plain = value => JSON.parse(JSON.stringify(value));
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);

function setup() {
  const c = vm.createContext({ structuredClone });
  vm.runInContext(html.slice(start, end), c, { timeout: 5000 });
  const supplyStart = html.indexOf('function supplyUseUI('), supplyEnd = html.indexOf('function focusBattleOption(', supplyStart);
  assert.ok(supplyStart > 0 && supplyEnd > supplyStart);
  vm.runInContext(html.slice(supplyStart, supplyEnd), c, { timeout: 3000 });
  c.Q = escape; c.Et = () => '<svg aria-hidden="true"></svg>'; c.at = () => 'Regional equipment'; c.$ = 'Mara';
  const game = c.Ee({ storage:null, seed:7321, roundDelay:0 });
  assert.equal(game.beginAdventure({...c.R,name:'Rowan',job:'warden'}),true); game.skipIntro();
  return {c,game,hero:game.state.heroes[0]};
}

test('equipment comparison includes lost stats and reports mixed trade-offs without changing ownership', () => {
  const {c,game,hero} = setup();
  game.state.inventory.QUEST_FIELD_SATCHEL = 1; hero.equipment.charm = 'QUEST_FIELD_SATCHEL';
  const before = JSON.stringify(game.state);
  const comparison = c.gearComparison(game.state,'R02_COMMON_CHARM','Mara');
  assert.equal(comparison.allowed,true);
  assert.equal(comparison.currentName,c.K('QUEST_FIELD_SATCHEL').name);
  assert.equal(comparison.kind,'tradeoff');
  assert.deepEqual(plain(comparison.changes),[{key:'magicDefense',delta:1},{key:'magic',delta:-1}]);
  const markup = c.shopComparisonUI(game.state,'R02_COMMON_CHARM','Mara');
  assert.match(markup,/Trade-off/); assert.match(markup,/MDEF \+1/); assert.match(markup,/MAG -1/);
  assert.equal(JSON.stringify(game.state),before);
});

test('each of the five slots compares against that selected traveler and reports real worn-copy counts', () => {
  const {c,game} = setup();
  for (const [slot,id] of [['weapon','R01_IONA_WEAPON'],['body','R01_IONA_BODY'],['head','R01_COMMON_HEAD'],['mantle','R01_COMMON_MANTLE'],['charm','R01_COMMON_CHARM']]) {
    const current = c.gearComparison(game.state,id,'Iona');
    assert.equal(current.heroName,'Iona'); assert.equal(current.currentId,game.state.heroes[2].equipment[slot]);
    assert.equal(current.kind,'equal'); assert.equal(current.allowed,true);
    assert.equal(current.owned,c.eqOwned(game.state,id)); assert.equal(current.equipped,c.eqUsed(game.state,id)); assert.equal(current.available,c.eqAvailable(game.state,id));
  }
  const wrong = c.gearComparison(game.state,'R01_MARA_WEAPON','Iona');
  assert.equal(wrong.allowed,false);
  assert.match(c.shopComparisonUI(game.state,'R01_MARA_WEAPON','Iona'),/Not usable by Iona \(Mender\)/);
});

test('recipient and slot filters keep only the requested usable stock without changing quantity or state', () => {
  const {c,game} = setup();
  game.state.message={speaker:'Weapon Shop',text:'Equipment for the road.'};
  c.shopUI(game.state); c.$='Iona'; c.shopGearSlot='weapon'; c.shopCompatibleOnly=true; c.shQ=5;
  const before = JSON.stringify(game.state), markup=c.shopUI(game.state);
  const ids = [...markup.matchAll(/data-shop-item="([^"]+)"/g)].map(match=>match[1]);
  assert.ok(ids.length>0);
  for (const id of ids) { assert.equal(c.K(id).slot,'weapon'); assert.equal(c.U(game.state.heroes[2],c.K(id)),true); }
  assert.ok(ids.includes('R01_IONA_WEAPON')); assert.ok(!ids.includes('R01_MARA_WEAPON'));
  assert.equal(c.shQ,5); assert.equal(JSON.stringify(game.state),before);
  c.shopCompatibleOnly=false;
  assert.match(c.shopUI(game.state),/Not usable by Iona/);
  assert.match(c.shopUI(game.state),/data-shop-qty="5"/);
});

test('purchase counts remain bounded by gold and pack capacity after recipient filtering', () => {
  const {c,game} = setup(); game.state.message={speaker:'Weapon Shop',text:'Equipment'};
  const offer=c.fe(game.state).find(offer=>offer.itemId==='R01_COMMON_HEAD'); assert.ok(offer);
  game.state.gold=offer.price*2; c.shQ='max';
  const markup=c.shopUI(game.state);
  assert.match(markup,/data-buy="R01_COMMON_HEAD"[^>]*>Buy ×2/);
  assert.equal(game.buy('R01_COMMON_HEAD','max'),2);
  assert.equal(game.state.gold,0);
  const resources=plain({inventory:game.state.inventory,gold:game.state.gold});
  assert.match(c.shopUI(game.state),/Not enough gold/);
  assert.equal(game.buy('R01_COMMON_HEAD',1),false);
  assert.deepEqual(plain({inventory:game.state.inventory,gold:game.state.gold}),resources);
});

for (const [id,amount] of [['POTION',60],['HIGH_POTION',250],['MENDING_BALM',120],['CAMP_MEAL',30]]) {
  test(`${id} preview matches actual capped HP recovery and never spends a full-health item`, () => {
    const {c,game,hero}=setup(); game.state.inventory[id]=2; hero.hp=43;
    const preview=c.fieldSupplyPreview(game.state,hero,id),beforeCount=game.state.inventory[id];
    assert.equal(preview.available,true); assert.equal(preview.before,43);
    assert.equal(preview.after,Math.min(hero.maxHp,43+amount)); assert.equal(preview.gain,preview.after-43);
    assert.equal(preview.unused,amount-preview.gain); assert.match(preview.label,/HP 43 \/ 100 →/);
    assert.equal(game.useItem(id,'Mara'),true); assert.equal(hero.hp,preview.after); assert.equal(game.state.inventory[id],beforeCount-1);
    hero.hp=hero.maxHp; const count=game.state.inventory[id];
    assert.equal(c.fieldSupplyPreview(game.state,hero,id).available,false);
    assert.equal(game.useItem(id,'Mara'),false); assert.equal(game.state.inventory[id],count);
  });
}

for (const [id,amount] of [['SPARK_TEA',20],['DEEP_TEA',60]]) {
  test(`${id} preview matches MP restoration and remains explicit about overflow`, () => {
    const {c,game,hero}=setup(); game.state.inventory[id]=2; hero.mp=2;
    const preview=c.fieldSupplyPreview(game.state,hero,id);
    assert.equal(preview.before,2); assert.equal(preview.after,hero.maxMp);
    assert.equal(preview.gain,hero.maxMp-2); assert.equal(preview.unused,amount-preview.gain);
    assert.match(preview.label,/MP 2 \/ 12 → 12 \/ 12/);
    assert.equal(game.useItem(id,'Mara'),true); assert.equal(hero.mp,preview.after);
    const count=game.state.inventory[id]; assert.equal(game.useItem(id,'Mara'),false); assert.equal(game.state.inventory[id],count);
  });
}

test('condition and revival previews follow actual eligibility without promising a cure on revival', () => {
  const {c,game,hero}=setup(); hero.status='poison';
  assert.match(c.fieldSupplyPreview(game.state,hero,'ANTIDOTE').label,/Poison → Cleared/);
  assert.equal(game.useItem('ANTIDOTE','Mara'),true); assert.equal(hero.status,null);
  assert.equal(c.fieldSupplyPreview(game.state,hero,'ANTIDOTE').available,false);
  hero.hp=0; hero.status='poison';
  const revival=c.fieldSupplyPreview(game.state,hero,'REVIVAL_SALT');
  assert.equal(revival.available,true); assert.equal(revival.after,20);
  assert.equal(game.useItem('REVIVAL_SALT','Mara'),true); assert.equal(hero.hp,20); assert.equal(hero.status,'poison');
  assert.equal(c.fieldSupplyPreview(game.state,hero,'REVIVAL_SALT').available,false);
});

test('inventory renders live selected-recipient HP and MP, exact previews and all original slots', () => {
  const {c,game,hero}=setup(); hero.hp=43; hero.mp=2; game.state.inventory.SPARK_TEA=1;
  const before=JSON.stringify(game.state),markup=c.inventoryBodyUI(game.state,'Mara');
  assert.match(markup,/data-inventory-target="Mara"/); assert.match(markup,/43 \/ 100 HP · 2 \/ 12 MP/);
  assert.match(markup,/data-recovery-preview="POTION">HP 43 \/ 100 → 100 \/ 100 \(\+57\) · 3 healing unused/);
  for(const slot of ['weapon','body','head','mantle','charm'])assert.match(markup,new RegExp(`data-eq-slot="${slot}"`));
  for(const view of ['all','equipment','supplies'])assert.match(markup,new RegExp(`data-pack-view="${view}"`));
  assert.equal(JSON.stringify(game.state),before);
  c.packView='supplies';
  assert.match(c.inventoryBodyUI(game.state,'Mara'),/class="inventory-equipment" hidden/);
});

test('customized names remain escaped in shop comparisons and live inventory summaries', () => {
  const {c,game,hero}=setup(); hero.name='<img src=x onerror=alert(1)>';
  const markup=c.shopComparisonUI(game.state,'R01_MARA_WEAPON','Mara')+c.inventoryTargetUI(hero);
  assert.match(markup,/&lt;img/); assert.ok(!markup.includes('<img'));
});
