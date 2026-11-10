import './style.css';
import './new-game.css';
import { createEngine, getItem, ITEMS, SPELLS, canCast, isEquipmentAllowed } from './engine';
import { DEFAULT_PROFILE, getIntroSteps, normalizeProfile, jobFor } from './characters';
import { portraitSvg, companionPortraitSvg } from './appearance';
import { titleScreen, creatorScreen, type CreationStep } from './new-game';
import { GameRenderer } from './renderer';
import type { CharacterProfile, Direction, HeroId, PlannedAction, Spell } from './contracts';
import worldData from '../data/world.json';

const bell = '<svg viewBox="0 0 32 36" fill="none" aria-hidden="true"><path d="M9 25V13a7 7 0 0 1 14 0v12l4 4H5l4-4Z" stroke="currentColor" stroke-width="2"/><path d="M13 32h6M16 2v3M16 11v9" stroke="currentColor" stroke-width="2"/></svg>';
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <header class="masthead">
    <a class="wordmark" href="#" aria-label="The Road Beyond the Bells">${bell}<span><small>THE ROAD</small>BEYOND THE BELLS</span></a>
    <div class="edition"><span class="status-dot"></span> FIRST WATCH <span class="edition-divider">/</span> PLAYABLE DEMO</div>
    <nav class="tools" aria-label="Game menus"><button data-panel="guide" title="Field journal">Journal</button><button data-panel="inventory" title="Items and equipment" id="pack-button">Pack <span id="pack-count"></span></button><button id="battle-speed" class="speed-control" title="Battle speed">1× speed</button><button id="sound-button" aria-label="Enable sound" title="Enable sound">Sound off</button><button data-panel="help" class="help-button" aria-label="Controls and settings">?</button></nav>
  </header>
  <main class="game-shell">
    <div class="chapter-heading"><div><span class="eyebrow">CHAPTER I · THE SILENT WATCH</span><h1>A bell without a voice.</h1></div><div class="journey-status"><span id="level-label">LEVEL 1</span><span class="gold-symbol">◇</span><strong id="gold-label">0</strong><span class="muted">gold</span></div></div>
    <div class="play-layout">
      <section class="stage-wrap" aria-label="Game world">
        <div class="scene-topline"><span class="location-pin">⌁</span><span id="location-name">Reedbank</span><span id="scene-state">THE LAST LIGHT OF DAY</span></div>
        <div class="canvas-shell"><div id="game-world" aria-label="Pixel art world. Move with arrow keys or WASD. Click a destination to walk." role="application" tabindex="0"></div><div id="world-tip" class="world-tip"></div><div class="touch-pad" aria-label="Movement"><button data-move="up" aria-label="Move up">↑</button><div><button data-move="left" aria-label="Move left">←</button><button data-move="down" aria-label="Move down">↓</button><button data-move="right" aria-label="Move right">→</button></div></div></div>
        <div class="stage-foot"><span><i class="legend-dot player-dot"></i> YOUR PARTY</span><span><i class="legend-dot amber-dot"></i> INTERACTION</span><span class="stage-foot-right">CLICK TO WALK <b>·</b> <kbd>E</kbd> INTERACT</span></div>
      </section>
      <aside class="party-sidebar" aria-label="Your party"><div class="section-label">THE TRAVELERS <span>IV</span></div><div id="party"></div><div class="party-note"><span class="small-bell">♧</span><span id="party-note">Four strangers. One road home.</span></div></aside>
    </div>
    <section id="action-panel" class="action-panel" aria-label="Game actions"></section>
    <footer class="page-foot"><span>A SMALL EXPEDITION INTO AVEL</span><span id="save-status">SAVED ON THIS DEVICE</span><button data-panel="help">Controls & settings</button></footer>
  </main><div id="modal-root"></div><div id="front-root"></div><div id="intro-root"></div><div id="toast" role="status" aria-live="polite"></div>`;

const engine = createEngine({ roundDelay: 270 });
const $ = (id: string) => document.getElementById(id)!;
const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
let selected: HeroId = 'Mara';
let panel: 'inventory' | 'guide' | 'help' | 'restart' | null = null;
let menu: 'commands' | 'spells' | 'items' = 'commands';
let pending: { type: 'attack' | 'spell' | 'item'; spell?: Spell; itemId?: string; ally: boolean } | null = null;
let sound = false;
let audio: AudioContext | null = null;
let previousMode = engine.state.mode;
let previousBattlePhase: string|undefined;
let toastTimer = 0;
let modalKey = '';
let returnFocus: HTMLElement | null = null;
let persistenceAvailable = false;
const shop = [{id:'POTION',price:30},{id:'ANTIDOTE',price:20},{id:'CLEAR_TONIC',price:35},{id:'REVIVAL_SALT',price:300}];

function portrait(id: string, size = 36) {
  return id==='Mara' ? portraitSvg(engine.state.profile,size) : companionPortraitSvg(id as HeroId,size);
}
function heroName(id: HeroId) {return engine.state.heroes.find(h=>h.id===id)!.name;}
let frontView: 'title'|'creator'|null = 'title';
let draft: CharacterProfile = structuredClone(DEFAULT_PROFILE);
let creationStep: CreationStep = 0;
let introFocusKey = '';

function renderFront() {
  document.body.classList.toggle('front-menu',frontView!==null);
  document.body.classList.toggle('in-prologue',engine.state.mode==='intro'&&frontView===null);
  const block=frontView!==null||engine.state.mode==='intro';
  document.querySelector<HTMLElement>('.game-shell')!.inert=block;
  document.querySelector<HTMLElement>('.masthead')!.inert=block;
  $('front-root').innerHTML=frontView==='title'?titleScreen(engine.state):frontView==='creator'?creatorScreen(draft,creationStep,engine.state.mode!=='creation'):'';
  if(frontView){$('intro-root').innerHTML='';return;}
  if(engine.state.mode==='intro') {
    const steps=getIntroSteps(engine.state.profile), step=steps[engine.state.introStep];
    const face=step.portrait==='Mara'?portrait('Mara',80):step.portrait==='narrator'?bell:step.portrait==='bessa'?portraitSvg({...DEFAULT_PROFILE,job:'warden',hair:'silver',cloak:'gold'},80):portrait(step.portrait,80);
    $('intro-root').innerHTML=`<div class="prologue-scrim"><section class="prologue-dialog" role="dialog" aria-modal="true" aria-labelledby="prologue-speaker" tabindex="-1"><div class="prologue-topline"><span class="eyebrow">PROLOGUE · ${engine.state.introStep+1} / ${steps.length}</span><button data-intro="skip" class="text-button">Skip introduction</button></div><div class="prologue-content"><div class="prologue-portrait ${step.portrait==='narrator'?'narrator':''}">${face}</div><div><span class="eyebrow">${esc(step.role)}</span><h2 id="prologue-speaker">${esc(step.speaker)}</h2><p>${esc(step.text)}</p></div></div><div class="prologue-footer"><div class="prologue-dots">${steps.map((_,i)=>`<i class="${i===engine.state.introStep?'current':i<engine.state.introStep?'complete':''}"></i>`).join('')}</div><button class="primary" data-intro="next">${engine.state.introStep===steps.length-1?'Enter Reedbank':'Continue'} <span>→</span></button></div></section></div>`;
    const key=String(engine.state.introStep);
    if(key!==introFocusKey){introFocusKey=key;requestAnimationFrame(()=>$('intro-root').querySelector<HTMLElement>('[data-intro="next"]')?.focus({preventScroll:true}));}
  } else {$('intro-root').innerHTML='';introFocusKey='';}
}

function frontAction(action:string) {
  if(action==='new'){draft=structuredClone(DEFAULT_PROFILE);creationStep=0;frontView='creator';}
  if(action==='continue'){frontView=null;}
  if(action==='cancel'||action==='title'){frontView='title';panel=null;}
  if(action==='back'){creationStep=Math.max(0,creationStep-1) as CreationStep;}
  if(action==='next'){if(!normalizeProfile(draft))return;creationStep=Math.min(2,creationStep+1) as CreationStep;}
  if(action==='begin'){
    const valid=normalizeProfile(draft);if(!valid)return;
    frontView=null;panel=null;
    if(!engine.beginAdventure(valid)){frontView='creator';notify('Finish the current action before beginning again.');}
    selected='Mara';pending=null;menu='commands';
  }
  if(action==='how') {notify('Create your hero, then walk with WASD, arrows, or map clicks. Plan all four actions in battle.');return;}
  render();
  if(frontView==='creator')requestAnimationFrame(()=>creationStep===0?$('hero-name')?.focus({preventScroll:true}):$('front-root').querySelector<HTMLElement>('button[data-job],button[data-custom]')?.focus({preventScroll:true}));
  if(!frontView&&engine.state.mode==='explore')requestAnimationFrame(()=>$('game-world').querySelector<HTMLCanvasElement>('canvas')?.focus({preventScroll:true}));
}
function notify(text: string) {
  $('toast').textContent = text; $('toast').classList.add('visible');
  clearTimeout(toastTimer); toastTimer = window.setTimeout(() => $('toast').classList.remove('visible'), 2600);
}
function chime(notes = [293.66, 440]) {
  if (!sound) return;
  try {
    audio ??= new AudioContext(); void audio.resume();
    notes.forEach((f, i) => { const o = audio!.createOscillator(), g = audio!.createGain(); o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(audio!.destination); const t = audio!.currentTime + i * .09; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.035, t + .015); g.gain.exponentialRampToValueAtTime(.001, t + .32); o.start(t); o.stop(t + .35); });
  } catch { sound = false; }
}
function setPanel(next: typeof panel) { returnFocus = document.activeElement as HTMLElement; panel = next; renderModal(); }
function heroSetCount(id: HeroId) { const h = engine.state.heroes.find(h => h.id === id)!; return Object.values(h.equipment).filter(i => getItem(i)?.set_id === 'R01_SET').length; }

function renderParty() {
  const state = engine.state, battle = state.battle;
  $('party').innerHTML = state.heroes.map(hero => {
    const planned = battle?.plans[hero.id];
    const action = planned ? (planned.type === 'spell' ? SPELLS.find(s => s.id === planned.spellId)?.name ?? 'Magic' : planned.type === 'item' ? 'Item' : planned.type === 'guard' ? 'Guard' : 'Attack') : '';
    const fraction = hero.hp / hero.maxHp, count = heroSetCount(hero.id);
    return `<button class="hero-card ${hero.id === selected && state.mode === 'battle' ? 'selected' : ''} ${hero.hp <= 0 ? 'fallen' : ''}" data-hero="${hero.id}" aria-label="${esc(hero.name)}, level ${hero.level}, ${hero.hp} of ${hero.maxHp} HP${planned ? `, ${esc(action)} planned` : ''}"><span class="portrait ${hero.id.toLowerCase()}">${portrait(hero.id, 48)}</span><span class="hero-detail"><span class="hero-name"><span class="hero-display-name">${esc(hero.name)}</span><span class="hero-level">LV ${hero.level}</span></span><span class="hero-role">${esc(hero.role)} ${hero.status ? `<b class="status-tag">${hero.status}</b>` : ''}</span><span class="hp-track"><span style="width:${Math.max(0, fraction * 100)}%;background:${fraction < .25 ? '#cd786e' : '#81aa91'}"></span></span><span class="hero-numbers"><span>${hero.hp}<i> / ${hero.maxHp} HP</i></span><span class="charge-dots" title="Tier one spell charges">${hero.maxCharges[0] ? Array.from({length:hero.maxCharges[0]},(_,i) => `<i class="${i < hero.charges[0] ? 'filled' : ''}"></i>`).join('') : '<span class="martial-mark">—</span>'}</span></span>${planned ? `<span class="plan-label">✓ ${esc(action)} queued</span>` : count > 1 ? `<span class="plan-label">Reedwatch ${count}/3</span>` : ''}</span></button>`;
  }).join('');
  const low = state.heroes.some(h => h.hp < h.maxHp * .35);
  $('party-note').textContent = state.mode === 'battle' ? 'Choose for everyone. Then resolve the round.' : low ? 'The campfire restores HP and spell charges.' : 'Four strangers. One road home.';
}

function objective() {
  const s = engine.state;
  if (s.flags.completed) return ['A road worth walking.', s.rareReady ? 'The camp is safe. A Silver Reedback has been spotted in the eastern clearing. This showcase hunt completes your regional collection.' : 'Orren is safe. Explore, try new equipment, or begin the expedition again.'];
  if (s.flags.bossDefeated) return ['Bring Orren back to camp.', 'Return through the western entrance and speak to Bessa. The machinery has fallen silent.'];
  if (s.area === 'works') return ['Find the missing crew.', 'Explore the bellworks, recover the inspection cache, and free the worker held by the Brass Bailiff.'];
  return ['The Silent Watch', s.flags.briefed ? 'Follow the eastern path into Merewatch. Speak to Bessa, prepare at the campfire, and keep your party together.' : 'Speak to Bessa near the watchfire. Merewatch has fallen silent, and the repair crew has not returned.'];
}
function renderActions() {
  const s = engine.state, b = s.battle;
  if (s.mode === 'battle' && b) {
    if (s.heroes.find(h => h.id === selected)!.hp <= 0) selected = s.heroes.find(h => h.hp > 0)?.id ?? 'Mara';
    const hero = s.heroes.find(h => h.id === selected)!;
    const eligible = s.heroes.filter(h => h.hp > 0 && h.status !== 'sleep');
    const ready = eligible.every(h => b.plans[h.id]);
    const busy = b.phase === 'resolving';
    let commands = '';
    if (busy) commands = `<div class="resolving"><span class="resolve-orbit"></span><strong>The round unfolds…</strong><span>Watch the enemy's next intent.</span></div>`;
    else if (pending) {
      const targets = pending.ally ? s.heroes : b.enemies.filter(e => e.hp > 0);
      commands = `<div class="command-heading"><strong>Choose a ${pending.ally ? 'traveler' : 'target'}</strong><button data-command="back" class="text-button">← Back</button></div><div class="target-list">${targets.map(t => `<button data-target="${esc(t.id)}" class="target-button"><span>${esc('rank' in t && t.rank === 'boss' ? '◇ ' : '')}${esc(t.id in {Mara:1,Tavin:1,Iona:1,Soren:1} ? heroName(t.id as HeroId) : (t as {name?:string}).name)}</span><small>${t.hp} / ${t.maxHp} HP</small></button>`).join('')}</div>`;
    } else if (menu === 'spells') {
      const spells = SPELLS.filter(sp => canCast(hero,sp));
      commands = `<div class="command-heading"><strong>${esc(heroName(selected))}'s magic</strong><button data-command="back" class="text-button">← Back</button></div><div class="ability-list">${spells.map(sp => `<button data-spell="${esc(sp.id)}" ${!hero.charges[sp.tier - 1] || hero.status === 'silence' ? 'disabled' : ''}><span>${esc(sp.name)} <small>T${sp.tier} · ${hero.charges[sp.tier - 1] ?? 0}/${hero.maxCharges[sp.tier - 1] ?? 0}</small></span><em>${esc(sp.description)}</em></button>`).join('')}</div>`;
    } else if (menu === 'items') {
      const ids = ['POTION', 'HIGH_POTION', 'ANTIDOTE', 'REVIVAL_SALT', 'CLEAR_TONIC', 'SOOTHING_DRAUGHT'];
      commands = `<div class="command-heading"><strong>Shared supplies</strong><button data-command="back" class="text-button">← Back</button></div><div class="ability-list">${ids.filter(id => (s.inventory[id] ?? 0) > 0).map(id => `<button data-battle-item="${id}"><span>${esc(getItem(id)?.name ?? id)} <small>×${s.inventory[id]}</small></span><em>${esc(getItem(id)?.effect ?? '')}</em></button>`).join('') || '<p>No supplies remain.</p>'}</div>`;
    } else commands = `<div class="command-heading"><strong>${esc(heroName(selected))}<span>Choose an action</span></strong>${b.plans[selected] ? '<button data-command="undo" class="text-button">Clear plan</button>' : ''}</div><div class="command-grid"><button data-command="attack" data-testid="attack"><span>⚔</span>Attack<small>Strike one enemy</small></button><button data-command="magic" ${!SPELLS.some(sp=>canCast(hero,sp)) ? 'disabled' : ''}><span>✧</span>Magic<small>Spend a tier charge</small></button><button data-command="guard"><span>◇</span>Guard<small>Brace for the round</small></button><button data-command="items"><span>⌑</span>Items<small>Use shared supplies</small></button></div>`;
    $('action-panel').innerHTML = `<div class="battle-topline"><span class="eyebrow">${esc(b.title)} <b>· ROUND ${b.round}</b></span><span class="intent">${esc(b.enemies.filter(e=>e.hp>0).map(e=>e.intent).join(' · '))}</span></div><div class="battle-controls"><div class="battle-command">${commands}</div><div class="battle-log" aria-label="Combat log" aria-live="polite">${b.log.slice(-5).map((line,i)=>`<p class="${i===b.log.slice(-5).length-1?'latest':''}">${esc(line)}</p>`).join('')}</div><div class="round-controls"><span>${Object.keys(b.plans).length} / ${eligible.length} ACTIONS QUEUED</span><button class="primary" data-command="resolve" data-testid="resolve" ${!ready || busy ? 'disabled' : ''}>Resolve round <b>→</b></button><button class="subtle-button command-repeat" data-command="repeat" ${busy||!b.lastPlans?'disabled':''}>Repeat last commands</button><button class="subtle-button" data-command="quick" ${busy ? 'disabled' : ''}>Plan remaining attacks</button><button class="text-button" data-command="flee" ${b.kind==='boss'||busy ? 'disabled' : ''}>Retreat${b.kind==='boss' ? ' unavailable' : ''}</button></div></div>`;
  } else {
    const [title, text] = objective();
    const near = engine.map().entities.filter(e => Math.abs(e.x - s.player.x) + Math.abs(e.y - s.player.y) <= 1);
    const target = near.find(e => e.kind !== 'campfire') ?? near[0];
    $('action-panel').innerHTML = `<div class="exploration-panel"><div class="quest-emblem">${bell}</div><div class="objective"><span class="eyebrow">${s.flags.completed ? 'EXPEDITION COMPLETE' : 'YOUR OBJECTIVE'}</span><h2>${title}</h2><p>${text}</p></div><div class="exploration-buttons"><button class="primary" data-command="interact" data-testid="interact">${target ? esc(target.hint || target.name) : 'Look around'} <kbd>E</kbd></button><button class="subtle-button" data-command="rest" ${s.area!=='camp'||s.mode!=='explore' ? 'disabled' : ''}>Rest at campfire</button><small>${s.cleared.filter(id=>id.startsWith('encounter')).length} encounters cleared <b>·</b> ${s.steps} steps</small></div></div>`;
  }
}

