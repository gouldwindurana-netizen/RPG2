"""Align town thresholds and make every Reedbank shelter genuinely enterable."""


def patch(source):
    labels = []

    def change(old, new, label):
        nonlocal source
        assert source.count(old) == 1, (label, source.count(old))
        source = source.replace(old, new, 1)
        labels.append(label)

    change('function skillMerchantNames(maps){', BUILDING_LAYOUT + 'function skillMerchantNames(maps){',
           'describe real facade thresholds and add two safe paired Reedbank shelter interiors')
    change('var he=settlementShopLayout(skillMerchantNames(wayfarerLayout(depthDungeonLayout(expansionWorldLayout(travelMapLayout(j({camp:pe(),works:me()})))))));',
           'var he=entranceWorldLayout(settlementShopLayout(skillMerchantNames(wayfarerLayout(depthDungeonLayout(expansionWorldLayout(travelMapLayout(j({camp:pe(),works:me()}))))))));',
           'align all twelve shops and Reedbank homes before validating or drawing local maps')
    change('let n=JSON.parse(e);if(!Se(n)||',
           'let n=normalizeEntranceSave(JSON.parse(e));if(!Se(n)||',
           'preserve old journeys by relocating only positions on newly widened Reedbank wall cells')
    change('function sideStoryEvent(id,state){const has=key=>state.campaign.switches.includes(key),say=(speaker,text)=>({speaker,text}),event=(messages,switches=[],reward)=>({messages,switches,...reward?{reward}:{}});',
           'function sideStoryEvent(id,state){const has=key=>state.campaign.switches.includes(key),say=(speaker,text)=>({speaker,text}),event=(messages,switches=[],reward)=>({messages,switches,...reward?{reward}:{}});\n'+RESIDENT_DIALOGUE,
           'let shelter residents speak through the existing dialogue framework without rewards or progression')
    change('rest(){if(settlementShopInfo(a.area)||',
           'rest(){if(buildingEntranceInfo(a.area)||',
           'keep new homes as conversation spaces rather than adding free inn recovery')
    change('else{let shop=settlementShopInfo(e.area),[t,n]=shop?settlementShopObjective(e,shop):zt(),r=X.map().entities.filter(',
           'else{let shop=buildingEntranceInfo(e.area),[t,n]=shop?buildingInteriorObjective(e,shop):zt(),r=X.map().entities.filter(',
           'show the correct resident and return-door guidance while keeping inappropriate rest controls hidden')
    change('let shop=settlementShopInfo(state.area),objective=shop?settlementShopObjective(state,shop):P(state);\nreturn{kind:shop?`shop`:`road`,label:shop?`AT THE COUNTER`:`YOUR NEXT STEP`,title:objective[0],text:objective[1]}}',
           'let shop=buildingEntranceInfo(state.area),objective=shop?buildingInteriorObjective(state,shop):P(state);\nreturn{kind:shop?shop.kind===`shelter`?`shelter`:`shop`:`road`,label:shop?shop.kind===`shelter`?`UNDER A ROOF`:`AT THE COUNTER`:`YOUR NEXT STEP`,title:objective[0],text:objective[1]}}',
           'give the travel ledger truthful context inside the newly enterable homes')
    labels.append('connect both resident-house approaches to the existing Reedbank streets')
    return source, labels


