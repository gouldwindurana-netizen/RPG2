"""Battle formation and distinct service art patches for the active HTML.

``patch`` only returns the proposed text.  The assembly owner writes the HTML
after applying the other independent expansion generators.
"""


SERVICE_TEXTURES = r'''serviceTextures(){for(let kind of[`weapon`,`items`,`magic`])Ge(this,`service-${kind}`,48,58,e=>{let color={weapon:`#956441`,items:`#488d85`,magic:`#7868a6`}[kind];J(e,`#10233a66`,2,52,44,5),J(e,`#3d3029`,4,19,3,34),J(e,`#3d3029`,41,19,3,34),J(e,`#af8e60`,6,24,36,24),J(e,`#6a4c35`,7,42,34,9),J(e,`#d5b77d`,4,39,40,4),J(e,`#152b4c`,1,14,46,12),J(e,color,3,15,42,8);for(let x=3;x<44;x+=12)J(e,`#e1d4ac`,x,15,5,8);J(e,`#4c382d`,12,1,24,22),J(e,`#d8c69b`,14,3,20,18),J(e,`#24354b`,16,5,16,14);if(kind===`weapon`){J(e,`#dee9ed`,23,6,3,11),J(e,`#a6bec9`,26,6,2,8),J(e,`#d9ac57`,19,14,12,2),J(e,`#855d38`,23,16,3,5),J(e,`#bac8ce`,9,29,3,9),J(e,`#bd934d`,7,34,7,2)}else if(kind===`items`){J(e,`#cad6d3`,22,6,5,3),J(e,`#e5e0c0`,23,9,3,2),J(e,`#77c9c1`,20,11,9,7),J(e,`#b6eece`,22,12,2,3),J(e,`#b1d5ac`,10,30,7,8),J(e,`#bdb3e2`,31,29,6,9)}else{J(e,`#e6d9f6`,23,6,3,13),J(e,`#d8c3ef`,18,11,13,3),J(e,`#c6a2df`,20,8,3,9),J(e,`#f4de98`,29,7,2,2),J(e,`#d9c8eb`,9,30,9,8),J(e,`#9475bb`,11,32,5,4),J(e,`#d8c6a1`,30,30,8,8)}})}'''


