import progression from '../data/progression.json';
import itemData from '../data/items.json';
import world from '../data/world.json';
import { AREA_INFO, BOSS_EVENTS, BOSS_REQUIREMENTS, buildCampaignMaps, getStoryEvent, isSafeLocation, KNOWN_SWITCHES, TRANSITIONS, regionAt } from './campaign';
import { canCast, isEquipmentAllowed, DEFAULT_PROFILE, LEGACY_PROFILE, normalizeProfile, getIntroSteps, jobFor } from './characters';
export { canCast, isEquipmentAllowed } from './characters';
import type { Area, Battle, CharacterProfile, DemoEngine, Direction, Enemy, GameMap, GameSettings, GameState, Hero, HeroId, Item, JobId, MapEntity, PlannedAction, Slot, Spell } from './contracts';

export const SAVE_KEY = 'avel-demo-v1';
export const ITEMS = itemData.items as Item[];
export const getItem = (id: string): Item | undefined => ITEMS.find(item => item.id === id);
export const SPELLS: Spell[] = [
  {id:'mend',name:'Mend',tier:1,users:['Iona'],target:'ally',effect:'heal',power:20,description:'Restore HP to one living ally.'},
  {id:'shelter',name:'Shelter',tier:1,users:['Iona'],target:'allAllies',effect:'protect',description:'Protect living allies for the rest of this round.'},
  ...(['ember','spark','frost'] as const).map((id,i)=>({id,name:['Ember','Spark','Frost'][i],tier:1,users:['Soren'] as HeroId[],target:'enemy' as const,effect:'damage' as const,power:12,element:['fire','lightning','frost'][i],description:'Strike an enemy with elemental magic.'})),
  {id:'renew',name:'Renew',tier:2,users:['Iona'],target:'allAllies',effect:'heal',power:20,description:'Restore HP to every living ally.'},
  {id:'wave',name:'Storm Wave',tier:2,users:['Soren'],target:'allEnemies',effect:'damage',power:20,element:'lightning',description:'Lightning magic strikes all enemies.'},
  {id:'cleanse',name:'Cleanse',tier:3,users:['Iona'],target:'ally',effect:'cure',description:'Remove poison, sleep, or silence from one living ally.'},
  {id:'kindle',name:'Kindle',tier:3,users:['Iona'],target:'ally',effect:'heal',power:90,description:'Restore a large amount of HP to one ally.'},
  {id:'flare',name:'Flare',tier:3,users:['Soren'],target:'enemy',effect:'damage',power:80,element:'fire',description:'Concentrated fire strikes one enemy.'},
  {id:'revive',name:'Revive',tier:4,users:['Iona'],target:'ally',effect:'revive',power:35,description:'Return a fallen ally with 35% HP.'},
  {id:'blizzard',name:'Blizzard',tier:4,users:['Soren'],target:'allEnemies',effect:'damage',power:110,element:'frost',description:'A bitter frost strikes all enemies.'},
  {id:'haven',name:'Haven',tier:5,users:['Iona'],target:'allAllies',effect:'heal',power:150,description:'Restore a large amount of HP to the party.'},
  {id:'tempest',name:'Tempest',tier:5,users:['Soren'],target:'allEnemies',effect:'damage',power:160,element:'lightning',description:'A great storm strikes all enemies.'},
  {id:'sanctuary',name:'Sanctuary',tier:6,users:['Iona'],target:'allAllies',effect:'protect',power:100,description:'Heal the party and protect it for the rest of this round.'},
  {id:'inferno',name:'Inferno',tier:6,users:['Soren'],target:'allEnemies',effect:'damage',power:220,element:'fire',description:'Blazing fire washes across all enemies.'},
  {id:'rebirth',name:'Rebirth',tier:7,users:['Iona'],target:'ally',effect:'revive',power:100,description:'Return a fallen ally with full HP and clear their condition.'},
  {id:'starfall',name:'Starfall',tier:7,users:['Soren'],target:'enemy',effect:'damage',power:340,element:'lightning',description:'An immense bolt strikes one enemy.'},
  {id:'daybreak',name:'Daybreak',tier:8,users:['Iona'],target:'allAllies',effect:'heal',power:500,description:'Greatly restore the party and clear every living ally’s condition.'},
  {id:'aurora',name:'Aurora',tier:8,users:['Soren'],target:'allEnemies',effect:'damage',power:400,element:'frost',description:'The strongest frost spell strikes all enemies.'},
];

const HERO_IDS: HeroId[] = ['Mara', 'Tavin', 'Iona', 'Soren'];
const COMPANION_JOBS: Record<HeroId, JobId> = { Mara:'warden', Tavin:'striker', Iona:'mender', Soren:'arcanist' };
const SLOTS: Slot[] = ['weapon', 'body', 'head', 'mantle', 'charm'];
const SET_PIECES = ITEMS.filter(item => item.set_id).map(item => item.id);
const REGIONS = world.regions.map(region => region.id);
const NORMAL_XP = [28,165,563,1193,2000,3000];
const NORMAL_GOLD = [70,230,480,900,1500,2300];
const PASSABLE = 'gdsfb';
const ENCOUNTER_IDS = ['encounter1', 'encounter2', 'encounter3', 'encounter4', 'encounter5', 'encounter6', 'bailiff', 'silver'];
const BATTLE_ITEMS = ['POTION', 'HIGH_POTION', 'MENDING_BALM', 'REVIVAL_SALT', 'ANTIDOTE', 'SOOTHING_DRAUGHT', 'CLEAR_TONIC'];
const SHOP_PRICES: Record<string, number> = { POTION:30,HIGH_POTION:100,MENDING_BALM:65,ANTIDOTE:20,SOOTHING_DRAUGHT:25,REVIVAL_SALT:120,CLEAR_TONIC:35 };
export function shopOffers(state: GameState): {itemId:string;price:number}[] {
  if (!isSafeLocation(state.area,state.player.x,state.player.y)) return [];
  const tier = Number(regionAt(state.area,state.player.x,state.player.y).slice(1));
  const eligible = ITEMS.filter(item => item.kind === 'equipment' && !item.set_id && Number(item.id.slice(1,3)) <= tier && state.heroes.some(hero=>isEquipmentAllowed(hero,item)));
  return [...Object.entries(SHOP_PRICES).map(([itemId,price])=>({itemId,price})), ...eligible.map(item=>({itemId:item.id,price:Math.round((item.slot==='weapon'||item.slot==='body'?80:35)*Number(item.id.slice(1,3))**1.6)}))];
}

function campMap(): GameMap {
  const tiles = Array.from({ length: 18 }, (_, y) => Array.from({ length: 32 }, (_, x) => {
    if (x === 0 || y === 0 || x === 31 || y === 17) return 't';
    if (x < 6 && y > 2 && y < 16) return 'w';
    if ([[9, 4], [18, 4], [23, 4], [16, 14]].some(([tx, ty]) => x >= tx && x < tx + 2 && y >= ty && y < ty + 2)) return 'T';
    if ((x === 7 || x === 8) && y > 2 && y < 16) return 'd';
    if ((y >= 8 && y <= 10 && x >= 8) || (x >= 11 && x <= 17 && y >= 7 && y <= 14)) return 'd';
    if ((x === 25 || x === 26) && y > 10 && y < 15) return 'd';
    if ((x > 7 && x < 12 && y < 4) || (x > 19 && x < 23 && y > 12)) return 't';
    return 'g';
  }).join(''));
  return { width: 32, height: 18, tiles, entities: [
    { id: 'bessa', x: 14, y: 9, kind: 'npc', name: 'Bessa', sprite: 'bessa', hint: 'Talk to Bessa' },
    { id: 'fire', x: 12, y: 12, kind: 'campfire', name: 'Watchfire', sprite: 'fire', hint: 'Rest — restore HP and spell charges' },
    { id: 'lantern', x: 9, y: 8, kind: 'npc', name: 'Rill’s Lantern', sprite: 'lantern', hint: 'Repair the lantern handles' },
    { id: 'merchant', x: 16, y: 12, kind: 'npc', name: 'Quartermaster', sprite: 'merchant', hint: 'Speak to the quartermaster' },
    { id: 'toWorks', x: 28, y: 8, kind: 'exit', name: 'Merewatch', sprite: 'door', hint: 'Enter Merewatch bellworks' },
    { id: 'silver', x: 24, y: 13, kind: 'rare', name: 'Silver Reedback', sprite: 'reedback', hint: 'Optional rare hunt — level 7' },
  ] };
}

