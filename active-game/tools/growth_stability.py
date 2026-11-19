"""Focused runtime and save repairs for the user's uploaded growth build."""

def patch(source):
    labels = []
    def change(old, new, label):
        nonlocal source
        count = source.count(old)
        assert count == 1, (label, count)
        source = source.replace(old, new)
        labels.append(label)

    change('c=gRare(e===`silver`?`R01_RARE`:e,m);',
           'c=d.rares.find(t=>t.id===(e===`silver`?`R01_RARE`:e));',
           'encounters use the existing rare catalogue rather than an undefined helper')

    change('let pk=v(n);', 'let pk=v(n).map(K).filter(Boolean);',
           'automatic boss rewards resolve catalogue item records before awarding')
    change('let pk=v();', 'let pk=v().map(K).filter(Boolean);',
           'automatic cache rewards resolve catalogue item records before awarding')
    change('a.inventory[it.id]=Math.max(1,a.inventory[it.id]??0),s.push(`Found ${it.name}.`)',
           'a.inventory[it.id]=Math.max(1,a.inventory[it.id]??0),a.setAcquired.includes(it.id)||a.setAcquired.push(it.id),s.push(`Found ${it.name}.`)',
           'automatic boss equipment preserves regional collection history')
    change('a.inventory[it.id]=Math.max(1,a.inventory[it.id]??0),a.reward.lines.push(`Inside the chest: ${it.name}.`)',
           'a.inventory[it.id]=Math.max(1,a.inventory[it.id]??0),a.setAcquired.includes(it.id)||a.setAcquired.push(it.id),a.reward.lines.push(`Inside the chest: ${it.name}.`)',
           'automatic cache equipment preserves regional collection history')
    change('let r=n.version<3;',
           'if(Se(n.inventory))delete n.inventory.undefined;let r=n.version<3;',
           'repair the known accidental undefined inventory key from broken growth auto rewards')

    helpers = '''function sanitizeGrowth(value){let result={};if(!value||typeof value!==`object`||Array.isArray(value))return result;let caps={hp:200,mp:53,atk:20,def:20,mag:20,acc:20};for(let id of ne){let entry=value[id];if(!entry||typeof entry!==`object`||Array.isArray(entry))continue;let clean={};for(let[key,cap]of Object.entries(caps))clean[key]=Number.isInteger(entry[key])&&entry[key]>=0&&entry[key]<=cap?entry[key]:0;let usage=entry.u;clean.u=Object.fromEntries([`lost`,`spent`,`atk`].map(key=>[key,usage&&Number.isInteger(usage[key])&&usage[key]>=0&&usage[key]<=1e9?usage[key]:0]));result[id]=clean}return result}
function sanitizeSeen(value){return!value||typeof value!==`object`||Array.isArray(value)?{}:Object.fromEntries(Object.keys(FAMW).filter(key=>value[key]===1||value[key]===true).map(key=>[key,1]))}
'''
    change('var GR={};', helpers + 'var GR={};',
           'validate optional growth bonuses usage counters and discovered families without changing valid records')
    change('c.gr=GR=n.gr&&typeof n.gr==`object`&&!Array.isArray(n.gr)?n.gr:{},c.seen=n.seen&&typeof n.seen==`object`?n.seen:{},',
           'c.gr=GR=sanitizeGrowth(n.gr),c.seen=sanitizeSeen(n.seen),',
           'import growth and discovered families through bounded known-field normalization')
    change('function xe(e,t=R,jobs){let party=',
           'function xe(e,t=R,jobs){GR={};let party=',
           'new adventures clear old growth before deriving their starting heroes')
    change('spell.kind!==`technique`&&H(hero,spell)&&skillUnlocked(hero,spell)',
           'spell.kind!==`technique`&&H(hero,spell)&&hero.level>=(spell.levelRequired??l.spell_tier_unlocks[(spell.tier??1)-1]??1)',
           'legacy missing spellbooks retain their original level unlocks while current growth skills remain level independent')
    return source, labels
