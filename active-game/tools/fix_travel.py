"""Apply the travel-only correction to the current equipment-fixed upload."""
from pathlib import Path
import hashlib, importlib.util, json, re, shutil

root=Path(__file__).resolve().parents[1]
target=root/'The_Road_Beyond_the_Bells.html'
source=root/'travel-baseline.html'
expected='a1daa7eac65d047cda4f4471a6f16b5907d77b4578b089fba24b8cdcc1bdb55f'
if not source.exists():
    assert hashlib.sha256(target.read_bytes()).hexdigest()==expected, 'Review the current game before selecting a new travel baseline.'
    shutil.copyfile(target,source)
raw=source.read_bytes()
assert hashlib.sha256(raw).hexdigest()==expected, 'Travel baseline changed; do not overwrite later game edits.'
s=raw.decode('utf-8')
changes=[]
def once(old,new,label):
    global s
    assert s.count(old)==1,f'{label}: expected one match, got {s.count(old)}'
    s=s.replace(old,new,1);changes.append(label)
def section(start,end,new,label):
    a=s.index(start);b=s.index(end,a);once(s[a:b],new,label)

layout='''function travelMapLayout(maps){
 const shortcuts=new Set([`toWorks`,`toCamp`,`town-tollhouse`,`town-granary`,`town-heart`]);
 const towns=new Set([`camp`,`dunmere`,`fen`,`veyr`]);
 for(const [area,map]of Object.entries(maps)){
  map.area=area;map.kind=area===`overworld`?`world`:towns.has(area)?`town`:[`orchard`,`crown`].includes(area)?`outpost`:`dungeon`;
  map.entities=map.entities.filter(entity=>!shortcuts.has(entity.id));
 }
 for(const id of shortcuts)delete g[id];
 for(const site of k){
  const map=maps[site.area],exitId=`world-${site.area}`;
  let exit=map.entities.find(entity=>entity.id===exitId);
  if(!exit){exit={id:exitId,x:2,y:site.area===`works`?15:14,kind:`exit`,name:`Overworld exit`,sprite:`door`,hint:`Walk outside to explore Avel`,destination:`overworld`};map.entities.push(exit)}
  Object.assign(exit,{name:`Overworld exit`,hint:`Walk onto the exit to return to the overworld`,destination:`overworld`,travelKind:`field-exit`});
  g[exitId]={area:`overworld`,x:site.x,y:site.y+1};
  g[site.id]={...g[site.id],facing:site.area===`camp`?`left`:`right`};
  const marker=maps.overworld.entities.find(entity=>entity.id===site.id);
  Object.assign(marker,{name:site.name,destination:site.area,travelKind:`site`,hint:`Walk into ${site.name}`});
 }
 const crossings={
  'road-dunmere':[8,24,`up`,`Bridge`], 'road-reedbank':[8,28,`down`,`Bridge`],
  'ferry-fen':[27,21,`right`,`Ferry`], 'ferry-saltroad':[22,21,`left`,`Ferry`],
  'pass-orchard':[36,28,`right`,`High pass`], 'pass-fen':[32,28,`left`,`High pass`],
  'road-crown':[46,21,`up`,`High pass`], 'road-orchard':[46,25,`down`,`High pass`],
  'gate-veyr':[53,9,`up`,`City gate`], 'gate-crown':[53,13,`down`,`City gate`]
 };
 for(const [id,[x,y,facing,name]]of Object.entries(crossings)){
  Object.assign(g[id],{x,y,facing});
  const marker=maps.overworld.entities.find(entity=>entity.id===id);
  Object.assign(marker,{name,hint:`Cross the ${name.toLowerCase()}`,travelKind:`crossing`});
 }
 return maps;
}
'''
once('var he=j({camp:pe(),works:me()});',layout+'var he=travelMapLayout(j({camp:pe(),works:me()}));','One canonical overworld entrance and exterior exit per local map')

# Route wording follows the new topology; story events and outcomes are unchanged.
once('Enter Merewatch east of camp. Break the Brass Bailiff’s outer frame and find the missing workers.', 'Leave Reedbank for the overworld, then follow the road east to Merewatch. Break the Brass Bailiff’s outer frame and find the missing workers.', 'Opening objective uses the overworld route')
once('The bellworks entrance is east of the watchfire.', 'Leave by the overworld exit on Reedbank’s southeast road. Merewatch is east along the field road.', 'Bessa gives directions to the single exterior entrance')
once('The copies are safe. The tollhouse is east of town. Free its holding yard, then speak to Neri.', 'The copies are safe. Leave Dunmere for the overworld and follow the road east to the tollhouse. Free its holding yard, then speak to Neri.', 'Dunmere directions use the exterior road')

