"""Track one accepted commission without changing routes or reward rules."""

ENGINE_HELPER = r'''function trackedCommission(state){let journal=state?.wayfarer,id=journal?.tracked,contract=typeof id===`string`?wayfarerContracts.find(contract=>contract.id===id):null;if(!contract||!Object.hasOwn(journal.accepted??{},id)||journal.claimed?.includes(id))return null;let region=wayfarerRegions.find(region=>region.id===contract.regionId);if(!region||(state.campaign?.stage??0)<region.minStage)return null;let entry=wayfarerSummary(state,region.id).contracts.find(entry=>entry.id===id);if(!entry)return null;let townName=f[region.town]?.name||region.name,goal=entry.progress.find(goal=>goal.current<goal.target),nextStep=entry.ready?`Return to the Wayfarer Board in ${townName}.${entry.claimBlocked?` Make room for the whole reward first.`:``}`:contract.kind===`survey`?`Copy ${goal.target-goal.current} more ${goal.target-goal.current===1?`record`:`records`} in ${entry.destinationName}.`:contract.kind===`recovery`&&entry.progress[0].current<1?`Find and open a service lift in ${entry.destinationName}.`:`Defeat ${goal.target-goal.current} more ordinary ${goal.target-goal.current===1?`foe`:`foes`} in ${region.name}.`;return{...entry,town:region.town,townName,root:region.root,nextStep,progressText:entry.progress.map(goal=>`${goal.current}/${goal.target}`).join(` · `)}}
'''

UI_HELPERS = r'''function commissionTrackUI(state,contract){let tracked=state.wayfarer?.tracked===contract.id,canTrack=state.mode===`explore`&&!state.battle&&!state.message&&!state.reward&&!state.messageQueue?.length;return`<div class="commission-track-actions"><button class="small-button" ${tracked?`data-commission-untrack`:`data-commission-track`}="${Q(contract.id)}" aria-pressed="${tracked}" ${canTrack?``:`disabled`}>${tracked?`Stop tracking`:`Track commission`}</button>${tracked?`<span>Shown beside your exploration objective</span>`:``}</div>`}
function trackedCommissionUI(state){if(state.mode!==`explore`||state.battle)return``;let tracked=trackedCommission(state);return tracked?`<div class="tracked-commission" data-tracked-commission="${Q(tracked.id)}"><div><span class="eyebrow">TRACKED COMMISSION · ${Q(tracked.progressText)}</span><strong>${Q(tracked.title)}</strong><small>${Q(tracked.nextStep)}</small></div><button class="text-button" data-view-tracked="${Q(tracked.id)}">View commission →</button></div>`:``}
'''

CSS = r'''
.commission-track-actions{display:flex;flex-wrap:wrap;gap:9px;align-items:center;margin-top:12px}.commission-track-actions>span{color:#c7d9f6;font-size:10px;line-height:1.5}.commission-track-actions [aria-pressed=true]{border-color:#ffdfa0;background:#25498a}.tracked-commission{border-top:1px solid #718ac0;display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;padding-top:10px;min-width:0}.tracked-commission>div{display:flex;flex-direction:column;gap:4px;min-width:0}.tracked-commission .eyebrow{font-size:8px;line-height:1.6;color:#ffdfa0}.tracked-commission strong{font-size:12px;line-height:1.5;color:#edf2ff;font-weight:normal;overflow-wrap:anywhere}.tracked-commission small{font-size:10px;line-height:1.6;color:#c7d9f6}.tracked-commission button{font-size:10px;line-height:1.6;text-align:right;min-height:35px;flex-shrink:0}
@media(max-width:760px){.tracked-commission{align-items:flex-start;gap:8px;flex-direction:column;margin-top:10px;padding-top:8px}.tracked-commission button{padding:2px 0;min-height:32px;text-align:left}.tracked-commission strong{font-size:11px}.tracked-commission small{font-size:10px}.commission-track-actions>span{flex-basis:100%}}
'''


