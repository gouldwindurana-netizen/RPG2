'use strict';
// Test actual shipped engine behavior. Explicit level and inventory fixtures
// isolate migration/job/resource rules; these are not campaign playthroughs.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.GAME_HTML || path.join(root, 'The_Road_Beyond_the_Bells.html'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
function context(source = html) {
  const c = vm.createContext({ structuredClone });
  vm.runInContext(source.slice(source.indexOf('var l={schemaVersion'), source.indexOf('var De=new Set')), c, { timeout: 5000 });
  return c;
}
function setup(job = 'warden', jobs) {
  const c = context(), saves = new Map();
  const storage = { getItem: key => saves.get(key) ?? null, setItem: (key, value) => saves.set(key, String(value)) };
  const game = c.Ee({ storage, seed: 7321, roundDelay: 0 });
  assert.equal(game.beginAdventure({ ...c.R, name: 'Rowan', job }, jobs), true);
  game.skipIntro(); game.configure({ encounters: 'off' });
  return { c, game, storage, saved: () => JSON.parse(saves.get(c.G)), reload: () => c.Ee({ storage, seed: 7321, roundDelay: 0 }) };
}
const hero = (game, id) => game.state.heroes.find(hero => hero.id === id);
function level(fix, id, value) {
  const old = hero(fix.game, id);
  fix.game.state.hx[id] = fix.c.l.xp_thresholds[value - 1];
  fix.game.state.heroes[fix.game.state.heroes.indexOf(old)] = fix.c.be(id, value, old.equipment, fix.game.state.profile, old.job);
}
function dismiss(game) { while (game.state.message) game.dismiss(); }

test('all six jobs can be chosen for all four heroes with compatible owned starting gear and basic skills', () => {
  const ids = ['Mara','Tavin','Iona','Soren'];
  for (const job of ['warden','striker','scout','spellblade','mender','arcanist']) {
    const jobs = Object.fromEntries(ids.map(id => [id, job])), fix = setup(job, jobs);
    assert.equal(fix.game.state.version, 4);
    assert.deepEqual(plain(fix.game.state.partyJobs), jobs);
    for (const h of fix.game.state.heroes) {
      assert.equal(h.job, job); assert.equal(h.mp, fix.c.maxMana(job, 1)); assert.equal(h.maxMp, h.mp);
      assert.ok(h.mp > 0); assert.ok(fix.game.state.learnedSpells[h.id].length > 0);
      for (const id of Object.values(h.equipment)) assert.equal(fix.c.U(h, fix.c.K(id)), true);
      for (const id of fix.game.state.learnedSpells[h.id]) assert.equal(fix.c.knowsSpell(fix.game.state, h, fix.c.te.find(skill => skill.id === id)), true);
    }
    const restored = fix.reload();
    assert.equal(restored.state.mode, 'explore'); assert.deepEqual(plain(restored.state.partyJobs), jobs);
    assert.deepEqual(plain(restored.state.heroes), plain(fix.game.state.heroes));
  }
});

test('job previews are read-only and every party member can change among all jobs without refilling resources', () => {
  const fix = setup();
  for (const h of fix.game.state.heroes) { h.hp = Math.floor(h.maxHp / 2); h.mp = 3; h.status = 'poison'; }
  const resources = plain({ gold: fix.game.state.gold, inventory: fix.game.state.inventory, hx: fix.game.state.hx });
  for (const id of ['Mara','Tavin','Iona','Soren']) for (const job of ['warden','striker','scout','spellblade','mender','arcanist']) {
    const before = JSON.stringify(fix.game.state), old = plain(hero(fix.game, id));
    const preview = fix.c.jobChangePreview(fix.game.state, id, job);
    assert.equal(JSON.stringify(fix.game.state), before);
    if (old.job === job) { assert.equal(preview.available, false); continue; }
    const others = plain(fix.game.state.heroes.filter(h => h.id !== id));
    assert.equal(fix.game.changeJob(id, job), true);
    const current = hero(fix.game, id);
    assert.equal(current.job, job); assert.equal(current.hp, Math.min(old.hp, current.maxHp));
    assert.equal(current.mp, Math.min(old.mp, current.maxMp)); assert.equal(current.status, 'poison');
    assert.deepEqual(plain(fix.game.state.heroes.filter(h => h.id !== id)), others);
    for (const value of Object.values(current.equipment)) if (value !== null) assert.equal(fix.c.U(current, fix.c.K(value)), true);
  }
  assert.deepEqual(plain({ gold: fix.game.state.gold, inventory: fix.game.state.inventory, hx: fix.game.state.hx }), resources);
  assert.equal(fix.game.state.profile.job, fix.game.state.partyJobs.Mara);
});

