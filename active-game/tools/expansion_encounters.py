"""Port fixed regional formations/rewards into the authoritative standalone bundle.

This module only transforms the supplied source; the integration driver owns writes.
Never rerun archived equipment/travel generators over the current uploaded baseline.
"""
from __future__ import annotations
import json


def _helpers() -> str:
    # Small/large are explicit battle footprints, independent of family artwork.
    # Later regions have different light units; none scale to the party's level.
    types = {
        'R01': ('R01_E2', 'R01_E3', 'R01_E1'),
        'R02': ('R02_E1', 'R02_E2', 'R02_E3'),
        'R03': ('R03_E4', 'R03_E1', 'R03_E2'),
        'R04': ('R04_E4', 'R04_E3', 'R04_E2'),
        'R05': ('R05_E3', 'R05_E3', 'R05_E1'),
        'R06': ('R06_E4', 'R06_E3', 'R06_E1'),
    }
    def member(template, size='small', unit='regular', rank='base'):
        return {'template': template, 'size': size, 'unit': unit, 'rank': rank}
    tables = {}
    for region, (small, swarm, large) in types.items():
        sm = member(small); sw = member(swarm, unit='swarm'); lg = member(large, 'large')
        rows = [
            ('lone-guard', 6, [lg], False),
            ('road-pair', 21 if region not in ('R01', 'R02') else 22, [sm, sm], False),
            ('guard-and-runner', 20, [lg, sm], False),
            ('road-trio', 14, [sm, sw, sw], False),
            ('road-four', 16, [sm, sm, sw, sw], False),
            ('swarm-five', 6, [sw]*5, True),
            ('swarm-six', 4, [sw]*6, True),
            ('swarm-seven', 2, [sw]*7, True),
            ('swarm-eight', 2, [sw]*8, True),
            ('swarm-nine', 1, [sw]*9, True),
            ('four-guards', 1, [lg]*4, True),
            ('guarded-swarm', 2, [lg]*2+[sw]*6, True),
        ]
        # Stronger colors belong to authored regional rows, never the hero's level.
        rows.append(('ashen-watch', 4, [member(small, rank='ashen')]*2, True))
        if region not in ('R01', 'R02'):
            rows.append(('crested-leader', 1, [member(large, 'large', rank='crested'), sw, sw], True))
        tables[region] = [{'id': region+'_'+name, 'weight': weight, 'deep': deep,
                           'members': members} for name, weight, members, deep in rows]
    authored = {
        'encounter1': [member('R01_E2')]*2,
        'encounter2': [member('R01_E1', 'large'), member('R01_E2'), member('R01_E3', unit='swarm')],
        'encounter3': [member('R01_E3', unit='swarm')]*4,
        'encounter4': [member('R01_E4'), member('R01_E3', unit='swarm'), member('R01_E3', unit='swarm')],
        'encounter5': [member('R01_E2', rank='ashen'), member('R01_E4')],
        'encounter6': [member('R01_E3', unit='swarm')]*6,
        'R04_patrol_a': [member('R04_E3', unit='swarm')]*5,
        'R04_patrol_b': [member('R04_E4', rank='ashen'), member('R04_E1')],
        'R05_patrol_a': [member('R05_E1', 'large'), member('R05_E3'), member('R05_E3', unit='swarm')],
    }
    return r'''// Fixed regional formations: NES-sized footprints, original campaign balance.
var encounterTables=TABLES,authoredFormations=AUTHORED;
function encounterEligible(region,state){let deep={R01:`works`,R02:`tollhouse`,R03:`granary`,R04:`orchard`,R05:`crown`,R06:`heart`}[region],ready=state.area===deep&&(region!==`R01`||state.cleared.filter(id=>/^encounter[1-6]$/.test(id)).length>=2),post=region!==`R01`||state.campaign.stage>=2;return encounterTables[region].filter(row=>!row.deep||ready&&(post||row.members.length<=6))}
function encounterFormation(region,state,random){let rows=encounterEligible(region,state),roll=random()*rows.reduce((sum,row)=>sum+row.weight,0);for(let row of rows){roll-=row.weight;if(roll<0)return row}return rows.at(-1)}
function encounterUnit(member,index){let template=d.enemies.find(enemy=>enemy.id===member.template),enemy=Te(member.template,index,member.rank),swarm=member.unit===`swarm`,large=member.size===`large`,hpScale=swarm?.45:large?.9:.65,attackScale=swarm?.43:large?.9:.72,weight=(swarm?.34:({armored:1.15,striker:1,caster:.9,support:.9,status:.75}[template.role]??1))*(large?1.1:1)*(member.rank===`ashen`?1.5:member.rank===`crested`?2:1),region=oe.indexOf(template.region_id);enemy.templateId=template.id,enemy.size=member.size,enemy.unit=member.unit,enemy.hp=enemy.maxHp=Math.max(1,Math.round(enemy.hp*hpScale)),enemy.attack=Math.max(1,Math.round(enemy.attack*attackScale)),enemy.defense=Math.max(0,Math.round(enemy.defense*(swarm?.5:large?.9:.7))),enemy.statusChance=swarm?.06:.2,enemy.rewardXp=Math.max(1,Math.round(se[region]*2*weight)),enemy.rewardGold=Math.max(1,Math.round(ce[region]/2*weight));swarm&&template.role!==`swarm`&&(enemy.name+=template.family===`CANTOR`?` Echo`:` Hatchling`);return enemy}
function encounterNames(enemies){let counts=new Map;for(let enemy of enemies)counts.set(enemy.name,(counts.get(enemy.name)??0)+1);for(let[index,enemy]of enemies.entries())enemy.displayName=enemy.name+(counts.get(enemy.name)>1?` ${index+1}`:``)}
function encounterAllocate(enemies,xp,gold){for(let[index,enemy]of enemies.entries())enemy.size=`large`,enemy.unit=`authored`,enemy.templateId=enemy.id,enemy.rewardXp=Math.floor(xp/enemies.length)+(index<xp%enemies.length?1:0),enemy.rewardGold=Math.floor(gold/enemies.length)+(index<gold%enemies.length?1:0)}
function encounterSpoils(enemies){let defeated=enemies.filter(enemy=>enemy.hp<=0);return{count:defeated.length,xp:defeated.reduce((sum,enemy)=>sum+(enemy.rewardXp??0),0),gold:defeated.reduce((sum,enemy)=>sum+(enemy.rewardGold??0),0)}}
'''.replace('TABLES', json.dumps(tables, separators=(',', ':'))).replace('AUTHORED', json.dumps(authored, separators=(',', ':')))