function modal(title: string, eyebrow: string, body: string, footer = '', className = '') {
  return `<div class="modal-scrim"><section class="modal ${className}" role="dialog" aria-modal="true" aria-labelledby="dialog-title" tabindex="-1"><div class="modal-heading"><div><span class="eyebrow">${eyebrow}</span><h2 id="dialog-title">${title}</h2></div>${panel ? '<button data-close aria-label="Close panel" class="close-button">×</button>' : ''}</div>${body}${footer ? `<div class="modal-footer">${footer}</div>` : ''}</section></div>`;
}
function renderModal() {
  const s = engine.state;
  if(frontView||s.mode==='intro'||s.mode==='creation'){$('modal-root').innerHTML='';return;}
  let html = '', key = '';
  if (s.message) {
    key = 'message:' + s.message.text;
    html = modal(esc(s.message.speaker), 'A VOICE ON THE ROAD', `<p class="dialogue-text">${esc(s.message.text)}</p>${s.message.speaker==='Quartermaster' ? `<div class="shop-list"><h3>Supplies · ${s.gold} gold available</h3>${shop.map(item=>`<div class="inventory-row"><span><strong>${esc(getItem(item.id)?.name??item.id)}</strong><small>${item.price} gold · carrying ${s.inventory[item.id]??0}/20</small></span><button class="small-button" data-buy="${item.id}" ${s.gold<item.price||(s.inventory[item.id]??0)>=20?'disabled':''}>Buy</button></div>`).join('')}</div>` : ''}`, '<button class="primary" data-command="dismiss" autofocus>Continue <span>↵</span></button>', 'dialogue-modal');
  } else if (s.reward) {
    key = 'reward:' + s.reward.title + s.reward.choices.join();
    html = modal(esc(s.reward.title), s.reward.source==='normal'?'VICTORY':'SOMETHING WORTH CARRYING', `<div class="reward-mark">✦</div><div class="reward-lines">${s.reward.lines.map(l=>`<p>${esc(l)}</p>`).join('')}</div>${s.reward.choices.length ? `<p class="muted">Choose an unowned Reedwatch piece. Equip it from your pack.</p><div class="reward-choices">${s.reward.choices.map(id=>`<button data-claim="${esc(id)}"><span class="item-symbol">◇</span><strong>${esc(getItem(id)?.name ?? id)}</strong><small>${esc(Object.entries(getItem(id)?.stats ?? {}).map(([k,v])=>`+${v} ${k}`).join(' · '))}</small></button>`).join('')}</div>` : ''}`, s.reward.choices.length ? '' : '<button class="primary" data-command="continue">Continue the journey →</button>');
  } else if (s.mode === 'defeat') {
    key = 'defeat'; html = modal('The road can wait.', 'THE PARTY HAS FALLEN', '<p class="dialogue-text">Bessa’s scouts bring the travelers back to safety. Recover at camp and try a different approach. Guard when the Bailiff raises its hammer.</p>', '<button class="primary" data-command="continue">Recover at camp →</button>');
  } else if (s.mode === 'ending') {
    key = 'ending'; html = modal('Ring. Someone will come.', 'FIRST WATCH · EXPEDITION COMPLETE', '<div class="reward-mark">'+bell+'</div><p class="dialogue-text">Orren is alive. The bell is silent. Beyond the camp, the road is still dark—but the travelers have chosen to walk it together.</p><p class="muted">This is the end of the first playable expedition. A Silver Reedback hunt is now available in the eastern clearing: an explicit demo showcase of rare equipment.</p>', '<button class="primary" data-command="continue">Explore after the expedition →</button>');
  } else if (panel === 'inventory') {
    key = 'pack:' + selected;
    const hero = s.heroes.find(h=>h.id===selected)!;
    const equipment = ITEMS.filter(item=>item.kind==='equipment' && ((s.inventory[item.id]??0)>0 || s.heroes.some(h=>Object.values(h.equipment).includes(item.id))) && isEquipmentAllowed(hero,item));
    const usable = ['POTION','HIGH_POTION','ANTIDOTE','CLEAR_TONIC','SOOTHING_DRAUGHT','REVIVAL_SALT','CAMP_MEAL','MENDING_BALM','SPARK_TEA'];
    html = modal('What we carry', 'SHARED PACK · EQUIPMENT & SUPPLIES', `<div class="hero-tabs">${s.heroes.map(h=>`<button class="${selected===h.id?'active':''}" data-pack-hero="${h.id}">${portrait(h.id,24)}${esc(h.name)}</button>`).join('')}</div><div class="loadout"><strong>${esc(heroName(selected))}</strong><span>ATK ${hero.attack} · DEF ${hero.defense} · MAGIC ${hero.magic}</span><small>${esc(jobFor(hero.job).trait)}</small><small>Reedwatch ${heroSetCount(selected)}/3 · 2 pieces: first-hit shield · 3 pieces: poison resistance</small></div><div class="pack-grid"><section><h3>Equipment</h3>${equipment.map(item=>{const worn=hero.equipment[item.slot!]==item.id;const other=s.heroes.find(h=>h.id!==selected&&Object.values(h.equipment).includes(item.id));return `<div class="inventory-row"><span><strong>${esc(item.name)}</strong><small>${esc(item.slot)} · ${esc(Object.entries(item.stats??{}).map(([k,v])=>`+${v} ${k}`).join(' · '))}${other&&item.set_id?` · worn by ${esc(other.name)}`:''}</small></span><button class="small-button" data-equip="${esc(item.id)}" ${worn?'disabled':''}>${worn?'Worn':'Equip'}</button></div>`}).join('')}</section><section><h3>Supplies</h3>${Object.entries(s.inventory).filter(([id,n])=>n>0&&getItem(id)?.kind==='consumable').map(([id,n])=>`<div class="inventory-row"><span><strong>${esc(getItem(id)?.name??id)} <i>×${n}</i></strong><small>${esc(getItem(id)?.effect??'')}</small></span>${usable.includes(id)?`<button class="small-button" data-use="${esc(id)}">Use</button>`:''}</div>`).join('') || '<p class="muted">The pack is empty.</p>'}</section></div><p class="pack-hint">Equipment is shared. Unique set pieces can be worn by only one traveler. Supplies are used on the selected traveler.</p>`);
  } else if (panel === 'guide') {
    key = 'guide';
    html = modal('Notes from the road', 'FIELD JOURNAL · REEDBANK', `<div class="journal-objective"><span class="eyebrow">THE SILENT WATCH</span><h3>${objective()[0]}</h3><p>${objective()[1]}</p></div><div class="journal-grid"><section><h3>Know your enemy</h3>${worldData.enemies.filter(e=>e.region_id==='R01').map(e=>`<div class="journal-entry"><strong>${esc(e.name)}</strong><span>LV ${e.level} · weak to ${esc(e.weakness.join(', ')||'none')}</span><p>${esc(e.counter)}</p></div>`).join('')}</section><section><h3>The travelers' craft</h3><p>Plan one action for each traveler, then resolve the round. Initiative is shuffled. You can edit plans before committing.</p><p><strong>Guard</strong> starts immediately when the round commits. The Bailiff’s raised hammer warns of its next heavy attack.</p><p>Spell charges persist between fights. The campfire restores the party. A fallen enemy target is automatically replaced.</p><h3>A regional collection</h3><p>The inspection cache, boss reward, and post-demo rare hunt each offer an unowned Reedwatch piece. Two pieces give protection; three help resist poison.</p><p class="muted">The rare hunt is guaranteed for this demo. The full-world design uses 2% sightings plus disclosed 12-win tracking.</p></section></div>`);
  } else if (panel === 'help') {
    key = 'help'; html = modal('A few things for the road', 'CONTROLS & SETTINGS', `<div class="game-settings"><section><h3>Battle speed</h3><div class="segmented">${([1,2,3] as const).map(speed=>`<button data-speed="${speed}" aria-pressed="${s.settings.battleSpeed===speed}" class="${s.settings.battleSpeed===speed?'chosen':''}">${speed}×</button>`).join('')}</div><p>Faster action playback. Planning always waits for you.</p></section><section><h3>Encounters</h3><div class="segmented">${(['classic','visible','off'] as const).map(mode=>`<button data-encounters="${mode}" ${s.mode==='battle'?'disabled':''} aria-pressed="${s.settings.encounters===mode}" class="${s.settings.encounters===mode?'chosen':''}">${mode==='classic'?'Walking':mode==='visible'?'Visible':'Off'}</button>`).join('')}</div><p>Walking triggers battles in the bellworks. Visible shows patrols. Off leaves bosses and hunts available.</p></section></div><div class="controls-list"><p><kbd>W A S D</kbd><span>or arrow keys to walk</span></p><p><kbd>E</kbd><span>or Space to interact with something nearby</span></p><p><kbd>SHIFT</kbd><span>hold while walking to run</span></p><p><kbd>CLICK</kbd><span>a destination to walk; a person or creature to approach</span></p><p><kbd>ARROWS</kbd><span>move between battle commands; Enter selects</span></p><p><kbd>ESC</kbd><span>back out of a command or close a panel</span></p></div><p>On touch screens, use the direction pad or tap the map. During battles, select a traveler, choose an action and target, then resolve the round.</p><p>The game saves stable progress on this device. An interrupted battle resumes from the last exploration checkpoint. Your browser may restrict saving in a downloaded file; the game remains playable.</p><p class="muted">Original procedural pixel art. Reduced-motion preferences are respected. No external assets or account required.</p><div class="menu-return"><button class="subtle-button" data-front="title">Return to title</button><button class="danger-button" data-panel="restart">Create a new hero</button></div>`);
  } else if (panel === 'restart') {
    key = 'restart'; html = modal('Begin again?', 'NEW EXPEDITION', '<p>Create a new lead hero? Your current journey remains available until you confirm Begin the journey on the final creation screen.</p>', '<button class="subtle-button" data-panel="help">Keep playing</button><button class="danger-button" data-command="restart">Create a hero →</button>');
  }
  const root = $('modal-root');
  root.innerHTML = html;
  if (key !== modalKey) {
    modalKey = key;
    if (html) requestAnimationFrame(()=>root.querySelector<HTMLElement>('button:not([disabled]), [tabindex="-1"]')?.focus({preventScroll:true}));
    else returnFocus?.focus({preventScroll:true});
  }
}

