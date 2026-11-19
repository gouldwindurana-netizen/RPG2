"""Repeatable regional rare encounters and completion-friendly equipment drops."""


def patch(source):
    labels = []

    def replace(old, new, label):
        nonlocal source
        assert source.count(old) == 1, (label, source.count(old))
        source = source.replace(old, new, 1)
        labels.append(label)

    helpers = r'''
// Regional sets can be collected for the whole party. Other unique items keep
// their catalog rules, and setAcquired remains the saved discovery history.
for(let item of ee)if(item.kind===`equipment`&&item.set_id&&oe.includes(item.region_id)){
item.unique_per_save=!1;item.source=`Repeatable regional rare drop; missing pieces first, then balanced party copies.`}
var regionalRareRate=.05;
function regionalSetPieces(region){return ee.filter(item=>item.kind===`equipment`&&item.set_id&&item.region_id===region)}
function regionalRareEligible(state,encounterId){
if(!state||typeof encounterId!==`string`||state.settings?.encounters===`off`||!he[state.area]||p(state.area,state.player.x,state.player.y))return!1;
if(encounterId===`bailiff`||d.bosses.some(enemy=>enemy.id===encounterId)||encounterId===`silver`||d.rares.some(enemy=>enemy.id===encounterId))return!1;
return encounterId.startsWith(`wild:`)||!!authoredFormations[encounterId]||he[state.area].entities.some(entity=>entity.kind===`enemy`&&entity.id===encounterId)}
function regionalRareFor(state,encounterId,random){
if(!regionalRareEligible(state,encounterId))return null;
let region=M(state.area,state.player.x,state.player.y),enemy=d.rares.find(enemy=>enemy.region_id===region);
return enemy&&random()<regionalRareRate?enemy:null}
function regionalRareDrop(state,region,random){
let pieces=regionalSetPieces(region).filter(item=>(state.inventory[item.id]??0)<99);
if(!pieces.length)return null;
let least=Math.min(...pieces.map(item=>state.inventory[item.id]??0)),pool=pieces.filter(item=>(state.inventory[item.id]??0)===least);
let item=pool[Math.min(pool.length-1,Math.max(0,Math.floor(random()*pool.length)))];
state.inventory[item.id]=(state.inventory[item.id]??0)+1;
if(!state.setAcquired.includes(item.id))state.setAcquired.push(item.id);
return item}
function regionalRareSummary(state,region=M(state.area,state.player.x,state.player.y)){
let pieces=regionalSetPieces(region).map(item=>({id:item.id,name:item.name,slot:item.slot,owned:state.inventory[item.id]??0})),discovered=pieces.filter(item=>item.owned>0).length;
return{region,enemy:d.rares.find(enemy=>enemy.region_id===region)??null,rate:regionalRareRate,pieces,discovered,complete:pieces.length>0&&discovered===pieces.length}}
'''
    replace(
        "function ge(e){return Math.max(1,l.xp_thresholds.filter(t=>e>=t).length)}",
        helpers + "function ge(e){return Math.max(1,l.xp_thresholds.filter(t=>e>=t).length)}",
        "repeatable regional set metadata and seeded rare selection helpers",
    )
    replace(
        "function k(){let e=he[a.area];return{...e,entities:e.entities.filter(e=>{",
        "function k(){let e=he[a.area];return{...e,entities:e.entities.filter(e=>{if(e.kind===`rare`)return!1;",
        "remove stationary mission-linked rare markers from every playable map",
    )
    replace(
        "if(e.kind===`rare`){let t=e.id===`silver`?`R01`:e.id.slice(0,3);if(!a.hunts[t]?.ready)return!1}",
        "",
        "retire mission-gated hunt readiness without deleting legacy save fields",
    )
    replace(
        "function j(e){a.encounterSteps=0,z.save();let t=w(),",
        "function j(e){a.encounterSteps=0;let regional=regionalRareFor(a,e,m);if(regional)e=regional.id;z.save();let t=w(),",
        "ordinary dangerous encounters can become a fixed local rare regardless of mission progress",
    )
    replace(
        "let o=a.hunts[n];if(e.kind===`rare`)o.ready=!1,o.wins=0;else if(e.kind===`normal`){let e=n===`R01`?`bailiff`:d.bosses.find(e=>e.region_id===n&&!e.optional)?.id;(n===`R01`?a.campaign.stage>=2:n===`R05`?a.campaign.stage>=7:n===`R06`?a.campaign.stage>=10:e&&a.cleared.includes(e))&&(o.wins=Math.min(12,o.wins+1),(o.wins>=12||m()<.02)&&(o.ready=!0))}e.kind===`boss`&&n===`R01`&&(o.wins=Math.min(12,a.tracks)),T(),A();",
        "T(),A();",
        "victories no longer unlock a separate after-mission hunt",
    )
    replace(
        "if(e.kind===`rare`&&RD.length){for(let[k,q]of RD)a.inventory[k]=Math.min(99,(a.inventory[k]??0)+q);s.push(`The rare foe dropped ${RD.map(([k,q])=>`${K(k).name} x${q}`).join(`, `)}.`)}",
        "if(e.kind===`rare`){let item=regionalRareDrop(a,n,m);if(item){s.push(`Rare equipment: ${item.name} ×1. Stored in the shared pack.`);let collection=regionalRareSummary(a,n);s.push(`Regional set: ${collection.discovered}/${collection.pieces.length} pieces found.${collection.complete?` Set complete — future rare victories supply additional party copies.`:``}`)}else if((a.inventory.HIGH_POTION??0)<99){a.inventory.HIGH_POTION=(a.inventory.HIGH_POTION??0)+1;s.push(`Every regional set stack is full (99 each). Received a Greater Field Potion instead.`)}else{let prior=a.gold;a.gold=Math.min(1e7,a.gold+ce[oe.indexOf(n)]);s.push(`Regional equipment and recovery stacks are full. Received ${a.gold-prior} extra gold instead.`)}}",
        "rare victories grant one missing-first regional set piece and safe explicit full-stack compensation",
    )
    replace(
        "let c=e.kind===`rare`||e.kind===`boss`&&!!d.bosses.find",
        "let c=e.kind===`boss`&&!!d.bosses.find",
        "a rare equipment drop does not also trigger the old automatic set reward",
    )
    replace(
        "n.id===`bessa`&&(a.flags.briefed=!0,a.flags.bossDefeated&&a.campaign.stage===1&&(a.hunts.R01.ready=!a.setAcquired.includes(`R01_SET_HEAD`)||!a.setAcquired.includes(`R01_SET_MANTLE`)||!a.setAcquired.includes(`R01_SET_CHARM`),T()));",
        "n.id===`bessa`&&(a.flags.briefed=!0);",
        "Bessa advances the story without creating a camp rare encounter",
    )
    replace(
        "}let mpSave=n.version===4,l=n.heroes;",
        "}for(let id of ae)if((c.inventory[id]??0)>0&&!c.setAcquired.includes(id))c.setAcquired.push(id);let mpSave=n.version===4,l=n.heroes;",
        "owned regional pieces normalize discovery history before saved gear validation",
    )
    replace(
        "c.setAcquired.some(e=>c.inventory[e]!==1)",
        "c.setAcquired.some(e=>!Ce(c.inventory[e],1,99))",
        "saved regional set copies remain bounded and usable by different party members",
    )
    replace(
        "return item?.set_id||item?.unique_per_save?Math.min(1,count):count}",
        "return item?.unique_per_save?Math.min(1,count):count}",
        "equipment copy accounting follows each catalog uniqueness rule rather than all set membership",
    )
    return source, labels
