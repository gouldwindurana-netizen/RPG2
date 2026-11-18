"""Make ward stats effective and keep field supplies from silently wasting copies."""


def patch(source):
    labels = []

    def once(old, new, label):
        nonlocal source
        count = source.count(old)
        if count != 1:
            raise AssertionError(f'{label}: expected one anchor, found {count}')
        source = source.replace(old, new, 1)
        labels.append(label)

    once('defense:2+Math.floor((t-1)/3)+s(`defense`),magic:',
         'defense:2+Math.floor((t-1)/3)+s(`defense`),magicDefense:s(`magicDefense`),magic:',
         'derive magic defense from the equipped copies without changing base stats')
    once('Math.round(t.attack*(c?3:1.4)+m()*4)-o.defense)',
         'Math.round(t.attack*(c?3:1.4)+m()*4)-o.defense-([`WISP`,`CANTOR`].includes(t.family)?o.magicDefense??0:0))',
         'apply ward equipment to magical pulses while preserving physical damage and mitigation order')
    once('[`Defense`,r.defense],[`Magic`,r.magic]',
         '[`Defense`,r.defense],[`Magic defense`,r.magicDefense],[`Magic`,r.magic]',
         'show effective magic defense in the status panel')
    once('· DEF ${r.defense} · MAG ${r.magic}',
         '· DEF ${r.defense} · MDEF ${r.magicDefense} · MAG ${r.magic}',
         'show effective magic defense in the equipment summary')
    once('<strong>DEF:</strong> ${hero.defense}</p><p><strong>MAG:',
         '<strong>DEF:</strong> ${hero.defense}</p><p><strong>MDEF:</strong> ${hero.magicDefense}</p><p><strong>MAG:',
         'preserve the uploaded status display while adding its missing ward statistic')

    helper = r'''// Shared field and battle item eligibility. Tea tiers are explicit and one-based.
function consumableValid(state,itemId,target,{battlePlanning=!1,tier}={}){if(!state||![`explore`,`battle`].includes(state.mode)||!target||!(state.inventory?.[itemId]>0))return!1;let battle=state.mode===`battle`;if(battle&&!ue.includes(itemId))return!1;if(itemId===`REVIVAL_SALT`)return target.hp===0;if(target.hp<=0)return!1;if(itemId===`SPARK_TEA`||itemId===`DEEP_TEA`)return!battle&&Number.isInteger(tier)&&tier>=1&&tier<=(itemId===`SPARK_TEA`?2:4)&&target.charges[tier-1]<target.maxCharges[tier-1];if([`POTION`,`HIGH_POTION`,`MENDING_BALM`,`CAMP_MEAL`].includes(itemId))return(!battle||itemId!==`CAMP_MEAL`)&&(battle&&battlePlanning||target.hp<target.maxHp);return itemId===`ANTIDOTE`&&target.status===`poison`||itemId===`SOOTHING_DRAUGHT`&&target.status===`sleep`||itemId===`CLEAR_TONIC`&&target.status===`silence`}
'''
    once('function Ee(e={}){', helper+'function Ee(e={}){',
         'share item eligibility between field menus and engine checks')
    once('function L(e,t){return a.inventory[e]>0?e===`REVIVAL_SALT`?t.hp===0:t.hp<=0?!1:[`POTION`,`HIGH_POTION`,`MENDING_BALM`].includes(e)?!0:e===`ANTIDOTE`&&t.status===`poison`||e===`SOOTHING_DRAUGHT`&&t.status===`sleep`||e===`CLEAR_TONIC`&&t.status===`silence`:!1}',
         'function L(e,t,battlePlanning=!1,tier){return consumableValid(a,e,t,{battlePlanning,tier})}',
         'reject ineffective consumables without reserving or spending their copies')
    once('function R(e,t){return L(e,t)?(e===`REVIVAL_SALT`?t.hp=Math.max(1,Math.floor(t.maxHp*.2)):e===`ANTIDOTE`||e===`SOOTHING_DRAUGHT`||e===`CLEAR_TONIC`?t.status=null:t.hp=Math.min(t.maxHp,t.hp+(e===`POTION`?60:e===`HIGH_POTION`?250:120)),--a.inventory[e],!0):!1}',
         'function R(e,t,tier){return L(e,t,!1,tier)?(e===`SPARK_TEA`||e===`DEEP_TEA`?t.charges[tier-1]++:e===`REVIVAL_SALT`?t.hp=Math.max(1,Math.floor(t.maxHp*.2)):e===`ANTIDOTE`||e===`SOOTHING_DRAUGHT`||e===`CLEAR_TONIC`?t.status=null:t.hp=Math.min(t.maxHp,t.hp+(e===`POTION`?60:e===`HIGH_POTION`?250:e===`CAMP_MEAL`?Math.max(1,Math.floor(t.maxHp*.3)):120)),--a.inventory[e],!0):!1}',
         'make owned field meals and chosen tea tiers work and keep redundant recovery items')
    once('!r||!L(t.itemId,r)||Object.entries(n.plans)',
         '!r||!L(t.itemId,r,!0)||Object.entries(n.plans)',
         'retain anticipatory battle healing plans before an ally takes damage')
    once('useItem(e,t){if(a.mode!==`explore`||a.reward)return!1;let n=a.heroes.find(e=>e.id===t);return!n||!R(e,n)?!1:',
         'useItem(e,t,tier){if(a.mode!==`explore`||a.reward)return!1;let n=a.heroes.find(e=>e.id===t);return!n||!R(e,n,tier)?!1:',
         'accept an explicit field tea tier without changing existing item callers')
    return source, labels
