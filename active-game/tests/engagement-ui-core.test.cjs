'use strict';

// Exercise the shipped menu renderer against explicit discovered/commission
// states. Browser QA owns interaction, focus, scrolling and responsive evidence.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const test = require('node:test');
const html = fs.readFileSync(process.env.GAME_HTML || path.join(__dirname, '..', 'The_Road_Beyond_the_Bells.html'), 'utf8');
const start = html.indexOf('function focusWayfarerCommission(id)');
const end = html.indexOf('function Vt(e,t,n,r=', start);
assert.ok(start >= 0 && end > start, 'optional journal UI is integrated');
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);

function fixture() {
  const state = { mode: 'explore', area: 'camp', player: { x: 11, y: 10 }, message: null, reward: null, battle: null };
  const regions = [
    { id: 'R01', name: 'Reedbank', town: 'Reedbank', root: 'works' },
    { id: 'R02', name: 'Saltroad', town: 'Dunmere', root: 'tollhouse' },
  ];
  let contracts = [
    { id: 'R01-patrol', title: 'Keep the road open', description: 'Defeat six foes after accepting.', regionId: 'R01', regionName: 'Reedbank', root: 'works', destinationName: 'Bellworks', accepted: false, claimed: false, available: true, ready: false, progress: [{ label: 'Foes defeated', current: 0, target: 6 }], reward: { gold: 40, items: { POTION: 2 } } },
    { id: 'R01-survey', title: 'Copy the inspection notes', description: 'Inspect two records.', regionId: 'R01', regionName: 'Reedbank', root: 'works', accepted: true, claimed: false, available: true, ready: true, progress: [{ label: 'Records read', current: 2, target: 2 }], reward: { gold: 30, items: {} } },
    { id: 'R01-recovery', title: 'The return route', description: 'Prepare a return path.', regionId: 'R01', regionName: 'Reedbank', root: 'works', accepted: true, claimed: true, available: true, ready: true, progress: [{ label: 'Service lifts', current: 1, target: 1 }], reward: { gold: 20, items: {} }, completionText: 'The next crew can return safely.' },
  ];
  const data = { boardRegion: null, bestiary: [], totalDefeated: 0, safe: true,
    tales: [{ id: 'first-watch', title: 'A spare watch', teaser: 'Tavin counts the missing names.', stage: 0, unlocked: true, available: true, heard: false }] };
  const ui = vm.createContext({
    Q: escape, f: {}, K: id => ({ name: id === 'POTION' ? 'Field Potion' : id }),
    p: () => data.safe, campTales: () => data.tales,
    wayfarerSummary: (value, selected = 'R01') => ({ regionId: selected, regionName: regions.find(region => region.id === selected)?.name || selected, regions, contracts, boardRegion: data.boardRegion, bestiary: data.bestiary, totalDefeated: data.totalDefeated }),
  });
  vm.runInContext(html.slice(start, end), ui, { timeout: 3000 });
  return { state, data, ui, contracts, render: board => ui.wayfarerJournalUI(state, board) };
}

test('journal gives progress and return directions without exposing remote acceptance or payout controls', () => {
  const { state, render } = fixture();
  const before = JSON.stringify(state), markup = render(false);
  assert.match(markup, /Wayfarer journal sections/);
  assert.match(markup, /data-wayfarer-region="R02"/);
  assert.match(markup, /Foes defeated<\/span><strong>0 \/ 6/);
  assert.match(markup, /Return to the Wayfarer Board in Reedbank/);
  assert.match(markup, /Field Potion ×2/);
  assert.doesNotMatch(markup, /data-commission-accept=/);
  assert.doesNotMatch(markup, /data-commission-claim=/);
  assert.equal(JSON.stringify(state), before, 'reading goals cannot mutate the journey');
});

