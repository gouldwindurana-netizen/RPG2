"""Align visible entrances with their walk-through cells; keep one opening per building."""


def patch(source):
    labels = []

    def change(old, new, label):
        nonlocal source
        assert source.count(old) == 1, (label, source.count(old))
        source = source.replace(old, new, 1)
        labels.append(label)

    change('function Qe(e,t,n){if(t.kind===`shop`)return settlementShopTexture(e,t,n);',
           RENDER_HELPERS + 'function Qe(e,t,n){if(t.kind===`shelter`)return entranceShelterTexture(e,t,n);if(t.kind===`shop`)return settlementShopTexture(e,t,n);',
           'paint quiet shelter rooms and share explicit entrance geometry with the visible facades')
    old = 'if(n===`camp`)ctx.drawImage(e.textures.get(`tent`).getSourceImage(),ox+left*30,oy+top*30,w,h);else{let texture=n===`veyr`&&w>=120?`site-basilica`:(left+top)%3===0?`site-inn`:(left+top)%3===1?`site-shop`:`site-house`;ctx.drawImage(e.textures.get(texture).getSourceImage(),ox+left*30-3,oy+top*30-12,w+6,h+14)}'
    new = 'let entrance=entranceFacadeForGroup(n,{left,top,right,bottom});if(entrance)paintEntranceFacade(ctx,entrance,ox,oy);else if(n===`camp`)ctx.drawImage(e.textures.get(`tent`).getSourceImage(),ox+left*30,oy+top*30,w,h);else{let texture=n===`veyr`&&w>=120?`site-basilica`:(left+top)%3===0?`site-inn`:(left+top)%3===1?`site-shop`:`site-house`;ctx.drawImage(e.textures.get(texture).getSourceImage(),ox+left*30-3,oy+top*30-12,w+6,h+14)}'
    change(old, new,
           'draw each active building once with its opening contained in the actual door tile')
    change('travelTexture(e,t){if(e.shopDoor||he[t]?.kind===`shop`&&e.kind===`exit`)return`shop-door`;',
           'travelTexture(e,t){if(entranceRecordFor(t,e.id)||[`shop`,`shelter`].includes(he[t]?.kind)&&e.kind===`exit`)return entranceMarkerTexture(this);if(e.travelKind===`field-exit`&&[`camp`,`dunmere`,`fen`,`orchard`,`crown`,`veyr`].includes(t))return entranceTownExitTexture(this);if(e.shopDoor||he[t]?.kind===`shop`&&e.kind===`exit`)return`shop-door`;',
           'use subtle entry sills and a westward road marker instead of duplicate standing doors or barred town gates')
    change('this.labels.get(t.id),n.x,n.y-(i?70:c?34:t.shopKind?60:44),t.npcRoaming)',
           'this.labels.get(t.id),n.x,entranceLabelY(this,t,n.y-(i?70:c?34:t.shopKind?60:44)),t.npcRoaming)',
           'place building labels above their roofs rather than across the entrance')
    change('return{area:this.area,tile:this.tile,ox:this.ox,oy:this.oy,',
           'return{area:this.area,entrances:entranceViewport(this.area,this.ox,this.oy),tile:this.tile,ox:this.ox,oy:this.oy,',
           'report readonly painted opening bounds for pointer and alignment verification')
    return source, labels


