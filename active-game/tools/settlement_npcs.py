"""Optional, bounded town-citizen movement with authoritative interaction positions."""


def patch(source):
    labels = []

    def replace(old, new, label):
        nonlocal source
        assert source.count(old) == 1, (label, source.count(old))
        source = source.replace(old, new, 1)
        labels.append(label)

    replace('settings:{battleSpeed:1,encounters:`classic`}',
            'settings:{battleSpeed:1,encounters:`classic`,npcMovement:`wander`}',
            'new adventures offer wandering townspeople as a saved presentation setting')
    replace('c.settings={battleSpeed:1,encounters:`visible`}',
            'c.settings={battleSpeed:1,encounters:`visible`,npcMovement:`wander`}',
            'version-one journeys inherit the optional town movement setting')
    replace('c.settings={battleSpeed:n.settings.battleSpeed,encounters:n.settings.encounters}',
            'c.settings={battleSpeed:n.settings.battleSpeed,encounters:n.settings.encounters,npcMovement:n.settings.npcMovement===`still`?`still`:`wander`}',
            'older and malformed optional movement preferences normalize without resetting a valid save')

    replace('function k(){let e=he[a.area];return{...e,entities:e.entities.filter(e=>{',
            'function k(){let e=he[a.area];return townNpcMap({...e,entities:e.entities.filter(e=>{',
            'moving citizen coordinates are shared by map collision interaction and rendering')
    replace('return!0})}}function A(){',
            'return!0})})}' + NPC_ENGINE + 'function A(){',
            'keep bounded citizen movement ephemeral and independent of encounter randomness')

    old = 'configure(e){(e.battleSpeed===void 0||[1,2,3].includes(e.battleSpeed))&&(e.encounters===void 0||[`classic`,`visible`,`off`].includes(e.encounters))&&(e.battleSpeed!==void 0&&(a.settings.battleSpeed=e.battleSpeed),e.encounters!==void 0&&(a.settings.encounters=e.encounters,a.encounterSteps=0),l(),z.save())}'
    new = 'wanderStep(){return townNpcStep()},configure(e){(e.battleSpeed===void 0||[1,2,3].includes(e.battleSpeed))&&(e.encounters===void 0||[`classic`,`visible`,`off`].includes(e.encounters))&&(e.npcMovement===void 0||[`wander`,`still`].includes(e.npcMovement))&&(e.battleSpeed!==void 0&&(a.settings.battleSpeed=e.battleSpeed),e.encounters!==void 0&&(a.settings.encounters=e.encounters,a.encounterSteps=0),e.npcMovement!==void 0&&(a.settings.npcMovement=e.npcMovement),l(),z.save())}'
    replace(old, new, 'expose a guarded movement tick and save the validated Wander or Still preference')

    replace('constructor(e,t,n,r,i){this.scene=new it(t,n,r,i),',
            'constructor(e,t,n,r,i,a){this.scene=new it(t,n,r,i,a),',
            'connect the scene to the bounded engine movement callback')
    replace('readState;readMap;onMove;onInteract;ready=',
            'readState;readMap;onMove;onInteract;onNpcWander;lastNpcWander=0;ready=',
            'track the idle movement cadence without background timers')
    replace('constructor(e,t,n,r){super(`avel-world`),this.readState=e,this.readMap=t,this.onMove=n,this.onInteract=r}',
            'constructor(e,t,n,r,i){super(`avel-world`),this.readState=e,this.readMap=t,this.onMove=n,this.onInteract=r,this.onNpcWander=i}',
            'retain the existing scene lifecycle while accepting town movement ticks')
    replace('if(!(e-this.lastMove<r)){if(n)this.path=[]',
            'if(e-this.lastNpcWander>=2400){this.lastNpcWander=e;if(!n&&!this.path.length&&!this.pathTarget&&!this.tweens.isTweening(this.player))this.onNpcWander?.()}if(!(e-this.lastMove<r)){if(n)this.path=[]',
            'pause town movement during menus dialogue transitions pathing keyboard input and battles')
    replace('e=>X.move(e),e=>X.interact(e));X.subscribe(Gt)',
            'e=>X.move(e),e=>X.interact(e),()=>X.wanderStep());X.subscribe(Gt)',
            'invoke movement through the same authoritative game engine as other world actions')

    replace('r.setPosition(n.x,n.y).setScale(a).setDepth(50+t.y),this.labels.get(t.id)?.setPosition(n.x,n.y-(i?70:c?34:t.shopKind?60:44)).setVisible(',
            'settlementNpcPlace(this,r,n.x,n.y,t.npcRoaming).setScale(a).setDepth(50+t.y),settlementNpcPlace(this,this.labels.get(t.id),n.x,n.y-(i?70:c?34:t.shopKind?60:44),t.npcRoaming)?.setVisible(',
            'animate citizen steps and nameplates together while respecting reduced motion')
    replace('var et=', NPC_PLACEMENT + 'var et=',
            'reuse existing citizen sprites and labels for short bounded walking tweens')

    replace('</section></div><div class="controls-list"><p><kbd>W A S D</kbd>',
            '</section><section><h3>Town citizens</h3><div class="segmented">${[`wander`,`still`].map(value=>`<button data-npc-movement="${value}" aria-pressed="${e.settings.npcMovement===value}" class="${e.settings.npcMovement===value?`chosen`:``}">${value===`wander`?`Wander`:`Stay still`}</button>`).join(``)}</div><p>Allow ordinary townspeople to take short walks. They stop nearby so you can talk; shops and important quest keepers stay in place.</p></section></div><div class="controls-list"><p><kbd>W A S D</kbd>',
            'provide the optional town movement control beside other game settings')
    replace('if(t.dataset.encounters){X.configure({encounters:t.dataset.encounters})',
            'if(t.dataset.npcMovement){X.configure({npcMovement:t.dataset.npcMovement}),Gt(),document.querySelector(`[data-npc-movement="${t.dataset.npcMovement}"]`)?.focus({preventScroll:!0});return}if(t.dataset.encounters){X.configure({encounters:t.dataset.encounters})',
            'apply the town movement preference and retain keyboard focus')
    return source, labels


