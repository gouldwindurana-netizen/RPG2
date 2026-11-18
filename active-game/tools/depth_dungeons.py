"""Add persistent, traversable dungeon levels to the selected standalone game.

The assembly owner writes the final HTML. Existing exterior maps, saved
coordinates, NPCs, equipment chests, and main-story switches remain valid.
"""
import json


DUNGEONS = {
    'works': {'region': 'R01', 'name': 'Merewatch Bellworks', 'theme': 'bellworks', 'bosses': {'3': ['bailiff']},
        'titles': ['Inspection Hall', 'Counterweight Vault', 'The Lower Feeding Frame'],
        'threat': 'Brass guards protect fragile wisps. Lightning opens many brass frames; keep healing charges for the Bailiff.',
        'advice': 'A short first expedition. Buy field potions, inspect the counterweights, and open the service lift before the final frame.',
        'records': [
            'The inspection book counts cracked regulators but leaves the maintenance crew column blank. Someone kept the machines in better order than the people.',
            'A lowered counterweight is tied to a workers’ speaking tube. Orren’s last repair kept that tube open after the evacuation bell stopped.',
            'The lower frame takes a person’s memories as fuel. The rescue is a matter of opening the casing, not destroying the person inside.'
        ]},
    'tollhouse': {'region': 'R02', 'name': 'The Impounding Tollhouse', 'theme': 'tollhouse', 'bosses': {'4': ['B_R02_TOLL']},
        'titles': ['Holding Yard', 'Confiscated Stores', 'Dispatch Locks', 'The Departure Engine'],
        'threat': 'Armored escorts and disruptive casters make mixed packs dangerous. Carry remedies rather than spending every charge on damage.',
        'advice': 'Four levels separate the yard from the departure locks. Open service lifts, keep a revival salt, and leave enough gold for Dunmere lodging.',
        'records': [
            'The yard’s receiving list calls every captive an unpaid debt. Leth has copied the names before anyone can burn the evidence.',
            'Confiscated packs contain tools and children’s bowls. A customs clerk has marked each as a fee against an owner who cannot pay.',
            'The locks can release the carts without releasing their passengers. Neri jammed one shutter with a kitchen peel; the dent is still visible.',
            'The departure engine has no captive inside it. Its orders are crueller for being ordinary: count revenue first and people afterward.'
        ]},
    'granary': {'region': 'R03', 'name': 'The Flooded Granary', 'theme': 'flooded', 'bosses': {'5': ['B_R03_SILT']},
        'titles': ['Flooded Stores', 'Rotten Grain Sluice', 'Dry-Shelf Galleries', 'Relief Winch', 'Silt Crown Cistern'],
        'threat': 'Poisonous swarms punish long fights. Antidotes, group attacks, and a healthy reserve are worth more than one extra treasure detour.',
        'advice': 'Five levels with service valves and flooded dead ends. Keep antidotes for the return climb; recovery magic does not restore spent charges.',
        'records': [
            'Sen’s chalk marks distinguish sound grain from spoiled sacks. A full storehouse is useless when nobody records which food is safe.',
            'The sluice was closed to protect the weighing machine, flooding the lowest workers’ quarters instead. The tide line stops at a child’s height.',
            'The dry shelves hold seed, food, and a relief roster. The date beside each ration is a promise to a particular watch, not a number in reserve.',
            'The winch needed two operators. One had been working both handles for three nights. The revised roster pairs every job with a rested replacement.',
            'Silt has taken the old cistern, not the sound upper stores. Clearing it will give the shelter a real supply list instead of another estimate.'
        ]},
    'orchard': {'region': 'R04', 'name': 'Orchard Highroad', 'theme': 'roots', 'bosses': {'6': ['B_R04_HART']},
        'titles': ['Rest-house Approach', 'Buried Irrigation', 'Root-Latched Walks', 'Waste Sump', 'Seed Vault', 'Ashroot Chamber'],
        'threat': 'Roots hide mixed ambushes and lingering conditions. Keep healing supplies and antitoxins separate from the charges saved for the Hart.',
        'advice': 'Six levels beneath the highroad. Later cross-locks need their nearby wheel, while service lifts shorten a prepared second attempt.',
        'records': [
            'The keeper has a bed for every receiving shift, but no clean storehouse. Calling the rest-house a refuge will not make its food safe.',
            'The buried channels carried a clear stream until the bellworks began washing ash into the headwater. The contamination has a route and a date.',
            'A gardener tied root samples beside a maintenance receipt. The oldest damage follows the same months in which Merewatch’s regulators were enlarged.',
            'Waste was sent downhill because no downstream town appeared on the works ledger. Soren writes the missing towns into the copied diagram.',
            'The seed vault was built for future harvests. Iona leaves its sound bins sealed: today’s survivors need something that can grow after the evacuation.',
            'The Hart’s roots wind around the clean storehouse, not a source of endless food. A second refuge will need relief crews and shipments after the fight.'
        ]},
    'crown': {'region': 'R05', 'name': 'Crown Road Handover', 'theme': 'feeder', 'bosses': {'7': ['B_R05_CENSER']},
        'titles': ['Handover Court', 'Feeder Inspection', 'Blind Counterweights', 'Receiving Wards', 'Prisoner Lifts', 'The Last Feeder', 'Gate-Censer Dais'],
        'threat': 'Armored guardians cover disruptive support enemies. Bring clear tonic, revival salts, and enough group magic for the last ascent.',
        'advice': 'Seven levels make retreat a planned part of the operation. Open cross-locks and service lifts before spending your last emergency reserve.',
        'records': [
            'Halden’s handover table has two signatures for every feeder: the crew releasing it and the shelter receiving its people.',
            'A feeder inspector wrote that output improved after the captives stopped speaking. Halden does not tear out the page. It belongs in the hearing.',
            'The counterweights can be held by a latch. The old orders demanded a living keeper instead, because latches cost more than replacements.',
            'Each receiving ward has a named relief crew. Soren checks the list against Sen’s trial notes rather than trusting an official seal.',
            'The prisoner lift reaches every cell. Its first repair is a passenger rail, not a faster motor. The people leaving it need time to stand.',
            'Only this feeder still answers the central command. The receiving shelters confirm their count before Halden gives permission to disconnect it.',
            'The Censer guards intact release handles. The goal is to keep those handles usable when the guardian falls, not to turn the dais into rubble.'
        ]},
    'heart': {'region': 'R06', 'name': 'The Last Service Passage', 'theme': 'heart', 'bosses': {'4': ['B_R06_CHOIR'], '6': ['B_R06_VALE'], '8': ['B_R06_HEART']},
        'titles': ['Rear-guard Passage', 'Intake Tunnels', 'The Empty Register', 'Choir Stairwell', 'Dispatch Archive', 'Command Armor', 'Diversion Galleries', 'Heart Bell Chamber'],
        'threat': 'Three separate guardians hold the final route. Guard telegraphed attacks and keep recovery, remedies, and high-tier charges for the last chamber.',
        'advice': 'Eight levels, three guardians, and no beds below the rear guard. Service lifts allow resupply between stages; a cleared guardian stays cleared.',
        'records': [
            'The rear guard’s ledger counts people reaching Veyr. Every copied order below it must be checked against somebody who actually arrived.',
            'The intake tunnel once sorted workers by the output their memories might sustain. Neri’s convoy uses the same tunnel to move food and blankets.',
            'A register stops where the maintenance crew should begin. Empty lines are evidence too. Tavin copies them without inventing names to fill the page.',
            'The Choir has been repeating the last evacuation order to an empty receiver. Clearing the stairwell will let a living rear guard answer it.',
            'Dispatch copies record which shelters were refused supplies. These records can explain a decision; they cannot return what that decision burned.',
            'Vale’s armor is a command interface as well as a weapon. Iona marks where its bindings can be cut without killing the person inside.',
            'The diversion galleries reach the evacuation wards. Soren checks each receiving signal twice. A rescue cannot depend on a diagram being right once.',
            'The last reserve can leave through a diversion channel. It is finite. Beyond this chamber, people will keep the shelters running together.'
        ]},
}


