import Phaser from 'phaser';
import type { CharacterProfile, GameMap } from './contracts';
import { appearanceKey, COMPANION_PROFILES, paintCharacter } from './appearance';
import { regionAt } from './campaign';

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
  createCampaignArt(scene);
  for (const base of ['enemy-reedback', 'enemy-hound', 'enemy-wisp', 'enemy-sentinel', 'enemy-cantor', 'enemy-widow', 'enemy-hart']) {
    const image = scene.textures.get(base).getSourceImage() as HTMLCanvasElement;
    for (const rank of ['ashen', 'crested', 'rare']) canvas(scene, `${base}-${rank}`, image.width, image.height, c => {
      c.drawImage(image, 0, 0);
      const pixels = c.getImageData(0, 0, image.width, image.height);
      for (let i = 0; i < pixels.data.length; i += 4) {
        if (!pixels.data[i + 3]) continue;
        const luma = pixels.data[i] * .3 + pixels.data[i + 1] * .59 + pixels.data[i + 2] * .11;
        if (luma < 35) continue; // Preserve the dark outline for contrast.
        pixels.data[i] = Math.min(255, luma * (rank === 'ashen' ? .86 : rank === 'rare' ? 1.2 : 1.12));
        pixels.data[i + 1] = Math.min(255, luma * (rank === 'ashen' ? 1.02 : rank === 'rare' ? 1.23 : .78));
        pixels.data[i + 2] = Math.min(255, luma * (rank === 'ashen' ? 1.16 : rank === 'rare' ? 1.12 : 1.35));
      }
      c.putImageData(pixels, 0, 0);
      box(c, rank === 'ashen' ? '#d6dfcf' : '#e9d3a2', Math.floor(image.width * .54), Math.floor(image.height * .36), 3, 10);
      if (rank === 'crested') box(c, '#e9d3a2', Math.floor(image.width * .65), Math.floor(image.height * .36), 3, 10);
      if (rank === 'rare') {
        const x = Math.floor(image.width * .55), y = Math.floor(image.height * .24);
        box(c, '#fff2b8', x - 4, y, 10, 2); box(c, '#fff2b8', x, y - 4, 2, 10);
      }
    });
  }
}