function focusSubmenu(){requestAnimationFrame(()=>document.querySelector<HTMLElement>('.target-list button:not([disabled]),.ability-list button:not([disabled])')?.focus({preventScroll:true}));}
function focusBattleCommand() {
  requestAnimationFrame(()=>{
    if(panel||frontView||engine.state.mode!=='battle'||engine.state.battle?.phase!=='planning')return;
    const ready=engine.state.heroes.filter(h=>h.hp>0&&h.status!=='sleep').every(h=>engine.state.battle!.plans[h.id]);
    document.querySelector<HTMLElement>(ready?'[data-command="resolve"]':'[data-command="attack"]')?.focus({preventScroll:true});
  });
}
function render() {
  const s = engine.state;
  const newPlanning=s.mode==='battle'&&s.battle?.phase==='planning'&&previousBattlePhase!=='planning';
  if(newPlanning){selected=s.heroes.find(h=>h.hp>0&&h.status!=='sleep')?.id??'Mara';pending=null;menu='commands';}
  previousBattlePhase=s.mode==='battle'?s.battle?.phase:undefined;
  document.body.classList.toggle('in-battle',s.mode==='battle');
  $('battle-speed').textContent=`${s.settings.battleSpeed}× speed`;
  if (previousMode !== s.mode) { menu = 'commands'; pending = null; if(s.mode==='battle') { panel=null;selected=s.heroes.find(h=>h.hp>0)?.id??'Mara';chime([196,246.94]); } if(s.mode==='victory')chime([293.66,369.99,440]); previousMode=s.mode; }
  $('level-label').textContent = `LEVEL ${s.heroes[0].level}`;
  $('gold-label').textContent = String(s.gold);
  $('pack-count').textContent = String(s.inventory.POTION??0);
  $('location-name').textContent = s.area==='camp'?'Reedbank · The marsh road':'Merewatch · Beneath the bell';
  $('scene-state').textContent = s.mode==='battle'?'ENCOUNTER · '+(s.battle?.kind==='boss'?'BOSS':'ROUND '+s.battle?.round):s.flags.completed?'A NEW ROAD BEGINS':'THE LAST LIGHT OF DAY';
  $('world-tip').textContent = s.mode==='battle' ? '' : s.flags.completed?'Optional hunt unlocked · eastern clearing':s.area==='camp'?'Follow the eastern path to Merewatch →':'Find the worker held beneath the tower';
  $('world-tip').hidden = true; // The canvas owns the contextual interaction hint.
  if (['intro','explore','victory','ending'].includes(s.mode)) persistenceAvailable = engine.save();
  $('save-status').textContent = persistenceAvailable ? (s.mode==='battle'?'CHECKPOINT SAVED · IN BATTLE':'SAVED ON THIS DEVICE') : 'SESSION ONLY · SAVE UNAVAILABLE';
  $('pack-button').toggleAttribute('disabled', s.mode==='battle');
  renderParty(); renderActions(); renderModal(); renderFront(); renderer?.refresh();
  if(newPlanning)focusBattleCommand();
}

