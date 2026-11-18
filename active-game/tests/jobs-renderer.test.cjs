'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const html = fs.readFileSync(process.env.GAME_HTML || path.join(__dirname, '..', 'The_Road_Beyond_the_Bells.html'), 'utf8');
const start = html.indexOf('function partyAppearance(state,id){');
const end = html.indexOf('function Et(', start);
assert.ok(start > 0 && end > start);
const defaults = {
  Mara: { name:'Mara',job:'warden',hair:'chestnut',skin:'warm',cloak:'gold',hairStyle:'short' },
  Tavin: { name:'Tavin',job:'striker',hair:'chestnut',skin:'warm',cloak:'teal',hairStyle:'tied' },
  Iona: { name:'Iona',job:'mender',hair:'copper',skin:'light',cloak:'gold',hairStyle:'long' },
  Soren: { name:'Soren',job:'arcanist',hair:'black',skin:'warm',cloak:'blue',hairStyle:'short' },
};
const context = vm.createContext({ Pe: defaults });
vm.runInContext(html.slice(start, end), context);

test('all four portraits retain identity and appearance while following any selected job', () => {
  const state = { profile: { ...defaults.Mara, name:'Rowan',skin:'deep',cloak:'plum' }, heroes:Object.keys(defaults).map(id => ({id,name:id==='Mara'?'Rowan':id,job:defaults[id].job})) };
  for (const job of ['warden','striker','scout','mender','arcanist','spellblade']) for (const hero of state.heroes) {
    hero.job = job;
    const before = JSON.stringify(state);
    const appearance = context.partyAppearance(state,hero.id);
    assert.equal(appearance.job,job); assert.equal(appearance.name,hero.name);
    const base = hero.id==='Mara'?state.profile:defaults[hero.id];
    for (const key of ['hair','skin','cloak','hairStyle']) assert.equal(appearance[key],base[key]);
    assert.equal(JSON.stringify(state),before,'rendering does not change saved job or appearance');
  }
  assert.equal(defaults.Iona.job,'mender','canonical companion profile stays intact');
});

