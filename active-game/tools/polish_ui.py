"""Keep keyboard choices visible and show useful field-supply actions."""

HELPERS = r'''function supplyUseUI(state,hero,itemId){let item=K(itemId),limit=itemId===`SPARK_TEA`?2:itemId===`DEEP_TEA`?4:0;if(limit)return`<div class="supply-actions" role="group" aria-label="${Q(item.name)} charge tier"><small>Choose charge tier</small>${Array.from({length:limit},(_,index)=>{let tier=index+1,available=consumableValid(state,itemId,hero,{tier});return`<button class="small-button" data-use="${Q(itemId)}" data-use-tier="${tier}" ${available?``:`disabled`} title="${available?`Restore one tier ${tier} charge`:`No spent tier ${tier} charge on this traveler`}" aria-label="Use ${Q(item.name)} on ${Q(hero.name)}, tier ${tier}">T${tier} +1</button>`}).join(``)}</div>`;return`<button class="small-button" data-use="${Q(itemId)}" ${consumableValid(state,itemId,hero)?``:`disabled title="No effect on this traveler right now"`} aria-label="Use ${Q(item?.name||itemId)} on ${Q(hero.name)}">Use</button>`}
function focusBattleOption(button){if(!button)return;button.focus({preventScroll:true});if(button.closest(`.target-list,.ability-list`))button.scrollIntoView({block:`nearest`,inline:`nearest`,behavior:`instant`})}
'''

CSS = '''
.supply-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:5px;max-width:168px;flex-shrink:0}
.supply-actions>small{width:100%;text-align:right;font-size:10px;color:#c7d9f9;line-height:1.5}
.supply-actions .small-button{min-width:56px}
[data-shop-compare]{display:inline-block;max-width:100%;overflow-wrap:anywhere}
@media(max-width:480px){.inventory-row:has(.supply-actions){flex-wrap:wrap}.inventory-row:has(.supply-actions)>span{flex-basis:100%}.supply-actions{max-width:100%;width:100%;justify-content:flex-start}.supply-actions>small{text-align:left}}
'''


def patch(source):
    labels = []

    def once(old, new, label):
        nonlocal source
        count = source.count(old)
        assert count == 1, f'{label}: expected one anchor, found {count}'
        source = source.replace(old, new, 1)
        labels.append(label)

    once('function Bt(){', HELPERS + 'function Bt(){', 'field-supply-actions-and-battle-focus-helper')
    once('i.focus({preventScroll:!0}),e.preventDefault();return}}}',
         'focusBattleOption(i),e.preventDefault();return}}}',
         'keyboard-battle-targets-scroll-into-view')
    once('function Ut(){requestAnimationFrame(()=>document.querySelector(`.target-list button:not([disabled]),.ability-list button:not([disabled])`)?.focus({preventScroll:!0}))}',
         'function Ut(){requestAnimationFrame(()=>focusBattleOption(document.querySelector(`.target-list button:not([disabled]),.ability-list button:not([disabled])`)))}',
         'new-target-and-ability-lists-focus-visible-choice')
    once('case`undo`:X.undo($),Gt();break;',
         'case`undo`:X.undo($),Gt(),Wt();break;',
         'clearing-a-plan-restores-command-focus')
    once('X.plan(t.id,{type:`attack`,target:e.id});Gt();break}case`restart`:',
         'X.plan(t.id,{type:`attack`,target:e.id});Gt(),Wt();break}case`restart`:',
         'quick-planning-restores-resolve-focus')
    once('`CAMP_MEAL`,`MENDING_BALM`,`SPARK_TEA`];t=Vt(',
         '`CAMP_MEAL`,`MENDING_BALM`,`SPARK_TEA`,`DEEP_TEA`];t=Vt(',
         'owned-deep-tea-appears-with-field-use-actions')
    once('${a.includes(e)?`<button class="small-button" data-use="${Q(e)}">Use</button>`:``}',
         '${a.includes(e)?supplyUseUI(X.state,r,e):``}',
         'supplies-disable-no-effect-actions-and-let-player-choose-tea-tier')
    once('X.useItem(t.dataset.use,$)',
         'X.useItem(t.dataset.use,$,t.dataset.useTier===void 0?void 0:Number(t.dataset.useTier))',
         'selected-tea-tier-reaches-engine')
    once('</head>', '<style>' + CSS + '</style>\n</head>', 'responsive-supply-actions-and-readable-shop-comparisons')
    return source, labels
