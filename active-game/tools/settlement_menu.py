"""Polish the party menu without changing its destinations or game state."""


def patch(source):
    labels = []
    start = source.index('function ot(e,t){')
    end = source.index('function st(e,t){', start)
    source = source[:start] + PARTY_MENU + source[end:]
    labels.append('make party commands clear while preserving all eight accessible destinations')
    labels.append('show current HP MP job level and condition for every traveler in the main menu')
    old = '</head>'
    assert source.count(old) == 1
    source = source.replace(old, '<style id="settlement-party-menu">\n' + PARTY_CSS + '\n</style>\n</head>', 1)
    labels.append('give the party menu a consistent responsive hierarchy and reachable keyboard focus')
    return source, labels


PARTY_MENU = r'''function ot(e,t){
let commands=[
[`inventory`,`Items / Equipment`,`Items & Gear`,`Use supplies · Equip the party`],
[`magic`,`Skills`,`Skills`,`Techniques and magic`],
[`jobs`,`Jobs`,`Jobs`,`Choose a calling`],
[`status`,`Status`,`Status`,`Stats and growth`],
[`worldmap`,`Area / World Map`,`Maps`,`Area and world maps`],
[`guide`,`Journal`,`Story Journal`,`Quests and field notes`],
[`wayfarer`,`Wayfarer Journal`,`Wayfarer Journal`,`Commissions and discoveries`],
[`help`,`System`,`System`,`Settings and controls`]
],condition=hero=>hero.hp<=0?`Fallen`:({poison:`Poisoned`,silence:`Silenced`,sleep:`Asleep`}[hero.status]??hero.status??`Healthy`),percent=(current,maximum)=>Math.max(0,Math.min(100,maximum>0?current/maximum*100:0));
return`<div class="classic-menu-layout party-menu-layout"><div class="party-command-section"><div class="party-menu-section-label"><span>FOR THE ROAD</span><span aria-hidden="true">◇</span></div><nav class="classic-menu-options" aria-label="Party menu">${commands.map(([panel,label,name,hint])=>`<button data-panel="${panel}" aria-label="${Y(label)}" ${e.mode===`battle`&&[`inventory`,`magic`].includes(panel)?`disabled`:``}><span class="party-command-name" aria-hidden="true">${Y(name)}</span><small aria-hidden="true">${Y(hint)}</small></button>`).join(``)}</nav></div><div class="party-travelers-section"><div class="party-menu-section-label"><span>THE TRAVELERS</span><small>Choose a traveler for details</small></div><div class="menu-party">${e.heroes.map(hero=>`<button data-status-hero="${hero.id}" class="menu-party-row ${hero.hp<=0?`is-fallen`:hero.status?`has-condition`:``}" aria-label="${Y(hero.name)}, ${Y(hero.role)}, level ${hero.level}. HP ${hero.hp} of ${hero.maxHp}. MP ${hero.mp} of ${hero.maxMp}. ${Y(condition(hero))}."><span class="party-menu-portrait" aria-hidden="true">${t(hero.id,48)}</span><span class="party-menu-member"><span class="party-menu-identity"><strong>${Y(hero.name)}</strong><small>Lv ${hero.level}</small></span><span class="party-menu-role"><span>${Y(hero.role)}</span><span class="party-menu-condition ${hero.hp<=0?`condition-fallen`:hero.status?`condition-active`:``}">${Y(condition(hero))}</span></span><span class="party-menu-resources"><span class="party-menu-resource"><span class="party-menu-resource-text"><small>HP</small><span>${hero.hp} <i>/ ${hero.maxHp}</i></span></span><span class="party-menu-meter hp ${hero.hp>0&&hero.hp*4<=hero.maxHp?`is-low`:``}" aria-hidden="true"><i style="width:${percent(hero.hp,hero.maxHp)}%"></i></span></span><span class="party-menu-resource"><span class="party-menu-resource-text"><small>MP</small><span>${hero.mp} <i>/ ${hero.maxMp}</i></span></span><span class="party-menu-meter mp" aria-hidden="true"><i style="width:${percent(hero.mp,hero.maxMp)}%"></i></span></span></span></span><span class="party-menu-member-arrow" aria-hidden="true">›</span></button>`).join(``)}</div></div></div><div class="menu-summary party-menu-summary"><span class="party-menu-location"><small>LOCATION</small><strong>${Y(f[e.area].name)}</strong></span><span class="party-menu-gold"><small>PARTY FUNDS</small><strong>${e.gold.toLocaleString()} <i>G</i></strong></span><span class="party-menu-steps"><small>JOURNEY</small><strong>${e.steps.toLocaleString()} <i>steps</i></strong></span></div>`}
'''


