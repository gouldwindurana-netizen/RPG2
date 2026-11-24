"""An original camp-at-dusk opening menu; game state and handlers are unchanged."""


def patch(source):
    start = source.index('function ze(e){')
    end = source.index('function Be(e,t){', start)
    source = source[:start] + TITLE_UI + source[end:]
    assert source.count('</head>') == 1
    source = source.replace('</head>', '<style id="camp-opening-menu">\n' + TITLE_CSS + '\n</style>\n</head>', 1)
    return source, [
        'give the opening menu an original dusk camp and distant bell landscape',
        'show the actual current journey and party beside the existing continue action',
        'keep clear keyboard and touch actions with responsive reduced-motion-friendly art',
        'make the title help a persistent collapsible keyboard and touch guide',
        'cut the crescent moon transparently so its inner edge reveals the actual dusk sky',
    ]


TITLE_UI = r'''function ze(e){let continuing=e.mode!==`creation`,chapter=m[Math.max(0,Math.min(10,e.campaign?.stage??0))],location=f[e.area]?.name??`Avel`,lead=e.heroes[0],figures=e.heroes.map((hero,index)=>`<span class="camp-traveler camp-traveler-${index+1}">${Ne(partyAppearance(e,hero.id),68)}</span>`).join(``);return`<section class="front-screen title-screen camp-title" role="dialog" aria-modal="true" aria-label="Main menu"><div class="camp-title-art" aria-hidden="true">${campOpeningLandscape()}<div class="camp-travelers">${figures}</div><div class="camp-art-caption"><span></span> THE WATCHFIRE <span></span></div></div><div class="camp-title-shade" aria-hidden="true"></div><div class="camp-title-content"><div class="camp-title-mark" aria-hidden="true">${Re}<span>AN ADVENTURE IN AVEL</span></div><h1><span>The Road</span>Beyond the Bells</h1><p class="camp-title-lead">Rest a moment.<br> The road will be waiting.</p><div class="camp-title-actions">${continuing?`<button class="primary camp-continue" data-front="continue" autofocus><span>Continue the journey</span><b aria-hidden="true">→</b></button><div class="camp-journey-summary" data-camp-journey><div class="camp-journey-heading"><span>YOUR JOURNEY</span><strong class="camp-journey-hero">${Le(lead.name)} <small>· ${Le(lead.role)} · Lv ${lead.level}</small></strong></div><div class="camp-journey-copy"><strong class="camp-journey-chapter">${Le(chapter)}</strong><span class="camp-journey-location">${Le(location)}</span></div><div class="camp-journey-party" aria-label="Current party">${e.heroes.map(hero=>`<span title="${Le(hero.name)} · ${Le(hero.role)}"><i aria-hidden="true">${Ne(partyAppearance(e,hero.id),32)}</i><span>${Le(hero.name)}</span></span>`).join(``)}</div></div>`:``}<button class="${continuing?`camp-new title-secondary`:`primary camp-new`}" data-front="new" ${continuing?``:`autofocus`}><span>New adventure</span><b aria-hidden="true">→</b></button><details class="camp-how-guide"><summary tabindex="0">How to play <span aria-hidden="true">⌄</span></summary><div><p><strong>Explore</strong> Move with WASD or arrow keys. Tap a destination, or use the direction pad. Press E or Space to talk.</p><p><strong>Battle</strong> Choose an action for each traveler, then resolve the round. Guard heavy attacks and keep recovery supplies ready.</p><p><strong>Your party</strong> Press Escape for the party menu and M for maps. Check the save notice before closing the game.</p></div></details></div><footer class="camp-title-footer"><span>Four travelers. One road home.</span><small>KEYBOARD &amp; TOUCH</small></footer></div></section>`}
function campOpeningLandscape(){return`<svg class="camp-landscape" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="camp-sky" x2="0" y2="1"><stop stop-color="#172443"/><stop offset=".55" stop-color="#40556c"/><stop offset="1" stop-color="#aaa489"/></linearGradient><linearGradient id="camp-earth" x2="0" y2="1"><stop stop-color="#1c3c3b"/><stop offset="1" stop-color="#081a25"/></linearGradient><linearGradient id="camp-river" x2="0" y2="1"><stop stop-color="#a9b8b1" stop-opacity=".65"/><stop offset="1" stop-color="#203f4a" stop-opacity=".15"/></linearGradient><radialGradient id="camp-fire-glow"><stop stop-color="#eebf74" stop-opacity=".3"/><stop offset=".5" stop-color="#d79b57" stop-opacity=".12"/><stop offset="1" stop-color="#d79b57" stop-opacity="0"/></radialGradient><linearGradient id="camp-tower" x2="1" y2="1"><stop stop-color="#304847"/><stop offset="1" stop-color="#162e37"/></linearGradient><mask id="camp-moon-cutout" maskUnits="userSpaceOnUse" x="1180" y="130" width="115" height="115"><rect x="1180" y="130" width="115" height="115" fill="#fff"/><circle cx="1218" cy="174" r="48" fill="#000"/></mask></defs><path fill="url(#camp-sky)" d="M0 0h1600v1000H0z"/><g fill="#e5d6b7" opacity=".6"><circle cx="870" cy="74" r="1.3"/><circle cx="1010" cy="132" r="1"/><circle cx="1270" cy="84" r="1.1"/><circle cx="1438" cy="158" r="1.3"/><circle cx="1540" cy="54" r="1"/><circle cx="756" cy="181" r=".9"/><circle cx="1165" cy="40" r=".8"/><circle cx="1490" cy="267" r=".9"/><circle cx="925" cy="231" r=".8"/></g><circle class="camp-moon" data-camp-moon cx="1235" cy="187" r="49" fill="#d7d7c3" opacity=".78" mask="url(#camp-moon-cutout)"/><path fill="#657b7c" d="M0 469C160 407 220 432 342 385s202-42 326 32 198-104 332-28 239-63 363-7 182-36 237-3v621H0z"/><path fill="#456368" d="M0 536c180-51 219 25 375-20s229-114 393-46 275-51 388-18 255-10 444-42v590H0z"/><g fill="#355052"><path d="M1028 403v-117h14v-22h17v22h12v117z"/><path d="M1013 309h75v10h-75z"/><path d="M1022 288h58l-29-29z"/><path fill="#9f9f7d" d="M1048 298h8v20h-8z"/><path d="M1088 411v-65h21v-11h17v76z"/><path d="M1158 406v-39h26v39z"/></g><path fill="#2e5056" d="M0 611c201-95 269 35 451-11s262-43 395-38 258-86 424-28 200-25 330-43v509H0z"/><path fill="url(#camp-river)" d="M1088 482c-61 39-3 64-88 91s-48 58-149 73-49 59-152 83-58 112-246 151l304 62c101-93 68-119 174-154s24-68 93-105-9-78 48-109-14-48 43-92z"/><path fill="#233f43" d="M0 720c204-84 290 49 468-4s245 51 408-37 258-63 383-15 205-20 341-38v374H0z"/><path fill="url(#camp-earth)" d="M0 853c201-74 288 46 499-26s279 41 453-9 254-98 382-47 198 7 266-11v240H0z"/><path fill="#102a31" d="M858 787c70-49 132-67 214-43s105-43 194-5 126 11 222 2l112 259H803z"/><ellipse cx="1190" cy="781" rx="230" ry="160" fill="url(#camp-fire-glow)"/><ellipse cx="1190" cy="812" rx="156" ry="28" fill="#071c23" opacity=".65"/><path d="m1154 812 75-14m-67-9 60 30" fill="none" stroke="#67513b" stroke-width="13" stroke-linecap="round"/><path fill="#bd753d" d="M1162 799c-8-28 25-41 21-73 24 14 43 38 33 66-3 15-18 21-30 19-12 1-22-3-24-12z"/><path fill="#ebac54" d="M1175 796c-5-19 12-29 13-49 16 15 24 29 17 44-3 13-19 17-30 5z"/><path fill="#f6d68a" d="M1184 797c-6-10 3-19 6-28 12 18 13 29-1 33z"/><g fill="#e9bc72"><circle cx="1191" cy="706" r="2"/><circle cx="1174" cy="685" r="1.5"/><circle cx="1206" cy="667" r="1"/></g><path d="M1480 1000c-12-177 13-384 11-615" stroke="#0b242b" stroke-width="48" fill="none"/><path d="M1490 584c-59-63-104-74-166-72m166-18c39-47 67-62 110-64m-109 283c-80-52-105-71-164-66" stroke="#0b242b" stroke-width="23" stroke-linecap="round" fill="none"/><g fill="#0e2d32"><ellipse cx="1411" cy="402" rx="153" ry="72"/><ellipse cx="1535" cy="342" rx="161" ry="104"/><ellipse cx="1313" cy="477" rx="118" ry="56"/><ellipse cx="1586" cy="487" rx="139" ry="69"/></g><path fill="#071a23" d="M0 929c180-43 260 34 452-9s303 44 489 6 277 30 452-5 166 3 207 7v72H0z"/></svg>`}
'''


