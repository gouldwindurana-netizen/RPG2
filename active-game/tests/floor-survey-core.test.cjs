'use strict';
// Read actual saved discovery flags and use shipped interactions; these position
// fixtures isolate the checklist rather than claiming a dungeon playthrough.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const html = fs.readFileSync(process.env.GAME_HTML || path.join(__dirname, '..', 'The_Road_Beyond_the_Bells.html'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
function setup() {
  const c = vm.createContext({ structuredClone });
  vm.runInContext(html.slice(html.indexOf('var l={schemaVersion'), html.indexOf('var De=new Set')), c, { timeout: 5000 });
  const saves = new Map();
  const storage = { getItem: key => saves.get(key) ?? null, setItem: (key, value) => saves.set(key, String(value)) };
  const game = c.Ee({ storage, seed: 7321, roundDelay: 0 });
  game.beginAdventure({ ...c.R, name: 'Rowan' }); game.skipIntro(); game.configure({ encounters: 'off' });
  return { c, game, reload: () => c.Ee({ storage, seed: 7321, roundDelay: 0 }) };
}
function place(game, area) { game.state.area = area; game.state.player = { x: 4, y: 18, facing: 'right' }; }
function inspect(fix, id) {
  while (fix.game.state.message) fix.game.dismiss();
  const entity = fix.c.he[fix.game.state.area].entities.find(entity => entity.id === id);
  assert.ok(entity, id);
  fix.game.state.player = { x: entity.x - 1, y: entity.y, facing: 'right' };
  fix.game.interact(id);
  if (fix.game.state.reward) fix.game.continue();
  while (fix.game.state.message) fix.game.dismiss();
}
function row(fix, id) { return fix.c.currentFloorSurvey(fix.game.state).rows.find(row => row.id === id); }

test('safe towns and the overworld have no dungeon checklist', () => {
  const fix = setup();
  assert.equal(fix.c.currentFloorSurvey(fix.game.state), null);
  place(fix.game, 'overworld');
  assert.equal(fix.c.currentFloorSurvey(fix.game.state), null);
  for (const area of ['orchard', 'crown']) {
    place(fix.game, area); fix.game.state.player = { x: 4, y: 6, facing: 'right' };
    assert.equal(fix.c.currentFloorSurvey(fix.game.state), null);
  }
});

test('notes describe only authored optional discoveries on the current floor', () => {
  const fix = setup();
  for (const [area, expected] of [['works', ['caches']], ['works-depth-2', ['records','caches']], ['works-depth-3',['records','caches','lifts']], ['orchard-depth-6',['records','caches','locks','lifts']]]) {
    place(fix.game, area); const before = JSON.stringify(fix.game.state);
    const survey = fix.c.currentFloorSurvey(fix.game.state);
    assert.deepEqual(plain(survey.rows.map(row => row.id)), expected);
    assert.ok(survey.rows.every(row => row.done === 0 && row.total > 0));
    assert.equal(survey.area, area);
    assert.equal(JSON.stringify(fix.game.state), before, 'opening notes never changes state');
  }
});

test('copying evidence and opening a real cache update notes and survive reload', () => {
  const fix = setup(); place(fix.game, 'works-depth-2');
  inspect(fix, 'depth-note-works-2');
  assert.equal(row(fix, 'records').done, 1);
  assert.equal(row(fix, 'caches').done, 0);
  inspect(fix, 'depth-cache-works-2');
  assert.equal(row(fix, 'caches').done, 1);
  const inventory = plain(fix.game.state.inventory);
  fix.game.save(); const loaded = fix.reload();
  assert.equal(loaded.state.mode, 'explore');
  assert.deepEqual(plain(fix.c.currentFloorSurvey(loaded.state)), plain(fix.c.currentFloorSurvey(fix.game.state)));
  assert.deepEqual(plain(loaded.state.inventory), inventory);
  place(fix.game, 'works-depth-3');
  assert.equal(row(fix, 'records').done, 0, 'another floor does not inherit this evidence');
});

test('real cross-locks and return-lift controls update their own counts without recovery', () => {
  const fix = setup(); place(fix.game, 'orchard-depth-6');
  const before = plain({ hp: fix.game.state.heroes.map(hero => hero.hp), mp: fix.game.state.heroes.map(hero => hero.mp), inventory: fix.game.state.inventory, gold: fix.game.state.gold });
  assert.equal(row(fix, 'locks').total, 2);
  inspect(fix, 'depth-wheel-orchard-6'); assert.equal(row(fix, 'locks').done, 1);
  inspect(fix, 'depth-upper-wheel-orchard-6'); assert.equal(row(fix, 'locks').done, 2);
  inspect(fix, 'depth-lever-orchard-6'); assert.equal(row(fix, 'lifts').done, 1);
  assert.deepEqual(plain({ hp: fix.game.state.heroes.map(hero => hero.hp), mp: fix.game.state.heroes.map(hero => hero.mp), inventory: fix.game.state.inventory, gold: fix.game.state.gold }), before);
});

test('legacy opening-lockbox flag counts an opened cache without inventing other discoveries', () => {
  const fix = setup(); place(fix.game, 'works'); fix.game.state.flags.chest = true;
  assert.equal(row(fix, 'caches').done, 1);
  assert.equal(fix.c.currentFloorSurvey(fix.game.state).rows.length, 1);
});
