"""Deliberate travel-only patches for the uploaded standalone renderer.

This module does not write the game.  The assembly script calls ``patch`` and
performs the final write after the independent map and engine patches.
"""


def patch(source):
    labels = []

    def once(old, new, label):
        nonlocal source
        count = source.count(old)
        if count != 1:
            raise AssertionError(f"{label}: expected one anchor, found {count}")
        source = source.replace(old, new, 1)
        labels.append(label)

    once(
        "path=[];pathTarget;cueKey=``;",
        "path=[];pathTarget;travelPosition;travelUntil=0;travelReleaseRequired=!1;cueKey=``;",
        "renderer travel state",
    )
    once(
        "inputBlocked(){let e=this.readState();if(e.mode!==`explore`||e.message||e.reward)return!0;",
        "travelInputHeld(){return Object.entries(this.keys).some(([e,t])=>e!==`SHIFT`&&t?.isDown)||!!this.input?.manager?.pointers?.some(e=>e.isDown)}isTransitioning(){return performance.now()<this.travelUntil||this.travelReleaseRequired}inputBlocked(){let e=this.readState();if(this.isTransitioning()||e.mode!==`explore`||e.message||e.reward)return!0;",
        "renderer arrival input grace and release",
    )
    once(
        "zoom:e?.zoom||1,width:this.worldWidth,height:this.worldHeight}}refreshView()",
        "zoom:e?.zoom||1,width:this.worldWidth,height:this.worldHeight,transitioning:this.isTransitioning()}}refreshView()",
        "readonly viewport transition flag",
    )
    once(
        "n=t?`battle`:`explore`;if(n!==this.visualMode||!t&&e.area!==this.area)",
        "n=t?`battle`:`explore`,r=!t&&this.visualMode===`explore`&&this.travelPosition&&(this.travelPosition.area!==e.area||nt(this.travelPosition,e.player)>1);if(!t)this.travelPosition={area:e.area,x:e.player.x,y:e.player.y};if(r){this.path=[],this.pathTarget=void 0,this.lastPlayer=``,this.trail=[],this.cameraArea=``,this.travelUntil=performance.now()+(this.reducedMotion?180:260),this.travelReleaseRequired=this.travelInputHeld()}if(n!==this.visualMode||!t&&e.area!==this.area)",
        "reset travel path on area and crossing arrivals",
    )
    once(
        "t?this.refreshBattle(e):this.refreshWorld(e)}refreshWorld(e)",
        "t?this.refreshBattle(e):this.refreshWorld(e),r&&!this.reducedMotion&&this.cameras.main.fadeIn(180,16,36,44)}refreshWorld(e)",
        "short travel arrival fade",
    )

    # A road crossing must not inherit a destination town/castle texture from
    # its label.  The two small icons use the same procedural pixel palette as
    # the existing terrain; gates and ferries reuse the shipped art.
    once(
        "create(){qe(this),$e(this),this.background=",
        "create(){qe(this),Ge(this,`travel-bridge`,56,48,e=>{J(e,`#172c3388`,3,39,50,6);for(let t=0;t<7;t++)J(e,t%2?`#b69e72`:`#c2ab7b`,7+t*6,14,5,26);J(e,`#534a3d`,4,11,48,4),J(e,`#ddc58f`,4,10,48,2),J(e,`#534a3d`,4,36,48,4),J(e,`#ddc58f`,4,35,48,2);for(let t of[5,47])J(e,`#655642`,t,8,4,36)}),Ge(this,`travel-pass`,60,54,e=>{J(e,`#172c3388`,1,47,58,5);for(let t=0;t<7;t++){J(e,t%2?`#829087`:`#667970`,14-t*2,8+t*6,8+t*3,6);J(e,t%2?`#929b88`:`#718176`,39-t,3+t*7,6+t*3,7)}J(e,`#b4a078`,25,32,8,19),J(e,`#d0bd8d`,28,37,3,14),J(e,`#d1d2b5`,13,10,7,3),J(e,`#d1d2b5`,39,5,6,3)}),$e(this),this.background=",
        "crossing pixel textures",
    )
    once(
        "refreshWorld(e){let t=",
        "crossing(e){return e.kind===`exit`&&/^(road|pass|ferry|gate)-/.test(e.id)?[`road-crown`,`road-orchard`].includes(e.id)?`pass`:e.id.split(`-`)[0]:null}travelTexture(e,t){let n=t===`overworld`?this.crossing(e):null;return n===`road`?`travel-bridge`:n===`pass`?`travel-pass`:n===`ferry`?`site-dock`:n===`gate`?`door`:Xe(`${e.sprite} ${e.name}${e.kind===`exit`&&t===`overworld`?` ${e.destination||``}`:``}`,e.kind)}refreshWorld(e){let t=",
        "crossing texture selector",
    )
    once(
        "let i=Xe(`${t.sprite} ${t.name}${t.kind===`exit`&&e.area===`overworld`?` ${t.destination||``}`:``}`,t.kind);",
        "let i=this.travelTexture(t,e.area);",
        "apply crossing texture selector",
    )
    once(
        "let a=t.kind===`rare`?` ◇`:t.kind===`enemy`?` •`:``,o=this.add.text(n.x,n.y-44,t.name+a,{fontFamily:`monospace`,fontSize:`10px`,color:t.kind===`rare`?`#f3d88c`:`#e0debf`,backgroundColor:`#172a30c9`,padding:{x:4,y:3}})",
        "let c=e.area===`overworld`?this.crossing(t):null,a=t.kind===`rare`?` ◇`:t.kind===`enemy`?` •`:``,o=this.add.text(n.x,n.y-44,(c?{road:`Bridge`,pass:`High pass`,ferry:`Ferry`,gate:`Gate`}[c]:t.name)+a,{fontFamily:`monospace`,fontSize:c?`9px`:`10px`,color:c?`#c3d0bd`:t.kind===`rare`?`#f3d88c`:`#e0debf`,backgroundColor:c?`#172a3080`:`#172a30c9`,padding:{x:4,y:3}})",
        "short distinct crossing labels",
    )
    once(
        "let i=t.kind===`boss`,a=i?.45:t.kind===`enemy`||t.kind===`rare`?.62:t.kind===`exit`?e.area===`overworld`?.5:.56:.84;",
        "let c=e.area===`overworld`?this.crossing(t):null,i=t.kind===`boss`,a=i?.45:t.kind===`enemy`||t.kind===`rare`?.62:t.kind===`exit`?c?c===`road`||c===`pass`?.64:.42:e.area===`overworld`?.5:.56:.84;",
        "crossing icon sizing",
    )
    once(
        "this.labels.get(t.id)?.setPosition(n.x,n.y-(i?70:44)),t.kind===`campfire`",
        "this.labels.get(t.id)?.setPosition(n.x,n.y-(i?70:c?34:44)).setVisible(!c||nt(t,e.player)<=4||this.pathTarget===t.id),t.kind===`campfire`",
        "hide distant crossing labels",
    )
    once(
        "this.hintLabel.setText(a?`[E] ${a.hint||a.name}`:`WASD / ARROWS · E interact · SHIFT quick walk · click to travel`)",
        "this.hintLabel.setText(a?a.kind===`exit`?`Walk onto the marked tile · ${a.name}`:`[E] ${a.hint||a.name}`:`WASD / ARROWS · E interact · SHIFT quick walk · click to travel`)",
        "exit step hint",
    )
    once(
        "if(i&&nt(i,n.player)<=1){this.onInteract(i.id);return}let a=i?et.map(([,e,t])=>({x:r.x+e,y:r.y+t})):[r],o=this.route(n.player,a,t);this.path=o||[],this.pathTarget=o?i?.id:void 0,this.refreshView()",
        "if(i&&i.kind===`exit`&&nt(i,n.player)===0){this.onInteract(i.id);return}if(i&&i.kind!==`exit`&&nt(i,n.player)<=1){this.onInteract(i.id);return}let a=i&&i.kind!==`exit`?et.map(([,e,t])=>({x:r.x+e,y:r.y+t})):[r],o=this.route(n.player,a,t);this.path=o||[],this.pathTarget=o&&i?.kind!==`exit`?i?.id:void 0,this.refreshView()",
        "click exits walks onto exit tile",
    )
    once(
        "route(e,t,n){let r=e=>`${e.x},${e.y}`,i=new Set(t.map(r)),a=[e]",
        "route(e,t,n){let r=e=>`${e.x},${e.y}`,i=new Set(t.map(r)),goals=i,a=[e]",
        "retain exit route goals outside direction loop",
    )
    once(
        "n.entities.some(e=>e.x===s.x&&e.y===s.y)||(o.set(r(s),e),a.push(s))",
        "n.entities.some(e=>e.x===s.x&&e.y===s.y&&(e.kind!==`exit`||!goals.has(r(s))))||(o.set(r(s),e),a.push(s))",
        "pathfind onto destination exit without crossing other exits",
    )
    once(
        "update(e){if(!this.ready)return;let t=this.readState();",
        "update(e){if(!this.ready)return;this.travelReleaseRequired&&!this.travelInputHeld()&&(this.travelReleaseRequired=!1);let t=this.readState();",
        "release held inputs after arrival",
    )
    return source, labels
