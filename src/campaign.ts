import type { Area, GameMap, GameState, MapEntity } from './contracts';

export interface CampaignMessage { speaker: string; text: string; }
export interface StoryEvent { messages: CampaignMessage[]; stage?: number; switches?: string[]; }
export interface TravelTransition { area: Area; x: number; y: number; minStage?: number; requiredSwitch?: string; blockedText?: string; }
export interface BossRequirement { minStage?: number; requiredSwitch?: string; blockedText: string; }
export interface AreaInformation { name: string; regionId: string; safe: boolean; recommended: [number, number]; }

export const AREA_INFO: Record<Area, AreaInformation> = {
  camp: { name: 'Reedbank Shelter', regionId: 'R01', safe: true, recommended: [1, 5] },
  works: { name: 'Merewatch Bellworks', regionId: 'R01', safe: false, recommended: [1, 5] },
  overworld: { name: 'The Roads of Avel', regionId: 'R01', safe: false, recommended: [1, 34] },
  dunmere: { name: 'Dunmere Market', regionId: 'R02', safe: true, recommended: [5, 10] },
  tollhouse: { name: 'The Impounding Tollhouse', regionId: 'R02', safe: false, recommended: [5, 10] },
  fen: { name: 'Alder Fen Village', regionId: 'R03', safe: true, recommended: [10, 16] },
  granary: { name: 'The Flooded Granary', regionId: 'R03', safe: false, recommended: [10, 16] },
  orchard: { name: 'Orchard Highroad', regionId: 'R04', safe: false, recommended: [16, 22] },
  crown: { name: 'Crown Road Handover', regionId: 'R05', safe: false, recommended: [22, 28] },
  veyr: { name: 'Veyr Refuge Quarter', regionId: 'R06', safe: true, recommended: [28, 34] },
  heart: { name: 'The Last Service Passage', regionId: 'R06', safe: false, recommended: [30, 34] },
};

/** Village courts and the rear-guard checkpoint stay calm within dangerous maps. */
export function isSafeLocation(area: Area, x: number, y: number): boolean {
  if (AREA_INFO[area].safe) return true;
  if ((area === 'orchard' || area === 'crown') && x >= 2 && x <= 18 && y >= 8 && y <= 16) return true;
  return area === 'heart' && x >= 3 && x <= 6 && y >= 13 && y <= 15;
}

export const QUEST_TITLES = [
  'The Silent Watch', 'What We Carry', 'An Honest Account', 'Two Places at the Table',
  'A Roof for the Night', 'The Second Shelter', 'Every Bell Has a Door',
  'The City That Would Not Leave', 'The Last Watch', 'Beyond the Bells', 'The Road Ahead',
];

export const KNOWN_SWITCHES = [
  'orren_rescued', 'reedbank_moved', 'leth_records', 'toll_defeated', 'neri_rescued',
  'sen_briefed', 'silt_defeated', 'trial_failed', 'hart_defeated', 'second_shelter',
  'censer_defeated', 'regional_feeders_retired', 'crew_accounted', 'veyr_supplies',
  'veyr_wards', 'evacuation_ready', 'choir_defeated', 'vale_defeated', 'heart_defeated',
  'widow_defeated', 'colossus_defeated',
  'first_chapter_complete', 'bailiff_defeated', 'ending_seen',
];

export const TRANSITIONS: Record<string, TravelTransition> = {
  toWorks: { area: 'works', x: 3, y: 15 },
  toCamp: { area: 'camp', x: 27, y: 8 },
  'world-camp': { area: 'overworld', x: 8, y: 33, minStage: 2, blockedText: 'Bring Orren back to Bessa first. The Reedbank evacuation needs you here.' },
  'world-works': { area: 'overworld', x: 15, y: 32 },
  'enter-camp': { area: 'camp', x: 27, y: 14 },
  'enter-works': { area: 'works', x: 3, y: 15 },
  'road-dunmere': { area: 'overworld', x: 8, y: 25, minStage: 2, blockedText: 'Bessa must dispatch the Reedbank convoy before the north road opens.' },
  'road-reedbank': { area: 'overworld', x: 8, y: 27 },
  'ferry-fen': { area: 'overworld', x: 26, y: 21, minStage: 4, blockedText: 'The ferry is held for the rescued tollhouse captives. Find Neri and arrange their departure first.' },
  'ferry-saltroad': { area: 'overworld', x: 23, y: 21 },
  'pass-orchard': { area: 'overworld', x: 35, y: 28, minStage: 5, blockedText: 'Sen needs the granary supplies and a supervised shelter trial before sending anyone through the high pass.' },
  'pass-fen': { area: 'overworld', x: 33, y: 28 },
  'road-crown': { area: 'overworld', x: 46, y: 22, minStage: 6, blockedText: 'Complete the second shelter with the Orchard keeper. The convoy needs a safe receiving point.' },
  'road-orchard': { area: 'overworld', x: 46, y: 24 },
  'gate-veyr': { area: 'overworld', x: 53, y: 10, minStage: 7, requiredSwitch: 'regional_feeders_retired', blockedText: 'Halden must complete the regional tower handovers before the party can enter Veyr.' },
  'gate-crown': { area: 'overworld', x: 53, y: 12 },
  'enter-dunmere': { area: 'dunmere', x: 3, y: 14, minStage: 2 },
  'world-dunmere': { area: 'overworld', x: 8, y: 21 },
  'enter-tollhouse': { area: 'tollhouse', x: 3, y: 14, minStage: 3, requiredSwitch: 'leth_records', blockedText: 'Speak to Leth in Dunmere. His copied records and witness plan will get you through the tollhouse.' },
  'world-tollhouse': { area: 'overworld', x: 18, y: 20 },
  'town-tollhouse': { area: 'tollhouse', x: 3, y: 14, minStage: 3, requiredSwitch: 'leth_records', blockedText: 'Leth has not yet arranged the witnesses and copied the transfer ledger.' },
  'enter-fen': { area: 'fen', x: 3, y: 14, minStage: 4 },
  'world-fen': { area: 'overworld', x: 28, y: 23 },
  'enter-granary': { area: 'granary', x: 3, y: 14, minStage: 4, requiredSwitch: 'sen_briefed', blockedText: 'Ask Sen in Alder Fen about the flooded granary and the shelter trial first.' },
  'town-granary': { area: 'granary', x: 3, y: 14, minStage: 4, requiredSwitch: 'sen_briefed', blockedText: 'Speak to Sen before entering the flooded stores.' },
  'world-granary': { area: 'overworld', x: 29, y: 18 },
  'enter-orchard': { area: 'orchard', x: 3, y: 14, minStage: 5 },
  'world-orchard': { area: 'overworld', x: 41, y: 30 },
  'enter-crown': { area: 'crown', x: 3, y: 14, minStage: 6 },
  'world-crown': { area: 'overworld', x: 46, y: 19 },
  'enter-veyr': { area: 'veyr', x: 3, y: 14, minStage: 7 },
  'world-veyr': { area: 'overworld', x: 53, y: 8 },
  'enter-heart': { area: 'heart', x: 3, y: 14, minStage: 8, requiredSwitch: 'evacuation_ready', blockedText: 'Meet Leth, Neri and Bessa in Veyr. The intake patients, kitchens and ward crews must all be ready.' },
  'town-heart': { area: 'heart', x: 3, y: 14, minStage: 8, requiredSwitch: 'evacuation_ready', blockedText: 'The final operation needs Leth’s intake report, Neri’s supply convoy and Bessa’s ward schedule.' },
  'world-heart': { area: 'overworld', x: 58, y: 6 },
};

