"""Original route, merchant and optional-story additions to the active upload.

The driver owns file writes.  The patch keeps every existing main-story event and
save coordinate, and adds only explicitly named routes, NPCs and quest switches.
"""

def patch(source: str) -> tuple[str, list[str]]:
    labels=[]
    def once(old,new,label):
        nonlocal source
        count=source.count(old)
        if count!=1:
            raise ValueError(f'{label}: expected one anchor, found {count}')
        source=source.replace(old,new,1);labels.append(label)

    helpers=r'''// Local services and optional stories share the same geography and saved switches.
var sideStorySwitches=[`courier_started`,`courier_parcel`,`courier_delivered`,`relief_started`,`relief_packed`,`relief_delivered`,`family_started`,`family_copied`,`family_memorial`];
for(const id of sideStorySwitches)if(!h.includes(id))h.push(id);
function sideQuestSummary(state){const has=id=>state.campaign.switches.includes(id);return[
 {id:`courier`,title:`The Letter That Came Back`,complete:has(`courier_delivered`),text:has(`courier_delivered`)?`Mira delivered the courier's final letter without inventing an answer for the people who were lost.`:has(`courier_parcel`)?`Carry the sealed parcel to Mira in Dunmere. The north bridge opens after Reedbank's convoy departs.`:has(`courier_started`)?`Inspect the old courier waystone at the end of the southern Reedbank road, beyond the little bridge.`:`Ask the Reedbank courier beside the watchfire about the road that ends at the old waystone.`},
 {id:`relief`,title:`Room for the Next Watch`,complete:has(`relief_delivered`),text:has(`relief_delivered`)?`Rook's relief crew has its blankets, medicines and a place on the shelter roster.`:has(`relief_packed`)?`Take Jessa's dry supply bundle to Rook at the Orchard rest-house.`:has(`relief_started`)?`After clearing Silt Crown, inspect the dry shelves in the flooded granary.`:`Speak to Jessa in Alder Fen about supplying the relief watch.`},
 {id:`family`,title:`Names Beside the Door`,complete:has(`family_memorial`),text:has(`family_memorial`)?`Anet's memorial records both the survivors and those who did not return, with families choosing what is shared.`:has(`family_copied`)?`Return the copied crew ledger to the memorial board in Veyr's refuge quarter.`:has(`family_started`)?`Find the crew ledger in the final service passage. Do not delay an evacuation to retrieve it.`:`Speak to Anet in Veyr about the names missing from the receiving lists.`}
]}
function sideStoryEvent(id,state){const has=key=>state.campaign.switches.includes(key),say=(speaker,text)=>({speaker,text}),event=(messages,switches=[],reward)=>({messages,switches,...reward?{reward}:{}});
 if(id===`courier-keeper`){if(has(`courier_delivered`))return event([say(`Perrin`,`Mira sent a receipt with two names and a date. It is a small piece of paper. It is enough to tell me I did not leave that promise beside the road.`)]);if(has(`courier_started`))return event([say(`Perrin`,`The old waystone is south of Merewatch's field approach. Follow the little road over its bridge to the end. If the parcel survived, keep the seal closed and take it to Mira in Dunmere.`)]);return event([
  say(`Perrin`,`I used to carry letters between the shelters. Last winter I dropped a parcel at the southern waystone when the fog came over the little bridge.`),
  say(`Tavin`,`You came back. That matters more than a parcel.`),
  say(`Perrin`,`It matters. So does the person still waiting for it. Mira in Dunmere keeps the receiving book. Will you look when your road takes you that way?`),
  say(state.profile.name,`We will look. We will not open someone else's letter to make a better story out of it.`)
 ],[`courier_started`])}
 if(id===`courier-waystone`){if(has(`courier_delivered`))return event([say(`Old courier waystone`,`A newer mark has been cut below the worn route number: Received. The road's end is no longer an unanswered question.`)]);if(!has(`courier_started`))return event([say(`Old courier waystone`,`A sealed oilskin parcel rests beneath the route stone. The knot carries a Reedbank courier's mark. Someone at the shelter may know who left it.`)]);if(has(`courier_parcel`))return event([say(`Tavin`,`The parcel is safe in our pack. Mira's receiving book is in Dunmere, beyond the north bridge.`)]);return event([
  say(`Tavin`,`Oilskin, two knots, the wax still whole. Perrin knew the rain on this road.`),
  say(`Iona`,`The address is smudged. Leave the seal intact. A receiving clerk can match the route mark without reading the letter.`),
  say(`Soren`,`I will copy the waystone's position. Future couriers should know where the bridge leads, and where the road ends.`),
  say(state.profile.name,`A detour with a purpose. We take the parcel to Mira when Dunmere's road opens.`)
 ],[`courier_parcel`])}
 if(id===`courier-witness`){if(has(`courier_delivered`))return event([say(`Mira`,`The letter reached the family. They asked for privacy. Their receipt is all the road needs to know.`)]);if(!has(`courier_parcel`))return event([say(`Mira`,`Every courier mark has a receiving entry. A late letter is still a letter; bring me a sealed parcel and I can find its destination without breaking the seal.`)]);return event([
  say(`Mira`,`Perrin's route mark. I have kept this line open since winter.`),
  say(`Tavin`,`We found the parcel at the old waystone. We did not read it.`),
  say(`Mira`,`Thank you. The sender did not come home. That does not give us the right to decide what their last words should mean.`),
  say(`Iona`,`And the person receiving it can choose whether to read it today, or later.`),
  say(`Mira`,`I will deliver it myself. Take this road fund and an antitoxin for the return journey. Tell Perrin the receiving line has a date now.`)
 ],[`courier_delivered`],{gold:60,items:{ANTIDOTE:1}})}
 if(id===`relief-keeper`){if(has(`relief_delivered`))return event([say(`Jessa`,`The next watch arrived with dry blankets before the first watch fell asleep. That is the sort of miracle I can budget for.`)]);if(has(`relief_started`))return event([say(`Jessa`,`The granary's dry shelves hold the bundle. Clear Silt Crown first. Rook is waiting at the Orchard rest-house; the pass opens when Sen's trial is complete.`)]);return event([
  say(`Jessa`,`A shelter schedule says four keepers. Mine says four keepers, eight blankets, medicine for the one who gets a fever, and someone to carry supper.`),
  say(`Soren`,`The calculations never asked who carried supper.`),
  say(`Jessa`,`Then the calculations expected somebody else's unpaid hands. I packed a relief bundle on the granary's dry shelves before it flooded.`),
  say(`Iona`,`We will recover the sound supplies after the clearance. Spoiled medicine stays marked and left behind.`),
  say(`Jessa`,`Take the bundle to Rook at the Orchard when Sen opens the pass. The second refuge needs rested people, not another heroic last watch.`)
 ],[`relief_started`])}
 if(id===`relief-stores`){if(has(`relief_delivered`))return event([say(`Dry shelves`,`Only the marked spoiled sacks remain. The safe supplies have reached the relief watch.`)]);if(!has(`relief_started`))return event([say(`Dry shelves`,`A dry bundle is labeled Jessa — relief watch. Ask its keeper in Alder Fen before taking another crew's supplies.`)]);if(!has(`silt_defeated`))return event([say(`Iona`,`Silt Crown still holds the stores. We will not send anyone into these shelves before the granary is secure.`)]);if(has(`relief_packed`))return event([say(`Iona`,`We have Jessa's sound supplies. Rook's crew is at the Orchard rest-house.`)]);return event([
  say(`Iona`,`Sealed medicine, dry blankets, a list of the people trained to use them. These can travel.`),
  say(`Tavin`,`And one tin marked supper, not emergency reserve. Jessa knows us unreasonably well.`),
  say(`Soren`,`I am adding the carrier to the receiving list. A bundle cannot take itself over the pass.`),
  say(state.profile.name,`We take only the marked bundle. The granary's food stores belong to the shelters.`)
 ],[`relief_packed`])}
 if(id===`relief-crew`){if(has(`relief_delivered`))return event([say(`Rook`,`I slept through an entire shift. When I woke, the ward was still there and somebody else had washed the bowls. We are learning.`)]);if(!has(`relief_packed`))return event([say(`Rook`,`I came to relieve the Orchard watch. Jessa has a supply list in Alder Fen. Without her bundle we can take a shift, but we cannot keep doing it.`)]);return event([
  say(`Rook`,`Blankets first. I have two keepers pretending they are not shivering.`),
  say(`Iona`,`The medicine is labeled. The carrier is on the list, and the spare watch knows where supper is.`),
  say(`Rook`,`Then give me the board. I can change the roster before someone collapses rather than after.`),
  say(`Soren`,`The refuge is not a machine running unattended. It is people making room for the next person.`),
  say(`Rook`,`Keep this receiving stipend and a field potion. You brought us a shift we can actually finish.`)
 ],[`relief_delivered`],{gold:120,items:{HIGH_POTION:1}})}
 if(id===`family-archivist`){if(has(`family_memorial`))return event([say(`Anet`,`The memorial is not finished forever. Families can correct it. Survivors can add the names they want us to use now.`)]);if(has(`family_started`))return event([say(`Anet`,`The crew ledger was kept in the final service passage. Copy the receiving and departure marks if the way is safe. People come before paper.`)]);return event([
  say(`Anet`,`Leth has accounted for the maintenance crew. I am speaking with their families. Some names have arrived with a person; some have only arrived on a list.`),
  say(`Tavin`,`A list can tell you a road. It cannot tell you how somebody wants to be greeted at its end.`),
  say(`Anet`,`There is a crew ledger in the final service passage. Its departure marks can confirm the dates the families are missing.`),
  say(`Iona`,`We copy it only if the route is safe. Nobody waits inside a feeding chamber because we wanted a complete record.`),
  say(`Anet`,`Agreed. Bring a copy to the memorial board. The families choose which words become public.`)
 ],[`family_started`])}
 if(id===`family-records`){if(has(`family_copied`))return event([say(`Crew ledger`,`The necessary dates have been copied. The original remains marked for the relief archivists; the party has not taken another patient's record.`)]);if(!has(`family_started`))return event([say(`Crew ledger`,`The maintenance crew's receiving and departure dates are recorded here. Anet in Veyr is helping their families decide what should be copied.`)]);return event([
  say(`Soren`,`The receiving dates match Leth's accounts. These marks are transfers; these two are deaths. We write the difference plainly.`),
  say(`Iona`,`We cannot return the dead, or the memories the machinery burned. We can stop making the families guess which silence means which loss.`),
  say(`Tavin`,`Copy the dates. Leave the patients' private notes where their keepers can protect them.`),
  say(state.profile.name,`We have enough. Mark the ledger for the archivists and keep the evacuation road clear.`)
 ],[`family_copied`])}
 if(id===`family-memorial`){if(has(`family_memorial`))return event([say(`Memorial board`,`Beside the confirmed names is a blank space for corrections. Beneath it: Ask before you tell another person's story.`)]);if(!has(`family_copied`))return event([say(`Memorial board`,`Anet has left room for confirmed dates and the names families choose to share. A blank line is better than an invented answer.`)]);return event([
  say(`Anet`,`These dates answer three questions the families have asked every morning. They will not answer every question.`),
  say(`Iona`,`Tell them what we know, what we do not know, and which records are private.`),
  say(`Anet`,`One family wants the old name written. A survivor wants the name she chose last month. Both belong here because they were asked.`),
  say(`Tavin`,`Leave room to change a line. A record should be a way to find people, not a wall built around them.`),
  say(`Anet`,`The board stays open for corrections. Take the archive stipend and a mending balm for the road. You brought back answers without leaving people behind.`)
 ],[`family_memorial`],{gold:200,items:{MENDING_BALM:1}})}
 return null;
}
function expansionWorldLayout(maps){
 const set=(map,x,y,tile)=>{let row=Array.from(map.tiles[y]);row[x]=tile;map.tiles[y]=row.join(``)},road=(map,x1,y1,x2,y2,tile=`d`)=>{let x=x1,y=y1;set(map,x,y,tile);while(x!==x2||y!==y2){if(x!==x2)x+=Math.sign(x2-x);else y+=Math.sign(y2-y);set(map,x,y,tile)}};
 const world=maps.overworld;
 const removed=new Set([`road-reedbank`,`pass-fen`,`road-orchard`,`gate-crown`]);world.entities=world.entities.filter(entity=>!removed.has(entity.id));for(const id of removed)delete g[id];
 const gates=[['road-dunmere',8,26,`y`,`Bridge`,'b'],['pass-orchard',34,28,`x`,`High pass`,'s'],['road-crown',46,23,`y`,`High pass`,'s'],['gate-veyr',53,11,`y`,`City gate`,'s']];
 for(const[id,x,y,axis,name,tile]of gates){const marker=world.entities.find(entity=>entity.id===id);Object.assign(marker,{x,y,name,hint:`Cross the ${name.toLowerCase()}`,travelKind:`crossing`});Object.assign(g[id],{x,y,walkThrough:!0,axis});set(world,x,y,tile)}
 // Existing entrance coordinates remain stable; the visible paths meet their actual thresholds.
 for(const path of [[8,27,8,32],[8,25,8,20],[8,31,15,31],[8,21,23,21],[18,21,18,19],[26,21,28,21],[28,17,28,28],[28,17,29,17],[28,21,28,22],[28,28,33,28],[35,28,46,28],[41,28,41,29],[46,24,46,28],[46,18,46,22],[46,18,53,18],[53,12,53,18],[53,7,53,10],[53,7,58,7],[58,5,58,7]])road(world,...path);
 road(world,15,31,15,36);set(world,15,34,'b');
 const add=(area,id,x,y,name,sprite=`lantern`,extra={})=>{const map=maps[area];if(!map.entities.some(entity=>entity.id===id))map.entities.push({id,x,y,kind:`npc`,name,sprite,hint:`Speak to ${name}`,...extra});if(!`gdsfb`.includes(map.tiles[y][x]))set(map,x,y,`d`)};
 const towns={camp:[10,6,23,6],dunmere:[7,6,24,6],fen:[7,6,24,6],orchard:[7,6,14,6],crown:[7,6,15,6],veyr:[7,6,24,6]};
 for(const[area,[wx,wy,mx,my]]of Object.entries(towns)){const map=maps[area],old=map.entities.find(entity=>entity.id===`merchant`||entity.id.startsWith(`shop-`));if(old)Object.assign(old,{name:`Item Shop`,hint:`Buy and sell field supplies`,shopKind:`items`});add(area,`weapon-${area}`,wx,wy,`Weapon Shop`,`merchant`,{shopKind:`weapon`,hint:`Buy and sell weapons and armor`});add(area,`magic-${area}`,mx,my,`Magic Shop`,`soren`,{shopKind:`magic`,hint:`Learn spells for one traveler`});for(const x of[wx,mx]){set(map,x,7,`d`);if(map.tiles[8]&&map.tiles[8][x]!==`w`)set(map,x,8,`d`)}}
 add(`camp`,`courier-keeper`,13,7,`Perrin`,`merchant`);
 add(`overworld`,`courier-waystone`,15,36,`Old waystone`,`lantern`,{hint:`Inspect the old courier waystone`});
 add(`dunmere`,`courier-witness`,20,10,`Mira`,`iona`);
 add(`fen`,`relief-keeper`,9,10,`Jessa`,`iona`);
 add(`granary`,`relief-stores`,15,10,`Dry shelves`,`lantern`,{hint:`Inspect Jessa's marked supplies`});
 add(`orchard`,`relief-crew`,10,13,`Rook`,`merchant`);
 add(`veyr`,`family-archivist`,10,9,`Anet`,`bessa`);
 add(`veyr`,`family-memorial`,8,7,`Memorial`,`lantern`,{hint:`Read the memorial board`});
 add(`heart`,`family-records`,18,13,`Crew ledger`,`lantern`,{hint:`Copy the crew ledger`});
 return maps;
}
'''
    once('var he=travelMapLayout(j({camp:pe(),works:me()}));',helpers+'var he=expansionWorldLayout(travelMapLayout(j({camp:pe(),works:me()})));','continuous authored crossings, separate services and optional story locations')
    once('function F(e,t){let n=t.campaign.stage,','function F(e,t){let side=sideStoryEvent(e,t);if(side)return side;let n=t.campaign.stage,','optional quest events coexist with the existing main story')
    once('&&n>=8&&n<=16?!0:e===`heart`','&&n>=2&&n<=16?!0:e===`heart`','include northern storefronts in calm outpost courts')
    old='function D(e){if(e){e.stage!==void 0&&(a.campaign.stage=Math.max(a.campaign.stage,e.stage));for(let t of e.switches??[])a.campaign.switches.includes(t)||a.campaign.switches.push(t);a.flags.completed=a.campaign.stage===10,E(e.messages)}}'
    new='function D(e){if(e){let fresh=(e.switches??[]).some(id=>!a.campaign.switches.includes(id));e.stage!==void 0&&(a.campaign.stage=Math.max(a.campaign.stage,e.stage));for(let t of e.switches??[])a.campaign.switches.includes(t)||a.campaign.switches.push(t);if(fresh&&e.reward){if(Number.isInteger(e.reward.gold)&&e.reward.gold>0)a.gold=Math.min(1e7,a.gold+e.reward.gold);for(const[id,amount]of Object.entries(e.reward.items??{}))if(K(id)?.kind===`consumable`&&Number.isInteger(amount)&&amount>0)a.inventory[id]=Math.min(99,(a.inventory[id]??0)+amount)}a.flags.completed=a.campaign.stage===10,E(e.messages)}}'
    once(old,new,'once-only modest optional quest supplies and gold')
    once('let from=a.area,point={x:target.x,y:target.y},facing=target.facing??`down`;if(from===`overworld`&&target.area!==`overworld`)', 'let from=a.area,point={x:target.x,y:target.y},facing=target.facing??`down`;if(from===`overworld`&&target.area===`overworld`&&target.walkThrough){let dx=exit.x-approach.x,dy=exit.y-approach.y;if(dx===0&&dy===0){let direction={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[a.player.facing];dx=direction[0];dy=direction[1]}if(Math.abs(dx)+Math.abs(dy)!==1||target.axis===`x`&&dy!==0||target.axis===`y`&&dx!==0)return!1;point={x:exit.x+dx,y:exit.y+dy};if(!travelFree(`overworld`,point))return!1;facing=dx?dx>0?`right`:`left`:dy>0?`down`:`up`}if(from===`overworld`&&target.area!==`overworld`)', 'cross a physical bridge or pass in either direction')
    once('else if(from===`overworld`)facing=target.facing??travelFacing(exit,point,a.player.facing);','else if(from===`overworld`&&!target.walkThrough)facing=target.facing??travelFacing(exit,point,a.player.facing);','retain crossing direction instead of old portal orientation')
    return source,labels
