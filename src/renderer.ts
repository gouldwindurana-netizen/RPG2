import Phaser from 'phaser';
import type { Direction, Enemy, GameMap, GameState, Hero, MapEntity } from './contracts';
import { createArt, ensureLeadArt, paintBattle, paintWorld, textureForEntity } from './art';
import { getIntroSteps } from './characters';

type Point = { x: number; y: number };
type ActorView = { image: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; bar: Phaser.GameObjects.Graphics; baseX: number; baseY: number };

const DIRECTIONS: [Direction, number, number][] = [['up', 0, -1], ['right', 1, 0], ['down', 0, 1], ['left', -1, 0]];
const WALKABLE = new Set(['g', 'd', 's', 'f', 'b']);
const distance = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** The renderer reads state and emits input; it never resolves game rules. */
export class GameRenderer {
  private game: Phaser.Game;
  private scene: WorldScene;
  private resizeObserver: ResizeObserver;

  constructor(parent: HTMLElement, getState: () => GameState, getMap: () => GameMap,
    onMove: (direction: Direction) => void, onInteract: (entityId?: string) => void) {
    this.scene = new WorldScene(getState, getMap, onMove, onInteract);
    this.game = new Phaser.Game({
      type: Phaser.CANVAS, parent, width: 960, height: 576,
      backgroundColor: '#1b3033', pixelArt: true, roundPixels: true,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      render: { antialias: false, pixelArt: true },
      scene: [this.scene], audio: { noAudio: true },
      banner: false,
    });
    this.resizeObserver = new ResizeObserver(() => this.game.scale.refresh());
    this.resizeObserver.observe(parent);
  }

  refresh() { this.scene.refreshView(); }
  viewport() { return this.scene.viewport(); }
  destroy() { this.resizeObserver.disconnect(); this.game.destroy(true); }
}

class WorldScene extends Phaser.Scene {
  private ready = false;
  private visualMode = '';
  private area = '';
  private tile = 30;
  private ox = 0;
  private oy = 18;
  private background!: Phaser.GameObjects.Image;
  private scenery: Phaser.GameObjects.Image[] = [];
  private worldWidth = 960;
  private worldHeight = 576;
  private cameraArea = '';
  private sprites = new Map<string, Phaser.GameObjects.Image>();
  private labels = new Map<string, Phaser.GameObjects.Text>();
  private actors = new Map<string, ActorView>();
  private player!: Phaser.GameObjects.Image;
  private playerHalo!: Phaser.GameObjects.Ellipse;
  private followers: Phaser.GameObjects.Image[] = [];
  private trail: Point[] = [];
  private lastPlayer = '';
  private regionLabel!: Phaser.GameObjects.Text;
  private hintLabel!: Phaser.GameObjects.Text;
  private pathDots!: Phaser.GameObjects.Graphics;
  private atmosphere!: Phaser.GameObjects.Graphics;
  private spotlight!: Phaser.GameObjects.Graphics;
  private keys: Record<string, Phaser.Input.Keyboard.Key> = {};
  private lastMove = 0;
  private path: Point[] = [];
  private pathTarget: string | undefined;
  private cueKey = '';
  private effects: Phaser.GameObjects.Text[] = [];
  private flashes: Phaser.GameObjects.Graphics[] = [];
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(private readState: () => GameState, private readMap: () => GameMap,
    private onMove: (direction: Direction) => void, private onInteract: (id?: string) => void) {
    super('avel-world');
  }

