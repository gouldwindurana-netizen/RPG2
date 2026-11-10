import Phaser from 'phaser';
import type { CharacterProfile } from './contracts';
import { appearanceKey, COMPANION_PROFILES, paintCharacter } from './appearance';

const palette = {
  ink: '#14232b', shadow: '#0b171d', moss: '#364d43', brass: '#b58c48', light: '#ead2a0',
};

function canvas(scene: Phaser.Scene, key: string, w: number, h: number, paint: (c: CanvasRenderingContext2D) => void) {
  if (scene.textures.exists(key)) return;
  const texture = scene.textures.createCanvas(key, w, h)!;
  const context = texture.getContext();
  context.imageSmoothingEnabled = false;
  paint(context);
  texture.refresh();
}

function box(c: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) {
  c.fillStyle = color; c.fillRect(x, y, w, h);
}

function noise(seed: number) {
  let n = seed >>> 0;
  return () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; };
}

export function createArt(scene: Phaser.Scene) {
  const tiles: Record<string, [string, string, string]> = {
    g: ['#3e5848', '#48634d', '#354e42'], d: ['#887858', '#958365', '#776b51'],
    s: ['#6b746d', '#788178', '#535f5c'], w: ['#23454d', '#305760', '#1e3e47'],
    f: ['#495451', '#56605a', '#394441'], '#': ['#293c3e', '#37494a', '#1c3035'],
    t: ['#3e5848', '#48634d', '#354e42'],
  };
  for (const [key, colors] of Object.entries(tiles)) {
    canvas(scene, `tile-${key}`, 32, 32, c => {
      const rand = noise(key.charCodeAt(0) * 113);
      box(c, colors[0], 0, 0, 32, 32);
      for (let i = 0; i < 32; i++) box(c, colors[1 + (i % 2)], Math.floor(rand() * 16) * 2, Math.floor(rand() * 16) * 2, 2, key === 'g' ? 3 : 1);
      if (key === 'f' || key === 's' || key === '#') {
        box(c, colors[2], 0, 0, 32, 1); box(c, colors[2], 0, 0, 1, 32);
        box(c, colors[1], 1, 31, 30, 1);
        if (key === '#') { box(c, '#4b5a53', 0, 0, 32, 5); box(c, '#192a30', 0, 26, 32, 6); }
      }
      if (key === 'w') { box(c, '#46686c', 3, 8, 11, 1); box(c, '#375d63', 17, 23, 9, 1); }
    });
  }
  for (const [name, cloth, hair, metal] of [
    ['Mara', '#66858b', '#322f30', '#b7c3ba'], ['Tavin', '#b18d56', '#644334', '#d5b575'],
    ['Iona', '#c8c6a8', '#c49c69', '#92ae97'], ['Soren', '#6b7c9a', '#3b3441', '#b4a2bd'],
    ['bessa', '#957359', '#d0c4a2', '#a49a7c'], ['merchant', '#627963', '#71634b', '#c5b47f'],
  ]) {
    canvas(scene, `hero-${name}`, 32, 40, c => {
      box(c, '#17252988', 5, 35, 23, 4);
      box(c, palette.ink, 9, 24, 7, 12); box(c, palette.ink, 18, 24, 6, 12);
      box(c, '#695e4d', 9, 33, 7, 3); box(c, '#695e4d', 18, 33, 7, 3);
      box(c, palette.ink, 7, 16, 21, 17); box(c, cloth, 9, 16, 17, 15);
      box(c, metal, 9, 18, 4, 10); box(c, cloth, 3, 18, 5, 12); box(c, '#d9b58f', 4, 29, 4, 3);
      box(c, palette.ink, 9, 4, 17, 15); box(c, '#d3aa7f', 11, 8, 13, 11);
      box(c, hair, 10, 3, 15, 7); box(c, hair, 9, 8, 4, 5);
      box(c, '#e4c399', 14, 11, 9, 4); box(c, palette.ink, 20, 11, 2, 2);
      box(c, '#5c655d', 9, 27, 17, 3); box(c, '#d7b56e', 16, 27, 3, 3);
      if (name === 'Mara') { box(c, metal, 24, 17, 6, 12); box(c, '#647d7c', 25, 19, 3, 8); box(c, '#d4b978', 25, 21, 4, 2); }
      if (name === 'Tavin') { box(c, '#bba07e', 25, 18, 3, 14); box(c, '#e5d2a4', 25, 18, 2, 7); }
      if (name === 'Iona' || name === 'Soren') { box(c, '#765b43', 27, 8, 2, 27); box(c, '#c7ad72', 24, 6, 8, 5); box(c, name === 'Iona' ? '#b9d7bb' : '#b4c9e0', 26, 5, 4, 5); }
      if (name === 'Iona') { box(c, '#e0dbc0', 8, 5, 5, 10); box(c, '#f0e5be', 9, 2, 16, 3); }
      box(c, '#d8cba144', 10, 18, 15, 2);
    });
  }
  // Portraits and game sprites share the same original pixel instructions.
  for (const name of ['Mara', 'Tavin', 'Iona', 'Soren'] as const) {
    scene.textures.remove(`hero-${name}`);
    canvas(scene, `hero-${name}`, 32, 40, c => paintCharacter(c, COMPANION_PROFILES[name]));
  }
  canvas(scene, 'tree', 52, 66, c => {
    box(c, '#142d2d66', 8, 57, 39, 7); box(c, '#493e30', 24, 40, 8, 22);
    box(c, '#765e3e', 27, 41, 3, 20); box(c, '#243f37', 8, 24, 38, 28);
    box(c, '#29483b', 3, 27, 46, 15); box(c, '#365840', 9, 15, 36, 27);
    box(c, '#3c6044', 16, 8, 23, 32); box(c, '#35573d', 21, 3, 13, 11);
    box(c, '#4b704c', 17, 10, 12, 6); box(c, '#4b704c', 10, 24, 9, 5);
    box(c, '#476b47', 32, 24, 8, 5); box(c, '#223e34', 7, 41, 35, 7);
    box(c, '#6d8051', 19, 8, 5, 2); box(c, '#597b4d', 8, 28, 6, 2);
  });
  canvas(scene, 'tent', 80, 64, c => {
    box(c, '#182d2c77', 3, 52, 75, 8);
    for (let i = 0; i < 22; i++) box(c, i < 11 ? '#bca77a' : '#9c8b65', 39 - i * 1.7, 8 + i * 2, 3 + i * 3.4, 2);
    box(c, '#6b6550', 13, 50, 56, 4); box(c, '#283e38', 35, 33, 15, 21);
    box(c, '#c6b17c', 35, 33, 2, 21); box(c, '#795f41', 39, 7, 3, 49);
    box(c, '#deca91', 37, 8, 4, 2); box(c, '#c4ae7c', 17, 38, 5, 2);
    box(c, '#4c503e', 6, 54, 5, 4); box(c, '#4c503e', 70, 54, 5, 4);
  });
  canvas(scene, 'reeds', 32, 32, c => {
    for (let i = 0; i < 7; i++) { const x = 3 + i * 4; box(c, i % 2 ? '#87916a' : '#5b7a56', x, 11 + (i % 3) * 3, 1, 20); box(c, '#9b8059', x - 1, 7 + (i % 3) * 3, 3, 7); }
  });
  for (let frame = 0; frame < 2; frame++) {
    canvas(scene, `fire-${frame}`, 40, 48, c => {
      box(c, '#1d2b2b88', 5, 37, 31, 6); box(c, '#615644', 4, 34, 32, 5);
      box(c, '#796852', 4, 33, 6, 6); box(c, '#796852', 30, 34, 6, 6);
      box(c, '#765139', 10, 33, 20, 6); box(c, '#bf642e', 12, 20, 17, 15);
      box(c, '#e3913b', 15, 15 + frame * 3, 11, 17); box(c, '#f2bd56', 18, 9 + frame * 4, 5, 21);
      box(c, '#f8d98a', 19, 22, 5, 9); box(c, '#f2b656', 11, 17 + frame * 2, 4, 9);
      box(c, '#f5cb7f', 25, 10 + frame * 5, 2, 3);
    });
  }
  canvas(scene, 'lantern', 32, 48, c => {
    box(c, '#594a36', 14, 6, 3, 37); box(c, '#b09b61', 9, 8, 15, 3);
    box(c, '#b29a5a', 8, 11, 16, 3); box(c, '#553f2c', 9, 14, 14, 18);
    box(c, '#f0bf64', 11, 15, 10, 13); box(c, '#ffe4a1', 14, 17, 4, 9);
    box(c, '#94733f', 8, 30, 16, 4); box(c, '#80724c', 8, 42, 17, 3);
  });
  for (const open of [false, true]) canvas(scene, open ? 'chest-open' : 'chest', 40, 36, c => {
    box(c, '#182b2b88', 2, 29, 36, 5); box(c, '#40382e', 3, 9, 34, 22);
    box(c, '#967046', 5, open ? 2 : 10, 30, 10); box(c, '#7a563a', 5, 21, 30, 9);
    box(c, '#c6a765', 5, 10, 4, 20); box(c, '#c6a765', 31, 10, 4, 20);
    box(c, '#c6a765', 4, 18, 32, 4); box(c, '#e5c883', 17, 17, 7, 8);
    if (open) box(c, '#1d2d2b', 9, 13, 22, 7);
  });
  canvas(scene, 'door', 64, 72, c => {
    box(c, '#1b2c30', 5, 5, 54, 64); box(c, '#72796a', 3, 8, 10, 61); box(c, '#72796a', 51, 8, 10, 61);
    box(c, '#8a8b73', 9, 3, 45, 10); box(c, '#3b4a44', 15, 14, 34, 55);
    for (let i = 0; i < 4; i++) box(c, '#263c3a', 17 + i * 8, 14, 2, 54);
    box(c, '#af8a4c', 15, 25, 34, 4); box(c, '#b89759', 35, 39, 5, 7);
    box(c, '#233837', 0, 66, 64, 6); box(c, '#aaa282', 8, 63, 48, 4);
  });
  for (const rare of [false, true]) canvas(scene, rare ? 'enemy-silver' : 'enemy-reedback', 64, 48, c => {
    box(c, '#13282b88', 5, 39, 54, 6);
    for (const x of [7, 18, 43, 54]) { box(c, rare ? '#b5c2bd' : '#7b7c58', x, 31, 4, 11); box(c, '#34473b', x + 1, 39, 6, 3); }
    box(c, '#263e38', 12, 13, 42, 25); box(c, rare ? '#a4c4c2' : '#657a52', 15, 8, 35, 29);
    box(c, rare ? '#d2ded0' : '#819264', 21, 4, 23, 9); box(c, rare ? '#b6d1c4' : '#788b5b', 16, 12, 33, 14);
    box(c, rare ? '#607b80' : '#4d6545', 19, 28, 28, 7);
    box(c, '#344e40', 3, 22, 13, 12); box(c, '#a7a776', 3, 21, 10, 7);
    box(c, '#e5d894', 3, 22, 3, 3); box(c, '#20332e', 4, 22, 2, 2);
    for (let i = 0; i < 3; i++) box(c, rare ? '#4b6f78' : '#96a273', 23 + i * 7, 13 + (i % 2) * 5, 3, 10);
    if (rare) { box(c, '#f4df9d', 28, 6, 10, 2); box(c, '#f4df9d', 32, 3, 2, 9); }
  });
  canvas(scene, 'enemy-hound', 64, 48, c => {
    box(c, '#14272a88', 6, 40, 51, 5); box(c, '#384e41', 17, 18, 35, 19);
    box(c, '#798566', 20, 15, 29, 17); box(c, '#93916b', 22, 15, 16, 5);
    box(c, '#526b50', 7, 13, 19, 20); box(c, '#98a078', 4, 19, 15, 11);
    box(c, '#516646', 11, 6, 6, 13); box(c, '#677653', 22, 8, 5, 13);
    box(c, '#d9ba6e', 9, 16, 4, 3); box(c, '#152d2c', 4, 24, 4, 4);
    box(c, '#455e46', 20, 30, 6, 13); box(c, '#455e46', 44, 30, 6, 13);
    box(c, '#263d35', 17, 41, 10, 3); box(c, '#263d35', 42, 41, 10, 3);
    box(c, '#6a7b58', 49, 18, 10, 5); box(c, '#6a7b58', 57, 11, 4, 11);
  });
  canvas(scene, 'enemy-wisp', 48, 56, c => {
    box(c, '#12272d66', 10, 45, 29, 5); box(c, '#36565b', 12, 16, 26, 23);
    box(c, '#587f78', 9, 23, 31, 11); box(c, '#83a398', 16, 14, 19, 23);
    box(c, '#a4baa0', 20, 9, 10, 26); box(c, '#d6d1a0', 23, 5, 5, 23);
    box(c, '#e3dfb8', 19, 20, 14, 10); box(c, '#34595d', 22, 22, 3, 3); box(c, '#34595d', 29, 22, 3, 3);
    box(c, '#739d94', 16, 35, 6, 9); box(c, '#739d94', 30, 34, 5, 11);
    box(c, '#afc4a1', 6, 13, 2, 3); box(c, '#afc4a1', 39, 10, 3, 3);
  });
  canvas(scene, 'enemy-sentinel', 52, 56, c => {
    box(c, '#12272d88', 4, 48, 45, 5); box(c, '#4c4d3e', 11, 34, 9, 16); box(c, '#4c4d3e', 32, 34, 9, 16);
    box(c, '#ab8850', 10, 18, 33, 22); box(c, '#c2a66b', 13, 18, 28, 7);
    box(c, '#5e5d48', 13, 8, 26, 14); box(c, '#c3a76b', 15, 6, 22, 6);
    box(c, '#29413f', 16, 14, 20, 5); box(c, '#e1c573', 20, 15, 3, 2); box(c, '#e1c573', 30, 15, 3, 2);
    box(c, '#777451', 3, 21, 8, 20); box(c, '#bba066', 1, 25, 10, 12);
    box(c, '#6c6247', 43, 21, 6, 22); box(c, '#d4b477', 18, 25, 16, 4);
  });
  canvas(scene, 'enemy-bailiff', 144, 156, c => {
    box(c, '#0e202877', 10, 141, 124, 10);
    box(c, '#444739', 39, 106, 22, 36); box(c, '#444739', 88, 105, 21, 37);
    box(c, '#8c774b', 33, 135, 31, 11); box(c, '#8c774b', 85, 135, 29, 11);
    box(c, '#263b3b', 29, 45, 88, 67); box(c, '#96733e', 34, 42, 78, 64);
    box(c, '#bd9855', 41, 43, 64, 17); box(c, '#d9b772', 45, 45, 54, 5);
    box(c, '#665a3c', 44, 66, 56, 35); box(c, '#354845', 54, 69, 37, 29);
    box(c, '#c6b282', 58, 72, 27, 20); box(c, '#657c6e', 62, 76, 19, 11);
    box(c, '#e4c683', 54, 64, 38, 5); box(c, '#c5a15f', 55, 95, 38, 4);
    box(c, '#5c5840', 48, 15, 52, 30); box(c, '#b19051', 44, 10, 59, 14);
    box(c, '#c5a667', 50, 8, 48, 8); box(c, '#273f3e', 51, 28, 44, 11);
    box(c, '#ecce79', 58, 30, 10, 3); box(c, '#ecce79', 80, 30, 10, 3);
    box(c, '#ae8c4c', 24, 50, 14, 43); box(c, '#c4a366', 16, 51, 19, 19);
    box(c, '#a1834b', 111, 50, 17, 42); box(c, '#d1ae6b', 112, 49, 20, 17);
    box(c, '#675538', 12, 73, 8, 61); box(c, '#b6a26c', 0, 72, 34, 22);
    box(c, '#d4ba7d', 2, 70, 30, 6); box(c, '#69705a', 2, 88, 30, 5);
    box(c, '#e0c67e', 39, 55, 5, 46); box(c, '#e0c67e', 102, 55, 5, 45);
    box(c, '#354844', 60, 110, 29, 9);
  });
  for (const base of ['enemy-reedback', 'enemy-hound', 'enemy-wisp', 'enemy-sentinel']) {
    const image = scene.textures.get(base).getSourceImage() as HTMLCanvasElement;
    for (const rank of ['ashen', 'crested']) canvas(scene, `${base}-${rank}`, image.width, image.height, c => {
      c.drawImage(image, 0, 0);
      const pixels = c.getImageData(0, 0, image.width, image.height);
      for (let i = 0; i < pixels.data.length; i += 4) {
        if (!pixels.data[i + 3]) continue;
        const luma = pixels.data[i] * .3 + pixels.data[i + 1] * .59 + pixels.data[i + 2] * .11;
        if (luma < 35) continue; // Preserve the dark outline for contrast.
        pixels.data[i] = Math.min(255, luma * (rank === 'ashen' ? .86 : 1.12));
        pixels.data[i + 1] = Math.min(255, luma * (rank === 'ashen' ? 1.02 : .78));
        pixels.data[i + 2] = Math.min(255, luma * (rank === 'ashen' ? 1.16 : 1.35));
      }
      c.putImageData(pixels, 0, 0);
      box(c, rank === 'ashen' ? '#d6dfcf' : '#e9d3a2', Math.floor(image.width * .54), Math.floor(image.height * .36), 3, 10);
      if (rank === 'crested') box(c, '#e9d3a2', Math.floor(image.width * .65), Math.floor(image.height * .36), 3, 10);
    });
  }
}