test('job changes cannot start during actions, away from shelters, or with invalid heroes/jobs', () => {
  for (const mutate of [state => { state.message = { speaker:'Tavin', text:'Wait.' }; }, state => { state.messageQueue.push({ speaker:'Tavin',text:'Wait.' }); }, state => { state.reward = { choices:[] }; }, state => { state.mode = 'battle'; state.battle = {}; }, state => { state.area='works-depth-2'; state.player={x:4,y:18,facing:'right'}; }]) {
    const fix=setup(); mutate(fix.game.state); const before=JSON.stringify(fix.game.state);
    assert.equal(fix.game.changeJob('Tavin','mender'), false); assert.equal(JSON.stringify(fix.game.state), before);
  }
  const fix=setup(), before=JSON.stringify(fix.game.state);
  assert.equal(fix.game.changeJob('Nobody','scout'),false); assert.equal(fix.game.changeJob('Iona','unknown'),false);
  assert.equal(JSON.stringify(fix.game.state),before);
});

test('cycling between small and large MP pools cannot revive a fallen hero or regenerate spent mana',()=>{
  const fix=setup('arcanist');const h=hero(fix.game,'Mara');h.hp=0;h.mp=0;h.status='poison';
  const before=plain({gold:fix.game.state.gold,inventory:fix.game.state.inventory,hx:fix.game.state.hx});
  for(const job of ['striker','arcanist','scout','mender','warden','spellblade','arcanist']){
    assert.equal(fix.game.changeJob('Mara',job),true);
    const current=hero(fix.game,'Mara');assert.equal(current.hp,0);assert.equal(current.mp,0);assert.equal(current.status,'poison');
  }
  assert.deepEqual(plain({gold:fix.game.state.gold,inventory:fix.game.state.inventory,hx:fix.game.state.hx}),before);
  fix.game.save();const loaded=fix.reload();assert.equal(loaded.state.mode,'explore');
  assert.equal(hero(loaded,'Mara').hp,0);assert.equal(hero(loaded,'Mara').mp,0);
});

test('incompatible equipment returns to the pack, cannot borrow worn copies, and empty slots survive reload', () => {
  const fix=setup(), inventory=plain(fix.game.state.inventory), tavin=plain(hero(fix.game,'Tavin').equipment);
  assert.equal(fix.game.changeJob('Iona','scout'),true);
  assert.equal(hero(fix.game,'Iona').equipment.weapon,null); assert.equal(hero(fix.game,'Iona').equipment.body,null);
  assert.deepEqual(plain(hero(fix.game,'Tavin').equipment),tavin); assert.deepEqual(plain(fix.game.state.inventory),inventory);
  const loaded=fix.reload(); assert.equal(loaded.state.mode,'explore');
  assert.equal(hero(loaded,'Iona').job,'scout'); assert.equal(hero(loaded,'Iona').equipment.weapon,null);
  assert.deepEqual(plain(loaded.state.inventory),inventory);
});

test('job changes equip free compatible copies while preserving four worn charms and uniqueness', () => {
  const fix=setup(); fix.game.state.inventory.R02_COMMON_CHARM=4; fix.game.state.inventory.R01_TAVIN_WEAPON=2;
  for(const h of fix.game.state.heroes) assert.equal(fix.game.equip(h.id,'R02_COMMON_CHARM'),true);
  const before=plain(fix.game.state.inventory);
  assert.equal(fix.game.changeJob('Iona','scout'),true);
  assert.equal(hero(fix.game,'Iona').equipment.weapon,'R01_TAVIN_WEAPON');
  assert.equal(fix.c.eqUsed(fix.game.state,'R01_TAVIN_WEAPON'),2);
  assert.equal(fix.c.eqUsed(fix.game.state,'R02_COMMON_CHARM'),4);
  fix.game.optimize('all'); assert.deepEqual(plain(fix.game.state.inventory),before);
  const loaded=fix.reload(); assert.equal(loaded.state.mode,'explore');
  assert.equal(fix.c.eqUsed(loaded.state,'R02_COMMON_CHARM'),4); assert.equal(fix.c.eqUsed(loaded.state,'R01_TAVIN_WEAPON'),2);
});

