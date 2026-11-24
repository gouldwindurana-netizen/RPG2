"""Walk-in interiors for existing regional weapon and skill shop buildings."""


def patch(source):
    labels = []
    def change(old, new, label):
        nonlocal source
        assert source.count(old) == 1, (label, source.count(old))
        source = source.replace(old, new, 1)
        labels.append(label)

    change('function skillMerchantNames(maps){', MAP_HELPERS + 'function skillMerchantNames(maps){',
           'create paired safe interiors for twelve existing weapon and skill shop buildings')
    old = 'var he=skillMerchantNames(wayfarerLayout(depthDungeonLayout(expansionWorldLayout(travelMapLayout(j({camp:pe(),works:me()}))))));'
    new = 'var he=settlementShopLayout(skillMerchantNames(wayfarerLayout(depthDungeonLayout(expansionWorldLayout(travelMapLayout(j({camp:pe(),works:me()})))))));'
    change(old, new, 'move each original shopkeeper inside while preserving outdoor supply counters and world sites')
    change('function Qe(e,t,n){', SHOP_ART + 'function Qe(e,t,n){if(t.kind===`shop`)return settlementShopTexture(e,t,n);',
           'paint original warm shop rooms with counters shelving rugs and visible return doors')
    change('travelTexture(e,t){if(e.id?.startsWith(`wayfarer-board-`))',
           'travelTexture(e,t){if(e.shopDoor||he[t]?.kind===`shop`&&e.kind===`exit`)return`shop-door`;if(he[t]?.kind===`shop`&&e.shopKind)return e.shopKind===`magic`?`hero-bessa`:`hero-merchant`;if(e.id?.startsWith(`wayfarer-board-`))',
           'show a shop entrance outside and a human shopkeeper inside instead of a duplicate service counter')
    change('serviceTextures(){', 'serviceTextures(){' + SHOP_DOOR_ART,
           'create one reusable warm timber shop doorway without changing world gates or travel geometry')
    change('rest(){if(a.mode!==`explore`||!p(a.area,a.player.x,a.player.y)||a.reward)return;',
           'rest(){if(settlementShopInfo(a.area)||a.mode!==`explore`||!p(a.area,a.player.x,a.player.y)||a.reward)return;',
           'shop interiors do not create an unintended inn or recovery service')
    change('else{let[t,n]=zt(),r=X.map().entities.filter(',
           'else{let shop=settlementShopInfo(e.area),[t,n]=shop?settlementShopObjective(e,shop):zt(),r=X.map().entities.filter(',
           'give indoor shop visits a local merchant and exit objective instead of the remote main quest')
    rest_button = '<button class="subtle-button" data-command="rest" ${!p(e.area,e.player.x,e.player.y)||e.mode!==`explore`?`disabled`:``}>${e.area===`camp`?`Rest at campfire`:`Rest · ${Math.min(120,Number(M(e.area,e.player.x,e.player.y).slice(1))*10)} gold`}</button>'
    change(rest_button, '${shop?``:`' + rest_button + '`}',
           'show only applicable interaction controls inside shops while preserving outdoor lodging controls')
    return source, labels


