"""Read-only battle field notes and engine-consistent planning feedback."""

CORE = r'''function tacticalEnemyKey(state,enemy){let battle=state?.battle;if(!battle||!enemy)return null;let region=battle.regionId??M(state.area,state.player.x,state.player.y),kind=battle.kind,id=kind===`boss`?(battle.encounterId===`bailiff`?`B_R01_BAILIFF`:battle.encounterId):kind===`rare`?(battle.encounterId===`silver`?`R01_RARE`:battle.encounterId):enemy.templateId,rank=kind===`boss`?`boss`:kind===`rare`?`rare`:enemy.rank??`base`;return`${region}|${id}|${rank}`}
function tacticalIntel(state){let battle=state?.battle;return{available:state?.mode===`battle`&&battle?.phase===`planning`,round:battle?.round??0,enemies:(battle?.enemies??[]).map(enemy=>{let key=tacticalEnemyKey(state,enemy),known=!!key&&!!wayfarerBestiaryEntry(key)&&(state.wayfarer?.bestiary?.[key]?.defeated??0)>0;return{id:enemy.id,name:enemy.displayName||enemy.name,hp:enemy.hp,maxHp:enemy.maxHp,rank:enemy.rank??battle.kind,intent:enemy.intent??`Watch its next move.`,alive:enemy.hp>0,known,weakness:known?[...(enemy.weakness??[])]:[],resistance:known?[...(enemy.resistance??[])]:[]}}),heroes:(state?.heroes??[]).map(hero=>({id:hero.id,name:hero.name,attackType:PHYS[hero.job]??`slash`}))}}
function tacticalItemStock(state,itemId,heroId){let battle=state?.battle,owned=Math.max(0,state?.inventory?.[itemId]??0),reserved=Object.entries(battle?.plans??{}).filter(([id,plan])=>id!==heroId&&plan.type===`item`&&plan.itemId===itemId).length,available=Math.max(0,owned-reserved),hero=state?.heroes?.find(hero=>hero.id===heroId),usable=!!hero&&hero.hp>0&&hero.status!==`sleep`&&state.mode===`battle`&&battle?.phase===`planning`&&ue.includes(itemId)&&available>0&&state.heroes.some(target=>consumableValid(state,itemId,target,{battlePlanning:!0}));return{owned,reserved,available,usable}}
function tacticalTargetValid(state,action,target){if(state?.mode!==`battle`||state.battle?.phase!==`planning`||!action||!target)return!1;if(action.type===`attack`)return target.hp>0&&state.battle.enemies.some(enemy=>enemy.id===target.id);if(action.type===`item`)return tacticalItemStock(state,action.itemId,action.heroId).available>0&&ue.includes(action.itemId)&&state.heroes.some(hero=>hero.id===target.id)&&consumableValid(state,action.itemId,target,{battlePlanning:!0});if(action.type===`spell`){let spell=action.spell??te.find(spell=>spell.id===action.spellId);if(!spell)return!1;if(spell.target===`enemy`||spell.target===`allEnemies`)return target.hp>0&&state.battle.enemies.some(enemy=>enemy.id===target.id);if(!state.heroes.some(hero=>hero.id===target.id))return!1;return(spell.effect===`revive`?target.hp===0:target.hp>0)&&(spell.effect!==`cure`||target.status!==null)}return!1}
'''

UI = r'''function tacticalIntelUI(state){let notes=tacticalIntel(state);return`<p class="tactical-intro">Check each foe's announced intent, then choose the party's actions. Field notes reveal affinities only after a victory against that exact regional enemy and rank.</p><div class="tactical-party" aria-label="Party attack types">${notes.heroes.map(hero=>`<span><strong>${Q(hero.name)}</strong> · ${Q(hero.attackType)}</span>`).join(``)}</div><div class="tactical-enemies">${notes.enemies.map(enemy=>`<article data-tactical-enemy="${Q(enemy.id)}" data-tactical-known="${enemy.known}" class="${enemy.alive?``:`tactical-fallen`}"><header><h3>${Q(enemy.name)}</h3><span>${enemy.hp} / ${enemy.maxHp} HP${enemy.alive?``:` · Defeated`}</span></header><p class="tactical-intent">${enemy.alive?Q(enemy.intent):`This foe has fallen. Its slot stays in place.`}</p>${enemy.known?`<dl><div><dt>Weakness</dt><dd>${Q(enemy.weakness.join(`, `)||`None recorded`)}</dd></div><div><dt>Resists</dt><dd>${Q(enemy.resistance.join(`, `)||`None recorded`)}</dd></div></dl>`:`<p class="tactical-unknown">Affinities not yet recorded. Win an encounter against this enemy to add its field notes.</p>`}</article>`).join(``)}</div><p class="tactical-intro">Reading tactics spends no action, charge or item. Close this window to return to planning.</p>`}
function tacticalBattleItemsUI(state,heroId){return[`POTION`,`HIGH_POTION`,`MENDING_BALM`,`ANTIDOTE`,`REVIVAL_SALT`,`CLEAR_TONIC`,`SOOTHING_DRAUGHT`].filter(id=>(state.inventory[id]??0)>0).map(id=>{let stock=tacticalItemStock(state,id,heroId);return`<button data-battle-item="${id}" data-owned="${stock.owned}" data-reserved="${stock.reserved}" data-available="${stock.available}" ${stock.usable?``:`disabled`}><span>${Q(K(id)?.name??id)} <small class="battle-supply-count">${stock.available} available · ${stock.reserved} reserved / ${stock.owned} owned</small></span><em>${Q(K(id)?.effect??``)}</em></button>`}).join(``)||`<p>No supplies remain.</p>`}
'''