test('purchased skills remain personal across jobs, buying never restores MP and wrong jobs cannot use them', () => {
  const fix=setup(); level(fix,'Mara',5); const h=hero(fix.game,'Mara'); h.mp=1; fix.game.state.gold=1000;
  fix.game.state.area='dunmere';
  const merchant=fix.c.he.dunmere.entities.find(entity=>entity.shopKind==='magic');
  fix.game.state.player={x:merchant.x,y:merchant.y+1,facing:'up'};
  fix.game.state.message={speaker:'Skill Shop',text:'Learn.'};
  const offer=fix.c.skillOffers(fix.game.state,'Mara').find(row=>row.skillId==='rally');
  assert.ok(offer); assert.equal(offer.unlocked,true); assert.equal(fix.game.buySkill('Mara','rally'),true);
  assert.equal(h.mp,1); assert.equal(fix.game.state.gold,1000-offer.price); assert.equal(fix.game.buySkill('Mara','rally'),false);
  dismiss(fix.game); assert.equal(fix.game.changeJob('Mara','striker'),true);
  const skill=fix.c.te.find(skill=>skill.id==='rally');
  assert.equal(fix.c.hasLearnedSkill(fix.game.state,hero(fix.game,'Mara'),skill),true);
  assert.equal(fix.c.knowsSpell(fix.game.state,hero(fix.game,'Mara'),skill),false);
  assert.equal(fix.game.changeJob('Mara','warden'),true);
  assert.equal(fix.c.knowsSpell(fix.game.state,hero(fix.game,'Mara'),skill),true); assert.equal(hero(fix.game,'Mara').mp,1);
  const loaded=fix.reload(); assert.equal(loaded.state.mode,'explore'); assert.ok(loaded.state.learnedSpells.Mara.includes('rally'));
});

test('Skill Shop purchases enforce regional stock, job and service while deprecated buySpell delegates safely', () => {
  const fix=setup(); fix.game.state.gold=10000;
  assert.equal(fix.game.buySkill('Mara','rally'),false);
  fix.game.state.message={speaker:'Skill Shop',text:'Learn.'};
  assert.equal(fix.game.buySkill('Mara','rally'),false); assert.equal(fix.game.buySkill('Iona','power-strike'),false);
  assert.equal(fix.game.buySkill('Nobody','mend'),false); assert.equal(fix.game.buySkill('Iona','unknown'),false);
  assert.equal(fix.game.buySpell('Iona','shelter'),true);
  assert.equal(hero(fix.game,'Iona').mp,hero(fix.game,'Iona').maxMp);
});

test('field recovery spends useful MP once, rejects empty pools, and silence affects magic but not techniques', () => {
  const fix=setup(), target=hero(fix.game,'Mara'), caster=hero(fix.game,'Iona'), skill=fix.c.te.find(skill=>skill.id==='mend');
  const start=caster.mp; assert.equal(fix.game.castField('Iona','mend','Mara'),false); assert.equal(caster.mp,start);
  target.hp-=15; assert.equal(fix.game.castField('Iona','mend','Mara'),true); assert.equal(caster.mp,start-fix.c.skillCost(skill));
  target.hp-=5; caster.mp=0; const hp=target.hp;
  assert.equal(fix.game.castField('Iona','mend','Mara'),false); assert.equal(target.hp,hp);
  caster.mp=caster.maxMp; caster.status='silence'; assert.equal(fix.game.castField('Iona','mend','Mara'),false);
  const warden=hero(fix.game,'Mara'); warden.status='silence';
  assert.equal(fix.c.canUseSkill(fix.game.state,warden,fix.c.te.find(skill=>skill.id==='shield-bash')),true);
  warden.status='sleep'; assert.equal(fix.c.canUseSkill(fix.game.state,warden,fix.c.te.find(skill=>skill.id==='shield-bash')),false);
});

