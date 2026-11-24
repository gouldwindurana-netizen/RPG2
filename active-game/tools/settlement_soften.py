"""Organic scenery contours; character pixels and tile rules stay crisp."""


def patch(source):
    changes = []

    def replace(old, new, label):
        nonlocal source
        assert source.count(old) == 1, (label, source.count(old))
        source = source.replace(old, new, 1)
        changes.append(label)

    def between(start, end, value, label):
        nonlocal source
        assert source.count(start) == 1, (label, source.count(start))
        a = source.index(start)
        b = source.index(end, a)
        source = source[:a] + value + source[b:]
        changes.append(label)

    between('Ge(e,`tree`,52,66,e=>{', ',Ge(e,`tent`,80,64,e=>{', TREE_ART,
            'replace stepped rectangular canopies with layered organic foliage and curved bark')
    between('if(isWater){\nJ(ctx,`#183e5830`', '}else if(material===`b`){', WATER_ART,
            'soften shorelines with irregular banks and continuous curved water highlights')
    between('}else if(material===`d`){\nfor(let dot=', '}else{\nfor(let tuft=', DIRT_ART,
            'blend road and grass joins with rounded corners and quiet natural fringes')
    replace('for(let entity of t.entities??[])if(entity.kind===`campfire`||entity.sprite===`lantern`){let cx=ox+(entity.x+.5)*30,cy=oy+(entity.y+.65)*30;for(let ring=3;ring>=1;ring--){let radius=ring*11;J(ctx,ring===3?`#ffd18408`:ring===2?`#ffd1840b`:`#ffe0a40e`,cx-radius,cy-radius/2,radius*2,radius)}}',
            LIGHT_ART,
            'bake soft radial lantern light instead of nested rectangular light blocks')
    replace('<div class="horizon horizon-back"></div><div class="horizon horizon-front"></div>',
            '<svg class="horizon horizon-back" viewBox="0 0 1000 250" preserveAspectRatio="none" aria-hidden="true"><path fill="currentColor" d="M0 125 C105 70 130 170 235 127 S365 54 450 112 S565 143 660 89 S775 102 850 91 S945 121 1000 76 L1000 250 L0 250 Z"/></svg><svg class="horizon horizon-front" viewBox="0 0 1000 220" preserveAspectRatio="none" aria-hidden="true"><path fill="currentColor" d="M0 84 C92 122 135 158 230 115 S355 159 445 143 S557 83 650 113 S791 75 865 112 S957 120 1000 80 L1000 220 L0 220 Z"/></svg>',
            'give the title landscape flowing hill silhouettes instead of angular polygon ridges')
    replace('</head>', '<style id="settlement-soft-contours">\n' + SOFT_CSS + '\n</style>\n</head>',
            'soften window corners and title silhouettes without smoothing pixel characters')
    return source, changes


TREE_ART = r'''Ge(e,`tree`,52,66,e=>{
const oval=(color,x,y,rx,ry)=>{e.fillStyle=color;e.beginPath();e.ellipse(x,y,rx,ry,0,0,Math.PI*2);e.fill()},branch=(color,width,points)=>{e.strokeStyle=color;e.lineWidth=width;e.lineCap=`round`;e.lineJoin=`round`;e.beginPath();e.moveTo(...points[0]);for(let point of points.slice(1))e.lineTo(...point);e.stroke()};
oval(`#0c2b3948`,26,60,22,4);oval(`#29453938`,26,61,16,2);
e.fillStyle=`#4b3e2c`;e.beginPath();e.moveTo(22,42);e.bezierCurveTo(23,47,23,54,20,62);e.quadraticCurveTo(28,60,33,63);e.bezierCurveTo(28,55,29,47,30,42);e.closePath();e.fill();
branch(`#876b42`,3,[[26,43],[26,55],[24,60]]);branch(`#b09157`,1,[[27,46],[27,55]]);branch(`#5c5034`,4,[[25,48],[17,40],[12,35]]);branch(`#5c5034`,3,[[28,48],[36,40],[40,35]]);
oval(`#183e34`,24,39,20,14);oval(`#1e4839`,13,33,12,13);oval(`#1c4336`,38,35,12,13);oval(`#2c5a3e`,25,25,21,20);oval(`#2d603f`,15,26,14,14);oval(`#356c45`,31,20,15,16);oval(`#3d7549`,24,13,12,11);
oval(`#4b8450`,21,12,9,5);oval(`#417c4b`,13,24,9,7);oval(`#4c8850`,31,19,9,7);oval(`#387345`,38,30,9,8);oval(`#245239`,22,37,14,10);oval(`#2c5d3e`,34,39,11,8);oval(`#1b4435`,11,41,8,6);
oval(`#62965a`,20,9,5,2);oval(`#78a365`,25,11,3,2);oval(`#64965a`,9,24,4,2);oval(`#5e9152`,31,17,4,2);oval(`#80a96a`,34,22,2,1);oval(`#447e49`,38,31,4,2);oval(`#477d49`,21,28,6,3);oval(`#356b42`,14,34,4,2)
})'''


