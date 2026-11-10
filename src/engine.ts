import progression from '../data/progression.json';
import itemData from '../data/items.json';
import world from '../data/world.json';
import type { Area, Battle, DemoEngine, Direction, Enemy, GameMap, GameState, Hero, HeroId, Item, MapEntity, PlannedAction, Slot, Spell } from './contracts';

export const SAVE_KEY = 'avel-demo-v1';
export const ITEMS = itemData.items as Item[];
export const getItem = (id: string): Item | undefined => ITEMS.find(item => item.id === id);
export const SPELLS: Spell[] = [
  { id: 'mend', name: 'Mend', tier: 1, users: ['Iona'], target: 'ally', description: 'Restore one ally’s HP. Uses one tier-I charge.' },
  { id: 'shelter', name: 'Shelter', tier: 1, users: ['Iona'], target: 'allAllies', description: 'Protect the whole party for this round.' },
  { id: 'ember', name: 'Ember', tier: 1, users: ['Soren'], target: 'enemy', description: 'Fire magic. Strong against wisps and exposed roots.' },
  { id: 'spark', name: 'Spark', tier: 1, users: ['Soren'], target: 'enemy', description: 'Lightning magic. Strong against brass and shells.' },
  { id: 'frost', name: 'Frost', tier: 1, users: ['Soren'], target: 'enemy', description: 'Frost magic. Strong against hounds and soot wisps.' },
  { id: 'renew', name: 'Renew', tier: 2, users: ['Iona'], target: 'allAllies', description: 'Restore HP to every living ally. Unlocks at level 5.' },
  { id: 'wave', name: 'Storm Wave', tier: 2, users: ['Soren'], target: 'allEnemies', description: 'Lightning to all enemies. Unlocks at level 5.' },
];

const HERO_IDS: HeroId[] = ['Mara', 'Tavin', 'Iona', 'Soren'];
const ROLES = { Mara: 'Warden', Tavin: 'Striker', Iona: 'Mender', Soren: 'Arcanist' };
const SLOTS: Slot[] = ['weapon', 'body', 'head', 'mantle', 'charm'];
const SET_PIECES = ['R01_SET_HEAD', 'R01_SET_MANTLE', 'R01_SET_CHARM'];
const PASSABLE = 'gdsf';
const ENCOUNTER_IDS = ['encounter1', 'encounter2', 'encounter3', 'encounter4', 'encounter5', 'encounter6', 'bailiff', 'silver'];
const CASTER_IDS: HeroId[] = ['Iona', 'Soren'];
const BATTLE_ITEMS = ['POTION', 'HIGH_POTION', 'MENDING_BALM', 'REVIVAL_SALT', 'ANTIDOTE', 'SOOTHING_DRAUGHT', 'CLEAR_TONIC'];
const SHOP_PRICES: Record<string, number> = { POTION: 30, ANTIDOTE: 20, REVIVAL_SALT: 300, CLEAR_TONIC: 35 };

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

export const MAPS: Record<Area, GameMap> = { camp: campMap(), works: worksMap() };

function levelFromXp(xp: number): number {
  return Math.max(1, progression.xp_thresholds.filter(threshold => xp >= threshold).length);
}

function chargesAt(level: number, id: HeroId): number[] {
  return progression.spell_tier_unlocks.map(unlock => !CASTER_IDS.includes(id) || level < unlock ? 0 : Math.min(9, 2 + Math.floor((level - unlock) / 4)));
}

function starterEquipment(id: HeroId): Record<Slot, string> {
  return { weapon: `R01_${id.toUpperCase()}_WEAPON`, body: `R01_${id.toUpperCase()}_BODY`, head: 'R01_COMMON_HEAD', mantle: 'R01_COMMON_MANTLE', charm: 'R01_COMMON_CHARM' };
}

function deriveHero(id: HeroId, level: number, equipment: Record<Slot, string>): Hero {
  const base = progression.heroes[id];
  const values = Object.values(equipment).map(getItem).filter((item): item is Item => Boolean(item));
  const gearStat = (key: string) => values.reduce((sum, item) => sum + (item.stats?.[key] ?? 0), 0);
  const accuracy = Math.floor(base.accuracy[0] + base.accuracy[1] * (level - 1));
  const hp = base.hp[0] + base.hp[1] * (level - 1);
  const charges = chargesAt(level, id);
  return { id, role: ROLES[id], level, hp, maxHp: hp,
    attack: Math.floor(base.strength[0] + base.strength[1] * (level - 1)) + gearStat('attack'),
    defense: 2 + Math.floor((level - 1) / 3) + gearStat('defense'),
    magic: Math.floor(base.magic[0] + base.magic[1] * (level - 1)) + gearStat('magic'),
    accuracy, hits: Math.min(4, 1 + Math.floor(accuracy / 40)),
    charges: [...charges], maxCharges: charges, status: null, equipment: { ...equipment } };
}

