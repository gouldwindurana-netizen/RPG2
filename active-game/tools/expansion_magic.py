"""Spell learning and separate merchants for the authoritative standalone build.

This is a surgical forward patch, never a bundle regenerated from RPG2.
"""


def patch(source: str) -> tuple[str, list[str]]:
    changes: list[str] = []

    def replace(old: str, new: str, label: str) -> None:
        nonlocal source
        count = source.count(old)
        if count != 1:
            raise ValueError(f"{label}: expected one source anchor, found {count}")
        source = source.replace(old, new, 1)
        changes.append(label)

    anchor = 'function H(e,t){return V(e.job).spellIds.includes(t.id)}'
    helpers = r'''// Learning is tracked by stable hero id so custom lead names do not affect saves.
var spellPrices=[35,100,250,500,900,1500,2400,3500];
function knowsSpell(state,hero,spell){return!!hero&&!!spell&&H(hero,spell)&&Array.isArray(state.learnedSpells?.[hero.id])&&state.learnedSpells[hero.id].includes(spell.id)}
function starterSpellLists(profile){return Object.fromEntries(ne.map(id=>{let job=ve(id,profile);return[id,job===`mender`?[`mend`]:job===`arcanist`?[`ember`]:job===`spellblade`?[`mend`,`ember`]:[]]}))}
function spellOffers(state,heroId){let hero=state.heroes.find(candidate=>candidate.id===heroId);return hero?te.filter(spell=>H(hero,spell)).map(spell=>({spellId:spell.id,price:spellPrices[spell.tier-1],known:knowsSpell(state,hero,spell),unlocked:hero.maxCharges[spell.tier-1]>0})):[]}
function shopAccepts(state,item){let speaker=state.message?.speaker;return!!item&&(speaker===`Magic Shop`?!1:speaker===`Weapon Shop`?item.kind===`equipment`:speaker===`Item Shop`?item.kind===`consumable`:!0)}
'''
    replace(anchor, anchor + helpers, 'shared learning and merchant helpers')

    replace('heroes:ne.map(e=>be(e,1,ye(e,t),t)),inventory:n,',
            'heroes:ne.map(e=>be(e,1,ye(e,t),t)),learnedSpells:starterSpellLists(t),inventory:n,',
            'new journeys start with job-specific starter spells')

    anchor = 'c.setAcquired.some(e=>c.inventory[e]!==1))return null;let f=e=>'
    migration = r'''c.setAcquired.some(e=>c.inventory[e]!==1))return null;
// Missing learning data identifies a legacy save: keep every spell already unlocked.
if(Object.hasOwn(n,`learnedSpells`)){let learned=n.learnedSpells;if(!Se(learned)||Object.keys(learned).length!==ne.length||!ne.every(id=>Object.hasOwn(learned,id)&&Array.isArray(learned[id])&&learned[id].every(spellId=>typeof spellId===`string`&&te.some(spell=>spell.id===spellId&&H(c.heroes.find(hero=>hero.id===id),spell)))&&new Set(learned[id]).size===learned[id].length))return null;c.learnedSpells=Object.fromEntries(ne.map(id=>[id,[...learned[id]]]))}else c.learnedSpells=Object.fromEntries(c.heroes.map(hero=>[hero.id,te.filter(spell=>H(hero,spell)&&hero.maxCharges[spell.tier-1]>0).map(spell=>spell.id)]));
let f=e=>'''
    replace(anchor, migration, 'validate learned spell records and migrate legacy saves')

    replace('else if(n.id===`merchant`||n.id.startsWith(`shop-`))x(`Quartermaster`,`Supplies and equipment for ${f[a.area].name} are available in the shop. Equipment stocks follow this region’s fixed danger level. Rest at a safe shelter to restore spell charges.`);',
            'else if(n.shopKind===`weapon`||n.id.startsWith(`weapon-`))x(`Weapon Shop`,`Equipment for every gear slot is available here. Equipment stocks follow this region’s fixed danger level.`);else if(n.shopKind===`magic`||n.id.startsWith(`magic-`))x(`Magic Shop`,`Choose a traveler and learn a spell suited to their job. A learned spell still needs an unlocked tier and a charge. Rest at a safe shelter to restore charges.`);else if([`item`,`items`].includes(n.shopKind)||n.id===`merchant`||n.id.startsWith(`shop-`))x(`Item Shop`,`Field supplies for ${f[a.area].name} are available here. Rest at a safe shelter to restore spell charges.`);',
            'recognize dedicated weapon item and magic merchants')

    old_start = source.index('function fe(e){')
    old_end = source.index('function pe(){', old_start)
    old = source[old_start:old_end]
    new = r'''function fe(e){if(!p(e.area,e.player.x,e.player.y))return[];let t=Number(M(e.area,e.player.x,e.player.y).slice(1)),n=ee.filter(n=>n.kind===`equipment`&&!n.set_id&&Number(n.id.slice(1,3))<=t&&e.heroes.some(e=>U(e,n)));return[...Object.entries(de).map(([e,t])=>({itemId:e,price:t})),...n.map(e=>({itemId:e.id,price:Math.round((e.slot===`weapon`||e.slot===`body`?80:35)*Number(e.id.slice(1,3))**1.6)}))].filter(offer=>shopAccepts(e,K(offer.itemId)))}'''
    replace(old, new, 'filter regional buy stock by merchant category')
    replace('function sL(e){return ee.filter(t=>(e.inventory[t.id]??0)>0&&',
            'function sL(e){return ee.filter(t=>shopAccepts(e,t)&&(e.inventory[t.id]??0)>0&&',
            'filter sale display by merchant category')
    replace('if(!t||t.sellable===!1||t.set_id||t.unique_per_save||!Number.isFinite(n)',
            'if(!t||!shopAccepts(a,t)||t.sellable===!1||t.set_id||t.unique_per_save||!Number.isFinite(n)',
            'enforce sale category without changing spare-copy accounting')

    anchor = '},castField(e,t,n){'
    purchase = r'''},buySpell(heroId,spellId){if(a.mode!==`explore`||a.reward||a.message?.speaker!==`Magic Shop`||!p(a.area,a.player.x,a.player.y))return!1;let hero=a.heroes.find(candidate=>candidate.id===heroId),offer=spellOffers(a,heroId).find(candidate=>candidate.spellId===spellId);if(!hero||!offer||offer.known||!offer.unlocked||a.gold<offer.price)return!1;a.learnedSpells[heroId].push(spellId),a.gold-=offer.price,l(),z.save();return!0},castField(e,t,n){'''
    replace(anchor, purchase, 'purchase one spell for one eligible hero without refilling charges')
    replace('if(!e||!H(r,e)||r.charges[e.tier-1]<=0',
            'if(!e||!knowsSpell(a,r,e)||r.charges[e.tier-1]<=0',
            'require learning when planning battle magic')
    replace('if(!r||r.hp<=0||r.status===`silence`||!i||!H(r,i)||',
            'if(!r||r.hp<=0||r.status===`silence`||!i||!knowsSpell(a,r,i)||',
            'require learning for field magic')
    replace('if(t.status===`silence`||t.charges[i.tier-1]<=0)S(',
            'if(!i||!knowsSpell(a,t,i)||t.status===`silence`||t.charges[i.tier-1]<=0)S(',
            'recheck learned magic at execution time')
    return source, changes
