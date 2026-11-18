import { canCast, getItem, isEquipmentAllowed, MAPS, shopOffers, SPELLS } from './engine';
import { AREA_INFO, getObjective, QUEST_TITLES, regionAt, TRANSITIONS } from './campaign';
import { jobFor } from './characters';
import type { GameMap, GameState, HeroId } from './contracts';
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
  return `<div class="classic-menu-layout"><nav class="classic-menu-options" aria-label="Party menu">${[['inventory','Items / Equipment'],['magic','Magic'],['status','Status'],['localmap','Area Map'],['worldmap','World Map'],['guide','Journal'],['help','System']].map(([id,title])=>`<button data-panel="${id}" ${state.mode==='battle'&&['inventory','magic'].includes(id)?'disabled':''}>${title}</button>`).join('')}</nav><div class="menu-party">${state.heroes.map(h=>`<button data-status-hero="${h.id}" class="menu-party-row">${portrait(h.id,48)}<span><strong>${esc(h.name)}</strong><small>${esc(h.role)} · Lv ${h.level}</small><span>HP ${h.hp} / ${h.maxHp}${h.status?' · '+esc(h.status):''}</span></span></button>`).join('')}</div></div><div class="menu-summary"><span>${esc(AREA_INFO[state.area].name)}</span><span>${state.gold.toLocaleString()} gold</span><span>${state.steps.toLocaleString()} steps</span></div>`;
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

export function mapTabs(active:'localmap'|'worldmap'):string {
  return `<nav class="map-tabs" aria-label="Map view"><button data-panel="localmap" aria-pressed="${active==='localmap'}">Area map</button><button data-panel="worldmap" aria-pressed="${active==='worldmap'}">World map</button></nav>`;
}

export function areaMap(state:GameState,map:GameMap):string {
  const colors:Record<string,string>={g:'#557c58',d:'#c5ac77',s:'#a2a49d',f:'#8e7660',b:'#dfc48b',w:'#245f92','#':'#3d4766',t:'#284c3d',T:'#5b647b','^':'#8791a6'};
  const paths:Record<string,string>={};
  map.tiles.forEach((row,y)=>Array.from(row).forEach((tile,x)=>{paths[tile]=(paths[tile]??'')+`M${x} ${y}h1v1h-1z`;}));
  const points=map.entities.filter(e=>e.kind!=='enemy');
  const total=MAPS[state.area].entities.filter(e=>e.kind==='chest').length;
  const remaining=map.entities.filter(e=>e.kind==='chest').length;
  const pointColor=(kind:string)=>kind==='exit'?'#a1e5ff':kind==='chest'?'#ffe3a0':kind==='boss'?'#ff9da3':kind==='rare'?'#e9c2ff':'#eaf3ff';
  return `${mapTabs('localmap')}<div class="area-map-summary"><strong>${esc(map.name??AREA_INFO[state.area].name)}</strong><span>${map.safe?'Sanctuary':map.kind==='world'?'Overworld':'Explore with care'}${total?` · Treasure ${total-remaining} / ${total}`:''}</span></div><svg class="world-atlas area-atlas" viewBox="0 0 ${map.width} ${map.height}" role="img" aria-label="Area map of ${esc(map.name??state.area)}, showing the party, exits, people and treasure">${Object.entries(paths).map(([tile,d])=>`<path fill="${colors[tile]??'#8e7660'}" d="${d}"/>`).join('')}${points.map(e=>`<g><title>${esc(e.name)}</title>${e.kind==='exit'?`<rect x="${e.x+.1}" y="${e.y+.1}" width=".8" height=".8" fill="${pointColor(e.kind)}" stroke="#14204c" stroke-width=".12"/>`:`<circle cx="${e.x+.5}" cy="${e.y+.5}" r=".38" fill="${pointColor(e.kind)}" stroke="#14204c" stroke-width=".12"/>`}</g>`).join('')}<path d="M${state.player.x+.5} ${state.player.y-.25}l.55 1.2-.55-.3-.55.3z" fill="#fff" stroke="#101950" stroke-width=".13"/></svg><div class="atlas-legend"><span>▲ Party</span><span>■ Door / exit</span><span>● Person</span><span class="treasure-key">● Treasure</span></div><div class="area-destinations">${points.filter(e=>e.kind==='exit'||e.kind==='chest'||e.kind==='campfire'||e.id.startsWith('shop-')||e.id.startsWith('inn-')||e.id==='merchant').map(e=>`<div><span style="color:${pointColor(e.kind)}">${e.kind==='exit'?'↗':'◇'} ${esc(e.name)}</span><small>${e.x+1}, ${e.y+1}</small></div>`).join('')}</div><p class="pack-hint">Walk onto a doorway or road exit to travel. Speak to people with E or Space. The map never moves the party.</p>`;
}

export type ShopFilter='all'|'supplies'|'weapons'|'armor';
export function shopMenu(state:GameState,selected:HeroId,filter:ShopFilter):string {
  const hero=state.heroes.find(h=>h.id===selected)!;
  const offers=shopOffers(state).filter(offer=>{const item=getItem(offer.itemId)!;return filter==='all'||filter==='supplies'&&item.kind==='consumable'||filter==='weapons'&&item.slot==='weapon'||filter==='armor'&&item.kind==='equipment'&&item.slot!=='weapon';});
  return `<div class="shop-wallet"><strong>${state.gold.toLocaleString()} gold</strong><span>Shared party funds</span></div><nav class="shop-filters" aria-label="Shop category">${(['all','supplies','weapons','armor'] as const).map(id=>`<button data-shop-filter="${id}" aria-pressed="${filter===id}">${id[0].toUpperCase()+id.slice(1)}</button>`).join('')}</nav>${heroTabs(state,selected)}<p class="shop-comparison">Compare equipment for <strong>${esc(hero.name)}</strong> · ${esc(hero.role)}</p><div class="shop-list">${offers.map(offer=>{
    const item=getItem(offer.itemId)!,fits=item.kind==='equipment'&&isEquipmentAllowed(hero,item),worn=item.slot?getItem(hero.equipment[item.slot]):undefined;
    const changes=Object.keys({...worn?.stats,...item.stats}).map(stat=>{const delta=(item.stats?.[stat]??0)-(worn?.stats?.[stat]??0);return delta?`<span class="${delta>0?'stat-up':'stat-down'}">${delta>0?'+':''}${delta} ${esc(stat)}</span>`:'';}).filter(Boolean).join(' · ');
    return `<div class="inventory-row shop-row"><span><strong>${esc(item.name)}</strong><small>${esc(item.effect??item.slot??'')} · Carrying ${state.inventory[item.id]??0}</small>${item.kind==='equipment'?`<small>${fits?`Fits ${esc(hero.name)}${changes?' · '+changes:' · Same stats'}`:'For another job'}</small>`:''}</span><span class="shop-purchase"><strong>${offer.price} G</strong><button class="small-button" data-buy="${item.id}" ${state.gold<offer.price||(state.inventory[item.id]??0)>=99?'disabled':''}>Buy</button></span></div>`;
  }).join('')||'<p>No stock in this category.</p>'}</div><p class="shop-equipment-note">Bought equipment goes into the shared pack. Equip it from Items / Equipment.</p>`;
}
