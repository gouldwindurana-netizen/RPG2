"""Apply only the equipment correction to the supplied standalone baseline."""
from pathlib import Path
import hashlib
import json

root = Path(__file__).resolve().parents[1]
source = root / 'baseline.html'
target = root / 'The_Road_Beyond_the_Bells.html'
raw = source.read_bytes()
expected = '6826e7d70ba56ddd2bbf868d9b8c31b4a2d4c641fb332b6fad603ac4b0dc32e7'
assert hashlib.sha256(raw).hexdigest() == expected, 'Baseline changed; review the new upload before patching.'
s = raw.decode('utf-8')
changes = []

def replace_once(old, new, label):
    global s
    assert s.count(old) == 1, f'{label}: expected one match, found {s.count(old)}'
    s = s.replace(old, new, 1)
    changes.append(label)

def replace_section(start, end, new, label):
    a = s.index(start)
    b = s.index(end, a)
    replace_once(s[a:b], new, label)

helpers = '''// Equipment inventory counts include worn copies; changing a loadout never consumes an item.
function eqOwned(state,id){const item=K(id),count=Math.max(0,Math.floor(Number(state.inventory[id])||0));return item?.set_id||item?.unique_per_save?Math.min(1,count):count}
function eqUsed(state,id,excludingHero){return state.heroes.reduce((total,hero)=>total+(hero.id===excludingHero?0:Object.values(hero.equipment).filter(value=>value===id).length),0)}
function eqAvailable(state,id,excludingHero){return Math.max(0,eqOwned(state,id)-eqUsed(state,id,excludingHero))}
'''
replace_once('var eqS=`weapon`', helpers+'var eqS=`weapon`', 'Shared equipment-copy accounting')

ui = '''function eqUI(e,r,i,h){let c=K(r.equipment[eqS]);return`<section class="eq-window"><h3>Equipment <button class="small-button" data-optimize="${h}">Optimize</button> <button class="small-button" data-optimize="all">Optimize all</button></h3><div class="eq-slots">${Object.keys(EQL).map(s=>{let q=K(r.equipment[s]);return`<button class="eq-slot${eqS===s?` on`:``}" data-eq-slot="${s}"><b>${EQL[s]}</b><span>${q?Q(q.name):`Empty`}</span><small>${Q(eqT(q))}</small></button>`}).join(``)}</div><h3>${EQL[eqS]} · choose gear</h3>${i.filter(t=>t.slot===eqS).sort((x,y)=>eqSum(y)-eqSum(x)).map(t=>{
 let w=r.equipment[eqS]===t.id,eqBy=e.heroes.filter(x=>Object.values(x.equipment).includes(t.id)),owned=eqOwned(e,t.id),used=eqUsed(e,t.id),avail=eqAvailable(e,t.id),allowed=U(r,t),fits=e.heroes.filter(x=>U(x,t)).map(x=>Q(x.name)).join(`, `);
 let ks=[...new Set([...Object.keys(t.stats??{}),...Object.keys(c?.stats??{})])].map(k=>{let d=(t.stats?.[k]??0)-(c?.stats?.[k]??0);return w||!d?``:`<span class="${d>0?`stat-up`:`stat-down`}">${EQK[k]??k} ${d>0?`▲`:`▼`} ${Math.abs(d)}</span>`}).join(` `);
 let reason=w?`Worn`:!allowed?`Wrong job`:avail<=0?`No free copy`:`Equip`;
 return`<div class="inventory-row"><span><strong>${Q(t.name)}</strong><small>${Q(eqT(t))} · Owned ${owned} · Equipped ${used} · Available ${avail}${t.set_id||t.unique_per_save?` · Unique`:``}</small>${eqBy.length?`<small>Worn by ${eqBy.map(x=>Q(x.name)).join(`, `)}</small>`:``}<small>${!allowed?`Not compatible with ${Q(r.role)}. Fits: ${fits||`another job`}.`:w?`Equipped`:ks||`No stat change`}</small></span><button class="small-button" data-equip="${Q(t.id)}" ${w||!allowed||avail<=0?`disabled`:``}>${reason}</button></div>`
 }).join(``)||`<small>No gear owned for this slot.</small>`}<p class="pack-hint">Each ordinary copy equips one compatible traveler. Changing gear frees the previous copy. Optimize uses only available copies and leaves equal-scoring gear in place.</p></section>`}'''
replace_section('function eqUI(', 'var shT=', ui, 'Equipment menu copy counts and eligibility')
replace_once('&&U(r,t)),a=[`POTION`', '),a=[`POTION`', 'Show owned gear with explicit job restrictions')

