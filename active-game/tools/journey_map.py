"""Read-only notes for the optional discoveries on the current dungeon floor."""

HELPER = r'''function currentFloorSurvey(state){let info=dungeonInfo(state.area,state.player.x,state.player.y),map=he[state.area];if(!info||!map)return null;let switches=new Set(state.campaign.switches),opened=new Set(state.campaign.openedChests),rows=[],add=(id,label,entries,done)=>{if(entries.length)rows.push({id,label,done:entries.filter(done).length,total:entries.length})};add(`records`,`Records copied`,map.entities.filter(entity=>entity.depthRecord),()=>switches.has(`depth_${info.root}_${info.floor}_record`));add(`caches`,`Caches opened`,map.entities.filter(entity=>entity.kind===`chest`),entity=>opened.has(entity.id)||entity.id===`chest`&&state.flags.chest);add(`locks`,`Cross-locks opened`,map.entities.filter(entity=>entity.depthWheel),entity=>switches.has(entity.depthWheel));add(`lifts`,`Return lifts opened`,map.entities.filter(entity=>entity.depthLever),entity=>switches.has(entity.depthLever));return{area:state.area,floor:info.floor,totalFloors:info.total,rows}}
'''
UI = r'''function floorSurveyUI(state){let survey=currentFloorSurvey(state);return survey?.rows.length?`<section class="floor-survey" data-floor-survey="${Q(survey.area)}" aria-label="Discoveries on this floor"><strong>On this floor</strong><ul>${survey.rows.map(row=>`<li data-floor-note="${Q(row.id)}" class="${row.done===row.total?`complete`:``}"><span>${Q(row.label)}</span><b>${row.done} / ${row.total}</b></li>`).join(``)}</ul></section>`:``}
'''
CSS = '''.floor-survey{margin:12px 0 16px;padding:12px;border:1px solid #718ac0;background:#10266680}.floor-survey>strong{font-size:12px;font-weight:normal;color:#ffdfa0}.floor-survey ul{display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;list-style:none;margin:9px 0 0;padding:0}.floor-survey li{display:flex;justify-content:space-between;gap:12px;font-size:11px;line-height:1.6}.floor-survey b{font-weight:normal;white-space:nowrap}.floor-survey .complete{color:#bce2b6}@media(max-width:480px){.floor-survey ul{grid-template-columns:1fr}.floor-survey li{font-size:10px}}
'''


def patch(source):
    labels = []

    def once(old, new, label):
        nonlocal source
        assert source.count(old) == 1, f'{label}: expected one anchor'
        source = source.replace(old, new, 1)
        labels.append(label)

    once('function Ee(e={}){', HELPER + 'function Ee(e={}){', 'derive current-floor optional notes from saved discoveries')
    once('function depthLocalMap(state){', UI + 'function depthLocalMap(state){', 'render a compact current-floor discovery checklist')
    once('The map gives directions; it never moves the party.</p><svg class="area-atlas"',
         'The map gives directions; it never moves the party.</p>${floorSurveyUI(state)}<svg class="area-atlas"',
         'area maps show records caches locks and lifts already completed')
    once('</head>', '<style>' + CSS + '</style>\n</head>', 'responsive floor notes stay within the existing map modal')
    return source, labels
