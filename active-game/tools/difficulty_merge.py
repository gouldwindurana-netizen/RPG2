"""Merge the user's exact difficulty edits into the current polished game.

The receipt is a diff against their earlier shared ancestor, not a replacement
HTML. Verify that it reproduces their upload exactly before applying any edits.
"""
from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
UPLOAD_SHA = 'cbb83307ef4e82b2c57f3416457d3633b4789b2a674b022ed7792f21fd147487'
PATCH_SHA = '22324f76b88acdfa50f327a6a70434ac2fc283b92075d0eada2a376be82b71a7'


def patch(source):
    upload = (ROOT / 'difficulty-upload.html').read_bytes()
    receipt = (ROOT / 'tools/difficulty-upload-patches.json').read_bytes()
    assert hashlib.sha256(upload).hexdigest() == UPLOAD_SHA, 'Uploaded difficulty archive changed.'
    assert hashlib.sha256(receipt).hexdigest() == PATCH_SHA, 'User edit receipt changed.'
    edits = json.loads(receipt)
    ancestor = (ROOT / 'depth-baseline.html').read_text()
    reproduced = ancestor
    labels = []
    for index, edit in reversed(list(enumerate(edits))):
        assert reproduced.count(edit['old']) == 1, f'Upload receipt conflict {index}'
        reproduced = reproduced.replace(edit['old'], edit['new'], 1)
        assert source.count(edit['old']) == 1, f'Current game merge conflict {index}'
        source = source.replace(edit['old'], edit['new'], 1)
        labels.append(f'user difficulty edit {index + 1:02d}')
    assert reproduced.encode() == upload, 'Receipt does not reproduce exact uploaded HTML.'

    def once(old, new, label):
        nonlocal source
        assert source.count(old) == 1, f'{label}: exact anchor changed'
        source = source.replace(old, new, 1)
        labels.append(label)

    once('function sLv(a,t,i){',
         'function sanitizeSpellPractice(value){let result={};if(!Se(value))return result;for(let hero of ne){let row=value[hero];if(!Se(row))continue;let valid={};for(let spell of te)if(Ce(row[spell.id],0,1e9))valid[spell.id]=row[spell.id];if(Object.keys(valid).length)result[hero]=valid}return result}function sLv(a,t,i){',
         'validate optional practice counters without rejecting an otherwise valid save')
    once('c.sp=n.sp&&typeof n.sp==`object`&&!Array.isArray(n.sp)?n.sp:{}',
         'c.sp=sanitizeSpellPractice(n.sp)',
         'preserve valid per-hero spell practice and discard malformed counters on import')
    once('h[i.id]=(h[i.id]??0)+1;', 'h[i.id]=Math.min(1e9,(h[i.id]??0)+1);',
         'keep long-running practice counters within the save range')
    once('n.hp=Math.max(1,Math.round(n.maxHp*(t.power??35)/100)),n.status=null;',
         'n.hp=Math.min(n.maxHp,Math.max(1,Math.round(n.maxHp*(t.power??35)/100))),n.status=null;',
         'cap practiced revival at maximum HP while retaining weaker revive growth')
    once('setDifficulty(e){return[`easy`,`normal`,`hard`,`hell`].includes(e)?',
         'setDifficulty(e){return a.mode===`explore`&&!a.message&&!a.reward&&[`easy`,`normal`,`hard`,`hell`].includes(e)?',
         'change difficulty between encounters so active enemy stats stay consistent')
    once('<span>Difficulty</span><button class="small-button" data-difficulty="cycle">',
         '<span>Difficulty · next encounter</span><button class="small-button" aria-label="Change difficulty" data-difficulty="cycle">',
         'clarify when changed difficulty applies')
    once('</button></div><div class="pack-grid">${eqUI(e,r,i,$)}',
         '</button></div><p class="shop-intro">${difficultyDetails(e.difficulty)} Enemy strength changes; EXP and gold stay the same.</p><div class="pack-grid">${eqUI(e,r,i,$)}',
         'show enemy multipliers without promising extra rewards')
    once('var gm=``;',
         'function difficultyDetails(id){let mode=DIFFM[id]??DIFFM.easy;return`HP ×${mode.hp} · ATK ×${mode.atk} · DEF ×${mode.def}.`}function masteryLabel(state,hero,spell){return`Spell Lv ${sLv(state,hero,spell)} · ${state.sp?.[hero.id]?.[spell.id]??0} battle casts`}var gm=``;',
         'explain preserved battle-cast growth in both spell menus')
    once('${n.maxCharges[e.tier-1]??0}</small></span><em>${Q(e.description)}',
         '${n.maxCharges[e.tier-1]??0} · ${Q(masteryLabel(X.state,n,e))}</small></span><em>${Q(e.description)}',
         'show each selected traveler spell level during battle planning')
    once('<strong>${Y(e.name)}</strong><small>${Y(e.description)}${n?``:` · Battle only`}',
         '<strong>${Y(e.name)}</strong><small>${Y(masteryLabel(X.state,r,e))}</small><small>${Y(e.description)}${n?``:` · Battle only`}',
         'show saved spell practice in the field spellbook')
    return source, labels
