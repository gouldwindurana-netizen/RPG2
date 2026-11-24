"""Original exploration art polish; map geometry and gameplay stay unchanged."""


def patch(source):
    changes = []

    def between(start, end, replacement, label):
        nonlocal source
        a = source.index(start)
        b = source.index(end, a)
        source = source[:a] + replacement + source[b:]
        changes.append(label)

    between('Ge(e,`tree`,52,66,e=>{', ',Ge(e,`tent`,80,64,e=>{', TREE_ART,
            'layer original tree canopies with clean foliage clusters and bark highlights')
    between('Ge(e,`tent`,80,64,e=>{', ',Ge(e,`reeds`,32,32,e=>{', TENT_ART,
            'give shelter tents a defined ridge canvas seams and grounded shadows')
    between('for(let t of[`town`,`castle`,`cave`,`dock`,`house`,`inn`,`shop`,`basilica`])Ge(',
            'for(let[t,n]of[[`tree-fen`', SITE_ART,
            'redraw settlement architecture with gabled roofs warm windows masonry and trim')
    between('var Ze={', 'function $e(', WORLD_ART,
            'paint region-specific ground water roads stonework and baked light pools without changing map data')
    old = 'for(let t of n.entities){let n=this.toScreen(t),r=this.sprites.get(t.id);'
    new = 'let nearCitizen=null,nearCitizenDistance=4;for(let candidate of n.entities)if(visualWorldCitizen(candidate)){if(candidate.id===this.pathTarget){nearCitizen=candidate;break}let distance=nt(candidate,e.player);if(distance<nearCitizenDistance){nearCitizen=candidate;nearCitizenDistance=distance}}for(let t of n.entities){let n=this.toScreen(t),r=this.sprites.get(t.id);'
    assert source.count(old) == 1
    source = source.replace(old, new)
    changes.append('choose one nearby or selected citizen name while retaining all citizen names in the prologue')
    old = '.setVisible(!c||nt(t,e.player)<=4||this.pathTarget===t.id),t.kind===`campfire`'
    new = '.setVisible((!c||nt(t,e.player)<=4||this.pathTarget===t.id)&&(!visualWorldCitizen(t)||e.mode===`intro`||t===nearCitizen)),t.kind===`campfire`'
    assert source.count(old) == 1
    source = source.replace(old, new)
    changes.append('keep signs services exits and discoveries labeled while preventing adjacent citizen-name overlap')
    return source, changes


TREE_ART = r'''Ge(e,`tree`,52,66,e=>{
J(e,`#0d263754`,7,57,40,7);J(e,`#253c3544`,3,59,44,3);
J(e,`#3c3429`,23,37,10,25);J(e,`#846541`,26,39,4,23);J(e,`#b28b52`,27,42,1,15);J(e,`#4e4731`,21,59,15,4);
J(e,`#183b35`,9,26,34,27);J(e,`#214a3b`,3,25,45,19);J(e,`#2b5940`,7,16,37,28);J(e,`#326345`,14,8,28,30);J(e,`#3b704a`,19,3,17,21);
J(e,`#437f4e`,13,12,16,11);J(e,`#4d8952`,19,8,12,6);J(e,`#4d8952`,9,23,11,8);J(e,`#397648`,28,21,13,13);J(e,`#4d8550`,32,24,7,4);
J(e,`#28563d`,18,31,18,15);J(e,`#1a4035`,6,40,30,9);J(e,`#24523a`,29,38,15,9);J(e,`#5b9257`,18,11,6,2);J(e,`#729e5b`,23,7,5,2);J(e,`#5a9254`,10,24,5,2);J(e,`#88a765`,24,18,2,2);J(e,`#315b3e`,38,34,3,6)
})'''

TENT_ART = r'''Ge(e,`tent`,80,64,e=>{
J(e,`#132e3b66`,3,53,74,7);J(e,`#29423a44`,9,58,62,4);
for(let row=0;row<22;row++){let x=Math.floor(39-row*1.65),w=Math.ceil(3+row*3.3);J(e,row<10?`#dcc28c`:`#b79b69`,x,8+row*2,w,2);J(e,`#f0daa6`,x,8+row*2,2,2);J(e,`#94764e`,x+w-3,8+row*2,3,2)}
J(e,`#6f674a`,13,50,56,5);J(e,`#cfb67d`,16,48,51,2);J(e,`#263d3b`,35,33,15,21);J(e,`#142d31`,39,38,8,16);J(e,`#e1cc91`,34,32,3,22);J(e,`#8e714b`,49,35,2,19);J(e,`#8f6f48`,39,7,3,49);J(e,`#ffdfa0`,38,8,4,2);
J(e,`#f0d49a`,24,31,2,14);J(e,`#d5b67e`,21,40,14,1);J(e,`#a6885a`,56,35,1,15);J(e,`#6c6046`,7,52,2,8);J(e,`#6c6046`,71,52,2,8);J(e,`#d5bf87`,4,58,8,2);J(e,`#d5bf87`,68,58,8,2)
})'''