function commit(action: PlannedAction) {
  if (!engine.plan(selected, action)) { notify('That action is unavailable. Check its charges, supplies, and target.'); return; }
  pending=null;menu='commands';
  const next=engine.state.heroes.find(h=>h.hp>0&&h.status!=='sleep'&&!engine.state.battle?.plans[h.id]);
  if(next)selected=next.id;
  render();focusBattleCommand();
}

async function command(action: string) {
  switch(action) {
    case 'dismiss': engine.dismiss(); break;
    case 'interact': engine.interact(); break;
    case 'rest': engine.rest(); chime(); break;
    case 'continue': engine.continue(); break;
    case 'back': pending=null;menu='commands';render();focusBattleCommand();break;
    case 'attack': pending={type:'attack',ally:false};renderActions();focusSubmenu();break;
    case 'magic': menu='spells';renderActions();focusSubmenu();break;
    case 'items': menu='items';renderActions();focusSubmenu();break;
    case 'guard':commit({type:'guard',target:selected});break;
    case 'undo':engine.undo(selected);render();break;
    case 'resolve':pending=null;menu='commands';await engine.resolveRound();break;
    case 'flee':await engine.flee();break;
    case 'quick': {
      const enemy=engine.state.battle?.enemies.find(e=>e.hp>0);
      if(enemy)for(const h of engine.state.heroes)if(h.hp>0&&h.status!=='sleep'&&!engine.state.battle?.plans[h.id])engine.plan(h.id,{type:'attack',target:enemy.id});
      render();break;
    }
    case 'restart':panel=null;frontView='creator';draft=structuredClone(DEFAULT_PROFILE);creationStep=0;render();break;
    case 'repeat':engine.repeatPlans();pending=null;menu='commands';render();focusBattleCommand();break;
  }
}