function freshState(seed: number): GameState {
  const inventory: Record<string, number> = { ...progression.starting_loadout.supplies };
  for (const id of HERO_IDS) for (const item of Object.values(starterEquipment(id))) inventory[item] = (inventory[item] ?? 0) + 1;
  return { version: 1, mode: 'explore', area: 'camp', player: { x: 11, y: 10, facing: 'right' },
    heroes: HERO_IDS.map(id => deriveHero(id, 1, starterEquipment(id))), inventory, gold: 60, xp: 0,
    flags: { briefed: false, bossDefeated: false, completed: false, sideQuest: false, chest: false, stamp: false },
    cleared: [], tracks: 0, rareReady: false, setAcquired: [], battle: null, reward: null, steps: 0,
    message: { speaker: 'The First Watch', text: 'Merewatch’s bell has fallen silent. Speak to Bessa, then follow the eastern path into the bellworks. Find the missing workers. Bring them home.' }, rng: seed >>> 0 || 7321 };
}

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const intRange = (value: unknown, lo: number, hi: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= lo && value <= hi;

/** The save boundary rejects malformed structures and derives combat statistics anew. */
function restore(raw: string, seed: number): GameState | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || value.version !== 1 || !['explore', 'victory', 'ending'].includes(String(value.mode)) || !['camp', 'works'].includes(String(value.area))) return null;
    if (!intRange(value.xp, 0, 1_000_000_000) || !intRange(value.gold, 0, 10_000_000) || !intRange(value.rng, 0, 0xffffffff) || !intRange(value.steps, 0, 100_000_000)) return null;
    const flags = value.flags;
    if (!isRecord(flags) || !['briefed', 'bossDefeated', 'completed', 'sideQuest', 'chest', 'stamp'].every(flag => typeof flags[flag] === 'boolean')) return null;
    if (!isRecord(value.player) || !intRange(value.player.x, 0, 31) || !intRange(value.player.y, 0, 17) || !['up', 'down', 'left', 'right'].includes(String(value.player.facing))) return null;
    if (!Array.isArray(value.cleared) || !value.cleared.every(id => typeof id === 'string' && ENCOUNTER_IDS.includes(id)) || new Set(value.cleared).size !== value.cleared.length) return null;
    if (!intRange(value.tracks, 0, 12) || typeof value.rareReady !== 'boolean' || !Array.isArray(value.setAcquired) || !value.setAcquired.every(id => typeof id === 'string' && SET_PIECES.includes(id)) || new Set(value.setAcquired).size !== value.setAcquired.length) return null;
    if (!isRecord(value.inventory) || !Object.entries(value.inventory).every(([id, amount]) => getItem(id) && intRange(amount, 0, 99))) return null;
    const state = freshState(seed);
    state.mode = value.mode as GameState['mode']; state.area = value.area as Area;
    state.xp = value.xp; state.gold = value.gold; state.rng = value.rng; state.steps = value.steps;
    state.flags = { ...flags } as GameState['flags']; state.player = { ...value.player } as GameState['player'];
    if (!PASSABLE.includes(MAPS[state.area].tiles[state.player.y][state.player.x])) return null;
    state.cleared = [...value.cleared] as string[]; state.tracks = value.tracks; state.rareReady = value.rareReady;
    state.setAcquired = [...value.setAcquired] as string[]; state.inventory = { ...value.inventory } as Record<string, number>;
    const savedHeroes = value.heroes;
    if (!Array.isArray(savedHeroes) || savedHeroes.length !== 4) return null;
    const uniqueEquipped = new Set<string>();
    state.heroes = HERO_IDS.map((id, index) => {
      const saved = savedHeroes[index];
      if (!isRecord(saved) || saved.id !== id || !isRecord(saved.equipment)) throw new Error('Invalid hero');
      const equipment = {} as Record<Slot, string>;
      for (const slot of SLOTS) {
        const itemId = saved.equipment[slot];
        if (typeof itemId !== 'string') throw new Error('Invalid equipment');
        const item = getItem(itemId);
        if (!item || item.kind !== 'equipment' || item.slot !== slot || !item.users?.includes(id) || !state.inventory[itemId]) throw new Error('Unavailable equipment');
        if (item.set_id && (!state.setAcquired.includes(itemId) || uniqueEquipped.has(itemId))) throw new Error('Duplicated set item');
        if (item.set_id) uniqueEquipped.add(itemId);
        equipment[slot] = itemId;
      }
      const hero = deriveHero(id, levelFromXp(state.xp), equipment);
      if (!intRange(saved.hp, 0, hero.maxHp) || !Array.isArray(saved.charges) || saved.charges.length !== 8 || !saved.charges.every((n, i) => intRange(n, 0, hero.maxCharges[i]))) throw new Error('Invalid resources');
      if (saved.status !== null && !['poison', 'sleep', 'silence'].includes(String(saved.status))) throw new Error('Invalid status');
      return { ...hero, hp: saved.hp, charges: [...saved.charges] as number[], status: saved.status as Hero['status'] };
    });
    if (state.setAcquired.some(id => state.inventory[id] !== 1)) return null;
    state.message = isRecord(value.message) && typeof value.message.speaker === 'string' && typeof value.message.text === 'string' ? { speaker: value.message.speaker.slice(0, 80), text: value.message.text.slice(0, 1500) } : null;
    state.battle = null;
    state.reward = null;
    if (state.mode === 'victory') {
      if (!isRecord(value.reward) || typeof value.reward.title !== 'string' || !Array.isArray(value.reward.lines) || !value.reward.lines.every(line => typeof line === 'string') || !['normal', 'boss', 'rare', 'chest'].includes(String(value.reward.source)) || !Array.isArray(value.reward.choices) || !value.reward.choices.every(id => typeof id === 'string' && SET_PIECES.includes(id) && !state.setAcquired.includes(id))) return null;
      state.reward = { title: value.reward.title.slice(0, 100), lines: (value.reward.lines as string[]).map(line => line.slice(0, 300)), source: value.reward.source as NonNullable<GameState['reward']>['source'], choices: value.reward.choices as string[] };
    }
    return state;
  } catch { return null; }
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
  const unowned = () => SET_PIECES.filter(id => !state.setAcquired.includes(id));
  const living = () => state.heroes.filter(hero => hero.hp > 0);
  const say = (speaker: string, text: string) => { state.message = { speaker, text }; emit(); engine.save(); };
  const log = (text: string, cue?: Battle['cue']) => { if (state.battle) { state.battle.log.push(text); state.battle.log = state.battle.log.slice(-24); state.battle.cue = cue; } emit(); };
  const wait = () => delay > 0 ? new Promise<void>(resolve => setTimeout(resolve, delay)) : Promise.resolve();

  function map(): GameMap {
    const source = MAPS[state.area];
    return { ...source, entities: source.entities.filter(entity => {
      if (entity.id === 'chest' && state.flags.chest) return false;
      if (ENCOUNTER_IDS.includes(entity.id) && state.cleared.includes(entity.id)) return false;
      if (entity.id === 'silver' && (!state.flags.completed || !state.rareReady)) return false;
      return true;
    }) };
  }

  function updateHeroes() {
    const level = levelFromXp(state.xp);
    state.heroes = state.heroes.map(old => {
      const next = deriveHero(old.id, level, old.equipment);
      next.hp = Math.min(next.maxHp, old.hp + (old.hp > 0 ? Math.max(0, next.maxHp - old.maxHp) : 0));
      next.charges = next.maxCharges.map((max, i) => Math.min(max, old.charges[i] + Math.max(0, max - old.maxCharges[i])));
      next.status = old.status;
      return next;
    });
  }

  function startBattle(id: string) {
    engine.save();
    let enemies: Enemy[];
    let kind: Battle['kind'] = 'normal';
    if (id === 'bailiff') {
      kind = 'boss';
      enemies = [{ id: 'bailiff', name: 'Brass Bailiff', family: 'SENTINEL', level: 4, hp: 500, maxHp: 500,
        attack: 17, defense: 7, weakness: ['lightning'], resistance: ['poison_status'], rank: 'boss',
        intent: 'Raises its hammer. A crushing strike follows next round.', status: null }];
    } else if (id === 'silver') {
      kind = 'rare';
      enemies = [{ id: 'silver', name: 'Silver Reedback', family: 'REEDBACK', level: 7, hp: 350, maxHp: 350,
        attack: 24, defense: 12, weakness: ['lightning'], resistance: ['frost'], rank: 'rare',
        intent: 'Withdraws into its silver shell before a powerful shove.', status: null }];
    } else {
      const pair: Record<string, string[]> = { encounter1: ['R01_E2', 'R01_E2'], encounter2: ['R01_E1', 'R01_E2'], encounter3: ['R01_E3', 'R01_E3'], encounter4: ['R01_E4', 'R01_E3'], encounter5: ['R01_E2', 'R01_E4'], encounter6: ['R01_E4', 'R01_E3'] };
      enemies = (pair[id] ?? pair.encounter1).map((template, i) => enemy(template, i, id === 'encounter5' && i === 0 ? 'ashen' : 'base'));
    }
    state.message = null; state.reward = null; state.mode = 'battle';
    battleShields.clear();
    for (const hero of state.heroes) if (Object.values(hero.equipment).filter(item => SET_PIECES.includes(item)).length >= 2) battleShields.set(hero.id, Math.ceil(hero.maxHp * .05));
    state.battle = { encounterId: id, title: kind === 'boss' ? 'The Binding Chamber' : kind === 'rare' ? 'A Silver Glimmer' : 'Beneath Merewatch',
      kind, enemies, round: 1, phase: 'planning', plans: {}, log: [kind === 'boss' ? 'Iona: “He’s alive. Break the brass joints. We’re freeing Orren.”' : kind === 'rare' ? 'Demo hunt: a disclosed, guaranteed encounter to complete the Reedwatch collection.' : 'Choose an action for each hero, then commit the round.'] };
    emit();
  }

  function victory() {
    const battle = state.battle;
    if (!battle || state.mode !== 'battle') return;
    const oldLevel = state.heroes[0].level;
    const xp = battle.kind === 'boss' ? 88 : battle.kind === 'rare' ? 42 : 28;
    const gold = battle.kind === 'boss' ? 200 : battle.kind === 'rare' ? 90 : 70;
    state.xp += xp; state.gold += gold;
    if (!state.cleared.includes(battle.encounterId)) state.cleared.push(battle.encounterId);
    if (battle.kind === 'boss') state.flags.bossDefeated = true;
    if (battle.kind === 'rare') { state.rareReady = false; state.tracks = 0; }
    else if (battle.kind === 'normal') state.tracks = Math.min(12, state.tracks + 1);
    updateHeroes();
    const lines = [`Each hero gains ${xp} EXP. The party finds ${gold} gold.`];
    if (state.heroes[0].level > oldLevel) lines.push(`The whole party reaches level ${state.heroes[0].level}.`);
    if (battle.kind === 'normal' && random() < .2) {
      const roll = random(); const item = roll < .5 ? 'POTION' : roll < .75 ? 'ANTIDOTE' : 'SOOTHING_DRAUGHT';
      state.inventory[item] = Math.min(20, (state.inventory[item] ?? 0) + 1); lines.push(`Found ${getItem(item)!.name}.`);
    }
    if (battle.kind === 'boss') lines.push('The binding frame opens. Orren survives. Return to Bessa at Reedbank.');
    if (battle.kind === 'rare') lines.push('The Silver Reedback’s reclaimed cache holds a missing Reedwatch piece.');
    state.reward = { title: battle.kind === 'boss' ? 'Orren Is Free' : battle.kind === 'rare' ? 'A Rare Discovery' : 'Victory', lines,
      source: battle.kind, choices: battle.kind === 'normal' ? [] : unowned() };
    if (battle.kind !== 'normal' && state.reward.choices.length === 0) { state.inventory.POTION = Math.min(20, (state.inventory.POTION ?? 0) + 1); lines.push('Collection complete: received a Field Potion.'); }
    state.mode = 'victory'; emit(); engine.save();
  }

  function checkEnd(): boolean {
    if (!state.battle || state.mode !== 'battle') return true;
    if (living().length === 0) { state.mode = 'defeat'; emit(); return true; }
    if (state.battle.enemies.every(enemy => enemy.hp <= 0)) { victory(); return true; }
    return false;
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
      state.player.x = x; state.player.y = y; state.steps += 1; emit(); engine.save();
    },
    interact(entityId) {
      if (state.message) { engine.dismiss(); return; }
      if (state.mode !== 'explore') return;
      const near = map().entities.filter(entity => Math.abs(entity.x - state.player.x) + Math.abs(entity.y - state.player.y) <= 1);
      const entity = entityId ? near.find(row => row.id === entityId) : near[0];
      if (!entity) return;
      if (entity.id === 'toWorks') {
        if (!state.flags.briefed) { say('Mara', 'We should speak to Bessa before entering the bellworks.'); return; }
        state.area = 'works'; state.player = { x: 3, y: 15, facing: 'up' }; say('Merewatch', 'The meal tins are still warm. Six visible patrols guard the passages. You can return to the watchfire to recover at any time.');
      } else if (entity.id === 'toCamp') {
        state.area = 'camp'; state.player = { x: 27, y: 8, facing: 'left' }; emit(); engine.save();
      } else if (entity.id === 'bessa') {
        if (state.flags.bossDefeated && !state.flags.completed) {
          state.flags.completed = true; state.rareReady = !state.cleared.includes('silver'); state.mode = 'ending'; state.message = null;
          emit(); engine.save();
        } else if (state.flags.completed) say('Bessa', 'Orren is resting. The receiving shelter is ready, and the ledger points toward Dunmere. A Silver Reedback has been tracked in the eastern clearing: an optional demo hunt, with a guaranteed missing set piece.');
        else { state.flags.briefed = true; say('Bessa', 'Merewatch’s warning has stopped. Bring the workers back before you bring back any tools. Take the eastern path. Rest at our watchfire whenever you need to.'); }
      } else if (entity.id === 'fire') engine.rest();
      else if (entity.id === 'lantern') {
        if (!state.flags.sideQuest) { state.flags.sideQuest = true; state.inventory.POTION = Math.min(20, (state.inventory.POTION ?? 0) + 1); say('Keep a Light for Me', 'You mend the lantern handles and hang Rill’s painted sign. Bessa sets aside one extra Field Potion. “Ring. Someone will come.”'); }
        else say('Rill', 'The lantern is ready. I painted the sign myself.');
      } else if (entity.id === 'merchant') say('Quartermaster', 'Supplies travel with the camp. Open the Supplies panel to buy Field Potions, Antitoxin, Clear Tonic, and Revival Salt. The watchfire restores HP and spell charges for free.');
      else if (entity.id === 'chest' && !state.flags.chest) {
        state.flags.chest = true; state.reward = { title: 'The Inspection Lockbox', lines: ['A reclaimed piece of Reedwatch equipment lies beneath the shift notebook. Choose one unowned piece.'], source: 'chest', choices: unowned() };
        state.mode = 'victory'; emit(); engine.save();
      } else if (ENCOUNTER_IDS.includes(entity.id) && !state.cleared.includes(entity.id)) startBattle(entity.id);
    },
    dismiss() { state.message = null; emit(); engine.save(); },
    rest() {
      if (state.mode !== 'explore' || state.area !== 'camp' || state.reward) return;
      for (const hero of state.heroes) { hero.hp = hero.maxHp; hero.status = null; hero.charges = [...hero.maxCharges]; }
      say('At the Watchfire', 'Warm food, a change of watch, and a little sleep. Everyone’s HP, spell charges, and conditions are restored.');
    },
    plan(heroId, action) {
      const battle = state.battle; const hero = state.heroes.find(row => row.id === heroId);
      if (state.mode !== 'battle' || !battle || battle.phase !== 'planning' || !hero || hero.hp <= 0 || hero.status === 'sleep') return false;
      if (!['attack', 'guard', 'spell', 'item'].includes(action.type)) return false;
      if (action.type === 'attack' && !battle.enemies.some(enemy => enemy.id === action.target && enemy.hp > 0)) return false;
      if (action.type === 'spell') {
        const spell = SPELLS.find(spell => spell.id === action.spellId);
        if (!spell || !spell.users.includes(hero.id) || hero.charges[spell.tier - 1] <= 0 || hero.status === 'silence') return false;
        if (spell.target === 'enemy' && !battle.enemies.some(enemy => enemy.id === action.target && enemy.hp > 0)) return false;
        if (spell.target === 'ally' && !state.heroes.some(ally => ally.id === action.target && ally.hp > 0)) return false;
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
          if (hero.status === 'sleep') { hero.status = null; log(`${hero.id} wakes, losing this turn.`); await wait(); continue; }
          const action = battle.plans[hero.id]; if (!action) continue;
          if (action.type === 'guard') log(`${hero.id} stands ready to guard.`, { actor: hero.id, target: hero.id, amount: 0, kind: 'guard' });
          else if (action.type === 'attack') {
            const target = battle.enemies.find(row => row.id === action.target && row.hp > 0) ?? battle.enemies.find(row => row.hp > 0);
            if (!target) { checkEnd(); return; }
            let damage = 0, hits = 0;
            for (let hit = 0; hit < hero.hits; hit++) if (random() < .93) { hits++; damage += Math.max(1, Math.round(hero.attack * (1.2 + random() * .45)) - target.defense); }
            target.hp = Math.max(0, target.hp - damage);
            log(`${hero.id} attacks ${target.name}: ${damage} damage${hits > 1 ? ` (${hits} hits)` : hits === 0 ? ' — missed' : ''}.`, { actor: hero.id, target: target.id, amount: damage, kind: 'hit' });
          } else if (action.type === 'spell') {
            const spell = SPELLS.find(row => row.id === action.spellId)!;
            if (hero.status === 'silence' || hero.charges[spell.tier - 1] <= 0) log(`${hero.id} cannot cast. No charge spent.`);
            else if (spell.target === 'ally') {
              const target = state.heroes.find(row => row.id === action.target && row.hp > 0);
              if (!target) log(`${hero.id}'s target is no longer valid. No charge spent.`);
              else { hero.charges[spell.tier - 1]--; const amount = Math.min(target.maxHp - target.hp, 20 + hero.magic * 2); target.hp += amount;
                log(`${hero.id} casts ${spell.name}: ${target.id} recovers ${amount} HP.`, { actor: hero.id, target: target.id, amount, kind: 'heal' }); }
            } else if (spell.id === 'shelter') {
              hero.charges[0]--; living().forEach(ally => guard.add(ally.id)); log('Iona casts Shelter. Living allies are protected for the rest of the round.', { actor: hero.id, target: hero.id, amount: 0, kind: 'guard' });
            } else if (spell.id === 'renew') {
              hero.charges[1]--; for (const target of living()) target.hp = Math.min(target.maxHp, target.hp + Math.round(20 + hero.magic * 1.5));
              log('Iona casts Renew. The whole party recovers HP.', { actor: hero.id, target: hero.id, amount: Math.round(20 + hero.magic * 1.5), kind: 'heal' });
            } else {
              const targets = spell.target === 'allEnemies' ? battle.enemies.filter(row => row.hp > 0) : [battle.enemies.find(row => row.id === action.target && row.hp > 0) ?? battle.enemies.find(row => row.hp > 0)].filter((row): row is Enemy => Boolean(row));
              if (!targets.length) { checkEnd(); return; }
              hero.charges[spell.tier - 1]--;
              const element = spell.id === 'ember' ? 'fire' : spell.id === 'frost' ? 'frost' : 'lightning';
              for (const target of targets) {
                const multiplier = target.weakness.includes(element) ? 1.5 : target.resistance.includes(element) ? .5 : 1;
                const damage = Math.round((12 + hero.magic * 2) * multiplier * (targets.length > 1 ? .7 : 1));
                target.hp = Math.max(0, target.hp - damage);
                log(`${hero.id} casts ${spell.name} on ${target.name}: ${damage}${multiplier > 1 ? ' — weak point!' : multiplier < 1 ? ' — resisted' : ''}.`, { actor: hero.id, target: target.id, amount: damage, kind: 'spell' });
              }
            }
          } else if (action.type === 'item') {
            const target = state.heroes.find(row => row.id === action.target);
            const before = target?.hp ?? 0;
            if (target && action.itemId && applyItem(action.itemId, target)) log(`${hero.id} uses ${getItem(action.itemId)?.name} on ${target.id}.`, { actor: hero.id, target: target.id, amount: target.hp - before, kind: 'heal' });
            else log(`${hero.id}'s item target changed. The item is kept.`);
          }
        } else {
          const enemy = battle.enemies.find(row => row.id === actor.id)!;
          if (enemy.hp <= 0) continue;
          if (enemy.status === 'sleep') { enemy.status = null; log(`${enemy.name} wakes.`); await wait(); continue; }
          const available = living(); if (!available.length) { checkEnd(); return; }
          const weighted = available.flatMap(hero => Array(hero.id === 'Mara' ? 4 : hero.id === 'Tavin' ? 2 : 1).fill(hero)) as Hero[];
          const target = choose(weighted);
          const heavy = battle.kind !== 'normal' && battle.round % 2 === 0;
          let damage = Math.max(2, Math.round(enemy.attack * (heavy ? 3 : 1.4) + random() * 4) - target.defense);
          if (guard.has(target.id)) damage = Math.max(1, Math.floor(damage * .5));
          const barrier = shield.get(target.id) ?? 0;
          if (barrier > 0) { const absorbed = Math.min(barrier, damage); damage -= absorbed; shield.set(target.id, barrier - absorbed); }
          target.hp = Math.max(0, target.hp - damage);
          const setCount = Object.values(target.equipment).filter(id => SET_PIECES.includes(id)).length;
          if (enemy.family === 'WISP' && target.hp > 0 && random() < (setCount >= 3 ? .1 : .2)) target.status = 'poison';
          log(`${enemy.name} ${heavy ? 'unleashes its warned heavy strike' : 'strikes'} ${target.id}: ${damage}${guard.has(target.id) ? ' (guarded)' : ''}.`, { actor: enemy.id, target: target.id, amount: damage, kind: 'hit' });
        }
        if (checkEnd()) return;
        await wait();
      }
      if (token !== generation || state.mode !== 'battle') return;
      for (const hero of living()) if (hero.status === 'poison') {
        const amount = Math.max(2, Math.floor(hero.maxHp * .05)); hero.hp = Math.max(0, hero.hp - amount); log(`${hero.id} suffers ${amount} poison damage.`);
      }
      if (checkEnd()) return;
      battle.round++; battle.phase = 'planning'; battle.plans = {}; battle.cue = undefined;
      for (const enemy of battle.enemies) if (enemy.rank === 'boss' || enemy.rank === 'rare') enemy.intent = battle.round % 2 === 0 ? 'HEAVY STRIKE THIS ROUND — Guard reduces damage.' : 'Recovering and preparing its next heavy strike.';
      log(`Round ${battle.round}. Plan the party’s actions.`);
    },
    async flee() {
      const battle = state.battle;
      if (state.mode !== 'battle' || !battle || battle.phase !== 'planning' || battle.kind === 'boss') return;
      if (random() < (battle.kind === 'rare' ? .8 : .9)) {
        state.mode = 'explore'; state.battle = null; say('Retreat', 'The party withdraws. No EXP or gold gained. The enemy remains, and your hunt progress is kept.');
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
      if (state.mode === 'victory') {
        if (state.reward?.choices.length) return;
        const boss = state.reward?.source === 'boss';
        state.reward = null; state.battle = null; state.mode = 'explore';
        if (boss) say('Orren', 'There was a name. I was keeping it safe. Please… take me back to the camp.');
        else { emit(); engine.save(); }
      } else if (state.mode === 'defeat') {
        state.mode = 'explore'; state.area = 'camp'; state.player = { x: 11, y: 10, facing: 'right' }; state.battle = null; state.reward = null; engine.rest();
      } else if (state.mode === 'ending') {
        state.mode = 'explore'; say('After the First Watch', 'The first expedition is complete. Explore freely, equip your Reedwatch pieces, or visit the eastern clearing for the guaranteed demo rare hunt. Rest first: the Silver Reedback is level 7.');
      }
    },
    equip(heroId, itemId) {
      if (state.mode !== 'explore' || state.reward) return false;
      const hero = state.heroes.find(row => row.id === heroId); const item = getItem(itemId);
      if (!hero || !item || item.kind !== 'equipment' || !item.slot || !item.users?.includes(heroId) || !(state.inventory[itemId] > 0)) return false;
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
      if (state.mode !== 'explore' || state.area !== 'camp' || state.reward) return false;
      const cost = SHOP_PRICES[itemId];
      if (!cost || state.gold < cost || (state.inventory[itemId] ?? 0) >= 20) return false;
      state.gold -= cost; state.inventory[itemId] = (state.inventory[itemId] ?? 0) + 1; emit(); engine.save(); return true;
    },
    reset() { generation++; state = freshState(seed); try { storage?.removeItem(SAVE_KEY); } catch { /* optional storage */ } emit(); },
    save() {
      if (!storage || state.mode === 'battle' || state.mode === 'defeat') return false;
      try { storage.setItem(SAVE_KEY, JSON.stringify(state)); return true; } catch { return false; }
    },
  };
  return engine;
}
