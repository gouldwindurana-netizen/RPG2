import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, MAPS, SAVE_KEY } from './engine';
import { TRANSITIONS } from './campaign';
import { LEGACY_PROFILE } from './characters';
import type { DemoEngine, HeroId } from './contracts';

class MemoryStorage implements Storage {
  data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, value); }
}

function start(engine: DemoEngine) { engine.beginAdventure(LEGACY_PROFILE); engine.skipIntro(); engine.configure({encounters:'visible'}); return engine; }
function demo() { const engine = start(createEngine({ storage: null, roundDelay: 0, seed: 12345 })); engine.dismiss(); return engine; }
function beside(engine: DemoEngine, entityId: string, area: 'camp' | 'works' = 'works') {
  while(engine.state.message)engine.dismiss();
  engine.state.area = area;
  const entity = engine.map().entities.find(row => row.id === entityId)!;
  assert.ok(entity, `Entity ${entityId} exists`);
  engine.state.player = { x: entity.x - 1, y: entity.y, facing: 'right' };
  engine.interact(entityId);
}
function planAttacks(engine: DemoEngine) {
  const target = engine.state.battle!.enemies.find(enemy => enemy.hp > 0)!.id;
  for (const hero of engine.state.heroes) if (hero.hp > 0 && hero.status !== 'sleep') assert.equal(engine.plan(hero.id, { type: 'attack', target }), true);
}
async function easyVictory(engine: DemoEngine, id: string, area: 'camp' | 'works' = 'works') {
  beside(engine, id, area);
  engine.state.battle!.enemies.forEach(enemy => { enemy.hp = 1; enemy.attack = 0; });
  planAttacks(engine);
  await engine.resolveRound();
  assert.equal(engine.state.mode, 'victory');
}

test('starts with four distinct equipped heroes, limited caster charges, and supplies', () => {
  const engine = demo();
  assert.deepEqual(engine.state.heroes.map(h => h.maxHp), [100, 82, 74, 66]);
  assert.equal(engine.state.heroes[2].charges[0], 2);
  assert.equal(engine.state.heroes[0].charges[0], 0);
  assert.equal(engine.state.inventory.POTION, 5);
  assert.equal(engine.state.inventory.R01_COMMON_HEAD, 4);
});

