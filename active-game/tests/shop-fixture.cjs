'use strict';

// Location fixtures use authored doors and real movement inside the store.
// They never grant money, equipment, skills or recovery to the party.
const assert = require('node:assert/strict');
const directions = [['down', 0, 1], ['right', 1, 0], ['left', -1, 0], ['up', 0, -1]];

function clearMessages(game) {
  for (let count = 0; game.state.message && count < 40; count++) game.dismiss();
  assert.equal(game.state.message, null);
}

function routeToMerchant(context, game, merchant) {
  const map = game.map(), start = game.state.player;
  const free = point => context.q.includes(map.tiles[point.y]?.[point.x])
    && !map.entities.some(entity => entity.x === point.x && entity.y === point.y);
  const goals = new Set(directions.map(([, dx, dy]) => ({ x: merchant.x + dx, y: merchant.y + dy }))
    .filter(free).map(point => `${point.x},${point.y}`));
  assert.ok(goals.size, `${map.area}/${merchant.id} has a free customer position`);
  const seen = new Set([`${start.x},${start.y}`]), queue = [{ x: start.x, y: start.y, path: [] }];
  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
    if (goals.has(`${current.x},${current.y}`)) return current.path;
    for (const [direction, dx, dy] of directions) {
      const next = { x: current.x + dx, y: current.y + dy }, key = `${next.x},${next.y}`;
      if (seen.has(key) || !free(next)) continue;
      seen.add(key); queue.push({ ...next, path: [...current.path, direction] });
    }
  }
  assert.fail(`${game.state.area}/${merchant.id} is reachable from the entrance`);
}

function visitShop(context, game, town, kind) {
  clearMessages(game);
  assert.equal(game.state.mode, 'explore');
  game.state.area = town;
  let merchant;
  const record = context.settlementShopRecords?.find(record => record.parent === town && record.kind === kind);
  if (record) {
    const door = context.he[town].entities.find(entity => entity.id === record.doorId);
    assert.ok(door, `${town} has a real ${kind} entrance`);
    game.state.player = { ...record.approach, facing: 'up' };
    const entryDirection = directions.find(([, dx, dy]) => record.approach.x + dx === door.x && record.approach.y + dy === door.y);
    assert.ok(entryDirection, 'the store entrance has a one-step approach');
    game.move(entryDirection[0]);
    assert.equal(game.state.area, record.area, 'walking through the door enters the actual store');
    merchant = game.map().entities.find(entity => entity.id === record.merchantId && entity.shopKind === kind);
    assert.ok(merchant, 'the original merchant is inside');
  } else {
    merchant = context.he[town].entities.find(entity => entity.kind === 'npc' && entity.shopKind === kind);
    assert.ok(merchant, `${town} has a real ${kind} counter`);
    const map = context.he[town];
    const approach = directions.map(([, dx, dy]) => ({ x: merchant.x + dx, y: merchant.y + dy }))
      .find(point => context.q.includes(map.tiles[point.y]?.[point.x]) && !map.entities.some(entity => entity.x === point.x && entity.y === point.y));
    assert.ok(approach); game.state.player = { ...approach, facing: 'up' };
  }
  for (const direction of routeToMerchant(context, game, merchant)) {
    const before = { area: game.state.area, x: game.state.player.x, y: game.state.player.y };
    game.move(direction);
    assert.equal(game.state.area, before.area, 'customer path stays inside the service area');
    assert.notDeepEqual({ x: game.state.player.x, y: game.state.player.y }, { x: before.x, y: before.y }, 'customer walks rather than teleporting');
  }
  game.interact(merchant.id);
  assert.equal(game.state.message?.speaker, { items: 'Item Shop', weapon: 'Weapon Shop', magic: 'Skill Shop' }[kind]);
  return merchant;
}

module.exports = { visitShop };