NPC_ENGINE = r'''
let townNpcArea=``,townNpcPositions=new Map,townNpcCursor=0,townNpcSeed=(t^0x4a6f7921)>>>0||9137;
function townNpcRandom(){townNpcSeed^=townNpcSeed<<13;townNpcSeed^=townNpcSeed>>>17;townNpcSeed^=townNpcSeed<<5;return(townNpcSeed>>>0)/4294967296}
function townNpcEligible(entity){return[`camp`,`dunmere`,`fen`,`orchard`,`crown`,`veyr`].includes(a.area)&&entity.kind===`npc`&&!entity.shopKind&&[`courier-keeper`,`dunmere-witness`,`courier-witness`,`fen-teacher`,`fen-orren`,`relief-keeper`,`orchard-halden`,`relief-crew`,`veyr-patient`,`family-archivist`].includes(entity.id)}
function townNpcTile(map,entity,x,y,home){
if(x<1||y<1||x>=map.width-1||y>=map.height-1||!q.includes(map.tiles[y][x])||!p(a.area,x,y)||Math.abs(x-home.x)+Math.abs(y-home.y)>2||x===a.player.x&&y===a.player.y)return!1;
if(map.entities.some(other=>other.id!==entity.id&&other.x===x&&other.y===y))return!1;
if(map.entities.some(other=>other.id!==entity.id&&!townNpcEligible(other)&&Math.abs(other.x-x)+Math.abs(other.y-y)<=1))return!1;
let exits=0;for(let[dx,dy]of[[0,-1],[1,0],[0,1],[-1,0]])if(q.includes(map.tiles[y+dy]?.[x+dx]))exits++;return exits>=3}
function townNpcMap(map){
if(townNpcArea!==a.area){townNpcArea=a.area;townNpcPositions.clear();townNpcCursor=0}
let result={...map,entities:map.entities.map(entity=>{let position=townNpcPositions.get(entity.id);return townNpcEligible(entity)?{...entity,...position,npcRoaming:!0}:entity})};
for(let entity of result.entities)if(townNpcEligible(entity)&&entity.x===a.player.x&&entity.y===a.player.y){let home=map.entities.find(candidate=>candidate.id===entity.id);for(let[dx,dy]of[[0,1],[1,0],[0,-1],[-1,0],[0,2],[2,0],[0,-2],[-2,0],[1,1],[-1,1],[1,-1],[-1,-1]]){let x=home.x+dx,y=home.y+dy;if(townNpcTile(result,entity,x,y,home)){townNpcPositions.set(entity.id,{x,y});entity.x=x;entity.y=y;break}}}
return result}
function townNpcStep(){
if(a.settings.npcMovement!==`wander`||a.mode!==`explore`||a.battle||a.message||a.reward||a.messageQueue.length)return!1;
let map=k(),citizens=map.entities.filter(townNpcEligible);if(!citizens.length)return!1;
for(let count=0;count<citizens.length;count++){let entity=citizens[townNpcCursor++%citizens.length],home=he[a.area].entities.find(candidate=>candidate.id===entity.id);if(Math.abs(entity.x-a.player.x)+Math.abs(entity.y-a.player.y)<=2)continue;let offset=Math.floor(townNpcRandom()*4);for(let j=0;j<4;j++){let[dx,dy]=[[0,-1],[1,0],[0,1],[-1,0]][(offset+j)%4],x=entity.x+dx,y=entity.y+dy;if(Math.abs(x-a.player.x)+Math.abs(y-a.player.y)<=2||!townNpcTile(map,entity,x,y,home))continue;townNpcPositions.set(entity.id,{x,y});l();return!0}}
return!1}
'''


NPC_PLACEMENT = r'''function settlementNpcPlace(scene,object,x,y,walking){if(!object)return object;let changed=object.townNpcX!==x||object.townNpcY!==y;if(walking&&!scene.reducedMotion&&object.townNpcX!==void 0&&changed){scene.tweens.killTweensOf(object);scene.tweens.add({targets:object,x,y,duration:260,ease:`Linear`})}else if(!walking||scene.reducedMotion||object.townNpcX===void 0)object.setPosition(x,y);object.townNpcX=x;object.townNpcY=y;return object}
'''