SITE_ART = r'''for(let t of[`town`,`castle`,`cave`,`dock`,`house`,`inn`,`shop`,`basilica`])Ge(e,`site-${t}`,t===`basilica`?128:88,t===`basilica`?144:92,e=>{
if(t===`cave`){J(e,`#13293866`,5,84,78,6);for(let row=0;row<7;row++){let x=29-row*4,w=28+row*8;J(e,row%2?`#8e9b91`:`#71857f`,x,13+row*10,w,10);J(e,`#b1b9a4`,x+3,13+row*10,w-6,2)}J(e,`#2c4651`,25,47,37,36);J(e,`#122b39`,30,44,28,40);J(e,`#071f2b`,36,51,18,33);J(e,`#b9b596`,17,83,53,4);J(e,`#526d6a`,9,75,13,8);J(e,`#9ea996`,67,64,10,18);return}
if(t===`dock`){J(e,`#16354866`,6,79,77,8);for(let row=0;row<6;row++){J(e,row%2?`#bca071`:`#cdb386`,13,26+row*9,63,7);J(e,`#e1c792`,15,26+row*9,59,1);for(let x of[20,42,63])J(e,`#7f704f`,x+(row%2?4:0),27+row*9,1,5)}for(let x of[9,76]){J(e,`#4c4940`,x,22,5,65);J(e,`#dacfaa`,x-2,20,9,5);J(e,`#aa976a`,x,27,2,52)}J(e,`#c1ae77`,37,6,3,44);J(e,`#e3ddba`,40,7,28,23);J(e,`#b9b990`,42,27,24,3);J(e,`#f2e9c7`,42,9,2,16);return}
let basilica=t===`basilica`,castle=t===`castle`,sx=basilica?128/88:1,sy=basilica?144/92:1;
let rect=(color,x,y,w,h)=>J(e,color,Math.round(x*sx),Math.round(y*sy),Math.round(w*sx),Math.round(h*sy));
let wall=basilica?`#d2d2b7`:castle?`#aebdae`:`#d2c6a2`,roof=t===`shop`?`#477e84`:t===`inn`?`#9b6564`:`#4f7088`,roofLight=t===`shop`?`#6d9d9c`:t===`inn`?`#c08b7f`:`#7b98a9`;
rect(`#112b3c55`,3,83,82,7);rect(`#3b5360`,11,40,66,45);rect(wall,15,41,58,40);rect(`#eee0b7`,16,42,55,3);rect(`#b2a584`,15,76,58,6);
for(let row=0;row<7;row++){let x=37-row*5,w=14+row*10;rect(row%2?roofLight:roof,x,11+row*4,w,5);rect(`#213d50`,x-1,15+row*4,w+2,1);for(let col=0;col<Math.floor(w/10);col++)rect(row%2?roof:roofLight,x+5+col*10,12+row*4,1,3)}
rect(roofLight,37,10,14,2);rect(`#c7c0a0`,8,40,73,3);rect(`#465767`,8,43,73,3);
for(let x of[22,55]){rect(`#476576`,x,52,12,15);rect(`#d5a96c`,x+2,54,8,11);rect(`#ffe6a4`,x+3,55,5,7);rect(`#806d51`,x+5,54,1,11);rect(`#b49c6c`,x-1,67,14,2)}
rect(`#405366`,35,62,21,23);rect(`#826b4e`,38,64,15,20);rect(`#b9a475`,39,65,2,17);rect(`#473e32`,49,65,1,19);rect(`#efce86`,48,74,2,2);rect(`#e0d1aa`,32,85,27,2);rect(`#789083`,31,87,30,2);
if(!basilica&&!castle){for(let x of[16,70])rect(`#7a7057`,x,47,2,34);rect(`#a68c62`,16,72,56,2)}
if(basilica||castle){for(let x of[4,63]){rect(`#536e7c`,x,13,22,72);rect(wall,x+3,14,16,69);rect(`#e4e0c0`,x+3,14,2,68);rect(`#3d5b6d`,x+7,29,8,18);rect(`#f6d994`,x+9,31,4,12);rect(`#97aaa7`,x-1,11,24,6);rect(`#c5c9ac`,x-2,10,26,2);rect(`#e2c58a`,x+9,3,3,9);for(let row=0;row<5;row++)rect(`#9eae9d`,x+4,49+row*6,14,1)}rect(`#cab57c`,33,8,23,3);rect(`#e5cb8e`,43,1,3,12)}
if(t===`shop`||t===`inn`){rect(`#514c3e`,74,49,10,2);rect(`#ded0a2`,78,51,9,13);rect(t===`inn`?`#8c5b5a`:`#397781`,80,54,5,7);rect(`#f3dfaa`,81,56,3,2)}
if(t===`town`){rect(`#c1b59b`,0,61,24,23);for(let row=0;row<4;row++)rect(row%2?`#9e7777`:`#795e6d`,9-row*3,47+row*4,7+row*6,4);rect(`#f3d89c`,7,68,6,7);rect(`#566275`,17,74,5,10)}
});'''

