"""Polish the uploaded growth build's compact, canvas-first presentation."""

def patch(source):
    changes = []

    def replace(old, new, label):
        nonlocal source
        assert source.count(old) == 1, (label, source.count(old))
        source = source.replace(old, new)
        changes.append(label)

    start = source.index('\n.game-shell{padding-top:14px!important}')
    end = source.index('</style>', start)
    source = source[:start] + PRESENTATION_CSS + source[end:]
    changes.append('replace conflicting growth layout overrides with a compact responsive game theme')

    start = source.index('function dt(e){')
    end = source.index('var ft=', start)
    source = source[:start] + JOURNAL_UI + source[end:]
    changes.append('show repeatable regional rare encounters and owned set pieces inside the field journal')

    replace('Off leaves bosses and hunts available.',
            'Off leaves story bosses available.',
            'describe encounter settings without removed static rare hunts')

    assert source.count('Lv ${skill.levelRequired}') == 3
    source = source.replace('Lv ${skill.levelRequired}', 'Tier ${skill.tier}')
    source = source.replace('Requires level ${skill.levelRequired}', 'Not available here')
    changes.append('describe the uploaded regional skill tiers without obsolete level requirements')

    replace('The upper terrace and its rare hunt remain optional.',
            'The upper terrace remains optional, and rare creatures roam the region’s wilds.',
            'remove the orchard dialogue reference to a stationary rare hunt')

    replace('refreshWorld(e){let t=e.mode===`intro`?W(e.profile,e.partyJobs)[e.introStep]:void 0,n=this.readMap();this.regionLabel.setText(',
            'refreshWorld(e){let t=e.mode===`intro`?W(e.profile,e.partyJobs)[e.introStep]:void 0,n=this.readMap();this.regionLabel.setVisible(e.mode===`intro`).setText(',
            'keep the exploration map clear of duplicated canvas location text')
    replace('this.hintLabel.setVisible(e.mode===`explore`&&!e.message&&!e.reward)',
            'this.hintLabel.setVisible(e.mode===`intro`)',
            'use readable DOM exploration instructions instead of tiny duplicate canvas text')
    replace('this.regionLabel.setText(`${t.kind===`boss`?`BOSS ENCOUNTER`:',
            'this.regionLabel.setVisible(!0).setText(`${t.kind===`boss`?`BOSS ENCOUNTER`:',
            'restore battle labels when switching from the uncluttered exploration map')
    replace('this.hintLabel.setText(t.phase===`resolving`?`The round unfolds…`:`Choose an action for each hero, then commit the round.`).setVisible(!0)',
            'this.hintLabel.setText(t.phase===`resolving`?`The round unfolds…`:`Choose an action for each hero, then commit the round.`).setVisible(!1)',
            'keep battle instructions readable in the command panel instead of a clipped duplicate canvas strip')

    return source, changes