/** All sprites are drawn locally on an integer pixel grid. */
function createCampaignArt(scene: Phaser.Scene) {
  canvas(scene, 'enemy-cantor', 72, 88, c => {
    box(c, '#101e2d88', 7, 78, 57, 6);
    for (let y = 0; y < 12; y++) box(c, y % 2 ? '#4b567c' : '#59658b', 27 - y, 28 + y * 4, 21 + y * 2, 4);
    box(c, '#202d48', 23, 15, 29, 30); box(c, '#818cad', 28, 10, 19, 10);
    box(c, '#152434', 29, 20, 19, 15); box(c, '#e5d4ac', 32, 23, 4, 3); box(c, '#e5d4ac', 42, 23, 4, 3);
    box(c, '#ac9b72', 34, 39, 5, 35); box(c, '#ccbd8c', 32, 46, 9, 3);
    box(c, '#344261', 8, 35, 19, 10); box(c, '#75849c', 6, 34, 11, 8);
    box(c, '#50617c', 50, 32, 13, 13); box(c, '#ccb98b', 60, 15, 3, 54);
    box(c, '#d4c591', 55, 11, 13, 9); box(c, '#8cb8b8', 59, 9, 5, 7);
    for (const x of [17, 46]) { box(c, '#96acbc', x, 56, 2, 16); box(c, '#6c8099', x + 3, 62, 2, 14); }
  });
  canvas(scene, 'enemy-widow', 96, 64, c => {
    box(c, '#16263288', 8, 55, 78, 6);
    for (let i = 0; i < 4; i++) {
      const y = 18 + i * 9;
      box(c, '#3a344e', 16 - i * 4, y, 25 + i * 2, 5); box(c, '#88738a', 13 - i * 3, y + 3, 5, 17);
      box(c, '#3a344e', 58, y, 22 + i * 3, 5); box(c, '#88738a', 77 + i * 3, y + 3, 5, 15);
    }
    box(c, '#2c2c43', 32, 10, 40, 35); box(c, '#685571', 36, 6, 32, 32); box(c, '#88718a', 41, 9, 20, 12);
    box(c, '#ab95a2', 43, 13, 7, 3); box(c, '#44394d', 31, 35, 33, 20);
    for (const x of [35, 43, 51, 59]) box(c, '#e3c389', x, 39, 3, 4);
    box(c, '#dfd2b0', 35, 50, 3, 9); box(c, '#dfd2b0', 57, 50, 3, 9);
    box(c, '#c5a4a3', 49, 22, 5, 8); box(c, '#c5a4a3', 46, 25, 11, 3);
  });
  canvas(scene, 'enemy-hart', 104, 108, c => {
    box(c, '#14262888', 13, 99, 77, 6);
    for (const x of [35, 70]) { box(c, '#4c453b', x, 65, 7, 36); box(c, '#b09562', x + 1, 71, 3, 25); }
    box(c, '#473e36', 29, 51, 55, 29); box(c, '#927c51', 33, 48, 45, 27); box(c, '#b49a68', 42, 51, 26, 9);
    box(c, '#675a3f', 20, 28, 19, 40); box(c, '#af9564', 15, 27, 22, 20); box(c, '#d8b879', 11, 33, 17, 8);
    box(c, '#202e2c', 17, 32, 3, 3); box(c, '#201f24', 9, 38, 5, 5);
    for (const [x, sign] of [[24, -1], [32, 1]]) {
      box(c, '#c2b48c', x, 8, 3, 24); box(c, '#c2b48c', x + sign * 8, 10, 11, 3);
      box(c, '#d9c9a0', x + sign * 10, 1, 3, 12); box(c, '#d9c9a0', x + sign * 4, 3, 3, 13);
    }
    box(c, '#9f8958', 79, 48, 15, 5); box(c, '#e4d09c', 88, 43, 5, 9);
    for (const [x,y] of [[43,65],[57,61],[69,66]]) box(c, '#dbca91', x, y, 3, 3);
  });
  // Boss silhouettes remain recognisable independently of their palette.
  for (const boss of ['silt', 'hart', 'widow', 'censer', 'choir', 'vale', 'heart', 'colossus', 'toll']) {
    canvas(scene, `boss-${boss}`, 160, 164, c => {
      box(c, '#0d1c2c88', 11, 150, 139, 10);
      if (boss === 'hart' || boss === 'widow') {
        const source = scene.textures.get(`enemy-${boss}`).getSourceImage() as HTMLCanvasElement;
        c.drawImage(source, boss === 'hart' ? 1 : 2, boss === 'hart' ? 1 : 45, 156, boss === 'hart' ? 156 : 104);
        const rand = noise(boss === 'hart' ? 617 : 829);
        for (let i = 0; i < 27; i++) box(c, boss === 'hart' ? '#d26955' : '#c18c9e', 25 + Math.floor(rand() * 105), 48 + Math.floor(rand() * 70), 3, 6);
        if (boss === 'hart') { box(c, '#537e67', 41, 4, 5, 20); box(c, '#74916a', 18, 19, 25, 4); }
        else { for (let i = 0; i < 4; i++) box(c, '#81975f', 19 + i * 34, 79 - i % 2 * 19, 5, 8); }
      } else if (boss === 'silt') {
        for (let row = 0; row < 12; row++) box(c, row % 2 ? '#566b57' : '#65775c', 53 - row * 4, 41 + row * 9, 51 + row * 8, 9);
        for (let i = 0; i < 7; i++) { box(c, '#2c4846', 28 + i * 16, 84 + i % 2 * 17, 9, 27); box(c, '#92a581', 34 + i * 15, 70 + i % 3 * 19, 3, 12); }
        box(c, '#182d31', 49, 70, 63, 18); box(c, '#e2d29a', 57, 73, 12, 4); box(c, '#e2d29a', 94, 73, 12, 4);
        box(c, '#bca86a', 39, 25, 81, 10); for (const x of [43, 64, 85, 106]) box(c, '#d5c286', x, 12 + x % 3 * 3, 9, 23);
      } else if (boss === 'heart') {
        box(c, '#bca174', 75, 1, 9, 27); box(c, '#e0c896', 67, 9, 25, 7);
        for (let i = 0; i < 11; i++) box(c, i % 2 ? '#b6a476' : '#c7b486', 52 - i * 3, 29 + i * 9, 55 + i * 6, 9);
        box(c, '#e7d7a1', 15, 126, 130, 9); box(c, '#4b5360', 29, 135, 101, 8);
        box(c, '#d4bb85', 76, 136, 9, 17); box(c, '#8dd6d1', 64, 65, 34, 34); box(c, '#e2f6d9', 73, 73, 17, 18);
        for (const x of [31, 120]) { box(c, '#899fab', x, 25, 4, 59); box(c, '#c8dfce', x - 4, 42, 12, 3); }
      } else if (boss === 'choir') {
        const source = scene.textures.get('enemy-cantor').getSourceImage() as HTMLCanvasElement;
        c.drawImage(source, 2, 34, 79, 111); c.drawImage(source, 77, 34, 79, 111); c.drawImage(source, 36, 4, 93, 142);
        box(c, '#d8b887', 28, 2, 105, 4); box(c, '#e4d5ab', 47, 9, 69, 2);
      } else if (boss === 'censer') {
        for (const x of [39, 111]) { box(c, '#708087', x, 8, 3, 78); for (let y = 10; y < 83; y += 10) box(c, '#b2b9ae', x - 2, y, 7, 3); }
        box(c, '#4f5c62', 26, 79, 108, 12); box(c, '#b29e6d', 36, 92, 88, 38); box(c, '#d7c48c', 27, 127, 106, 8);
        for (const x of [42, 64, 87, 109]) box(c, '#263e45', x, 98, 8, 20);
        box(c, '#9b8e68', 50, 135, 60, 12); box(c, '#e1cb96', 64, 148, 32, 8);
        for (let i = 0; i < 6; i++) box(c, '#b7d7c28c', 53 + i % 3 * 18, 19 + i * 11, 15, 12);
      } else {
        const pale = boss === 'colossus', marshal = boss === 'vale';
        const metal = pale ? '#b4b9ac' : marshal ? '#909db2' : '#a99261';
        box(c, '#2f3944', 41, 110, 22, 39); box(c, '#2f3944', 93, 110, 22, 39);
        box(c, metal, 31, 137, 36, 15); box(c, metal, 89, 137, 36, 15);
        box(c, '#263447', 28, 47, 99, 69); box(c, metal, 34, 43, 87, 63);
        box(c, pale ? '#e0d7b3' : '#d0b989', 43, 46, 69, 10); box(c, '#4b5b66', 46, 68, 53, 31);
        box(c, '#d7c48a', 61, 76, 23, 15); box(c, '#516b76', 46, 12, 66, 29); box(c, metal, 43, 8, 73, 14);
        box(c, '#1d2e3c', 51, 28, 55, 9); box(c, pale ? '#71c5c7' : '#e9c888', 59, 30, 12, 3); box(c, pale ? '#71c5c7' : '#e9c888', 87, 30, 12, 3);
        box(c, metal, 12, 50, 23, 50); box(c, metal, 124, 50, 23, 50);
        if (marshal) { box(c, '#a45e67', 111, 39, 15, 93); box(c, '#d7ddcc', 142, 52, 4, 99); box(c, '#dec795', 135, 105, 17, 5); }
        else if (pale) { box(c, '#293a46', 6, 8, 9, 130); box(c, '#c9cbb6', 0, 1, 36, 35); }
        else { box(c, '#b69a62', 3, 92, 7, 50); box(c, '#d0b47a', 0, 85, 31, 16); box(c, '#e3cf97', 124, 94, 29, 3); }
      }
    });
  }
  for (const type of ['town', 'castle', 'cave', 'dock', 'house', 'inn', 'shop', 'basilica']) {
    canvas(scene, `site-${type}`, type === 'basilica' ? 128 : 88, type === 'basilica' ? 144 : 92, c => {
      if (type === 'cave') {
        for (let i = 0; i < 7; i++) box(c, i % 2 ? '#87918a' : '#6c7b79', 30 - i * 4, 13 + i * 10, 28 + i * 8, 10);
        box(c, '#1a2935', 29, 48, 30, 35); box(c, '#0e202b', 34, 45, 20, 39); box(c, '#a6a88b', 17, 83, 53, 4); return;
      }
      if (type === 'dock') {
        for (let i = 0; i < 6; i++) box(c, '#b59a70', 13, 26 + i * 9, 63, 7);
        for (const x of [9, 76]) { box(c, '#4e463e', x, 22, 5, 65); box(c, '#dbcca3', x - 2, 20, 9, 5); }
        box(c, '#c1b181', 37, 6, 3, 44); box(c, '#dbd6af', 40, 7, 28, 23); return;
      }
      const grand = type === 'basilica', castle = type === 'castle';
      const wall = grand ? '#c5c8b6' : castle ? '#a6ad9d' : '#c2b998';
      const roof = type === 'shop' ? '#658e91' : type === 'inn' ? '#a5736f' : '#687e91';
      box(c, '#1d303b77', 3, grand ? 136 : 82, grand ? 122 : 83, 7);
      box(c, '#455769', grand ? 16 : 10, grand ? 57 : 38, grand ? 96 : 68, grand ? 81 : 46);
      box(c, wall, grand ? 20 : 13, grand ? 55 : 39, grand ? 88 : 62, grand ? 79 : 42);
      for (let row = 0; row < (grand ? 11 : 7); row++) box(c, row % 2 ? roof : '#526b7d', grand ? 11 + row * 3 : 4 + row * 5, grand ? 25 + row * 3 : 16 + row * 4, grand ? 105 - row * 6 : 80 - row * 10, grand ? 4 : 5);
      box(c, '#344758', grand ? 51 : 34, grand ? 105 : 61, grand ? 26 : 20, grand ? 33 : 23); box(c, '#9b895b', grand ? 56 : 38, grand ? 108 : 64, grand ? 16 : 12, grand ? 29 : 19);
      for (const x of grand ? [28, 87] : [20, 57]) { box(c, '#3b5767', x, grand ? 78 : 49, 11, 14); box(c, '#e4d292', x + 3, grand ? 80 : 51, 5, 8); }
      box(c, '#ece2bb', grand ? 20 : 13, grand ? 100 : 76, grand ? 88 : 62, 3);
      if (grand || castle) for (const x of grand ? [4, 99] : [4, 63]) {
        box(c, '#677b88', x, grand ? 8 : 10, 23, grand ? 126 : 75); box(c, wall, x + 3, grand ? 12 : 13, 17, grand ? 121 : 68);
        box(c, '#3e5263', x + 8, grand ? 28 : 25, 7, 18); box(c, '#d8c58c', x + 8, grand ? 29 : 26, 6, 10);
        box(c, '#9cabb0', x - 2, grand ? 7 : 9, 27, 7); box(c, '#d2c595', x + 9, grand ? 0 : 2, 4, 7);
      }
      if (type === 'inn' || type === 'shop') { box(c, '#4d4b3b', 74, 48, 11, 3); box(c, '#d8c38b', 78, 50, 9, 13); box(c, type === 'inn' ? '#8a5b58' : '#426e76', 81, 53, 3, 7); }
      if (type === 'town') { box(c, '#c8bd9b', 0, 59, 25, 24); box(c, '#755f65', 0, 51, 27, 10); }
    });
  }
  for (const [key, tint] of [['tree-fen', '#789b86'], ['tree-orchard', '#c18a9b'], ['tree-pale', '#c7c9ac']] as const) {
    const source = scene.textures.get('tree').getSourceImage() as HTMLCanvasElement;
    canvas(scene, key, 52, 66, c => { c.drawImage(source, 0, 0); c.globalCompositeOperation = 'source-atop'; c.fillStyle = `${tint}77`; c.fillRect(0, 0, 52, 52); c.globalCompositeOperation = 'source-over'; });
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
  if (kind === 'boss') {
    if (/colossus/.test(key)) return 'boss-colossus';
    if (/silt/.test(key)) return 'boss-silt';
    if (/ashroot|hart/.test(key)) return 'boss-hart';
    if (/widow/.test(key)) return 'boss-widow';
    if (/censer/.test(key)) return 'boss-censer';
    if (/choir/.test(key)) return 'boss-choir';
    if (/vale|command/.test(key)) return 'boss-vale';
    if (/heart/.test(key)) return 'boss-heart';
    if (/toll/.test(key)) return 'boss-toll';
    return 'enemy-bailiff';
  }
  if (kind === 'chest') return 'chest';
  if (kind === 'campfire' || /fire/.test(key)) return 'fire-0';
  if (kind === 'exit') {
    if (/basilica|heart/.test(key)) return 'site-basilica';
    if (/works|granary|cave|hollow/.test(key)) return 'site-cave';
    if (/dock|ferry|fen/.test(key)) return 'site-dock';
    if (/toll|crown|veyr|castle/.test(key)) return 'site-castle';
    if (/town|dunmere|camp|reedbank|orchard/.test(key)) return 'site-town';
    return 'door';
  }
  if (/lantern/.test(key)) return 'lantern';
  if (kind === 'npc') return /bessa|sen|iona|neri/.test(key) ? 'hero-bessa' : 'hero-merchant';
  let texture = /hound|jackal/.test(key) ? 'enemy-hound' : /widow/.test(key) ? 'enemy-widow'
    : /hart/.test(key) ? 'enemy-hart' : /cantor|choir/.test(key) ? 'enemy-cantor'
    : /wisp|moth|shade/.test(key) ? 'enemy-wisp' : /sentinel|mite|bellwarden/.test(key) ? 'enemy-sentinel' : 'enemy-reedback';
  if (kind === 'rare' || /silver|coinveil|moonlace|amberglass|ivory|starless/.test(key)) texture += '-rare';
  return texture;
}

type Scenery = { x: number; y: number; texture: string; scale: number; row: number };

const AREA_COLORS: Record<string, [string, string, string, string]> = {
  camp: ['#4d704e', '#75935e', '#a19266', '#315f72'],
  overworld: ['#5d8258', '#84a36a', '#ad9e74', '#356e8a'],
  dunmere: ['#6b8b6c', '#9bb28a', '#c2bda4', '#4f7d90'],
  tollhouse: ['#61766d', '#8b9c86', '#a8a995', '#386d82'],
  fen: ['#506f61', '#78917a', '#938b65', '#355e6a'],
  granary: ['#52685c', '#839079', '#9f9c7d', '#304f5d'],
  orchard: ['#59664d', '#8c8b62', '#a79177', '#505b70'],
  crown: ['#69796b', '#9dafa0', '#b6b7a0', '#456c83'],
  veyr: ['#62796c', '#a0b09a', '#c4c8b5', '#526c88'],
  heart: ['#4b5d63', '#839493', '#afb9ad', '#3d526a'],
  works: ['#40584b', '#677c64', '#848d7d', '#305866'],
};

export function paintWorld(scene: Phaser.Scene, map: GameMap, area: string) {
  const key = `world-${area}`;
  if (scene.textures.exists(key)) scene.textures.remove(key);
  // Large maps retain the same readable tile size and move beneath the camera.
  const tile = 30, width = Math.max(960, map.width * tile), height = Math.max(576, map.height * tile);
  const ox = Math.floor((width - map.width * tile) / 2), oy = Math.floor((height - map.height * tile) / 2);
  const texture = scene.textures.createCanvas(key, width, height)!;
  const c = texture.getContext(); c.imageSmoothingEnabled = false;
  const baseColors = AREA_COLORS[area] || AREA_COLORS.camp;
  const indoor = ['works', 'granary', 'heart', 'tollhouse'].includes(area);
  const rand = noise([...area].reduce((n, v) => n + v.charCodeAt(0), 193));
  const scenery: Scenery[] = [];
  const at = (x: number, y: number) => map.tiles[y]?.[x] || '#';
  box(c, '#182b3b', 0, 0, width, height);
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
    const ch = at(x,y), px = ox+x*tile, py = oy+y*tile;
    const worldBiome: Record<string, string> = {R01:'camp',R02:'dunmere',R03:'fen',R04:'orchard',R05:'crown',R06:'veyr'};
    const biome = area === 'overworld' ? worldBiome[regionAt('overworld',x,y)] : area;
    const [grass, light, stone, water] = area === 'overworld' ? AREA_COLORS[biome] : baseColors;
    const isWater = ch === 'w';
    const ground = isWater ? water : ch === 'd' ? '#ab9872' : ch === 's' ? stone : ch === 'f' ? (indoor ? '#69776d' : stone) : ch === '#' ? (indoor ? '#465b5e' : '#6a7c74') : grass;
    box(c, ground, px, py, tile, tile);
    if (isWater) {
      for (let i=0;i<3;i++) box(c, i%2 ? '#a5c3bc50' : '#1d425b66', px+3+Math.floor(rand()*16),py+5+i*9,6+Math.floor(rand()*9),1);
      // A continuous, outlined shoreline makes coastline and inland paths legible.
      for (const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]) if (at(x+dx,y+dy) !== 'w' && at(x+dx,y+dy) !== 'b') {
        box(c,'#273f4e',px+(dx===1?27:0),py+(dy===1?27:0),dx?3:30,dy?3:30);
        box(c,'#b2b58a',px+(dx===1?29:0),py+(dy===1?29:0),dx?1:30,dy?1:30);
      }
    } else if (ch === 'b') {
      box(c,water,px,py,tile,tile);
      const horizontal = ['w','b'].includes(at(x,y-1)) && ['w','b'].includes(at(x,y+1));
      box(c,'#403d39',px+(horizontal?0:3),py+(horizontal?3:0),horizontal?30:24,horizontal?24:30);
      for (let i=0;i<5;i++) box(c, i%2?'#b69e72':'#c2ab7b',px+(horizontal?i*6:6),py+(horizontal?6:i*6),horizontal?5:18,horizontal?18:5);
      box(c,'#e1c895',px+(horizontal?0:3),py+(horizontal?3:0),horizontal?30:2,horizontal?2:30);
      box(c,'#6b604b',px+(horizontal?0:25),py+(horizontal?25:0),horizontal?30:2,horizontal?2:30);
    } else if (ch === 's' || ch === 'f' || ch === '#') {
      box(c,ch==='#'?'#283f49':'#4a625d',px,py,30,1); box(c,ch==='#'?'#314950':'#8e9e87',px,py,1,30);
      if ((x+y)%2===0) box(c,ch==='#'?'#7a8b7c':'#d0c7a12a',px+2,py+2,26,2);
      if (ch === '#') { box(c,'#9ba28c',px,py,30,4); box(c,'#1c323e',px,py+25,30,5); box(c,'#354e55',px+13,py+5,2,20); }
      else if ((x*3+y)%7===0) box(c,'#445e5b',px+18,py+11,5,1);
    } else if (ch === '^') {
      for (let i=0;i<7;i++) box(c,i<3?'#bbc3ad':i%2?'#6d8280':'#84948a',px+13-i*2,py+1+i*4,4+i*4,4);
      box(c,'#e1dfbd',px+12,py+1,7,5); box(c,'#354e59',px+4,py+26,25,3);
    } else {
      for (let i=0;i<5;i++) box(c,i%2?light:'#314f4144',px+Math.floor(rand()*27),py+Math.floor(rand()*27),2,2);
      if(ch==='d'){ box(c,'#ccb88d',px+7,py+10,4,2); box(c,'#7a7858',px+23,py+20,3,1); }
      if(ch==='g' && rand()>.84) { box(c, area==='orchard'?'#cba5b3':'#e0d397',px+14,py+11,3,2);box(c,light,px+15,py+13,1,4); }
    }
    if (ch==='t') scenery.push({x:px+15,y:py+30,texture:biome==='orchard'?'tree-orchard':biome==='fen'?'tree-fen':biome==='veyr'?'tree-pale':'tree',scale:area==='overworld'?.61:.84,row:y});
    if (isWater && area!=='overworld' && (x+y)%5===0) c.drawImage(scene.textures.get('reeds').getSourceImage() as HTMLCanvasElement,px,py,30,30);
  }
  // Connected building footprints become one readable piece of town architecture.
  const visited = new Set<string>();
  for(let y=0;y<map.height;y++) for(let x=0;x<map.width;x++) if(at(x,y)==='T'&&!visited.has(`${x},${y}`)) {
    const queue = [{x,y}], cells: {x:number;y:number}[]=[];
    while(queue.length){const p=queue.shift()!;const id=`${p.x},${p.y}`;if(visited.has(id)||at(p.x,p.y)!=='T')continue;visited.add(id);cells.push(p);for(const [dx,dy]of[[0,-1],[1,0],[0,1],[-1,0]])queue.push({x:p.x+dx,y:p.y+dy});}
    const minX=Math.min(...cells.map(p=>p.x)),maxX=Math.max(...cells.map(p=>p.x)),minY=Math.min(...cells.map(p=>p.y)),maxY=Math.max(...cells.map(p=>p.y));
    const w=(maxX-minX+1)*tile,h=(maxY-minY+1)*tile;
    if(area==='camp') c.drawImage(scene.textures.get('tent').getSourceImage() as HTMLCanvasElement,ox+minX*tile,oy+minY*tile,w,h);
    else {
      const basilica=area==='veyr'&&w>=120,textureName=basilica?'site-basilica':(minX+minY)%3===0?'site-inn':(minX+minY)%3===1?'site-shop':'site-house';
      const image=scene.textures.get(textureName).getSourceImage() as HTMLCanvasElement;
      c.drawImage(image,ox+minX*tile-3,oy+minY*tile-12,w+6,h+14);
    }
  }
  if(area==='camp') for(const[x,y]of[[8,8],[20,10],[26,13]]){box(c,'#705a42',ox+x*tile,oy+y*tile+4,24,11);box(c,'#c3a578',ox+x*tile,oy+y*tile+4,24,2);}
  if(indoor) for(let y=1;y<map.height-1;y+=4)for(let x=2;x<map.width-1;x+=6)if(at(x,y)==='#'){
    box(c,'#aa976a',ox+x*tile+5,oy+y*tile,4,25);box(c,'#e5ca8d',ox+x*tile+3,oy+y*tile+13,8,5);
  }
  if(area==='dunmere'||area==='veyr') {
    const cx=area==='veyr'?16:15,cy=area==='veyr'?11:9;
    if(['s','f'].includes(at(cx,cy))) {box(c,'#4f6f7b',ox+cx*tile-10,oy+cy*tile+4,49,17);box(c,'#d9d4b6',ox+cx*tile-8,oy+cy*tile,45,4);box(c,'#a3c6c5',ox+cx*tile-3,oy+cy*tile+6,35,7);}
  }
  texture.refresh(); return { key, tile, ox, oy, width, height, scenery };
}