export function ensureLeadArt(scene: Phaser.Scene, profile: CharacterProfile, back = false) {
  const key = `lead-${appearanceKey(profile)}${back ? '-back' : ''}`;
  canvas(scene, key, 32, 40, c => {
    paintCharacter(c, profile);
    if (back) {
      const colors = { chestnut: '#684535', black: '#292c35', silver: '#c4c5c0', copper: '#a9633e' };
      const hair = colors[profile.hair] || colors.chestnut;
      box(c, hair, 10, 5, 13, 12);
      box(c, '#14232b', 9, 6, 1, 10); box(c, '#14232b', 23, 6, 1, 10);
      if (profile.hairStyle === 'tied') box(c, hair, 15, 15, 5, 7);
      if (profile.hairStyle === 'long') box(c, hair, 10, 14, 13, 8);
    }
  });
  return key;
}

export function textureForEntity(sprite: string, kind: string) {
  const key = sprite.toLowerCase();
  if (kind === 'boss' || /bailiff/.test(key)) return 'enemy-bailiff';
  if (kind === 'rare' || /silver/.test(key)) return 'enemy-silver';
  if (kind === 'chest') return 'chest';
  if (kind === 'campfire' || /fire/.test(key)) return 'fire-0';
  if (kind === 'exit' || /door/.test(key)) return 'door';
  if (/bessa/.test(key)) return 'hero-bessa';
  if (/merchant|quarter/.test(key)) return 'hero-merchant';
  if (/lantern/.test(key)) return 'lantern';
  if (/hound|jackal/.test(key)) return 'enemy-hound';
  if (/wisp|moth|shade/.test(key)) return 'enemy-wisp';
  if (/sentinel|mite/.test(key)) return 'enemy-sentinel';
  return 'enemy-reedback';
}