def patch(source):
    labels = []

    def once(old, new, label):
        nonlocal source
        count = source.count(old)
        assert count == 1, f'{label}: expected one anchor, found {count}'
        source = source.replace(old, new, 1)
        labels.append(label)

    once('function wayfarerEmpty(){return{accepted:{},claimed:[],kills:',
         'function wayfarerEmpty(){return{accepted:{},claimed:[],tracked:null,kills:',
         'new commission journals begin without an active tracked goal')
    once('if(Se(value.bestiary))for(let[key,row]of Object.entries(value.bestiary))',
         'if(typeof value.tracked===`string`&&Object.hasOwn(result.accepted,value.tracked)&&!result.claimed.includes(value.tracked))result.tracked=value.tracked;if(Se(value.bestiary))for(let[key,row]of Object.entries(value.bestiary))',
         'optional tracked goal imports only accepted unclaimed known commissions')
    once('function wayfarerVictory(state,battle){', ENGINE_HELPER + 'function wayfarerVictory(state,battle){',
         'derive tracked progress and next steps from existing commission state')
    once('acceptCommission(id){',
         'trackCommission(id){if(a.mode!==`explore`||a.battle||a.message||a.reward||a.messageQueue?.length)return!1;let journal=a.wayfarer;if(!journal)return!1;if(id!==null){let contract=typeof id===`string`?wayfarerContracts.find(contract=>contract.id===id):null,region=contract&&wayfarerRegions.find(region=>region.id===contract.regionId);if(!contract||!region||a.campaign.stage<region.minStage||!Object.hasOwn(journal.accepted,id)||journal.claimed.includes(id))return!1}if(journal.tracked===id)return!0;journal.tracked=id;l();z.save();return!0},acceptCommission(id){',
         'idle exploration can track or clear an already accepted commission')
    once('a.wayfarer.claimed.push(id);a.gold+=contract.reward.gold;',
         'a.wayfarer.claimed.push(id);if(a.wayfarer.tracked===id)a.wayfarer.tracked=null;a.gold+=contract.reward.gold;',
         'delivering a tracked commission clears its finished exploration goal')
    once('var wayfarerTab=`commissions`,wayfarerRegion=``;', UI_HELPERS + 'var wayfarerTab=`commissions`,wayfarerRegion=``;',
         'small journal tracking controls and exploration summary helpers')
    once('</article>`}).join(``)}</div><p class="wayfarer-hint">Accepted patrol work',
         '${!board&&contract.accepted&&!contract.claimed&&unlocked?commissionTrackUI(state,contract):``}</article>`}).join(``)}</div><p class="wayfarer-hint">Accepted patrol work',
         'accepted journal work can be tracked without remote acceptance or payout')
    once('<h2>${t}</h2><p>${n}</p></div><div class="exploration-buttons">',
         '<h2>${t}</h2><p>${n}</p>${trackedCommissionUI(e)}</div><div class="exploration-buttons">',
         'show one compact tracked objective inside the existing exploration panel')
    once('if(t.dataset.commissionAccept){',
         'if(t.dataset.commissionTrack){let id=t.dataset.commissionTrack;Pt(X.trackCommission(id)?`Commission tracked beside your exploration objective.`:`Track accepted work after the current action is finished.`),Gt(),focusWayfarerCommission(id);return}if(t.dataset.commissionUntrack){let id=t.dataset.commissionUntrack;Pt(X.trackCommission(null)?`Commission tracking cleared.`:`Finish the current action before clearing tracking.`),Gt(),focusWayfarerCommission(id);return}if(t.dataset.viewTracked){let tracked=trackedCommission(X.state);if(tracked){wayfarerTab=`commissions`,wayfarerRegion=tracked.regionId,It(`wayfarer`),focusWayfarerCommission(tracked.id)}return}if(t.dataset.commissionAccept){',
         'track stop and view controls keep authority and focus in the normal menus')
    once('</head>', '<style>' + CSS + '</style>\n</head>',
         'responsive tracked goals fit the original blue interface')
    return source, labels