HELPERS = r'''
// Deeper levels use existing version-three map IDs and campaign switches.
var dungeonCatalog=__CATALOG__,dungeonAreas={},dungeonFloorEntities={};
function dungeonInfo(area,x,y){let info=dungeonAreas[area];if(!info)return null;if(info.floor===1&&[`orchard`,`crown`].includes(area)&&Number.isFinite(x)&&Number.isFinite(y)&&p(area,x,y))return null;return{...info}}
function dungeonPlan(state,root){let current=dungeonInfo(state.area,state.player?.x,state.player?.y),region=M(state.area,state.player?.x??0,state.player?.y??0);root=root??current?.root??({R01:`works`,R02:`tollhouse`,R03:`granary`,R04:`orchard`,R05:`crown`,R06:`heart`}[region]);let data=dungeonCatalog[root];if(!data)return null;let info=current?.root===root?current:dungeonInfo(root),tier=Number(data.region.slice(1)),floor=info.floor,has=id=>state.campaign.switches.includes(id),recommend=tier<=2?[[`POTION`,4+tier*2],[`ANTIDOTE`,tier===1?2:1],[`CLEAR_TONIC`,tier===2?2:1],[`REVIVAL_SALT`,1]]:[[`HIGH_POTION`,tier+1],[`MENDING_BALM`,2],[`ANTIDOTE`,tier===3||tier===4?4:2],[`CLEAR_TONIC`,tier>=5?4:2],[`REVIVAL_SALT`,tier>=5?3:2]],shortcutKey=`depth_${root}_${floor}_shortcut`,shortcutOpen=floor>=3&&has(shortcutKey);return{info:{...info,rootName:data.name},nearby:!current,currentFloor:!!current,threat:data.threat,advice:data.advice,goals:[`Reach floor ${data.titles.length} with a reserve for its guardian.`,floor>=6?`Open the lower cross-lock, then inspect the eastern room for the upper ascent wheel.`:floor>=4?`Inspect this floor's cross-lock wheel before the sealed passage.`:`Inspect the marked supply cache before taking a long detour.`,`Record evidence and open service lifts; return for lodging before charges run dry.`],shortcut:{open:shortcutOpen,label:floor>=3?shortcutOpen?`Service lift open to the approach`:`Service lift wheel near the far stair`: `Service lifts begin on level 3`},supplies:recommend.map(([itemId,quantity])=>({itemId,quantity,owned:state.inventory[itemId]??0})),floors:data.titles.map((title,index)=>{let level=index+1,area=level===1?root:`${root}-depth-${level}`,visited=level===1||current?.root===root&&current.floor===level||has(`depth_${root}_${level}_seen`);return{area,floor:level,title:visited?title:`Uncharted level ${level}`,visited}})}}
function depthVisit(state){let info=dungeonInfo(state.area);if(info){let id=`depth_${info.root}_${info.floor}_seen`;state.campaign.switches.includes(id)||state.campaign.switches.push(id)}}
function depthEvent(id,state){let entity=he[state.area]?.entities.find(e=>e.id===id);if(!entity)return null;let info=dungeonInfo(state.area),data=info&&dungeonCatalog[info.root],say=(speaker,text)=>({speaker,text});if(entity.depthLever){let opened=state.campaign.switches.includes(entity.depthLever);return{switches:opened?[]:[entity.depthLever],messages:[say(entity.name,opened?`The service lift is latched open. It connects this level to the approach without restoring HP or spell charges.`:`You latch the service lift open. The route remains available after retreat and reload; its receiving platform is beside the dungeon approach.`),say(`Tavin`,opened?`The way back is ready when we need it.`:`A shorter return is supplies saved, not a reason to spend the last potion.`)]}}if(entity.depthWheel){let opened=state.campaign.switches.includes(entity.depthWheel);return{switches:opened?[]:[entity.depthWheel],messages:[say(entity.name,opened?`The cross-lock is open. The passage stays clear.`:`The counterweight catches. The marked cross-lock opens, and its latch will hold after we leave.`),say(`Soren`,`The wheel holds a latch. Nobody has to stay behind to keep this door open.`)]}}if(entity.depthBarrier)return{messages:[say(entity.name,entity.depthBarrierHint??`The cross-lock is shut. Its wheel is in the northern inspection room on this floor. The stairs behind you remain open.`)]};if(entity.depthRecord){let key=`depth_${info.root}_${info.floor}_record`,read=state.campaign.switches.includes(key);return{switches:read?[]:[key],messages:read?[say(entity.name,`The evidence is copied in the expedition notes. The original stays where its keepers can find it.`)]:[say(entity.name,data.records[info.floor-1]),say(`Iona`,`Record what we can verify. A copied page cannot undo a loss, but it can keep the next official from pretending it never happened.`),say(state.profile.name,`Keep the return route open. We bring people and evidence out together.`)]}}return null}
function depthDungeonLayout(maps){
 const addSwitch=id=>{h.includes(id)||h.push(id)},walk=(tiles,x1,y1,x2,y2)=>{w(tiles,x1,y1,x2,y2,`f`)},add=(map,entity)=>{map.entities.push(entity);let rows=map.tiles.map(row=>row.split(``));rows[entity.y][entity.x]=entity.kind===`exit`?`s`:`f`;map.tiles=rows.map(row=>row.join(``));return entity},exit=(id,x,y,name,destination,point,extra={})=>{g[id]={area:destination,...point,...extra};return{id,x,y,kind:`exit`,name,sprite:`door`,hint:name,destination,travelKind:`stairs`,stairDirection:extra.stairDirection??`down`}},roots=Object.entries(dungeonCatalog);
 for(const[root,data]of roots){let total=data.titles.length,base=maps[root];for(let floor=1;floor<=total;floor++){let area=floor===1?root:`${root}-depth-${floor}`;dungeonAreas[area]={root,region:data.region,floor,total,title:data.titles[floor-1],theme:data.theme};addSwitch(`depth_${root}_${floor}_seen`);addSwitch(`depth_${root}_${floor}_record`);if(floor>=3)addSwitch(`depth_${root}_${floor}_shortcut`);if(floor>=4)addSwitch(`depth_${root}_${floor}_crosslock`);if(floor>=6)addSwitch(`depth_${root}_${floor}_upperlock`)}
  let relocated=new Map;for(const ids of Object.values(data.bosses))for(const id of ids){let entity=base.entities.find(e=>e.id===id);if(entity){relocated.set(id,{...entity});base.entities=base.entities.filter(e=>e.id!==id)}}
  for(let floor=2;floor<=total;floor++){let area=`${root}-depth-${floor}`,tiles=C(40,24,`#`,`#`);for(const[x,y]of[[5,5],[19,5],[34,5],[5,18],[19,18],[34,18]])T(tiles,x-3,y-3,7,7,`f`);for(const[x1,y1,x2,y2]of[[5,18,5,5],[5,5,19,5],[19,5,19,18],[19,18,34,18],[34,18,34,5]])walk(tiles,x1,y1,x2,y2);if(floor>=3){T(tiles,10,9,5,5,`f`);walk(tiles,12,5,12,11)}if(floor>=5){T(tiles,24,8,5,5,`f`);walk(tiles,26,18,26,10)}
   f[area]={name:`${data.name} · Floor ${floor}: ${data.titles[floor-1]}`,regionId:data.region,safe:!1,recommended:[...f[root].recommended]};let entities=[],previous=floor===2?root:`${root}-depth-${floor-1}`,returnPoint=floor===2?{x:26,y:3,facing:`left`}:{x:34,y:5,facing:`left`};entities.push(exit(`depth-up-${root}-${floor}`,3,18,`Ascend to level ${floor-1}`,previous,returnPoint,{stairDirection:`up`}));
   if(floor<total){let gate=root===`heart`&&floor===4?{requiredSwitch:`choir_defeated`,blockedText:`Clear the Night Choir before taking the command stair.`}:root===`heart`&&floor===6?{requiredSwitch:`vale_defeated`,blockedText:`Pull Vale free of the command armor before taking the diversion stair.`}:{};entities.push(exit(`depth-down-${root}-${floor}`,35,5,`Descend to level ${floor+1} of ${total}`,`${root}-depth-${floor+1}`,{x:4,y:18,facing:`right`},{...gate,stairDirection:`down`}))}
   let supplies=Number(data.region.slice(1))<=2?(floor%2?{POTION:1,ANTIDOTE:1}:{POTION:2}):floor%2?{HIGH_POTION:1,CLEAR_TONIC:1}:{HIGH_POTION:1,ANTIDOTE:1};if(root===`heart`&&[5,7].includes(floor))supplies.REVIVAL_SALT=1;let cachePoint=floor>=6?{x:27,y:10}:floor>=5?{x:26,y:10}:floor>=3?{x:12,y:11}:{x:6,y:4},recordPoint=floor>=5?{x:12,y:11}:{x:4,y:6};entities.push({id:`depth-cache-${root}-${floor}`,...cachePoint,kind:`chest`,name:`Marked field-supply cache`,sprite:`chest`,hint:`Inspect the sealed expedition supplies`,depthSupplies:supplies},{id:`depth-note-${root}-${floor}`,...recordPoint,kind:`npc`,name:`${data.titles[floor-1]} record`,sprite:`lantern`,hint:`Read and copy the expedition record`,depthRecord:!0});
   if(floor>=3){let key=`depth_${root}_${floor}_shortcut`,rootX=3+(floor-2)*2,rootY=16;entities.push({id:`depth-lever-${root}-${floor}`,x:33,y:6,kind:`npc`,name:`Service-lift wheel`,sprite:`lantern`,hint:`Latch open a return route to the approach`,depthLever:key},exit(`depth-shortcut-${root}-${floor}`,34,6,`Service lift to the approach`,root,{x:rootX-1,y:rootY,facing:`left`},{requiredSwitch:key,blockedText:`The service lift is not latched. Turn the wheel beside this platform.`,stairDirection:`up`}));add(base,{...exit(`depth-return-${root}-${floor}`,rootX,rootY,`Service lift to level ${floor}`,area,{x:32,y:6,facing:`right`},{requiredSwitch:key,stairDirection:`down`}),depthHideUntil:key})}
   if(floor>=4){let key=`depth_${root}_${floor}_crosslock`;entities.push({id:`depth-wheel-${root}-${floor}`,x:19,y:6,kind:`npc`,name:`Cross-lock wheel`,sprite:`lantern`,hint:`Open the marked cross-lock on this level`,depthWheel:key},{id:`depth-gate-${root}-${floor}`,x:26,y:18,kind:`npc`,name:`Sealed cross-lock`,sprite:`door`,hint:`The wheel is in the northern inspection room`,depthBarrier:!0,depthOpenWhen:key})}
   if(floor>=6){let key=`depth_${root}_${floor}_upperlock`;entities.push({id:`depth-upper-wheel-${root}-${floor}`,x:26,y:11,kind:`npc`,name:`Upper cross-lock wheel`,sprite:`lantern`,hint:`Latch open the upper ascent from the eastern inspection room`,depthWheel:key},{id:`depth-upper-gate-${root}-${floor}`,x:34,y:11,kind:`npc`,name:`Sealed upper cross-lock`,sprite:`door`,hint:`The upper wheel is in the eastern inspection room`,depthBarrier:!0,depthBarrierHint:`The upper cross-lock is shut. Its wheel is in the eastern inspection room, reached from the lower gallery. The stairs behind you remain open.`,depthOpenWhen:key})}
   for(const[index,x,y]of[[0,6,12],[1,20,12],[2,35,13]]){let id=`depth-patrol-${root}-${floor}-${index}`;le.push(id);entities.push({id,x,y,kind:`enemy`,name:`Floor ${floor} passage watch`,sprite:index===1?`wisp`:`hound`,hint:`Challenge the fixed regional passage watch`});tiles[y][x]=`f`}
   for(const id of data.bosses[String(floor)]??[]){let boss=relocated.get(id);if(boss)entities.push({...boss,x:34,y:3})}
   maps[area]={...E(area,tiles,entities),area,kind:`dungeon`};dungeonFloorEntities[area]=entities.map(e=>e.id)
  }
  add(base,exit(`depth-down-${root}-1`,27,3,`Descend to level 2 of ${total}`,`${root}-depth-2`,{x:4,y:18,facing:`right`},{stairDirection:`down`}));
 }
 return maps
}
'''