MAP_HELPERS = r'''var settlementShopRecords=[];
function settlementShopLayout(maps){
for(let parent of[`camp`,`dunmere`,`fen`,`orchard`,`crown`,`veyr`]){
let map=maps[parent];for(let kind of[`weapon`,`magic`]){
let merchant=map.entities.find(entity=>entity.shopKind===kind);if(!merchant)continue;
let area=`shop-${parent}-${kind}`,doorId=`shop-enter-${parent}-${kind}`,exitId=`shop-leave-${parent}-${kind}`,name=kind===`weapon`?`Weapon Shop`:`Skill Shop`,door={x:merchant.x,y:merchant.y},approach={x:door.x,y:door.y+1},region=f[parent].regionId;
let rows=Array.from({length:16},(_,y)=>Array.from({length:24},(_,x)=>x>=3&&x<=20&&y>=3&&y<=13?`f`:`#`));
for(let x=3;x<=20;x++)rows[5][x]=`#`;rows[5][12]=`f`;rows[14][12]=`s`;
let keeper={...merchant,x:12,y:5,shopkeeper:!0,hint:kind===`weapon`?`Talk to the armorer to buy or sell equipment`:`Talk to the skillkeeper to learn techniques and magic`};
let exit={id:exitId,x:12,y:14,kind:`exit`,name:`Return to ${f[parent].name}`,sprite:`door`,hint:`Walk through the door to return outside`,destination:parent,travelKind:`shop-exit`};
f[area]={name:`${f[parent].name} — ${name}`,regionId:region,safe:!0,recommended:[...f[parent].recommended]};
maps[area]={area,kind:`shop`,name:f[area].name,regionId:region,safe:!0,recommended:[...f[parent].recommended],width:24,height:16,tiles:rows.map(row=>row.join(``)),entities:[keeper,exit],settlementParent:parent,shopKind:kind};
let entrance={id:doorId,...door,kind:`exit`,name,sprite:`door`,hint:`Walk into the ${name.toLowerCase()}`,destination:area,travelKind:`shop-entry`,shopDoor:!0,shopKind:kind};
map.entities=map.entities.filter(entity=>entity!==merchant);map.entities.push(entrance);
let outer=map.tiles.map(row=>row.split(``));outer[door.y][door.x]=`s`;outer[approach.y][approach.x]=`d`;map.tiles=outer.map(row=>row.join(``));
g[doorId]={area,x:12,y:13,facing:`up`};g[exitId]={area:parent,...approach,facing:`down`};
settlementShopRecords.push({parent,area,kind,doorId,exitId,merchantId:merchant.id,door,approach,region});
}}
return maps}
function settlementShopInfo(area){return settlementShopRecords.find(shop=>shop.area===area)??null}
function settlementShopObjective(state,shop=settlementShopInfo(state.area)){if(!shop)return P(state);let skill=shop.kind===`magic`,name=skill?`Skill Shop`:`Weapon Shop`,keeper=skill?`skillkeeper`:`armorer`,purpose=skill?`learn techniques or magic for a selected traveler`:`buy or sell equipment`;return[name,`Speak to the ${keeper} at the north counter to ${purpose}. Walk through the south door to return to ${f[shop.parent].name}.`]}
'''