JOURNAL_UI = r'''function regionalRareCollectionUI(state,region){let rare=regionalRareSummary(state,region);if(!rare?.enemy)return``;return`<section class="regional-rare-collection" data-regional-rare="${Y(region)}"><header><div><span class="eyebrow">REGIONAL RARE · REPEATABLE</span><h3>${Y(rare.enemy.name)}</h3></div><strong>${rare.discovered} / ${rare.pieces.length} pieces</strong></header><p>A rare foe can replace a road or dungeon encounter in this region (${Math.round(rare.rate*100)}% chance). It is part of the wilds, not a one-time mission reward.</p><p>Each victory drops one regional set piece. Pieces you do not own come first; later victories build spare copies for the party.</p><ul class="rare-set-pieces">${rare.pieces.map(piece=>`<li class="${piece.owned?`is-owned`:``}" data-rare-piece="${Y(piece.id)}"><span aria-hidden="true">${piece.owned?`◆`:`◇`}</span><div><small>${Y({head:`Headgear`,mantle:`Mantle`,charm:`Charm`}[piece.slot]??piece.slot)}</small><strong>${Y(piece.name)}</strong></div><b>${piece.owned?`${piece.owned} owned`:`Not found`}</b></li>`).join(``)}</ul><p class="rare-set-note">${rare.complete?`Regional set collected. Equip two or three pieces on the same traveler for its set bonuses.`:`Collect all three pieces to complete this regional set. Worn copies are included in these counts.`}</p></section>`}
function dt(e){let t=P(e),n=M(e.area,e.player.x,e.player.y);return`<div class="journal-objective"><span class="eyebrow">CURRENT OBJECTIVE</span><h3>${Y(t[0])}</h3><p>${Y(t[1])}</p></div><details class="quest-progress"><summary>The journey · ${Math.min(e.campaign.stage,10)} / 10</summary><ol>${m.slice(0,10).map((t,n)=>`<li class="${n<e.campaign.stage?`finished`:n===e.campaign.stage?`current`:``}">${n<e.campaign.stage?`✓ `:``}${Y(t)}</li>`).join(``)}</ol></details><div class="journal-grid"><section><h3>Regional enemies</h3>${d.enemies.filter(e=>e.region_id===n).map(e=>`<div class="journal-entry"><strong>${Y(e.name)}</strong><span>Lv ${e.level} · Weakness: ${Y(e.weakness.join(`, `)||`none`)}</span><p>${Y(e.counter)}</p></div>`).join(``)}</section><section>${regionalRareCollectionUI(e,n)}<h3>On the road</h3><p>Regional sets are optional alternatives to equipment sold in each town. Explore dangerous routes for rare foes, and prepare enough medicine and MP for the return trip.</p><p>Enemies stay at their regional strength. Higher level color variants can appear in the same family. Retreat, recover and buy equipment before a dangerous crossing.</p><p>Plan every traveler’s action before resolving a round. Exploit weaknesses and guard against announced heavy attacks. MP persists between encounters.</p></section></div>`+optionalJournal(e)+depthExpeditionUI(e)}
'''