def patch(source: str) -> tuple[str, list[str]]:
    changes = []
    def replace(old, new, label):
        nonlocal source
        count = source.count(old)
        if count != 1:
            raise ValueError(f'{label}: expected one anchor, found {count}')
        source = source.replace(old, new, 1)
        changes.append(label)

    replace('function Ee(e={}){', _helpers()+'function Ee(e={}){',
            'fixed regional formations and per-enemy contribution helpers')
    start = source.index('}else{let r={encounter1:', source.index('function Ee(e={}){'))
    end = source.index('a.message=null,a.reward=null,a.mode=`battle`', start)
    replace(source[start:end], '}else{let formation=authoredFormations[e]?{id:e,members:authoredFormations[e]}:encounterFormation(t,a,m);i=formation.members.map(encounterUnit);i.formationId=formation.id}',
            'author varied normal groups without random level scaling')
    old = 'a.battle={encounterId:e,title:o?.name??c?.name??f[a.area].name,kind:r,enemies:i,regionId:t,rewardXp:u,rewardGold:o?.gold_party??(r===`rare`?ce[n]*2:ce[n]),round:1'
    new = 'encounterNames(i);let gold=o?.gold_party??(r===`rare`?ce[n]*2:ce[n]);r!==`normal`&&encounterAllocate(i,u*4,gold);let total=encounterSpoils(i.map(enemy=>({...enemy,hp:0})));a.battle={encounterId:e,title:o?.name??c?.name??f[a.area].name,kind:r,enemies:i,formationId:i.formationId??e,regionId:t,rewardXp:total.xp,rewardGold:total.gold,round:1'
    replace(old, new, 'allocate stable authored totals among boss voices and rare targets')
    old = 'if(!e||a.mode!==`battle`)return;let t=Object.fromEntries(a.heroes.map(h=>[h.id,h.level])),n=e.regionId??w(),r=e.rewardXp??28,i=e.rewardGold??70,al=a.heroes.filter(h=>h.hp>0),sh=al.length?Math.floor(r*a.heroes.length/al.length):0;for(let h of al)a.hx[h.id]+=sh;a.xp+=r,a.gold+=i,'
    new = 'if(!e||a.mode!==`battle`||e.rewardCommitted||!e.enemies.length||e.enemies.some(enemy=>enemy.hp>0))return;e.rewardCommitted=!0;let spoils=encounterSpoils(e.enemies),t=Object.fromEntries(a.heroes.map(h=>[h.id,h.level])),n=e.regionId??w(),r=spoils.xp,i=spoils.gold,al=a.heroes.filter(h=>h.hp>0),sh=al.length?Math.floor(r/al.length):0;for(let h of al)a.hx[h.id]+=sh;a.xp+=Math.floor(r/4),a.gold+=i,'
    replace(old, new, 'pay actual defeated contributions once and share EXP among survivors')
    old = 'let s=[`${al.length?`Each survivor gains ${sh} EXP`:`No one was left standing to earn EXP`}'
    new = 'let s=[`${spoils.count} ${spoils.count===1?`enemy defeated`:`enemies defeated`}: ${r} total EXP and ${i} gold.`,`${al.length?`Each survivor gains ${sh} EXP`:`No one was left standing to earn EXP`}'
    replace(old, new, 'show defeated count and total reward breakdown')
    replace('m()<Math.max(0,.2-Math.min(30,d[v+`_resist_pp`]??0)/100)',
            'm()<Math.max(0,(t.statusChance??.2)-Math.min(30,d[v+`_resist_pp`]??0)/100)',
            'keep light swarm status pressure within its contribution budget')
    replace('xp_policy:`Encounter XP_each is awarded to every hero, including KO heroes, after victory; never divide XP_each again. No main quest XP and no XP on flee/defeat.`',
            'xp_policy:`Sum defeated enemy EXP once, divide by living heroes and round down. Fallen heroes earn none. Gold is pooled. Authored boss and rare totals are allocated among their units. No EXP or gold on flee/defeat.`',
            'align embedded balance metadata with survivor reward policy')
    return source, changes