test('MP teas recover capped mana without tiers and never disappear on full-MP or fallen targets', () => {
  const fix=setup(); level(fix,'Soren',33); const h=hero(fix.game,'Soren'); h.mp=0;
  fix.game.state.inventory.SPARK_TEA=2; fix.game.state.inventory.DEEP_TEA=2;
  assert.equal(fix.game.useItem('SPARK_TEA','Soren'),true); assert.equal(h.mp,20);
  assert.equal(fix.game.useItem('DEEP_TEA','Soren'),true); assert.equal(h.mp,80);
  h.mp=h.maxMp-3; assert.equal(fix.game.useItem('SPARK_TEA','Soren'),true); assert.equal(h.mp,h.maxMp);
  const remaining=fix.game.state.inventory.DEEP_TEA;
  assert.equal(fix.game.useItem('DEEP_TEA','Soren'),false); assert.equal(fix.game.state.inventory.DEEP_TEA,remaining);
  h.hp=0; h.mp=0; assert.equal(fix.game.useItem('DEEP_TEA','Soren'),false); assert.equal(fix.game.state.inventory.DEEP_TEA,remaining);
});

test('paid shelter recovery restores MP only when lodging can be paid', () => {
  const fix=setup(); fix.game.state.area='dunmere'; fix.game.state.player={x:11,y:10,facing:'right'};
  for(const h of fix.game.state.heroes){h.hp-=20;h.mp=0;h.status='poison';}
  fix.game.state.gold=19; fix.game.rest(); assert.ok(fix.game.state.heroes.every(h=>h.mp===0)); dismiss(fix.game);
  fix.game.state.gold=20; fix.game.rest(); assert.equal(fix.game.state.gold,0);
  assert.ok(fix.game.state.heroes.every(h=>h.hp===h.maxHp&&h.mp===h.maxMp&&h.status===null));
});

test('equipping does not refill MP, while earned level capacity growth is added only once', () => {
  const fix=setup(), h=hero(fix.game,'Mara'); h.mp=2;
  fix.game.state.inventory.R02_COMMON_HEAD=1; fix.game.state.inventory.R03_COMMON_HEAD=1;
  assert.equal(fix.game.equip('Mara','R02_COMMON_HEAD'),true); assert.equal(hero(fix.game,'Mara').mp,2);
  fix.game.state.hx.Mara=fix.c.l.xp_thresholds[1];
  assert.equal(fix.game.equip('Mara','R03_COMMON_HEAD'),true);
  assert.equal(hero(fix.game,'Mara').level,2); assert.equal(hero(fix.game,'Mara').mp,4);
  assert.equal(fix.game.equip('Mara','R02_COMMON_HEAD'),true); assert.equal(hero(fix.game,'Mara').mp,4);
});

test('region-three item stock offers Spark Tea with its authored price and existing shop quantity cap, not Deep Tea', () => {
  const fix=setup(); fix.game.state.area='fen'; fix.game.state.player={x:11,y:10,facing:'right'};
  fix.game.state.message={speaker:'Item Shop',text:'Supplies.'}; fix.game.state.gold=100000;
  assert.equal(fix.c.fe(fix.game.state).find(row=>row.itemId==='SPARK_TEA').price,450);
  assert.equal(fix.c.fe(fix.game.state).some(row=>row.itemId==='DEEP_TEA'),false);
  assert.equal(fix.game.buy('SPARK_TEA','max'),99); assert.equal(fix.game.state.inventory.SPARK_TEA,99);
  assert.equal(fix.game.buy('SPARK_TEA',1),false);
});

test('version-four save validation enforces jobs, MP ranges and compatible gear but keeps cross-job learning', () => {
  const fix=setup(); assert.equal(fix.game.changeJob('Iona','scout'),true); assert.equal(fix.game.changeJob('Iona','mender'),true);
  const valid=fix.saved(); assert.ok(valid.learnedSpells.Iona.includes('quickshot'));
  assert.ok(fix.c.we(JSON.stringify(valid),7321));
  for(const mutate of [save=>{save.partyJobs.Iona='unknown';},save=>{delete save.partyJobs.Tavin;},save=>{save.heroes[0].mp=-1;},save=>{save.heroes[0].mp=9999;},save=>{save.heroes[0].mp=2.5;},save=>{save.partyJobs.Mara='mender';},save=>{delete save.learnedSpells;}]){
    const bad=structuredClone(valid);mutate(bad);assert.equal(fix.c.we(JSON.stringify(bad),7321),null);
  }
});