  create() {
    createArt(this); paintBattle(this);
    this.background = this.add.image(0, 0, 'tile-g').setOrigin(0);
    this.pathDots = this.add.graphics().setDepth(20);
    this.atmosphere = this.add.graphics().setDepth(200).setScrollFactor(0).setBlendMode(Phaser.BlendModes.SCREEN);
    this.spotlight = this.add.graphics().setDepth(72);
    this.playerHalo = this.add.ellipse(0, 0, 25, 11, 0xe2c783, .23).setDepth(79);
    this.player = this.add.image(0, 0, 'hero-Mara').setOrigin(.5, 1).setDepth(80);
    this.followers = ['Tavin', 'Iona', 'Soren'].map((name, i) => this.add.image(0, 0, `hero-${name}`).setOrigin(.5, 1).setAlpha(.95).setDepth(75 - i));
    this.regionLabel = this.add.text(24, 20, '', { fontFamily: 'monospace', fontSize: '14px', color: '#eef2ec', backgroundColor: '#162d66ee', padding: { x: 12, y: 8 } }).setDepth(300).setScrollFactor(0);
    this.hintLabel = this.add.text(480, 546, '', { fontFamily: 'monospace', fontSize: '13px', color: '#f5efd2', backgroundColor: '#10295bea', padding: { x: 12, y: 7 }, align: 'center' }).setOrigin(.5, .5).setDepth(300).setScrollFactor(0);
    const keyboard = this.input.keyboard;
    if (keyboard) {
      this.keys = keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE,SHIFT', false) as Record<string, Phaser.Input.Keyboard.Key>;
      keyboard.on('keydown', (event: KeyboardEvent) => {
        if (this.inputBlocked()) return;
        if (document.activeElement?.matches('button') && (event.key === ' ' || event.key.toLowerCase() === 'e')) return;
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
        if ((event.key.toLowerCase() === 'e' || event.key === ' ') && !event.repeat) {
          this.path = []; this.pathTarget = undefined; this.onInteract();
        }
      });
    }
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.clickWorld(pointer));
    this.game.canvas.tabIndex = 0;
    this.game.canvas.setAttribute('aria-label', 'Reedbank exploration map. Move with arrow keys or W A S D, interact with E, or click a location.');
    this.ready = true;
    this.refreshView();
  }

  private inputBlocked() {
    const state = this.readState();
    if (state.mode !== 'explore' || state.message || state.reward) return true;
    const active = document.activeElement;
    if (active && active !== this.game.canvas && active.matches('input, textarea, select, [contenteditable="true"]')) return true;
    return [...document.querySelectorAll<HTMLElement>('[aria-modal="true"]')].some(el => !el.hidden && getComputedStyle(el).display !== 'none');
  }

  private clearActors() {
    for (const view of this.actors.values()) { view.image.destroy(); view.label.destroy(); view.bar.destroy(); }
    this.actors.clear();
  }

  private toScreen(p: Point) { return { x: this.ox + (p.x + .5) * this.tile, y: this.oy + (p.y + 1) * this.tile - 2 }; }

  viewport() {
    const camera = this.cameras?.main;
    return { area: this.area, tile: this.tile, ox: this.ox, oy: this.oy, scrollX: camera?.scrollX || 0,
      scrollY: camera?.scrollY || 0, zoom: camera?.zoom || 1, width: this.worldWidth, height: this.worldHeight };
  }

  refreshView() {
    if (!this.ready) return;
    const state = this.readState();
    const combat = Boolean(state.battle) && ['battle', 'victory', 'defeat'].includes(state.mode);
    const mode = combat ? 'battle' : 'explore';
    if (mode !== this.visualMode || (!combat && state.area !== this.area)) {
      this.visualMode = mode; this.area = state.area;
      this.path = []; this.pathTarget = undefined; this.lastPlayer = ''; this.trail = [];
      for (const sprite of this.sprites.values()) sprite.destroy();
      for (const label of this.labels.values()) label.destroy();
      this.sprites.clear(); this.labels.clear(); this.clearActors();
      this.scenery.forEach(image => image.destroy()); this.scenery = [];
      this.cueKey = ''; this.tweens.killAll();
      this.effects.forEach(effect => effect.destroy()); this.effects = [];
      this.flashes.forEach(effect => effect.destroy()); this.flashes = [];
      if (combat) {
        this.cameras.main.stopFollow().setBounds(0, 0, 960, 576).setZoom(1).setScroll(0, 0);
        this.cameraArea = '';
        this.background.setTexture(paintBattle(this, state.battle?.regionId || this.readMap().regionId || state.area));
      } else {
        const world = paintWorld(this, this.readMap(), state.area);
        this.tile = world.tile; this.ox = world.ox; this.oy = world.oy;
        this.worldWidth = world.width; this.worldHeight = world.height;
        this.cameras.main.stopFollow().setBounds(0, 0, world.width, world.height).setZoom(1).setScroll(0, 0);
        this.cameraArea = '';
        this.background.setTexture(world.key);
        this.scenery = world.scenery.map(prop => this.add.image(prop.x, prop.y, prop.texture).setOrigin(.5, 1).setScale(prop.scale).setDepth(50 + prop.row));
      }
    }
    this.player.setVisible(!combat); this.playerHalo.setVisible(!combat);
    this.player.setTexture(ensureLeadArt(this, state.profile, state.player.facing === 'up' && !combat));
    this.followers.forEach((s, i) => s.setVisible(!combat && this.trail.length > i + 1));
    if (combat) this.refreshBattle(state); else this.refreshWorld(state);
  }

  private refreshWorld(state: GameState) {
    const intro = state.mode === 'intro' ? getIntroSteps(state.profile)[state.introStep] : undefined;
    const map = this.readMap();
    this.regionLabel.setText(intro ? `PROLOGUE  /  ${intro.speaker}` : `${(map.name || state.area).toUpperCase()}${map.safe ? '  /  SANCTUARY' : state.area === 'overworld' ? '  /  THE SIX REACHES' : ''}`);
    this.game.canvas.setAttribute('aria-label', `${map.name || state.area} exploration map. Move with arrow keys or W A S D, interact with E, hold Shift to walk quickly, or click a location.`);
    const present = new Set(map.entities.map(e => e.id));
    for (const [id, image] of this.sprites) if (!present.has(id)) {
      image.destroy(); this.sprites.delete(id); this.labels.get(id)?.destroy(); this.labels.delete(id);
    }
    for (const entity of map.entities) {
      const p = this.toScreen(entity);
      let sprite = this.sprites.get(entity.id);
      if (!sprite) {
        let texture = textureForEntity(`${entity.sprite} ${entity.name}${entity.kind === 'exit' && state.area === 'overworld' ? ` ${entity.destination || ''}` : ''}`, entity.kind);
        if (entity.name.startsWith('Ashen ') && this.textures.exists(`${texture}-ashen`)) texture += '-ashen';
        if (entity.name.startsWith('Crested ') && this.textures.exists(`${texture}-crested`)) texture += '-crested';
        sprite = this.add.image(p.x, p.y, texture).setOrigin(.5, 1);
        this.sprites.set(entity.id, sprite);
        const suffix = entity.kind === 'rare' ? ' ◇' : entity.kind === 'enemy' ? ' •' : '';
        const label = this.add.text(p.x, p.y - 44, entity.name + suffix,
          { fontFamily: 'monospace', fontSize: '10px', color: entity.kind === 'rare' ? '#f3d88c' : '#e0debf', backgroundColor: '#172a30c9', padding: { x: 4, y: 3 } })
          .setOrigin(['ferry-fen', 'pass-orchard'].includes(entity.id) ? 1 : ['ferry-saltroad', 'pass-fen'].includes(entity.id) ? 0 : .5, 1).setDepth(110);
        this.labels.set(entity.id, label);
      }
      const isBoss = entity.kind === 'boss';
      const scale = isBoss ? .45 : entity.kind === 'enemy' || entity.kind === 'rare' ? .62 : entity.kind === 'exit' ? (state.area === 'overworld' ? .5 : .56) : .84;
      sprite.setPosition(p.x, p.y).setScale(scale).setDepth(50 + entity.y);
      this.labels.get(entity.id)?.setPosition(p.x, p.y - (isBoss ? 70 : 44));
      if (entity.kind === 'campfire') sprite.setTexture(`fire-${Math.floor(this.time.now / 280) % 2}`);
    }
    const playerKey = `${state.player.x},${state.player.y}`;
    if (playerKey !== this.lastPlayer) {
      this.trail.unshift({ x: state.player.x, y: state.player.y }); this.trail = this.trail.slice(0, 8);
      this.lastPlayer = playerKey;
      const pos = this.toScreen(state.player);
      this.tweens.killTweensOf(this.player);
      if (this.reducedMotion || this.trail.length < 2) this.player.setPosition(pos.x, pos.y);
      else this.tweens.add({ targets: this.player, x: pos.x, y: pos.y, duration: 100, ease: 'Linear' });
      this.playerHalo.setPosition(pos.x, pos.y - 2);
      this.player.setDepth(50 + state.player.y + .5); this.playerHalo.setDepth(49 + state.player.y);
      this.player.setFlipX(state.player.facing === 'left');
      this.followers.forEach((follower, i) => {
        const p = this.toScreen(this.trail[Math.min(i + 1, this.trail.length - 1)]);
        follower.setPosition(p.x, p.y).setScale(.84).setDepth(50 + this.trail[Math.min(i + 1, this.trail.length - 1)].y + .4);
        follower.setVisible(this.trail.length > i + 1);
      });
    }
    if (this.cameraArea !== state.area) {
      this.cameraArea = state.area;
      if (this.worldWidth > 960 || this.worldHeight > 576) {
        this.cameras.main.centerOn(this.player.x, this.player.y).startFollow(this.player, true, 1, 1);
      } else this.cameras.main.stopFollow().setScroll(0, 0);
    }
    this.player.setFlipX(state.player.facing === 'left');
    this.spotlight.clear();
    if (intro) {
      const positions = [{x:14,y:11},{x:13,y:13},{x:15,y:13}];
      this.followers.forEach((follower,i)=>{
        const p=this.toScreen(positions[i]);
        follower.setPosition(p.x,p.y).setScale(.84).setVisible(state.introStep>=i+3);
      });
      const index=['Tavin','Iona','Soren'].indexOf(intro.focus);
      const focus=index>=0?this.toScreen(positions[index]):this.toScreen(state.player);
      this.spotlight.fillStyle(0xe8c77e,.1).fillEllipse(focus.x,focus.y-8,58,24);
      this.spotlight.lineStyle(1,0xe8c77e,.5).strokeEllipse(focus.x,focus.y-5,35,14);
    } else {
      this.followers.forEach((follower,i)=>follower.setVisible(this.trail.length>i+1));
    }
    const nearest = map.entities.find(entity => distance(entity, state.player) <= 1);
    this.hintLabel.setText(nearest ? `[E] ${nearest.hint || nearest.name}` : 'WASD / ARROWS · E interact · SHIFT quick walk · click to travel');
    this.hintLabel.setVisible(state.mode==='explore' && !state.message && !state.reward);
    this.pathDots.clear();
    this.pathDots.fillStyle(0xd6bd7c, .35);
    for (const point of this.path) { const p = this.toScreen(point); this.pathDots.fillRect(p.x - 2, p.y - 12, 4, 3); }
  }

  private refreshBattle(state: GameState) {
    const battle = state.battle!;
    this.spotlight.clear();
    this.regionLabel.setText(`${battle.kind === 'boss' ? 'BOSS ENCOUNTER' : battle.kind === 'rare' ? 'RARE HUNT ◇' : 'BATTLE'}  /  ROUND ${battle.round}`);
    this.hintLabel.setText(battle.phase === 'resolving' ? 'The round unfolds…' : 'Choose an action for each hero, then commit the round.').setVisible(true);
    this.pathDots.clear();
    const heroPositions = [[665, 310], [820, 325], [665, 450], [820, 465]];
    const enemyPositions = battle.enemies.length === 1 ? [[275, 397]] : [[207, 344], [339, 443], [370, 300], [128, 435]];
    const currentIds = new Set<string>();
    state.heroes.forEach((hero, i) => {
      currentIds.add(hero.id);
      this.actor(hero.id, hero, hero.id==='Mara'?ensureLeadArt(this,state.profile):`hero-${hero.id}`, heroPositions[i][0], heroPositions[i][1], 2.2, '#cdd8ca', true);
    });
    battle.enemies.forEach((enemy, i) => {
      currentIds.add(enemy.id);
      const pos = enemyPositions[i % enemyPositions.length];
      let texture = textureForEntity(`${enemy.family} ${enemy.name} ${enemy.id}`, enemy.rank === 'boss' ? 'boss' : enemy.rank === 'rare' ? 'rare' : 'enemy');
      if (battle.enemies.length > 1 && /choir/i.test(enemy.name)) texture = 'enemy-cantor';
      if (['ashen', 'crested'].includes(enemy.rank) && this.textures.exists(`${texture}-${enemy.rank}`)) texture += `-${enemy.rank}`;
      const image = this.textures.get(texture).getSourceImage();
      const scale = enemy.rank === 'boss' && battle.enemies.length === 1 ? 1.35 : Math.min(enemy.rank === 'rare' ? 2.15 : 1.7, 145 / image.height);
      this.actor(enemy.id, enemy, texture, pos[0], pos[1], scale, '#ead7b2', false);
      if (enemy.hp>0 && enemy.intent.startsWith('HEAVY') && battle.phase==='planning') {
        this.spotlight.fillStyle(0xd7ad64,.12).fillEllipse(pos[0],pos[1]-4,135,35);
        this.spotlight.lineStyle(2,0xe4c680,.5).strokeEllipse(pos[0],pos[1]-4,135,35);
      }
    });
    for (const [id, view] of this.actors) if (!currentIds.has(id)) { view.image.destroy(); view.label.destroy(); view.bar.destroy(); this.actors.delete(id); }
    const cue = battle.cue;
    const key = cue ? `${battle.round}:${battle.log.length}:${JSON.stringify(cue)}` : '';
    if (cue && key !== this.cueKey) {
      this.cueKey = key;
      const actor = this.actors.get(cue.actor), target = this.actors.get(cue.target);
      if (actor && !this.reducedMotion) {
        this.tweens.add({ targets: actor.image, x: actor.baseX + (state.heroes.some(h => h.id === cue.actor) ? -14 : 14), duration: 85, yoyo: true });
      }
      if (target) {
        const color = cue.kind === 'heal' ? '#bce0a9' : cue.kind === 'guard' ? '#d8c793' : '#ffe6b1';
        const word = cue.kind === 'guard' ? 'GUARD' : cue.amount ? `${cue.kind === 'heal' ? '+' : '−'}${cue.amount}` : cue.kind === 'spell' ? 'MAGIC' : 'MISS';
        const text = this.add.text(target.baseX, target.baseY - 90, word, { fontFamily: 'monospace', fontSize: '25px', color, stroke: '#162b30', strokeThickness: 5, fontStyle: 'bold' }).setOrigin(.5).setDepth(400);
        this.effects.push(text);
        this.tweens.add({ targets: text, y: text.y - (this.reducedMotion ? 0 : 34), alpha: 0, delay: 160, duration: 550, onComplete: () => { text.destroy(); this.effects = this.effects.filter(effect => effect !== text); } });
        this.castEffect(cue.kind,target,actor,battle.log.at(-1)||'');
        if (!this.reducedMotion && cue.kind !== 'guard') {
          target.image.setTint(cue.kind === 'heal' ? 0xb1e4ac : 0xffe1af);
          this.time.delayedCall(140, () => { if (target.image.active) target.image.clearTint(); });
        }
      }
    }
  }

  private castEffect(kind: 'hit'|'heal'|'guard'|'spell',target:ActorView,actor:ActorView|undefined,line:string) {
    const g=this.add.graphics().setDepth(240);this.flashes.push(g);
    const x=target.baseX,y=target.baseY-35;
    if(kind==='guard') {
      g.lineStyle(3,0xe7cb8a,.8).strokeEllipse(x,y,48,76);
      g.lineStyle(1,0xffe4a5,.6).strokeEllipse(x,y,57,85);
    } else if(kind==='heal') {
      g.lineStyle(2,0xa9d6a4,.8).strokeEllipse(x,y+25,70,21);
      for(let i=0;i<5;i++){g.fillStyle(0xbfe4b3,.8).fillRect(x-28+i*13,y-(i%3)*12,3,3);}
    } else if(kind==='spell') {
      const lower=line.toLowerCase();
      if(lower.includes('spark')||lower.includes('storm')) {
        g.lineStyle(4,0x89c9e2,.65);g.beginPath();g.moveTo(x+17,y-70);g.lineTo(x-9,y-21);g.lineTo(x+11,y-25);g.lineTo(x-13,y+30);g.strokePath();
        g.lineStyle(1,0xf4f0ce,.95);g.beginPath();g.moveTo(x+17,y-70);g.lineTo(x-9,y-21);g.lineTo(x+11,y-25);g.lineTo(x-13,y+30);g.strokePath();
      } else if(lower.includes('frost')) {
        for(let i=0;i<4;i++) { const px=x-27+i*18,py=y+(i%2)*16;g.fillStyle(0xb7dae3,.7).fillTriangle(px,py-28,px-8,py+7,px+8,py+7); }
      } else {
        for(let i=0;i<4;i++){const px=x-23+i*15,py=y+(i%2)*11;g.fillStyle(0xeab86d,.65).fillTriangle(px,py-27,px-11,py+18,px+11,py+18);g.fillStyle(0xffdda2,.8).fillRect(px-3,py-5,6,17);}
      }
    } else {
      g.lineStyle(2,0xf0d19b,.75);g.beginPath();g.moveTo(x-19,y+14);g.lineTo(x+21,y-18);g.strokePath();
      if(actor && !this.reducedMotion && line.includes('heavy'))this.cameras.main.shake(110,.002);
    }
    this.tweens.add({targets:g,alpha:0,duration:this.reducedMotion?170:390,onComplete:()=>{g.destroy();this.flashes=this.flashes.filter(f=>f!==g);}});
  }

  private actor(id: string, stats: Hero | Enemy, texture: string, x: number, y: number, scale: number, color: string, hero: boolean) {
    let view = this.actors.get(id);
    if (!view) {
      view = {
        image: this.add.image(x, y, texture).setOrigin(.5, 1).setScale(scale).setDepth(60 + y / 10),
        label: this.add.text(x, y + 12, '', { fontFamily: 'monospace', fontSize: '14px', color, align: 'center', stroke: '#16292f', strokeThickness: 4 }).setOrigin(.5, 0).setDepth(180),
        bar: this.add.graphics().setDepth(175), baseX: x, baseY: y,
      };
      this.actors.set(id, view);
    }
    const alive = stats.hp > 0;
    if(view.image.texture.key!==texture)view.image.setTexture(texture);
    view.image.setAlpha(alive ? 1 : .24).setFlipX(hero);
    const name = hero ? (stats as Hero).name : (stats as Enemy).name;
    const rank = !hero && (stats as Enemy).rank !== 'base' ? ` ${((stats as Enemy).rank === 'rare') ? '◇' : (stats as Enemy).rank === 'boss' ? '◆' : '▲'}` : '';
    view.label.setText(`${name}${rank}${stats.status ? ` · ${stats.status}` : ''}\n${stats.hp} / ${stats.maxHp}`).setAlpha(alive ? 1 : .5);
    view.bar.clear().fillStyle(0x10242a, .95).fillRect(x - 47, y + 49, 94, 7);
    view.bar.fillStyle(hero ? 0x8db89c : 0xc8a16a).fillRect(x - 46, y + 50, Math.max(0, 92 * stats.hp / stats.maxHp), 5);
  }

  private clickWorld(pointer: Phaser.Input.Pointer) {
    this.game.canvas.focus({ preventScroll: true });
    if (this.inputBlocked()) return;
    const map = this.readMap(), state = this.readState();
    pointer.updateWorldPoint(this.cameras.main);
    const target = { x: Math.floor((pointer.worldX - this.ox) / this.tile), y: Math.floor((pointer.worldY - this.oy) / this.tile) };
    if (target.x < 0 || target.y < 0 || target.x >= map.width || target.y >= map.height) return;
    const entity = map.entities.find(e => e.x === target.x && e.y === target.y);
    if (entity && distance(entity, state.player) <= 1) { this.onInteract(entity.id); return; }
    const candidates = entity ? DIRECTIONS.map(([, x, y]) => ({ x: target.x + x, y: target.y + y })) : [target];
    const route = this.route(state.player, candidates, map);
    this.path = route || [];
    this.pathTarget = route ? entity?.id : undefined;
    this.refreshView();
  }

  private route(start: Point, goals: Point[], map: GameMap): Point[] | null {
    const key = (p: Point) => `${p.x},${p.y}`;
    const goalsSet = new Set(goals.map(key)), queue = [start], previous = new Map<string, Point | null>([[key(start), null]]);
    let end: Point | undefined;
    while (queue.length) {
      const point = queue.shift()!;
      if (goalsSet.has(key(point))) { end = point; break; }
      for (const [, dx, dy] of DIRECTIONS) {
        const next = { x: point.x + dx, y: point.y + dy };
        if (previous.has(key(next)) || !WALKABLE.has(map.tiles[next.y]?.[next.x])) continue;
        if (map.entities.some(e => e.x === next.x && e.y === next.y)) continue;
        previous.set(key(next), point); queue.push(next);
      }
    }
    if (!end) return null;
    const path: Point[] = [];
    for (let point: Point | null = end; point && key(point) !== key(start); point = previous.get(key(point)) || null) path.unshift(point);
    return path;
  }

  update(time: number) {
    if (!this.ready) return;
    const state = this.readState();
    this.atmosphere.clear();
    if (!this.reducedMotion) {
      this.atmosphere.fillStyle(0xc7d6b7, .035);
      for (let i = 0; i < 4; i++) {
        const x = ((time * .008 + i * 276) % 1260) - 150;
        this.atmosphere.fillEllipse(x, 90 + i * 115, 250, 22);
      }
    }
    if (this.visualMode === 'explore') {
      for (const entity of this.readMap().entities) if (entity.kind === 'campfire') this.sprites.get(entity.id)?.setTexture(`fire-${Math.floor(time / 280) % 2}`);
      const walking=!this.reducedMotion && this.tweens.isTweening(this.player);
      this.player.setOrigin(.5,walking?1+Math.sin(time*.055)*.025:1);
    }
    if (this.inputBlocked()) { this.path = []; this.pathTarget = undefined; return; }
    const dir = this.keys.W?.isDown || this.keys.UP?.isDown ? 'up' : this.keys.S?.isDown || this.keys.DOWN?.isDown ? 'down'
      : this.keys.A?.isDown || this.keys.LEFT?.isDown ? 'left' : this.keys.D?.isDown || this.keys.RIGHT?.isDown ? 'right' : null;
    const cadence=this.keys.SHIFT?.isDown?85:145;
    if (time - this.lastMove < cadence) return;
    if (dir) { this.path = []; this.pathTarget = undefined; this.lastMove = time; this.onMove(dir); return; }
    if (this.path.length) {
      const point = this.path.shift()!;
      const direction = DIRECTIONS.find(([, dx, dy]) => state.player.x + dx === point.x && state.player.y + dy === point.y)?.[0];
      if (!direction) { this.path = []; return; }
      this.lastMove = time; this.onMove(direction); this.refreshView();
      if (this.readState().player.x !== point.x || this.readState().player.y !== point.y) { this.path = []; this.pathTarget = undefined; }
    } else if (this.pathTarget) {
      const target = this.pathTarget; this.pathTarget = undefined; this.onInteract(target);
    }
  }
}
