"""Original pixel notice boards and matching area-map landmarks."""

def patch(source):
    labels = []

    def once(old, new, label):
        nonlocal source
        assert source.count(old) == 1, f'{label}: source anchor changed'
        source = source.replace(old, new, 1)
        labels.append(label)

    once('serviceTextures(){for(let kind of',
         '''serviceTextures(){Ge(this,`wayfarer-board`,48,58,e=>{J(e,`#10233a66`,2,52,44,5);J(e,`#47382b`,8,22,5,32);J(e,`#47382b`,35,22,5,32);J(e,`#c29b60`,5,5,38,35);J(e,`#65482f`,5,5,38,4);J(e,`#65482f`,5,36,38,4);J(e,`#8f6841`,5,9,4,27);J(e,`#8f6841`,39,9,4,27);J(e,`#e6d4a2`,12,12,13,20);J(e,`#d6c08f`,28,15,9,15);J(e,`#765341`,15,16,7,2);J(e,`#765341`,15,21,7,1);J(e,`#765341`,15,25,5,1);J(e,`#446a8b`,17,10,3,4);J(e,`#446a8b`,30,13,3,4);J(e,`#a98655`,12,42,25,3)});for(let kind of''',
         'draw original parchment notice board for town commissions')
    once('travelTexture(e,t){if(e.kind===`npc`&&e.shopKind)',
         'travelTexture(e,t){if(e.id?.startsWith(`wayfarer-board-`))return`wayfarer-board`;if(e.kind===`npc`&&e.shopKind)',
         'town boards use their own original scenery texture')
    once('symbol=entity=>entity.id.startsWith(`depth-shortcut-`)',
         'symbol=entity=>entity.id.startsWith(`wayfarer-board-`)?`▤`:entity.id.startsWith(`depth-shortcut-`)',
         'area maps distinguish notice boards from ordinary people')
    once('<span>□ Cache</span></div><div class="area-landmarks">',
         '<span>□ Cache</span><span>▤ Notice board</span></div><div class="area-landmarks">',
         'map legend explains the notice board landmark')
    return source, labels
