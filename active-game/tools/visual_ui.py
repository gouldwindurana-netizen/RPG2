"""A coherent blue-and-silver presentation pass; no game state or rules change."""


def patch(source):
    labels = []

    def replace(old, new, label):
        nonlocal source
        assert source.count(old) == 1, (label, source.count(old))
        source = source.replace(old, new, 1)
        labels.append(label)

    replace('class="title-sigil">${Re}</span>',
            'class="title-sigil">${Re}</span><span class="title-watchline" aria-hidden="true">✦<i></i>✧<i></i>✦</span>',
            'frame the original bell sigil with a restrained watch-star ornament')
    replace('<div class="road-line"></div></div><div class="title-content">',
            '<div class="road-line"></div><div class="title-waylights" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div></div><div class="title-content">',
            'add original warm waylights along the title horizon')
    replace(':mt?`<button data-close aria-label="Close panel" class="close-button">×</button>`:``}</div>${n}',
            ':i.includes(`store-modal`)?`<button data-command="dismiss" aria-label="Leave shop" title="Leave shop" class="close-button">×</button>`:mt?`<button data-close aria-label="Close panel" class="close-button">×</button>`:``}</div>${n}',
            'keep a shop exit reachable in the sticky heading on touch screens')
    replace('</head>', '<style id="visual-ui-theme">\n' + UI_CSS + '\n</style>\n</head>',
            'unify title creation HUD and menus with responsive blue silver and warm-gold styling')
    return source, labels


