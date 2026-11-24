"""Original battle scenery and readable actor dressing; no simulation changes."""


def patch(source):
    labels = []
    old = 'interior=!!info||[`works`,`tollhouse`,`granary`,`heart`].includes(root);'
    new = 'interior=state.area.includes(`-depth-`)||[`works`,`tollhouse`,`granary`,`heart`].includes(root);'
    assert source.count(old) == 1
    source = source.replace(old, new)
    labels.append('base orchard and crown routes use outdoor scenery while deeper floors retain dungeon architecture')
    start = source.index('battleTexture(info){')
    end = source.index('refreshBattle(e){', start)
    source = source[:start] + BATTLE_TEXTURE + source[end:]
    labels.append('replace flat battle floors with original region-specific pixel masonry and layered landscapes')
    old = 'cap=enemy.rank===`boss`&&t.enemies.length===1?1.35:enemy.size===`large`?2.15:1.7'
    new = 'cap=enemy.rank===`boss`&&t.enemies.length===1?1.35:t.enemies.length===1&&enemy.size!==`large`?2.25:enemy.size===`large`?2.15:1.7'
    assert source.count(old) == 1
    source = source.replace(old, new)
    labels.append('give lone ordinary foes more presence within their existing actor cell')
    start = source.index('actor(e,t,n,r,i,a,o,s,cell){')
    end = source.index('clickWorld(e){', start)
    source = source[:start] + ACTOR + source[end:]
    labels.append('ground battle actors with shadows and give enemy names and HP clear framed readouts')
    return source, labels