engine_equip = '''equip(e,t){if(a.mode!==`explore`||a.reward)return!1;let n=a.heroes.find(t=>t.id===e),r=K(t);if(!n||!r||r.kind!==`equipment`||!r.slot||!U(n,r)||eqAvailable(a,t,e)<1)return!1;if(n.equipment[r.slot]===t)return!0;n.equipment[r.slot]=t;A();l();z.save();return!0},'''
replace_section('equip(e,t){', 'useItem(e,t){', engine_equip, 'Equip exactly one owned copy per wearer')

engine_sell = '''sell(e){if(a.mode!==`explore`||a.reward)return!1;let t=K(e),n=de[e]??(t?.kind===`equipment`&&!t.set_id?Math.round((t.slot===`weapon`||t.slot===`body`?80:35)*Number(t.id.slice(1,3))**1.6):0),free=t?.kind===`equipment`?eqAvailable(a,e):(a.inventory[e]??0);if(!t||t.sellable===!1||t.set_id||t.unique_per_save||!Number.isFinite(n)||n<2||free<1)return!1;a.gold+=Math.floor(n/2);a.inventory[e]--;l();z.save();return!0},'''
replace_section('sell(e){', 'optimize(e){', engine_sell, 'Sell only spare equipment copies')

engine_optimize = '''optimize(e){if(a.mode!==`explore`||a.reward)return!1;if(e===`all`){let changed=!1;for(const hero of [...a.heroes])if(z.optimize(hero.id))changed=!0;return changed}let hero=a.heroes.find(h=>h.id===e);if(!hero)return!1;let changed=!1;for(const slot of [`weapon`,`body`,`head`,`mantle`,`charm`]){const current=K(hero.equipment[slot]),candidates=ee.filter(item=>item.kind===`equipment`&&item.slot===slot&&U(hero,item)&&eqAvailable(a,item.id,e)>0).sort((left,right)=>eqSum(right)-eqSum(left));const best=candidates[0];if(best&&eqSum(best)>eqSum(current)){hero.equipment[slot]=best.id;changed=!0}}if(changed){A();l();z.save()}return changed},'''
replace_section('optimize(e){', 'buy(e,q=1){', engine_optimize, 'Optimize all five slots using one consistent stat score')
replace_once('function sL(e){return ee.filter(t=>(e.inventory[t.id]??0)>0&&(de[t.id]||t.kind===`equipment`&&!t.set_id))', 'function sL(e){return ee.filter(t=>(e.inventory[t.id]??0)>0&&t.sellable!==!1&&!t.set_id&&!t.unique_per_save&&(de[t.id]||t.kind===`equipment`&&Number.isFinite(Number(t.id.slice(1,3)))&&Number(t.id.slice(1,3))>0))', 'Hide unsellable and unique items from the sell menu')
replace_once('function eqSum(t){return Object.values(t.stats??{}).reduce((p,q)=>p+q,0)}', 'function eqSum(t){return Object.values(t?.stats??{}).reduce((sum,value)=>sum+(Number(value)||0),0)}', 'Score every equipment stat consistently')
replace_once('Best available gear equipped.`:`Cannot optimize right now.', 'Best available gear equipped.`:`No upgrade available from owned copies.', 'Honest no-upgrade feedback')
# Sell display and action share exactly the same spare-copy definition.
replace_once('w=t.kind===`equipment`?e.heroes.filter(h=>Object.values(h.equipment).includes(t.id)).length:0,c=(e.inventory[t.id]??0)-w', 'w=t.kind===`equipment`?eqUsed(e,t.id):0,c=t.kind===`equipment`?eqAvailable(e,t.id):(e.inventory[t.id]??0)', 'Match sell menu to available copies')
replace_once('Equipment is shared. Unique set pieces can be worn by only one traveler. Supplies are used on the selected traveler.', 'Owned equipment includes worn copies. Ordinary copies can be shared up to the quantity owned; unique set pieces have one wearer. Supplies are used on the selected traveler.', 'Document inventory ownership in the pack')

target.write_bytes(s.encode('utf-8'))
manifest = {
    'baseline_upload': 'The_Road_Beyond_the_Bells_FFPR_Mod_v2.html',
    'baseline_sha256': expected,
    'working_file': target.name,
    'working_sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
    'changes': changes,
    'preserved': ['Original CSS and artwork', 'Per-hero EXP and existing save key', 'User slot equipment UI', 'Buy quantities and sell menu', 'Story, maps, combat, and other uploaded modifications'],
}
(root/'equipment-fix-manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
print(json.dumps({'file':str(target),'bytes':target.stat().st_size,'changes':len(changes)},indent=2))
