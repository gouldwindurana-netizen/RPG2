import type { CharacterProfile, Hero, HeroId, Item, JobId, Spell } from './contracts';

export interface JobDefinition {
  id: JobId; name: string; tagline: string; description: string; trait: string;
  ratings: { vitality: number; attack: number; magic: number };
  starterSourceHero: HeroId; spellIds: string[];
}
export const JOBS: JobDefinition[] = [
  { id:'warden', name:'Warden', tagline:'Stand between danger and the party.', description:'Heavy armor and dependable swordplay. A forgiving lead for the first expedition.', trait:'Bulwark: Guard reduces incoming damage by 65%.', ratings:{vitality:5,attack:4,magic:1},starterSourceHero:'Mara',spellIds:[] },
  { id:'striker', name:'Striker', tagline:'A flurry of precise, close-range blows.', description:'An accurate martial specialist who gains multiple hits early. Trades armor for pressure.',trait:'Combination: one extra physical hit, up to four.',ratings:{vitality:4,attack:5,magic:1},starterSourceHero:'Tavin',spellIds:[] },
  { id:'scout', name:'Scout', tagline:'Read the road. Stay one step ahead.',description:'A light-armored trailfinder with strong accuracy and an instinct for slipping past danger.',trait:'Quickstep: 15% chance to evade an enemy strike.',ratings:{vitality:3,attack:4,magic:1},starterSourceHero:'Tavin',spellIds:[] },
  { id:'mender', name:'Mender',tagline:'Keep a promise. Keep someone standing.',description:'Recovery and protective magic, backed by a full pool of spell charges. Iona can share the healing duty.',trait:'Gentle hands: healing spells restore 20% more HP.',ratings:{vitality:3,attack:2,magic:5},starterSourceHero:'Iona',spellIds:['mend','shelter','renew','cleanse','kindle','revive','haven','sanctuary','rebirth','daybreak'] },
  { id:'arcanist',name:'Arcanist',tagline:'Find the weakness in every defense.',description:'Elemental spells and a full charge pool. Powerful against armor, but needs protection.',trait:'Elemental lore: weakness damage is 1.65× instead of 1.5×.',ratings:{vitality:2,attack:2,magic:5},starterSourceHero:'Soren',spellIds:['ember','spark','frost','wave','flare','blizzard','tempest','inferno','starfall','aurora'] },
  { id:'spellblade',name:'Spellblade',tagline:'Steel in one hand. A spark in the other.',description:'A versatile swordfighter with limited healing and fire magic. Fewer charges than a specialist.',trait:'Versatile training: Mend and Ember, with up to four casts per tier.',ratings:{vitality:4,attack:3,magic:3},starterSourceHero:'Mara',spellIds:['mend','ember'] },
];