PRESENTATION_CSS = r'''
/* Growth-build presentation: original blue windows, clear commands, full playfield. */
:root{--ui-deep:#0b1742;--ui-blue:#142c73;--ui-surface:#10245d;--ui-line:#7088bd;--ui-silver:#d4dff7;--ui-gold:#ffe1a0;--ui-soft:#c1d1f2}
body{min-width:320px;background:radial-gradient(ellipse at 50% 0,#1a305f 0,transparent 66%),#070d26}
.masthead{background:linear-gradient(90deg,#0b1536e8,#142653e8);border-bottom:1px solid #607ba8}
.tools button{transition:background .12s,border-color .12s;min-height:34px}
.tools button:hover:not(:disabled){background:#294c91}
button:focus-visible,a:focus-visible{outline:2px solid var(--ui-gold);outline-offset:3px}
.game-shell{padding-top:14px;max-width:1340px}
.chapter-heading{margin-bottom:10px}
.chapter-heading h1{font-size:22px;line-height:1.2}
.game-shell .play-layout{display:grid;grid-template-columns:minmax(0,1fr);align-items:start;gap:12px}
.game-shell .stage-wrap{width:100%;min-width:0;align-self:start}
.stage-wrap,.action-panel,.party-sidebar,.modal{border:2px solid var(--ui-silver);border-radius:5px;box-shadow:inset 0 0 0 1px #7183b2,0 0 0 1px #1c2d5d,0 5px 0 #03082080}
.game-shell .canvas-shell{aspect-ratio:auto;height:clamp(320px,calc(100dvh - 330px),640px);max-height:none;background:#14283e}
.scene-topline{background:linear-gradient(90deg,#102765,#0c1d4e);height:32px;border-bottom:1px solid #6079ab}
.stage-foot{height:27px;background:#102357}
.game-shell .party-sidebar{display:none}
.game-shell .action-panel{min-height:0;margin-top:12px;background:linear-gradient(120deg,#1b3c8b,#10225f)}
.exploration-panel{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;min-height:0;padding:12px 14px}
.exploration-panel .quest-emblem,.exploration-buttons>small{display:none}
.exploration-panel .objective{display:block;min-width:0}
.exploration-panel .objective>.eyebrow,.exploration-panel .objective>h2{display:none}
.exploration-panel .objective>p{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;font-size:12px;line-height:1.6;margin:0;color:#e0e8fa}
.exploration-buttons{display:flex;flex-direction:row;gap:8px;width:auto;min-width:0;flex-shrink:1}
.exploration-buttons .primary{min-width:180px;max-width:100%;text-align:left;white-space:normal}
.exploration-buttons .subtle-button{min-width:125px;white-space:normal}
.exploration-buttons button{min-height:42px;padding:9px 12px}
.tracked-commission-line{margin:6px 0 0!important}
.page-foot{min-height:42px}
.page-foot button{padding:8px}
.has-battle .game-shell{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:10px 12px;padding-top:12px}
.has-battle .chapter-heading,.has-battle .page-foot{display:none}
.has-battle .game-shell .play-layout{display:contents}
.has-battle .stage-wrap{grid-column:1/-1;grid-row:1}
.has-battle .scene-topline,.has-battle .stage-foot{display:none}
.has-battle .canvas-shell .touch-pad{display:none!important}
.has-battle .game-shell .canvas-shell{height:clamp(260px,calc(100dvh - 380px),570px)}
.has-battle .action-panel{grid-column:1;grid-row:2;margin:0}
.has-battle .game-shell .party-sidebar{display:block;grid-column:2;grid-row:2;padding:8px}
.has-battle .party-sidebar .section-label{display:flex;height:24px;margin:0 0 5px;font-size:9px;letter-spacing:.8px}
.has-battle .party-note,.has-battle .hero-card .portrait,.has-battle .hero-card .hero-role,.has-battle .hero-card .hp-track,.has-battle .hero-card .mp-track{display:none}
.has-battle #party{display:grid;grid-template-columns:minmax(0,1fr);gap:3px}
.has-battle .hero-card{min-height:0;padding:7px 8px;border:1px solid transparent;border-bottom-color:#546ea9;background:transparent}
.has-battle .hero-card.selected{background:#2b4e98;border:1px solid var(--ui-gold);box-shadow:inset 3px 0 var(--ui-gold)}
.has-battle .hero-detail{display:grid;grid-template-columns:1fr auto;gap:3px 10px;min-width:0}
.has-battle .hero-name{grid-column:1/-1;font-size:13px;line-height:1.4;gap:4px}
.has-battle .hero-name .hero-level{font-size:8px}
.has-battle .hero-numbers{grid-column:1;font-size:11px;margin:0;justify-content:flex-start;gap:5px}
.has-battle .mana-summary{grid-column:2;font-size:10px;margin:0;white-space:nowrap}
.has-battle .hero-numbers i,.has-battle .mana-summary i{font-size:8px;color:var(--ui-soft)}
.has-battle .plan-label{grid-column:1/-1;line-height:1.4;font-size:9px;margin:0;overflow-wrap:anywhere}
.has-battle .status-tag{font-size:8px}
.battle-topline{padding:8px 12px;gap:5px 14px;flex-wrap:wrap;background:#0d2259;min-height:0}
.battle-topline .eyebrow{font-size:10px}
.battle-topline .intent{font-size:10px;line-height:1.5}
.has-battle .battle-controls{display:grid;grid-template-columns:minmax(0,1fr) 190px;grid-template-areas:"cmd ctl" "log ctl";gap:10px 14px;padding:12px;min-height:0}
.has-battle .battle-command{grid-area:cmd;min-width:0}
.has-battle .command-heading{margin:0 0 8px;min-width:0;gap:8px}
.has-battle .command-heading strong{font-size:14px;line-height:1.4}
.has-battle .command-heading strong span{display:block;margin:2px 0 0;font-size:10px}
.has-battle .command-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
.has-battle .command-grid button{min-width:0;min-height:47px;padding:8px 10px;text-align:left;font-size:13px;line-height:1.4}
.has-battle .command-grid button small{font-size:9px;line-height:1.4;white-space:normal}
.has-battle .battle-log{grid-area:log;position:static;inset:auto;transform:none;width:auto;height:auto;min-width:0;max-height:76px;overflow:auto;border:0;border-top:1px solid #5974ad;padding:7px 0 0;margin:0;font-size:10px;line-height:1.6}
.has-battle .battle-log p{margin:0 0 4px}
.has-battle .round-controls{grid-area:ctl;display:grid;grid-template-columns:1fr 1fr;align-content:start;gap:7px;min-width:0}
.has-battle .round-controls>span{grid-column:1/-1;font-size:10px;line-height:1.5}
.has-battle .round-controls .primary{grid-column:1/-1;min-height:42px}
.has-battle .round-controls button{min-height:35px;padding:7px 6px;font-size:10px}
.has-battle .ability-list,.has-battle .target-list{max-height:180px}
.has-battle .target-button{min-height:44px}
.has-battle .ability-list button{min-height:48px}
.modal{scrollbar-color:#8398cb #0e2057;max-height:90dvh}
.modal-heading{position:sticky;top:0;z-index:3;background:#15317b;border-bottom:1px solid #637eb5;padding:0 0 12px;margin-bottom:14px}
.modal-heading .close-button{min-width:35px;min-height:35px}
.store-modal{max-width:900px;padding:18px 20px}
.store-modal .shop-intro{font-size:12px;line-height:1.6;margin:6px 0 12px;color:var(--ui-soft)}
.store-modal .shop-head{margin:8px 0}
.store-modal .shop-qty{margin:8px 0 12px;flex-wrap:wrap}
.store-modal .shop-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;max-height:50dvh;overflow-y:auto;padding-right:5px;scrollbar-color:#8398cb #0e2057}
.store-modal .inventory-row{border:1px solid #6078af;background:#10245b99;padding:11px;gap:10px;min-width:0;align-items:flex-start}
.store-modal .inventory-row>span:first-child{flex:1;min-width:0}
.store-modal .inventory-row strong{font-size:12px;line-height:1.5}
.store-modal .inventory-row small{font-size:10px;line-height:1.6}
.store-modal .inventory-row .small-button{min-height:38px;font-size:10px;padding:8px}
.store-modal .shop-current{color:#c4d3f2}
.store-modal .shop-offered-stats{color:var(--ui-gold)}
.store-modal .shop-copy-count{margin-top:7px;border-top:1px solid #526ba1;padding-top:6px}
.store-modal .shop-comparison{margin-top:8px;gap:5px}
.store-modal .spell-offer .spell-price{flex-shrink:0}
.regional-rare-collection{border:1px solid #6d86b8;background:linear-gradient(125deg,#17326c,#0d2055);padding:15px;margin:0 0 20px}
.regional-rare-collection>header{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;border-bottom:1px solid #4b669b;padding-bottom:11px;margin-bottom:11px}
.regional-rare-collection h3{margin:5px 0 0;font-size:16px}
.regional-rare-collection>header>strong{color:var(--ui-gold);font-size:10px;font-weight:normal;white-space:nowrap;line-height:1.6}
.regional-rare-collection p{font-size:11px!important;line-height:1.7;margin:8px 0;color:#c8d8f5}
.rare-set-pieces{list-style:none;margin:14px 0;padding:0}
.rare-set-pieces li{display:flex;align-items:center;gap:9px;min-width:0;border-top:1px solid #486397;padding:10px 0;color:#95add8}
.rare-set-pieces li>span{font-size:17px;color:#8ca4d5}
.rare-set-pieces li.is-owned>span{color:var(--ui-gold)}
.rare-set-pieces li>div{flex:1;min-width:0}
.rare-set-pieces small{display:block;font-size:9px;color:#a6bee9;line-height:1.6}
.rare-set-pieces strong{font-size:11px;font-weight:normal;line-height:1.6;overflow-wrap:anywhere}
.rare-set-pieces li.is-owned strong{color:#f4f7ff}
.rare-set-pieces b{font-size:9px;font-weight:normal;white-space:nowrap;color:#c4d5f6}
.regional-rare-collection .rare-set-note{border-top:1px solid #4b669b;padding-top:10px;color:var(--ui-gold)}
@media(min-width:1250px){.has-battle .command-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media(max-width:1000px){.has-battle .game-shell{grid-template-columns:minmax(0,1fr) 275px}.has-battle .battle-controls{grid-template-columns:minmax(0,1fr) 160px}.exploration-buttons .primary{min-width:160px}.exploration-buttons .subtle-button{min-width:110px}}
@media(max-width:760px){
 .masthead{padding:11px 12px;gap:9px;min-height:0}
 .game-shell{padding:12px 10px 0}
 .chapter-heading{margin-bottom:9px;align-items:center}
 .chapter-heading h1{font-size:18px;line-height:1.3}
 .chapter-heading .eyebrow{font-size:8px;line-height:1.6}
 .game-shell .play-layout{display:grid;grid-template-columns:minmax(0,1fr);gap:0;width:100%}
 .game-shell .stage-wrap{width:100%}
 .game-shell .canvas-shell{height:auto;aspect-ratio:5/3;padding-bottom:84px;box-sizing:content-box;min-height:0}
 .canvas-shell #game-world{bottom:84px}
 .canvas-shell .touch-pad{display:block;left:12px;bottom:8px}
 .canvas-shell .touch-pad button{width:37px;height:33px;margin:1px}
 .canvas-shell:after{content:"Tap to walk · E to interact";position:absolute;right:12px;bottom:36px;max-width:52%;font-size:9px;line-height:1.7;color:#c1d1f2;text-align:right;pointer-events:none}
 .has-battle .canvas-shell:after{display:none}
 .scene-topline{padding:0 9px;gap:6px;font-size:10px}
 .scene-topline #scene-state{font-size:7px}
 .stage-foot{font-size:7px;height:26px;padding:0 7px;gap:10px}
 .stage-foot .stage-foot-right{display:none}
 .exploration-panel{display:grid;grid-template-columns:minmax(0,1fr);gap:10px;padding:12px}
 .exploration-panel .objective>p{font-size:11px;line-height:1.6}
 .exploration-buttons{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);width:100%;gap:7px;flex:none}
 .exploration-buttons .primary,.exploration-buttons .subtle-button{min-width:0;width:100%;min-height:44px;padding:8px;font-size:10px;white-space:normal}
 .exploration-buttons .primary kbd{margin-left:4px}
 .tracked-commission-line{max-width:100%;font-size:10px}
 .has-battle .game-shell{display:grid;grid-template-columns:minmax(0,1fr);gap:8px;padding-top:10px}
 .has-battle .game-shell .play-layout{display:contents}
 .has-battle .game-shell .canvas-shell{height:auto;aspect-ratio:5/3;padding-bottom:0;min-height:0}
 .has-battle .canvas-shell #game-world{bottom:0}
 .has-battle .action-panel{grid-column:1;grid-row:2}
 .has-battle .game-shell .party-sidebar{grid-column:1;grid-row:3;padding:7px}
 .has-battle #party{grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}
 .has-battle .hero-card{padding:6px;border:1px solid #617aaf}
 .has-battle .hero-detail{grid-template-columns:minmax(0,1fr);gap:3px}
 .has-battle .hero-name{font-size:11px;flex-wrap:wrap;gap:3px}
 .has-battle .hero-name .hero-level{font-size:8px}
 .has-battle .hero-numbers{font-size:10px}
 .has-battle .mana-summary{grid-column:1;font-size:10px}
 .has-battle .plan-label{font-size:8px}
 .has-battle .battle-controls{grid-template-columns:minmax(0,1fr);grid-template-areas:"cmd" "ctl" "log";gap:10px;padding:11px}
 .has-battle .command-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
 .has-battle .command-grid button{min-height:43px;padding:8px;font-size:12px}
 .has-battle .command-grid button small{display:none}
 .has-battle .round-controls{grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
 .has-battle .round-controls>span{grid-column:1/-1}
 .has-battle .round-controls .primary{grid-column:1/-1;min-height:42px}
 .has-battle .round-controls button{min-width:0;padding:7px 4px;font-size:9px;min-height:34px}
 .has-battle .battle-log{max-height:64px;font-size:10px}
 .has-battle .ability-list,.has-battle .target-list{max-height:170px}
 .battle-topline{padding:8px 10px;gap:4px 8px}
 .battle-topline .eyebrow,.battle-topline .intent{font-size:9px;line-height:1.6}
 .store-modal{padding:13px;max-width:calc(100vw - 20px)}
 .store-modal .shop-list{grid-template-columns:minmax(0,1fr);max-height:49dvh;padding-right:3px}
 .store-modal .inventory-row{padding:10px}
 .store-modal .shop-head{flex-wrap:wrap;gap:8px}
 .store-modal .shop-intro{font-size:11px;line-height:1.6}
 .store-modal .inventory-row .small-button{min-height:40px}
 .store-modal .shop-recipients{margin-top:10px}
 .modal-heading{padding-bottom:10px;margin-bottom:12px}
 .regional-rare-collection{padding:12px}
 .regional-rare-collection>header{flex-wrap:wrap;gap:7px}
 .regional-rare-collection h3{font-size:15px}
 .rare-set-pieces b{font-size:8px}
 .page-foot{min-height:36px}
}
@media(prefers-reduced-motion:reduce){.tools button{transition:none}}
'''