test('all maps have consistent dimensions and every entity has a reachable interaction tile', () => {
  for (const [area, map] of Object.entries(MAPS)) {
    assert.equal(map.tiles.length, map.height);
    assert.ok(map.tiles.every(row => row.length === map.width));
    const start = area === 'camp' ? [11,10] : area==='works'?[3,15]:area==='overworld'?[8,33]:[3,14];
    const visited = new Set<string>(); const queue = [start];
    while (queue.length) {
      const [x, y] = queue.shift()!; const key = `${x},${y}`;
      if (visited.has(key) || !'gdsfb'.includes(map.tiles[y]?.[x] ?? '!')) continue;
      if (map.entities.some(e => e.x === x && e.y === y && e.kind !== 'exit')) continue;
      visited.add(key);
      for(const e of map.entities)if(e.kind==='exit'&&Math.abs(e.x-x)+Math.abs(e.y-y)<=1&&TRANSITIONS[e.id]?.area===area)queue.push([TRANSITIONS[e.id].x,TRANSITIONS[e.id].y]);
      queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    for (const e of map.entities) assert.ok([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => visited.has(`${e.x + dx},${e.y + dy}`)), `${area}/${e.id} reachable`);
  }
});

test('interaction cannot skip distance or bypass the initial briefing', () => {
  const engine = demo();
  engine.interact('toWorks'); assert.equal(engine.state.area, 'camp');
  beside(engine, 'toWorks', 'camp'); assert.equal(engine.state.area, 'camp');
  engine.dismiss(); beside(engine, 'bessa', 'camp'); assert.equal(engine.state.flags.briefed, true);
  engine.dismiss(); beside(engine, 'toWorks', 'camp'); assert.equal(engine.state.area, 'works');
});

test('lantern side quest gives one potion once', () => {
  const engine = demo(); beside(engine, 'lantern', 'camp');
  assert.equal(engine.state.inventory.POTION, 6);
  engine.dismiss(); engine.interact('lantern'); assert.equal(engine.state.inventory.POTION, 6);
});

test('round requires every eligible hero and locks while resolving', async () => {
  const engine = demo(); beside(engine, 'encounter1');
  assert.equal(engine.plan('Mara', { type: 'guard', target: 'Mara' }), true);
  await engine.resolveRound(); assert.equal(engine.state.battle!.round, 1);
  planAttacks(engine);
  const work = engine.resolveRound();
  assert.equal(engine.state.battle!.phase, 'resolving');
  assert.equal(engine.plan('Mara', { type: 'guard', target: 'Mara' }), false);
  await work;
});

test('dead enemy targets retarget without wasting all remaining actions', async () => {
  const engine = demo(); beside(engine, 'encounter1');
  engine.state.battle!.enemies.forEach(e => { e.hp = 1; e.attack = 0; });
  planAttacks(engine); await engine.resolveRound();
  assert.equal(engine.state.mode, 'victory');
  assert.ok(engine.state.battle!.enemies.every(enemy => enemy.hp === 0));
  assert.equal(engine.state.xp, 28);
});

test('one potion cannot be reserved by two heroes, and undo releases it', () => {
  const engine = demo(); beside(engine, 'encounter1'); engine.state.inventory.POTION = 1;
  assert.equal(engine.plan('Mara', { type: 'item', target: 'Iona', itemId: 'POTION' }), true);
  assert.equal(engine.plan('Tavin', { type: 'item', target: 'Soren', itemId: 'POTION' }), false);
  engine.undo('Mara');
  assert.equal(engine.plan('Tavin', { type: 'item', target: 'Soren', itemId: 'POTION' }), true);
});

test('invalidated healing target does not consume a charge', async () => {
  const engine = demo(); beside(engine, 'encounter1');
  planAttacks(engine);
  const healer = engine.state.heroes.find(h => h.id === 'Iona')!;
  assert.equal(engine.plan('Iona', { type: 'spell', target: 'Mara', spellId: 'mend' }), true);
  engine.state.heroes[0].hp = 0;
  engine.state.battle!.enemies.forEach(e => { e.hp = 500; e.attack = 0; });
  const old = healer.charges[0]; await engine.resolveRound();
  assert.equal(healer.charges[0], old);
});

test('silence before execution cancels the cast without spending a charge', async () => {
  const engine = demo(); beside(engine, 'encounter1'); planAttacks(engine);
  const caster = engine.state.heroes.find(h => h.id === 'Soren')!;
  assert.equal(engine.plan('Soren', { type: 'spell', target: engine.state.battle!.enemies[0].id, spellId: 'spark' }), true);
  caster.status = 'silence';
  engine.state.battle!.enemies.forEach(e => { e.hp = 500; e.attack = 0; });
  const old = caster.charges[0]; await engine.resolveRound();
  assert.equal(caster.charges[0], old);
});

test('boss warns before the heavy round, disallows fleeing, and guards reduce damage', async () => {
  const engine = demo(); beside(engine, 'bailiff');
  assert.ok(engine.state.battle!.enemies[0].intent.includes('next round'));
  await engine.flee(); assert.equal(engine.state.mode, 'battle');
  for (const hero of engine.state.heroes) engine.plan(hero.id, { type: 'guard', target: hero.id });
  await engine.resolveRound();
  assert.equal(engine.state.battle!.round, 2);
  assert.ok(engine.state.battle!.enemies[0].intent.includes('HEAVY'));
  for (const hero of engine.state.heroes) engine.plan(hero.id, { type: 'guard', target: hero.id });
  const hp = engine.state.heroes.reduce((sum, h) => sum + h.hp, 0);
  await engine.resolveRound();
  assert.ok(hp - engine.state.heroes.reduce((sum, h) => sum + h.hp, 0) < 30);
});

test('six ordinary victories plus boss reach level five for every hero', async () => {
  const engine = demo();
  for (let i = 1; i <= 6; i++) { await easyVictory(engine, `encounter${i}`); engine.continue(); }
  await easyVictory(engine, 'bailiff');
  assert.equal(engine.state.xp, 256);
  assert.ok(engine.state.heroes.every(h => h.level === 5));
  assert.equal(engine.state.heroes[2].maxCharges[1], 2);
});

test('reward requires a valid choice, cannot repeat, and unique equipment is exclusive', async () => {
  const engine = demo(); beside(engine, 'chest');
  engine.continue(); assert.equal(engine.state.mode, 'victory');
  engine.claim('R02_SET_HEAD'); assert.equal(engine.state.setAcquired.length, 0);
  engine.claim('R01_SET_HEAD'); engine.claim('R01_SET_HEAD');
  assert.equal(engine.state.inventory.R01_SET_HEAD, 1);
  engine.continue();
  assert.equal(engine.equip('Mara', 'R01_SET_HEAD'), true);
  assert.equal(engine.equip('Tavin', 'R01_SET_HEAD'), false);
  assert.equal(engine.equip('Mara', 'R01_COMMON_HEAD'), true);
  assert.equal(engine.equip('Tavin', 'R01_SET_HEAD'), true);
});

test('pending reward and its claimed state roundtrip without duplicate acquisition', () => {
  const storage = new MemoryStorage();
  let engine = start(createEngine({ storage, roundDelay: 0 })); engine.dismiss(); beside(engine, 'chest');
  engine = createEngine({ storage, roundDelay: 0 });
  assert.equal(engine.state.mode, 'victory');
  assert.equal(engine.state.reward!.choices.length, 3);
  engine.claim('R01_SET_MANTLE');
  engine = createEngine({ storage, roundDelay: 0 });
  assert.equal(engine.state.reward!.choices.length, 0);
  engine.claim('R01_SET_CHARM'); assert.equal(engine.state.inventory.R01_SET_CHARM, undefined);
  engine.continue();
  assert.equal(engine.map().entities.some(e => e.id === 'chest'), false);
});

test('mid-battle saving is refused and reload returns the stable pre-battle checkpoint', () => {
  const storage = new MemoryStorage(); const engine = start(createEngine({ storage, roundDelay: 0 }));
  engine.dismiss(); beside(engine, 'encounter1');
  assert.equal(engine.save(), false);
  engine.state.inventory.POTION = 0;
  const restored = createEngine({ storage, roundDelay: 0 });
  assert.equal(restored.state.mode, 'explore'); assert.equal(restored.state.inventory.POTION, 5);
});

test('malformed save and inaccessible storage safely fall back to a fresh game', () => {
  for (const data of ['{', '{"version":1}', JSON.stringify({ version: 99 })]) {
    const storage = new MemoryStorage(); storage.setItem(SAVE_KEY, data);
    assert.equal(createEngine({ storage }).state.heroes.length, 4);
  }
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); } } as unknown as Storage;
  const engine = createEngine({ storage: broken }); assert.equal(engine.save(), false);
});

