"""A compact travel-ledger pause menu using the existing menu actions."""


def patch(source):
    labels = []
    start = source.index('function ot(e,t){')
    end = source.index('function st(e,t){', start)
    source = source[:start] + LEDGER_UI + source[end:]
    labels.append('replace the party card stack with a compact ruled travel ledger and existing commands')
    labels.append('show the current road shop or battle context beside live party resources')
    old = 't=Vt(`Party`,`THE ROAD BEYOND THE BELLS`,ot(e,(e,t)=>Et(e,t)),``,`party-menu-modal`)'
    assert source.count(old) == 1, source.count(old)
    source = source.replace(old, 't=Vt(`Travel ledger`,`THE ROAD BEYOND THE BELLS`,ot(e,(e,t)=>Et(e,t)),``,`party-menu-modal`)', 1)
    labels.append('give the ledger a distinct heading while preserving its menu key and navigation')
    assert source.count('</head>') == 1
    source = source.replace('</head>', '<style id="camp-ledger-theme">\n' + LEDGER_CSS + '\n</style>\n</head>', 1)
    labels.append('keep ledger commands roster objective and return action readable on narrow screens')
    return source, labels


LEDGER_UI = r'''function campLedgerContext(state){
if(state.mode===`battle`&&state.battle)return{kind:`battle`,label:`BATTLE IN PROGRESS`,title:state.battle.title,text:`Round ${state.battle.round} · ${state.battle.phase===`resolving`?`The round is resolving.`:`Choose the party’s actions when you return.`}`};
if(state.reward)return{kind:`reward`,label:`BEFORE YOU GO`,title:state.reward.title??`The road continues`,text:`Review the outcome and collected supplies when you return.`};
let shop=settlementShopInfo(state.area),objective=shop?settlementShopObjective(state,shop):P(state);
return{kind:shop?`shop`:`road`,label:shop?`AT THE COUNTER`:`YOUR NEXT STEP`,title:objective[0],text:objective[1]}}
function ot(e,t){
let commands=[
[`inventory`,`Items / Equipment`,`Items & Gear`,`Pack and equipment`],
[`magic`,`Skills`,`Skills`,`Techniques and magic`],
[`jobs`,`Jobs`,`Jobs`,`The party’s callings`],
[`status`,`Status`,`Status`,`Stats and growth`],
[`worldmap`,`Area / World Map`,`Maps`,`Where the road leads`],
[`guide`,`Journal`,`Story Journal`,`Quests and field notes`],
[`wayfarer`,`Wayfarer Journal`,`Wayfarer Journal`,`Work and discoveries`],
[`help`,`System`,`System`,`Settings and controls`]
],condition=hero=>hero.hp<=0?`Fallen`:({poison:`Poisoned`,silence:`Silenced`,sleep:`Asleep`}[hero.status]??hero.status??`Healthy`),percent=(current,maximum)=>Math.max(0,Math.min(100,maximum>0?current/maximum*100:0)),context=campLedgerContext(e);
return`<div class="camp-ledger"><section class="ledger-purpose" data-ledger-context="${Y(context.kind)}"><div><span class="eyebrow">${Y(context.label)}</span><h3>${Y(context.title)}</h3></div><p>${Y(context.text)}</p></section><div class="classic-menu-layout party-menu-layout ledger-spread"><aside class="ledger-command-rail"><div class="ledger-section-heading"><span>FIELD KIT</span><span aria-hidden="true">◇</span></div><nav class="classic-menu-options" aria-label="Party menu">${commands.map(([panel,label,name,hint])=>`<button data-panel="${panel}" aria-label="${Y(label)}" ${e.mode===`battle`&&[`inventory`,`magic`].includes(panel)?`disabled`:``}><span class="ledger-command-title" aria-hidden="true">${Y(name)}</span><small aria-hidden="true">${Y(hint)}</small></button>`).join(``)}</nav></aside><section class="ledger-roster"><div class="ledger-section-heading"><span>THE COMPANY</span><small>Choose a traveler for details</small></div><div class="menu-party">${e.heroes.map(hero=>`<button data-status-hero="${hero.id}" class="menu-party-row ${hero.hp<=0?`is-fallen`:hero.status?`has-condition`:``}" aria-label="${Y(hero.name)}, ${Y(hero.role)}, level ${hero.level}. HP ${hero.hp} of ${hero.maxHp}. MP ${hero.mp} of ${hero.maxMp}. ${Y(condition(hero))}."><span class="party-menu-portrait" aria-hidden="true">${t(hero.id,42)}</span><span class="party-menu-member"><span class="party-menu-identity"><strong>${Y(hero.name)}</strong><small>Lv ${hero.level}</small></span><span class="party-menu-role"><span>${Y(hero.role)}</span><span class="party-menu-condition ${hero.hp<=0?`condition-fallen`:hero.status?`condition-active`:``}">${Y(condition(hero))}</span></span></span><span class="party-menu-resources"><span class="party-menu-resource"><span class="party-menu-resource-text"><small>HP</small><span>${hero.hp} <i>/ ${hero.maxHp}</i></span></span><span class="party-menu-meter hp ${hero.hp>0&&hero.hp*4<=hero.maxHp?`is-low`:``}" aria-hidden="true"><i style="width:${percent(hero.hp,hero.maxHp)}%"></i></span></span><span class="party-menu-resource"><span class="party-menu-resource-text"><small>MP</small><span>${hero.mp} <i>/ ${hero.maxMp}</i></span></span><span class="party-menu-meter mp" aria-hidden="true"><i style="width:${percent(hero.mp,hero.maxMp)}%"></i></span></span></span><span class="party-menu-member-arrow" aria-hidden="true">›</span></button>`).join(``)}</div><p class="ledger-roster-note">Four travelers. A shared road.</p></section></div><footer class="ledger-footer"><div class="menu-summary party-menu-summary"><span class="party-menu-location"><small>LOCATION</small><strong>${Y(f[e.area].name)}</strong></span><span class="party-menu-gold"><small>PARTY FUNDS</small><strong>${e.gold.toLocaleString()} <i>G</i></strong></span></div><button data-close data-ledger-return="1" class="ledger-return"><span aria-hidden="true">←</span> ${e.mode===`battle`?`Return to battle`:`Return to adventure`}</button></footer></div>`}
'''