BATTLE_TEXTURE = r'''battleTexture(info){let key=info.texture;Ge(this,key,960,576,ctx=>{
let interior=info.environment===`interior`,deep=interior&&info.floor>Math.ceil(info.total/2),seed=Ke([...key].reduce((v,c)=>Math.imul(v,31)+c.charCodeAt(0),517)),groundY=info.groundY??124;
const rect=(c,x,y,w,h)=>J(ctx,c,Math.round(x),Math.round(y),Math.max(1,Math.round(w)),Math.max(1,Math.round(h))),line=(c,x,y,xx,yy,w=1)=>{ctx.strokeStyle=c;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(Math.round(x),Math.round(y));ctx.lineTo(Math.round(xx),Math.round(yy));ctx.stroke()},poly=(c,points)=>{ctx.fillStyle=c;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(Math.round(x),Math.round(y)):ctx.moveTo(Math.round(x),Math.round(y)));ctx.closePath();ctx.fill()},oval=(c,x,y,w,h)=>poly(c,Array.from({length:12},(_,i)=>[x+Math.cos(i*Math.PI/6)*w/2,y+Math.sin(i*Math.PI/6)*h/2]));
if(interior){
let palettes={works:[`#172c36`,`#304e53`,`#57706a`,`#405357`,`#1d363e`,`#d7b979`],tollhouse:[`#1a2938`,`#354d5a`,`#697971`,`#465960`,`#243943`,`#dfbe77`],granary:[`#16313a`,`#355351`,`#6a8270`,`#3d5552`,`#203f45`,`#cbbb88`],orchard:[`#292b3a`,`#4a4c55`,`#777d6d`,`#4e5855`,`#303e43`,`#d1b58a`],crown:[`#1a2d40`,`#3b586a`,`#8b9e9a`,`#526873`,`#2b4353`,`#cad8bd`],heart:[`#17223b`,`#344461`,`#718ba0`,`#425870`,`#253c55`,`#c8dce5`]},p=palettes[info.root]||palettes.works;
rect(p[0],0,0,960,576);
// Recessed stonework: narrow highlights keep the architecture crisp at small sizes.
for(let y=0;y<groundY;y+=22)for(let x=-52;x<1010;x+=104){let xx=x+(y%44?52:0);rect(p[1],xx,y,101,20);rect(p[2]+`55`,xx+3,y+2,95,2);rect(p[0]+`99`,xx,y+18,101,2);if(seed()>.64)rect(p[0]+`55`,xx+18+seed()*60,y+7,20,2)}
for(let x of[74,381,688]){let width=170;poly(p[0],[[x,119],[x,41],[x+17,21],[x+width/2,6],[x+width-17,21],[x+width,41],[x+width,119]]);poly(p[2],[[x-5,115],[x-5,39],[x+14,15],[x+85,0],[x+156,15],[x+175,39],[x+175,115],[x+163,115],[x+163,43],[x+149,26],[x+85,12],[x+21,26],[x+7,43],[x+7,115]]);rect(p[0],x+9,46,151,75);
if(info.root===`crown`||info.root===`heart`){poly(info.root===`heart`?`#416c91`:`#6b9199`,[[x+15,114],[x+15,46],[x+26,31],[x+85,18],[x+144,31],[x+155,46],[x+155,114]]);for(let xx=x+40;xx<x+150;xx+=30)rect(p[0],xx,30,4,85);rect(p[0],x+13,65,144,5);poly(`#d6e2d51a`,[[x+20,95],[x+140,95],[x+250,300],[x+20,360]]);}
else if(info.root===`tollhouse`){for(let xx=x+16;xx<x+162;xx+=22){rect(`#8c9988`,xx,41,4,74);rect(`#263a43`,xx+4,41,3,74)}rect(p[5],x+67,66,38,5);rect(p[5],x+82,70,7,26);rect(p[0],x+95,69,8,9)}
else if(info.root===`granary`){rect(`#5a5140`,x+14,68,140,46);for(let xx=x+19;xx<x+150;xx+=34)rect(`#2c3a36`,xx,70,3,44);rect(`#9e9264`,x+14,71,139,3);rect(`#a29366`,x+14,99,139,3);line(`#97815a`,x+18,71,x+150,110,5)}
else if(info.root===`orchard`){for(let xx=x+18;xx<x+155;xx+=28){rect(`#3a493d`,xx,36,3,80);rect(`#758663`,xx-4,51+(xx%27),11,6);rect(`#516e4f`,xx,76+(xx%23),13,7)}}
else{for(let y=49;y<115;y+=13)rect(`#456766`,x+16,y,137,2);for(let y=0;y<76;y+=10){rect(`#b7a579`,x+82,y,4,7);rect(`#52615d`,x+79,y+5,10,3)}}}
for(let x of[18,315,622,928]){rect(p[0],x-13,0,34,126);rect(p[2],x-6,0,15,115);rect(p[5]+`77`,x-4,0,3,113);rect(p[1],x+8,0,5,114);rect(p[0],x-15,114,39,12);rect(p[2],x-15,114,36,4)}
// The floor is broken flagstone rather than a high-contrast perspective grid.
rect(p[3],0,groundY,960,576-groundY);rect(p[0],0,groundY,960,8);rect(p[2]+`88`,0,groundY+8,960,3);
for(let y=144;y<576;y+=44){let row=(y-144)/44;for(let x=-100;x<1020;x+=128){let xx=x+(row%2?64:0);rect(p[4]+`55`,xx,y,126,41);rect(p[2]+`30`,xx+3,y+2,119,2);rect(p[0]+`66`,xx+1,y+39,125,2);if(seed()>.55){let x2=xx+20+seed()*80;line(p[0]+`45`,x2,y+11,x2+9,y+17);line(p[0]+`45`,x2+9,y+17,x2+7,y+26)}}}
for(let i=0;i<290;i++){let x=Math.floor(seed()*240)*4,y=140+Math.floor(seed()*108)*4;rect(i%3?p[2]+`22`:p[0]+`33`,x,y,2+Math.floor(seed()*3)*2,2)}
if(info.root===`works`){let x=465;rect(`#c5b078`,x-2,11,5,23);for(let row=0;row<6;row++){rect(row%2?`#9c865e`:`#bba16b`,x-13-row*4,34+row*9,28+row*8,9);rect(`#d2bd86`,x-9-row*4,35+row*9,3,7)}rect(`#dfcb91`,x-39,88,81,5);rect(`#786e55`,x-31,93,66,4);rect(`#d1b77e`,x-3,94,7,9)}
if(info.root===`granary`){for(let i=0;i<37;i++){let x=seed()*950,y=160+seed()*390;oval(`#1c424b77`,x,y,40+seed()*65,6+seed()*6);rect(`#b1c8b455`,x-10,y-1,20+seed()*25,1)}}
if(info.root===`orchard`)for(let i=0;i<70;i++){let x=seed()*960,y=132+seed()*440;rect(i%3?`#b8a77466`:`#926d7477`,x,y,3,2)}
for(let x of[30,912]){let glow=ctx.createLinearGradient(0,68,0,350);glow.addColorStop(0,(info.root===`heart`?`#89b4df`:`#e6bd6a`)+`22`);glow.addColorStop(1,`#d4b56b00`);ctx.fillStyle=glow;ctx.fillRect(x-100,50,200,310);rect(p[0],x-4,58,18,21);rect(p[5],x,61,10,14);rect(`#f5dfae`,x+3,64,4,8);rect(p[1],x-7,80,25,4)}
if(deep){rect(`#07162a24`,0,0,960,576);for(let i=0;i<50;i++)rect(p[0]+`55`,seed()*960,134+seed()*438,2+seed()*9,2)}
}else{
let palettes={grassland:[`#668fa0`,`#bdcbb6`,`#527761`,`#496b50`,`#293f3d`],forest:[`#3e6877`,`#90afa0`,`#355c4d`,`#375745`,`#1e3838`],marsh:[`#496f82`,`#a0bcb2`,`#466d68`,`#42685d`,`#21434a`],highland:[`#6a91ad`,`#c9d9cf`,`#6b8980`,`#6a7e69`,`#344f53`],shore:[`#6597ad`,`#d1dfce`,`#57858c`,`#a19d78`,`#556e62`],"orchard-field":[`#8895ac`,`#e3d5b7`,`#818d66`,`#767f58`,`#485847`],"pale-field":[`#647da5`,`#b9cedb`,`#748a94`,`#738b90`,`#405c70`]},p=palettes[info.terrain]||palettes.grassland;
rect(p[0],0,0,960,576);for(let i=0;i<8;i++){let x=i*140-35,y=18+(i%3)*13;rect(p[1]+`33`,x,y,94,6);rect(p[1]+`22`,x+18,y-6,55,6)}
for(let x=-100;x<1080;x+=150){poly(p[1]+`77`,[[x,111],[x+89,42+(x%43)],[x+220,115]]);poly(p[2],[[x+23,116],[x+103,75+(x%31)],[x+206,121]])}
if(info.terrain===`forest`||info.terrain===`orchard-field`){for(let x=-24;x<1000;x+=77){let tall=info.terrain===`forest`;rect(`#304640`,x+29,62,11,61);for(let row=0;row<4;row++)rect(row%2?p[2]:p[4],x+(row%2)*6,31+row*19,74-row*5,25);rect(p[1]+`55`,x+13,39,28,3);if(!tall)for(let i=0;i<4;i++)rect(`#d8b9a6`,x+10+i*13,54+(i%2)*22,4,3)}}
if(info.terrain===`highland`||info.terrain===`pale-field`)for(let x=-30;x<1000;x+=165)poly(p[1],[[x+24,69],[x+89,42+(x%43)],[x+131,80],[x+90,65]]);
rect(p[2],0,105,960,30);if(info.terrain===`shore`||info.terrain===`marsh`){rect(info.terrain===`shore`?`#447e99`:`#335c67`,0,112,960,16);for(let i=0;i<45;i++)rect(p[1]+`77`,seed()*960,115+seed()*9,12+seed()*36,1)}
rect(p[3],0,groundY,960,576-groundY);rect(p[4]+`44`,0,groundY,960,5);
for(let i=0;i<540;i++){let x=Math.floor(seed()*480)*2,y=132+Math.floor(seed()*221)*2,w=2+Math.floor(seed()*4)*2;rect(i%3?p[4]+`45`:p[1]+`28`,x,y,w,2);if(i%4===0&&info.terrain!==`shore`){rect(p[2],x+2,y-4,2,6);rect(p[1]+`44`,x+4,y-2,2,3)}if(i%17===0)rect(info.terrain===`orchard-field`?`#d9bd9777`:p[1]+`55`,x,y,3,3)}
if(info.terrain===`marsh`)for(let i=0;i<35;i++){let x=seed()*960,y=145+seed()*410;oval(`#29535e77`,x,y,28+seed()*60,6+seed()*6);rect(`#a5c4b766`,x-9,y,16,1)}
for(let x of[6,926])for(let y=146;y<570;y+=69){rect(p[4]+`66`,x+(y%11),y,19,7);rect(p[2],x+5,y-6,14,10);rect(p[1]+`44`,x+7,y-6,8,2)}
}
let vignette=ctx.createLinearGradient(0,370,0,576);vignette.addColorStop(0,`#07162900`);vignette.addColorStop(1,`#07132466`);ctx.fillStyle=vignette;ctx.fillRect(0,370,960,206);
});return key}'''

