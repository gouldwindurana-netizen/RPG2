'use strict';

// These tests execute the shipped standalone engine. Later-story travel uses
// explicit route fixtures; it does not claim a complete campaign playthrough.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const htmlPath = process.env.GAME_HTML
  ? path.resolve(process.env.GAME_HTML)
  : path.resolve(__dirname, '..', 'The_Road_Beyond_the_Bells.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const start = html.indexOf('var l={schemaVersion');
const end = html.indexOf('var De=new Set', start);
assert.ok(start >= 0 && end > start, 'shipped engine boundaries exist');
const core = html.slice(start, end);
const plain = value => JSON.parse(JSON.stringify(value));
const directions = [['down', 0, 1], ['right', 1, 0], ['left', -1, 0], ['up', 0, -1]];
const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

function createGame() {
  const context = vm.createContext({ structuredClone });
  vm.runInContext(core, context, { timeout: 3000, filename: htmlPath });
  const saves = new Map();
  const storage = {
    getItem: key => saves.get(key) ?? null,
    setItem: (key, value) => saves.set(key, String(value)),
    removeItem: key => saves.delete(key),
  };
  const game = context.Ee({ storage, seed: 7321, roundDelay: 0 });
  game.beginAdventure({ ...context.R, name: 'Rowan' });
  game.skipIntro();
  assert.equal(game.state.mode, 'explore');
  return { context, game, storage, reload: () => context.Ee({ storage, seed: 7321, roundDelay: 0 }) };
}

function routeFixture(context, game) {
  game.state.campaign.stage = 9;
  game.state.campaign.switches = plain(context.h).filter(id => id !== 'ending_seen');
  game.state.flags.briefed = true;
  game.state.flags.completed = false;
  game.state.message = null;
  game.state.messageQueue = [];
}

function free(context, area, point) {
  const map = context.he[area];
  return context.q.includes(map.tiles[point.y]?.[point.x])
    && !map.entities.some(entity => entity.x === point.x && entity.y === point.y);
}

function neighbor(context, area, entity) {
  for (const [, dx, dy] of directions) {
    const point = { x: entity.x + dx, y: entity.y + dy };
    if (free(context, area, point)) return point;
  }
  assert.fail(`No free approach to ${area}/${entity.id}`);
}

function moveToward(game, target) {
  const player = game.state.player;
  const direction = directions.find(([, dx, dy]) => player.x + dx === target.x && player.y + dy === target.y);
  assert.ok(direction, 'fixture approaches exactly one step from the exit');
  game.move(direction[0]);
}

function place(game, area, point, facing = 'down') {
  game.state.area = area;
  game.state.player = { x: point.x, y: point.y, facing };
  game.state.message = null;
  game.state.messageQueue = [];
  game.state.mode = 'explore';
}

const areas = ['camp', 'works', 'dunmere', 'tollhouse', 'fen', 'granary', 'orchard', 'crown', 'veyr', 'heart'];

test('ten overworld sites each have one canonical exterior exit alongside interior stairs', () => {
  const { context } = createGame();
  const sites = context.he.overworld.entities.filter(entity => entity.id.startsWith('enter-'));
  assert.equal(sites.length, 10);
  assert.deepEqual(plain(sites.map(entity => entity.destination).sort()), [...areas].sort());
  for (const area of areas) {
    const exits = context.he[area].entities.filter(entity => entity.kind === 'exit' && context.g[entity.id]?.area === 'overworld');
    assert.deepEqual(plain(exits.map(entity => entity.id)), [`world-${area}`]);
    assert.equal(context.g[exits[0].id].area, 'overworld');
  }
  for (const area of ['camp', 'dunmere', 'fen', 'veyr']) {
    assert.ok(free(context, area, { x: 28, y: 8 }), `${area}'s removed shortcut stays save-compatible floor`);
  }
  assert.equal(context.g['world-camp'].minStage ?? 0, 0);
  assert.equal(context.g['road-dunmere'].minStage, 2, 'the R02 story crossing retains its gate');
});

for (const area of areas) {
  test(`${area}: walking in and out preserves the real outside approach, faces away, and never bounces`, () => {
    const { context, game } = createGame();
    routeFixture(context, game);
    const site = context.he.overworld.entities.find(entity => entity.id === `enter-${area}`);
    const outside = neighbor(context, 'overworld', site);
    place(game, 'overworld', outside);
    game.state.encounterSteps = 17;
    const rng = game.state.rng;
    const steps = game.state.steps;
    moveToward(game, site);
    assert.equal(game.state.area, area);
    assert.equal(game.state.mode, 'explore', 'travel wins before encounter checks');
    assert.equal(game.state.rng, rng, 'entry does not consume encounter RNG');
    assert.equal(game.state.steps, steps + 1);
    assert.equal(game.state.encounterSteps, 0);
    assert.deepEqual(plain(game.state.overworldReturn), outside);
    const exit = context.he[area].entities.find(entity => entity.id === `world-${area}`);
    assert.equal(distance(game.state.player, exit), 1, 'authored entry is beside the local exit');
    moveToward(game, exit);
    assert.equal(game.state.area, 'overworld');
    assert.deepEqual(plain({ x: game.state.player.x, y: game.state.player.y }), outside);
    assert.equal(game.state.rng, rng);
    assert.equal(game.state.steps, steps + 2);
    assert.ok(free(context, 'overworld', game.state.player), 'outside spawn is never on an entrance');
    const facing = directions.find(([name]) => name === game.state.player.facing);
    const next = { x: outside.x + facing[1], y: outside.y + facing[2] };
    assert.ok(distance(next, site) > distance(outside, site), 'facing points away from entrance');
    game.move(facing[0]);
    assert.equal(game.state.area, 'overworld', 'continued input cannot bounce immediately back inside');
  });

  test(`${area}: direct E entry/exit and legacy entrance returns use safe same-site tiles`, () => {
    const { context, game, reload } = createGame();
    routeFixture(context, game);
    const site = context.he.overworld.entities.find(entity => entity.id === `enter-${area}`);
    // v3 saves may already stand on a formerly interactive overworld entrance.
    place(game, 'overworld', site);
    assert.equal(game.save(), true);
    const restored = reload();
    assert.equal(restored.state.area, 'overworld');
    assert.equal(distance(restored.state.player, site), 0, 'loading alone preserves the saved position');
    restored.interact(site.id);
    assert.equal(restored.state.area, area);
    assert.equal(distance(restored.state.overworldReturn, site), 1, 'on-entrance legacy return is repaired');
    const safe = plain(restored.state.overworldReturn);
    restored.interact(`world-${area}`);
    assert.equal(restored.state.area, 'overworld');
    assert.deepEqual(plain({ x: restored.state.player.x, y: restored.state.player.y }), safe);
    assert.ok(free(context, 'overworld', restored.state.player));
    assert.equal(restored.state.steps, game.state.steps, 'E travel retains its existing step semantics');
  });
}

test('every usable side of every overworld entrance preserves its actual approach', () => {
  const { context, game } = createGame();
  routeFixture(context, game);
  let checked = 0;
  for (const area of areas) {
    const site = context.he.overworld.entities.find(entity => entity.id === `enter-${area}`);
    for (const [, dx, dy] of directions) {
      const approach = { x: site.x + dx, y: site.y + dy };
      if (!free(context, 'overworld', approach)) continue;
      place(game, 'overworld', approach);
      moveToward(game, site);
      assert.equal(game.state.area, area);
      game.interact(`world-${area}`);
      assert.equal(game.state.area, 'overworld');
      assert.deepEqual(plain({ x: game.state.player.x, y: game.state.player.y }), approach);
      checked++;
    }
  }
  assert.ok(checked >= 20, 'covers approaches beyond the default south-side return');
});

test('Bessa briefing gates Merewatch for both automatic entry and direct E', () => {
  for (const method of ['walk', 'E']) {
    const { context, game } = createGame();
    const site = context.he.overworld.entities.find(entity => entity.id === 'enter-works');
    const outside = neighbor(context, 'overworld', site);
    place(game, 'overworld', outside);
    game.state.encounterSteps = 17;
    const before = plain(game.state);
    if (method === 'walk') moveToward(game, site);
    else game.interact(site.id);
    assert.equal(game.state.area, 'overworld');
    assert.equal(distance(game.state.player, outside), 0);
    assert.match(game.state.message.text, /Bessa/);
    assert.equal(game.state.steps, before.steps);
    assert.equal(game.state.encounterSteps, before.encounterSteps);
    assert.equal(game.state.rng, before.rng);
    game.dismiss();
    game.state.flags.briefed = true;
    if (method === 'walk') moveToward(game, site);
    else game.interact(site.id);
    assert.equal(game.state.area, 'works');
  }
});

test('all authored stage and switch gates keep the approach tile and do not consume encounter RNG', () => {
  const { context, game } = createGame();
  let checked = 0;
  for (const [area, map] of Object.entries(context.he)) {
    // Undiscovered return lifts are absent from the playable map. Their reveal
    // and shortcut conditions are covered by the dungeon traversal checks.
    for (const exit of map.entities.filter(entity => entity.kind === 'exit' && !entity.depthHideUntil)) {
      const target = context.g[exit.id];
      for (const gate of ['stage', 'switch']) {
        if (gate === 'stage' ? !(target?.minStage > 0) : !target?.requiredSwitch) continue;
        routeFixture(context, game);
        game.state.campaign.stage = gate === 'stage' ? target.minStage - 1 : 9;
        if (gate === 'switch') game.state.campaign.switches = game.state.campaign.switches.filter(id => id !== target.requiredSwitch);
        const approach = neighbor(context, area, exit);
        place(game, area, approach);
        game.state.encounterSteps = 17;
        const before = plain(game.state);
        moveToward(game, exit);
        assert.equal(game.state.area, area, `${exit.id} ${gate}`);
        assert.equal(distance(game.state.player, approach), 0, `${exit.id} retains approach`);
        assert.equal(game.state.steps, before.steps);
        assert.equal(game.state.encounterSteps, 17);
        assert.equal(game.state.rng, before.rng);
        assert.ok(game.state.message?.text, `${exit.id} explains its gate`);
        game.state.message = null;
        game.interact(exit.id);
        assert.equal(game.state.area, area, `${exit.id} E also respects ${gate}`);
        assert.equal(distance(game.state.player, approach), 0);
        assert.equal(game.state.steps, before.steps);
        assert.equal(game.state.rng, before.rng);
        assert.ok(game.state.message?.text, `${exit.id} E explains its gate`);
        checked++;
      }
    }
  }
  assert.ok(checked >= 14, 'checks all later regions and required story switches');
});

test('same-overworld crossings follow their physical direction or authored ferry destination', () => {
  const { context, game } = createGame();
  routeFixture(context, game);
  const exits = context.he.overworld.entities.filter(entity => entity.kind === 'exit' && context.g[entity.id]?.area === 'overworld');
  assert.equal(exits.length, 6);
  for (const exit of exits) {
    const target = context.g[exit.id];
    const vectors = target.walkThrough ? (target.axis === 'x' ? [[1, 0], [-1, 0]] : [[0, 1], [0, -1]]) : null;
    const approaches = vectors ? vectors.map(([dx,dy]) => ({x:exit.x-dx,y:exit.y-dy})) : [neighbor(context,'overworld',exit)];
    for (const approach of approaches) {
      place(game, 'overworld', approach);
      const rng = game.state.rng;
      const dx=exit.x-approach.x,dy=exit.y-approach.y;
      const expected=target.walkThrough?{x:exit.x+dx,y:exit.y+dy}:{x:target.x,y:target.y};
      moveToward(game, exit);
      assert.equal(game.state.area, 'overworld');
      assert.deepEqual(plain({ x: game.state.player.x, y: game.state.player.y }), expected);
      assert.equal(game.state.player.facing,target.walkThrough?(dx?dx>0?'right':'left':dy>0?'down':'up'):target.facing);
      assert.ok(free(context, 'overworld', game.state.player), `${exit.id} spawn clears the threshold`);
      assert.equal(game.state.rng, rng);
      const away=game.state.player.facing;
      game.move(away);
      assert.equal(game.state.area, 'overworld');
      assert.ok(distance(game.state.player, exit) > 1, 'continued travel moves away from crossing');
    }
  }
});

test('stale returns from other regions are ignored for every local area', () => {
  const { context, game } = createGame();
  routeFixture(context, game);
  const sites = context.he.overworld.entities.filter(entity => entity.id.startsWith('enter-'));
  for (const area of areas) {
    const other = sites.find(site => site.destination !== area);
    const current = sites.find(site => site.destination === area);
    game.state.overworldReturn = neighbor(context, 'overworld', other);
    const localExit = context.he[area].entities.find(entity => entity.id === `world-${area}`);
    place(game, area, neighbor(context, area, localExit));
    game.interact(localExit.id);
    assert.equal(game.state.area, 'overworld');
    assert.equal(distance(game.state.player, current), 1);
    assert.ok(free(context, 'overworld', game.state.player));
    assert.deepEqual(plain(game.state.overworldReturn), { x: game.state.player.x, y: game.state.player.y });
  }
});

test('safe towns never roll encounters while walking with a ready encounter counter', () => {
  const { context, game } = createGame();
  for (const area of ['camp', 'dunmere', 'fen', 'veyr']) {
    const map = context.he[area];
    let pair;
    for (let y = 1; y < map.height - 1 && !pair; y++) {
      for (let x = 1; x < map.width - 2; x++) {
        const a = { x, y }, b = { x: x + 1, y };
        if (free(context, area, a) && free(context, area, b)
          && map.entities.every(entity => distance(entity, a) > 2 && distance(entity, b) > 2)) {
          pair = [a, b];
          break;
        }
      }
    }
    assert.ok(pair, `${area} has an ordinary walking fixture`);
    place(game, area, pair[0]);
    game.state.encounterSteps = 17;
    game.state.settings.encounters = 'classic';
    const rng = game.state.rng;
    for (let i = 0; i < 24; i++) game.move(i % 2 ? 'left' : 'right');
    assert.equal(game.state.mode, 'explore');
    assert.equal(game.state.rng, rng);
    assert.equal(game.state.encounterSteps, 17);
  }
});

test('current positions at removed shortcuts survive reload with equipment copies and per-hero EXP', () => {
  const { context, game, reload } = createGame();
  routeFixture(context, game);
  const hx = { Mara: 12, Tavin: 52, Iona: 130, Soren: 256 };
  game.state.hx = hx;
  game.state.xp = 777;
  game.state.settings = { battleSpeed: 3, encounters: 'off', npcMovement: 'still' };
  game.state.inventory.R02_COMMON_CHARM = 4;
  for (const hero of game.state.heroes) assert.equal(game.equip(hero.id, 'R02_COMMON_CHARM'), true);
  const inventory = plain(game.state.inventory);
  for (const area of ['camp', 'dunmere', 'fen', 'veyr']) {
    place(game, area, { x: 28, y: 8 }, 'left');
    assert.equal(game.save(), true);
    const restored = reload();
    assert.equal(restored.state.version, 4);
    assert.equal(restored.state.mode, 'explore');
    assert.equal(restored.state.area, area);
    assert.deepEqual(plain(restored.state.player), { x: 28, y: 8, facing: 'left' });
    assert.deepEqual(plain(restored.state.hx), hx);
    assert.equal(restored.state.xp, 777);
    assert.deepEqual(plain(restored.state.inventory), inventory);
    assert.deepEqual(plain(restored.state.heroes.map(hero => hero.equipment.charm)), Array(4).fill('R02_COMMON_CHARM'));
    assert.deepEqual(plain(restored.state.settings), { battleSpeed: 3, encounters: 'off', npcMovement: 'still' });
  }
  assert.equal(context.we(JSON.stringify(game.state), 7321).area, 'veyr');
});

test('version 1 and 2 camp/works saves still import at their exact walkable positions', () => {
  const { context } = createGame();
  const legacyHtml = fs.readFileSync(path.join(__dirname, '..', 'jobs-baseline.html'), 'utf8');
  const legacy = vm.createContext({ structuredClone });
  vm.runInContext(legacyHtml.slice(legacyHtml.indexOf('var l={schemaVersion'), legacyHtml.indexOf('var De=new Set')), legacy, { timeout: 3000 });
  const game = legacy.Ee({ storage: null, seed: 7321, roundDelay: 0 });
  game.beginAdventure({ ...legacy.R, name: 'Before MP' }); game.skipIntro();
  for (const version of [1, 2]) {
    for (const [area, point] of [['camp', { x: 28, y: 8 }], ['works', { x: 2, y: 15 }]]) {
      const saved = plain(game.state);
      saved.version = version;
      saved.area = area;
      saved.player = { ...point, facing: 'right' };
      const restored = context.we(JSON.stringify(saved), 7321);
      assert.ok(restored, `v${version}/${area} imports`);
      assert.equal(restored.version, 4);
      assert.equal(restored.area, area);
      assert.deepEqual(plain(restored.player), saved.player);
    }
  }
});