FORMATION_METHODS = r'''enemySlots(enemies){let large=enemies.filter(e=>e.size===`large`||!e.size&&[`boss`,`rare`].includes(e.rank)),small=enemies.filter(e=>!large.includes(e)),slots=new Map,put=(list,x,y,w,h,cols,rows)=>{let cw=w/cols,ch=h/rows;list.forEach((enemy,index)=>{let column=index%cols,row=Math.floor(index/cols);slots.set(enemy.id,{x:x+column*cw+4,y:y+row*ch+4,w:cw-8,h:ch-8})})};if(enemies.length===1)slots.set(enemies[0].id,{x:55,y:100,w:440,h:408,baseY:397});else if(large.length&&small.length){put(large,34,82,232,432,1,Math.max(2,large.length)),put(small,270,82,288,432,2,3)}else if(large.length)put(large,34,82,524,432,2,2);else{let cols=small.length<=4?2:3,rows=small.length<=4?2:3;put(small,34,82,524,432,cols,rows)}return slots}refreshBattle(e){let t=e.battle;this.spotlight.clear(),this.regionLabel.setText(`${t.kind===`boss`?`BOSS ENCOUNTER`:t.kind===`rare`?`RARE HUNT ◇`:`BATTLE`}  /  ${t.enemies.length} ${t.enemies.length===1?`FOE`:`FOES`}  /  ROUND ${t.round}`),this.hintLabel.setText(t.phase===`resolving`?`The round unfolds…`:`Choose an action for each hero, then commit the round.`).setVisible(!0),this.game.canvas.setAttribute(`aria-label`,`${t.title}. ${t.enemies.filter(e=>e.hp>0).length} of ${t.enemies.length} foes remaining. Plan each hero's action with the controls below.`),this.pathDots.clear();let n=[[665,310],[820,325],[665,450],[820,465]],slots=this.enemySlots(t.enemies),i=new Set;e.heroes.forEach((hero,index)=>{i.add(hero.id),this.actor(hero.id,hero,hero.id===`Mara`?Ye(this,e.profile):`hero-${hero.id}`,n[index][0],n[index][1],2.2,`#cdd8ca`,!0)}),t.enemies.forEach((enemy,index)=>{i.add(enemy.id);let cell=slots.get(enemy.id),x=cell.x+cell.w/2,y=cell.baseY??cell.y+cell.h-62,texture=Xe(`${enemy.family} ${enemy.name} ${enemy.templateId||enemy.id}`,enemy.rank===`boss`?`boss`:enemy.rank===`rare`?`rare`:`enemy`);t.enemies.length>1&&/choir/i.test(enemy.name)&&(texture=`enemy-cantor`),[`ashen`,`crested`].includes(enemy.rank)&&this.textures.exists(`${texture}-${enemy.rank}`)&&(texture+=`-${enemy.rank}`);let image=this.textures.get(texture).getSourceImage(),cap=enemy.rank===`boss`&&t.enemies.length===1?1.35:enemy.size===`large`?2.15:1.7,scale=Math.min(cap,(cell.w-16)/image.width,(y-cell.y-5)/image.height),duplicate=t.enemies.filter(other=>other.name===enemy.name).length>1,displayName=enemy.displayName||(duplicate?`${enemy.name} ${index+1}`:enemy.name);this.actor(enemy.id,{...enemy,displayName},texture,x,y,scale,`#ead7b2`,!1,cell),enemy.hp>0&&enemy.intent?.startsWith(`HEAVY`)&&t.phase===`planning`&&(this.spotlight.fillStyle(14134628,.12).fillEllipse(x,y-4,Math.min(cell.w-12,image.width*scale+10),18),this.spotlight.lineStyle(2,14993024,.5).strokeEllipse(x,y-4,Math.min(cell.w-12,image.width*scale+10),18))});for(let[id,actor]of this.actors)i.has(id)||(actor.image.destroy(),actor.label.destroy(),actor.bar.destroy(),this.actors.delete(id));let a=t.cue,o=a?`${t.round}:${t.log.length}:${JSON.stringify(a)}`:``;if(a&&o!==this.cueKey){this.cueKey=o;let actor=this.actors.get(a.actor),target=this.actors.get(a.target);if(actor&&!this.reducedMotion&&this.tweens.add({targets:actor.image,x:actor.baseX+(e.heroes.some(e=>e.id===a.actor)?-14:8),duration:85,yoyo:!0}),target){let color=a.kind===`heal`?`#bce0a9`:a.kind===`guard`?`#d8c793`:`#ffe6b1`,message=a.kind===`guard`?`GUARD`:a.amount?`${a.kind===`heal`?`+`:`−`}${a.amount}`:a.kind===`spell`?`MAGIC`:`MISS`,cue=this.add.text(target.baseX,Math.max(target.cell?.y??75,target.baseY-Math.min(90,target.image.displayHeight*.7)),message,{fontFamily:`monospace`,fontSize:target.cell&&target.cell.w<180?`19px`:`25px`,color,stroke:`#162b30`,strokeThickness:5,fontStyle:`bold`}).setOrigin(.5).setDepth(400);this.effects.push(cue),this.tweens.add({targets:cue,y:Math.max(60,cue.y-(this.reducedMotion?0:24)),alpha:0,delay:160,duration:550,onComplete:()=>{cue.destroy(),this.effects=this.effects.filter(e=>e!==cue)}}),this.castEffect(a.kind,target,actor,t.log.at(-1)||``),!this.reducedMotion&&a.kind!==`guard`&&(target.image.setTint(a.kind===`heal`?11658412:16769455),this.time.delayedCall(140,()=>{target.image.active&&target.image.clearTint()}))}}}'''