ACTOR = r'''actor(e,t,n,r,i,a,o,s,cell){let c=this.actors.get(e);c||(c={image:this.add.image(r,i,n).setOrigin(.5,1).setScale(a).setDepth(60+i/10),label:this.add.text(r,i+12,``,{fontFamily:`monospace`,fontSize:`14px`,color:o,align:`center`,stroke:`#071a2a`,strokeThickness:3}).setOrigin(.5,0).setDepth(180),bar:this.add.graphics().setDepth(175),baseX:r,baseY:i},this.actors.set(e,c));let alive=t.hp>0,hero=!!t.maxMp;c.image.texture.key!==n&&c.image.setTexture(n),c.baseX=r,c.baseY=i,c.cell=cell,c.image.setPosition(r,i).setScale(a).setDepth(60+i/10).setAlpha(alive?1:.24).setFlipX(s);let name=t.displayName||t.name,rank=!s&&t.rank!==`base`?` ${t.rank===`rare`?`◇`:t.rank===`boss`?`◆`:`▲`}`:``,font=cell?cell.w<180?13:14:14,width=cell?cell.w-18:130;c.label.setPosition(r,i+(cell?5:12)).setStyle({fontSize:`${font}px`,wordWrap:{width,useAdvancedWrap:!0}}).setText(hl(t,`${name}${rank}\n${t.hp} / ${t.maxHp}${t.status?` · ${t.status}`:``}${t.maxMp?`\n${t.mp} / ${t.maxMp} MP`:``}`)).setAlpha(alive?1:.5);while(cell&&c.label.height>cell.y+cell.h-c.label.y-17&&font>8)c.label.setFontSize(--font);let barWidth=cell?Math.min(cell.w-20,124):96,barY=cell?c.label.y+c.label.height+5:i+49;let shadow={x:r-Math.min(cell?.w??120,c.image.displayWidth*.78+8)/2,y:i+2,w:Math.min(cell?.w??120,c.image.displayWidth*.78+8),h:6},readout=null;c.bar.clear();c.bar.fillStyle(0x06131d,alive?.36:.15).fillEllipse(r,i+5,shadow.w,6);if(!hero){let plateWidth=Math.min(cell?cell.w-10:150,Math.max(barWidth+10,c.label.width+16)),plateHeight=c.label.height+17;readout={x:r-plateWidth/2,y:c.label.y-3,w:plateWidth,h:plateHeight};c.bar.fillStyle(0x0a2033,alive?.88:.3).fillRoundedRect(r-plateWidth/2,c.label.y-3,plateWidth,plateHeight,3);c.bar.lineStyle(1,t.rank===`rare`?0xc5dbe9:t.rank===`boss`?0xd4b376:0x607d88,alive?.7:.2).strokeRoundedRect(r-plateWidth/2,c.label.y-3,plateWidth,plateHeight,3);c.bar.fillStyle(0x07131e,.98).fillRect(r-barWidth/2,barY,barWidth,6);c.bar.fillStyle(0xabc68c,alive?1:.2).fillRect(r-barWidth/2+1,barY+1,Math.max(0,(barWidth-2)*t.hp/t.maxHp),4);c.bar.fillStyle(0xe6e4af,.55).fillRect(r-barWidth/2+1,barY+1,Math.max(0,(barWidth-2)*t.hp/t.maxHp),1)}c.bounds={cell:cell?{...cell}:null,readout,shadow,sprite:{x:r-c.image.displayWidth/2,y:i-c.image.displayHeight,w:c.image.displayWidth,h:c.image.displayHeight},label:{x:r-c.label.width/2,y:c.label.y,w:c.label.width,h:c.label.height},bar:{x:r-barWidth/2,y:barY,w:barWidth,h:6}}}'''