export const BOSS_REQUIREMENTS: Record<string, BossRequirement> = {
  bailiff: { minStage: 0, blockedText: 'Find the missing crew inside Merewatch.' },
  B_R02_TOLL: { minStage: 3, requiredSwitch: 'leth_records', blockedText: 'Leth needs to protect the witnesses and copy the transfer records first.' },
  B_R03_SILT: { minStage: 4, requiredSwitch: 'sen_briefed', blockedText: 'Speak to Sen about the granary and trial before starting this clearance.' },
  B_R04_HART: { minStage: 5, requiredSwitch: 'trial_failed', blockedText: 'Return to Sen after securing the granary. The trial will establish what the next shelter needs.' },
  B_R05_CENSER: { minStage: 6, requiredSwitch: 'second_shelter', blockedText: 'Complete the revised two-shelter trial with the Orchard keeper first.' },
  B_R06_CHOIR: { minStage: 8, requiredSwitch: 'evacuation_ready', blockedText: 'Complete all three Veyr preparations before entering the final operation.' },
  B_R06_VALE: { minStage: 8, requiredSwitch: 'choir_defeated', blockedText: 'The Night Choir holds the stairwell. Clear it before confronting Vale.' },
  B_R06_HEART: { minStage: 9, requiredSwitch: 'vale_defeated', blockedText: 'Break Vale’s command armor and pull him free before touching the Heart Bell.' },
  B_R04_WIDOW: { minStage: 6, requiredSwitch: 'second_shelter', blockedText: 'The nursery survey is optional. Secure the second refuge before taking this separate trail.' },
  B_R05_COLOSSUS: { minStage: 10, requiredSwitch: 'heart_defeated', blockedText: 'The Unlit Quarry is a level-42 challenge for after the last bell has fallen silent.' },
};

const msg = (speaker: string, text: string): CampaignMessage => ({ speaker, text });
export const BOSS_EVENTS: Record<string, Omit<StoryEvent, 'messages'> & { messages?: CampaignMessage[] }> = {
  bailiff: { stage: 1, switches: ['orren_rescued'], messages: [
    msg('Iona', 'The frame is open. He is breathing. Lower the broken brass carefully.'),
    msg('Orren', 'There was a name. I was keeping it safe. Orren. I still have that.'),
    msg('Soren', 'This was a feeding chamber. It was burning his memories to sustain the bell. I designed that regulator without ever asking what it regulated.'),
    msg('Iona', 'Rest will help his body. What was burned is gone. We can ask what he wants written about today.'),
    msg('Soren', 'Merewatch is no longer feeding. I can divert its finite reserve into the emergency lanterns. Enough for the road, if Bessa gets the carts moving.'),
    msg('Tavin', 'The transfer ledger names Neri. And the rest of the maintenance crew went to Veyr. Take the records. We are bringing people home.'),
  ] },
  B_R01_BAILIFF: { stage: 1, switches: ['orren_rescued'] },
  B_R02_TOLL: { switches: ['toll_defeated'], messages: [
    msg('Soren', 'The shutters have stopped. There is no person inside this one, but its departure locks controlled the entire yard.'),
    msg('Iona', 'The holding-room door is open. Let the captives choose who helps them. Tavin, the kitchen is just beyond us.'),
    msg('Tavin', 'I can hear someone arguing about flour. Please, let it be her.'),
  ] },
  B_R03_SILT: { switches: ['silt_defeated'], messages: [
    msg('Soren', 'The granary’s upper shelves are dry. We have food already stored here, not a promise of next year’s harvest.'),
    msg('Iona', 'Mark the flooded stairs and leave the spoiled sacks. Sen needs a safe supply list before she starts the trial.'),
    msg('Tavin', 'For once the treasure is beans. I refuse to complain about beans.'),
  ] },
  B_R04_HART: { switches: ['hart_defeated'], messages: [
    msg('Soren', 'The growth is broken, but the soil will take time. This residue matches the waste from Merewatch. The bells are worsening the fog beyond their own walls.'),
    msg('Iona', 'The clean storehouse and the ridge path are open. Take the keeper the all-clear. We need relief crews before we call this a refuge.'),
  ] },
  B_R05_CENSER: { switches: ['censer_defeated'], messages: [
    msg('Soren', 'The approach is secure. The captive release handles are intact; no one has to remain in this machine.'),
    msg('Halden', 'My volunteers can hold the passage. Return to the handover table. We shut each feeder down only after its receiving shelter confirms the people are safe.'),
  ] },
  B_R06_CHOIR: { switches: ['choir_defeated'], messages: [
    msg('Tavin', 'The stairwell is clear. The rear guard can hold this route now.'),
    msg('Neri', 'The kitchen convoy is leaving with the last medical group. I am needed there. That is my choice, Tavin.'),
    msg('Tavin', 'Take the spare spoon. I will bring back the other one.'),
    msg('Neri', 'Good. We will need it for supper. Do not expect me to save you the biggest bowl.'),
    msg('Soren', 'Vale is above us. Keep the service passage open. This victory has not stopped the engine.'),
  ] },
  B_R06_VALE: { stage: 9, switches: ['vale_defeated'], messages: [
    msg('Vale', 'The gates cannot open. I know how many people this bell keeps alive.'),
    msg('Iona', 'The armor is broken. He is alive. Help me pull him clear before the bindings close again.'),
    msg('Soren', 'The automated Heart Bell is still drawing its last reserve. Vale cannot stop it from here. I must reach the diversion controls.'),
    msg('Tavin', 'Halden has a stretcher at the stairs. Vale will survive to answer the people whose names are in those records.'),
  ] },
  B_R06_HEART: { stage: 10, switches: ['heart_defeated'], messages: [
    msg('Soren', 'Diversion complete. The final reserve is in the evacuation wards. Every regional feeder was retired before this one. No bell is burning another captive.'),
    msg('Iona', 'Vale is on the stretcher. The last medical group has cleared the stairs. Everyone out, together.'),
    msg('Bessa', 'First watch, stand down. Relief watch, take your places. Count people, not carts. There is breakfast when the count is right.'),
    msg('Sen', 'The fog is still here. So are we. The ward holds because the next crew arrived.'),
    msg('Neri', 'Months later, I opened a roadside kitchen. I do not remember the old recipes. I am allowed to make new ones.'),
    msg('Leth', 'The transfer records remain public. Vale is alive and facing a hearing. Halden has signed his statement. Families deserve answers that make officials uncomfortable.'),
    msg('Soren', 'The workshop doors stay open. These plans belong where anybody can question them.'),
    msg('Iona', 'Our notebooks cannot return a burned memory. There is still room to write what happened today.'),
    msg('The Road Beyond the Bells', 'At Reedbank, a child hangs a little bronze bell beside a shelter lantern. It powers nothing. Beneath it a sign reads: Ring. Someone will come.'),
  ] },
  B_R04_WIDOW: { switches: ['widow_defeated'], messages: [msg('Orchard keeper', 'The nursery survey trail is clear. We can recover the old teaching tools when a rested crew is ready. The evacuation never depended on this detour.')] },
  B_R05_COLOSSUS: { switches: ['colossus_defeated'], messages: [msg('Halden', 'The quarry survey is complete. We will seal the unsafe workings and post the findings where everyone can read them. No secret engine will take its place.')] },
};

