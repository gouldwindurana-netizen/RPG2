import type { Direction, GameMap, InteriorArea, MapEntity, SettlementArea } from './contracts';

interface Settlement {
  name: string;
  regionId: string;
  recommended: [number, number];
  shopDoor: [number, number];
  innDoor: [number, number];
}
export const SETTLEMENTS: Record<SettlementArea, Settlement> = {
  camp: { name: 'Reedbank', regionId: 'R01', recommended: [1, 5], shopDoor: [10, 6], innDoor: [19, 6] },
  dunmere: { name: 'Dunmere', regionId: 'R02', recommended: [5, 10], shopDoor: [7, 6], innDoor: [15, 6] },
  fen: { name: 'Alder Fen', regionId: 'R03', recommended: [10, 16], shopDoor: [7, 6], innDoor: [15, 6] },
  orchard: { name: 'Orchard', regionId: 'R04', recommended: [16, 22], shopDoor: [7, 6], innDoor: [14, 6] },
  crown: { name: 'Crown Road', regionId: 'R05', recommended: [22, 28], shopDoor: [7, 6], innDoor: [15, 6] },
  veyr: { name: 'Veyr', regionId: 'R06', recommended: [28, 34], shopDoor: [7, 6], innDoor: [15, 6] },
};
export interface InteriorInformation {
  name: string; regionId: string; recommended: [number, number];
  safe: true; kind: 'interior'; service: 'shop' | 'inn'; parent: SettlementArea;
}
export const INTERIOR_INFO = {} as Record<InteriorArea, InteriorInformation>;
for (const parent of Object.keys(SETTLEMENTS) as SettlementArea[]) {
  const settlement = SETTLEMENTS[parent];
  for (const service of ['shop', 'inn'] as const) {
    const name = parent === 'camp'
      ? service === 'shop' ? 'Reedbank Supply Tent' : 'Reedbank Bunk Tent'
      : `${settlement.name} ${service === 'shop' ? 'Outfitters' : 'Rest House'}`;
    INTERIOR_INFO[`${parent}-${service}`] = { name, regionId: settlement.regionId,
      recommended: settlement.recommended, safe: true, kind: 'interior', service, parent };
  }
}

/** Doorways have an explicit outside landing, so returning never chains into re-entry. */
export function interiorTransitions(): Record<string, {area: InteriorArea | SettlementArea; x: number; y: number; facing: Direction}> {
  const result: ReturnType<typeof interiorTransitions> = {};
  for (const parent of Object.keys(SETTLEMENTS) as SettlementArea[]) {
    for (const service of ['shop', 'inn'] as const) {
      const [x, y] = SETTLEMENTS[parent][service === 'shop' ? 'shopDoor' : 'innDoor'];
      result[`door-${parent}-${service}`] = { area: `${parent}-${service}`, x: 10, y: 11, facing: 'up' };
      result[`leave-${parent}-${service}`] = { area: parent, x, y: y + 1, facing: 'down' };
    }
  }
  return result;
}

export function serviceDoors(parent: SettlementArea): MapEntity[] {
  return (['shop', 'inn'] as const).map(service => {
    const [x, y] = SETTLEMENTS[parent][service === 'shop' ? 'shopDoor' : 'innDoor'];
    return { id: `door-${parent}-${service}`, x, y, kind: 'exit',
      name: service === 'shop' ? 'Outfitters' : 'Inn',
      sprite: `${service}-door`, hint: service === 'shop' ? 'Enter the outfitters' : 'Enter the inn',
      destination: `${parent}-${service}` };
  });
}

export function buildInteriors(): Record<InteriorArea, GameMap> {
  const result = {} as Record<InteriorArea, GameMap>;
  for (const area of Object.keys(INTERIOR_INFO) as InteriorArea[]) {
    const info = INTERIOR_INFO[area];
    const tiles: string[][] = Array.from({ length: 14 }, (_, y) => Array.from({ length: 20 }, (_, x) =>
      x === 0 || y === 0 || x === 19 || y === 13 ? '#' : 'f'));
    for (const x of [2, 17]) for (let y = 2; y <= 4; y++) tiles[y][x] = 'H';
    if (info.service === 'shop') {
      for (let x = 5; x <= 14; x++) if (x !== 10) tiles[5][x] = 'C';
      for (const x of [4, 5, 6, 13, 14, 15]) tiles[9][x] = 'C';
    } else {
      for (const x of [8, 9, 11, 12]) tiles[5][x] = 'C';
      for (const left of [3, 14]) for (let y = 8; y <= 9; y++)
        for (let x = left; x < left + 3; x++) tiles[y][x] = 'B';
    }
    const serviceId = info.service === 'shop'
      ? info.parent === 'camp' ? 'merchant' : `shop-${info.regionId}`
      : `inn-${info.regionId}`;
    const entities: MapEntity[] = [
      { id: `leave-${info.parent}-${info.service}`, x: 10, y: 12, kind: 'exit',
        name: `Outside · ${SETTLEMENTS[info.parent].name}`, sprite: 'door', hint: 'Walk outside', destination: info.parent },
      { id: serviceId, x: 10, y: 5, kind: 'npc',
        name: info.service === 'shop' ? 'Quartermaster' : 'Innkeeper',
        sprite: info.service === 'shop' ? 'merchant' : 'innkeeper',
        hint: info.service === 'shop' ? 'Buy equipment and supplies' : 'Ask about a room' },
    ];
    result[area] = { ...info, width: 20, height: 14, tiles: tiles.map(row => row.join('')), entities };
  }
  return result;
}
