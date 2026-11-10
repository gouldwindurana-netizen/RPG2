import type { CharacterProfile, HeroId } from './contracts';
import { PALETTES } from './characters';

type Rect = { color: string; x: number; y: number; w: number; h: number };
const JOBS = new Set(['warden', 'striker', 'scout', 'mender', 'arcanist', 'spellblade']);
const STYLES = new Set(['short', 'long', 'tied']);

function color<K extends keyof typeof PALETTES>(group: K, key: string, fallback: keyof (typeof PALETTES)[K]): string {
  const palette = PALETTES[group] as Record<string, string>;
  return Object.hasOwn(palette, key) ? palette[key] : palette[String(fallback)];
}

function shade(hex: string, multiplier: number): string {
  const values = hex.slice(1).match(/../g)!.map(v => Math.min(255, Math.max(0, Math.round(parseInt(v, 16) * multiplier))));
  return '#' + values.map(v => v.toString(16).padStart(2, '0')).join('');
}

/** One pixel drawing powers both the creator portrait and the in-world sprite. */
function rectangles(profile: CharacterProfile): Rect[] {
  const skin = color('skin', String(profile?.skin), 'warm');
  const hair = color('hair', String(profile?.hair), 'chestnut');
  const cloth = color('cloak', String(profile?.cloak), 'gold');
  const job = JOBS.has(profile?.job) ? profile.job : 'warden';
  const style = STYLES.has(profile?.hairStyle) ? profile.hairStyle : 'short';
  const darkCloth = shade(cloth, .63), brightCloth = shade(cloth, 1.17);
  const skinShadow = shade(skin, .73), ink = '#17252d', silver = '#c5cfc5', brass = '#d8bb78';
  const r: Rect[] = [];
  const box = (c: string, x: number, y: number, w: number, h: number) => r.push({color:c,x,y,w,h});

  // Quiet ground shadow, boots, cloak, and hands retain a clear one-tile anchor.
  box('#13262a88', 5, 36, 23, 3);
  box(ink, 9, 29, 6, 9); box(ink, 19, 29, 6, 9);
  box('#6c5945', 8, 35, 8, 3); box('#6c5945', 18, 35, 8, 3);
  if (style === 'long') { box(shade(hair,.68), 7, 7, 20, 20); box(hair, 8, 9, 4, 17); box(hair, 23, 9, 4, 17); }
  if (style === 'tied') { box(shade(hair,.7), 23, 9, 5, 15); box(hair, 24, 10, 4, 11); box(brass, 24, 11, 4, 2); }
  box(ink, 6, 19, 21, 14); box(darkCloth, 7, 20, 20, 12);
  box(cloth, 9, 18, 16, 14); box(brightCloth, 10, 19, 4, 11);
  box(cloth, 3, 20, 6, 11); box(darkCloth, 25, 20, 4, 11);
  box(skin, 4, 29, 4, 4); box(skinShadow, 25, 29, 4, 4);
  box('#4b4a3d', 8, 29, 18, 3); box(brass, 15, 29, 4, 3);
  box(skinShadow, 13, 16, 8, 5); box(skin, 14, 17, 6, 4);

  // Hair and face stay readable in every palette, with a fixed dark outline.
  box(ink, 8, 5, 18, 13); box(skinShadow, 10, 7, 14, 12);
  box(skin, 10, 8, 13, 10); box(shade(skin,1.08), 11, 10, 9, 5);
  box(hair, 9, 4, 16, 6); box(shade(hair,1.18), 11, 4, 10, 2);
  if (style === 'short') { box(hair, 8, 8, 4, 5); box(hair, 22, 8, 3, 3); }
  if (style === 'long') { box(hair, 8, 7, 4, 12); box(hair, 22, 7, 4, 12); }
  if (style === 'tied') { box(hair, 8, 7, 4, 8); box(hair, 21, 7, 4, 4); }
  box(ink, 13, 12, 2, 2); box(ink, 20, 12, 2, 2);
  box(skinShadow, 18, 14, 2, 2); box(shade(skin,.65), 15, 17, 5, 1);

  if (job === 'warden') {
    box('#657e7c', 7, 19, 6, 7); box(silver, 8, 19, 5, 3);
    box('#657e7c', 23, 19, 5, 7); box(silver, 23, 19, 5, 3);
    box(ink, 24, 23, 8, 11); box('#8ba5a0', 25, 23, 6, 10);
    box(brass, 27, 25, 2, 7); box(brass, 25, 27, 6, 2);
    box('#a6b6ab', 11, 7, 13, 2);
  } else if (job === 'striker') {
    box('#e5d2a5', 4, 25, 5, 6); box('#e5d2a5', 25, 25, 5, 6);
    box('#8f795a', 4, 27, 5, 1); box('#8f795a', 25, 27, 5, 1);
    box(brass, 10, 8, 14, 2); box(cloth, 6, 9, 4, 2);
    box('#e5d2a5', 15, 21, 6, 2);
  } else if (job === 'scout') {
    box(darkCloth, 7, 4, 3, 13); box(darkCloth, 24, 5, 3, 13);
    box(brightCloth, 8, 3, 17, 2); box('#48604e', 7, 4, 3, 2);
    box('#54644e', 10, 21, 3, 8); box('#7b674d', 12, 21, 2, 8);
    box(ink, 27, 20, 3, 13); box(silver, 28, 21, 2, 8); box(brass, 26, 29, 5, 2);
  } else if (job === 'mender') {
    box('#e7dec0', 7, 5, 3, 13); box('#e7dec0', 24, 6, 3, 12);
    box('#eee4c7', 8, 3, 18, 2); box('#e7dec0', 13, 21, 8, 3);
    box('#d8d0b0', 15, 23, 4, 6);
    box('#775b40', 29, 10, 2, 26); box(brass, 26, 8, 6, 5);
    box('#a6d6ab', 27, 6, 4, 6); box('#e5efbf', 28, 7, 2, 2);
  } else if (job === 'arcanist') {
    box(darkCloth, 12, 1, 4, 3); box(cloth, 11, 3, 8, 3);
    box(cloth, 9, 5, 13, 3); box(brightCloth, 7, 8, 20, 2);
    box(brass, 16, 6, 3, 2); box('#c9b4cf', 14, 21, 6, 7);
    box('#775b40', 29, 10, 2, 26); box('#818fc0', 26, 7, 6, 6);
    box('#d5d9ed', 27, 6, 4, 3); box('#c3b0d2', 28, 11, 2, 2);
  } else {
    box('#657a79', 8, 20, 5, 6); box(silver, 8, 20, 5, 2);
    box('#b6a1bd', 21, 21, 4, 5); box('#e7cc9d', 22, 22, 2, 2);
    box(ink, 28, 14, 3, 18); box(silver, 29, 15, 2, 14);
    box('#edf0df', 29, 14, 1, 10); box(brass, 26, 29, 6, 2);
    box('#755a43', 28, 31, 3, 4); box('#9ed2d4', 4, 27, 3, 3);
  }
  return r;
}

