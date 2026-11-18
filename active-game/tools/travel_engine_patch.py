"""Surgical travel changes for the user's authoritative standalone game bundle.

The map patch is deliberately separate: this module derives travel metadata from
its existing canonical enter-{area} and world-{area} entities/transition records.
"""


def patch(source: str) -> tuple[str, list[str]]:
    changes = []

    def replace(old: str, new: str, label: str) -> None:
        nonlocal source
        count = source.count(old)
        if count != 1:
            raise ValueError(f"{label}: expected one source anchor, found {count}")
        source = source.replace(old, new, 1)
        changes.append(label)

    helpers = r'''// Travel uses only existing save fields; legacy returns are repaired when leaving a site.
function travelFree(area,point){let map=he[area];return!!point&&Number.isInteger(point.x)&&Number.isInteger(point.y)&&q.includes(map.tiles[point.y]?.[point.x])&&!map.entities.some(entity=>entity.x===point.x&&entity.y===point.y)}
function travelFacing(site,point,fallback=`down`){let dx=point.x-site.x,dy=point.y-site.y;return Math.abs(dx)>Math.abs(dy)?dx>0?`right`:`left`:dy?dy>0?`down`:`up`:fallback}
function travelOutside(site,preferred,fallback){let near=point=>travelFree(`overworld`,point)&&Math.abs(point.x-site.x)+Math.abs(point.y-site.y)===1;for(let point of[preferred,fallback,...[[0,1],[1,0],[-1,0],[0,-1]].map(([dx,dy])=>({x:site.x+dx,y:site.y+dy}))])if(near(point))return{x:point.x,y:point.y};return null}
function travelExit(exit,approach=a.player,walking=!1){let target=g[exit.id]??(exit.id===`toWorks`?{area:`works`,x:3,y:15}:exit.id===`toCamp`?{area:`camp`,x:27,y:8}:null);if(!target)return!1;if(target.area===`works`&&!a.flags.briefed){x(a.profile.name,`We should speak to Bessa before entering the bellworks.`);return!1}if(target.minStage!==void 0&&a.campaign.stage<target.minStage||target.requiredSwitch&&!a.campaign.switches.includes(target.requiredSwitch)){x(exit.name,target.blockedText??`We need to finish the work here before taking this road.`);return!1}let from=a.area,point={x:target.x,y:target.y},facing=target.facing??`down`;if(from===`overworld`&&target.area!==`overworld`){let outside=travelOutside(exit,approach,g[`world-`+target.area]);if(!outside)return!1;a.overworldReturn=outside}else if(from!==`overworld`&&target.area===`overworld`){let site=he.overworld.entities.find(entity=>entity.kind===`exit`&&entity.id===`enter-`+from);if(!site)return!1;point=travelOutside(site,a.overworldReturn,target);if(!point)return!1;a.overworldReturn={...point};facing=travelFacing(site,point)}if(target.area!==`overworld`){let localExit=he[target.area].entities.find(entity=>entity.kind===`exit`&&entity.id===`world-`+target.area);localExit&&!target.facing&&(facing=travelFacing(localExit,point))}else if(from===`overworld`)facing=target.facing??travelFacing(exit,point,a.player.facing);a.area=target.area,a.player={...point,facing},walking&&a.steps++,a.encounterSteps=0,p(a.area,a.player.x,a.player.y)&&(a.safeReturn={area:a.area,x:a.player.x,y:a.player.y}),l(),z.save();return!0}
'''
    anchor = 'let z={get state(){return a},subscribe(e){return c.add(e),()=>c.delete(e)},map:k,move(e){'
    replace(anchor, helpers + anchor, 'safe site-specific travel helpers')

    old_move = source[source.index('move(e){', source.index(helpers)):source.index(',interact(e){', source.index(helpers))]
    new_move = '''move(e){if(a.mode!==`explore`||a.message||a.reward)return;let t={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[e];if(!t)return;let n=a.player.x+t[0],r=a.player.y+t[1];a.player.facing=e;let i=k();if(!(r<0||r>=i.height||n<0||n>=i.width||!q.includes(i.tiles[r][n]))&&!i.entities.some(e=>e.x===n&&e.y===r&&e.kind!==`exit`)){let exit=i.entities.find(e=>e.x===n&&e.y===r&&e.kind===`exit`);if(exit){travelExit(exit,a.player,!0);return}if(a.player.x=n,a.player.y=r,a.steps++,!p(a.area,n,r)&&a.settings.encounters===`classic`&&!i.entities.some(e=>e.kind!==`enemy`&&Math.abs(e.x-n)+Math.abs(e.y-r)<=2)&&(a.encounterSteps++,a.encounterSteps>=12&&(a.encounterSteps>=18||m()<1/(19-a.encounterSteps)))){let e=a.area===`works`?le.filter(e=>e.startsWith(`encounter`)&&!a.cleared.includes(e)):[];j(e.length?h(e):`wild:${w()}:${++a.campaign.wildBattles}`)}else l(),z.save()}}'''
    replace(old_move, new_move, 'step onto exits before encounter checks')

    start = source.index('if(n.kind===`exit`){', source.index(helpers))
    end = source.index('else if(n.kind===`campfire`', start)
    old_exit = source[start:end]
    replace(old_exit, 'if(n.kind===`exit`){travelExit(n)}', 'share gated travel with direct interaction')
    return source, changes