export function paintBattle(scene: Phaser.Scene, region = 'R01') {
  const key = `battle-${region}`;
  canvas(scene, key, 960, 576, c => {
    const marsh=/R03|fen|granary/i.test(region),forest=/R04|orchard/i.test(region),coast=/R02|dunmere|toll/i.test(region),capital=/R06|veyr|heart/i.test(region),crown=/R05|crown/i.test(region);
    box(c,capital?'#26304e':forest?'#303b44':marsh?'#294c51':coast?'#4b7183':'#324e60',0,0,960,576);
    const rand=noise(region.length*53+region.charCodeAt(region.length-1));
    if(marsh||forest||coast) {
      box(c,coast?'#7399a0':'#697e74',0,148,960,160);
      for(let i=0;i<17;i++) {
        const x=i*66-35,h=70+Math.floor(rand()*100);
        if(coast){box(c,'#a6b4a6',x,200-h/3,47,h);box(c,'#d2cbb0',x+3,198-h/3,39,5);box(c,'#607982',x+11,220-h/3,13,17);}
        else {box(c,forest?'#3d3541':'#354e4e',x+24,140,13,169);for(let j=0;j<5;j++)box(c,forest?'#66634d':'#486b59',x-j*5,70+j*19,65+j*10,26);}
      }
      if(marsh||coast) {box(c,coast?'#4f8190':'#315b60',0,276,960,69);for(let i=0;i<60;i++)box(c,'#b2c8b04a',Math.floor(rand()*960),280+Math.floor(rand()*59),15+Math.floor(rand()*28),1);}
    } else {
      for(let y=0;y<295;y+=34)for(let x=0;x<960;x+=68){box(c,capital?'#46516a':'#4d666b',x+(y%68?34:0),y,66,32);box(c,'#263c50',x,y+32,68,2);}
      for(const x of[28,190,490,796,925]) {box(c,'#233849',x-8,0,40,300);box(c,capital?'#a4b3b7':'#87988b',x,0,23,292);box(c,'#c6b489',x+3,0,3,288);box(c,'#b1b89b',x-5,280,35,15);}
      if(capital){for(const x of[90,365,637]){box(c,'#1b3049',x,39,68,144);box(c,'#829cba',x+7,46,54,130);box(c,'#c7c0a4',x+29,46,8,130);box(c,'#d2c995',x+8,100,53,6);}}
      else {box(c,'#b7a06c',305,24,12,42);for(let i=0;i<11;i++)box(c,i%2?'#a59265':'#c0a772',282-i*5,64+i*10,58+i*10,10);box(c,'#d2bc81',226,174,172,11);}
    }
    box(c,forest?'#6a6c50':marsh?'#5e7563':coast?'#aaa58a':capital?'#788698':'#7f8d81',0,340,960,236);
    for(let y=342;y<576;y+=34)for(let x=0;x<960;x+=67){if(!(marsh||forest))box(c,capital?'#68798b':'#697e77',x+(y%68?33:0),y,65,32);else for(let i=0;i<3;i++)box(c,forest?'#a7946977':'#a0aa7b77',x+Math.floor(rand()*59),y+Math.floor(rand()*29),3,2);}
    box(c,'#1c3946',0,338,960,3);
    if(crown)for(const x of[20,460,900]){box(c,'#b5bfa9',x,270,38,66);box(c,'#d9d2ac',x-4,269,46,7);}
    const shade=c.createLinearGradient(0,370,0,576);shade.addColorStop(0,'#152d3a00');shade.addColorStop(1,'#10233d77');c.fillStyle=shade;c.fillRect(0,370,960,206);
  });
  return key;
}