function entity(id: string, x: number, y: number, kind: MapEntity['kind'], name: string, sprite = 'bessa', hint = `Talk to ${name}`): MapEntity {
  return { id, x, y, kind, name, sprite, hint };
}
function exit(id: string, x: number, y: number, name: string): MapEntity {
  return { ...entity(id, x, y, 'exit', name, 'door', `Travel to ${name}`), destination: TRANSITIONS[id]?.area };
}
function monster(id: string, x: number, y: number, name: string, sprite: string, kind: 'boss' | 'rare' | 'enemy' = 'boss'): MapEntity {
  return entity(id, x, y, kind, name, sprite, kind === 'rare' ? `Optional rare hunt — ${name}` : `Challenge ${name}`);
}
function grid(width: number, height: number, fill: string, border: string): string[][] {
  return Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => x === 0 || y === 0 || x === width - 1 || y === height - 1 ? border : fill));
}
function line(tiles: string[][], x1: number, y1: number, x2: number, y2: number, tile: string): void {
  const dx = Math.sign(x2 - x1), dy = Math.sign(y2 - y1);
  let x = x1, y = y1;
  tiles[y][x] = tile;
  while (x !== x2 || y !== y2) { if (x !== x2) x += dx; else y += dy; tiles[y][x] = tile; }
}
function rect(tiles: string[][], x: number, y: number, w: number, h: number, tile: string): void {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) tiles[yy][xx] = tile;
}
function finish(area: Area, tiles: string[][], entities: MapEntity[]): GameMap {
  // Every authored interaction square is reachable floor; decorative terrain never hides a service.
  for (const item of entities) tiles[item.y][item.x] = item.kind === 'exit' ? 's' : ['#', 'w', 't', 'T', '^'].includes(tiles[item.y][item.x]) ? 'd' : tiles[item.y][item.x];
  return { width: tiles[0].length, height: tiles.length, tiles: tiles.map(row => row.join('')), entities, ...AREA_INFO[area] };
}
function town(area: Area, extras: MapEntity[], region: string): GameMap {
  const tiles = grid(32, 18, 'g', 't');
  rect(tiles, 5, 3, 5, 3, 'T'); rect(tiles, 13, 3, 5, 3, 'T'); rect(tiles, 22, 3, 5, 3, 'T');
  rect(tiles, 7, 8, 19, 7, 'd'); line(tiles, 2, 14, 28, 14, 'd'); line(tiles, 28, 8, 28, 14, 'd');
  const entities = [exit(`world-${area}`, 2, 14, 'the roads of Avel'),
    entity(`shop-${region}`, 10, 12, 'npc', 'Supply keeper', 'merchant', 'Buy regional equipment and supplies'),
    entity(`inn-${region}`, 17, 12, 'campfire', 'Shelter beds', 'fire', 'Rest — restore HP and spell charges'), ...extras];
  return finish(area, tiles, entities);
}
function dungeon(area: Area, extras: MapEntity[], region: string): GameMap {
  const tiles = grid(32, 18, 'f', '#');
  for (const x of [10, 21]) for (let y = 2; y < 16; y++) if (![4, 9, 14].includes(y)) tiles[y][x] = '#';
  for (let x = 2; x < 30; x++) if (![5, 14, 25].includes(x)) tiles[7][x] = '#';
  rect(tiles, 2, 2, 3, 3, 'w');
  return finish(area, tiles, [exit(`world-${area}`, 2, 14, 'the roads of Avel'),
    monster(`${region}_patrol_a`, 6, 11, 'Lower passage patrol', 'hound', 'enemy'),
    monster(`${region}_patrol_b`, 14, 5, 'Gallery watch', 'wisp', 'enemy'),
    monster(`${region}_patrol_c`, 25, 12, 'Upper passage patrol', 'sentinel', 'enemy'),
    entity(`cache-${region}`, 16, 13, 'chest', 'Regional equipment cache', 'chest', 'Open the regional equipment cache'), ...extras]);
}