WORLD_ART = r'''var Ze={camp:[`#52734e`,`#73955d`,`#a9936d`,`#2d6778`],overworld:[`#5a7e52`,`#87a865`,`#b8a57e`,`#367c92`],dunmere:[`#698971`,`#96b28b`,`#bbb9a1`,`#427c91`],tollhouse:[`#5c766e`,`#8fa58d`,`#a8b1a3`,`#37788a`],fen:[`#426e60`,`#71977a`,`#919c79`,`#285e70`],granary:[`#526f62`,`#8fa18b`,`#a3a88b`,`#306477`],orchard:[`#657451`,`#a5a66c`,`#b49d80`,`#4b6b85`],crown:[`#6d8878`,`#a4bba2`,`#bec6ae`,`#427d92`],veyr:[`#758978`,`#b5c4a5`,`#d0d3bd`,`#607e9c`],heart:[`#4d6870`,`#92aaa4`,`#bdc7b3`,`#42627f`],works:[`#426255`,`#7d9474`,`#9da690`,`#2e6378`]};
var visualWorldCitizenSprites=new Set([`bessa`,`merchant`,`soren`,`iona`]);
function visualWorldCitizen(entity){return entity.kind===`npc`&&!entity.shopKind&&visualWorldCitizenSprites.has(entity.sprite)}
function Qe(e,t,n){
let key=`world-${n}`;e.textures.exists(key)&&e.textures.remove(key);
let width=Math.max(960,t.width*30),height=Math.max(576,t.height*30),ox=Math.floor((width-t.width*30)/2),oy=Math.floor((height-t.height*30)/2),canvas=e.textures.createCanvas(key,width,height),ctx=canvas.getContext();ctx.imageSmoothingEnabled=!1;
let info=typeof dungeonInfo===`function`?dungeonInfo(n):null,area=info?.root??n,palette=Ze[area]||Ze.camp,interior=(info?.floor??1)>1||[`works`,`granary`,`heart`,`tollhouse`].includes(n),random=Ke([...n].reduce((seed,char)=>seed+char.charCodeAt(0),193)),scenery=[],tile=(x,y)=>t.tiles[y]?.[x]||`#`;
J(ctx,`#172d3d`,0,0,width,height);
for(let y=0;y<t.height;y++)for(let x=0;x<t.width;x++){
let material=tile(x,y),px=ox+x*30,py=oy+y*30,region=n===`overworld`?{R01:`camp`,R02:`dunmere`,R03:`fen`,R04:`orchard`,R05:`crown`,R06:`veyr`}[M(`overworld`,x,y)]:area,[grass,leaf,stone,water]=n===`overworld`?Ze[region]:palette,isWater=material===`w`;
J(ctx,isWater?water:material===`d`?`#ae9569`:material===`s`?stone:material===`f`?interior?`#69776d`:stone:material===`#`?interior?`#465b5e`:`#6a7c74`:grass,px,py,30,30);
if(isWater){
J(ctx,`#183e5830`,px,py+18,30,12);J(ctx,`#bed8cb20`,px,py,30,4);
for(let row=0;row<3;row++){let rx=px+2+Math.floor(random()*11),ry=py+6+row*9;J(ctx,row%2?`#bddcd35c`:`#123e554f`,rx,ry,9+Math.floor(random()*11),1);if((x+y+row)%4===0)J(ctx,`#e1e7c25c`,rx+3,ry-1,4,1)}
for(let[dx,dy]of[[0,-1],[1,0],[0,1],[-1,0]])if(tile(x+dx,y+dy)!==`w`&&tile(x+dx,y+dy)!==`b`){J(ctx,`#244b54`,px+(dx===1?26:0),py+(dy===1?26:0),dx?4:30,dy?4:30);J(ctx,`#859d79`,px+(dx===1?29:0),py+(dy===1?29:0),dx?1:30,dy?1:30);for(let step=0;step<3;step++)J(ctx,`#4c7562`,px+(dx===1?27:dx===-1?0:step*10+2),py+(dy===1?27:dy===-1?0:step*10+2),dx?3:5,dy?3:5)}
}else if(material===`b`){
J(ctx,water,px,py,30,30);let horizontal=[`w`,`b`].includes(tile(x,y-1))&&[`w`,`b`].includes(tile(x,y+1));J(ctx,`#3b423b`,px+(horizontal?0:3),py+(horizontal?3:0),horizontal?30:24,horizontal?24:30);for(let board=0;board<5;board++){J(ctx,board%2?`#bca274`:`#d0b98a`,px+(horizontal?board*6:6),py+(horizontal?6:board*6),horizontal?5:18,horizontal?18:5);J(ctx,`#ead4a0`,px+(horizontal?board*6:6),py+(horizontal?6:board*6),horizontal?1:18,horizontal?18:1)}J(ctx,`#e0c38d`,px+(horizontal?0:3),py+(horizontal?3:0),horizontal?30:2,horizontal?2:30);J(ctx,`#71644b`,px+(horizontal?0:25),py+(horizontal?25:0),horizontal?30:2,horizontal?2:30);
}else if(material===`#`){
J(ctx,`#a4af98`,px,py,30,4);J(ctx,`#c0c7ac`,px+1,py,28,1);J(ctx,`#1b3540`,px,py+25,30,5);J(ctx,`#304a52`,px,py+4,1,21);J(ctx,`#344e55`,px,py+14,30,1);J(ctx,`#344e55`,px+14,py+4,1,10);J(ctx,`#344e55`,px+6,py+15,1,10);J(ctx,`#344e55`,px+23,py+15,1,10);J(ctx,`#8e9f8c66`,px+2,py+5,10,1);J(ctx,`#8e9f8c44`,px+8,py+16,11,1);
}else if(material===`s`||material===`f`){
J(ctx,`#364f543d`,px,py,30,1);J(ctx,`#344f543d`,px,py,1,30);for(let row=0;row<2;row++){let by=py+row*15,offset=(row+(x+y)%2)%2?8:0;for(let col=0;col<3;col++){let bx=px+col*11-offset;if(bx<px||bx+10>px+30)continue;J(ctx,`#213c4630`,bx+1,by+2,10,12);J(ctx,`#e2ddbb21`,bx+2,by+2,8,1);J(ctx,`#374e4d38`,bx+2,by+13,8,1)}}if((x*3+y)%9===0)J(ctx,`#405b554f`,px+21,py+10,4,1);
}else if(material===`^`){
for(let row=0;row<7;row++)J(ctx,row<3?`#c5ccb2`:row%2?`#6a8381`:`#8a9b8b`,px+13-row*2,py+1+row*4,4+row*4,4);J(ctx,`#f0e8c5`,px+12,py+1,7,4);J(ctx,`#415e66`,px+4,py+26,25,3);J(ctx,`#aebba0`,px+18,py+15,5,2);J(ctx,`#536f74`,px+9,py+19,3,5);
}else if(material===`d`){
for(let dot=0;dot<4;dot++){let dx=px+Math.floor(random()*27),dy=py+Math.floor(random()*27);J(ctx,dot%2?`#d9bd8c66`:`#786c4c42`,dx,dy,2+dot%2,1)}
for(let[dx,dy]of[[0,-1],[1,0],[0,1],[-1,0]])if(![`d`,`b`,`s`,`f`].includes(tile(x+dx,y+dy))){J(ctx,`#786f4b75`,px+(dx===1?28:0),py+(dy===1?28:0),dx?2:30,dy?2:30);for(let step=0;step<3;step++)J(ctx,grass,px+(dx===1?29:dx===-1?0:step*10+1),py+(dy===1?29:dy===-1?0:step*10+1),dx?1:4,dy?1:4)}if((x+y)%7===0){J(ctx,`#d8c9a18c`,px+10,py+16,4,2);J(ctx,`#6e79554f`,px+10,py+18,4,1)}
}else{
for(let tuft=0;tuft<3;tuft++){let tx=px+2+Math.floor(random()*24),ty=py+4+Math.floor(random()*22);J(ctx,`#24483738`,tx-1,ty+2,5,1);J(ctx,leaf,tx,ty,1,2);J(ctx,`#b6c9813b`,tx+2,ty-1,1,3)}if(material===`g`&&(x*17+y*11)%29===0){J(ctx,area===`orchard`?`#deb7ba`:`#e3d49d`,px+15,py+9,2,2);J(ctx,leaf,px+15,py+11,1,3)}
}
if(material===`t`)scenery.push({x:px+15,y:py+30,texture:region===`orchard`?`tree-orchard`:region===`fen`?`tree-fen`:region===`veyr`?`tree-pale`:`tree`,scale:n===`overworld`?.61:.84,row:y});
if(isWater&&n!==`overworld`&&(x+y)%6===0)ctx.drawImage(e.textures.get(`reeds`).getSourceImage(),px,py,30,30);
}
let visited=new Set;for(let y=0;y<t.height;y++)for(let x=0;x<t.width;x++)if(tile(x,y)===`T`&&!visited.has(`${x},${y}`)){let pending=[{x,y}],group=[];for(;pending.length;){let point=pending.shift(),id=`${point.x},${point.y}`;if(visited.has(id)||tile(point.x,point.y)!==`T`)continue;visited.add(id);group.push(point);for(let[dx,dy]of[[0,-1],[1,0],[0,1],[-1,0]])pending.push({x:point.x+dx,y:point.y+dy})}let left=Math.min(...group.map(point=>point.x)),right=Math.max(...group.map(point=>point.x)),top=Math.min(...group.map(point=>point.y)),bottom=Math.max(...group.map(point=>point.y)),w=(right-left+1)*30,h=(bottom-top+1)*30;if(n===`camp`)ctx.drawImage(e.textures.get(`tent`).getSourceImage(),ox+left*30,oy+top*30,w,h);else{let texture=n===`veyr`&&w>=120?`site-basilica`:(left+top)%3===0?`site-inn`:(left+top)%3===1?`site-shop`:`site-house`;ctx.drawImage(e.textures.get(texture).getSourceImage(),ox+left*30-3,oy+top*30-12,w+6,h+14)}}
if(n===`camp`)for(let[x,y]of[[8,8],[20,10],[26,13]]){J(ctx,`#554934`,ox+x*30,oy+y*30+5,24,9);J(ctx,`#c5aa78`,ox+x*30,oy+y*30+4,24,2);J(ctx,`#907950`,ox+x*30+2,oy+y*30+6,2,8)}
if(interior)for(let y=1;y<t.height-1;y+=4)for(let x=2;x<t.width-1;x+=6)if(tile(x,y)===`#`){J(ctx,`#9e8e65`,ox+x*30+5,oy+y*30,4,25);J(ctx,`#ead498`,ox+x*30+3,oy+y*30+13,8,5)}
if(n===`dunmere`||n===`veyr`){let x=n===`veyr`?16:15,y=n===`veyr`?11:9;if([`s`,`f`].includes(tile(x,y))){J(ctx,`#3e6b7d`,ox+x*30-10,oy+y*30+4,49,17);J(ctx,`#e1dcbc`,ox+x*30-8,oy+y*30,45,4);J(ctx,`#aad4d1`,ox+x*30-3,oy+y*30+6,35,7);J(ctx,`#e1eee0`,ox+x*30+3,oy+y*30+7,15,1)}}
// Baked, low-opacity light does not add a per-frame effect or change visibility.
for(let entity of t.entities??[])if(entity.kind===`campfire`||entity.sprite===`lantern`){let cx=ox+(entity.x+.5)*30,cy=oy+(entity.y+.65)*30;for(let ring=3;ring>=1;ring--){let radius=ring*11;J(ctx,ring===3?`#ffd18408`:ring===2?`#ffd1840b`:`#ffe0a40e`,cx-radius,cy-radius/2,radius*2,radius)}}
return canvas.refresh(),{key,tile:30,ox,oy,width,height,scenery}
}
'''