ACTOR_METHOD = r'''actor(e,t,n,r,i,a,o,s,cell){let c=this.actors.get(e);c||(c={image:this.add.image(r,i,n).setOrigin(.5,1).setScale(a).setDepth(60+i/10),label:this.add.text(r,i+12,``,{fontFamily:`monospace`,fontSize:`14px`,color:o,align:`center`,stroke:`#16292f`,strokeThickness:4}).setOrigin(.5,0).setDepth(180),bar:this.add.graphics().setDepth(175),baseX:r,baseY:i},this.actors.set(e,c));let alive=t.hp>0;c.image.texture.key!==n&&c.image.setTexture(n),c.baseX=r,c.baseY=i,c.cell=cell,c.image.setPosition(r,i).setScale(a).setDepth(60+i/10).setAlpha(alive?1:.24).setFlipX(s);let name=t.displayName||t.name,rank=!s&&t.rank!==`base`?` ${t.rank===`rare`?`◇`:t.rank===`boss`?`◆`:`▲`}`:``,font=cell?cell.w<180?10:12:14,width=cell?cell.w-12:130;c.label.setPosition(r,i+(cell?5:12)).setStyle({fontSize:`${font}px`,wordWrap:{width,useAdvancedWrap:!0}}).setText(`${name}${rank}\n${t.hp} / ${t.maxHp}${t.status?` · ${t.status}`:``}`).setAlpha(alive?1:.5);while(cell&&c.label.height>cell.y+cell.h-c.label.y-14&&font>8)c.label.setFontSize(--font);let barWidth=cell?Math.min(cell.w-18,120):94,barY=cell?c.label.y+c.label.height+3:i+49;c.bar.clear().fillStyle(1057834,.95).fillRect(r-barWidth/2,barY,barWidth,7),c.bar.fillStyle(s?9287836:13148522).fillRect(r-barWidth/2+1,barY+1,Math.max(0,(barWidth-2)*t.hp/t.maxHp),5),c.bounds={cell:cell?{...cell}:null,sprite:{x:r-c.image.displayWidth/2,y:i-c.image.displayHeight,w:c.image.displayWidth,h:c.image.displayHeight},label:{x:r-c.label.width/2,y:c.label.y,w:c.label.width,h:c.label.height},bar:{x:r-barWidth/2,y:barY,w:barWidth,h:7}}}'''


OVERFLOW_CSS = '''
/* Formations remain selectable when every enemy is alive. */
.battle-command{min-width:0}.battle-topline{gap:12px;align-items:flex-start}.battle-topline .eyebrow{flex:1;min-width:0}.battle-topline .intent{flex:1;min-width:0;max-height:54px;overflow:auto;line-height:1.5}.target-list{overflow-y:auto;overscroll-behavior:contain;scrollbar-color:#adc6ff #10255c;padding-right:5px}.target-button{flex-shrink:0;min-height:42px}.target-button>span{min-width:0;overflow-wrap:anywhere}.battle-log{min-width:0}.round-controls{min-width:0}
'''


def patch(source):
    labels = []

    def once(old, new, label):
        nonlocal source
        count = source.count(old)
        if count != 1:
            raise AssertionError(f"{label}: expected one anchor, found {count}")
        source = source.replace(old, new, 1)
        labels.append(label)

    def method(start, end, replacement, label):
        nonlocal source
        if source.count(start) != 1 or source.count(end) != 1:
            raise AssertionError(f"{label}: method boundary is not unique")
        first, last = source.index(start), source.index(end)
        if first >= last:
            raise AssertionError(f"{label}: reversed method boundary")
        source = source[:first] + replacement + source[last:]
        labels.append(label)

    once("create(){qe(this),", "create(){qe(this),this.serviceTextures(),", "generate three service stall textures")
    once("crossing(e){return", SERVICE_TEXTURES + "crossing(e){return", "distinct weapon potion and rune signs")
    once(
        "travelTexture(e,t){let n=t===`overworld`?this.crossing(e):null;",
        "travelTexture(e,t){if(e.kind===`npc`&&e.shopKind)return`service-${e.shopKind}`;let n=t===`overworld`?this.crossing(e):null;",
        "service NPC texture selection",
    )
    once(
        "setPosition(n.x,n.y-(i?70:c?34:44)).setVisible",
        "setPosition(n.x,n.y-(i?70:c?34:t.shopKind?60:44)).setVisible",
        "shop labels clear the stall signs",
    )
    once(
        "transitioning:this.isTransitioning()}}refreshView()",
        "transitioning:this.isTransitioning(),actors:[...this.actors].map(([id,actor])=>({id,...structuredClone(actor.bounds||{})}))}}refreshView()",
        "readonly battle actor bounds",
    )
    method("refreshBattle(e){", "castEffect(e,t,n,r){", FORMATION_METHODS, "adaptive battle formations and cues")
    method("actor(e,t,n,r,i,a,o,s){", "clickWorld(e){", ACTOR_METHOD, "cell bounded sprite labels and HP bars")
    once("</head>", "<style>" + OVERFLOW_CSS + "</style>\n</head>", "scrollable formation targets and intents")
    return source, labels