WATER_ART = r'''if(isWater){
ctx.save();ctx.lineCap=`round`;ctx.lineJoin=`round`;
for(let row=0;row<3;row++){let rx=px+1+random()*8,ry=py+5+row*9;ctx.strokeStyle=row%2?`#c2e1d34a`:`#153f5340`;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(rx,ry);ctx.bezierCurveTo(rx+5,ry-1,rx+11,ry+1,rx+18+random()*8,ry);ctx.stroke();if((x+y+row)%5===0){ctx.strokeStyle=`#d7e9d34d`;ctx.beginPath();ctx.moveTo(rx+4,ry-2);ctx.quadraticCurveTo(rx+8,ry-3,rx+12,ry-2);ctx.stroke()}}
let banks=[tile(x,y-1),tile(x+1,y),tile(x,y+1),tile(x-1,y)].map(value=>value!==`w`&&value!==`b`);
for(let edge=0;edge<4;edge++)if(banks[edge]){ctx.save();ctx.translate(px+15,py+15);ctx.rotate(edge*Math.PI/2);ctx.translate(-15,-15);ctx.fillStyle=grass;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(30,0);ctx.lineTo(30,3);ctx.bezierCurveTo(23,7,20,2,15,4);ctx.bezierCurveTo(9,6,5,2,0,4);ctx.closePath();ctx.fill();ctx.strokeStyle=`#183f4d75`;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,5);ctx.bezierCurveTo(6,3,9,7,15,5);ctx.bezierCurveTo(21,3,24,8,30,4);ctx.stroke();ctx.strokeStyle=`#aec3a33b`;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,3);ctx.bezierCurveTo(8,2,10,5,17,3);ctx.quadraticCurveTo(25,5,30,2);ctx.stroke();ctx.restore()}
for(let corner=0;corner<4;corner++)if(banks[corner]&&banks[(corner+3)%4]){ctx.save();ctx.translate(px+15,py+15);ctx.rotate(corner*Math.PI/2);ctx.translate(-15,-15);ctx.fillStyle=grass;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(11,0);ctx.quadraticCurveTo(4,3,0,11);ctx.closePath();ctx.fill();ctx.restore()}
ctx.restore();
'''


DIRT_ART = r'''}else if(material===`d`){
for(let dot=0;dot<5;dot++){let dx=px+2+random()*26,dy=py+2+random()*26;ctx.fillStyle=dot%2?`#dac59a40`:`#84755128`;ctx.beginPath();ctx.ellipse(dx,dy,1.4+random(),.6,0,0,Math.PI*2);ctx.fill()}
let borders=[tile(x,y-1),tile(x+1,y),tile(x,y+1),tile(x-1,y)].map(value=>![`d`,`b`,`s`,`f`].includes(value));
for(let edge=0;edge<4;edge++)if(borders[edge]){ctx.save();ctx.translate(px+15,py+15);ctx.rotate(edge*Math.PI/2);ctx.translate(-15,-15);ctx.fillStyle=grass;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(30,0);ctx.lineTo(30,2);ctx.bezierCurveTo(23,5,19,1,15,3);ctx.bezierCurveTo(9,5,6,1,0,3);ctx.closePath();ctx.fill();ctx.strokeStyle=`#7d80523b`;ctx.lineWidth=2;ctx.lineCap=`round`;ctx.beginPath();ctx.moveTo(1,4);ctx.bezierCurveTo(9,1,11,6,19,3);ctx.quadraticCurveTo(25,5,29,3);ctx.stroke();for(let tuft=0;tuft<3;tuft++){let tx=3+tuft*10;ctx.strokeStyle=leaf+`77`;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(tx,3);ctx.lineTo(tx+1,1);ctx.moveTo(tx+2,4);ctx.lineTo(tx+3,2);ctx.stroke()}ctx.restore()}
for(let corner=0;corner<4;corner++)if(borders[corner]&&borders[(corner+3)%4]){ctx.save();ctx.translate(px+15,py+15);ctx.rotate(corner*Math.PI/2);ctx.translate(-15,-15);ctx.fillStyle=grass;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(10,0);ctx.quadraticCurveTo(4,3,0,10);ctx.closePath();ctx.fill();ctx.restore()}
if((x+y)%7===0){ctx.fillStyle=`#d8c9a15c`;ctx.beginPath();ctx.ellipse(px+12,py+17,2.5,1,0,0,Math.PI*2);ctx.fill()}
'''


LIGHT_ART = r'''for(let entity of t.entities??[])if(entity.kind===`campfire`||entity.sprite===`lantern`){let cx=ox+(entity.x+.5)*30,cy=oy+(entity.y+.65)*30;ctx.save();ctx.translate(cx,cy);ctx.scale(1,.6);let glow=ctx.createRadialGradient(0,0,1,0,0,39);glow.addColorStop(0,`#ffe4aa20`);glow.addColorStop(.35,`#ffd38e12`);glow.addColorStop(.7,`#ffd38e07`);glow.addColorStop(1,`#ffd38e00`);ctx.fillStyle=glow;ctx.fillRect(-39,-39,78,78);ctx.restore()}'''


SOFT_CSS = r'''
/* Organic edges belong to scenery and window dressing; pixel people stay sharp. */
.stage-wrap,.action-panel,.party-sidebar,.modal,.creation-main{border-radius:8px}
.canvas-shell{border-radius:3px}
.horizon{clip-path:none!important;background:none!important;width:100%;max-width:none;overflow:visible}
.horizon-back{color:#142d42}
.horizon-front{color:#0b1d32}
.distant-tower{filter:drop-shadow(0 0 18px #b8c9d50c)}
.regional-rare-collection,.inventory-target,.store-modal .inventory-row{border-radius:5px}
@media(prefers-reduced-motion:reduce){.distant-tower{filter:none}}
'''