test('a local board exposes separate accept/deliver actions and never reclaims completed work', () => {
  const { data, render } = fixture(); data.boardRegion = 'R01';
  const markup = render(true);
  assert.match(markup, /data-commission-accept="R01-patrol"/);
  assert.match(markup, /data-commission-claim="R01-survey"[^>]*>Deliver commission/);
  assert.doesNotMatch(markup, /data-commission-claim="R01-recovery"/);
  assert.match(markup, /The next crew can return safely/);
  assert.match(markup, /1 \/ 3 delivered/);
});

test('wrong-region and locked commissions cannot expose board mutations', () => {
  const { data, contracts, render } = fixture(); data.boardRegion = 'R02';
  contracts[0].available = false;
  const markup = render(true);
  assert.doesNotMatch(markup, /data-commission-accept=/);
  assert.doesNotMatch(markup, /data-commission-claim=/);
  assert.match(markup, /Not yet available/);
  assert.match(markup, /Continue the main journey to unlock this region/);
});

test('a full pack blocks a ready reward visibly instead of hiding the reason', () => {
  const { data, contracts, render } = fixture(); data.boardRegion = 'R01';
  contracts[1].claimBlocked = 'Make room for Field Potions before collecting this reward.';
  const markup = render(true);
  assert.match(markup, /data-commission-claim="R01-survey" disabled/);
  assert.match(markup, /Make room for Field Potions before collecting this reward/);
});

test('bestiary starts empty and displays only supplied discovered entries without manufacturing progress', () => {
  const { data, ui, render } = fixture(); ui.wayfarerTab = 'bestiary';
  assert.match(render(false), /first page is still blank/);
  data.bestiary = [{ key: 'R01:WISP:ashen', name: 'Ashen Wisp', family: 'WISP', regionId: 'R01', rank: 'ashen', defeated: 3, weakness: ['light'], resistance: ['slash', 'pierce'] }]; data.totalDefeated = 3;
  const before = JSON.stringify(data), markup = render(false);
  assert.match(markup, /data-bestiary-key="R01:WISP:ashen"/);
  assert.match(markup, /1 entry · 3 foes defeated/);
  assert.match(markup, /<dt>Weakness<\/dt><dd>light/);
  assert.match(markup, /<dt>Resists<\/dt><dd>slash, pierce/);
  assert.equal(JSON.stringify(data), before);
});

test('saved and catalog text is escaped in commission and bestiary windows', () => {
  const { contracts, data, ui, render } = fixture();
  contracts[0].title = '<img src=x onerror=alert(1)>';
  contracts[0].description = '<script>bad()</script>';
  let markup = render(false);
  assert.match(markup, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(markup, /<img|<script>/);
  ui.wayfarerTab = 'bestiary';
  data.bestiary = [{ key: '"><img>', name: '<img>', family: '<b>', regionId: 'R01', rank: 'base', defeated: 1, weakness: ['<script>'], resistance: [] }];
  markup = render(false); assert.doesNotMatch(markup, /<img|<script>/);
  assert.match(markup, /&lt;script&gt;/);
});

test('camp conversations distinguish stage unlocks, remembered tales and safe replay conditions', () => {
  const { state, data, ui, render } = fixture(); ui.wayfarerTab = 'tales';
  assert.match(render(false), /data-camp-tale="first-watch" >Sit with the party/);
  data.safe = false; data.tales[0].available = false;
  let markup = render(false);
  assert.match(markup, /New conversation/);
  assert.match(markup, /Tavin counts the missing names/);
  assert.match(markup, /data-camp-tale="first-watch" disabled/);
  assert.match(markup, /Find a safe shelter/);
  data.safe = true; data.tales[0].available = true; data.tales[0].heard = true;
  markup = render(false); assert.match(markup, /Remembered/); assert.match(markup, /Hear it again/);
  state.message = { speaker: 'Someone', text: 'Already talking' };
  assert.match(render(false), /data-camp-tale="first-watch" disabled/);
  data.tales[0].unlocked = false; data.tales[0].available = false; data.tales[0].heard = false;
  markup = render(false); assert.match(markup, /Not yet available/); assert.doesNotMatch(markup, /Tavin counts the missing names/);
});