BUILDING_LAYOUT = r'''var buildingEntrances=[],entranceLegacyCells=[];
function buildingEntranceInfo(area){return buildingEntrances.find(building=>building.area===area)??null}
function entranceBuildingBounds(map,x,y){let pending=[{x,y}],seen=new Set,points=[];for(;pending.length;){let point=pending.pop(),key=point.x+`,`+point.y;if(seen.has(key)||map.tiles[point.y]?.[point.x]!==`T`)continue;seen.add(key);points.push(point);for(let[dx,dy]of[[0,-1],[1,0],[0,1],[-1,0]])pending.push({x:point.x+dx,y:point.y+dy})}if(!points.length)throw Error(`Missing building facade`);return{left:Math.min(...points.map(point=>point.x)),top:Math.min(...points.map(point=>point.y)),right:Math.max(...points.map(point=>point.x)),bottom:Math.max(...points.map(point=>point.y))}}
function entranceFootprint(map,bounds,approach){let rows=map.tiles.map(row=>row.split(``));for(let y=bounds.top;y<=bounds.bottom;y++)for(let x=bounds.left;x<=bounds.right;x++){if(q.includes(rows[y][x])&&map.area===`camp`)entranceLegacyCells.push({area:`camp`,x,y,to:{...approach}});rows[y][x]=`T`}map.tiles=rows.map(row=>row.join(``))}
function entranceShelterMap(area,name,resident){let width=24,height=16,rows=Array.from({length:height},(_,y)=>Array.from({length:width},(_,x)=>x>=3&&x<=20&&y>=3&&y<=13?`f`:`#`)),furnishings=[{kind:`bunk`,x:5,y:5,w:2,h:2},{kind:`bunk`,x:17,y:5,w:2,h:2},{kind:`bench`,x:5,y:11,w:2,h:1},{kind:`bench`,x:17,y:11,w:2,h:1}];for(let item of furnishings)for(let y=item.y;y<item.y+item.h;y++)for(let x=item.x;x<item.x+item.w;x++)rows[y][x]=`#`;rows[14][12]=`s`;return{area,kind:`shelter`,name,regionId:`R01`,safe:!0,recommended:[...f.camp.recommended],width,height,tiles:rows.map(row=>row.join(``)),entities:[resident],settlementParent:`camp`,buildingKind:`shelter`,furnishings}}
function entranceWorldLayout(maps){
for(let record of settlementShopRecords){let map=maps[record.parent],oldDoor={...record.door},bounds=entranceBuildingBounds(map,oldDoor.x,oldDoor.y-1);if(record.parent===`camp`){bounds={...bounds,left:oldDoor.x-1,right:oldDoor.x+1};entranceFootprint(map,bounds,{x:oldDoor.x,y:bounds.bottom+1})}let door=map.entities.find(entity=>entity.id===record.doorId);Object.assign(door,{x:oldDoor.x,y:bounds.bottom,buildingDoor:!0,buildingKind:record.kind});record.door={x:door.x,y:door.y};record.approach={x:door.x,y:door.y+1};let rows=map.tiles.map(row=>row.split(``));rows[oldDoor.y][oldDoor.x]=`d`;rows[door.y][door.x]=`s`;rows[record.approach.y][record.approach.x]=`d`;map.tiles=rows.map(row=>row.join(``));g[record.exitId]={...g[record.exitId],...record.approach,facing:`down`};let inside=maps[record.area],insideExit=inside.entities.find(entity=>entity.id===record.exitId);if(insideExit)insideExit.buildingExit=!0;buildingEntrances.push({...record,id:record.doorId,name:record.kind===`magic`?`Skill Shop`:`Weapon Shop`,bounds,entry:{x:g[record.doorId].x,y:g[record.doorId].y}})}
for(let spec of[{key:`north`,x:18,y:5,bounds:{left:17,top:4,right:19,bottom:5},name:`Reedbank Watch House`,resident:`Edda`,sprite:`iona`},{key:`south`,x:17,y:15,bounds:{left:16,top:14,right:18,bottom:15},name:`Reedbank River House`,resident:`Bram`,sprite:`merchant`}]){let area=`house-camp-${spec.key}`,doorId=`shelter-enter-camp-${spec.key}`,exitId=`shelter-leave-camp-${spec.key}`,residentId=`resident-camp-${spec.key}`,door={x:spec.x,y:spec.y},approach={x:spec.x,y:spec.y+1},resident={id:residentId,x:12,y:6,kind:`npc`,name:spec.resident,sprite:spec.sprite,hint:`Speak to ${spec.resident}`,shelterResident:!0};entranceFootprint(maps.camp,spec.bounds,approach);let outer=maps.camp.tiles.map(row=>row.split(``));outer[door.y][door.x]=`s`;outer[approach.y][approach.x]=`d`;maps.camp.tiles=outer.map(row=>row.join(``));maps.camp.entities.push({id:doorId,...door,kind:`exit`,name:spec.name,sprite:`door`,hint:`Walk into the ${spec.name.toLowerCase()}`,destination:area,travelKind:`shelter-entry`,buildingDoor:!0,buildingKind:`shelter`});let inside=entranceShelterMap(area,spec.name,resident);inside.entities.push({id:exitId,x:12,y:14,kind:`exit`,name:`Return to Reedbank`,sprite:`door`,hint:`Walk through the south door to return outside`,destination:`camp`,travelKind:`shelter-exit`,buildingExit:!0});maps[area]=inside;f[area]={name:spec.name,regionId:`R01`,safe:!0,recommended:[...f.camp.recommended]};g[doorId]={area,x:12,y:12,facing:`up`};g[exitId]={area:`camp`,...approach,facing:`down`};buildingEntrances.push({id:doorId,parent:`camp`,area,kind:`shelter`,name:spec.name,doorId,exitId,door,approach,bounds:spec.bounds,region:`R01`,residentId,residentName:spec.resident,entry:{x:12,y:12}})}
for(let area of[`camp`,`dunmere`,`fen`,`orchard`,`crown`,`veyr`]){let map=maps[area],rows=map.tiles.map(row=>row.split(``)),exit=map.entities.find(entity=>entity.id===`world-${area}`);if(area===`camp`){Object.assign(exit,{x:2,y:14});for(let x=0;x<=8;x++)rows[14][x]=`b`;for(let[x,y]of[[18,7],[15,15],[15,16],[16,16],[17,16]])rows[y][x]=`d`;Object.assign(g[`enter-camp`],{x:3,y:14,facing:`right`})}else{let material=rows[14][3]===`s`?`s`:`d`;rows[14][0]=material;rows[14][1]=material}exit.fieldEdge=`west`;if(area!==`camp`)rows[exit.y][exit.x]=`s`;map.tiles=rows.map(row=>row.join(``))}
entranceLegacyCells=entranceLegacyCells.filter(point=>!q.includes(maps[point.area].tiles[point.y][point.x]));return maps}
function entranceSavedPoint(point){if(!point||typeof point!==`object`||Array.isArray(point)||!Number.isInteger(point.x)||!Number.isInteger(point.y))return point;let cell=entranceLegacyCells.find(cell=>cell.x===point.x&&cell.y===point.y);return cell?{...point,...cell.to}:point}
function normalizeEntranceSave(save){if(!save||typeof save!==`object`||Array.isArray(save))return save;if(save.area===`camp`)save.player=entranceSavedPoint(save.player);if(save.safeReturn?.area===`camp`)save.safeReturn=entranceSavedPoint(save.safeReturn);return save}
function buildingInteriorObjective(state,building=buildingEntranceInfo(state.area)){if(!building)return P(state);if(building.kind!==`shelter`)return settlementShopObjective(state,building);return[building.name,`Speak to ${building.residentName}. The south door returns to Reedbank; the watchfire and supplies are outside.`]}
'''


RESIDENT_DIALOGUE = r'''if(id===`resident-camp-north`)return event([say(`Edda`,`Everyone who reaches Reedbank can sit out of the rain for a while. The watchfire is outside, and the quartermaster keeps medicine across the square.`)]);
if(id===`resident-camp-south`)return event([say(`Bram`,`We mend blankets here and keep a light by the river. Follow the western boardwalk when you are ready for the road.`)]);
'''