test('legacy missing spellbooks migrate, while version-four omissions cannot grant free advanced skills',()=>{
  const fix=setup('mender'); level(fix,'Mara',31);fix.game.save();
  const saved=fix.saved();assert.deepEqual(saved.learnedSpells.Mara,['mend']);delete saved.learnedSpells;
  assert.equal(fix.c.we(JSON.stringify(saved),7321),null,'MP saves must retain their earned learning history');
  const old=context(fs.readFileSync(path.join(root,'jobs-baseline.html'),'utf8'));
  const game=old.Ee({storage:null,seed:7321});game.beginAdventure({...old.R,name:'Rowan',job:'mender'});game.skipIntro();
  const legacy=plain(game.state);delete legacy.learnedSpells;
  const migrated=fix.c.we(JSON.stringify(legacy),7321);assert.ok(migrated);
  assert.ok(migrated.learnedSpells.Mara.includes('shelter'),'pre-skill-shop legacy saves keep the established unlock migration');
  assert.equal(migrated.version,4);
});

for(const version of [1,2,3]) test(`real version-${version} charge save migrates once with depleted MP, history and equipment copies intact`,()=>{
  const oldHtml=fs.readFileSync(path.join(root,'jobs-baseline.html'),'utf8'), old=context(oldHtml), saves=new Map();
  const storage={getItem:key=>saves.get(key)??null,setItem:(key,value)=>saves.set(key,String(value))};
  const game=old.Ee({storage,seed:7321,roundDelay:0});game.beginAdventure({...old.R,name:'Mara',job:'warden'});game.skipIntro();
  game.state.inventory.R02_COMMON_CHARM=4;for(const h of game.state.heroes)game.equip(h.id,'R02_COMMON_CHARM');
  for(const id of ['Iona','Soren']){let h=hero(game,id);game.state.hx[id]=old.l.xp_thresholds[4];game.state.heroes[game.state.heroes.indexOf(h)]=old.be(id,5,h.equipment,game.state.profile);}
  hero(game,'Iona').charges.fill(0);hero(game,'Soren').charges[0]=0;
  game.state.gold=733;game.state.difficulty='hard';game.state.sp={Soren:{ember:17}};game.save();
  const save=JSON.parse(saves.get(old.G));save.version=version;
  const c=context(), migrated=c.we(JSON.stringify(save),7321);assert.ok(migrated);assert.equal(migrated.version,4);
  assert.equal(migrated.heroes.find(h=>h.id==='Iona').mp,0);
  const soren=migrated.heroes.find(h=>h.id==='Soren'), weighted=save.heroes.find(h=>h.id==='Soren');
  assert.equal(soren.mp,c.legacyMana(weighted,soren));assert.ok(soren.mp<soren.maxMp);
  assert.equal(migrated.heroes.find(h=>h.id==='Tavin').mp,c.maxMana('striker',1));
  assert.deepEqual(plain(migrated.inventory),plain(save.inventory));assert.deepEqual(plain(migrated.hx),plain(save.hx));
  assert.equal(migrated.gold,733);assert.equal(migrated.difficulty,'hard');assert.deepEqual(plain(migrated.sp),{Soren:{ember:17}});
  assert.equal(c.eqUsed(migrated,'R02_COMMON_CHARM'),4);assert.ok(migrated.learnedSpells.Mara.includes('shield-bash'));
  const reloaded=c.we(JSON.stringify(migrated),7321);assert.ok(reloaded);assert.deepEqual(plain(reloaded.heroes),plain(migrated.heroes));
});

test('legacy open skill-service dialogue is renamed without resetting the journey',()=>{
  const fix=setup(), save=fix.saved();
  // Build an authentic charge-format save rather than downgrading an MP hero.
  const old=context(fs.readFileSync(path.join(root,'jobs-baseline.html'),'utf8'));
  const game=old.Ee({storage:null,seed:7321});game.beginAdventure({...old.R,name:'Rowan'});game.skipIntro();
  const legacy=plain(game.state);legacy.message={speaker:'Magic Shop',text:'Spend spell charges.'};legacy.messageQueue=[{speaker:'Magic Shop',text:'Charges.'}];
  const migrated=fix.c.we(JSON.stringify(legacy),7321);assert.ok(migrated);
  assert.equal(migrated.message.speaker,'Skill Shop');assert.equal(migrated.messageQueue[0].speaker,'Skill Shop');
  assert.equal(migrated.profile.name,'Rowan');
});