UI_CSS = r'''
/* The night watch: silver-framed indigo windows, warm bell light, mint life and blue mana. */
:root{--watch-ink:#070e27;--watch-navy:#0d1b43;--watch-blue:#172f70;--watch-blue-light:#24468f;--watch-silver:#d5e2ff;--watch-line:#718bbd;--watch-gold:#edce88;--watch-mint:#9ce0be;--watch-mana:#a7ceff;--watch-muted:#b9cbea}
body{color:#eef3ff;background:radial-gradient(ellipse at 50% -12%,#263b6b55,transparent 63%),#070d22}
button{transition:background-color .12s,border-color .12s,box-shadow .12s}
button:not(:disabled){cursor:pointer}
button:disabled{opacity:.42}
button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--watch-gold);outline-offset:3px}
button:hover:not(:disabled){border-color:#eef4ff;box-shadow:inset 0 0 0 1px #d9e5ff24}
button.primary,.primary{background:linear-gradient(180deg,#3156a2,#1d3c7d);border-color:#d2e1ff;box-shadow:inset 0 1px #ffffff20,inset 0 -2px #0a1a4470;color:#fff}
button.primary:hover:not(:disabled),.primary:hover:not(:disabled){background:linear-gradient(180deg,#3a63b4,#254a90)}
.small-button.on,.hero-tabs button.active,.store-categories button.on,.pack-views button[aria-pressed=true],button[aria-pressed=true].compatible-toggle{color:#fff1ce;border-color:var(--watch-gold);background:#294c91;box-shadow:inset 0 -2px #c4a56522}
.eyebrow{color:#bccdeb;line-height:1.6}
.muted,.hint{color:var(--watch-muted)}
.masthead{background:linear-gradient(90deg,#09142fee,#142651ee);box-shadow:0 1px #b1c5ed12}
.wordmark>svg{color:var(--watch-gold);filter:drop-shadow(0 0 6px #eac98218)}
.wordmark span{color:#f1f5ff;letter-spacing:1.2px}
.tools button{border-color:#6982b2;background:#0b1b46;color:#e1eaff;border-radius:3px}
.tools button:hover:not(:disabled){background:#1e3c78}
.chapter-heading{padding:2px 1px 8px}
.chapter-heading h1{letter-spacing:-.4px;font-size:23px;color:#f5f7ff;text-shadow:0 2px #030a23}
.chapter-heading .chapter-resources,.chapter-heading #gold-label{color:var(--watch-gold)}
.stage-wrap,.action-panel,.party-sidebar{border-color:#bccff5;box-shadow:inset 0 0 0 1px #7087b2,0 0 0 1px #0c183a,0 6px 18px #02071850;border-radius:5px}
.scene-topline{color:#e4edff;border-bottom-color:#7791bf;background:linear-gradient(90deg,#152d67,#0c1d49)}
.scene-topline:before{color:var(--watch-gold)}
#scene-state{color:#c4d6f4;letter-spacing:1px}
.stage-foot{color:#bdcff0;background:#0d1f4e}
.exploration-panel{background:linear-gradient(115deg,#1d3c7e,#142b62);position:relative}
.exploration-panel .objective{border-left:2px solid #c7b67c;padding-left:12px}
.exploration-panel .objective>p{color:#e8efff;font-size:12px;line-height:1.7}
.exploration-buttons button{border-radius:3px}
.exploration-buttons .subtle-button{background:#102556;color:#dce7ff;border-color:#8299c7}
.tracked-commission-line{border:1px solid #667fab;background:#0a1a4155;color:#d3e1fc}
.page-foot{color:#879ec6}
.page-foot button{color:#b5caed}
.battle-topline{border-bottom:1px solid #6d85b4;background:linear-gradient(90deg,#102961,#0a1c4c);color:#e4edff}
.battle-topline .intent{color:#e8d5a3}
.has-battle .battle-controls{background:linear-gradient(125deg,#1a3776,#11255b)}
.has-battle .command-heading strong{font-size:15px;color:#fff5df}
.has-battle .command-heading strong span{color:#bacdea;font-size:10px}
.has-battle .command-grid button{background:linear-gradient(120deg,#193876,#102653);border:1px solid #8aa4d2;border-radius:3px}
.has-battle .command-grid button:hover:not(:disabled){background:#284d93;border-color:#f4d690}
.has-battle .command-grid button:focus-visible{background:#284b8d;box-shadow:inset 3px 0 var(--watch-gold)}
.has-battle .battle-log{color:#cbdaf4;border-top-color:#7e96c3}
.has-battle .battle-log p:last-child{color:#f1f5ff}
.has-battle .party-sidebar{background:linear-gradient(135deg,#16316e,#0e2456)}
.has-battle .hero-card{border-radius:3px;border-bottom-color:#4c699f}
.has-battle .hero-card.selected{background:linear-gradient(110deg,#2b4f91,#1c3978);border-color:var(--watch-gold);box-shadow:inset 3px 0 #dfc386}
.has-battle .hero-name{color:#f6f3e8}
.has-battle .hero-numbers{color:var(--watch-mint)}
.has-battle .mana-summary{color:var(--watch-mana)}
.has-battle .plan-label{color:#d5e4fe}
.has-battle .hero-name .hero-level{color:#adc4e8}
.modal-scrim{background:#02071bd1;backdrop-filter:blur(2px)}
.modal{background:linear-gradient(135deg,#1c3b7d,#12295f 75%);border:2px solid #c6d7fa;border-radius:5px;box-shadow:inset 0 0 0 1px #6f86b1,0 0 0 1px #0d1739,0 14px 70px #0009;color:#edf3ff}
.modal .modal-heading{background:linear-gradient(90deg,#1b3977,#15316e);border-bottom:1px solid #8399c0;padding-bottom:14px;margin-bottom:18px;align-items:center;gap:14px}
.modal-heading .eyebrow{color:#e2ca91;font-size:9px;letter-spacing:1.8px}
.modal h2{font-size:23px;line-height:1.3;font-weight:600;letter-spacing:-.5px;color:#f9f4e6}
.modal h3{font-size:16px;color:#ead4a0;font-weight:600;line-height:1.5}
.modal .close-button{display:grid;place-items:center;flex:0 0 36px;width:36px;height:36px;padding:0;border-radius:3px;border:1px solid #9bb0d7;background:#102353;color:#eaf1ff;font-size:22px;line-height:1}
.modal .close-button:hover{background:#2e4c87;border-color:#f1d797}
.modal-footer{border-top:1px solid #667fab;padding-top:15px;gap:10px}
.modal-footer .primary{min-height:42px}
.hero-tabs button,.shop-recipient{background:#10265a;border-color:#748db9;border-radius:3px;color:#dce8ff}
.hero-tabs button[aria-pressed=true],.hero-tabs button.active,.shop-recipients button[aria-pressed=true]{border-color:var(--watch-gold);background:#2a4d90;color:#fff1ca}
.inventory-target{background:linear-gradient(110deg,#10234f,#142c60);border:1px solid #819ac5;border-left:3px solid #bca76e;border-radius:3px;padding:13px}
.inventory-target>strong{color:#fff1ca;line-height:1.6}
.inventory-target>span{color:#c9dbf7}
.inventory-resources{padding-top:4px;gap:14px}
.inventory-health{color:var(--watch-mint)}
.inventory-mana{color:var(--watch-mana)}
.hp-track{background:#081c2b;border:1px solid #749994;border-radius:2px;overflow:hidden}
.hp-track>span{background:linear-gradient(90deg,#4eae93,#b1e4b3)}
.mp-track{background:#0b1a38;border:1px solid #6d8eb9;border-radius:2px;overflow:hidden}
.mp-track>span{background:linear-gradient(90deg,#4c84cf,#a3c8ff)}
.inventory-pack-grid{gap:24px}
.inventory-row{border-bottom-color:#607caf;padding:12px 0;gap:12px;line-height:1.65}
.inventory-row strong{color:#f4eedc;line-height:1.5}
.inventory-row small{color:#c4d5f2;font-size:11px;line-height:1.65}
.supply-row [data-recovery-preview]{color:#aee7cb!important;background:#0c21454d;border-left:2px solid #7ebba8;padding:6px 9px;margin-top:7px;line-height:1.65}
.supply-row>button{min-height:39px;flex-shrink:0}
.pack-views{gap:7px;margin-top:15px}
.pack-views button{min-height:35px;background:#142b60;border:1px solid #758fbd;border-radius:3px}
.loadout{border:1px solid #5976aa;background:#0d235166;border-radius:3px;padding:11px;margin-bottom:9px}
.loadout>strong{color:#f0e5c7}
.gear-slot-label{color:#e0ca97}
.stat-up{color:#b1edcb!important}.stat-down{color:#ffa9a0!important}
.store-modal{max-width:930px}
.store-modal .shop-head{border-bottom:1px solid #637eb1;padding-bottom:10px;margin:8px 0 10px}
.store-modal .shop-gold,.store-modal .spell-price>strong{color:var(--watch-gold)}
.store-modal .shop-intro{font-size:11px!important;line-height:1.6!important;margin:2px 0 10px!important}
.store-modal .shop-recipient-note{font-size:10px;line-height:1.6;color:#bcd0f0;margin:8px 0 11px;max-width:65ch}
.store-modal .store-categories,.store-modal .gear-slot-filters{gap:6px;margin:9px 0}
.store-modal .store-categories button,.store-modal .gear-slot-filters button{border-radius:3px;padding:7px 9px;min-height:32px;font-size:10px}
.store-modal .compatible-toggle{border-radius:3px;min-height:32px;font-size:10px;margin:0 0 6px}
.store-modal .shop-qty{gap:6px;align-items:center;margin:8px 0 12px;font-size:11px}
.store-modal .shop-qty button{min-width:41px;min-height:34px;border-radius:3px}
.store-modal .shop-list{gap:10px;overscroll-behavior:contain}
.store-modal .shop-offer{border:1px solid #6b84b6;border-radius:3px;background:linear-gradient(120deg,#0e2456b3,#152f6588);padding:12px}
.store-modal .shop-offer strong{font-size:13px;line-height:1.5;color:#f3e6c5}
.store-modal .shop-offer small{font-size:11px;line-height:1.65}
.store-modal .shop-offer>button{min-height:40px;min-width:64px;background:#244583}
.store-modal .shop-offered-stats{color:#eddaab}
.store-modal .shop-current{color:#bad0ef}
.store-modal .shop-copy-count{color:#a8c6e7;border-top-color:#5973a2}
.shop-job-warning{color:#f3c3aa!important}
.job-choice-grid button,.job-change-choice{border-radius:3px;background:#102757;border:1px solid #6b85b6}
.job-change-summary{background:#0e2552;border:1px solid #647eac;border-radius:3px;padding:13px}
.job-change-summary h3{color:#f1d99d}
.quest-progress{border-top-color:#657eaa;border-bottom-color:#657eaa;padding:10px 0}
.quest-progress summary{color:#d9e6fd;font-size:12px}
.journal-objective{border-left:3px solid #c1aa6f;padding:2px 0 2px 14px;margin-bottom:22px}
.journal-objective h3{color:#f0e6cc;font-size:19px;margin:4px 0 9px}
.journal-entry{border-bottom-color:#5773a7;padding:12px 0}
.journal-entry p{color:#c0d4f1;line-height:1.75}
.regional-rare-collection{border-color:#8c9cbb;background:linear-gradient(125deg,#1c386d,#0e2557);box-shadow:inset 3px 0 #b49e68;border-radius:3px}
.regional-rare-collection>header>strong{color:#f6d995}
.rare-set-pieces li.is-owned{background:#213e682e}
.rare-set-pieces li.is-owned>span{color:#f2d188}
.dialogue-text{color:#edf3ff!important;line-height:1.8!important}
.reward-mark{color:#edce88;text-shadow:0 2px 16px #d8bb5e33}
.reward-lines p{color:#e8efff;line-height:1.75}
.prologue-dialog{background:linear-gradient(125deg,#132e5bf2,#0d2048fa);border-color:#94acd4;border-top-color:#d5bc83;box-shadow:0 12px 70px #02071599}
.prologue-content h2{font-family:Georgia,"Times New Roman",serif!important;font-weight:400!important;color:#f4e5c2}
.prologue-content p{font-size:17px;line-height:1.8;color:#e0e8f4}
.prologue-topline{border-bottom-color:#58749b}
.prologue-portrait{background:radial-gradient(ellipse,#b89d5626,transparent 75%);border-color:#8295b2}
.prologue-footer .primary{min-height:44px}
/* Front-of-book surfaces keep illustration and warm serif titles out of the playfield. */
.front-screen{background:#09162f;color:#edf1f8}
.front-screen .eyebrow{color:#d9c58e}
.front-screen h1,.front-screen h2,.front-screen h3{font-family:Georgia,"Times New Roman",serif!important;font-weight:400!important}
.title-screen{background:radial-gradient(ellipse at 76% 30%,#4560823d,transparent 53%),linear-gradient(135deg,#142c57,#0b1836 64%,#070e24)}
.title-content{width:min(700px,76vw);margin-left:clamp(30px,10vw,165px);padding:40px 20px 48px 0}
.title-content h1{font-family:Georgia,"Times New Roman",serif!important;font-weight:400!important;color:#f5ebd2;letter-spacing:-2px;font-size:clamp(48px,5.5vw,76px);line-height:1.05;margin-top:19px;text-shadow:0 4px 32px #0008}
.title-content h1>span{color:#d2dded;font-size:.46em;letter-spacing:6px;text-transform:uppercase;margin-bottom:13px}
.title-content>p{font:italic 19px/1.8 Georgia,"Times New Roman",serif!important;color:#c7d2e2;margin:23px 0 27px}
.title-sigil{display:grid;place-items:center;position:relative;color:#ead092;width:62px;height:62px;margin:0 0 10px;border:1px solid #b7a77b66;border-radius:50%;box-shadow:0 0 0 7px #b7a77b08,0 0 28px #d7bc7020;background:#0b1b38aa}
.title-sigil svg{width:30px;height:37px;filter:drop-shadow(0 0 8px #f4d48930)}
.title-watchline{display:flex;align-items:center;gap:8px;width:62px;color:#b4a77f;font-size:8px;margin-bottom:23px}
.title-watchline i{height:1px;flex:1;background:#b4a77f66}
.title-rule{color:#e1c78e;letter-spacing:3px}
.title-rule i{background:linear-gradient(90deg,transparent,#c2aa7870)}
.title-actions{width:315px;gap:10px}
.title-actions button.primary{border-color:#d3c397;background:linear-gradient(120deg,#284b88,#19366c);min-height:52px;font-size:13px;border-radius:3px}
.title-actions .primary small{color:#c3d7f1;font-size:10px;line-height:1.5}
.title-actions button.title-secondary{background:#0c204499;border:1px solid #7b95b4;color:#dce7f7;min-height:45px;border-radius:3px}
.title-actions .text-button{color:#bdcde2;font-size:11px;letter-spacing:.3px}
.title-credits{font-size:8px;letter-spacing:1.8px;color:#c9c5b2;margin-top:30px}
.title-credits span{font-size:7px;color:#91a9ca;letter-spacing:1.1px}
.title-corner{color:#9eb0ca;font-size:8px}
.distant-moon{background:radial-gradient(circle at 38% 34%,#e8e0be,#98aec8);opacity:.8;box-shadow:0 0 60px 18px #9cb7d31a;width:105px;height:105px;right:18%;top:15%}
.distant-moon:after{background:#172d4a;transform:translate(-17px,-9px)}
.distant-tower{background:linear-gradient(90deg,#122a43,#294252 55%,#10243f);right:21%;height:320px;bottom:16%}
.distant-tower svg{color:#e7c782;filter:drop-shadow(0 0 13px #edbf6066)}
.horizon-back{background:#142d42}
.horizon-front{background:#0b1d32}
.road-line{opacity:.85;background:linear-gradient(140deg,transparent 29%,#c3ac6a33 30%,#7d8b9a22 36%,transparent 37%)}
.title-waylights{position:absolute;right:14%;bottom:15%;width:36%;height:12%;pointer-events:none}
.title-waylights i{position:absolute;bottom:0;width:3px;height:5px;background:#f4ce82;box-shadow:0 0 10px 3px #efb45730}
.title-waylights i:after{content:"";position:absolute;left:1px;top:5px;width:1px;height:9px;background:#506172}
.title-waylights i:nth-child(1){left:5%;bottom:12%}.title-waylights i:nth-child(2){left:26%;bottom:30%;width:2px;height:3px}.title-waylights i:nth-child(3){left:53%;bottom:49%;width:2px;height:3px}.title-waylights i:nth-child(4){left:72%;bottom:35%;width:2px;height:3px}.title-waylights i:nth-child(5){left:94%;bottom:7%}
.creator-screen{background:radial-gradient(ellipse at 21% 40%,#27477355,transparent 46%),linear-gradient(135deg,#101f42,#09152f)}
.creator-header{border-bottom-color:#7d91b466;height:74px}
.creator-header .text-button{color:#c5d4e9}
.creation-counter{color:#b7cae7}
.creation-preview>.eyebrow{color:#d2bb83}
.creation-preview h3{font-family:Georgia,"Times New Roman",serif!important;font-size:35px!important;font-weight:400!important;color:#f5e6bd;letter-spacing:.3px}
.creation-preview>p{font:italic 15px/1.7 Georgia,"Times New Roman",serif!important;color:#bfcede}
.preview-job{color:#e6ca8c;letter-spacing:2.6px}
.preview-badges{color:#a6bddb}
.hero-stage-halo{border-color:#b3c4dc4d;background:radial-gradient(circle,#b59a4b26,transparent 65%);box-shadow:0 0 0 18px #d0b77705,0 0 0 19px #bdc9e422}
.hero-stage-halo:after{border-color:#b6a57544}
.hero-plinth{border-bottom-color:#bdad79;background:#06112899}
.preview-spark{color:#eed28c}
.creation-main{background:linear-gradient(135deg,#1c3975,#112956);border:2px solid #b7caed;box-shadow:inset 0 0 0 1px #6d85ae,0 12px 45px #02071955}
.creation-steps{border-bottom-color:#7188b1;background:#10255155;padding:19px 27px}
.creation-steps>span{color:#a5bcdf;font-size:11px}
.creation-steps>span.active{color:#f5e4bb}
.creation-steps>span.active b{background:#d3bc86;border-color:#f4db9b;color:#11264c}
.creation-steps>span.complete{color:#a7d8c5}
.creation-steps b{border-color:#778eb6;color:#c9d9f3}
.creation-body h2{font-family:Georgia,"Times New Roman",serif!important;font-weight:400!important;letter-spacing:-.4px;font-size:31px!important;color:#f6e9c7}
.creation-body p{color:#c0d0e9;font-size:12px;line-height:1.8}
.custom-field legend,.name-label{color:#e4e8ee;font-size:12px}
.name-entry{background:#0b1e42;border:1px solid #8499bb;border-bottom-color:#e0c48b;border-radius:3px}
.name-entry input:focus-visible{outline:none}
.name-entry input{font:26px Georgia,"Times New Roman",serif!important;color:#f2e6c5;padding:13px 15px}
.identity-fields #name-hint{font-size:9px;color:#a3bcde;line-height:1.6}
.front-screen .segmented button,.front-screen select{background:#10264f;border-color:#6d84aa;color:#c9d9f2;border-radius:3px}
.front-screen .segmented button.chosen,.front-screen .job-option.chosen{background:linear-gradient(120deg,#284a83,#1a376b);border-color:#e0c58c;box-shadow:inset 3px 0 #cbb27c;color:#fff1c6}
.front-screen .segmented button{min-height:42px;font-size:11px}
.job-option{background:#10264e;border-color:#7188b2;border-radius:3px;min-height:83px}
.job-option strong{font-family:Georgia,"Times New Roman",serif!important;font-size:19px;color:#f2e4bc}
.job-option small{color:#b1c7e4;font-size:9px;line-height:1.6}
.job-option>i{color:#f0d58d;font-size:13px}
.job-detail{border-top-color:#7289b0}
.job-detail>strong{font-family:Georgia,"Times New Roman",serif!important;color:#f0d89f;font-size:20px}
.job-detail .job-trait{background:#0c204855;border-left:2px solid #c6ae78;color:#e3d5b1;font-size:11px;line-height:1.7}
.job-rating{color:#afc5e3;font-size:9px}
.job-rating i.filled{border-color:#e2c789;background:#e2c789}
.creation-note{border-top-color:#647da6}
.creation-note>span{color:#dec58a}
.creation-note p{font-size:11px;line-height:1.7;color:#becfe9}
.creation-footer{background:#0b1e4359;border-top-color:#7188b0}
.creation-footer .subtle-button{color:#c4d7f2;border-color:#738cb8}
.preview-badges span+span{border-left-color:#6e82a666}
.creator-party-jobs p{font-size:11px;color:#bdcfeb;line-height:1.7}
.creator-party-jobs select{min-height:42px;padding:8px;border-color:#6f8ab5;color:#edf2fc}
@media(max-width:760px){
 .chapter-heading h1{font-size:19px}
 .masthead{padding:11px 12px}
 .tools{gap:5px}.tools button{padding:7px 9px}
 .exploration-panel .objective{padding-left:10px}
 .has-battle .command-heading strong{font-size:14px}
 .has-battle .hero-name{font-size:12px}
 .has-battle .hero-numbers,.has-battle .mana-summary{font-size:11px}
 .modal{padding:16px 15px;max-width:calc(100vw - 20px)}
 .modal .modal-heading{margin-bottom:15px;padding-bottom:12px}
 .modal h2{font-size:21px}
 .modal h3{font-size:16px}
 .modal-heading .eyebrow{font-size:8px;letter-spacing:1.4px}
 .hero-tabs button{padding:9px 7px;min-width:0}
 .inventory-row small{font-size:11px;line-height:1.65}
 .inventory-pack-grid{gap:18px}
 .inventory-target{padding:11px}
 .inventory-health{font-size:12px}
 .inventory-target>span{font-size:11px}
 .supply-row>button{min-width:51px;min-height:42px}
 .store-modal{padding:14px;max-width:calc(100vw - 20px)}
 .store-modal .shop-intro{font-size:10px!important;line-height:1.6!important;margin-bottom:8px!important}
 .store-modal .shop-head{padding-bottom:8px;margin:7px 0 8px}
 .store-modal .shop-recipients{gap:5px;margin:9px 0}
 .store-modal .shop-recipients button{padding:8px 6px;min-height:45px;font-size:10px;line-height:1.5}
 .store-modal .shop-recipient-note{font-size:10px;line-height:1.6;margin:7px 0}
 .store-modal .store-categories{display:flex;flex-wrap:nowrap;gap:5px}
 .store-modal .store-categories button{flex:1;min-width:0;font-size:9px;padding:7px 6px;line-height:1.5}
 .store-modal .gear-slot-filters{display:flex;flex-wrap:nowrap;overflow-x:auto;gap:5px;margin:7px 0;padding:2px 2px 6px;scrollbar-width:thin;scrollbar-color:#819ac4 #132a5c}
 .store-modal .gear-slot-filters button{flex:0 0 auto;font-size:9px;padding:6px 8px;min-height:31px}
 .store-modal .compatible-toggle{font-size:10px;min-height:32px;margin:0 0 5px}
 .store-modal .shop-qty{gap:5px;font-size:10px;margin:7px 0 10px}
 .store-modal .shop-qty button{min-width:38px;min-height:32px;padding:6px 8px}
 .store-modal .shop-list{max-height:49dvh}
 .store-modal .shop-offer{padding:10px}
 .store-modal .shop-offer strong{font-size:12px}
 .store-modal .shop-offer small{font-size:10px;line-height:1.65}
 .modal-footer .primary{min-width:0;width:100%;min-height:43px}
 .title-content{width:100%;margin:0;padding:40px 24px 60px}
 .title-content h1{font-size:clamp(44px,10vw,62px);letter-spacing:-1.6px;max-width:480px}
 .title-content h1>span{font-size:.46em;letter-spacing:4px;margin-bottom:12px}
 .title-content>p{font-size:17px!important;line-height:1.7!important;max-width:330px}
 .title-sigil{width:54px;height:54px}.title-sigil svg{width:25px;height:32px}.title-watchline{width:54px;margin-bottom:22px}
 .title-actions{width:min(315px,100%)}
 .title-credits{font-size:7px;margin-top:25px}.title-credits span{font-size:6px}
 .title-corner{font-size:7px;right:20px;bottom:18px}
 .distant-moon{right:8%;top:11%;width:74px;height:74px;opacity:.55}
 .distant-tower{right:7%;bottom:12%;height:230px;width:85px;opacity:.65}
 .distant-tower svg{width:32px;height:42px;left:27px;top:51px}
 .title-waylights{right:0;bottom:12%;width:67%;opacity:.6}
 .horizon-back{height:28%}.horizon-front{height:17%}
 .creator-header{height:61px;padding:0 15px;gap:8px}
 .creator-header>.eyebrow{display:none}
 .creator-header .text-button{font-size:10px}
 .creation-counter{font-size:7px;letter-spacing:1px}
 .creator-layout{gap:15px;padding:0 13px;margin:12px auto 20px}
 .creation-preview{border-bottom:1px solid #5c759b55;padding:3px 0 15px}
 .hero-stage-halo{box-shadow:0 0 0 7px #d0b77705,0 0 0 8px #bdc9e422}
 .creation-preview h3{font-size:29px!important;margin:6px 0}
 .creation-preview>p{font-size:13px!important;line-height:1.55!important;max-width:none;margin:8px 0 0}
 .preview-job{font-size:9px}
 .creation-main{border-width:2px}
 .creation-steps{padding:14px 16px;gap:7px}
 .creation-steps>span{font-size:9px;gap:6px}
 .creation-body{padding:23px 18px;min-height:0}
 .creation-body h2{font-size:29px!important;margin:8px 0 12px}
 .creation-body p{font-size:11px;line-height:1.8;margin-bottom:20px}
 .name-label{margin:23px 0 10px;font-size:12px}
 .name-entry input{font-size:25px!important;padding:13px}
 .identity-fields #name-hint{font-size:9px;line-height:1.65;margin-bottom:22px}
 .custom-field{margin:19px 0 23px}
 .custom-field legend{font-size:11px}
 .segmented{gap:5px}.front-screen .segmented button{padding:9px 6px;font-size:10px}
 .creation-note{padding-top:16px}.creation-note p{font-size:10px;line-height:1.7;margin:0}
 .creation-footer{padding:14px 17px;gap:12px}
 .creation-footer .primary{min-width:0;flex:1;min-height:44px;font-size:11px}
 .creation-footer .subtle-button{min-width:75px}
 .job-options{gap:7px}.job-option{padding:8px;gap:7px;min-height:79px}
 .job-option strong{font-size:17px!important}.job-option small{font-size:8px;line-height:1.5}
 .job-ratings{gap:12px}.job-detail .job-trait{font-size:10px}
 .creator-party-jobs label{min-width:0}
}
@media(max-width:370px){.tools button{padding:7px}.modal{padding:14px 12px}.title-content{padding-left:20px;padding-right:20px}.title-content h1{font-size:44px}.job-options{grid-template-columns:minmax(0,1fr)}.title-content>p{font-size:16px!important}}
@media(max-height:650px) and (min-width:761px){.title-content{padding-top:22px;padding-bottom:24px}.title-sigil{width:42px;height:42px}.title-sigil svg{width:23px;height:29px}.title-watchline{margin-bottom:9px;width:42px}.title-content h1{font-size:57px;margin:10px 0 15px}.title-content>p{font-size:16px!important;margin:17px 0}.title-credits{margin-top:20px}.title-corner{bottom:16px}}
@media(prefers-reduced-motion:reduce){button{transition:none}.title-sigil svg,.wordmark>svg{filter:none}}
'''