export const WORLD_SITES: { id: string; area: Area; x: number; y: number; name: string }[] = [
  { id: 'enter-camp', area: 'camp', x: 8, y: 32, name: 'Reedbank' },
  { id: 'enter-works', area: 'works', x: 15, y: 31, name: 'Merewatch' },
  { id: 'enter-dunmere', area: 'dunmere', x: 8, y: 20, name: 'Dunmere' },
  { id: 'enter-tollhouse', area: 'tollhouse', x: 18, y: 19, name: 'Impounding Tollhouse' },
  { id: 'enter-fen', area: 'fen', x: 28, y: 22, name: 'Alder Fen' },
  { id: 'enter-granary', area: 'granary', x: 29, y: 17, name: 'Flooded Granary' },
  { id: 'enter-orchard', area: 'orchard', x: 41, y: 29, name: 'Orchard Highroad' },
  { id: 'enter-crown', area: 'crown', x: 46, y: 18, name: 'Crown Road' },
  { id: 'enter-veyr', area: 'veyr', x: 53, y: 7, name: 'Veyr' },
  { id: 'enter-heart', area: 'heart', x: 58, y: 5, name: 'Heart Bell' },
];

function overworldMap(): GameMap {
  const tiles = grid(64, 40, 'g', '^');
  // Tree stands leave open verges. Rivers and ridges make each crossing a real journey.
  for (let y = 2; y < 38; y++) for (let x = 2; x < 62; x++) if ((x * 13 + y * 7) % 23 < 4) tiles[y][x] = 't';
  rect(tiles, 24, 1, 2, 38, 'w'); line(tiles, 1, 26, 23, 26, 'w');
  line(tiles, 34, 12, 34, 38, '^'); line(tiles, 26, 15, 33, 15, '^');
  line(tiles, 35, 23, 62, 23, '^'); line(tiles, 35, 11, 62, 11, '^');
  // Regional routes are deliberately carved separately; gates span the impassable boundaries.
  const routes = [
    [8, 33, 8, 27], [8, 31, 15, 31], [8, 25, 8, 20], [8, 21, 23, 21], [18, 21, 18, 19],
    [26, 21, 28, 21], [28, 17, 28, 28], [28, 17, 29, 17], [28, 28, 33, 28],
    [35, 28, 46, 28], [41, 28, 41, 30], [46, 28, 46, 24],
    [46, 22, 46, 18], [46, 18, 53, 18], [53, 18, 53, 12],
    [53, 10, 53, 7], [53, 7, 58, 7], [58, 7, 58, 5],
  ];
  for (const [x1, y1, x2, y2] of routes) line(tiles, x1, y1, x2, y2, 'd');
  // A small bridge over a tributary is walkable; the long river needs the staffed ferry.
  line(tiles, 11, 34, 20, 34, 'w'); tiles[34][15] = 'b'; line(tiles, 15, 31, 15, 36, 'd'); tiles[34][15] = 'b';
  const gates: MapEntity[] = [
    exit('road-dunmere', 8, 27, 'the Salt Road'), exit('road-reedbank', 8, 25, 'Reedbank road'),
    exit('ferry-fen', 23, 21, 'Alder Fen ferry'), exit('ferry-saltroad', 26, 21, 'Salt Road ferry'),
    exit('pass-orchard', 33, 28, 'Orchard high pass'), exit('pass-fen', 35, 28, 'Alder Fen pass'),
    exit('road-crown', 46, 24, 'Crown Road pass'), exit('road-orchard', 46, 22, 'Orchard return road'),
    exit('gate-veyr', 53, 12, 'Veyr gate'), exit('gate-crown', 53, 10, 'Crown Road gate'),
  ];
  return finish('overworld', tiles, [...WORLD_SITES.map(site => exit(site.id, site.x, site.y, site.name)), ...gates]);
}