export function appearanceKey(profile: CharacterProfile): string {
  return [profile.job, profile.pronouns, profile.skin, profile.hair, profile.cloak, profile.hairStyle]
    .map(v => String(v).replace(/[^a-z]/g, '').slice(0, 16)).join('-');
}

export function portraitSvg(profile: CharacterProfile, size = 72): string {
  const dimension = Number.isFinite(size) ? Math.max(16, Math.min(512, Math.round(size))) : 72;
  return `<svg width="${dimension}" height="${Math.round(dimension * 1.25)}" viewBox="0 0 32 40" shape-rendering="crispEdges" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${rectangles(profile).map(r => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${r.color}"/>`).join('')}</svg>`;
}

export const COMPANION_PROFILES: Record<HeroId, CharacterProfile> = {
  Mara: {name:'Mara',job:'warden',pronouns:'she',skin:'warm',hair:'chestnut',cloak:'gold',hairStyle:'short'},
  Tavin: {name:'Tavin',job:'striker',pronouns:'he',skin:'warm',hair:'chestnut',cloak:'teal',hairStyle:'tied'},
  Iona: {name:'Iona',job:'mender',pronouns:'she',skin:'light',hair:'copper',cloak:'gold',hairStyle:'long'},
  Soren: {name:'Soren',job:'arcanist',pronouns:'he',skin:'warm',hair:'black',cloak:'blue',hairStyle:'short'},
};

export function companionPortraitSvg(heroId: HeroId, size = 36): string {
  return portraitSvg(COMPANION_PROFILES[heroId] ?? COMPANION_PROFILES.Mara, size);
}

export function paintCharacter(context: CanvasRenderingContext2D, profile: CharacterProfile): void {
  context.save();
  context.imageSmoothingEnabled = false;
  for (const r of rectangles(profile)) { context.fillStyle = r.color; context.fillRect(r.x, r.y, r.w, r.h); }
  context.restore();
}