document.addEventListener('click', async event => {
  const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button');
  if(!button||button.disabled)return;
  try {
    if(button.dataset.front){frontAction(button.dataset.front);return;}
    if(button.dataset.job){draft.job=button.dataset.job as CharacterProfile['job'];renderFront();$('front-root').querySelector<HTMLElement>(`[data-job="${button.dataset.job}"]`)?.focus({preventScroll:true});return;}
    if(button.dataset.custom){
      const key=button.dataset.custom as keyof CharacterProfile;
      const candidate={...draft,[key]:button.dataset.value};
      // Preserve a temporarily blank name while selecting visual options.
      if(normalizeProfile({...candidate,name:candidate.name||'Ari'}))draft=candidate;
      renderFront();$('front-root').querySelector<HTMLElement>(`[data-custom="${key}"][data-value="${button.dataset.value}"]`)?.focus({preventScroll:true});return;
    }
    if(button.dataset.intro){if(button.dataset.intro==='skip')engine.skipIntro();else engine.advanceIntro();return;}

    if(button.dataset.speed){engine.configure({battleSpeed:Number(button.dataset.speed) as 1|2|3});render();document.querySelector<HTMLElement>(`[data-speed="${button.dataset.speed}"]`)?.focus({preventScroll:true});return;}
    if(button.dataset.encounters){engine.configure({encounters:button.dataset.encounters as 'classic'|'visible'|'off'});render();document.querySelector<HTMLElement>(`[data-encounters="${button.dataset.encounters}"]`)?.focus({preventScroll:true});return;}
    if(button.id==='battle-speed'){engine.configure({battleSpeed:(engine.state.settings.battleSpeed%3+1) as 1|2|3});return;}
    if(button.dataset.panel) { setPanel(button.dataset.panel as typeof panel);return; }
    if(button.hasAttribute('data-close')) { panel=null;renderModal();return; }
    if(button.dataset.move) { if(!frontView&&engine.state.mode==='explore'&&!$('modal-root').firstElementChild)engine.move(button.dataset.move as Direction);return; }
    if(button.dataset.hero) { selected=button.dataset.hero as HeroId;if(engine.state.mode==='battle'){pending=null;menu='commands';render();focusBattleCommand();}else setPanel('inventory');return; }
    if(button.dataset.packHero) { selected=button.dataset.packHero as HeroId;renderModal();return; }
    if(button.dataset.spell) {
      const spell=SPELLS.find(s=>s.id===button.dataset.spell)!;
      if(spell.target==='allEnemies'||spell.target==='allAllies')commit({type:'spell',spellId:spell.id,target:'all'});
      else{pending={type:'spell',spell,ally:spell.target==='ally'};renderActions();focusSubmenu();}return;
    }
    if(button.dataset.battleItem) {pending={type:'item',itemId:button.dataset.battleItem,ally:true};renderActions();focusSubmenu();return;}
    if(button.dataset.target&&pending) { commit({type:pending.type,target:button.dataset.target,spellId:pending.spell?.id,itemId:pending.itemId});return; }
    if(button.dataset.claim) {engine.claim(button.dataset.claim);chime();return;}
    if(button.dataset.equip) {notify(engine.equip(selected,button.dataset.equip)?'Equipment updated.':'That piece cannot be equipped.');render();return;}
    if(button.dataset.use) {notify(engine.useItem(button.dataset.use,selected)?`${getItem(button.dataset.use)?.name} used on ${heroName(selected)}.`:'That item has no effect right now.');render();return;}
    if(button.dataset.buy) {notify(engine.buy(button.dataset.buy)?`${getItem(button.dataset.buy)?.name} added to the shared pack.`:'Not enough gold or the pack is full.');render();return;}
    if(button.id==='sound-button') {sound=!sound;button.textContent=sound?'Sound on':'Sound off';button.setAttribute('aria-label',sound?'Disable sound':'Enable sound');if(sound)chime();return;}
    if(button.dataset.command) await command(button.dataset.command);
  } catch(error) {console.error(error);notify('That action could not be completed. Your last stable save is safe.');}
});