export function buildCampaignMaps(legacy: { camp: GameMap; works: GameMap }): Record<Area, GameMap> {
  const camp: GameMap = { ...legacy.camp, ...AREA_INFO.camp, entities: [...legacy.camp.entities, exit('world-camp', 28, 14, 'the roads of Avel')] };
  const works: GameMap = { ...legacy.works, ...AREA_INFO.works, entities: [...legacy.works.entities] };
  const dunmere = town('dunmere', [
    entity('leth', 14, 9, 'npc', 'Leth', 'bessa'),
    entity('dunmere-witness', 22, 10, 'npc', 'Hospice witness', 'iona'),
    entity('dunmere-notice', 24, 13, 'npc', 'Public notices', 'lantern', 'Read the copied notices'),
    exit('town-tollhouse', 28, 8, 'the tollhouse road'),
    monster('R02_RARE', 26, 15, 'Coinveil Jackal', 'hound', 'rare'),
  ], 'R02');
  const tollhouse = dungeon('tollhouse', [
    monster('B_R02_TOLL', 27, 3, 'Toll Collector', 'sentinel'),
    entity('neri-rescue', 26, 5, 'npc', 'Neri', 'iona', 'Speak with the kitchen organizer'),
    entity('toll-kitchen', 17, 10, 'npc', 'Captives’ kitchen', 'merchant'),
  ], 'R02');
  const fen = town('fen', [
    entity('sen', 14, 9, 'npc', 'Sen', 'bessa'),
    entity('fen-teacher', 22, 10, 'npc', 'Relief keeper', 'soren'),
    entity('fen-orren', 24, 13, 'npc', 'Orren', 'merchant'),
    exit('town-granary', 28, 8, 'the flooded granary'),
    monster('R03_RARE', 26, 15, 'Moonlace Widow', 'widow', 'rare'),
  ], 'R03');
  const granary = dungeon('granary', [monster('B_R03_SILT', 27, 3, 'Silt Crown', 'reedback')], 'R03');
  const orchardTiles = grid(32, 18, 'g', 't');
  rect(orchardTiles, 5, 3, 5, 3, 'T'); rect(orchardTiles, 12, 3, 4, 3, 'T');
  line(orchardTiles, 2, 14, 28, 14, 'd'); line(orchardTiles, 18, 4, 18, 14, 'd');
  line(orchardTiles, 18, 4, 27, 4, 'd'); rect(orchardTiles, 6, 8, 10, 6, 'd');
  for (const [x, y] of [[22, 8], [25, 8], [22, 11], [25, 11], [28, 10], [3, 7], [5, 7]]) orchardTiles[y][x] = 't';
  const orchard = finish('orchard', orchardTiles, [
    exit('world-orchard', 2, 14, 'the highroad'),
    entity('orchard-keeper', 12, 9, 'npc', 'Orchard keeper', 'bessa'),
    entity('shop-R04', 8, 12, 'npc', 'Rest-house trader', 'merchant', 'Buy regional equipment and supplies'),
    entity('inn-R04', 14, 12, 'campfire', 'Rest-house beds', 'fire', 'Rest — restore HP and spell charges'),
    entity('orchard-halden', 10, 10, 'npc', 'Captain Halden', 'soren'),
    entity('cache-R04', 16, 13, 'chest', 'Rest-house cupboard', 'chest', 'Open the regional equipment cache'),
    monster('R04_patrol_a', 19, 10, 'Contaminated terrace patrol', 'wisp', 'enemy'),
    monster('R04_patrol_b', 24, 6, 'Ashen orchard patrol', 'hound', 'enemy'),
    monster('B_R04_HART', 27, 3, 'Ashroot Hart', 'hart'),
    monster('B_R04_WIDOW', 28, 15, 'Briar Widow — optional', 'widow'),
    monster('R04_RARE', 20, 15, 'Amberglass Hart', 'hart', 'rare'),
  ]);
  const crownTiles = grid(32, 18, 'g', '^');
  rect(crownTiles, 5, 3, 5, 3, 'T'); rect(crownTiles, 13, 3, 5, 3, 'T');
  rect(crownTiles, 6, 8, 12, 7, 's'); line(crownTiles, 2, 14, 28, 14, 's');
  line(crownTiles, 21, 3, 21, 14, '#'); crownTiles[9][21] = 's'; crownTiles[14][21] = 's';
  line(crownTiles, 22, 8, 29, 8, 's');
  const crown = finish('crown', crownTiles, [
    exit('world-crown', 2, 14, 'the Crown Road'),
    entity('halden', 13, 9, 'npc', 'Captain Halden', 'soren'),
    entity('crown-bessa', 16, 10, 'npc', 'Bessa’s depot', 'bessa'),
    entity('shop-R05', 9, 12, 'npc', 'Handover quartermaster', 'merchant', 'Buy regional equipment and supplies'),
    entity('inn-R05', 17, 12, 'campfire', 'Relief crew beds', 'fire', 'Rest — restore HP and spell charges'),
    entity('cache-R05', 16, 14, 'chest', 'Returned-equipment chest', 'chest', 'Open the regional equipment cache'),
    monster('R05_patrol_a', 24, 10, 'Feeder approach patrol', 'sentinel', 'enemy'),
    monster('B_R05_CENSER', 27, 4, 'Gate-Censer', 'sentinel'),
    monster('R05_RARE', 26, 13, 'Ivory Bellwarden', 'sentinel', 'rare'),
    monster('B_R05_COLOSSUS', 28, 15, 'Unlit Colossus — level 42', 'sentinel'),
  ]);
  const veyr = town('veyr', [
    entity('veyr-leth', 13, 9, 'npc', 'Leth — intake records', 'soren'),
    entity('veyr-neri', 21, 10, 'npc', 'Neri — kitchen convoy', 'iona'),
    entity('veyr-bessa', 24, 13, 'npc', 'Bessa — ward schedule', 'bessa'),
    entity('veyr-patient', 7, 10, 'npc', 'Blue-fish tin worker', 'merchant'),
    entity('cache-R06', 20, 14, 'chest', 'Refuge supply chest', 'chest', 'Open the regional equipment cache'),
    exit('town-heart', 28, 8, 'the final service passage'),
    monster('R06_RARE', 27, 15, 'Starless Cantor', 'cantor', 'rare'),
  ], 'R06');
  const heart = dungeon('heart', [
    monster('B_R06_CHOIR', 8, 11, 'Night Choir', 'cantor'),
    monster('B_R06_VALE', 19, 4, 'Vale’s Command Armor', 'sentinel'),
    monster('B_R06_HEART', 27, 3, 'Heart Bell', 'sentinel'),
    entity('heart-relief', 5, 14, 'campfire', 'Rear-guard supplies', 'fire', 'Rest — restore HP and spell charges'),
  ], 'R06');
  // The capital cache belongs in the inhabited refuge, not twice in the engine room.
  heart.entities = heart.entities.filter(item => item.id !== 'cache-R06');
  return { camp, works, overworld: overworldMap(), dunmere, tollhouse, fen, granary, orchard, crown, veyr, heart };
}

export function regionAt(area: Area, x: number, y: number): string {
  if (area !== 'overworld') return AREA_INFO[area].regionId;
  if (x < 24) return y >= 26 ? 'R01' : 'R02';
  if (x < 35) return 'R03';
  if (y >= 23) return 'R04';
  return y >= 11 ? 'R05' : 'R06';
}