export function paintWorld(scene: Phaser.Scene, map: { width: number; height: number; tiles: string[] }, area: string) {
  const key = `world-${area}`;
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const texture = scene.textures.createCanvas(key, 960, 576)!;
  const c = texture.getContext(); c.imageSmoothingEnabled = false;
  const tile = Math.min(32, Math.floor(960 / map.width), Math.floor(576 / map.height));
  const ox = Math.floor((960 - map.width * tile) / 2), oy = Math.floor((576 - map.height * tile) / 2);
  box(c, area === 'camp' ? '#273f3b' : '#202f33', 0, 0, 960, 576);
  const rand = noise(area === 'camp' ? 104 : 221);
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
    const raw = map.tiles[y]?.[x] || '#';
    const char = raw === 'T' ? 'g' : raw;
    const source = scene.textures.get(`tile-${char in { g: 1, d: 1, s: 1, f: 1, w: 1, t: 1, '#': 1 } ? char : '#'}`).getSourceImage() as HTMLCanvasElement;
    c.drawImage(source, ox + x * tile, oy + y * tile, tile, tile);
    if (char === 'w' && rand() > .4) { box(c, '#67827b', ox + x * tile + 5, oy + y * tile + 13, 10, 1); }
    if (char === 'g' && rand() > .72) {
      box(c, '#a59961', ox + x * tile + 8, oy + y * tile + 9, 2, 2);
      box(c, '#6a8052', ox + x * tile + 8, oy + y * tile + 11, 1, 4);
    }
    if (char === 'g' && rand() > .94) {
      const px = ox + x * tile + 17, py = oy + y * tile + 19;
      box(c, '#879578', px - 1, py + 2, 1, 4);
      box(c, '#d6bd83', px - 2, py, 3, 2);
      box(c, '#baa9bc', px + 3, py + 4, 3, 2);
    }
    if (area === 'works' && char === '#') {
      const px = ox + x * tile, py = oy + y * tile;
      box(c, '#56615a', px + 2, py + 6, tile - 4, 2);
      box(c, '#243337', px + ((x + y) % 2 ? 9 : 21), py + 8, 2, 13);
      box(c, '#18292e', px, py + tile - 4, tile, 4);
      if (map.tiles[y + 1]?.[x] === 'f') box(c, '#12242966', px, py + tile, tile, 6);
    }
    if (area === 'works' && char === '#' && y % 4 === 1 && x % 4 === 0) {
      box(c, '#8d7447', ox + x * tile + 13, oy + y * tile, 6, tile);
      box(c, '#b69a5e', ox + x * tile + 14, oy + y * tile, 2, tile);
    }
  }
  // Light pools are painted into the scenery, never used as collision objects.
  const lights = area === 'camp' ? [[12.5, 12.5, 96], [9.5, 8.5, 52], [28.5, 8.5, 48]] : [[8, 4, 56], [16, 8, 72], [27, 3, 100]];
  for (const [x, y, radius] of lights) {
    const px = ox + x * tile, py = oy + y * tile;
    const light = c.createRadialGradient(px, py, 4, px, py, radius);
    light.addColorStop(0, area === 'camp' ? '#f3b66324' : '#ccb06e18');
    light.addColorStop(1, '#e6b06500');
    c.fillStyle = light; c.fillRect(px - radius, py - radius, radius * 2, radius * 2);
  }
  // Large scenery is drawn after the ground so tree canopies cross tile edges.
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
    if (map.tiles[y]?.[x] === 't') {
      const source = scene.textures.get('tree').getSourceImage() as HTMLCanvasElement;
      c.drawImage(source, ox + x * tile - 10, oy + y * tile - 32, tile + 20, tile + 34);
    }
    if (map.tiles[y]?.[x] === 'w' && (x + y) % 5 === 0) {
      c.drawImage(scene.textures.get('reeds').getSourceImage() as HTMLCanvasElement, ox + x * tile, oy + y * tile, tile, tile);
    }
  }
  if (area === 'camp') {
    // Encampment props sit away from the central walking paths.
    const tents = [[9, 4], [18, 4], [23, 4], [16, 14]];
    for (const [x, y] of tents) c.drawImage(scene.textures.get('tent').getSourceImage() as HTMLCanvasElement, ox + x * tile, oy + y * tile + 4, tile * 2, tile * 2 - 4);
    for (const [x, y] of [[8, 8], [20, 10], [26, 13]]) {
      box(c, '#72583e', ox + x * tile, oy + y * tile + 4, 24, 11);
      box(c, '#a08152', ox + x * tile, oy + y * tile + 4, 24, 2);
      box(c, '#c4ab70', ox + x * tile + 5, oy + y * tile + 4, 2, 11);
    }
  } else {
    // Vertical piers and bronze trim give the works a repeated architectural rhythm.
    for (let x = 2; x < map.width - 1; x += 6) {
      if (map.tiles[1]?.[x] === '#') {
        box(c, '#42514b', ox + x * tile + 5, oy + 2, 19, tile * 2);
        box(c, '#947849', ox + x * tile + 7, oy + 10, 3, tile * 2 - 10);
      }
    }
    for (const [x, y] of [[7, 4], [15, 8], [26, 3]]) {
      const px = ox + x * tile, py = oy + y * tile;
      box(c, '#756343', px + 7, py - 10, 5, 25);
      box(c, '#be9856', px + 3, py - 3, 13, 4);
      box(c, '#edc77d', px + 7, py - 1, 5, 8);
      box(c, '#e9c07944', px + 4, py + 14, 11, 2);
    }
  }
  // A restrained vignette keeps UI labels and the dusk palette together.
  const vignette = c.createRadialGradient(480, 270, 140, 480, 270, 540);
  vignette.addColorStop(0, '#10212700'); vignette.addColorStop(1, '#0c1b2466');
  c.fillStyle = vignette; c.fillRect(0, 0, 960, 576);
  texture.refresh(); return { key, tile, ox, oy };
}