def patch(source):
    labels=[]
    def once(old,new,label):
        nonlocal source
        count=source.count(old)
        assert count==1,f'{label}: {count} anchors'
        source=source.replace(old,new,1);labels.append(label)

    helpers=HELPERS.replace('__CATALOG__',json.dumps(DUNGEONS,separators=(',',':'),ensure_ascii=False))
    once('var he=expansionWorldLayout(travelMapLayout(j({camp:pe(),works:me()})));',helpers+'\nvar he=depthDungeonLayout(expansionWorldLayout(travelMapLayout(j({camp:pe(),works:me()}))));','six progressively longer dungeon expeditions preserve exterior sites')
    once('function F(e,t){let side=sideStoryEvent(e,t);','function F(e,t){let depth=depthEvent(e,t);if(depth)return depth;let side=sideStoryEvent(e,t);','readable dungeon evidence and persistent route wheels')
    once('entities:e.entities.filter(e=>{if(e.kind===`enemy`','entities:e.entities.filter(e=>{if(e.depthHideUntil&&!a.campaign.switches.includes(e.depthHideUntil)||e.depthOpenWhen&&a.campaign.switches.includes(e.depthOpenWhen))return!1;if(e.kind===`enemy`','persistent cross-locks and return lifts filter actual blocking entities')
    once('if(target.area===`works`&&!a.flags.briefed)','if(dungeonInfo(target.area)?.root===`works`&&!a.flags.briefed)','briefing requirement applies throughout the opening bellworks')
    once('a.area=target.area,a.player={...point,facing},walking&&a.steps++','a.area=target.area,a.player={...point,facing},depthVisit(a),walking&&a.steps++','record floor discovery without refreshing resources')
    once('else if(n.kind===`chest`)a.campaign.openedChests.push(n.id)', 'else if(n.kind===`chest`&&n.depthSupplies){if(a.campaign.openedChests.includes(n.id))return;a.campaign.openedChests.push(n.id);let lines=[];for(let[id,amount]of Object.entries(n.depthSupplies)){let old=a.inventory[id]??0;a.inventory[id]=Math.min(99,old+amount);lines.push(`Received ${a.inventory[id]-old} × ${K(id).name}.`)}a.reward={title:n.name,lines:[...lines,`This cache is now empty. HP and spell charges are unchanged.`],source:`chest`,choices:[]},a.mode=`victory`,l(),z.save()}else if(n.kind===`chest`)a.campaign.openedChests.push(n.id)','one-time field supplies use the existing chest save ledger')
    old='function encounterEligible(region,state){let deep={R01:`works`,R02:`tollhouse`,R03:`granary`,R04:`orchard`,R05:`crown`,R06:`heart`}[region],ready=state.area===deep&&(region!==`R01`||state.cleared.filter(id=>/^encounter[1-6]$/.test(id)).length>=2),post=region!==`R01`||state.campaign.stage>=2;return encounterTables[region].filter(row=>!row.deep||ready&&(post||row.members.length<=6))}'
    new='function encounterEligible(region,state){let info=dungeonInfo(state.area,state.player?.x,state.player?.y),level=info?.region===region?info.floor:0,ready=level>=2,post=region!==`R01`||state.campaign.stage>=2;return encounterTables[region].filter(row=>{if(!row.deep)return!0;if(!ready)return!1;let count=row.members.length;if(!post&&count>6)return!1;if(count>=7&&level<3||count===9&&level<Math.max(3,(info?.total??3)-1))return!1;if(row.id.endsWith(`four-guards`)&&level<3||row.id.endsWith(`crested-leader`)&&level<Math.ceil((info?.total??3)*.65))return!1;return!0})}'
    once(old,new,'deeper fixed regional groups unlock by floor rather than party level')
    return source,labels
