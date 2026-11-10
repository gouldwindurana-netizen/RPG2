export type Direction = 'up' | 'down' | 'left' | 'right';
export type Area = 'camp' | 'works';
export type Slot = 'weapon' | 'body' | 'head' | 'mantle' | 'charm';
export type HeroId = 'Mara' | 'Tavin' | 'Iona' | 'Soren';
export interface Hero {
  id: HeroId; role: string; level: number; hp: number; maxHp: number;
  attack: number; defense: number; magic: number; accuracy: number; hits: number;
  charges: number[]; maxCharges: number[]; status: 'poison' | 'sleep' | 'silence' | null;
  equipment: Record<Slot, string>;
}
export interface Enemy {
  id: string; name: string; family: string; level: number; hp: number; maxHp: number;
  attack: number; defense: number; weakness: string[]; resistance: string[];
  rank: 'base' | 'ashen' | 'crested' | 'rare' | 'boss'; intent: string;
  status: 'poison' | 'sleep' | null;
}
export interface PlannedAction {
  type: 'attack' | 'guard' | 'spell' | 'item'; target: string; spellId?: string; itemId?: string;
}
export interface Battle {
  encounterId: string; title: string; kind: 'normal' | 'boss' | 'rare';
  enemies: Enemy[]; round: number; phase: 'planning' | 'resolving';
  plans: Partial<Record<HeroId, PlannedAction>>; log: string[];
  cue?: { actor: string; target: string; amount: number; kind: 'hit' | 'heal' | 'guard' | 'spell' };
}
export interface MapEntity {
  id: string; x: number; y: number; kind: 'npc' | 'enemy' | 'boss' | 'rare' | 'chest' | 'exit' | 'campfire';
  name: string; sprite: string; hint: string;
}
export interface GameMap {
  width: number; height: number; tiles: string[]; entities: MapEntity[];
}
export interface GameState {
  version: 1; mode: 'explore' | 'battle' | 'victory' | 'defeat' | 'ending'; area: Area;
  player: { x: number; y: number; facing: Direction };
  heroes: Hero[]; inventory: Record<string, number>; gold: number; xp: number;
  flags: { briefed: boolean; bossDefeated: boolean; completed: boolean; sideQuest: boolean; chest: boolean; stamp: boolean };
  cleared: string[]; tracks: number; rareReady: boolean; setAcquired: string[];
  battle: Battle | null; message: { speaker: string; text: string } | null;
  reward: { title: string; lines: string[]; source: 'normal' | 'boss' | 'rare' | 'chest'; choices: string[] } | null;
  steps: number; rng: number;
}
export interface Spell { id: string; name: string; tier: number; users: HeroId[]; target: 'enemy' | 'ally' | 'allEnemies' | 'allAllies'; description: string; }
export interface Item { id: string; name: string; kind: string; slot?: Slot; stats?: Record<string, number>; users?: string[]; effect?: string; description?: string; set_id?: string; }
export interface DemoEngine {
  state: GameState;
  subscribe(fn: () => void): () => void;
  map(): GameMap;
  move(direction: Direction): void;
  interact(entityId?: string): void;
  dismiss(): void;
  rest(): void;
  plan(hero: HeroId, action: PlannedAction): boolean;
  undo(hero: HeroId): void;
  resolveRound(): Promise<void>;
  flee(): Promise<void>;
  claim(itemId: string): void;
  continue(): void;
  equip(hero: HeroId, itemId: string): boolean;
  useItem(itemId: string, hero: HeroId): boolean;
  buy(itemId: string): boolean;
  reset(): void;
  save(): boolean;
}