TITLE_CSS = r'''
/* The camp is a quiet title illustration; it never intercepts play input. */
.camp-title{--camp-cream:#f0dfb9;--camp-gold:#d9ba7e;position:fixed;inset:0;isolation:isolate;display:flex;align-items:safe center;min-height:100svh;height:100svh;padding:58px clamp(28px,7vw,112px);overflow-x:hidden;overflow-y:auto;background:#0c1c30;color:#eef1ee}
.camp-title-art,.camp-title-shade{position:absolute;inset:0;z-index:-1;pointer-events:none}
.camp-title-art{overflow:hidden}
.camp-landscape{display:block;width:100%;height:100%;min-height:100%;position:absolute;inset:0}
.camp-title-shade{z-index:0;background:linear-gradient(90deg,#08182df5 0%,#091a2ce6 29%,#0b1f3077 49%,transparent 72%),linear-gradient(0deg,#06172166,transparent 35%)}
.camp-title-content{position:relative;z-index:2;width:min(100%,435px);margin:0;transform:none}
.camp-title-mark{display:flex;align-items:center;gap:13px;margin:0 0 30px;color:#dac48f;font:10px/1.6 monospace;letter-spacing:2px}
.camp-title-mark>svg{width:27px;height:32px;flex:none}
.camp-title .camp-title-content h1{display:block;margin:0;color:var(--camp-cream);font:normal clamp(45px,5.6vw,76px)/1.04 Georgia,'Times New Roman',serif;letter-spacing:-2px;text-shadow:0 3px 15px #07152355}
.camp-title .camp-title-content h1>span{display:block;margin:0 0 14px;color:#c6d2dc;font:normal 21px/1.2 Georgia,'Times New Roman',serif;letter-spacing:5px;text-transform:uppercase}
.camp-title-lead{margin:23px 0 30px;color:#c5d2d6;font:italic 18px/1.7 Georgia,'Times New Roman',serif;letter-spacing:0}
.camp-title-actions{display:grid;gap:12px;max-width:380px}
.camp-title-actions>button{display:flex;justify-content:space-between;align-items:center;gap:18px;width:100%;min-height:52px;border-radius:4px;padding:13px 17px;font:13px/1.5 monospace;text-align:left}
.camp-title-actions>button b{font-size:19px;font-weight:normal;flex:none}
.camp-title-actions>.primary{border:1px solid #e2c78d;background:linear-gradient(120deg,#e6c991,#c4a76f);color:#102138;box-shadow:inset 0 1px #fff3ce88,0 5px 19px #06152444}
.camp-title-actions>.primary:hover{background:linear-gradient(120deg,#f0d8a7,#d4b67d);border-color:#fff0ca;color:#102138}
.camp-title-actions>.title-secondary{color:#e1e8e8;border:1px solid #839895;background:#102c3d80;box-shadow:none}
.camp-title-actions>.title-secondary:hover{background:#1f4051c9;border-color:#d4decd}
.camp-title-actions>.camp-how{justify-content:flex-start;gap:10px;width:max-content;min-height:40px;padding:4px 1px;border:0;box-shadow:none;background:transparent;color:#b9cdcf;font-size:11px}
.camp-title-actions>.camp-how:hover{color:#fff0ce;background:transparent;box-shadow:none}
.camp-title-actions>button:focus-visible{outline:2px solid #fff0c5;outline-offset:4px}
.camp-how-guide{min-width:0;color:#bed0d0}
.camp-how-guide>summary{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:41px;padding:4px 1px;cursor:pointer;list-style:none;font:11px/1.6 monospace;color:#bdced0}
.camp-how-guide>summary::-webkit-details-marker{display:none}
.camp-how-guide>summary:hover{color:#fff0ce}
.camp-how-guide>summary:focus-visible{outline:2px solid #fff0c5;outline-offset:4px}
.camp-how-guide[open]>summary{color:#efddba}
.camp-how-guide[open]>summary>span{transform:rotate(180deg)}
.camp-how-guide>div{padding:9px 12px 11px;border-left:1px solid #b6c8bc66;background:#102c3d66}
.camp-how-guide p{margin:0 0 10px;color:#c0d0d2;font:10px/1.8 monospace}
.camp-how-guide p:last-child{margin-bottom:0}
.camp-how-guide p>strong{display:block;color:#e6d6b6;font-weight:normal;font-size:10px;letter-spacing:.5px}

.camp-journey-summary{margin:-2px 0 3px;padding:13px 0 14px;border-top:1px solid #bed1ce36;border-bottom:1px solid #bed1ce36;min-width:0}
.camp-journey-heading{display:grid;gap:5px;min-width:0}
.camp-journey-heading>span{color:#b0c5c5;font:8px/1.6 monospace;letter-spacing:1.7px}
.camp-journey-hero{color:#f0e3c5;font:normal 13px/1.7 monospace;overflow-wrap:anywhere}
.camp-journey-hero>small{color:#b6cbd0;font-size:10px;font-weight:normal}
.camp-journey-copy{display:grid;gap:3px;margin-top:9px;min-width:0}
.camp-journey-chapter{color:#d1dfde;font:normal 11px/1.6 monospace;overflow-wrap:anywhere}
.camp-journey-location{color:#a8c1c8;font:10px/1.6 monospace;overflow-wrap:anywhere}
.camp-journey-party{display:flex;gap:15px;align-items:flex-end;margin-top:10px;min-width:0}
.camp-journey-party>span{display:flex;align-items:center;gap:5px;min-width:0;max-width:25%;color:#b6ccd0;font:8px/1.5 monospace}
.camp-journey-party>span>i{display:flex;flex:none;align-items:flex-end;width:24px;height:34px}
.camp-journey-party svg{width:24px;height:34px;image-rendering:pixelated}
.camp-journey-party>span>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.camp-title-footer{display:grid;gap:8px;margin-top:34px;color:#b3c8c7;font:italic 13px/1.5 Georgia,'Times New Roman',serif}
.camp-title-footer>small{color:#829fa9;font:8px/1.5 monospace;letter-spacing:1.8px}
.camp-travelers{position:absolute;inset:0;pointer-events:none}
.camp-traveler{position:absolute;display:block;width:clamp(35px,4.7vw,76px);filter:drop-shadow(0 5px 2px #06141dc9);transform:translate(-50%,-100%)}
.camp-traveler svg{display:block;width:100%;height:auto;image-rendering:pixelated}
.camp-traveler-1{left:66%;top:79%;transform:translate(-50%,-100%) rotate(-3deg)}
.camp-traveler-2{left:70%;top:71%;width:clamp(31px,4vw,64px)}
.camp-traveler-3{left:81%;top:75%;width:clamp(32px,4.2vw,67px)}
.camp-traveler-4{left:85%;top:83%;transform:translate(-50%,-100%) rotate(3deg)}
.camp-art-caption{position:absolute;right:16%;bottom:10%;display:flex;align-items:center;gap:11px;color:#91aaa7;font:8px/1.6 monospace;letter-spacing:2px;opacity:.65}
.camp-art-caption>span{width:27px;height:1px;background:#809c9877}
@media(max-width:1050px) and (min-width:761px){.camp-title{padding:40px}.camp-title-content{width:390px}.camp-title .camp-title-content h1{font-size:59px}.camp-title-shade{background:linear-gradient(90deg,#08182df7,#091a2ce6 38%,#0b1f3077 60%,transparent)}.camp-title-actions{max-width:350px}.camp-traveler-1{left:69%}.camp-traveler-2{left:74%}.camp-traveler-3{left:85%}.camp-traveler-4{left:92%}.camp-art-caption{right:8%}}
@media(max-width:760px){
 .camp-title{display:block;min-height:100svh;padding:225px 24px 30px;overflow-x:hidden;overflow-y:auto}
 .camp-title-art{height:285px;bottom:auto}
 .camp-landscape{width:140%;max-width:none;left:-38%;height:100%}
 .camp-title-shade{background:linear-gradient(0deg,#081a2e 0%,#081a2e 54%,#081a2eeb 68%,#081a2e55 84%,transparent 100%)}
 .camp-title-content{width:100%;max-width:430px;margin:0 auto}
 .camp-title-mark{gap:10px;margin-bottom:16px;font-size:8px;letter-spacing:1.7px}
 .camp-title-mark>svg{width:22px;height:27px}
 .camp-title .camp-title-content h1{font-size:47px;line-height:1.04;letter-spacing:-1.5px}
 .camp-title .camp-title-content h1>span{font-size:17px;letter-spacing:4px;margin-bottom:10px}
 .camp-title-lead{font-size:16px;line-height:1.6;margin:16px 0 23px}
 .camp-title-lead br{display:none}
 .camp-title-actions{max-width:none;gap:11px}
 .camp-title-actions>button{min-height:49px;font-size:12px;padding:12px 14px}
 .camp-title-actions>.camp-how{min-height:39px}
 .camp-title-footer{margin-top:24px;font-size:12px;gap:6px}
 .camp-title-footer>small{font-size:7px}
 .camp-journey-summary{padding:12px 0}
 .camp-journey-party{gap:9px}.camp-journey-party>span{gap:3px;font-size:7px}.camp-journey-party>span>i{width:20px;height:28px}.camp-journey-party svg{width:20px;height:28px}
 .camp-travelers{width:140%;left:-38%;height:100%}
 .camp-traveler{width:35px}.camp-traveler-1{left:66%;top:79%}.camp-traveler-2{left:70%;top:71%;width:29px}.camp-traveler-3{left:81%;top:75%;width:32px}.camp-traveler-4{left:85%;top:83%;width:35px}
 .camp-art-caption{display:none}
}
@media(max-width:359px){.camp-title{padding:205px 19px 25px}.camp-title-art{height:260px}.camp-title .camp-title-content h1{font-size:41px}.camp-title .camp-title-content h1>span{font-size:16px}.camp-title-mark{font-size:7px}.camp-journey-hero{font-size:12px}.camp-journey-hero>small{display:block}.camp-journey-party>span>span{display:none}.camp-journey-party{gap:17px}}
@media(min-width:761px) and (max-height:650px){.camp-title{padding-top:25px;padding-bottom:25px;align-items:flex-start}.camp-title-mark{margin-bottom:18px}.camp-title .camp-title-content h1{font-size:54px}.camp-title .camp-title-content h1>span{font-size:17px;margin-bottom:8px}.camp-title-lead{font-size:16px;margin:17px 0 20px}.camp-title-footer{margin-top:24px}}
@media(prefers-reduced-motion:reduce){.camp-title *{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
'''
