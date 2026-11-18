"""Unified, deterministic job skill catalog for the selected standalone game.

Keep existing spell IDs, powers and schools intact. New martial techniques use
the same learned-skill history and planning boundary as the existing magic.
"""
import json


TECHNIQUES = [
    dict(id='shield-bash', name='Shield Bash', job='warden', level=1, cost=3, scale=1.45, pierce=.2,
         description='Strike one foe with a shield-led attack that ignores 20% of its defense.'),
    dict(id='rally', name='Rally', job='warden', level=5, cost=5, effect='protect', target='allAllies',
         description='Protect living allies for the rest of this round. Does not heal or restore MP.'),
    dict(id='guardian-strike', name='Guardian Strike', job='warden', level=9, cost=7, scale=1.9, pierce=.3,
         description='Drive through one foe while ignoring 30% of its defense.'),
    dict(id='iron-cyclone', name='Iron Cyclone', job='warden', level=17, cost=10, scale=1.2, target='allEnemies',
         description='Sweep every living foe with a controlled physical attack.'),
    dict(id='power-strike', name='Power Strike', job='striker', level=1, cost=3, scale=1.65,
         description='Commit MP to a powerful, reliable strike against one foe.'),
    dict(id='sweeping-kick', name='Sweeping Kick', job='striker', level=5, cost=5, scale=1.15, target='allEnemies',
         description='Sweep every living foe with a broad physical kick.'),
    dict(id='twin-fang', name='Twin Fang', job='striker', level=9, cost=7, scale=2.15,
         description='Concentrate a rapid physical combination on one foe.'),
    dict(id='driving-finish', name='Driving Finish', job='striker', level=17, cost=10, scale=2.4, pierce=.4,
         description='Deliver a finishing combination that ignores 40% of one foe\'s defense.'),
    dict(id='quickshot', name='Quickshot', job='scout', level=1, cost=3, scale=1.45, pierce=.3,
         description='Find an opening in one foe and ignore 30% of its defense.'),
    dict(id='scatter-volley', name='Scatter Volley', job='scout', level=5, cost=5, scale=1.1, target='allEnemies',
         description='Send a precise physical volley across every living foe.'),
    dict(id='precision-strike', name='Precision Strike', job='scout', level=9, cost=7, scale=1.8, pierce=.65,
         description='Exploit an opening in one foe, ignoring 65% of its defense.'),
    dict(id='horizon-shot', name='Horizon Shot', job='scout', level=17, cost=10, scale=2.3, pierce=.5,
         description='Land a decisive physical shot that ignores 50% of one foe\'s defense.'),
    dict(id='arc-slash', name='Arc Slash', job='spellblade', level=1, cost=3, scale=1.45,
         description='Spend MP on a measured physical slash against one foe.'),
    dict(id='runic-sweep', name='Runic Sweep', job='spellblade', level=5, cost=5, scale=1.1, target='allEnemies',
         description='Carry a physical blade sweep through every living foe.'),
    dict(id='warding-circle', name='Warding Circle', job='spellblade', level=9, cost=7, effect='protect', target='allAllies',
         description='Protect living allies for the rest of this round. Does not heal or restore MP.'),
    dict(id='runebreaker', name='Runebreaker', job='spellblade', level=17, cost=10, scale=2, pierce=.5,
         description='Break through one foe with a physical slash that ignores 50% of its defense.'),
]


def catalog_script():
    entries = []
    for skill in TECHNIQUES:
        level = skill['level']
        entry = {
            'id': skill['id'], 'name': skill['name'], 'kind': 'technique',
            'jobs': [skill['job']], 'tier': {1: 1, 5: 2, 9: 3, 17: 5}[level],
            'levelRequired': level, 'mpCost': skill['cost'],
            'price': {1: 35, 5: 100, 9: 250, 17: 900}[level],
            'target': skill.get('target', 'enemy'), 'effect': skill.get('effect', 'damage'),
            'description': skill['description'],
        }
        if entry['effect'] == 'damage':
            entry['attackScale'] = skill['scale']
            entry['armorPierce'] = skill.get('pierce', 0)
        entries.append(entry)
    raw = json.dumps(entries, ensure_ascii=False, separators=(',', ':'))
    return r'''// Existing spells and martial techniques share one learned skill catalog.
var martialSkillCatalog=''' + raw + r''';
for(let skill of te){skill.kind=`magic`;skill.jobs=I.filter(job=>job.spellIds.includes(skill.id)).map(job=>job.id);skill.mpCost=({mend:4,shelter:5,cleanse:6,kindle:10,revive:16,haven:20,sanctuary:26,rebirth:34,daybreak:40})[skill.id]??[4,8,12,16,22,28,34,40][skill.tier-1];skill.levelRequired=l.spell_tier_unlocks[skill.tier-1];skill.price=spellPrices[skill.tier-1]}
for(let skill of martialSkillCatalog){te.push(skill);for(let job of skill.jobs){let data=V(job);data.spellIds.includes(skill.id)||data.spellIds.push(skill.id)}}
'''


def patch(source):
    old = 'function eqOwned(state,id){'
    assert source.count(old) == 1, 'Unified skill catalog: expected one insertion anchor'
    return source.replace(old, catalog_script() + old, 1), [
        'retain twenty-four existing magic skills with explicit MP costs and unlock levels',
        'add sixteen martial techniques across Warden Striker Scout and Spellblade',
    ]