atlas='''function ut(e){let t=he.overworld,n={g:`#477b55`,d:`#c8b071`,s:`#8e9965`,f:`#436653`,b:`#dec890`,w:`#235c9a`,"#":`#777a90`,t:`#285b40`,T:`#27503f`,"^":`#81859a`},r=[`#477b55`,`#a9a06a`,`#456c62`,`#73834b`,`#75778b`,`#667a91`],i={};t.tiles.forEach((row,y)=>Array.from(row).forEach((tile,x)=>{let region=Number(M(`overworld`,x,y).slice(1))-1,color=tile===`g`?r[region]:n[tile]??r[region];i[color]=(i[color]??``)+`M${x} ${y}h1v1h-1z`}));
 const point=e.area===`overworld`?e.player:k.find(site=>site.area===e.area)??e.overworldReturn;
 const locked=site=>{const route=g[site.id];return!!(route&&(e.campaign.stage<(route.minStage??0)||route.requiredSwitch&&!e.campaign.switches.includes(route.requiredSwitch))||site.area===`works`&&!e.flags.briefed)};
 const kind=area=>he[area].kind===`town`?`Town / shelter`:he[area].kind===`outpost`?`Road / refuge`:`Dungeon`;
 return`<p class="map-caption">The Roads of Avel · Enter a numbered place from the overworld, then leave through its overworld exit. Bridges, ferries, and passes connect the regions.</p><svg class="world-atlas" viewBox="0 0 ${t.width} ${t.height}" role="img" aria-label="World map of Avel with ten numbered places and the party location">${Object.entries(i).map(([color,path])=>`<path fill="${color}" d="${path}"/>`).join(``)}${k.map((site,index)=>`<g data-world-site="${site.area}"><title>${Y(site.name)} · ${kind(site.area)}${locked(site)?` · Route not yet open`:``}</title><circle cx="${site.x+.5}" cy="${site.y+.5}" r="1.05" fill="${locked(site)?`#6c7c9c`:`#f5d691`}" stroke="#162a56" stroke-width=".15"/><text x="${site.x+.5}" y="${site.y+.95}" text-anchor="middle" font-family="monospace" font-size="1.3" fill="#101e4c">${index+1}</text></g>`).join(``)}<path d="M${point.x+.5} ${point.y-.4}l.65 1.1-.65-.25-.65.25z" fill="white" stroke="#101d65" stroke-width=".15"/></svg><div class="atlas-legend"><span>▲ Party / current place</span><span>● Numbered town or dungeon</span><span class="muted">● Unopened route</span></div><div class="atlas-places">${k.map((site,index)=>{const region=d.regions.find(region=>region.id===f[site.area].regionId);return`<div data-map-site="${site.area}"><strong>${index+1}. ${Y(site.name)}</strong><span>${kind(site.area)} · Lv ${region.level_min}–${region.level_max}</span></div>`}).join(``)}</div><p class="pack-hint">Each number identifies one place on the overworld. Travel there on foot; this map provides directions. Towns are safe. Road refuges have calm service courts; their outer paths and the dungeons have regional monsters.</p>`}
'''
section('function ut(e){','function dt(e){',atlas,'Numbered atlas places share the canonical travel registry')

# Keep the user's menus and layout; update only movement instructions and input boundaries.
once('or Space to interact with something nearby','or Space to speak or inspect; walk onto exits to travel','Explain step-on travel alongside nearby interactions')
once('a destination to walk; a person or creature to approach','a town, dungeon, or exit to walk into; a person to approach','Pointer controls describe actual entry behavior')
once('On touch screens, use the direction pad or tap the map.', 'Walk into towns and dungeons from the overworld. Leave through the marked overworld exit. On touch screens, use the direction pad or tap a destination.', 'Travel loop in controls')
once('case`interact`:X.interact();break;', 'case`interact`:if(!Jt?.viewport().transitioning)X.interact();break;', 'Context interaction respects arrival input guard')
once('!Ot&&X.state.mode===`explore`&&!Z(`modal-root`).firstElementChild&&X.move(t.dataset.move)', '!Ot&&X.state.mode===`explore`&&!Z(`modal-root`).firstElementChild&&!Jt?.viewport().transitioning&&X.move(t.dataset.move)', 'Touch movement respects arrival input guard')
once('viewport:()=>Jt?.viewport()},writable:!1}', 'viewport:()=>Jt?.viewport(),map:()=>structuredClone(X.map())},writable:!1}', 'Read-only current map for route verification')
once('</head>', '<style>/* Travel taps pass through empty control-pad gaps. */.touch-pad{pointer-events:none}.touch-pad button{pointer-events:auto}</style>\n</head>', 'Transparent touch-control gaps let map taps through')

for filename in ('travel_engine_patch.py','travel_renderer_patch.py'):
    spec=importlib.util.spec_from_file_location(filename[:-3],root/'tools'/filename)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    s,labels=module.patch(s);changes.extend(labels)

target.write_bytes(s.encode('utf-8'))
(root/'travel-fix-manifest.json').write_text(json.dumps({'baseline_file':source.name,'baseline_sha256':expected,'working_file':target.name,'working_sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'scope':'Travel topology, entrances/exits, atlas identity, traversal input/presentation only','changes':changes,'preserved':['Equipment-copy fix','Per-hero EXP','Buy/sell and quantities','Original story outcomes','Combat, items, jobs and progression','Existing saves and save key','User status and equipment UI']},indent=2)+'\n')
Path('/tmp/avel-travel-final.mjs').write_text(re.search(r'<script\b[^>]*>([\s\S]*?)</script\s*>',s).group(1))
print(json.dumps({'file':str(target),'bytes':target.stat().st_size,'changes':len(changes)},indent=2))