PARTY_CSS = r'''
.party-menu-modal{max-width:900px}
.party-menu-modal .party-menu-layout{grid-template-columns:220px minmax(0,1fr);gap:22px;align-items:start}
.party-menu-section-label{display:flex;justify-content:space-between;align-items:center;gap:8px;min-height:26px;margin-bottom:9px;color:#c5d6f3;font-size:9px;letter-spacing:1px;line-height:1.6}
.party-menu-section-label>small{font-size:9px;font-weight:normal;letter-spacing:0;color:#b9cae9}
.party-menu-section-label>span:last-child{color:#e5c88b}
.party-menu-modal .classic-menu-options{gap:6px}
.party-menu-modal .classic-menu-options button{position:relative;display:flex;flex-direction:column;justify-content:center;gap:4px;min-height:54px;padding:10px 12px 10px 27px;border:1px solid #607aa9;border-radius:5px;background:#0d2257;text-align:left;color:#f0f5ff;line-height:1.4}
.party-menu-modal .classic-menu-options button:before{content:"›";position:absolute;left:11px;top:10px;margin:0;color:#cfdaee;font-size:18px;line-height:1}
.party-menu-modal .classic-menu-options button:hover:not(:disabled),.party-menu-modal .classic-menu-options button:focus-visible{border-color:#edce88;background:#244783}
.party-command-name{font-size:13px}
.party-menu-modal .classic-menu-options button>small{color:#b9cae9;font-size:9px;line-height:1.5}
.party-menu-modal .menu-party{display:grid;gap:8px;min-width:0}
.party-menu-modal .menu-party-row{display:flex;align-items:center;gap:12px;width:100%;min-width:0;min-height:104px;margin:0;padding:11px 12px;border:1px solid #657fb0;border-radius:7px;background:linear-gradient(115deg,#1a3673,#10285e);text-align:left;color:#f0f5ff}
.party-menu-modal .menu-party-row:hover,.party-menu-modal .menu-party-row:focus-visible{border-color:#edce88;background:linear-gradient(115deg,#244886,#17356e)}
.party-menu-modal .menu-party-row.is-fallen{background:linear-gradient(115deg,#29334e,#142143)}
.party-menu-modal .menu-party-row>span{display:flex;flex-direction:initial;gap:0}
.party-menu-portrait{display:flex!important;flex:0 0 48px;align-items:center;justify-content:center;width:48px;height:66px;filter:drop-shadow(0 4px 1px #06112f55)}
.party-menu-portrait>svg{width:48px;height:60px;image-rendering:pixelated}
.menu-party-row.is-fallen .party-menu-portrait{opacity:.5}
.party-menu-modal .menu-party-row>.party-menu-member{display:grid;gap:5px;flex:1;min-width:0}
.party-menu-identity{display:flex;justify-content:space-between;align-items:center;gap:8px;min-width:0}
.party-menu-modal .party-menu-identity>strong{min-width:0;overflow-wrap:anywhere;font-size:16px;line-height:1.4}
.party-menu-modal .party-menu-identity>small{flex-shrink:0;color:#d1def2;font-size:10px;white-space:nowrap}
.party-menu-role{display:flex;align-items:center;justify-content:space-between;gap:6px;color:#bfcfee;font-size:10px;line-height:1.5}
.party-menu-condition{color:#a7d2c1;font-size:9px;white-space:nowrap}
.party-menu-condition.condition-active{color:#f1d38b}
.party-menu-condition.condition-fallen{color:#e2adb5}
.party-menu-resources{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;margin-top:2px}
.party-menu-resource{display:block;min-width:0}
.party-menu-resource-text{display:flex;justify-content:space-between;gap:5px;align-items:baseline;margin-bottom:4px;font-size:11px;white-space:nowrap}
.party-menu-modal .party-menu-resource-text>small{font-size:9px;letter-spacing:.5px;color:#b9e3d2}
.party-menu-resource-text>span{font-variant-numeric:tabular-nums;color:#f0f5ff}
.party-menu-resource-text i{font-style:normal;color:#b5c7e8;font-size:9px}
.party-menu-meter{display:block;height:4px;overflow:hidden;border-radius:3px;background:#071731;box-shadow:0 1px #7385ac33}
.party-menu-meter>i{display:block;height:100%;border-radius:3px;background:linear-gradient(90deg,#70ba9b,#b6e4c5)}
.party-menu-meter.mp>i{background:linear-gradient(90deg,#699de2,#bddcff)}
.party-menu-meter.hp.is-low>i{background:#e3b47f}
.party-menu-resource:has(.mp) .party-menu-resource-text>small{color:#bedaff}
.party-menu-modal .menu-party-row>.party-menu-member-arrow{display:block;flex:0 0 8px;align-self:center;margin-left:1px;color:#bdcdea;font-size:21px;line-height:1}
.party-menu-modal .party-menu-summary{display:flex;align-items:flex-end;gap:16px;padding-top:14px;margin-top:18px;border-top-color:#6e85b3;font-size:11px}
.party-menu-summary>span{display:flex;flex-direction:column;gap:5px;min-width:0}
.party-menu-summary>span>small{font-size:8px;letter-spacing:1px;color:#aebfdf}
.party-menu-summary>span>strong{font-size:11px;font-weight:normal;line-height:1.6;overflow-wrap:anywhere}
.party-menu-summary .party-menu-location{flex:1}
.party-menu-summary .party-menu-gold{flex:0 0 auto;text-align:right;color:#f0d699}
.party-menu-summary .party-menu-gold>strong{font-size:16px}
.party-menu-summary i{font-style:normal;font-size:9px;color:#b7c9e9}
.party-menu-summary .party-menu-gold i{color:#f0d699}
.party-menu-summary .party-menu-steps{flex:0 0 auto;text-align:right}
@media(max-width:700px){
 .party-menu-modal .party-menu-layout{grid-template-columns:minmax(0,1fr);gap:15px}
 .party-menu-section-label{margin-bottom:7px;min-height:22px;font-size:8px}
 .party-menu-section-label>small{font-size:8px}
 .party-menu-modal .classic-menu-options{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:6px}
 .party-menu-modal .classic-menu-options button{min-height:44px;padding:8px 9px 8px 22px;gap:0}
 .party-menu-modal .classic-menu-options button:before{left:8px;top:10px;font-size:16px}
 .party-command-name{font-size:11px;line-height:1.5}
 .party-menu-modal .classic-menu-options button>small{display:none}
 .party-menu-modal .menu-party{gap:6px}
 .party-menu-modal .menu-party-row{min-height:96px;padding:10px;gap:10px}
 .party-menu-portrait{flex-basis:39px;width:39px;height:58px}
 .party-menu-portrait>svg{width:39px;height:50px}
 .party-menu-modal .party-menu-identity>strong{font-size:14px}
 .party-menu-modal .party-menu-identity>small{font-size:9px}
 .party-menu-role{font-size:9px}
 .party-menu-condition{font-size:8px}
 .party-menu-resources{gap:12px}
 .party-menu-resource-text{font-size:10px}
 .party-menu-resource-text i{font-size:8px}
 .party-menu-modal .menu-party-row>.party-menu-member-arrow{font-size:18px;flex-basis:6px}
 .party-menu-modal .party-menu-summary{flex-wrap:wrap;gap:12px;padding-top:13px;margin-top:15px}
 .party-menu-summary .party-menu-location{flex:1 0 100%;text-align:left}
 .party-menu-summary .party-menu-gold{flex:1;text-align:left}
 .party-menu-summary .party-menu-steps{flex:0 0 auto}
}
@media(max-width:360px){
 .party-menu-modal .menu-party-row{padding:9px 8px;gap:8px}
 .party-menu-portrait{flex-basis:32px;width:32px}
 .party-menu-portrait>svg{width:32px;height:44px}
 .party-menu-modal .party-menu-identity>strong{font-size:13px}
 .party-menu-resources{gap:8px}
 .party-menu-resource-text{font-size:9px}
 .party-menu-resource-text i{font-size:8px}
 .party-menu-modal .party-menu-resource-text>small{font-size:8px}
 .party-menu-section-label>small{max-width:52%;text-align:right;line-height:1.5}
}
'''
