"""Use MP and unified learned skills at the existing round-planning boundary."""


def patch(source):
    labels = []

    def once(old, new, label):
        nonlocal source
        count = source.count(old)
        assert count == 1, f'{label}: expected one anchor, found {count}'
        source = source.replace(old, new, 1)
        labels.append(label)

    once('!e||!knowsSpell(a,r,e)||r.charges[e.tier-1]<=0||r.status===`silence`||e.target===`enemy`',
         '!e||!canUseSkill(a,r,e)||e.target===`enemy`',
         'skill plans validate learned job skills level MP and the applicable silence rule')
    once('if(!i||!knowsSpell(a,t,i)||t.status===`silence`||t.charges[i.tier-1]<=0)S(`${t.name} cannot cast. No charge spent.`);',
         'if(!i||!canUseSkill(a,t,i))S(`${t.name} cannot use that skill. No MP spent.`);',
         'skill execution rechecks current MP job learning level and conditions')
    once('S(`${t.name}\'s target is no longer valid. No charge spent.`);',
         'S(`${t.name}\'s target is no longer valid. No MP spent.`);',
         'invalid recovery skill targets retain their MP')
    once('else{t.charges[i.tier-1]--,gm=sGain(a,t,i);',
         'else{t.mp-=skillCost(i),gm=sGain(a,t,i);',
         'valid support skills spend MP and gain practice once per use')
    once('if(!n.length){P();return}t.charges[i.tier-1]--,gm=sGain(a,t,i);',
         'if(!n.length){P();return}t.mp-=skillCost(i),gm=sGain(a,t,i);',
         'valid damage skills spend MP and gain practice once for all targets')
    once('let r=i.element??`lightning`,a=e.weakness.includes(r)?t.job===`arcanist`?1.65:1.5:e.resistance.includes(r)?.5:1,o=Math.round(((i.power??12)+t.magic*2)*a*(n.length>1?.7:1)*sm);',
         'let physical=i.kind===`technique`,r=physical?PHYS[t.job]??`slash`:i.element??`lightning`,a=e.weakness.includes(r)?!physical&&t.job===`arcanist`?1.65:1.5:e.resistance.includes(r)?.5:1,o=physical?Math.max(1,Math.round((t.attack*i.attackScale-e.defense*(1-(i.armorPierce??0)))*t.hits*a*sm*(n.length>1?.75:1))):Math.round(((i.power??12)+t.magic*2)*a*(n.length>1?.7:1)*sm);',
         'martial techniques use physical job affinity hits and bounded armor penetration')
    once('S(`${t.name} casts ${i.name}.${i.effect===`protect`?',
         'S(`${t.name} ${i.kind===`technique`?`uses`:`casts`} ${i.name}.${i.effect===`protect`?',
         'support action logs distinguish physical techniques from magic')
    once('S(`${t.name} casts ${i.name} on ${e.name}: ${o}${a>1?',
         'S(`${t.name} ${physical?`uses`:`casts`} ${i.name} on ${e.name}: ${o}${a>1?',
         'damage action logs name the selected learned technique or magic skill')
    once('kind:`spell`})}}}else if(r.type===`item`)',
         'kind:physical?`hit`:`spell`})}}}else if(r.type===`item`)',
         'physical skill effects retain the existing hit animation cue')
    once('for(let r of e)i.effect===`protect`?(n.add(r.id),i.power&&I(t,sp2,r)):I(t,sp2,r);',
         'let recoveryCue=null;for(let r of e){let gained=0;if(i.effect===`protect`){n.add(r.id);if(i.power)gained=I(t,sp2,r)}else gained=I(t,sp2,r);if(!recoveryCue||gained>0&&recoveryCue.amount===0)recoveryCue={id:r.id,amount:gained}}',
         'recovery feedback measures actual restored HP on a benefited target')
    once('target:e[0].id,amount:i.power??0,kind:i.effect===`protect`?`guard`:`heal`',
         'target:recoveryCue.id,amount:recoveryCue.amount,resource:i.effect===`cure`?`status`:`hp`,kind:i.effect===`protect`?`guard`:`heal`',
         'recovery skill cues distinguish condition cures from HP gains')
    once('let e=a.heroes.find(e=>e.id===r.target),n=e?.hp??0;e&&r.itemId&&R(r.itemId,e)?',
         'let e=a.heroes.find(e=>e.id===r.target),n=e?.hp??0,mpBefore=e?.mp??0;e&&r.itemId&&R(r.itemId,e)?',
         'capture both active resources before using a battle supply')
    once('amount:e.hp-n,kind:`heal`',
         'amount:e.mp>mpBefore?e.mp-mpBefore:e.hp-n,resource:e.mp>mpBefore?`mp`:e.hp>n?`hp`:`status`,kind:`heal`',
         'battle supply feedback reports actual MP HP or condition recovery')
    return source, labels
