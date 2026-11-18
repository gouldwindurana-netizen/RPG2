'use strict';

// Use the shipped engine and journal helpers; fixtures isolate later progress.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const file = process.env.GAME_HTML || path.join(__dirname, '..', 'The_Road_Beyond_the_Bells.html');
const html = fs.readFileSync(file, 'utf8');
const coreStart = html.indexOf('var l={schemaVersion'), coreEnd = html.indexOf('var De=new Set');
assert.ok(coreStart >= 0 && coreEnd > coreStart);
const plain = value => JSON.parse(JSON.stringify(value));
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);

function setup() {
  const context = vm.createContext({ structuredClone });
  vm.runInContext(html.slice(coreStart, coreEnd), context, { timeout: 5000 });
  const saved = new Map(), storage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, String(value)) };
  const game = context.Ee({ storage, seed: 7321, roundDelay: 0 });
  game.beginAdventure({ ...context.R, name: 'Rowan' }); game.skipIntro();
  return { context, game, saved, storage, reload: () => context.Ee({ storage, seed: 7321, roundDelay: 0 }) };
}
function clear(game) { while (game.state.message) game.dismiss(); }
function board(fix, regionId = 'R01') {
  const region = fix.context.wayfarerRegions.find(region => region.id === regionId);
  const entity = fix.context.he[region.town].entities.find(entity => entity.wayfarerRegion === regionId);
  clear(fix.game);
  fix.game.state.area = region.town;
  fix.game.state.player = { x: entity.x, y: entity.y + 1, facing: 'up' };
  fix.game.interact(entity.id);
  assert.equal(fix.game.state.message?.speaker, 'Wayfarer Board');
}
function accept(fix, id = 'R01-patrol') {
  board(fix, id.slice(0, 3));
  assert.equal(fix.game.acceptCommission(id), true);
  clear(fix.game);
}
function resources(state) {
  return plain({ profile: state.profile, area: state.area, player: state.player, campaign: state.campaign,
    heroes: state.heroes, inventory: state.inventory, gold: state.gold, hx: state.hx, xp: state.xp,
    difficulty: state.difficulty, sp: state.sp, learnedSpells: state.learnedSpells, rng: state.rng, steps: state.steps });
}
function loadUI(fix) {
  fix.context.Q = escape;
  const start = html.indexOf('function focusWayfarerCommission(id)'), end = html.indexOf('function Vt(e,t,n,r=', start);
  assert.ok(start >= 0 && end > start);
  vm.runInContext(html.slice(start, end), fix.context, { timeout: 3000 });
}

test('fresh and preceding saves begin with no tracked goal while retaining their journal and resources', () => {
  const fix = setup();
  assert.equal(fix.game.state.wayfarer.tracked, null);
  accept(fix);
  fix.game.state.wayfarer.kills.R01 = 4;
  assert.equal(fix.game.save(), true);
  const old = JSON.parse(fix.saved.get(fix.context.G));
  delete old.wayfarer.tracked;
  const before = resources(old), beforeJournal = plain(old.wayfarer);
  const imported = fix.context.we(JSON.stringify(old), 7321);
  assert.ok(imported);
  assert.equal(imported.wayfarer.tracked, null);
  const journal = plain(imported.wayfarer); delete journal.tracked;
  assert.deepEqual(journal, beforeJournal);
  assert.deepEqual(resources(imported), before);
});

test('only accepted unlocked unfinished work can be tracked and malformed pointers are discarded', () => {
  const { game, context } = setup();
  for (const id of ['not-a-commission', 'R01-patrol', 'R06-patrol', '', undefined, 3, {}]) assert.equal(game.trackCommission(id), false);
  game.state.wayfarer.accepted['R06-patrol'] = 0;
  assert.equal(game.trackCommission('R06-patrol'), false, 'a forged future acceptance does not bypass the chapter gate');
  const empty = context.wayfarerEmpty();
  for (const pointer of ['not-a-commission', 'R01-patrol', 3, {}, []])
    assert.equal(context.sanitizeWayfarer({ ...plain(empty), tracked: pointer }).tracked, null);
  const journal = { ...plain(empty), accepted: { 'R01-patrol': 0 }, tracked: 'R01-patrol' };
  assert.equal(context.sanitizeWayfarer(journal).tracked, 'R01-patrol');
  assert.equal(context.sanitizeWayfarer({ ...journal, claimed: ['R01-patrol'] }).tracked, null);
});

test('pin switching and clearing save normally without changing combat economy or earned progress', () => {
  const fix = setup(); accept(fix); accept(fix, 'R01-survey');
  const before = resources(fix.game.state);
  assert.equal(fix.game.trackCommission('R01-patrol'), true);
  assert.equal(fix.game.trackCommission('R01-patrol'), true, 'selecting the current goal is harmless');
  assert.equal(fix.game.state.wayfarer.tracked, 'R01-patrol');
  assert.equal(fix.reload().state.wayfarer.tracked, 'R01-patrol');
  assert.equal(fix.game.trackCommission('R01-survey'), true);
  assert.equal(fix.game.state.wayfarer.tracked, 'R01-survey');
  assert.equal(fix.game.trackCommission(null), true);
  assert.equal(fix.reload().state.wayfarer.tracked, null);
  assert.deepEqual(resources(fix.game.state), before);
});