test('defeat returns safely to camp without awarding a win', async () => {
  const engine = demo(); beside(engine, 'encounter1');
  for (const hero of engine.state.heroes) { hero.hp = 0; }
  await engine.resolveRound();
  assert.equal(engine.state.mode, 'defeat');
  assert.equal(engine.state.xp, 0); assert.deepEqual(engine.state.cleared, []);
  engine.continue(); assert.equal(engine.state.area, 'camp'); assert.ok(engine.state.heroes.every(h => h.hp === h.maxHp));
});

test('boss rescue opens the next chapter and optional hunt completes all three regional set sources', async () => {
  const engine = demo(); beside(engine, 'chest'); engine.claim('R01_SET_HEAD'); engine.continue();
  await easyVictory(engine, 'bailiff'); engine.claim('R01_SET_MANTLE'); engine.continue(); engine.dismiss();
  beside(engine, 'bessa', 'camp'); assert.equal(engine.state.mode, 'explore');
  assert.equal(engine.state.campaign.stage,2);assert.equal(engine.state.flags.completed,false);assert.equal(engine.state.rareReady,true);
  while(engine.state.message)engine.dismiss();
  await easyVictory(engine, 'silver', 'camp'); engine.claim('R01_SET_CHARM'); engine.continue();
  assert.equal(engine.state.setAcquired.length, 3); assert.equal(engine.state.rareReady, false);
  assert.equal(engine.map().entities.some(e => e.id === 'silver'), false);
});

test('camp shop and exploration use obey stock, price, mode, and target rules', () => {
  const engine = demo();
  assert.equal(engine.buy('POTION'), true); assert.equal(engine.state.gold, 30); assert.equal(engine.state.inventory.POTION, 6);
  assert.equal(engine.buy('REVIVAL_SALT'), false); assert.equal(engine.buy('R06_MARA_WEAPON'), false);
  const hero = engine.state.heroes[0]; hero.hp = 0;
  assert.equal(engine.useItem('POTION', 'Mara'), false);
  assert.equal(engine.useItem('REVIVAL_SALT', 'Mara'), true); assert.equal(hero.hp, 20);
  beside(engine, 'encounter1'); assert.equal(engine.useItem('POTION', 'Mara'), false); assert.equal(engine.buy('POTION'), false);
});

test('unmodified encounters and the boss are beatable using starter gear and normal recovery', async () => {
  const engine = demo();
  async function fight(id: string) {
    beside(engine, id);
    for (let rounds = 0; rounds < 50 && engine.state.mode === 'battle'; rounds++) {
      const battle = engine.state.battle!;
      const target = battle.enemies.find(e => e.hp > 0)!;
      const wounded = engine.state.heroes.filter(h => h.hp > 0).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      for (const hero of engine.state.heroes) {
        if (hero.hp <= 0 || hero.status === 'sleep') continue;
        if (battle.kind === 'boss' && battle.round % 2 === 0) engine.plan(hero.id, { type: 'guard', target: hero.id });
        else if (hero.id === 'Iona' && wounded.hp < wounded.maxHp * .6 && hero.charges[0]) engine.plan(hero.id, { type: 'spell', target: wounded.id, spellId: 'mend' });
        else if (hero.id === 'Soren' && hero.charges[0]) engine.plan(hero.id, { type: 'spell', target: target.id, spellId: target.weakness.includes('frost') ? 'frost' : target.weakness.includes('lightning') ? 'spark' : 'ember' });
        else engine.plan(hero.id, { type: 'attack', target: target.id });
      }
      await engine.resolveRound();
    }
    assert.equal(engine.state.mode, 'victory', `win ${id}`);
    if (engine.state.reward!.choices.length) engine.claim(engine.state.reward!.choices[0]);
    engine.continue(); engine.dismiss();
  }
  for (let i = 1; i <= 6; i++) {
    await fight(`encounter${i}`);
    // Returning to the nearby, free camp watchfire is available throughout the demo.
    engine.state.area = 'camp'; engine.rest(); engine.dismiss();
  }
  await fight('bailiff');
  assert.equal(engine.state.flags.bossDefeated, true);
  assert.ok(engine.state.heroes.some(hero => hero.hp > 0));
});