function worksMap(): GameMap {
  const tiles = Array.from({ length: 18 }, (_, y) => Array.from({ length: 32 }, (_, x) => {
    if (x === 0 || x === 31 || y === 0 || y === 17) return '#';
    if (x === 10 && y >= 2 && y <= 14 && ![4, 8, 13].includes(y)) return '#';
    if (x === 21 && y >= 2 && y <= 14 && ![4, 10, 14].includes(y)) return '#';
    if (y === 8 && x > 2 && x < 30 && ![5, 10, 16, 21, 26].includes(x)) return '#';
    if (x > 1 && x < 5 && y > 1 && y < 5) return 'w';
    return 'f';
  }).join(''));
  const positions = [[6, 13], [6, 6], [13, 11], [16, 4], [25, 12], [25, 6]];
  const sprites = ['hound', 'reedback', 'wisp', 'sentinel', 'hound', 'wisp'];
  const names = ['Reed Hound Pack', 'Mud Reedbacks', 'Soot Wisps', 'Brass Mites', 'Ashen Hound', 'The Upper Watch'];
  return { width: 32, height: 18, tiles, entities: [
    { id: 'toCamp', x: 2, y: 15, kind: 'exit', name: 'Reedbank', sprite: 'door', hint: 'Return to camp' },
    ...positions.map(([x, y], i) => ({ id: `encounter${i + 1}`, x, y, kind: 'enemy' as const, name: names[i], sprite: sprites[i], hint: `Fight ${names[i]}` })),
    { id: 'chest', x: 16, y: 13, kind: 'chest', name: 'Inspection Lockbox', sprite: 'chest', hint: 'Open the inspection lockbox' },
    { id: 'bailiff', x: 27, y: 3, kind: 'boss', name: 'Brass Bailiff', sprite: 'sentinel', hint: 'Break the binding frame — boss' },
  ] };
}

export const MAPS: Record<Area, GameMap> = buildCampaignMaps({ camp: campMap(), works: worksMap() });

function levelFromXp(xp: number): number {
  return Math.max(1, progression.xp_thresholds.filter(threshold => xp >= threshold).length);
}

function chargesAt(level: number, job: JobId): number[] {
  if (job === 'spellblade') return [Math.min(4, 1 + Math.floor((level - 1) / 6)), 0, 0, 0, 0, 0, 0, 0];
  return progression.spell_tier_unlocks.map(unlock => !['mender','arcanist'].includes(job) || level < unlock ? 0 : Math.min(9, 2 + Math.floor((level - unlock) / 4)));
}

function heroJob(id: HeroId, profile: CharacterProfile): JobId { return id === 'Mara' ? profile.job : COMPANION_JOBS[id]; }
function starterEquipment(id: HeroId, profile: CharacterProfile): Record<Slot, string> {
  const source = jobFor(heroJob(id, profile)).starterSourceHero.toUpperCase();
  return { weapon: `R01_${source}_WEAPON`, body: `R01_${source}_BODY`, head: 'R01_COMMON_HEAD', mantle: 'R01_COMMON_MANTLE', charm: 'R01_COMMON_CHARM' };
}

function deriveHero(id: HeroId, level: number, equipment: Record<Slot, string>, profile: CharacterProfile): Hero {
  const job = heroJob(id, profile);
  const base = job === 'scout' ? {hp:[78,13],strength:[9,1.7],magic:[6,.8],accuracy:[34,3.2]} : job === 'spellblade' ? {hp:[90,15],strength:[10,1.6],magic:[10,1.5],accuracy:[22,2]} : progression.heroes[jobFor(job).starterSourceHero];
  const values = Object.values(equipment).map(getItem).filter((item): item is Item => Boolean(item));
  const gearStat = (key: string) => values.reduce((sum, item) => sum + (item.stats?.[key] ?? 0), 0);
  const accuracy = Math.floor(base.accuracy[0] + base.accuracy[1] * (level - 1));
  const hp = Math.floor(base.hp[0] + base.hp[1] * (level - 1));
  const charges = chargesAt(level, job);
  return { id, name:id === 'Mara' ? profile.name : id, job, role:jobFor(job).name, level, hp, maxHp:hp,
    attack: Math.floor(base.strength[0] + base.strength[1] * (level - 1)) + gearStat('attack'),
    defense: 2 + Math.floor((level - 1) / 3) + gearStat('defense'),
    magic: Math.floor(base.magic[0] + base.magic[1] * (level - 1)) + gearStat('magic'),
    accuracy, hits: Math.min(4, 1 + Math.floor(accuracy / 40) + (job === 'striker' ? 1 : 0)),
    charges:[...charges], maxCharges:charges, status:null, equipment:{...equipment} };
}

