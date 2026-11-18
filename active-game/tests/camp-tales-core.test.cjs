'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const test = require('node:test');
const htmlPath = process.env.GAME_HTML || path.join(__dirname, '..', 'The_Road_Beyond_the_Bells.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const start = html.indexOf('var l={schemaVersion'), end = html.indexOf('var De=new Set', start);
assert.ok(start >= 0 && end > start);
const plain = value => JSON.parse(JSON.stringify(value));

function create() {
  const context = vm.createContext({ structuredClone });
  vm.runInContext(html.slice(start, end), context, { timeout: 5000 });
  const saves = new Map(), storage = { getItem: key => saves.get(key) ?? null,
    setItem: (key, value) => saves.set(key, String(value)), removeItem: key => saves.delete(key) };
  const game = context.Ee({ storage, seed: 7321, roundDelay: 0 });
  game.beginAdventure({ ...context.R, name: 'Rowan' }); game.skipIntro();
  return { context, game, storage, reload: () => context.Ee({ storage, seed: 7321, roundDelay: 0 }) };
}
function progress(game, stage) {
  game.state.campaign.stage = stage;
  game.state.flags.completed = stage === 10;
  if (stage === 10 && !game.state.campaign.switches.includes('ending_seen')) game.state.campaign.switches.push('ending_seen');
}
function drain(game) { while (game.state.message) game.dismiss(); }
function heldState(game) {
  return plain({ area: game.state.area, player: game.state.player, campaign: game.state.campaign,
    profile: game.state.profile, heroes: game.state.heroes, inventory: game.state.inventory,
    gold: game.state.gold, xp: game.state.xp, hx: game.state.hx, sp: game.state.sp,
    difficulty: game.state.difficulty, learnedSpells: game.state.learnedSpells,
    flags: game.state.flags, cleared: game.state.cleared, setAcquired: game.state.setAcquired,
    steps: game.state.steps, rng: game.state.rng });
}

test('six camp conversations unlock with story progress and require a safe shelter', () => {
  const { context, game } = create();
  assert.deepEqual(plain(context.campTales(game.state).map(tale => tale.stage)), [0, 2, 4, 6, 8, 10]);
  for (let stage = 0; stage <= 10; stage++) {
    progress(game, stage);
    const tales = context.campTales(game.state);
    assert.equal(tales.filter(tale => tale.available).length, Math.floor(stage / 2) + 1);
    assert.ok(tales.every(tale => tale.available === (tale.stage <= stage)));
  }
  game.state.area = 'works-depth-2'; game.state.player = { x: 4, y: 18, facing: 'right' };
  assert.ok(context.campTales(game.state).every(tale => !tale.available && !tale.sheltered));
  assert.equal(game.hearCampTale('first-watch'), false);
});

test('a conversation queues four speakers including the customized hero name and preserves resources', () => {
  const { game } = create();
  game.state.heroes[0].name = '<Rowan & Co>';
  game.state.heroes[0].hp = 1; game.state.heroes[0].status = 'poison';
  game.state.heroes[2].mp = 0;
  const before = heldState(game);
  assert.equal(game.hearCampTale('first-watch'), true);
  assert.deepEqual(plain(game.state.campTalesHeard), ['first-watch']);
  const messages = plain([game.state.message, ...game.state.messageQueue]);
  assert.equal(messages.length, 4);
  assert.equal(messages[1].speaker, '<Rowan & Co>', 'name remains text for the existing escaped dialogue renderer');
  assert.equal(new Set(messages.map(message => message.speaker)).size, 3);
  assert.ok(messages.every(message => message.text.length > 15 && message.text.length < 320));
  assert.deepEqual(heldState(game), before, 'no resources, travel, random rolls or plot progress change');
  drain(game);
  assert.equal(game.state.mode, 'explore');
  assert.deepEqual(heldState(game), before);
});

test('locked unknown and action-blocked conversations do not change any state', () => {
  const { game } = create();
  for (const id of ['unknown', 'lantern-bench', '__proto__']) {
    const before = plain(game.state); assert.equal(game.hearCampTale(id), false); assert.deepEqual(plain(game.state), before);
  }
  for (const mutation of [
    state => { state.mode = 'battle'; state.battle = {}; },
    state => { state.mode = 'victory'; state.reward = { title: 'Waiting' }; },
    state => { state.message = { speaker: 'Bessa', text: 'Please wait.' }; },
    state => { state.messageQueue = [{ speaker: 'Bessa', text: 'Queued story.' }]; },
  ]) {
    const fix = create(); mutation(fix.game.state);
    const before = plain(fix.game.state); assert.equal(fix.game.hearCampTale('first-watch'), false);
    assert.deepEqual(plain(fix.game.state), before);
  }
});

test('heard tales can replay without duplicating saved history or granting rewards', () => {
  const { context, game, reload } = create(); progress(game, 10);
  const before = heldState(game);
  for (const tale of context.campTales(game.state)) {
    assert.equal(game.hearCampTale(tale.id), true); drain(game);
    assert.equal(game.hearCampTale(tale.id), true); drain(game);
  }
  assert.equal(game.state.campTalesHeard.length, 6);
  assert.deepEqual(heldState(game), before);
  const restored = reload();
  assert.equal(restored.state.mode, 'explore');
  assert.deepEqual(plain(restored.state.campTalesHeard), plain(game.state.campTalesHeard));
  assert.deepEqual(heldState(restored), before);
});

test('saving in a conversation preserves its queue and heard history across reload', () => {
  const { game, reload } = create();
  assert.equal(game.hearCampTale('first-watch'), true);
  game.dismiss();
  const before = plain({ message: game.state.message, queue: game.state.messageQueue, heard: game.state.campTalesHeard });
  const restored = reload();
  assert.equal(restored.state.mode, 'explore');
  assert.deepEqual(plain({ message: restored.state.message, queue: restored.state.messageQueue, heard: restored.state.campTalesHeard }), before);
  drain(restored);
  assert.equal(restored.state.campTalesHeard.length, 1);
});

test('optional camp history normalizes malformed entries without rejecting a valid older save', () => {
  const { context, game, storage } = create(); game.save();
  const original = JSON.parse(storage.getItem(context.G));
  for (const value of [undefined, null, {}, 'first-watch', ['first-watch', 'first-watch', 'unknown', 4, null, 'road-ahead']]) {
    const candidate = { ...original };
    if (value === undefined) delete candidate.campTalesHeard; else candidate.campTalesHeard = value;
    const loaded = context.we(JSON.stringify(candidate), 7321);
    assert.ok(loaded, 'optional history must not reset a valid journey');
    assert.deepEqual(plain(loaded.campTalesHeard), Array.isArray(value) ? ['first-watch', 'road-ahead'] : []);
    assert.deepEqual(plain(loaded.hx), original.hx);
    assert.deepEqual(plain(loaded.inventory), original.inventory);
    assert.deepEqual(plain(loaded.learnedSpells), original.learnedSpells);
  }
});

test('read-only tale summaries do not mutate progress and all messages preserve permanent outcomes', () => {
  const { context, game } = create(); progress(game, 10);
  const before = plain(game.state), summaries = context.campTales(game.state);
  assert.equal(summaries.length, 6); assert.deepEqual(plain(game.state), before);
  for (const tale of summaries) {
    const messages = context.campTaleMessages(game.state, tale.id);
    assert.equal(messages.length, 4);
    assert.ok(messages.every(message => typeof message.speaker === 'string' && typeof message.text === 'string'));
  }
  assert.match(context.campTaleMessages(game.state, 'lantern-bench').map(message => message.text).join(' '), /not a debt/);
  assert.match(context.campTaleMessages(game.state, 'four-bowls').map(message => message.text).join(' '), /Did she ask/);
  assert.deepEqual(plain(game.state), before);
});