export function paintBattle(scene: Phaser.Scene) {
  canvas(scene, 'battle-background', 960, 576, c => {
    box(c, '#1a2b30', 0, 0, 960, 576);
    const glow = c.createRadialGradient(320, 165, 20, 320, 165, 370);
    glow.addColorStop(0, '#8c754944'); glow.addColorStop(1, '#23343b00');
    c.fillStyle = glow; c.fillRect(0, 0, 960, 350);
    for (let y = 0; y < 290; y += 32) for (let x = 0; x < 960; x += 64) {
      box(c, (x + y) % 3 ? '#30413f' : '#344641', x + (y % 64 ? 32 : 0), y, 62, 30);
      box(c, '#243735', x, y + 30, 64, 2);
    }
    for (const x of [40, 175, 500, 820, 925]) {
      box(c, '#172b30', x - 8, 0, 42, 300); box(c, '#48534a', x, 0, 25, 292);
      box(c, '#8a784c', x + 3, 0, 4, 288); box(c, '#66705a', x - 5, 281, 35, 16);
    }
    // Silent bell behind the combatants.
    box(c, '#6d6949', 305, 26, 14, 43);
    for (let y = 0; y < 11; y++) box(c, y % 2 ? '#6f6846' : '#756d49', 282 - y * 5, 65 + y * 10, 58 + y * 10, 10);
    box(c, '#a58b51', 226, 170, 172, 12); box(c, '#3b4d42', 242, 184, 143, 8);
    box(c, '#928050', 307, 184, 10, 21);
    box(c, '#243c3b', 0, 298, 960, 278);
    for (let y = 302; y < 576; y += 38) for (let x = 0; x < 960; x += 80) {
      box(c, '#344945', x + (y % 76 ? 40 : 0), y, 78, 36); box(c, '#40514a', x + 1, y + 1, 76, 1);
    }
    box(c, '#988653', 0, 297, 960, 4); box(c, '#152d30', 0, 302, 960, 5);
    for (const x of [88, 540, 875]) {
      box(c, '#604e37', x, 208, 5, 78); box(c, '#c39b50', x - 5, 214, 16, 12);
      box(c, '#f3cb79', x - 1, 210, 8, 12);
    }
    const shade = c.createLinearGradient(0, 350, 0, 576);
    shade.addColorStop(0, '#0e202500'); shade.addColorStop(1, '#0b1b2577');
    c.fillStyle = shade; c.fillRect(0, 350, 960, 226);
  });
}