RENDER_HELPERS = r'''function entranceRecordFor(area,id){return buildingEntrances.find(entry=>entry.parent===area&&entry.doorId===id)??null}
function entranceOpeningGeometry(entry,ox=0,oy=0){let footX=ox+(entry.door.x+.5)*30,footY=oy+(entry.door.y+1)*30-2;return{x:footX-11,y:footY-26,w:22,h:26,footX,footY}}
function entranceViewport(area,ox,oy){return buildingEntrances.filter(entry=>entry.parent===area).map(entry=>({id:entry.doorId,area:entry.area,kind:entry.kind,door:{...entry.door},approach:{...entry.approach},opening:entranceOpeningGeometry(entry,ox,oy)}))}
function entranceLabelY(scene,entity,fallback){let entry=entranceRecordFor(scene.area,entity.id);return entry?scene.oy+entry.bounds.top*30-15:fallback}
function entranceFacadeForGroup(area,bounds){return buildingEntrances.find(entry=>entry.parent===area&&entry.bounds.left===bounds.left&&entry.bounds.right===bounds.right&&entry.bounds.top===bounds.top&&entry.bounds.bottom===bounds.bottom)??null}
function paintEntranceFacade(ctx,entry,ox,oy){
let b=entry.bounds,x=ox+b.left*30,y=oy+b.top*30,w=(b.right-b.left+1)*30,base=oy+(b.bottom+1)*30-2,opening=entranceOpeningGeometry(entry,ox,oy),camp=entry.parent===`camp`,magic=entry.kind===`magic`,shelter=entry.kind===`shelter`,roof=magic?`#657e92`:shelter?`#887661`:`#7f795d`,roofLight=magic?`#91abb0`:shelter?`#bca68a`:`#beb18a`,wall=camp?`#cabd99`:`#c8c8aa`,trim=camp?`#77694d`:`#647777`;
ctx.save();ctx.fillStyle=`#112d3c44`;ctx.beginPath();ctx.ellipse(x+w/2,base+4,w*.51,5,0,0,Math.PI*2);ctx.fill();
J(ctx,`#314b53`,x+2,y+18,w-4,base-y-17);J(ctx,wall,x+5,y+20,w-10,base-y-21);J(ctx,`#e7d7af`,x+6,y+21,w-12,2);
for(let row=y+32;row<base-3;row+=12){J(ctx,`#8d937a55`,x+6,row,w-12,1);for(let col=x+12+(Math.floor(row/12)%2)*13;col<x+w-8;col+=27)J(ctx,`#8d937a44`,col,row-10,1,10)}
// A single roof and a single, tile-aligned opening. The entity adds no second door.
ctx.fillStyle=`#263e49`;ctx.beginPath();ctx.moveTo(x-5,y+22);ctx.lineTo(x+w/2,y-15);ctx.lineTo(x+w+5,y+22);ctx.closePath();ctx.fill();
for(let row=0;row<7;row++){let yy=y-12+row*5,half=(w/2+3)*(row+1)/7;J(ctx,row%2?roof:roofLight,x+w/2-half,yy,half*2,5);J(ctx,`#2a424b88`,x+w/2-half,yy+4,half*2,1);for(let col=x+w/2-half+9;col<x+w/2+half-3;col+=15)J(ctx,row%2?roofLight:roof,col+(row%2)*4,yy+1,1,3)}
J(ctx,`#d6c797`,x-3,y+22,w+6,3);J(ctx,trim,x-3,y+25,w+6,3);J(ctx,`#e4d3a9`,x+5,base-3,w-10,3);for(let post of[x+6,x+w-10]){J(ctx,trim,post,y+28,4,base-y-29);J(ctx,`#e3d0a4`,post+1,y+29,1,base-y-31)}
for(let wx of[x+11,x+w-25])if(wx+14<opening.x-4||wx>opening.x+opening.w+4){let wy=base-33;J(ctx,`#465e65`,wx-2,wy-2,18,21);J(ctx,`#947c52`,wx,wy,14,17);J(ctx,`#f2d993`,wx+2,wy+2,10,12);J(ctx,`#fff0bb`,wx+3,wy+3,3,8);J(ctx,`#796d50`,wx+6,wy+1,1,15);J(ctx,`#796d50`,wx+1,wy+8,12,1);J(ctx,`#dfc99d`,wx-3,wy+19,20,2)}
J(ctx,`#5d4b35`,opening.x-4,opening.y-3,opening.w+8,opening.h+4);J(ctx,`#be9e66`,opening.x-3,opening.y-3,opening.w+6,3);J(ctx,`#e7cc8e`,opening.x-2,opening.y-3,opening.w+4,1);J(ctx,`#9f8150`,opening.x-3,opening.y,3,opening.h);J(ctx,`#b8975d`,opening.x+opening.w,opening.y,3,opening.h);
J(ctx,`#112d38`,opening.x,opening.y,opening.w,opening.h);J(ctx,`#243e42`,opening.x+8,opening.y+3,opening.w-10,opening.h-4);J(ctx,`#907046`,opening.x,opening.y+1,6,opening.h-1);J(ctx,`#b4935c`,opening.x+1,opening.y+2,1,opening.h-3);J(ctx,`#f0d69b`,opening.x+4,opening.y+13,2,2);J(ctx,`#f3d89c22`,opening.x+10,opening.y+11,10,14);
J(ctx,`#d6bf88`,opening.footX-15,base-1,30,3);J(ctx,`#f7df9e`,opening.footX-12,base-1,24,1);J(ctx,`#796c4a`,opening.footX-16,base+3,32,2);ctx.restore()
}
function entranceMarkerTexture(scene){Ge(scene,`entry-threshold`,64,72,ctx=>{J(ctx,`#efd69620`,9,68,46,3);J(ctx,`#f4dda166`,18,69,28,1)});return`entry-threshold`}
function entranceTownExitTexture(scene){Ge(scene,`town-road-exit`,64,72,ctx=>{J(ctx,`#213b3c44`,5,65,54,6);J(ctx,`#d0b783`,8,67,48,2);ctx.fillStyle=`#f2dfaa`;ctx.beginPath();ctx.moveTo(13,56);ctx.lineTo(29,46);ctx.lineTo(29,52);ctx.lineTo(49,52);ctx.lineTo(49,60);ctx.lineTo(29,60);ctx.lineTo(29,66);ctx.closePath();ctx.fill();J(ctx,`#7e7957`,32,61,17,1)});return`town-road-exit`}
function entranceShelterTexture(scene,map,area){
let key=`world-${area}`;scene.textures.exists(key)&&scene.textures.remove(key);let width=Math.max(960,map.width*30),height=Math.max(576,map.height*30),ox=Math.floor((width-map.width*30)/2),oy=Math.floor((height-map.height*30)/2),canvas=scene.textures.createCanvas(key,width,height),ctx=canvas.getContext();ctx.imageSmoothingEnabled=!1;J(ctx,`#09182c`,0,0,width,height);
let furnishings=map.furnishings??[];for(let y=1;y<=14;y++)for(let x=2;x<=21;x++){let px=ox+x*30,py=oy+y*30,covered=furnishings.some(item=>x>=item.x&&x<item.x+item.w&&y>=item.y&&y<item.y+item.h),wall=map.tiles[y]?.[x]===`#`&&!covered;if(wall){J(ctx,`#354a50`,px,py,30,30);J(ctx,`#6f8074`,px+1,py+1,28,26);J(ctx,`#b4b797`,px+2,py+1,27,2);J(ctx,`#253e48`,px,py+27,30,3);J(ctx,`#53695f`,px+15,py+4,1,21)}else{J(ctx,(x+y)%2?`#8e7c5c`:`#998361`,px,py,30,30);J(ctx,`#c6af7c55`,px+1,py+2,28,1);J(ctx,`#615641`,px,py+28,30,2);J(ctx,`#746043`,px+7+(y%2)*12,py+2,1,25)}}
for(let item of furnishings){let x=ox+item.x*30,y=oy+item.y*30,w=item.w*30,h=item.h*30;if(item.kind===`bunk`){J(ctx,`#263c3e66`,x-3,y+h-1,w+6,6);J(ctx,`#574637`,x,y,w,h);J(ctx,`#c2a77a`,x+2,y+2,w-4,h-4);J(ctx,`#ece0b7`,x+5,y+5,w-10,11);J(ctx,`#b6c4b3`,x+5,y+18,w-10,h-24);J(ctx,`#849c91`,x+5,y+h-19,w-10,10);J(ctx,`#d5e0c277`,x+9,y+21,3,h-29);J(ctx,`#a08257`,x+1,y+h-7,w-2,5);J(ctx,`#e4c995`,x+2,y+h-7,w-4,1)}else{J(ctx,`#4d4637`,x+3,y+5,w-6,h-8);J(ctx,`#b49b70`,x,y+1,w,h-11);J(ctx,`#e1c797`,x+1,y+1,w-2,2);J(ctx,`#765f42`,x+6,y+h-11,4,10);J(ctx,`#765f42`,x+w-10,y+h-11,4,10)}}
// Warm windows and wall lamps are scenery, leaving the central route unobstructed.
for(let x of[8,15]){let px=ox+x*30,py=oy+2*30;J(ctx,`#1d3542`,px,py-5,30,37);J(ctx,`#b59c6e`,px+3,py-3,24,32);J(ctx,`#e8d6a6`,px+6,py,18,24);J(ctx,`#fff0c1`,px+7,py+1,6,18);J(ctx,`#6c715b`,px+14,py,2,24);J(ctx,`#6c715b`,px+5,py+11,20,2)}
for(let x of[3,20]){let px=ox+x*30+15,py=oy+9*30;J(ctx,`#594e37`,px-5,py-8,10,19);J(ctx,`#d2b776`,px-3,py-6,6,13);J(ctx,`#fff0b7`,px-2,py-5,4,9);let glow=ctx.createRadialGradient(px,py,1,px,py,43);glow.addColorStop(0,`#f5d58c22`);glow.addColorStop(1,`#f5d58c00`);ctx.fillStyle=glow;ctx.fillRect(px-43,py-43,86,86)}
let exit=map.entities.find(entity=>entity.kind===`exit`),dx=ox+((exit?.x??12)+.5)*30,dy=oy+((exit?.y??14)+1)*30-2;J(ctx,`#112c3b`,dx-15,dy-25,30,28);J(ctx,`#b29b69`,dx-18,dy-28,36,4);J(ctx,`#e3cd94`,dx-17,dy-28,34,1);J(ctx,`#dcc38a`,dx-15,dy-1,30,3);J(ctx,`#f1dca4`,dx-8,dy-11,16,2);J(ctx,`#f1dca4`,dx-2,dy-15,4,10);
return canvas.refresh(),{key,tile:30,ox,oy,width,height,scenery:[]}}
'''