CSS = r'''
.tactics-modal{--tactics-rule:#728cc6;--tactics-muted:#c6d7f8;--tactics-warm:#ffe1a4;max-width:780px}.tactical-intro{font-size:11px!important;line-height:1.7;color:var(--tactics-muted)}.tactical-party{display:flex;flex-wrap:wrap;gap:7px;margin:15px 0}.tactical-party>span{font-size:10px;line-height:1.6;padding:6px 8px;border:1px solid var(--tactics-rule)}.tactical-party strong{font-weight:normal;color:var(--tactics-warm)}.tactical-enemies{display:grid;grid-template-columns:1fr 1fr;gap:12px}.tactical-enemies article{border:1px solid var(--tactics-rule);padding:12px;background:#10266680;min-width:0}.tactical-enemies header{display:flex;flex-direction:column;gap:7px}.tactical-enemies h3{font-size:14px;line-height:1.5;margin:0;overflow-wrap:anywhere}.tactical-enemies header>span{font-size:11px;color:var(--tactics-muted)}.tactical-enemies p{font-size:11px;line-height:1.7}.tactical-intent{color:var(--tactics-warm)}.tactical-unknown{color:var(--tactics-muted)}.tactical-enemies dl{font-size:11px;line-height:1.7;margin:10px 0 0}.tactical-enemies dl>div{display:flex;justify-content:space-between;gap:12px;border-top:1px solid var(--tactics-rule);padding:5px 0}.tactical-enemies dt{color:var(--tactics-muted)}.tactical-enemies dd{margin:0;text-align:right;overflow-wrap:anywhere}.tactical-fallen{opacity:.65}.battle-supply-count{display:block!important;white-space:normal;line-height:1.6}.target-button:disabled{opacity:.45;cursor:not-allowed}
@media(max-width:760px){.tactical-enemies{grid-template-columns:1fr}.tactical-party{gap:5px}.tactical-party>span{font-size:10px}.tactical-enemies article{padding:10px}.tactical-enemies h3{font-size:13px}.tactical-enemies p{font-size:11px}}
'''


def patch(source):
    labels = []

    def once(old, new, label):
        nonlocal source
        count = source.count(old)
        assert count == 1, f'{label}: expected one anchor, found {count}'
        source = source.replace(old, new, 1)
        labels.append(label)

    once('function Ee(e={}){', CORE + 'function Ee(e={}){',
         'read-only battle notes and planning helpers follow discovered catalog ranks')
    once('function Bt(){', UI + 'function Bt(){',
         'classic tactics window and shared supply reservation feedback')
    once('function It(e){mt||',
         'function It(e){if(e===`tactics`&&!tacticalIntel(X.state).available)return;mt||',
         'tactics opens only while a battle waits for plans')
    once('function Ht(){let e=X.state;',
         'function Ht(){let e=X.state;if(mt===`tactics`&&!tacticalIntel(e).available)mt=null;',
         'tactics closes when battle planning ends')
    once('mt===`status`?(n=`status:`+$,',
         'mt===`tactics`?(n=`tactics:`+e.battle.round,t=Vt(`Battle tactics`,`FIELD NOTES · ROUND ${e.battle.round}`,tacticalIntelUI(e),``,`tactics-modal`)):mt===`status`?(n=`status:`+$,',
         'tactics uses standard modal focus and close controls')
    once('<button class="text-button" data-command="flee" ${t.kind===`boss`||a?`disabled`:``}>',
         '<button class="subtle-button" data-panel="tactics" ${a?`disabled`:``}>Battle tactics</button><button class="text-button" data-command="flee" ${t.kind===`boss`||a?`disabled`:``}>',
         'round controls offer optional tactics without adding a battle action')
    once('<button data-target="${Q(e.id)}" class="target-button"><span>',
         '<button data-target="${Q(e.id)}" class="target-button" ${tacticalTargetValid(X.state,{..._t,heroId:$},e)?``:`disabled title="Choose a valid target for this action"`}><span>',
         'ally targets reflect item cure revival and living-target rules')
    old = '${[`POTION`,`HIGH_POTION`,`MENDING_BALM`,`ANTIDOTE`,`REVIVAL_SALT`,`CLEAR_TONIC`,`SOOTHING_DRAUGHT`].filter(t=>(e.inventory[t]??0)>0).map(t=>`<button data-battle-item="${t}"><span>${Q(K(t)?.name??t)} <small>×${e.inventory[t]}</small></span><em>${Q(K(t)?.effect??``)}</em></button>`).join(``)||`<p>No supplies remain.</p>`}'
    once(old, '${tacticalBattleItemsUI(e,$)}',
         'item choices show owned reserved and available copies and valid uses')
    once('if(!Ot&&e.key===`Escape`&&[`Quartermaster`',
         'if(e.key===`Escape`&&mt===`tactics`){mt=null,Ht(),e.preventDefault();return}if(!Ot&&e.key===`Escape`&&[`Quartermaster`',
         'Escape returns directly from tactics to the battle command cursor')
    once('</head>', '<style>' + CSS + '</style>\n</head>',
         'responsive tactical notes preserve the original blue menu appearance')
    return source, labels
