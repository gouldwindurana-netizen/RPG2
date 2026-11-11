import { canCast, getItem, MAPS, SPELLS } from './engine';
import { AREA_INFO, getObjective, QUEST_TITLES, regionAt, TRANSITIONS } from './campaign';
import { jobFor } from './characters';
import type { GameState, HeroId } from './contracts';
import itemData from '../data/items.json';
import progression from '../data/progression.json';
import world from '../data/world.json';

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function setDescription(state: GameState, id: HeroId): string {
  const hero = state.heroes.find(h=>h.id===id)!;
  const worn = Object.values(hero.equipment);
  return itemData.sets.map(set=>{
    const count=worn.filter(item=>set.pieces.includes(item)).length;
    if(!count)return '';
    const bonus=(data:Record<string,number|undefined>)=>Object.entries(data).filter(([,value])=>value!==undefined).map(([key,value])=>`${key.replace(/_(percent|pp)$/,'').replaceAll('_',' ')} +${value}%`).join(', ');
    return `${set.name} ${count}/3 · 2: ${bonus(set.two_piece_bonus)} · 3: ${bonus(set.three_piece_additional_bonus)}`;
  }).filter(Boolean).join(' | ') || 'Regional sets grant bonuses at 2 and 3 pieces on the same traveler.';
}
export function mainMenu(state:GameState, portrait:(id:HeroId,size:number)=>string):string {
  return `<div class="classic-menu-layout"><nav class="classic-menu-options" aria-label="Party menu">${[['inventory','Items / Equipment'],['magic','Magic'],['status','Status'],['worldmap','World Map'],['guide','Journal'],['help','System']].map(([id,title])=>`<button data-panel="${id}" ${state.mode==='battle'&&['inventory','magic'].includes(id)?'disabled':''}>${title}</button>`).join('')}</nav><div class="menu-party">${state.heroes.map(h=>`<button data-status-hero="${h.id}" class="menu-party-row">${portrait(h.id,48)}<span><strong>${esc(h.name)}</strong><small>${esc(h.role)} · Lv ${h.level}</small><span>HP ${h.hp} / ${h.maxHp}${h.status?' · '+esc(h.status):''}</span></span></button>`).join('')}</div></div><div class="menu-summary"><span>${esc(AREA_INFO[state.area].name)}</span><span>${state.gold.toLocaleString()} gold</span><span>${state.steps.toLocaleString()} steps</span></div>`;
}
export function heroTabs(state:GameState,selected:HeroId):string {
  return `<div class="hero-tabs">${state.heroes.map(h=>`<button class="${h.id===selected?'active':''}" data-pack-hero="${h.id}">${esc(h.name)}</button>`).join('')}</div>`;
}
export function statusMenu(state:GameState,selected:HeroId,portrait:(id:HeroId,size:number)=>string):string {
  const h=state.heroes.find(hero=>hero.id===selected)!;
  const next=progression.xp_thresholds[h.level];
  return `${heroTabs(state,selected)}<div class="status-profile">${portrait(h.id,80)}<div><h3>${esc(h.name)}</h3><p>${esc(h.role)} · Level ${h.level}</p><p>${esc(jobFor(h.job).trait)}</p></div></div><dl class="status-stats">${[['HP',`${h.hp} / ${h.maxHp}`],['Attack',h.attack],['Defense',h.defense],['Magic',h.magic],['Accuracy',h.accuracy],['Hits',h.hits],['EXP',state.xp.toLocaleString()],['Next level',next===undefined?'MAX':`${Math.max(0,next-state.xp).toLocaleString()} EXP`]].map(([label,value])=>`<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl><h3>Spell charges</h3><div class="charge-table">${h.charges.map((charge,i)=>`<div class="${h.maxCharges[i]?'unlocked':''}"><small>Tier ${i+1}</small><strong>${charge} / ${h.maxCharges[i]}</strong></div>`).join('')}</div><h3>Equipment</h3><dl class="equipment-summary">${Object.entries(h.equipment).map(([slot,id])=>`<div><dt>${esc(slot)}</dt><dd>${esc(getItem(id)?.name??'None')}</dd></div>`).join('')}</dl><p class="pack-hint">${esc(setDescription(state,h.id))}</p>`;
}
export function magicMenu(state:GameState,selected:HeroId,pendingSpell:string|null):string {
  const hero=state.heroes.find(h=>h.id===selected)!;
  const spell=SPELLS.find(sp=>sp.id===pendingSpell&&canCast(hero,sp));
  if(spell)return `${heroTabs(state,selected)}<div class="command-heading"><strong>${esc(spell.name)} · Choose a traveler</strong><button data-field-back>Back</button></div><p>${esc(spell.description)}</p><div class="field-targets">${state.heroes.map(h=>`<button data-field-target="${h.id}"><strong>${esc(h.name)}</strong><span>HP ${h.hp} / ${h.maxHp}${h.status?' · '+h.status:''}</span></button>`).join('')}</div>`;
  const available=SPELLS.filter(sp=>canCast(hero,sp));
  return `${heroTabs(state,selected)}<p class="muted">Healing and recovery magic can be used on the road. Rest at a shelter or inn to restore tier charges.</p>${available.length?Array.from({length:8},(_,i)=>{
    const spells=available.filter(sp=>sp.tier===i+1);if(!spells.length)return '';
    return `<section class="spell-tier"><h3>Tier ${i+1}<span>${hero.charges[i]} / ${hero.maxCharges[i]} charges</span></h3><div class="field-spells">${spells.map(sp=>{const usable=['heal','cure','revive'].includes(sp.effect??'');return `<button data-field-spell="${sp.id}" ${!usable||!hero.charges[i]||hero.status==='silence'?'disabled':''}><strong>${esc(sp.name)}</strong><small>${esc(sp.description)}${usable?'':' · Battle only'}</small></button>`;}).join('')}</div></section>`;
  }).join(''):`<p>${esc(hero.name)} follows a martial job and has no spells. Select Iona or Soren to view their magic.</p>`}`;
}
export function worldMap(state:GameState):string {
  const map=MAPS.overworld;
  const colors:Record<string,string>={g:'#477b55',d:'#c8b071',s:'#8e9965',f:'#436653',b:'#dec890',w:'#235c9a','#':'#777a90',t:'#285b40',T:'#27503f','^':'#81859a'};
  const biomes=['#477b55','#a9a06a','#456c62','#73834b','#75778b','#667a91'];
  const paths:Record<string,string>={};
  map.tiles.forEach((row,y)=>Array.from(row).forEach((tile,x)=>{const region=Number(regionAt('overworld',x,y).slice(1))-1;const color=tile==='g'?biomes[region]:colors[tile]??biomes[region];paths[color]=(paths[color]??'')+`M${x} ${y}h1v1h-1z`;}));
  const player=state.area==='overworld'?state.player:state.overworldReturn;
  return `<p class="map-caption">Avel · Walk the roads to reach towns and dungeons. New crossings open as the story advances.</p><svg class="world-atlas" viewBox="0 0 ${map.width} ${map.height}" role="img" aria-label="World map of Avel with the party marked by a white diamond">${Object.entries(paths).map(([color,d])=>`<path fill="${color}" d="${d}"/>`).join('')}${map.entities.filter(e=>e.id.startsWith('enter-')).map(e=>{const route=TRANSITIONS[e.id];const locked=route&&(state.campaign.stage<(route.minStage??0)||route.requiredSwitch&&!state.campaign.switches.includes(route.requiredSwitch));return `<g><title>${esc(e.name)}${locked?' · route not yet open':''}</title><rect x="${e.x-.55}" y="${e.y-.55}" width="1.1" height="1.1" fill="${locked?'#7783a2':'#ffe3a1'}" stroke="#152451" stroke-width=".2"/></g>`;}).join('')}<path d="M${player.x} ${player.y-1}l.8 1-.8 1-.8-1z" fill="white" stroke="#101d65" stroke-width=".2"/></svg><div class="atlas-legend"><span>◇ Party</span><span>■ Town / dungeon</span><span class="muted">■ Unopened route</span></div><div class="atlas-places">${world.regions.map(r=>`<div><strong>${esc(r.name)}</strong><span>Lv ${r.level_min}–${r.level_max}</span></div>`).join('')}</div><p class="pack-hint">Monster levels are fixed by region. Stronger color variants are more dangerous. Towns are safe; prepare before crossing into the next region.</p>`;
}
export function journal(state:GameState):string {
  const objective=getObjective(state),region=regionAt(state.area,state.player.x,state.player.y),hunt=state.hunts[region];
  return `<div class="journal-objective"><span class="eyebrow">CURRENT OBJECTIVE</span><h3>${esc(objective[0])}</h3><p>${esc(objective[1])}</p></div><details class="quest-progress"><summary>The journey · ${Math.min(state.campaign.stage,10)} / 10</summary><ol>${QUEST_TITLES.slice(0,10).map((title,i)=>`<li class="${i<state.campaign.stage?'finished':i===state.campaign.stage?'current':''}">${i<state.campaign.stage?'✓ ':''}${esc(title)}</li>`).join('')}</ol></details><div class="journal-grid"><section><h3>Regional enemies</h3>${world.enemies.filter(e=>e.region_id===region).map(e=>`<div class="journal-entry"><strong>${esc(e.name)}</strong><span>Lv ${e.level} · Weakness: ${esc(e.weakness.join(', ')||'none')}</span><p>${esc(e.counter)}</p></div>`).join('')}</section><section><h3>Regional hunt</h3><p>${esc(world.rares.find(r=>r.region_id===region)?.name??'Unknown rare')} · ${hunt?.ready?'Tracks complete: hunt available.':`${hunt?.wins??0} / 12 victories tracked.`}</p><p>After the regional story is cleared, each victory has a 2% sighting chance. Twelve victories guarantee tracks. Each hunt offers an unowned regional set piece.</p><h3>On the road</h3><p>Explore for a set cache, defeat the regional boss, then track its rare monster. Sets are optional alternatives to equipment sold in each town.</p><p>Enemies stay at their regional strength. Higher level color variants can appear in the same family. Retreat, recover and buy equipment before a dangerous crossing.</p><p>Plan every traveler’s action before resolving a round. Exploit weaknesses and guard against announced heavy attacks. Charges persist between encounters.</p></section></div>`;
}