LEDGER_CSS = r'''
/* The travel ledger: one ruled roster and one command rail, not a wall of cards. */
.party-menu-modal{--ledger-ink:#0b1c39;--ledger-deep:#0e264b;--ledger-rule:#b0c0ce38;--ledger-cream:#eee4c9;--ledger-muted:#b5c5d7;--ledger-gold:#d9bd80;max-width:1020px;background:linear-gradient(112deg,#152e53,#0d2142 72%);border:1px solid #bdcfe6;border-left:4px solid #b7a478;box-shadow:inset 0 0 0 1px #d9e6f51c,0 18px 70px #020817aa;padding:24px 26px 22px;border-radius:5px}
.party-menu-modal .modal-heading{background:linear-gradient(110deg,#152e53,#0d2142);border-bottom:1px solid #c0ac7a66;margin-bottom:18px;padding-bottom:16px}
.party-menu-modal .modal-heading h2{font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:30px;letter-spacing:.2px;color:var(--ledger-cream);line-height:1.2}
.party-menu-modal .modal-heading .eyebrow{font-size:8px;letter-spacing:1.8px;color:#c7b98d}
.party-menu-modal .modal-heading .close-button{border:1px solid #879ab8;background:#0b1c3b;color:#dce6f5}
.camp-ledger{color:#e7edf5}
.ledger-purpose{display:grid;grid-template-columns:minmax(160px,.8fr) minmax(0,1.7fr);gap:20px;align-items:center;margin:0 0 23px;padding:13px 16px;background:linear-gradient(100deg,#d9c69d16,#d9c69d05);border-left:2px solid #cfb275}
.ledger-purpose .eyebrow{font-size:8px;letter-spacing:1.3px;color:#d2be91}
.ledger-purpose h3{margin:4px 0 0;font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:19px;line-height:1.3;color:#f0e6ce}
.ledger-purpose p{margin:0;font-size:11px;line-height:1.8;color:#c5d3e2;overflow-wrap:anywhere}
.party-menu-modal .party-menu-layout.ledger-spread{display:grid;grid-template-columns:195px minmax(0,1fr);gap:24px;align-items:start}
.ledger-command-rail{padding-right:20px;border-right:1px solid var(--ledger-rule)}
.ledger-section-heading{display:flex;justify-content:space-between;align-items:center;gap:8px;min-height:23px;margin:0 0 8px;color:#bfcddd;font-size:8px;letter-spacing:1.4px;line-height:1.6}
.ledger-section-heading>span:last-child{color:#d4bc87}
.ledger-section-heading>small{letter-spacing:0;font-size:8px;font-weight:normal;color:#99aec8}
.party-menu-modal .classic-menu-options{display:grid;gap:2px}
.party-menu-modal .classic-menu-options button{display:flex;flex-direction:column;gap:3px;justify-content:center;position:relative;min-height:43px;border:0;border-radius:0;border-bottom:1px solid #b7c8d81b;padding:7px 10px 7px 19px;background:transparent;text-align:left;line-height:1.4;box-shadow:none;color:#e2e9f4}
.party-menu-modal .classic-menu-options button:before{content:'›';position:absolute;left:3px;top:8px;color:#d6c493;font-size:18px;line-height:1}
.party-menu-modal .classic-menu-options button:hover:not(:disabled),.party-menu-modal .classic-menu-options button:focus-visible{border-color:#cfbd8b55;background:#d5bc7d12;color:#fff1cc;box-shadow:inset 2px 0 #d0b678}
.ledger-command-title{font-size:12px}
.party-menu-modal .classic-menu-options button>small{font-size:8px;line-height:1.4;color:#8fa8c5}
.party-menu-modal .ledger-roster .menu-party{display:block;min-width:0;border-top:1px solid #a7bccf55}
.party-menu-modal .ledger-roster .menu-party-row{display:grid;grid-template-columns:38px minmax(105px,1.1fr) minmax(170px,1.6fr) 10px;align-items:center;gap:13px;width:100%;min-width:0;min-height:82px;margin:0;padding:10px 6px;border:0;border-bottom:1px solid var(--ledger-rule);border-radius:0;background:transparent;box-shadow:none;text-align:left;color:#e5ecf5}
.party-menu-modal .ledger-roster .menu-party-row:hover,.party-menu-modal .ledger-roster .menu-party-row:focus-visible{background:#dbe8f50b;border-bottom-color:#cbb781;box-shadow:none}
.party-menu-modal .ledger-roster .menu-party-row.is-fallen{background:#b4a0ab0a}
.party-menu-modal .ledger-roster .menu-party-row>span{display:block;gap:0}
.party-menu-modal .ledger-roster .party-menu-portrait{display:flex!important;align-items:center;justify-content:center;width:38px;height:55px;flex:none;filter:drop-shadow(0 3px 1px #020b1f77)}
.party-menu-modal .ledger-roster .party-menu-portrait>svg{width:38px;height:50px;image-rendering:pixelated}
.party-menu-modal .ledger-roster .menu-party-row.is-fallen .party-menu-portrait{opacity:.45}
.party-menu-modal .ledger-roster .menu-party-row>.party-menu-member{display:block;min-width:0}
.party-menu-modal .ledger-roster .party-menu-identity{display:flex;align-items:baseline;justify-content:space-between;gap:6px;min-width:0}
.party-menu-modal .ledger-roster .party-menu-identity>strong{font-size:14px;font-weight:normal;color:#eee5cd;line-height:1.4;overflow-wrap:anywhere}
.party-menu-modal .ledger-roster .party-menu-identity>small{font-size:8px;white-space:nowrap;flex-shrink:0;color:#a8bdd3}
.party-menu-modal .ledger-roster .party-menu-role{display:flex;flex-wrap:wrap;justify-content:flex-start;gap:4px 8px;margin-top:5px;font-size:9px;line-height:1.5;color:#9db4ce}
.party-menu-modal .ledger-roster .party-menu-role>span:first-child{font-size:10px}
.party-menu-modal .ledger-roster .party-menu-condition{font-size:8px;color:#9fc2b0;white-space:nowrap}
.party-menu-modal .ledger-roster .party-menu-condition.condition-active{color:#edce8c}
.party-menu-modal .ledger-roster .party-menu-condition.condition-fallen{color:#dda3ae}
.party-menu-modal .ledger-roster .menu-party-row>.party-menu-resources{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:15px;min-width:0;margin:0}
.party-menu-modal .ledger-roster .party-menu-resource{display:block;min-width:0}
.party-menu-modal .ledger-roster .party-menu-resource-text{display:flex;justify-content:space-between;gap:5px;margin:0 0 5px;align-items:baseline;white-space:nowrap;font-size:11px;font-variant-numeric:tabular-nums}
.party-menu-modal .ledger-roster .party-menu-resource-text>small{font-size:8px;color:#9fcbb8;letter-spacing:.5px}
.party-menu-modal .ledger-roster .party-menu-resource:has(.mp) .party-menu-resource-text>small{color:#a7c8ec}
.party-menu-modal .ledger-roster .party-menu-resource-text i{font-size:8px;font-style:normal;color:#8ca4bf}
.party-menu-modal .ledger-roster .party-menu-meter{display:block;height:3px;background:#06182d;border-radius:0;overflow:hidden;box-shadow:0 1px #9cb6ce1a}
.party-menu-modal .ledger-roster .party-menu-meter>i{display:block;height:100%;border-radius:0;background:#a3c9ae}
.party-menu-modal .ledger-roster .party-menu-meter.mp>i{background:#8fbae1}
.party-menu-modal .ledger-roster .party-menu-meter.hp.is-low>i{background:#dfbc84}
.party-menu-modal .ledger-roster .menu-party-row>.party-menu-member-arrow{display:block;font-size:20px;line-height:1;color:#b5c4d3;margin:0;flex:none}
.ledger-roster-note{margin:14px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:12px;font-style:italic;letter-spacing:.3px;color:#7f99b5}
.ledger-footer{display:flex;align-items:center;justify-content:space-between;gap:22px;margin-top:22px;padding-top:15px;border-top:1px solid #bca97866}
.party-menu-modal .ledger-footer .party-menu-summary{display:flex;align-items:flex-start;gap:24px;flex:1;min-width:0;padding:0;margin:0;border:0;font-size:10px}
.party-menu-modal .ledger-footer .party-menu-summary>span{display:flex;flex-direction:column;gap:4px;min-width:0;text-align:left}
.party-menu-modal .ledger-footer .party-menu-summary>span>small{font-size:7px;letter-spacing:1px;color:#809bb9}
.party-menu-modal .ledger-footer .party-menu-summary>span>strong{font-weight:normal;font-size:10px;line-height:1.5;color:#c7d4e2;overflow-wrap:anywhere}
.party-menu-modal .ledger-footer .party-menu-location{flex:1}
.party-menu-modal .ledger-footer .party-menu-gold{flex:0 0 auto;max-width:45%}
.party-menu-modal .ledger-footer .party-menu-gold>strong{color:#d8c496;font-size:14px}
.party-menu-modal .ledger-footer .party-menu-summary i{font-size:8px;font-style:normal;color:#a28e65}
.party-menu-modal .ledger-return{flex:0 0 auto;display:flex;align-items:center;justify-content:center;gap:9px;min-height:42px;padding:9px 16px;border:1px solid #b9a16b;border-radius:3px;background:#d3bc7c0d;color:#e6d6ae;font-size:11px;line-height:1.4;white-space:nowrap}
.party-menu-modal .ledger-return:hover{background:#d3bc7c20;border-color:#e1cd99}
.party-menu-modal button:focus-visible{outline:2px solid #e7cf91;outline-offset:2px}
@media(max-width:800px){
 .party-menu-modal{padding:20px 19px;max-width:calc(100vw - 26px)}
 .party-menu-modal .party-menu-layout.ledger-spread{grid-template-columns:160px minmax(0,1fr);gap:18px}
 .ledger-command-rail{padding-right:14px}
 .party-menu-modal .ledger-roster .menu-party-row{grid-template-columns:34px minmax(0,1fr) 10px;gap:5px 10px;min-height:86px;padding:10px 4px}
 .party-menu-modal .ledger-roster .party-menu-portrait{grid-column:1;grid-row:1/3;width:34px}
 .party-menu-modal .ledger-roster .menu-party-row>.party-menu-member{grid-column:2;grid-row:1}
 .party-menu-modal .ledger-roster .menu-party-row>.party-menu-resources{grid-column:2;grid-row:2;gap:13px}
 .party-menu-modal .ledger-roster .menu-party-row>.party-menu-member-arrow{grid-column:3;grid-row:1/3}
 .party-menu-modal .ledger-roster .party-menu-identity>strong{font-size:13px}
 .party-menu-modal .ledger-roster .party-menu-role{margin-top:3px;gap:3px 8px}
 .party-menu-modal .ledger-roster .party-menu-resource-text{font-size:10px;margin-bottom:4px}
 .ledger-purpose{gap:14px;grid-template-columns:minmax(140px,.8fr) minmax(0,1.3fr);padding:12px 14px}
 .ledger-purpose h3{font-size:18px}
 .ledger-purpose p{font-size:10px}
}
@media(max-width:580px){
 .party-menu-modal{padding:16px 13px 15px;max-width:calc(100vw - 20px);border-left-width:3px}
 .party-menu-modal .modal-heading{margin-bottom:13px;padding-bottom:11px}
 .party-menu-modal .modal-heading h2{font-size:25px}
 .party-menu-modal .modal-heading .eyebrow{font-size:7px;letter-spacing:1px}
 .ledger-purpose{display:block;margin-bottom:17px;padding:10px 12px}
 .ledger-purpose .eyebrow{font-size:7px}
 .ledger-purpose h3{font-size:18px;margin:3px 0 5px}
 .ledger-purpose p{font-size:10px;line-height:1.65}
 .party-menu-modal .party-menu-layout.ledger-spread{display:flex;flex-direction:column;gap:16px}
 .ledger-roster{order:1;width:100%;min-width:0}
 .ledger-command-rail{order:0;width:100%;padding:0;border:0}
 .ledger-section-heading{min-height:20px;margin-bottom:6px;font-size:7px;letter-spacing:1px}
 .ledger-section-heading>small{font-size:7px}
 .party-menu-modal .ledger-roster .menu-party-row{min-height:81px;gap:4px 9px;padding:8px 3px}
 .party-menu-modal .ledger-roster .party-menu-portrait{height:52px}
 .party-menu-modal .ledger-roster .party-menu-portrait>svg{width:34px;height:46px}
 .party-menu-modal .ledger-roster .party-menu-identity>strong{font-size:13px}
 .party-menu-modal .ledger-roster .party-menu-identity>small{font-size:8px}
 .party-menu-modal .ledger-roster .party-menu-role{font-size:8px;margin-top:3px}
 .party-menu-modal .ledger-roster .party-menu-role>span:first-child{font-size:9px}
 .party-menu-modal .ledger-roster .party-menu-condition{font-size:8px}
 .party-menu-modal .ledger-roster .party-menu-resource-text{font-size:10px}
 .party-menu-modal .ledger-roster .party-menu-resource-text i{font-size:8px}
 .ledger-roster-note{display:none}
 .party-menu-modal .classic-menu-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 13px}
 .party-menu-modal .classic-menu-options button{min-height:42px;padding:8px 5px 8px 16px;gap:0}
 .party-menu-modal .classic-menu-options button:before{left:1px;top:9px}
 .ledger-command-title{font-size:11px}
 .party-menu-modal .classic-menu-options button>small{display:none}
 .ledger-footer{display:block;margin-top:17px;padding-top:12px}
 .party-menu-modal .ledger-footer .party-menu-summary{gap:16px}
 .party-menu-modal .ledger-footer .party-menu-gold>strong{font-size:13px}
 .party-menu-modal .ledger-return{width:100%;margin-top:14px;min-height:43px}
}
@media(max-width:350px){
 .party-menu-modal{padding-left:10px;padding-right:10px}
 .ledger-purpose{padding-left:9px;padding-right:9px}
 .ledger-purpose h3{font-size:17px}
 .party-menu-modal .ledger-roster .menu-party-row{grid-template-columns:28px minmax(0,1fr) 8px;gap:4px 7px}
 .party-menu-modal .ledger-roster .party-menu-portrait{width:28px}
 .party-menu-modal .ledger-roster .party-menu-portrait>svg{width:30px;height:42px}
 .party-menu-modal .ledger-roster .party-menu-resource-text{font-size:9px}
 .party-menu-modal .ledger-roster .party-menu-resource-text i{font-size:7px}
 .party-menu-modal .ledger-roster .party-menu-identity>strong{font-size:12px}
 .ledger-section-heading>small{font-size:6.5px}
}
@media(prefers-reduced-motion:reduce){.party-menu-modal button{transition:none}}
'''