SHOP_ART = r'''function settlementShopTexture(scene,map,area){
let key=`world-${area}`;scene.textures.exists(key)&&scene.textures.remove(key);
let width=Math.max(960,map.width*30),height=Math.max(576,map.height*30),ox=Math.floor((width-map.width*30)/2),oy=Math.floor((height-map.height*30)/2),canvas=scene.textures.createCanvas(key,width,height),ctx=canvas.getContext(),magic=map.shopKind===`magic`,accent=magic?`#7983b1`:`#b28a55`;
ctx.imageSmoothingEnabled=!1;J(ctx,`#09172c`,0,0,width,height);
for(let y=1;y<=14;y++)for(let x=2;x<=21;x++){
let px=ox+x*30,py=oy+y*30,tile=map.tiles[y][x];
if(tile===`#`){J(ctx,`#253747`,px,py,30,30);J(ctx,`#49606b`,px+1,py+1,28,26);J(ctx,`#788579`,px+1,py+1,28,2);J(ctx,`#152a3d`,px,py+27,30,3);if(y%2)J(ctx,`#23394b`,px+14,py+4,1,21)}else{J(ctx,(x+y)%2?`#8d785a`:`#967f5c`,px,py,30,30);J(ctx,`#c5a97544`,px+1,py+2,28,1);J(ctx,`#4b4638`,px,py+28,30,2);J(ctx,`#61523c`,px+((y%2)*12+6),py+1,1,27);J(ctx,`#d3b98a44`,px+18,py+13,5,1)}
}
// Shelves, goods and counter are baked into the room; merchant remains an ordinary NPC.
for(let x=4;x<=19;x++){
let px=ox+x*30,py=oy+5*30;
J(ctx,`#352d2a`,px,py+14,30,16);J(ctx,`#715135`,px+1,py+9,28,17);J(ctx,`#c09c60`,px-1,py+7,32,5);J(ctx,`#ead5a0`,px,py+7,30,1);J(ctx,`#47392d`,px+5,py+16,20,2);
}
for(let x of[4,5,6,17,18,19]){let px=ox+x*30,py=oy+3*30;J(ctx,`#3d342e`,px-2,py-10,34,47);J(ctx,`#91734d`,px,py-9,30,45);for(let row=0;row<2;row++){J(ctx,`#b79b67`,px,py+9+row*18,30,3);for(let i=0;i<4;i++){let colors=magic?[`#7788ac`,`#b49471`,`#a3b8ad`,`#bba889`]:[`#a5b4b1`,`#c0b68b`,`#7e9e9c`,`#a0a699`];J(ctx,colors[(x+i+row)%4],px+3+i*6,py-4+row*18,4,12);J(ctx,`#d9d5b588`,px+3+i*6,py-3+row*18,1,8)}}}
let rugX=ox+9*30,rugY=oy+7*30;J(ctx,`#3c3b43`,rugX-3,rugY-3,186,186);J(ctx,magic?`#4b507c`:`#665653`,rugX,rugY,180,180);J(ctx,accent,rugX+5,rugY+5,170,3);J(ctx,accent,rugX+5,rugY+172,170,3);J(ctx,accent,rugX+5,rugY+5,3,170);J(ctx,accent,rugX+172,rugY+5,3,170);for(let y=0;y<5;y++)for(let x=0;x<5;x++)if((x+y)%2===0)J(ctx,magic?`#8c96b344`:`#b39a6b44`,rugX+20+x*30,rugY+20+y*30,10,10);
for(let x of[8,15]){let px=ox+x*30,py=oy+2*30;J(ctx,`#182d42`,px,py-8,30,40);J(ctx,`#a89365`,px+3,py-5,24,34);J(ctx,`#ead5a3`,px+6,py-2,18,25);J(ctx,`#f7e8bf`,px+7,py,8,15);J(ctx,`#6c654f`,px+14,py-2,2,26);J(ctx,`#6c654f`,px+5,py+10,20,2)}
for(let x of[4,19]){let px=ox+x*30+15,py=oy+9*30;J(ctx,`#493b30`,px-4,py,8,34);J(ctx,`#c3a05c`,px-9,py-2,18,9);J(ctx,`#ffe4a3`,px-5,py-10,10,11);J(ctx,`#fff0bd`,px-2,py-9,4,8);for(let ring=3;ring>=1;ring--)J(ctx,ring===3?`#ffd18a08`:`#ffe0a40c`,px-ring*15,py-ring*7,ring*30,ring*14)}
let dx=ox+12*30,dy=oy+14*30;J(ctx,`#14283d`,dx-8,dy-7,46,38);J(ctx,`#cab77e`,dx-10,dy-9,50,5);J(ctx,`#e8dbac`,dx-8,dy-9,46,2);J(ctx,`#e6cc8a`,dx+7,dy+12,16,2);J(ctx,`#e6cc8a`,dx+13,dy+8,4,10);
return canvas.refresh(),{key,tile:30,ox,oy,width,height,scenery:[]}}
'''


SHOP_DOOR_ART = r'''Ge(this,`shop-door`,64,72,ctx=>{
// A welcoming timber threshold, distinct from barred dungeon and world gates.
J(ctx,`#10213055`,1,66,62,5);J(ctx,`#3b3029`,7,6,50,59);J(ctx,`#b38a54`,8,8,9,54);J(ctx,`#d8b778`,9,9,3,51);J(ctx,`#8b6941`,48,8,9,54);J(ctx,`#c39b63`,49,9,3,49);
J(ctx,`#d4b681`,7,5,50,9);J(ctx,`#edd4a2`,8,5,48,2);J(ctx,`#a57d4c`,10,12,44,3);J(ctx,`#5a4731`,13,14,38,49);J(ctx,`#1b2a2c`,17,16,30,45);J(ctx,`#34433a`,34,19,11,36);
// The open leaf uses short grain highlights rather than a grille.
J(ctx,`#9d7948`,16,16,17,45);J(ctx,`#c4a269`,18,17,3,42);J(ctx,`#725537`,23,17,1,42);J(ctx,`#795a38`,29,17,2,43);J(ctx,`#dec28a`,17,17,15,2);J(ctx,`#7f5d38`,17,56,15,3);J(ctx,`#e7ca7c`,27,38,3,5);J(ctx,`#6f5030`,27,43,3,1);
J(ctx,`#f6dfaa22`,33,23,11,32);J(ctx,`#ffdda33b`,33,55,13,6);J(ctx,`#6b573e`,7,61,50,5);J(ctx,`#d7b67c`,8,61,48,2);J(ctx,`#b59665`,4,66,56,4);J(ctx,`#e5c998`,5,66,54,1);J(ctx,`#68553e`,4,70,56,2)
});'''