const has = (state: GameState, key: string): boolean => state.campaign.switches.includes(key);
export function getObjective(state: GameState): [string, string] {
  const stage = state.campaign.stage;
  if (stage === 0) return [QUEST_TITLES[0], state.flags.briefed ? 'Enter Merewatch east of camp. Break the Brass Bailiff’s outer frame and find the missing workers.' : 'Speak to Bessa at Reedbank’s watchfire.'];
  if (stage === 1) return [QUEST_TITLES[1], 'Return to Bessa at Reedbank. Bring Orren and the transfer ledger; prepare the camp’s supported evacuation.'];
  if (stage === 2) return [QUEST_TITLES[2], 'Leave Reedbank by the south road. Cross the north-road bridge and find Leth in Dunmere.'];
  if (stage === 3) return [QUEST_TITLES[3], has(state, 'toll_defeated') ? 'The holding yard is open. Speak to Neri beside the tollhouse kitchen.' : 'Follow Leth’s records to the tollhouse. Disable the Toll Collector and free the holding yard.'];
  if (stage === 4) return [QUEST_TITLES[4], !has(state, 'sen_briefed') ? 'Take the Salt Road ferry to Alder Fen. Speak to Sen about small wards.' : !has(state, 'silt_defeated') ? 'Clear Silt Crown from the flooded granary and secure its dry food stores.' : 'Return to Sen in Alder Fen and carry out the supervised shelter trial.'];
  if (stage === 5) return [QUEST_TITLES[5], has(state, 'hart_defeated') ? 'Return to the Orchard keeper. Test the two-refuge plan with rested relief crews.' : 'Cross the high pass. Clear the Ashroot Hart from Orchard Highroad and reopen the clean storehouse.'];
  if (stage === 6) return [QUEST_TITLES[6], has(state, 'censer_defeated') ? 'Return to Halden at Crown Road’s handover table. Complete every regional feeder shutdown.' : 'Go north through Crown Road. Break the Gate-Censer and open the regional feeder approach.'];
  if (stage === 7) {
    const remaining = [!has(state, 'crew_accounted') && 'Leth’s intake report', !has(state, 'veyr_supplies') && 'Neri’s kitchen convoy', !has(state, 'veyr_wards') && 'Bessa’s ward schedule'].filter(Boolean).join(', ');
    return [QUEST_TITLES[7], `Enter Veyr and prepare the final evacuation: ${remaining}.`];
  }
  if (stage === 8) return [QUEST_TITLES[8], has(state, 'choir_defeated') ? 'Climb the service stair. Break Vale’s command armor and take him alive.' : 'Enter the final service passage and clear the Night Choir so the rear guard can hold the stairwell.'];
  if (stage === 9) return [QUEST_TITLES[9], 'Disable the Heart Bell while Soren diverts its final reserve. Bring every survivor out.'];
  return [QUEST_TITLES[10], 'The harvest has ended. Explore the reopened roads, visit your allies, and take optional hunts at your own pace.'];
}