test('tracking cannot change during battles, dialogue, results, introduction or queued story actions', () => {
  const fix = setup(); accept(fix);
  assert.equal(fix.game.trackCommission('R01-patrol'), true);
  const original = plain(fix.game.state);
  const mutations = [
    state => { state.mode = 'battle'; }, state => { state.mode = 'victory'; },
    state => { state.mode = 'intro'; }, state => { state.battle = {}; },
    state => { state.message = { speaker: 'Wayfarer Board', text: 'A report' }; },
    state => { state.reward = {}; }, state => { state.messageQueue = [{ speaker: 'Tavin', text: 'Wait.' }]; },
  ];
  for (const change of mutations) {
    Object.assign(fix.game.state, plain(original)); change(fix.game.state);
    const before = JSON.stringify(fix.game.state);
    assert.equal(fix.game.trackCommission(null), false);
    assert.equal(fix.game.trackCommission('R01-patrol'), false);
    assert.equal(JSON.stringify(fix.game.state), before);
  }
});

test('tracked summaries update from real commission counters and return directions without mutation', () => {
  const fix = setup(); accept(fix);
  assert.equal(fix.game.trackCommission('R01-patrol'), true);
  let before = JSON.stringify(fix.game.state), summary = fix.context.trackedCommission(fix.game.state);
  assert.equal(summary.progressText, '0/6'); assert.match(summary.nextStep, /Defeat 6 more ordinary foes/);
  assert.equal(JSON.stringify(fix.game.state), before);
  fix.game.state.wayfarer.kills.R01 = 6;
  summary = fix.context.trackedCommission(fix.game.state);
  assert.equal(summary.ready, true); assert.equal(summary.progressText, '6/6');
  assert.equal(summary.town, 'camp'); assert.equal(summary.root, 'works');
  assert.match(summary.nextStep, /Return to the Wayfarer Board in Reedbank Shelter/);
  fix.game.state.inventory.POTION = 99;
  before = JSON.stringify(fix.game.state); summary = fix.context.trackedCommission(fix.game.state);
  assert.match(summary.nextStep, /Make room for the whole reward first/);
  assert.equal(JSON.stringify(fix.game.state), before);
});

test('delivering tracked work clears the pointer once and cannot pay again after reload', () => {
  const fix = setup(); accept(fix, 'R01-survey');
  const records = Object.values(fix.context.dungeonAreas).filter(info => info.root === 'works' && info.floor > 1).slice(0, 2);
  fix.game.state.campaign.switches.push(...records.map(info => `depth_works_${info.floor}_record`));
  assert.equal(fix.game.trackCommission('R01-survey'), true);
  assert.equal(fix.context.trackedCommission(fix.game.state).ready, true);
  board(fix);
  const beforeGold = fix.game.state.gold;
  assert.equal(fix.game.claimCommission('R01-survey'), true);
  assert.equal(fix.game.state.wayfarer.tracked, null);
  assert.equal(fix.context.trackedCommission(fix.game.state), null);
  assert.ok(fix.game.state.gold > beforeGold);
  assert.equal(fix.game.claimCommission('R01-survey'), false);
  const loaded = fix.reload();
  assert.equal(loaded.state.mode, 'explore');
  assert.equal(loaded.state.wayfarer.tracked, null);
  assert.equal(loaded.state.gold, fix.game.state.gold);
  clear(loaded);
  assert.equal(loaded.trackCommission('R01-survey'), false);
});

test('journal tracking is separate from board delivery and the exploration row is escaped and battle-free', () => {
  const fix = setup(); accept(fix); loadUI(fix);
  const journal = fix.context.wayfarerJournalUI(fix.game.state, false);
  assert.match(journal, /data-commission-track="R01-patrol"/);
  assert.doesNotMatch(journal, /data-commission-accept=/);
  assert.doesNotMatch(fix.context.wayfarerJournalUI(fix.game.state, true), /data-commission-track=/);
  assert.equal(fix.game.trackCommission('R01-patrol'), true);
  assert.match(fix.context.wayfarerJournalUI(fix.game.state, false), /data-commission-untrack="R01-patrol"/);
  const contract = fix.context.wayfarerContracts.find(contract => contract.id === 'R01-patrol');
  contract.title = '<img src=x onerror=alert(1)>';
  const before = JSON.stringify(fix.game.state), row = fix.context.trackedCommissionUI(fix.game.state);
  assert.match(row, /data-tracked-commission="R01-patrol"/);
  assert.match(row, /data-view-tracked="R01-patrol"/);
  assert.match(row, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(row, /<img/);
  assert.equal(JSON.stringify(fix.game.state), before);
  fix.game.state.mode = 'battle';
  assert.equal(fix.context.trackedCommissionUI(fix.game.state), '');
});
