"""Render each companion's selected job while preserving their appearance."""

HELPER = r'''function partyAppearance(state,id){let hero=state.heroes.find(hero=>hero.id===id),base=id===`Mara`?state.profile:Pe[id];return{...(base||Pe.Mara),name:hero?.name||base?.name||id,job:hero?.job||base?.job||`warden`}}
'''


def patch(source):
    labels = []

    def once(old, new, label):
        nonlocal source
        assert source.count(old) == 1, f'{label}: expected one anchor'
        source = source.replace(old, new, 1)
        labels.append(label)

    once('function Et(e,t=36){return e===`Mara`?Ne(X.state.profile,t):Fe(e,t)}',
         HELPER + 'function Et(e,t=36){return Ne(partyAppearance(X.state,e),t)}',
         'party portraits follow each selected job and retain individual appearance')
    once('this.followers.forEach((e,n)=>e.setVisible(!t&&this.trail.length>n+1))',
         'this.followers.forEach((sprite,index)=>sprite.setTexture(Ye(this,partyAppearance(e,[`Tavin`,`Iona`,`Soren`][index]))).setVisible(!t&&this.trail.length>index+1))',
         'world followers update their job outfit without changing party identities')
    once('hero.id===`Mara`?Ye(this,e.profile):`hero-${hero.id}`',
         'Ye(this,partyAppearance(e,hero.id))',
         'battle actors use the same current-job appearance as menus and exploration')
    once('var he=wayfarerLayout(depthDungeonLayout(expansionWorldLayout(travelMapLayout(j({camp:pe(),works:me()})))));',
         'function skillMerchantNames(maps){for(let map of Object.values(maps))for(let entity of map.entities)if(entity.shopKind===`magic`||entity.id.startsWith(`magic-`)){entity.name=`Skill Shop`;entity.hint=`Learn techniques and magic for each job`}return maps}var he=skillMerchantNames(wayfarerLayout(depthDungeonLayout(expansionWorldLayout(travelMapLayout(j({camp:pe(),works:me()}))))));',
         'town signs and map landmarks name the unified Skill Shop')
    once('function W(e){', 'function W(e,partyJobs){',
         'intro roles can follow the selected companion jobs')
    for hero, default, role in [('Tavin','striker','The courier'),('Iona','mender','The healer'),('Soren','arcanist','The engineer')]:
        title = {'striker':'Striker','mender':'Mender','arcanist':'Arcanist'}[default]
        once(f'role:`{title} · {role}`', f'role:`${{V(partyJobs?.{hero}??`{default}`).name}} · {role}`',
             f'{hero} introduction preserves identity and displays the selected job')
    once('let e=W(X.state.profile),t=e[X.state.introStep]',
         'let e=W(X.state.profile,X.state.partyJobs),t=e[X.state.introStep]',
         'prologue uses the current four-member job roster')
    once('let t=e.mode===`intro`?W(e.profile)[e.introStep]:void 0',
         'let t=e.mode===`intro`?W(e.profile,e.partyJobs)[e.introStep]:void 0',
         'exploration intro camera reads the same selected job roles')
    once('let color=a.kind===`heal`?`#bce0a9`:',
         'let color=a.resource===`mp`?`#a7ccff`:a.kind===`heal`?`#bce0a9`:',
         'MP recovery uses the mana color in battle feedback')
    once('message=a.kind===`guard`?`GUARD`:a.amount?`${a.kind===`heal`?`+`:`−`}${a.amount}`:a.kind===`spell`?`MAGIC`:`MISS`',
         'message=a.kind===`guard`?`GUARD`:a.amount?`${a.kind===`heal`?`+`:`−`}${a.amount}${a.resource===`mp`?` MP`:a.resource===`hp`?` HP`:``}`:a.kind===`heal`?a.resource===`status`?`CURED`:`NO CHANGE`:a.kind===`spell`?`MAGIC`:`MISS`',
         'successful mana and condition recovery never display a miss')
    return source, labels