export function getStoryEvent(entityId: string, state: GameState): StoryEvent | null {
  const stage = state.campaign.stage;
  const lead = state.profile.name;
  const say = (...messages: CampaignMessage[]): StoryEvent => ({ messages });
  if (entityId === 'bessa') {
    if (stage === 1 && has(state, 'orren_rescued')) return { stage: 2, switches: ['reedbank_moved'], messages: [
      msg('Bessa', 'Orren first, then your report. I sent you for people. You brought one home. The others still have names in my ledger.'),
      msg('Iona', 'The feeding damaged his memories. Please do not make him prove who he used to be. Ask what he needs now.'),
      msg('Orren', 'I know how to mend this lantern fitting. I do not know the painted bird on my coat. Today I would like to sit down.'),
      msg('Bessa', 'Then sit. The craft bench can wait. We are moving Reedbank to the supported shelter before the reserve runs out.'),
      msg('Soren', 'The lanterns hold a finite charge. We must carry the diagrams and emergency equipment, not the apparatus that fed on him.'),
      msg(lead, 'Count the passengers, clear the road, and leave the salvage. No one travels as cargo.'),
      msg('Tavin', 'Neri’s name is on the transfer ledger. Dunmere’s counting house is the next stop. I am going with you.'),
      msg('Bessa', 'The convoy has reached its receiving shelter. A fresh ward crew is taking over. That opens the north road; it does not make the wilderness safe.'),
      msg('Iona', 'At the next table, four bowls. We follow the records together.'),
    ] };
    if (stage >= 2) return say(msg('Bessa', stage >= 10 ? 'A child hung a bell by the shelter lantern. Ring it if you need someone. I am still counting people before I count portions.' : 'Reedbank’s people have a supported roof. Follow the north road to Dunmere. A safe shelter needs food and the next watch, not just a light.'));
    return say(
      msg('Bessa', 'Merewatch stopped halfway through its warning. Our emergency ward cannot hold a camp this size forever. I am arranging carts while you find the maintenance crew.'),
      msg('Soren', 'A jammed regulator could explain it. The repair should be straightforward.'),
      msg('Tavin', 'Excellent. I have always wanted to get lost somewhere straightforward.'),
      msg('Iona', 'Bring a blanket, then. And leave room to carry an injured worker home.'),
      msg('Bessa', 'Here is the missing-crew list. Bring these people back before you bring back any tools. The bellworks entrance is east of the watchfire.'),
      msg(lead, 'The crew comes first. We prepare at the fire, take what supplies we need, then go to Merewatch.'),
    );
  }
  if (entityId === 'leth') {
    if (stage === 2) return { stage: 3, switches: ['leth_records'], messages: [
      msg('Leth', 'This permit calls Orren missing Crown property. Ink can say appalling things. I will amend it to injured worker under care.'),
      msg('Iona', 'And the workers who copied these accounts? Publishing their names would make them the first targets.'),
      msg('Leth', 'Three copies go by separate couriers. The witnesses and their families are already lodged at the hospice. My name goes on the copy, not theirs.'),
      msg('Soren', 'These columns are people. My old engineering marks are on every feeder shipment.'),
      msg('Leth', state.profile.job === 'warden' ? 'There is an old convoy receipt bearing your service signature. I will not remove inconvenient pages.' : 'The old convoy receipts bear Captain Halden’s signature. Rank does not put a name outside the record.'),
      msg(lead, state.profile.job === 'warden' ? 'Publish that page with the rest. My part belongs beside the orders I followed.' : 'Copy every page. We need a record that protects witnesses and tells the whole truth.'),
      msg('Leth', 'The abandoned tollhouse is a holding yard. Its impounding machine locks people in without departure tokens. Neri is listed with the kitchen workers.'),
      msg('Tavin', 'A kitchen. She always made everyone eat before a long road. Show us the way.'),
    ] };
    return say(msg('Leth', stage < 2 ? 'The Reedbank convoy needs its keeper before these records can travel.' : stage >= 7 ? 'The capital intake list is waiting in Veyr. I have kept the blue-fish tin entry separate. No missing worker will disappear into a total.' : 'The copies are safe. The tollhouse is east of town. Free its holding yard, then speak to Neri. Proof helps people only if they survive to use it.'));
  }
  if (entityId === 'neri-rescue') {
    if (!has(state, 'toll_defeated')) return say(msg('Neri', 'The departure locks are still closed. We have kept the kitchen running, but no one leaves until that impounding machine is stopped.'));
    if (!has(state, 'neri_rescued') && stage === 3) return { stage: 4, switches: ['neri_rescued'], messages: [
      msg('Neri', 'Are you the flour courier? Leave the sacks by the dry wall. Everyone eats before we move.'),
      msg('Tavin', 'Neri. It is me. I brought your spoon. I kept the other one all this way.'),
      msg('Neri', 'I understand what you are telling me. I can see what that spoon means to you. I do not remember being your sister.'),
      msg('Iona', 'The machine cannot give those memories back. Nobody here has to become a former self to deserve care.'),
      msg('Tavin', 'I can wait outside. This note says where to find me. You do not owe me an answer tonight.'),
      msg('Neri', 'Tomorrow, help me move flour. We can start with a job in front of us. Today I want the kitchen crew to choose where we go.'),
      msg('Leth', 'The captives have refuge places and the witnesses have copies. Vale calls them volunteers in the notices. Their testimony will say otherwise.'),
      msg('Soren', 'Dunmere’s bell is still active. We cannot retire it until we have a replacement plan. The people of Alder Fen already keep small wards.'),
      msg('Neri', 'Our crew chooses the hospice. The ferry is released for the road to Alder Fen. Find us somewhere people can live without feeding these machines.'),
    ] };
    return say(msg('Neri', 'I chose to help the hospice kitchen. Tavin can visit when he asks first. We are making something new, one ordinary supper at a time.'));
  }
  if (entityId === 'sen') {
    if (stage < 4) return say(msg('Sen', 'We can welcome travelers after their road and receiving shelter are ready. A ward is not a substitute for a plan.'));
    if (!has(state, 'sen_briefed')) return { switches: ['sen_briefed'], messages: [
      msg('Sen', 'Welcome to Alder Fen. We did not discover small wards yesterday. What we lack is medicine, sound crossings and spare hands.'),
      msg('Soren', 'Four trained keepers could maintain a boundary around the proposed shelter if the shifts—'),
      msg('Sen', 'Which keeper stays with a feverish child? Which one eats? Show me the line for someone arriving late. Your tidy chart has no tired people in it.'),
      msg('Iona', 'Let us test a small number, with observers and a withdrawal route. No one’s life can depend on a first draft.'),
      msg('Sen', 'First clear Silt Crown from the flooded granary. The dry shelves can feed the volunteers. Then return to me for a supervised trial.'),
    ] };
    if (stage === 4 && has(state, 'silt_defeated')) return { stage: 5, switches: ['trial_failed'], messages: [
      msg('Sen', 'The trial starts with a full receiving list and the observers’ finite emergency reserve. If the boundary slips, we withdraw together.'),
      msg('Soren', 'The ward is stable. First shift complete. Relief keepers, take—where is the third relief keeper?'),
      msg('Iona', 'At the children’s room. A sick family arrived with the extra cart. The boundary is crowded; we need the reserve now.'),
      msg('Sen', 'Reserve lit. Stop new arrivals. Lead the outer group back to the village. Count each person in. Nobody stays to prove the calculation right.'),
      msg('Soren', 'No one died. That does not make this a success. We spent the emergency reserve covering a staffing plan that was never enough.'),
      msg('Sen', 'Two refuges. Staggered arrivals. Duplicate crews and a food store at each. A second shelter, not a smaller copy of the capital.'),
      msg(lead, 'We plan for a delayed cart, an ill keeper and the person too tired to say so. What else goes wrong?'),
      msg('Tavin', 'Six things immediately. Seven if Soren is cooking. Iona, write this down.'),
      msg('Sen', 'The high pass is open. The Orchard’s clean storehouse could be the second refuge, once the Ashroot growth is cleared.'),
    ] };
    return say(msg('Sen', has(state, 'second_shelter') ? 'The replacement keeper arrived before the first one collapsed. That is what a working ward looks like. The schedule finally includes a day off.' : 'The granary’s dry stores come first. Once Silt Crown is cleared, return here. We test with observers, not with the lives of a full convoy.'));
  }
  if (entityId === 'orchard-keeper') {
    if (stage === 5 && has(state, 'hart_defeated')) return { stage: 6, switches: ['second_shelter'], messages: [
      msg('Orchard keeper', 'The clean storehouse is ready. We have marked contaminated ground instead of pretending the soil healed overnight.'),
      msg('Sen', 'Second trial. The first refuge takes the early group. The Orchard takes the overflow. Both have a food store and a fresh relief crew.'),
      msg('Iona', 'One keeper is ill. Their replacement has already taken the watch. No observer has had to spend an emergency reserve.'),
      msg('Soren', 'The second refuge received the late cart. The plan held because we allowed for people to need help.'),
      msg('Orren', 'I came to see the workshop. Is it all right if I sleep through the demonstration?'),
      msg('Iona', 'Please do. You are a visitor. We do not need you to power anything.'),
      msg('Halden', 'I released the detained convoy. I also signed the transfer orders that delivered people to those stations. I brought volunteers and my statement under my own name.'),
      msg(lead, 'Your statement stays public. Your volunteers work alongside the ward crews. People need both help and an honest account.'),
      msg('Sen', 'The Crown Road is open. At its handover depot, free the feeder approach and coordinate the regional shutdowns. Each tower needs its own safe handover.'),
    ] };
    return say(msg('Orchard keeper', stage >= 6 ? 'Both refuges have duplicate crews and stores. The upper terrace and its rare hunt remain optional. Your road north leads to Crown Road’s depot.' : 'Ashroot blocks the clean storehouse and ridge route. Our beds and trader are open while you prepare. After the clearance, return here for the second trial.'));
  }
  if (entityId === 'halden') {
    if (stage === 6 && has(state, 'censer_defeated')) return { stage: 7, switches: ['regional_feeders_retired'], messages: [
      msg('Halden', 'The approach is open and the captives are free. We begin each shutdown when the receiving shelter confirms its roster.'),
      msg('Leth', 'Dunmere’s witnesses have testified. The council has signed the retirement order. Their bell’s finite reserve buys time for the last transfer, not another feeding.'),
      msg('Bessa', 'Merewatch: retired. Dunmere: receiving shelter confirmed. Alder’s small wards need no feeder. Orchard receiving crews are in place.'),
      msg('Sen', 'Crown’s regional towers: all captive frames empty. Replacement crews have the watch. Each local feeder has been retired in person.'),
      msg('Soren', 'The reports agree. Veyr is the last bell feeding on living people. Breaking it will not switch off distant towers; we have already done that work.'),
      msg('Halden', 'I refused the capital gate-closure order. Some soldiers joined us. Others did not. We use the service routes and keep residents out of the fighting.'),
      msg('Leth', 'I found the Merewatch intake records. Come to Veyr’s refuge. We will account for the entire missing crew, including the blue-fish tin’s owner.'),
      msg('Bessa', 'Supplies, ward schedules, receiving lists. Meet the three of us inside Veyr before the final operation. No rare trophy belongs on that checklist.'),
    ] };
    return say(msg('Halden', stage >= 7 ? 'Every regional captive-fed tower has a completed handover. Veyr is the last. My statement goes to the same hearing as the other orders I signed.' : 'The Gate-Censer holds the regional feeder approach. Break it, then return to this table. I will not close a bell over a town without a receiving ward.'));
  }
  if (['veyr-leth', 'veyr-neri', 'veyr-bessa'].includes(entityId)) {
    if (stage < 7) return say(msg('Refuge keeper', 'The regional handovers must finish before Veyr’s final evacuation can begin.'));
    const key = entityId === 'veyr-leth' ? 'crew_accounted' : entityId === 'veyr-neri' ? 'veyr_supplies' : 'veyr_wards';
    const messages = entityId === 'veyr-leth' ? [
      msg('Leth', 'Merewatch’s full crew list is accounted for. Orren was retained there. Five workers survived transfer and are leaving with the medical convoy. Two died in intake; their names are in the public record.'),
      msg('Blue-fish tin worker', 'They tell me I painted that fish. I do not remember it. Orren says its tail was terrible. I think I will keep the tin.'),
      msg('Iona', 'A record can tell us what happened. It cannot return the experience of remembering. They choose what help they want today.'),
      msg('Leth', 'The duplicate evidence is outside the walls. The intake patients have receiving beds and escorts. My name stays on the account.'),
    ] : entityId === 'veyr-neri' ? [
      msg('Neri', 'The kitchen convoy has flour, water and a receiving stove for every group. I chose this work. Do not ask Vale to grant me the freedom he had no right to take.'),
      msg('Tavin', 'May I come by the kitchen after we are through? I can carry flour without telling that story about the miller.'),
      msg('Neri', 'You may come. Tell a different story. I want to learn which jokes you know now.'),
      msg('Neri', 'The medical convoy leaves with us. No one waits for an optional hunt or a rare piece of armor. The supplies are ready.'),
    ] : [
      msg('Bessa', 'Every departure list matches a receiving list. Sen has fresh crews at the shelters. Halden holds the service approaches. Count people, not wagons.'),
      msg('Vale’s notice', 'The First Warden offers restored rank, a funded hospice, protected family and an engineering commission in exchange for surrendering the records.'),
      msg(lead, 'One safe room does not justify feeding the other wards. The records stay public.'),
      msg('Iona', 'The new intake order names hospice patients. His bargain cannot protect us from a system that keeps needing somebody else.'),
      msg('Bessa', 'This is the last operation. You may finish your preparations before entering the service passage. The shelters already have the people they need.'),
    ];
    if (has(state, key)) return say(msg(entityId === 'veyr-leth' ? 'Leth' : entityId === 'veyr-neri' ? 'Neri' : 'Bessa', stage >= 10 ? 'The first night is behind us. The records, kitchens and changing watches still matter tomorrow.' : 'My preparations are complete. Check the other two coordinators, then enter the service passage when you are ready.'));
    const allReady = ['crew_accounted', 'veyr_supplies', 'veyr_wards'].every(required => required === key || has(state, required));
    return { messages: allReady ? [...messages, msg('Bessa', 'All three preparations are confirmed. The final service passage is open. We begin with everyone’s receiving place already arranged.')] : messages,
      switches: allReady ? [key, 'evacuation_ready'] : [key], ...(allReady ? { stage: 8 } : {}) };
  }
  const ambient: Record<string, [string, string]> = {
    'dunmere-witness': ['Hospice witness', 'I copied the accounts. Leth found somewhere safe for my family before he asked me to testify. Please remember the people behind each column.'],
    'dunmere-notice': ['Public notices', stage >= 7 ? 'DUNMERE FEEDER RETIRED. Receiving wards and relief crews confirmed. The transfer records are available for families.' : 'OFFICIAL NOTICE: The rescued captives are described as volunteers. Beside it, someone has pinned a copied witness statement.'],
    'toll-kitchen': ['Kitchen worker', has(state, 'neri_rescued') ? 'We voted for the hospice. Neri made sure each person got to choose. I am taking the big pot.' : 'Neri keeps the meals fair. The departure locks call us cargo. People eat here, whatever the paperwork says.'],
    'fen-teacher': ['Relief keeper', 'Small wards need short shifts and trained replacements. Ordinary spellcasting uses recoverable reserves. Nobody has to lose a memory to light this shelter.'],
    'fen-orren': ['Orren', 'I drew pictures beside the lantern instructions. Easier for an exhausted apprentice. Today I felt like working. Tomorrow I might rest.'],
    'orchard-halden': ['Captain Halden', 'I let a detained convoy pass. That does not settle the orders I signed. My volunteers will return with a statement bearing my own name.'],
    'crown-bessa': ['Bessa', 'We need a receiving name for each departing person. Optional surveys can wait. The evacuation works with ordinary supplies and a rested watch.'],
    'veyr-patient': ['Blue-fish tin worker', 'This fish has a truly dreadful tail. I have decided I like it. If Orren comes by, tell him there is a seat beside me.'],
  };
  return ambient[entityId] ? say(msg(...ambient[entityId])) : null;
}
