'use strict';
// Render the shipped map/planning helpers against the actual engine state.
// Browser QA separately checks layout, input, and screenshots.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const html = fs.readFileSync(process.env.GAME_HTML || path.join(__dirname, '..', 'The_Road_Beyond_the_Bells.html'), 'utf8');
const coreStart = html.indexOf('var l={schemaVersion');
const coreEnd = html.indexOf('var De=new Set', coreStart);
const uiStart = html.indexOf('function depthWorldMap(e){');
const uiEnd = html.indexOf('function dt(e){', uiStart);
assert.ok(coreStart >= 0 && coreEnd > coreStart && uiStart >= 0 && uiEnd > uiStart, 'depth UI is integrated');
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'})[char]);
const plain = value => JSON.parse(JSON.stringify(value));

function create() {
  const engine = vm.createContext({ structuredClone });
  vm.runInContext(html.slice(coreStart, coreEnd), engine, { timeout: 5000 });
  const game = engine.Ee({ storage: null, seed: 7321, roundDelay: 0 });
  game.beginAdventure({ ...engine.R, name: 'Traveler' }); game.skipIntro(); game.configure({ encounters: 'off' });
  const ui = vm.createContext({
    Q: escape, Y: escape, dungeonInfo: engine.dungeonInfo, dungeonPlan: engine.dungeonPlan,
    currentFloorSurvey: engine.currentFloorSurvey,
    M: engine.M, K: engine.K, f: engine.f, he: engine.he, k: engine.k, g: engine.g, d: engine.d,
    X: { map: () => game.map() },
  });
  vm.runInContext(html.slice(uiStart, uiEnd), ui, { timeout: 5000 });
  return { engine, game, ui };
}

test('town preparation names the nearby expedition and shows actual inventory before shopping', () => {
  const { game, ui } = create();
  game.state.inventory.POTION = 1;
  const rendered = ui.depthExpeditionUI(game.state);
  assert.match(rendered, /data-expedition-plan="works"/);
  assert.match(rendered, /REGIONAL EXPEDITION/);
  assert.match(rendered, /3 floors/);
  assert.match(rendered, /data-expedition-supply="POTION" data-owned="1" data-recommended="6" class="supply-low"/);
  assert.match(rendered, /planning guides, never entry requirements/);
  assert.match(rendered, /stairs do not restore HP or MP/i);
});

test('all six settlement regions offer their own dungeon plan without exposing future floor maps', () => {
  const { game, ui } = create();
  for (const [area, root, total] of [['camp','works',3], ['dunmere','tollhouse',4], ['fen','granary',5], ['orchard','orchard',6], ['crown','crown',7], ['veyr','heart',8]]) {
    game.state.area = area; game.state.player = { x: 4, y: 6, facing: 'right' };
    const rendered = ui.depthExpeditionUI(game.state);
    assert.match(rendered, new RegExp(`data-expedition-plan="${root}"`));
    assert.match(rendered, new RegExp(`${total} floors`));
    assert.match(rendered, /REGIONAL EXPEDITION/);
    assert.doesNotMatch(rendered, /data-local-map=/);
  }
});

test('deep-floor planning uses current HP, status and every party MP pool without changing state', () => {
  const { game, ui } = create();
  game.state.area = 'heart-depth-8'; game.state.player = { x: 4, y: 18, facing: 'right' };
  const iona = game.state.heroes.find(hero => hero.id === 'Iona');
  iona.hp = Math.max(1, iona.hp - 12); iona.status = 'poison'; iona.mp = 0;
  const before = plain(game.state), rendered = ui.depthExpeditionUI(game.state);
  assert.match(rendered, /CURRENT EXPEDITION/);
  assert.match(rendered, /data-depth-floor="8" data-depth-total="8">Floor 8 \/ 8/);
  assert.match(rendered, /Iona · \d+\/\d+ HP · poison/);
  for (const hero of game.state.heroes) assert.match(rendered,
    new RegExp(`data-expedition-mp="${hero.id}" data-remaining="${hero.mp}" data-maximum="${hero.maxMp}"`));
  assert.match(rendered, new RegExp(`0 / ${iona.maxMp} MP`));
  assert.deepEqual(plain(game.state), before);
});

test('traveler text is escaped in planning notes rather than becoming markup', () => {
  const { game, ui } = create();
  game.state.heroes[0].name = '<img src=x onerror=alert(1)>';
  const rendered = ui.depthExpeditionUI(game.state);
  assert.match(rendered, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(rendered, /<img/);
});

test('local maps show the current floor and paired stair destinations without moving the party', () => {
  const { engine, game, ui } = create();
  game.state.area = 'works-depth-2'; game.state.player = { x: 4, y: 18, facing: 'right' };
  const before = plain(game.state), rendered = ui.depthLocalMap(game.state);
  assert.match(rendered, /data-local-map="works-depth-2"/);
  assert.match(rendered, /Floor 2 of 3/);
  for (const id of ['depth-up-works-2', 'depth-down-works-2']) {
    const entity = engine.he['works-depth-2'].entities.find(entity => entity.id === id);
    assert.match(rendered, new RegExp(`data-map-stair="${id}"`));
    assert.ok(rendered.includes(escape(engine.f[entity.destination].name)), `${id} destination label`);
  }
  assert.deepEqual(plain(game.state), before);
});

test('map tabs retain ten canonical world sites and place deep floors at their existing exterior', () => {
  const { engine, game, ui } = create();
  game.state.area = 'heart-depth-8'; game.state.player = { x: 4, y: 18, facing: 'right' };
  const local = ui.ut(game.state);
  assert.match(local, /data-map-view="area" aria-pressed="true"/);
  assert.match(local, /data-local-map="heart-depth-8"/);
  ui.depthMapView = 'world';
  const world = ui.ut(game.state);
  assert.match(world, /data-map-view="world" aria-pressed="true"/);
  assert.equal([...world.matchAll(/data-map-site="/g)].length, 10);
  assert.equal([...world.matchAll(/data-world-site="/g)].length, 10);
  const site = engine.k.find(site => site.area === 'heart');
  assert.ok(world.includes(`M${site.x + .5} ${site.y - .4}l.65 1.1`), 'deep floor marker is at the Heart exterior');
  assert.equal(game.state.area, 'heart-depth-8');
});

test('service lifts use the shortcut glyph while ordinary stairs retain direction arrows', () => {
  const { game, ui } = create();
  game.state.area = 'works-depth-3'; game.state.player = { x: 4, y: 18, facing: 'right' };
  game.state.campaign.switches.push('depth_works_3_shortcut');
  const rendered = ui.depthLocalMap(game.state);
  assert.match(rendered, /data-map-entity="depth-shortcut-works-3"><strong><span aria-hidden="true">⇄<\/span>/);
  assert.match(rendered, /data-map-entity="depth-up-works-3"><strong><span aria-hidden="true">↑<\/span>/);
  assert.match(rendered, /data-map-stair="depth-shortcut-works-3"/);
  game.state.area = 'works'; game.state.player = { x: 4, y: 15, facing: 'right' };
  assert.match(ui.depthLocalMap(game.state), /data-map-entity="depth-return-works-3"><strong><span aria-hidden="true">⇄<\/span>/);
});