export const PALETTES = {
  skin:{light:'#efcba9',warm:'#d5ad89',brown:'#a87855',deep:'#79513d'},
  hair:{chestnut:'#684535',black:'#292c35',silver:'#c4c5c0',copper:'#a9633e'},
  cloak:{gold:'#c79e57',teal:'#5a9c91',plum:'#9b759f',blue:'#668db5'},
};
export const DEFAULT_PROFILE: CharacterProfile = {name:'Ari',job:'warden',pronouns:'she',skin:'warm',hair:'chestnut',cloak:'gold',hairStyle:'short'};
export const LEGACY_PROFILE: CharacterProfile = {...DEFAULT_PROFILE,name:'Mara'};
export function normalizeProfile(value: unknown): CharacterProfile | null {
  if(!value || typeof value!=='object' || Array.isArray(value))return null;
  const v=value as Record<string,unknown>;
  if(typeof v.name!=='string')return null;
  const name=v.name.normalize('NFC').trim().replace(/ +/g,' ');
  if(!name || [...name].length>14 || !/[\p{L}\p{N}]/u.test(name) || !/^[\p{L}\p{M}\p{N} '\u2019-]+$/u.test(name))return null;
  if(!JOBS.some(j=>j.id===v.job)||typeof v.pronouns!=='string'||!['she','he','they'].includes(v.pronouns)||typeof v.hairStyle!=='string'||!['short','long','tied'].includes(v.hairStyle))return null;
  if(typeof v.skin!=='string'||typeof v.hair!=='string'||typeof v.cloak!=='string'||!Object.hasOwn(PALETTES.skin,v.skin)||!Object.hasOwn(PALETTES.hair,v.hair)||!Object.hasOwn(PALETTES.cloak,v.cloak))return null;
  return {name,job:v.job as CharacterProfile['job'],pronouns:v.pronouns as CharacterProfile['pronouns'],skin:v.skin as CharacterProfile['skin'],hair:v.hair as CharacterProfile['hair'],cloak:v.cloak as CharacterProfile['cloak'],hairStyle:v.hairStyle as CharacterProfile['hairStyle']};
}
export const jobFor = (job: JobId) => JOBS.find(j=>j.id===job)!;
export function canCast(hero: Hero, spell: Spell): boolean {return jobFor(hero.job).spellIds.includes(spell.id);}
export function isEquipmentAllowed(hero: Pick<Hero,'job'>,item: Item): boolean {
  return item.kind==='equipment' && Boolean(item.users?.includes(jobFor(hero.job).starterSourceHero));
}
export interface IntroStep {speaker:string;role:string;text:string;portrait:HeroId|'narrator'|'bessa';focus:HeroId|'camp';}
export function getIntroSteps(profile: CharacterProfile): IntroStep[] {
  const job=jobFor(profile.job), possessive={she:'her',he:'his',they:'their'}[profile.pronouns];
  const histories:Record<JobId,string>={warden:'left a convoy commission after refusing an order',striker:'earned a living protecting travelers on unguarded roads',scout:'learned to read paths the official maps have forgotten',mender:'followed the road from one crowded hospice to another',arcanist:'came to Merewatch to understand its failing protection',spellblade:'kept caravan lanterns lit with a little magic and a steady blade'};
  return [
    {speaker:'The Road Beyond the Bells',role:'Prologue · Avel',text:'At dusk, the bells keep the night fog outside the walls. Between towns, the road belongs to the Hush. Tonight, one bell has stopped ringing.',portrait:'narrator',focus:'camp'},
    {speaker:profile.name,role:`Your story · ${job.name}`,text:`${profile.name} ${histories[profile.job]}. Now ${possessive} journey has brought a simple request: find the missing workers beneath Merewatch.`,portrait:'Mara',focus:'Mara'},
    {speaker:profile.name,role:job.name,text:'A bell can be repaired. People cannot be replaced. Before we go below, I want to know who is coming with me.',portrait:'Mara',focus:'Mara'},
    {speaker:'Tavin',role:'Striker · The courier',text:`Tavin. I know a shortcut, three bad songs, and which bridges still hold. My sister followed this road. If the workers saw her, I need to hear it.`,portrait:'Tavin',focus:'Tavin'},
    {speaker:'Iona',role:'Mender · The healer',text:'I’m Iona. I run the roadside hospice. I will keep us standing, but my spell charges will not last forever. We return to the watchfire before brave becomes foolish.',portrait:'Iona',focus:'Iona'},
    {speaker:'Soren',role:'Arcanist · The engineer',text:'Soren. I helped design part of the bell’s regulator. The machinery should be safe to inspect. If it is not… then I should be the one to see why.',portrait:'Soren',focus:'Soren'},
    {speaker:'Bessa',role:'Keeper of Reedbank',text:`Four travelers, then. ${profile.name}, bring them back with you. Speak to me at the watchfire when you are ready, and I will mark the way into Merewatch.`,portrait:'bessa',focus:'camp'},
    {speaker:'The First Watch',role:'Chapter I · The Silent Watch',text:'A courier, a healer, an engineer—and you. The party gathers beside the last light of day. Your first journey begins at Reedbank.',portrait:'narrator',focus:'camp'},
  ];
}
