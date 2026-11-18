"""Targeted shop comparison and transaction guards for the uploaded game."""

def patch(source):
    labels = []

    def replace(old, new, label):
        nonlocal source
        if source.count(old) != 1:
            raise ValueError(f'{label}: expected exactly one source anchor')
        source = source.replace(old, new, 1)
        labels.append(label)

    replace(
        'function sI(e,t){let n=K(t);if(n?.kind!==`equipment`)return``;let r=Object.entries(n.stats??{}).map(([e,t])=>`+${t} ${e}`).join(`, `),i=e.heroes.filter(h=>U(h,n)).map(h=>{let c=K(h.equipment[n.slot]),d=Object.keys(n.stats??{}).reduce((s,k)=>s+(n.stats[k]-(c?.stats?.[k]??0)),0);return`${h.id} ${d>0?`▲`:d<0?`▼`:`＝`}`}).join(` `);return` · ${r} · ${i}`}',
        '''function sI(e,t){let n=K(t);if(n?.kind!==`equipment`)return``;let comparisons=e.heroes.filter(hero=>U(hero,n)).map(hero=>{let current=K(hero.equipment[n.slot]),keys=[...new Set([...Object.keys(n.stats??{}),...Object.keys(current?.stats??{})])],changes=keys.map(key=>({key,delta:(n.stats?.[key]??0)-(current?.stats?.[key]??0)})).filter(change=>change.delta!==0),gain=changes.some(change=>change.delta>0),loss=changes.some(change=>change.delta<0),marker=gain&&loss?`↔`:gain?`▲`:loss?`▼`:`＝`,detail=changes.map(change=>`${EQK[change.key]??change.key} ${change.delta>0?`+`:``}${change.delta}`).join(`, `);return`<span data-shop-compare="${Q(hero.id)}">${Q(hero.name)} ${marker}${detail?` (${Q(detail)})`:``}</span>`}).join(` · `);return` · ${Q(eqT(n))} · ${comparisons}`}''',
        'shop-compare-all-stats-and-custom-names',
    )
    replace(
        'buy(e,q=1){if(a.mode!==`explore`||a.reward)return!1;',
        'buy(e,q=1){if(a.mode!==`explore`||a.reward||q!==`max`&&(!Number.isInteger(q)||q<1))return!1;',
        'shop-reject-invalid-quantities-before-mutation',
    )
    return source, labels