function freshState(seed: number, profile: CharacterProfile = DEFAULT_PROFILE): GameState {
  const inventory: Record<string, number> = {...progression.starting_loadout.supplies};
  for(const id of HERO_IDS) for(const item of Object.values(starterEquipment(id, profile))) inventory[item] = (inventory[item] ?? 0) + 1;
  return {version:3, campaign:{stage:0,switches:[],openedChests:[],wildBattles:0},safeReturn:{area:'camp',x:11,y:10},overworldReturn:{x:8,y:32},messageQueue:[],hunts:Object.fromEntries(REGIONS.map(id=>[id,{wins:0,ready:false}])), mode:'creation', profile:{...profile}, introStep:0, settings:{battleSpeed:1,encounters:'classic'},encounterSteps:0, area:'camp', player:{x:11,y:10,facing:'right'},
    heroes:HERO_IDS.map(id=>deriveHero(id,1,starterEquipment(id,profile),profile)),inventory,gold:60,xp:0,
    flags:{briefed:false,bossDefeated:false,completed:false,sideQuest:false,chest:false,stamp:false},
    cleared:[],tracks:0,rareReady:false,setAcquired:[],battle:null,reward:null,steps:0,message:null,rng:seed >>> 0 || 7321};
}

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const intRange = (value: unknown, lo: number, hi: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= lo && value <= hi;

/** Saves keep only validated progression and resources; combat values are always derived. */
function restore(raw: string, seed: number): GameState | null {
  try {
    const value:unknown=JSON.parse(raw);
    if(!isRecord(value)||![1,2,3].includes(value.version as number)||!['intro','explore','victory','ending'].includes(String(value.mode))||typeof value.area!=='string'||!Object.hasOwn(MAPS,value.area))return null;
    const legacy=value.version!==3;
    if(legacy&&!['camp','works'].includes(value.area)||value.version===1&&value.mode==='intro')return null;
    if(!intRange(value.xp,0,1_000_000_000)||!intRange(value.gold,0,10_000_000)||!intRange(value.rng,0,0xffffffff)||!intRange(value.steps,0,100_000_000))return null;
    const flags=value.flags;
    if(!isRecord(flags)||!['briefed','bossDefeated','completed','sideQuest','chest','stamp'].every(key=>typeof flags[key]==='boolean'))return null;
    const position=(area:Area,v:unknown):v is {x:number;y:number}=>isRecord(v)&&intRange(v.x,0,MAPS[area].width-1)&&intRange(v.y,0,MAPS[area].height-1)&&PASSABLE.includes(MAPS[area].tiles[v.y][v.x]);
    if(!position(value.area as Area,value.player)||!['up','down','left','right'].includes(String((value.player as Record<string,unknown>).facing)))return null;
    const encounterIds=[...ENCOUNTER_IDS,...world.bosses.map(b=>b.id),...world.rares.map(r=>r.id)];
    if(!Array.isArray(value.cleared)||!value.cleared.every(id=>typeof id==='string'&&encounterIds.includes(id))||new Set(value.cleared).size!==value.cleared.length)return null;
    if(!intRange(value.tracks,0,12)||typeof value.rareReady!=='boolean'||!Array.isArray(value.setAcquired)||!value.setAcquired.every(id=>typeof id==='string'&&SET_PIECES.includes(id))||new Set(value.setAcquired).size!==value.setAcquired.length)return null;
    if(!isRecord(value.inventory)||!Object.entries(value.inventory).every(([id,amount])=>getItem(id)&&intRange(amount,0,99)))return null;
    const profile=value.version===1?{...LEGACY_PROFILE}:normalizeProfile(value.profile);if(!profile)return null;
    const state=freshState(seed,profile);
    if(value.version===1){state.introStep=getIntroSteps(profile).length;state.settings={battleSpeed:1,encounters:'visible'};}
    else {
      if(!intRange(value.introStep,0,getIntroSteps(profile).length)||!intRange(value.encounterSteps,0,18)||!isRecord(value.settings)||![1,2,3].includes(value.settings.battleSpeed as number)||!['classic','visible','off'].includes(String(value.settings.encounters)))return null;
      state.introStep=value.introStep;state.encounterSteps=value.encounterSteps;state.settings={battleSpeed:value.settings.battleSpeed as GameSettings['battleSpeed'],encounters:value.settings.encounters as GameSettings['encounters']};
      if(value.mode==='intro'&&state.introStep>=getIntroSteps(profile).length)return null;
    }
    state.mode=value.mode as GameState['mode'];state.area=value.area as Area;state.xp=value.xp;state.gold=value.gold;state.rng=value.rng;state.steps=value.steps;
    state.flags={...flags} as GameState['flags'];state.player={...value.player} as GameState['player'];state.cleared=[...value.cleared] as string[];state.tracks=value.tracks;state.rareReady=value.rareReady;state.setAcquired=[...value.setAcquired] as string[];state.inventory={...value.inventory} as Record<string,number>;
    if(legacy){
      state.campaign.stage=flags.completed?2:flags.bossDefeated?1:0;
      if(flags.bossDefeated)state.campaign.switches.push('orren_rescued');
      if(flags.completed)state.campaign.switches.push('reedbank_moved');
      state.flags.completed=false;if(state.mode==='ending')state.mode='explore';
      state.hunts.R01={wins:state.tracks,ready:state.rareReady};
      if(flags.chest)state.campaign.openedChests.push('chest');
    }else{
      const c=value.campaign;
      if(!isRecord(c)||!intRange(c.stage,0,10)||!Array.isArray(c.switches)||!c.switches.every(id=>typeof id==='string'&&KNOWN_SWITCHES.includes(id))||new Set(c.switches).size!==c.switches.length||!Array.isArray(c.openedChests)||!c.openedChests.every(id=>typeof id==='string'&&Object.values(MAPS).some(m=>m.entities.some(e=>e.kind==='chest'&&e.id===id)))||new Set(c.openedChests).size!==c.openedChests.length||!intRange(c.wildBattles,0,100_000_000))return null;
      state.campaign={stage:c.stage,switches:[...c.switches] as string[],openedChests:[...c.openedChests] as string[],wildBattles:c.wildBattles};
      if(!isRecord(value.safeReturn)||typeof value.safeReturn.area!=='string'||!Object.hasOwn(MAPS,value.safeReturn.area)||!position(value.safeReturn.area as Area,value.safeReturn)||!isSafeLocation((value.safeReturn as Record<string,unknown>).area as Area,value.safeReturn.x as number,value.safeReturn.y as number)||!position('overworld',value.overworldReturn))return null;
      state.safeReturn={area:(value.safeReturn as Record<string,unknown>).area as Area,x:value.safeReturn.x as number,y:value.safeReturn.y as number};state.overworldReturn={...value.overworldReturn} as {x:number;y:number};
      if(!isRecord(value.hunts)||Object.keys(value.hunts).length!==REGIONS.length||!REGIONS.every(id=>{const h=value.hunts&&isRecord(value.hunts)?value.hunts[id]:null;return isRecord(h)&&intRange(h.wins,0,12)&&typeof h.ready==='boolean';}))return null;
      state.hunts=structuredClone(value.hunts) as GameState['hunts'];
      if(state.flags.completed!==(state.campaign.stage===10))return null;
    }
    const savedHeroes=value.heroes;if(!Array.isArray(savedHeroes)||savedHeroes.length!==4)return null;
    const equippedCounts:Record<string,number>={};
    state.heroes=HERO_IDS.map((id,index)=>{
      const saved=savedHeroes[index];if(!isRecord(saved)||saved.id!==id||!isRecord(saved.equipment))throw Error('Invalid hero');
      const equipment={} as Record<Slot,string>;
      for(const slot of SLOTS){const itemId=saved.equipment[slot];const item=typeof itemId==='string'?getItem(itemId):null;
        if(!item||item.kind!=='equipment'||item.slot!==slot||!isEquipmentAllowed({job:heroJob(id,profile)},item)||!state.inventory[item.id]||item.set_id&&!state.setAcquired.includes(item.id))throw Error('Invalid gear');
        equippedCounts[item.id]=(equippedCounts[item.id]??0)+1;if(equippedCounts[item.id]>state.inventory[item.id])throw Error('Duplicated gear');equipment[slot]=item.id;
      }
      const hero=deriveHero(id,levelFromXp(state.xp),equipment,profile);
      if(!intRange(saved.hp,0,hero.maxHp)||!Array.isArray(saved.charges)||saved.charges.length!==8||!saved.charges.every((n,i)=>intRange(n,0,hero.maxCharges[i]))||saved.status!==null&&!['poison','sleep','silence'].includes(String(saved.status)))throw Error('Invalid resources');
      return {...hero,hp:saved.hp,charges:[...saved.charges] as number[],status:saved.status as Hero['status']};
    });
    if(state.setAcquired.some(id=>state.inventory[id]!==1))return null;
    const validMessage=(v:unknown):v is {speaker:string;text:string}=>isRecord(v)&&typeof v.speaker==='string'&&v.speaker.length<=80&&typeof v.text==='string'&&v.text.length<=3000;
    if(value.message!==null&&!validMessage(value.message))return null;state.message=value.message as GameState['message'];
    if(!legacy){if(!Array.isArray(value.messageQueue)||value.messageQueue.length>30||!value.messageQueue.every(validMessage))return null;state.messageQueue=structuredClone(value.messageQueue);}
    state.battle=null;state.reward=null;
    if(state.mode==='victory'){
      const r=value.reward;if(!isRecord(r)||typeof r.title!=='string'||!Array.isArray(r.lines)||!r.lines.every(line=>typeof line==='string')||!['normal','boss','rare','chest'].includes(String(r.source))||!Array.isArray(r.choices)||!r.choices.every(id=>typeof id==='string'&&SET_PIECES.includes(id)&&!state.setAcquired.includes(id)))return null;
      state.reward={title:r.title.slice(0,100),lines:(r.lines as string[]).map(line=>line.slice(0,1000)),source:r.source as NonNullable<GameState['reward']>['source'],choices:[...r.choices] as string[]};
    }
    return state;
  }catch{return null;}
}

function enemy(templateId: string, index: number, rank: Enemy['rank'] = 'base'): Enemy {
  const template = world.enemies.find(row => row.id === templateId)!;
  const level = template.level + (rank === 'ashen' ? 3 : rank === 'crested' ? 6 : 0);
  const factor: Record<string, number> = { swarm: .55, striker: .95, armored: 1.25, caster: .8, support: .9, status: .85 };
  const hp = Math.round((22 + 16 * level + 1.2 * level ** 2) * (factor[template.role] ?? 1));
  return { id: `${templateId}_${index}`, name: `${rank === 'ashen' ? 'Ashen ' : rank === 'crested' ? 'Crested ' : ''}${template.name}`,
    family: template.family, level, hp, maxHp: hp, attack: Math.round(5 + 2 * level + .02 * level ** 2),
    defense: Math.round((2 + 1.2 * level) * (template.role === 'armored' ? 1.5 : 1)), weakness: template.weakness,
    resistance: template.resistance, rank, intent: template.telegraph, status: null };
}

export function createEngine(options: { storage?: Storage | null; roundDelay?: number; seed?: number } = {}): DemoEngine {
  const seed = options.seed ?? 7321;
  const delay = options.roundDelay ?? 360;
  let storage = options.storage;
  if (storage === undefined) { try { storage = globalThis.localStorage; } catch { storage = null; } }
  let initial: GameState | null = null;
  try { const raw = storage?.getItem(SAVE_KEY); if (raw) initial = restore(raw, seed); } catch { /* memory-only play is supported */ }
  let state = initial ?? freshState(seed);
  let generation = 0;
  const battleShields = new Map<string, number>();
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach(fn => fn());
  const random = () => { let n = state.rng; n ^= n << 13; n ^= n >>> 17; n ^= n << 5; state.rng = n >>> 0 || 7321; return state.rng / 4294967296; };
  const choose = <T>(list: T[]) => list[Math.floor(random() * list.length)];
  const unowned = (region = regionAt(state.area,state.player.x,state.player.y)) => SET_PIECES.filter(id => id.startsWith(region+'_') && !state.setAcquired.includes(id));
  const living = () => state.heroes.filter(hero => hero.hp > 0);
  const say = (speaker: string, text: string) => { state.message = { speaker, text }; emit(); engine.save(); };
  const log = (text: string, cue?: Battle['cue']) => { if (state.battle) { state.battle.log.push(text); state.battle.log = state.battle.log.slice(-24); state.battle.cue = cue; } emit(); };
  const wait = () => delay > 0 ? new Promise<void>(resolve => setTimeout(resolve, delay / state.settings.battleSpeed)) : Promise.resolve();

  const currentRegion = () => regionAt(state.area,state.player.x,state.player.y);
  const syncLegacyHunt = () => { state.tracks=state.hunts.R01.wins;state.rareReady=state.hunts.R01.ready; };
  function enqueue(messages:{speaker:string;text:string}[]) {
    if(!messages.length)return;
    if(state.message)state.messageQueue.push(...messages);else{state.message=messages[0];state.messageQueue.push(...messages.slice(1));}
  }
  function applyStory(event:ReturnType<typeof getStoryEvent>) {
    if(!event)return;
    if(event.stage!==undefined)state.campaign.stage=Math.max(state.campaign.stage,event.stage);
    for(const id of event.switches??[])if(!state.campaign.switches.includes(id))state.campaign.switches.push(id);
    state.flags.completed=state.campaign.stage===10;
    enqueue(event.messages);
  }
  const setBonuses = (hero:Hero):Record<string,number> => {
    const bonus:Record<string,number>={};
    for(const set of itemData.sets){const count=Object.values(hero.equipment).filter(id=>set.pieces.includes(id)).length;
      const add=(values:Record<string,number|undefined>)=>{for(const [key,value]of Object.entries(values))if(value!==undefined)bonus[key]=(bonus[key]??0)+value;};
      if(count>=2)add(set.two_piece_bonus);if(count>=3)add(set.three_piece_additional_bonus);
    }
    return bonus;
  };
  function map(): GameMap {
    const source=MAPS[state.area];
    return {...source,entities:source.entities.filter(entity=>{
      if(entity.kind==='enemy'&&state.settings.encounters!=='visible')return false;
      if(entity.kind==='chest'&&(state.campaign.openedChests.includes(entity.id)||entity.id==='chest'&&state.flags.chest))return false;
      if((entity.kind==='boss'||ENCOUNTER_IDS.includes(entity.id)&&entity.kind==='enemy')&&state.cleared.includes(entity.id))return false;
      if(entity.kind==='rare'){
        const region=entity.id==='silver'?'R01':entity.id.slice(0,3);
        if(!state.hunts[region]?.ready)return false;
      }
      return true;
    })};
  }

  function updateHeroes() {
    const level = levelFromXp(state.xp);
    state.heroes = state.heroes.map(old => {
      const next = deriveHero(old.id, level, old.equipment, state.profile);
      next.hp = Math.min(next.maxHp, old.hp + (old.hp > 0 ? Math.max(0, next.maxHp - old.maxHp) : 0));
      next.charges = next.maxCharges.map((max, i) => Math.min(max, old.charges[i] + Math.max(0, max - old.maxCharges[i])));
      next.status = old.status;
      return next;
    });
  }

  function startBattle(id: string) {
    state.encounterSteps=0;engine.save();
    const region=currentRegion(),ri=REGIONS.indexOf(region);
    let kind:Battle['kind']='normal';let enemies:Enemy[];
    const boss=world.bosses.find(row=>row.id===(id==='bailiff'?'B_R01_BAILIFF':id));
    const rare=world.rares.find(row=>row.id===(id==='silver'?'R01_RARE':id));
    if(boss){
      kind='boss';const level=boss.level, hp=id==='bailiff'?500:Math.round((22+16*level+1.2*level**2)*5);
      const template=world.enemies.find(row=>row.region_id===boss.region_id&&(row.family==='SENTINEL'||row.family==='CANTOR'))??world.enemies.find(row=>row.region_id===boss.region_id)!;
      const count=id==='B_R06_CHOIR'?3:1;
      enemies=Array.from({length:count},(_,i)=>({id:count===1?id:id+'_'+i,name:count===1?boss.name:['Night Choir — First Voice','Night Choir — Second Voice','Night Choir — Last Voice'][i],family:template.family,level,hp:Math.round(hp/count),maxHp:Math.round(hp/count),attack:Math.round((5+2*level+.02*level**2)/(count===3?1.8:1)),defense:id==='bailiff'?7:Math.round(2+level*1.2),weakness:id==='bailiff'?['lightning']:template.weakness,resistance:template.resistance,rank:'boss' as const,intent:boss.telegraph+' A heavy strike follows next round. '+boss.counter,status:null}));
    }else if(rare){
      kind='rare';const level=rare.level,hp=id==='silver'?350:Math.round((22+16*level+1.2*level**2)*2.5);
      enemies=[{id,name:rare.name,family:rare.family,level,hp,maxHp:hp,attack:Math.round(5+level*2+.02*level**2),defense:Math.round(2+level*1.2),weakness:rare.weakness,resistance:rare.resistance,rank:'rare',intent:rare.telegraph+' '+rare.counter,status:null}];
    }else{
      const pairs:Record<string,string[]>={encounter1:['R01_E2','R01_E2'],encounter2:['R01_E1','R01_E2'],encounter3:['R01_E3','R01_E3'],encounter4:['R01_E4','R01_E3'],encounter5:['R01_E2','R01_E4'],encounter6:['R01_E4','R01_E3']};
      const templates=world.enemies.filter(row=>row.region_id===region);
      const pair=pairs[id]??[choose(templates).id,choose(templates).id];
      enemies=pair.map((template,i)=>enemy(template,i,id==='encounter5'&&i===0?'ashen':!pairs[id]&&random()<.15?(ri>2?'crested':'ashen'):'base'));
    }
    state.message=null;state.reward=null;state.mode='battle';battleShields.clear();
    for(const hero of state.heroes){const bonus=setBonuses(hero);if(bonus.first_hit_shield_percent)battleShields.set(hero.id,Math.ceil(hero.maxHp*Math.min(10,bonus.first_hit_shield_percent)/100));}
    const rewardXp=kind==='normal'?NORMAL_XP[ri]:kind==='rare'?Math.round(NORMAL_XP[ri]*1.5):id==='bailiff'?88:id==='B_R06_VALE'?0:id==='B_R06_CHOIR'?1500:id==='B_R06_HEART'?3000:NORMAL_XP[ri]*2;
    state.battle={encounterId:id,title:boss?.name??rare?.name??AREA_INFO[state.area].name,kind,enemies,regionId:region,rewardXp,rewardGold:boss?.gold_party??(kind==='rare'?NORMAL_GOLD[ri]*2:NORMAL_GOLD[ri]),round:1,phase:'planning',plans:{},log:[boss?boss.telegraph+' '+boss.counter:rare?rare.telegraph:'Choose actions, exploit elemental weaknesses, and commit the round.']};emit();
  }

  function victory() {
    const battle=state.battle;if(!battle||state.mode!=='battle')return;
    const oldLevel=state.heroes[0].level,region=battle.regionId??currentRegion(),xp=battle.rewardXp??28,gold=battle.rewardGold??70;
    state.xp+=xp;state.gold+=gold;
    if((battle.kind==='boss'||ENCOUNTER_IDS.includes(battle.encounterId))&&battle.kind!=='rare'&&!state.cleared.includes(battle.encounterId))state.cleared.push(battle.encounterId);
    if(battle.encounterId==='bailiff')state.flags.bossDefeated=true;
    const hunt=state.hunts[region];
    if(battle.kind==='rare'){hunt.ready=false;hunt.wins=0;}
    else if(battle.kind==='normal'){
      const bossId=region==='R01'?'bailiff':world.bosses.find(b=>b.region_id===region&&!b.optional)?.id;
      const unlocked=region==='R01'?state.campaign.stage>=2:region==='R05'?state.campaign.stage>=7:region==='R06'?state.campaign.stage>=10:!!bossId&&state.cleared.includes(bossId);
      if(unlocked){hunt.wins=Math.min(12,hunt.wins+1);if(hunt.wins>=12||random()<.02)hunt.ready=true;}
    }
    if(battle.kind==='boss'&&region==='R01')hunt.wins=Math.min(12,state.tracks);
    syncLegacyHunt();updateHeroes();
    const lines=[`Each hero gains ${xp} EXP. The party finds ${gold} gold.`];
    if(state.heroes[0].level>oldLevel)lines.push(`The whole party reaches level ${state.heroes[0].level}.`);
    if(battle.kind==='normal'&&random()<.2){const item=state.heroes[0].level>=10?'HIGH_POTION':choose(['POTION','ANTIDOTE','SOOTHING_DRAUGHT']);state.inventory[item]=Math.min(99,(state.inventory[item]??0)+1);lines.push(`Found ${getItem(item)!.name}.`);}
    if(battle.kind==='boss'){
      const event=BOSS_EVENTS[battle.encounterId];
      if(event)applyStory({messages:event.messages??[],stage:event.stage,switches:event.switches});
      const boss=world.bosses.find(b=>b.id===(battle.encounterId==='bailiff'?'B_R01_BAILIFF':battle.encounterId));
      if(boss){lines.push(boss.story_outcome);for(const reward of boss.guaranteed_rewards)if(reward.type==='item'&&'item_id'in reward&&typeof reward.item_id==='string'&&getItem(reward.item_id)){const amount='quantity'in reward?Number(reward.quantity):1;state.inventory[reward.item_id]=Math.min(99,(state.inventory[reward.item_id]??0)+amount);}}
    }
    const grantsSet=battle.kind==='rare'||battle.kind==='boss'&&!!world.bosses.find(b=>b.id===(battle.encounterId==='bailiff'?'B_R01_BAILIFF':battle.encounterId))?.guaranteed_rewards.some(r=>r.type==='regional_set_choice');
    state.reward={title:battle.kind==='boss'?'A Promise Kept':battle.kind==='rare'?'A Rare Discovery':'Victory',lines,source:battle.kind,choices:grantsSet?unowned(region):[]};
    if(grantsSet&&!state.reward.choices.length){state.inventory.HIGH_POTION=Math.min(99,(state.inventory.HIGH_POTION??0)+1);lines.push('Regional collection complete: received a Greater Field Potion.');}
    state.mode='victory';emit();engine.save();
  }

  function checkEnd(): boolean {
    if (!state.battle || state.mode !== 'battle') return true;
    if (living().length === 0) { state.mode = 'defeat'; emit(); return true; }
    if (state.battle.enemies.every(enemy => enemy.hp <= 0)) { victory(); return true; }
    return false;
  }

  function applySupportSpell(caster:Hero,spell:Spell,target:Hero):number {
    const before=target.hp;
    if(spell.effect==='revive'){target.hp=Math.max(1,Math.round(target.maxHp*(spell.power??35)/100));target.status=null;}
    else if(spell.effect==='cure')target.status=null;
    else if(target.hp>0){const amount=Math.round(((spell.power??20)+caster.magic*(spell.target==='allAllies'?1.5:2))*(caster.job==='mender'?1.2:1));target.hp=Math.min(target.maxHp,target.hp+amount);if(spell.id==='daybreak')target.status=null;}
    return target.hp-before;
  }

  function itemValid(itemId: string, target: Hero): boolean {
    if (!(state.inventory[itemId] > 0)) return false;
    if (itemId === 'REVIVAL_SALT') return target.hp === 0;
    if (target.hp <= 0) return false;
    if (['POTION', 'HIGH_POTION', 'MENDING_BALM'].includes(itemId)) return true;
    return (itemId === 'ANTIDOTE' && target.status === 'poison') || (itemId === 'SOOTHING_DRAUGHT' && target.status === 'sleep') || (itemId === 'CLEAR_TONIC' && target.status === 'silence');
  }

  function applyItem(itemId: string, target: Hero): boolean {
    if (!itemValid(itemId, target)) return false;
    if (itemId === 'REVIVAL_SALT') target.hp = Math.max(1, Math.floor(target.maxHp * .2));
    else if (itemId === 'ANTIDOTE' || itemId === 'SOOTHING_DRAUGHT' || itemId === 'CLEAR_TONIC') target.status = null;
    else target.hp = Math.min(target.maxHp, target.hp + (itemId === 'POTION' ? 60 : itemId === 'HIGH_POTION' ? 250 : 120));
    state.inventory[itemId] -= 1; return true;
  }

  const engine: DemoEngine = {
    get state() { return state; },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    map,
    move(direction) {
      if (state.mode !== 'explore' || state.message || state.reward) return;
      const delta = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[direction];
      if (!delta) return;
      const x = state.player.x + delta[0], y = state.player.y + delta[1];
      state.player.facing = direction;
      const current = map();
      if (y < 0 || y >= current.height || x < 0 || x >= current.width || !PASSABLE.includes(current.tiles[y][x])) return;
      if (current.entities.some(entity => entity.x === x && entity.y === y && entity.kind !== 'exit')) return;
      state.player.x=x;state.player.y=y;state.steps++;
      if(!isSafeLocation(state.area,x,y)&&state.settings.encounters==='classic') {
        const nearSafeInteraction=current.entities.some(entity=>entity.kind!=='enemy'&&Math.abs(entity.x-x)+Math.abs(entity.y-y)<=2);
        if(!nearSafeInteraction){
          state.encounterSteps++;
          if(state.encounterSteps>=12&&(state.encounterSteps>=18||random()<1/(19-state.encounterSteps))){
            const original=state.area==='works'?ENCOUNTER_IDS.filter(id=>id.startsWith('encounter')&&!state.cleared.includes(id)):[];
            const id=original.length?choose(original):`wild:${currentRegion()}:${++state.campaign.wildBattles}`;
            startBattle(id);return;
          }
        }
      }
      emit();engine.save();
    },
    interact(entityId) {
      if (state.message) { engine.dismiss(); return; }
      if (state.mode !== 'explore') return;
      const near = map().entities.filter(entity => Math.abs(entity.x - state.player.x) + Math.abs(entity.y - state.player.y) <= 1);
      const entity = entityId ? near.find(row => row.id === entityId) : near[0];
      if (!entity) return;
      if(entity.kind==='exit'){
        if(entity.id==='toWorks'&&!state.flags.briefed){say(state.profile.name,'We should speak to Bessa before entering the bellworks.');return;}
        const transition=TRANSITIONS[entity.id]??(entity.id==='toWorks'?{area:'works' as Area,x:3,y:15}:entity.id==='toCamp'?{area:'camp' as Area,x:27,y:8}:null);
        if(!transition)return;
        if(transition.minStage!==undefined&&state.campaign.stage<transition.minStage||transition.requiredSwitch&&!state.campaign.switches.includes(transition.requiredSwitch)){say(entity.name,transition.blockedText??'We need to finish the work here before taking this road.');return;}
        if(state.area==='overworld'&&transition.area!=='overworld')state.overworldReturn={x:state.player.x,y:state.player.y};
        else if(state.area!=='overworld'&&transition.area!=='overworld'){const outside=TRANSITIONS['world-'+transition.area];if(outside)state.overworldReturn={x:outside.x,y:outside.y};}
        const returnPosition=transition.area==='overworld'&&state.area!=='overworld'?state.overworldReturn:null;
        state.area=transition.area;state.player={x:returnPosition?.x??transition.x,y:returnPosition?.y??transition.y,facing:'down'};state.encounterSteps=0;
        if(isSafeLocation(state.area,state.player.x,state.player.y))state.safeReturn={area:state.area,x:state.player.x,y:state.player.y};
        emit();engine.save();
      }else if(entity.kind==='campfire'||entity.id.startsWith('inn-'))engine.rest();
      else if(entity.id==='merchant'||entity.id.startsWith('shop-'))say('Quartermaster',`Supplies and equipment for ${AREA_INFO[state.area].name} are available in the shop. Equipment stocks follow this region’s fixed danger level. Rest at a safe shelter to restore spell charges.`);
      else if(entity.id==='lantern'){
        if(!state.flags.sideQuest){state.flags.sideQuest=true;state.inventory.POTION=Math.min(99,(state.inventory.POTION??0)+1);say('Keep a Light for Me','You mend the lantern handles and hang Rill’s painted sign. Bessa sets aside a Field Potion. “Ring. Someone will come.”');}
        else say('Rill','The lantern is ready. I painted the sign myself.');
      }else if(entity.kind==='chest'){
        state.campaign.openedChests.push(entity.id);if(entity.id==='chest')state.flags.chest=true;
        state.reward={title:entity.name,lines:['Returned equipment has been stored for the road ahead. Choose one regional piece you do not own.'],source:'chest',choices:unowned()};
        if(!state.reward.choices.length){state.inventory.HIGH_POTION=Math.min(99,(state.inventory.HIGH_POTION??0)+1);state.reward.lines.push('Collection complete: received a Greater Field Potion.');}
        state.mode='victory';emit();engine.save();
      }else if(entity.kind==='boss'){
        const requirement=BOSS_REQUIREMENTS[entity.id];
        if(requirement&&(requirement.minStage!==undefined&&state.campaign.stage<requirement.minStage||requirement.requiredSwitch&&!state.campaign.switches.includes(requirement.requiredSwitch))){say(entity.name,requirement.blockedText);return;}
        startBattle(entity.id);
      }else if(entity.kind==='enemy'||entity.kind==='rare')startBattle(entity.id);
      else{
        if(entity.id==='bessa'){
          state.flags.briefed=true;
          if(state.flags.bossDefeated&&state.campaign.stage===1){state.hunts.R01.ready=!state.setAcquired.includes('R01_SET_HEAD')||!state.setAcquired.includes('R01_SET_MANTLE')||!state.setAcquired.includes('R01_SET_CHARM');syncLegacyHunt();}
        }
        const event=getStoryEvent(entity.id,state);
        if(event){applyStory(event);emit();engine.save();}else say(entity.name,entity.hint);
      }
    },
    dismiss() {
      state.message=state.messageQueue.shift()??null;
      if(!state.message&&state.campaign.stage===10&&state.mode==='explore'&&!state.campaign.switches.includes('ending_seen')){state.campaign.switches.push('ending_seen');state.mode='ending';}
      emit();engine.save();
    },
    rest() {
      if(state.mode!=='explore'||!isSafeLocation(state.area,state.player.x,state.player.y)||state.reward)return;
      const cost=state.area==='camp'?0:Math.min(120,Number(currentRegion().slice(1))*10);
      if(state.gold<cost){say('Shelter Keeper',`A full rest costs ${cost} gold. Field supplies can help until then.`);return;}
      state.gold-=cost;state.safeReturn={area:state.area,x:state.player.x,y:state.player.y};
      for(const hero of state.heroes){hero.hp=hero.maxHp;hero.status=null;hero.charges=[...hero.maxCharges];}
      say('A Safe Shelter',`Warm food and a change of watch restore everyone’s HP, spell charges, and conditions.${cost?` Lodging: ${cost} gold.`:''}`);
    },
    plan(heroId, action) {
      const battle = state.battle; const hero = state.heroes.find(row => row.id === heroId);
      if (state.mode !== 'battle' || !battle || battle.phase !== 'planning' || !hero || hero.hp <= 0 || hero.status === 'sleep') return false;
      if (!['attack', 'guard', 'spell', 'item'].includes(action.type)) return false;
      if (action.type === 'attack' && !battle.enemies.some(enemy => enemy.id === action.target && enemy.hp > 0)) return false;
      if (action.type === 'spell') {
        const spell = SPELLS.find(spell => spell.id === action.spellId);
        if (!spell || !canCast(hero,spell) || hero.charges[spell.tier - 1] <= 0 || hero.status === 'silence') return false;
        if (spell.target === 'enemy' && !battle.enemies.some(enemy => enemy.id === action.target && enemy.hp > 0)) return false;
        if (spell.target === 'ally' && !state.heroes.some(ally => ally.id === action.target && (spell.effect==='revive'?ally.hp===0:ally.hp>0) && (spell.effect!=='cure'||ally.status!==null))) return false;
      }
      if (action.type === 'item') {
        const target = state.heroes.find(row => row.id === action.target);
        if (!action.itemId || !BATTLE_ITEMS.includes(action.itemId) || !target || !itemValid(action.itemId, target)) return false;
        const reserved = Object.entries(battle.plans).filter(([id, plan]) => id !== heroId && plan.type === 'item' && plan.itemId === action.itemId).length;
        if (reserved >= (state.inventory[action.itemId] ?? 0)) return false;
      }
      battle.plans[heroId] = { ...action }; emit(); return true;
    },
    undo(hero) { if (state.mode === 'battle' && state.battle?.phase === 'planning') { delete state.battle.plans[hero]; emit(); } },
    async resolveRound() {
      const battle = state.battle;
      if (state.mode !== 'battle' || !battle || battle.phase !== 'planning') return;
      const eligible = living().filter(hero => hero.status !== 'sleep');
      if (eligible.some(hero => !battle.plans[hero.id])) return;
      battle.phase = 'resolving';
      const token = generation;
      const guard = new Set<string>(); const shield = battleShields;
      for (const hero of state.heroes) {
        if (battle.plans[hero.id]?.type === 'guard') guard.add(hero.id);
      }
      // A single round queue and early end checks prevent extra enemy actions after victory.
      const queue = [...state.heroes.map(hero => ({ id: hero.id, hero: true })), ...battle.enemies.map(enemy => ({ id: enemy.id, hero: false }))];
      for (let i = queue.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [queue[i], queue[j]] = [queue[j], queue[i]]; }
      emit();
      for (const actor of queue) {
        if (token !== generation || state.mode !== 'battle' || state.battle !== battle) return;
        if (actor.hero) {
          const hero = state.heroes.find(row => row.id === actor.id)!;
          if (hero.hp <= 0) continue;
          if (hero.status === 'sleep') { hero.status = null; log(`${hero.name} wakes, losing this turn.`); await wait(); continue; }
          const action = battle.plans[hero.id]; if (!action) continue;
          if (action.type === 'guard') log(`${hero.name} stands ready to guard.`, { actor: hero.id, target: hero.id, amount: 0, kind: 'guard' });
          else if (action.type === 'attack') {
            const target = battle.enemies.find(row => row.id === action.target && row.hp > 0) ?? battle.enemies.find(row => row.hp > 0);
            if (!target) { checkEnd(); return; }
            let damage = 0, hits = 0;
            for (let hit = 0; hit < hero.hits; hit++) if (random() < .93) { hits++; damage += Math.max(1, Math.round(hero.attack * (1.2 + random() * .45)) - target.defense); }
            target.hp = Math.max(0, target.hp - damage);
            log(`${hero.name} attacks ${target.name}: ${damage} damage${hits > 1 ? ` (${hits} hits)` : hits === 0 ? ' — missed' : ''}.`, { actor: hero.id, target: target.id, amount: damage, kind: 'hit' });
          } else if (action.type === 'spell') {
            const spell = SPELLS.find(row => row.id === action.spellId)!;
            if (hero.status === 'silence' || hero.charges[spell.tier - 1] <= 0) log(`${hero.name} cannot cast. No charge spent.`);
            else if(spell.effect!=='damage'){
              const targets=spell.target==='allAllies'?living():state.heroes.filter(row=>row.id===action.target&&(spell.effect==='revive'?row.hp===0:row.hp>0));
              if(!targets.length||spell.effect==='cure'&&!targets.some(t=>t.status!==null))log(`${hero.name}'s target is no longer valid. No charge spent.`);
              else{
                hero.charges[spell.tier-1]--;
                for(const target of targets){
                  if(spell.effect==='protect'){guard.add(target.id);if(spell.power)applySupportSpell(hero,spell,target);}
                  else applySupportSpell(hero,spell,target);
                }
                log(`${hero.name} casts ${spell.name}.${spell.effect==='protect'?' Living allies are protected for the rest of the round.':' The party’s recovery magic takes effect.'}`,{actor:hero.id,target:targets[0].id,amount:spell.power??0,kind:spell.effect==='protect'?'guard':'heal'});
              }
            }else{
              const targets=spell.target==='allEnemies'?battle.enemies.filter(row=>row.hp>0):[battle.enemies.find(row=>row.id===action.target&&row.hp>0)??battle.enemies.find(row=>row.hp>0)].filter((row):row is Enemy=>Boolean(row));
              if(!targets.length){checkEnd();return;}
              hero.charges[spell.tier-1]--;
              for(const target of targets){
                const element=spell.element??'lightning';
                const multiplier=target.weakness.includes(element)?(hero.job==='arcanist'?1.65:1.5):target.resistance.includes(element)?.5:1;
                const damage=Math.round(((spell.power??12)+hero.magic*2)*multiplier*(targets.length>1?.7:1));
                target.hp=Math.max(0,target.hp-damage);
                log(`${hero.name} casts ${spell.name} on ${target.name}: ${damage}${multiplier>1?' — weak point!':multiplier<1?' — resisted':''}.`,{actor:hero.id,target:target.id,amount:damage,kind:'spell'});
              }
            }
          } else if (action.type === 'item') {
            const target = state.heroes.find(row => row.id === action.target);
            const before = target?.hp ?? 0;
            if (target && action.itemId && applyItem(action.itemId, target)) log(`${hero.name} uses ${getItem(action.itemId)?.name} on ${target.name}.`, { actor: hero.id, target: target.id, amount: target.hp - before, kind: 'heal' });
            else log(`${hero.name}'s item target changed. The item is kept.`);
          }
        } else {
          const enemy = battle.enemies.find(row => row.id === actor.id)!;
          if (enemy.hp <= 0) continue;
          if (enemy.status === 'sleep') { enemy.status = null; log(`${enemy.name} wakes.`); await wait(); continue; }
          const available = living(); if (!available.length) { checkEnd(); return; }
          const weighted = available.flatMap(hero => Array(hero.job === 'warden' ? 4 : ['striker','spellblade'].includes(hero.job) ? 2 : 1).fill(hero)) as Hero[];
          const target = choose(weighted);
          if(target.job === 'scout' && random()<.15) {log(`${target.name} slips past ${enemy.name}'s strike.`,{actor:enemy.id,target:target.id,amount:0,kind:'hit'});await wait();continue;}
          const heavy = battle.kind !== 'normal' && battle.round % 2 === 0;
          let damage = Math.max(2, Math.round(enemy.attack * (heavy ? 3 : 1.4) + random() * 4) - target.defense);
          if (guard.has(target.id)) damage = Math.max(1, Math.floor(damage * (target.job === 'warden' ? .35 : .5)));
          const barrier = shield.get(target.id) ?? 0;
          if (barrier > 0) { const absorbed = Math.min(barrier, damage); damage -= absorbed; shield.set(target.id, barrier - absorbed); }
          const bonuses=setBonuses(target),magical=['WISP','CANTOR'].includes(enemy.family);
          const reduction=magical?(bonuses.magic_resist_percent??0):(bonuses.physical_resist_percent??0);
          const element=enemy.family==='CANTOR'?'frost':enemy.family==='WISP'?'fire':null;
          const frostReduction=element==='frost'?(bonuses.frost_resist_percent??0):0;
          const resisted=Math.floor(damage*Math.min(15,reduction+frostReduction)/100);
          damage-=resisted;target.hp=Math.max(0,target.hp-damage);
          const condition:Hero['status']=['WISP','WIDOW'].includes(enemy.family)?'poison':enemy.family==='CANTOR'?(battle.round%2===0?'silence':'sleep'):null;
          if(condition&&target.hp>0&&random()<Math.max(0,.2-Math.min(30,bonuses[condition+'_resist_pp']??0)/100))target.status=condition;

          log(`${enemy.name} ${heavy ? 'unleashes its warned heavy strike' : element ? `casts a ${element} pulse at` : 'strikes'} ${target.name}: ${damage}${guard.has(target.id) ? ' (guarded)' : ''}.`, { actor: enemy.id, target: target.id, amount: damage, kind: 'hit' });
        }
        if (checkEnd()) return;
        await wait();
      }
      if (token !== generation || state.mode !== 'battle') return;
      for (const hero of living()) if (hero.status === 'poison') {
        const amount = Math.max(2, Math.floor(hero.maxHp * .05)); hero.hp = Math.max(0, hero.hp - amount); log(`${hero.name} suffers ${amount} poison damage.`);
      }
      if (checkEnd()) return;
      battle.lastPlans=structuredClone(battle.plans);
      battle.round++; battle.phase = 'planning'; battle.plans = {}; battle.cue = undefined;
      for (const enemy of battle.enemies) if (enemy.rank === 'boss' || enemy.rank === 'rare') enemy.intent = battle.round % 2 === 0 ? 'HEAVY STRIKE THIS ROUND — Guard reduces damage.' : 'Recovering and preparing its next heavy strike.';
      log(`Round ${battle.round}. Plan the party’s actions.`);
    },
    async flee() {
      const battle = state.battle;
      if (state.mode !== 'battle' || !battle || battle.phase !== 'planning' || battle.kind === 'boss') return;
      if (random() < (battle.kind === 'rare' ? .8 : .9)) {
        state.encounterSteps=0;state.mode = 'explore'; state.battle = null; say('Retreat', 'The party withdraws. No EXP or gold gained. The enemy remains, and your hunt progress is kept.');
      } else {
        for (const hero of living()) if (hero.status !== 'sleep') battle.plans[hero.id] = { type: 'guard', target: hero.id };
        log('The escape route closes! The party guards while the enemies act.'); await engine.resolveRound();
      }
    },
    claim(itemId) {
      const reward = state.reward;
      if (state.mode !== 'victory' || !reward || !reward.choices.includes(itemId) || state.setAcquired.includes(itemId)) return;
      state.setAcquired.push(itemId); state.inventory[itemId] = 1;
      if (reward.source === 'boss') state.flags.stamp = true;
      reward.choices = []; reward.lines.push(`Received ${getItem(itemId)!.name}. Equip it from the Gear panel.`);
      emit(); engine.save();
    },
    continue() {
      if(state.mode==='victory'){
        if(state.reward?.choices.length)return;
        state.reward=null;state.battle=null;state.mode='explore';state.encounterSteps=0;
        if(state.campaign.stage===10&&!state.message&&!state.messageQueue.length&&!state.campaign.switches.includes('ending_seen')){state.campaign.switches.push('ending_seen');state.mode='ending';}
        emit();engine.save();
      }else if(state.mode==='defeat'){
        state.mode='explore';state.area=state.safeReturn.area;state.player={x:state.safeReturn.x,y:state.safeReturn.y,facing:'down'};state.battle=null;state.reward=null;state.messageQueue=[];state.encounterSteps=0;
        for(const hero of state.heroes){hero.hp=hero.maxHp;hero.charges=[...hero.maxCharges];hero.status=null;}
        say('The Party Regroups','Allies bring you back to the last safe shelter. Everyone recovers. No EXP or gold was gained from the lost battle.');
      }else if(state.mode==='ending'){
        state.mode='explore';say('The Open Road','The last captive-fed bell is silent. Visit the people you helped, finish regional hunts, or challenge the Unlit Colossus. The road remains yours to explore.');
      }
    },
    equip(heroId, itemId) {
      if (state.mode !== 'explore' || state.reward) return false;
      const hero = state.heroes.find(row => row.id === heroId); const item = getItem(itemId);
      if (!hero || !item || item.kind !== 'equipment' || !item.slot || !isEquipmentAllowed(hero,item) || !(state.inventory[itemId] > 0)) return false;
      const worn = state.heroes.filter(row => row.id !== heroId && Object.values(row.equipment).includes(itemId)).length;
      if (worn >= state.inventory[itemId]) return false;
      hero.equipment[item.slot] = itemId; updateHeroes(); emit(); engine.save(); return true;
    },
    useItem(itemId, heroId) {
      if (state.mode !== 'explore' || state.reward) return false;
      const hero = state.heroes.find(row => row.id === heroId);
      if (!hero || !applyItem(itemId, hero)) return false;
      emit(); engine.save(); return true;
    },
    buy(itemId) {
      if(state.mode!=='explore'||state.reward)return false;
      const offer=shopOffers(state).find(row=>row.itemId===itemId);
      if(!offer||state.gold<offer.price||(state.inventory[itemId]??0)>=99)return false;
      state.gold-=offer.price;state.inventory[itemId]=(state.inventory[itemId]??0)+1;emit();engine.save();return true;
    },
    castField(heroId,spellId,targetId) {
      if(state.mode!=='explore'||state.reward||state.message)return false;
      const hero=state.heroes.find(h=>h.id===heroId),spell=SPELLS.find(s=>s.id===spellId);
      if(!hero||hero.hp<=0||hero.status==='silence'||!spell||!canCast(hero,spell)||hero.charges[spell.tier-1]<=0||!['heal','cure','revive'].includes(spell.effect??''))return false;
      const targets=spell.target==='allAllies'?state.heroes.filter(h=>h.hp>0):state.heroes.filter(h=>h.id===targetId);
      const valid=targets.filter(h=>spell.effect==='revive'?h.hp===0:h.hp>0&&(spell.effect==='cure'?h.status!==null:h.hp<h.maxHp||spell.id==='daybreak'&&h.status!==null));
      if(!valid.length)return false;
      hero.charges[spell.tier-1]--;for(const target of valid)applySupportSpell(hero,spell,target);
      emit();engine.save();return true;
    },
    beginAdventure(input) {
      const profile=normalizeProfile(input);
      if(!profile)return false;
      generation++;battleShields.clear();state=freshState(seed,profile);state.mode='intro';emit();engine.save();return true;
    },
    advanceIntro() {
      if(state.mode!=='intro')return;
      state.introStep++;
      if(state.introStep>=getIntroSteps(state.profile).length){state.mode='explore';state.message=null;}
      emit();engine.save();
    },
    skipIntro() {
      if(state.mode!=='intro')return;
      state.introStep=getIntroSteps(state.profile).length;state.mode='explore';state.message=null;emit();engine.save();
    },
    configure(settings) {
      if(settings.battleSpeed!==undefined && ![1,2,3].includes(settings.battleSpeed))return;
      if(settings.encounters!==undefined && !['classic','visible','off'].includes(settings.encounters))return;
      if(settings.battleSpeed!==undefined)state.settings.battleSpeed=settings.battleSpeed;
      if(settings.encounters!==undefined){state.settings.encounters=settings.encounters;state.encounterSteps=0;}
      emit();engine.save();
    },
    repeatPlans() {
      const battle=state.battle;
      if(state.mode!=='battle' || !battle || battle.phase!=='planning' || !battle.lastPlans)return;
      const first=battle.enemies.find(e=>e.hp>0);
      if(!first)return;
      // Repeat replaces the partial plan, including its item reservations.
      battle.plans={};
      for(const hero of living()) {
        if(hero.status==='sleep')continue;
        const previous=battle.lastPlans[hero.id];
        if(previous) {
          const action={...previous};
          if(action.type==='attack' || action.type==='spell' && SPELLS.find(s=>s.id===action.spellId)?.target==='enemy') {
            if(!battle.enemies.some(e=>e.id===action.target&&e.hp>0))action.target=first.id;
          }
          if(engine.plan(hero.id,action))continue;
        }
        engine.plan(hero.id,{type:'attack',target:first.id});
      }
      emit();
    },
    reset() { generation++; state = freshState(seed); try { storage?.removeItem(SAVE_KEY); } catch { /* optional storage */ } emit(); },
    save() {
      if (!storage || state.mode === 'creation' || state.mode === 'battle' || state.mode === 'defeat') return false;
      try { storage.setItem(SAVE_KEY, JSON.stringify(state)); return true; } catch { return false; }
    },
  };
  return engine;
}