document.addEventListener('input',event=>{
  const input=event.target as HTMLInputElement;
  if(input.id!=='hero-name')return;
  draft.name=input.value;
  const name=$('front-root').querySelector('.creator-hero-name');if(name)name.textContent=input.value||'Your hero';
  const next=$('front-root').querySelector<HTMLButtonElement>('[data-front="next"]');if(next)next.disabled=!normalizeProfile(draft);
});
document.addEventListener('keydown', event => {
  const dialog=document.querySelector<HTMLElement>('[aria-modal="true"]');
  if(!dialog&&!frontView&&engine.state.mode==='battle'&&engine.state.battle?.phase==='planning'){
    if(event.key==='Escape'&&(pending||menu!=='commands')){pending=null;menu='commands';renderActions();focusBattleCommand();event.preventDefault();return;}
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)){
      const active=document.activeElement as HTMLElement;
      const group=active?.closest('.command-grid,.ability-list,.target-list,.round-controls,#party')??document.querySelector('.command-grid');
      const choices=Array.from(group?.querySelectorAll<HTMLElement>('button:not([disabled])')??[]);
      if(choices.length){
        let target=choices[0];
        if(choices.includes(active)&&!group?.classList.contains('command-grid')){
          const sign=event.key==='ArrowLeft'||event.key==='ArrowUp'?-1:1;
          target=choices[(choices.indexOf(active)+sign+choices.length)%choices.length];
        }else if(choices.includes(active)){
          const box=active.getBoundingClientRect(),x=box.x+box.width/2,y=box.y+box.height/2;
          const horizontal=event.key==='ArrowLeft'||event.key==='ArrowRight',sign=event.key==='ArrowLeft'||event.key==='ArrowUp'?-1:1;
          const candidates=choices.filter(b=>b!==active).map(button=>{const b=button.getBoundingClientRect();const along=horizontal?b.x+b.width/2-x:b.y+b.height/2-y;const across=horizontal?b.y+b.height/2-y:b.x+b.width/2-x;return{button,along,score:Math.abs(along)+Math.abs(across)*3};}).filter(b=>b.along*sign>3).sort((a,b)=>a.score-b.score);
          target=candidates[0]?.button??active;
        }
        target.focus({preventScroll:true});event.preventDefault();return;
      }
    }
  }

  if(event.key==='Escape'&&frontView==='creator'){frontView='title';renderFront();event.preventDefault();return;}
  if(event.key==='Escape'&&panel&&!engine.state.message&&!engine.state.reward){panel=null;renderModal();event.preventDefault();}
  if(dialog&&event.key==='Tab'){
    const buttons=Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex="0"]'));
    if(!buttons.length)return;
    const first=buttons[0],last=buttons[buttons.length-1];
    if(event.shiftKey&&document.activeElement===first){last.focus();event.preventDefault();}
    else if(!event.shiftKey&&document.activeElement===last){first.focus();event.preventDefault();}
  }
  if(!frontView&&engine.state.mode==='intro'&&(event.key==='Enter'||event.key===' ')&&!(document.activeElement instanceof HTMLButtonElement)){engine.advanceIntro();event.preventDefault();return;}
  if(dialog&&(event.key==='Enter'||event.key===' ')&&engine.state.message&&!(document.activeElement instanceof HTMLButtonElement)){engine.dismiss();event.preventDefault();}
});

let renderer: GameRenderer | undefined;
renderer = new GameRenderer($('game-world'),()=>engine.state,()=>engine.map(),d=>engine.move(d),id=>engine.interact(id));
engine.subscribe(render);
render();
// Read-only snapshots support regression tests without providing cheat controls.
Object.defineProperty(window,'__AVEL__',{value:{snapshot:()=>structuredClone(engine.state)},writable:false});
window.addEventListener('beforeunload',()=>engine.save());
window.addEventListener('pagehide',()=>engine.save());
