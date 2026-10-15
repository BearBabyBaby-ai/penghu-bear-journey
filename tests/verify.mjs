import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {KINDS,AREAS,makeTour,filterRecords,interpolateTide,cleanSave,minute} from '../dist/model.js';
import {Geometry,buildWorld,buildMapMarkers,movePlayer,insideIsland} from '../dist/engine.js';
import {MAP,mapPosition,insideMap,locateTour,mapSpawn,geoToWorld,worldToGeo,tileAt,tileBounds,LAYERS} from '../dist/map.js';
import {LandNavigation} from '../dist/navigation.js';
import {Coastline,loadTerrain,validateCoastline,LAND_FILE,GRID_FILE,LAND_VERSION} from '../dist/coastline.js';
import {TileMap} from '../dist/tiles.js';
const data=JSON.parse(fs.readFileSync(new URL('../dist/data.json',import.meta.url)));
assert.deepEqual(data.meta.sheets,['美食清單','景點','廟宇','奎壁山摩西分海','澎湖縣-未來30天潮汐預報']);
assert.equal(data.records.length,977);
assert.equal(new Set(data.records.map(x=>x.id)).size,977);
assert.deepEqual(Object.fromEntries(Object.keys(KINDS).map(k=>[k,data.records.filter(r=>r.kind===k).length])),{food:608,sight:181,temple:188});
assert.equal(data.records.filter(r=>r.kind==='food'&&r.sheet==='美食清單').length,608);
assert(Object.hasOwn(KINDS,'food'));
assert(data.records.every(r=>r.name&&r.row>=2&&data.meta.sheets.includes(r.sheet)));
for(const area of AREAS){
 const tour=makeTour(data.records,area);
 assert.equal(tour.length,9,area);assert.equal(new Set(tour.map(n=>n.record.id)).size,9);
 assert(tour.every(n=>n.record.area===area&&insideIsland(n.x,n.z)));
 assert(tour.every(n=>insideIsland(n.x,n.z+2)));
 const geo=buildWorld(tour,area);assert(geo.v.length>10000&&geo.v.length%9===0);assert(geo.v.every(Number.isFinite));
}
// Georeferenced records use one projection: no affine control points or snapping markers.
assert.equal(MAP.areas.length,6);
for(const r of data.records){const p=mapPosition(r);if(!p)continue;const g=worldToGeo(p.x,p.z);assert(Math.abs(g.lat-r.lat)<1e-10);assert(Math.abs(g.lng-r.lng)<1e-10)}
// Dense city symbols must stay low and small at every original source point.
// These limits prevent the giant marker forest without hiding source records.
for(const r of data.records){
 const p=mapPosition(r);if(!p)continue;
 const marker=buildMapMarkers([{...p,record:r}]);assert(marker.v.length>0&&marker.v.length%9===0);assert(marker.v.every(Number.isFinite));assert(marker.v.length/9<500,'Keep mobile marker geometry bounded');
 for(let i=0;i<marker.v.length;i+=9){assert(Math.abs(marker.v[i]-p.x)<=.150001);assert(Math.abs(marker.v[i+2]-p.z)<=.150001);assert(marker.v[i+1]>=1.034999&&marker.v[i+1]<=1.435001,'Miniatures must not exceed 40 Mercator metres above the map')}
}
for(const [lng,lat] of [[119.6704986,23.5970241],[119.672563,23.5978987],[119.42,23.2],[119.6,23.75]]){
 const p=geoToWorld(lng,lat);for(const z of [9,12,15,18]){const t=tileAt(z,p.x,p.z),b=tileBounds(z,t.x,t.y);assert(p.x>=b.minX&&p.x<=b.maxX&&p.z>=b.minZ&&p.z<=b.maxZ)}
}
const north=data.records.find(r=>r.id==='temple-76');assert.equal(north.village,'北寮村');assert.equal(north.name,'保安宮');
assert.deepEqual(mapPosition(north),geoToWorld(119.6704986,23.5970241));
assert.equal(LAYERS.nlsc.url(15,27366,14127),'https://wmts.nlsc.gov.tw/wmts/EMAP/default/GoogleMapsCompatible/15/14127/27366');
assert.equal(LAYERS.osm.url(15,27366,14127),'https://tile.openstreetmap.org/15/27366/14127.png');
// Explicit synthetic geometries test classification; these are not shipped as real coastlines.
const feature=rings=>({type:'Feature',properties:{timestamp:'fixture'},geometry:{type:'MultiPolygon',coordinates:rings.map(r=>[r.map(([x,z])=>{const g=worldToGeo(x,z);return[g.lng,g.lat]})])}});
const geo=feature([[[-10,-10],[10,-10],[10,10],[-10,10],[-10,-10]],[[-2,-2],[-2,2],[2,2],[2,-2],[-2,-2]],[[20,-2],[24,-2],[24,2],[20,2],[20,-2]]]);
const coast=new Coastline(geo),navigation=new LandNavigation(coast);
assert(coast.isLand(-5,0));assert(!coast.isLand(0,0),'An ocean hole must stay water');assert(coast.isLand(22,0));assert(!coast.isLand(15,0));
assert(!coast.segment({x:-5,z:0},{x:5,z:0}));assert(coast.segment({x:-5,z:5},{x:5,z:5}));
const from=navigation.snap(-5,0),to=navigation.snap(5,0),detour=navigation.path(from,to);assert(detour&&detour.length>1);let at=from;for(const point of detour){assert(navigation.segment(at,point));at=point}
assert.equal(navigation.path(from,{x:22,z:0}),null);assert.equal(navigation.snap(100,100),null,'Far sea coordinates must never relocate to an arbitrary island');
const mapped=locateTour([{record:{lat:worldToGeo(11,0).lat,lng:worldToGeo(11,0).lng},index:0}], '湖西鄉',navigation);
assert(Math.abs(mapped[0].x-11)<1e-8,'The source marker must stay at its original coordinate');assert(navigation.isLand(mapped[0].approach.x,mapped[0].approach.z));assert(navigation.isLand(mapSpawn(mapped).x,mapSpawn(mapped).z));
assert.equal(mapSpawn(locateTour([{record:{lat:23.1,lng:119.5},index:0}],'湖西鄉',null)),null);
for(let d=0;d<16;d++){const actor={...from};for(let k=0;k<140;k++){movePlayer(actor,Math.cos(d/8*Math.PI),Math.sin(d/8*Math.PI),.06,12,navigation.isLand);assert(coast.isLand(actor.x,actor.z))}}
// Analytic intersection prevents crossing even a channel narrower than movement samples.
const slit=new Coastline(feature([[[-1,-1],[.2,-1],[.2,1],[-1,1],[-1,-1]],[[.20001,-1],[2,-1],[2,1],[.20001,1],[.20001,-1]]]));
const safe=slit.isLand;safe.segment=(a,b)=>slit.segment(a,b);const actor={x:0,z:0,facing:0};movePlayer(actor,1,0,.06,12,safe);assert(actor.x<.2);
// A fresh browser obtains the real land mask from the same deployment, without
// contacting Overpass, OSM, or relying on localStorage permissions/cache.
const landText=fs.readFileSync(new URL('../dist/'+LAND_FILE,import.meta.url),'utf8'),gridText=fs.readFileSync(new URL('../dist/'+GRID_FILE,import.meta.url),'utf8'),requested=[];
const localFetch=async path=>{requested.push(path);assert(!path.includes('://'),'Terrain startup must never depend on an external API');return new Response(path===LAND_FILE?landText:gridText)};
const terrain=await loadTerrain(localFetch);assert.deepEqual(requested.sort(),[GRID_FILE,LAND_FILE].sort());assert.equal(terrain.geo.properties.version,LAND_VERSION);assert.equal(terrain.grid.sourceSHA256,crypto.createHash('sha256').update(landText).digest('hex'));
await assert.rejects(loadTerrain(async path=>new Response(path===LAND_FILE?landText+' ':gridText)),/不相符/);
await assert.rejects(loadTerrain(async()=>new Response('',{status:404})),/未載入/);
const realCoast=validateCoastline(terrain.geo),realNav=new LandNavigation(realCoast,terrain.grid),builtNav=new LandNavigation(realCoast);
assert.deepEqual(realNav.walk,builtNav.walk,'Packaged navigation must match the shipped geometry');assert.equal(terrain.geo.geometry.coordinates.length,296);assert.equal(terrain.geo.properties.sourceFeatureCount,106);
for(const [name,lng,lat,land] of [['北寮保安宮',119.6704986,23.5970241,true],['北寮東側海面',119.685,23.597,false],['澎湖內海',119.55,23.60,false],['七美島中央',119.427,23.205,true],['望安島中央',119.503,23.365,true]]){const p=geoToWorld(lng,lat);assert.equal(realCoast.isLand(p.x,p.z),land,name)}
const northTour=locateTour([{record:north,index:0},{record:data.records.find(r=>r.id==='sight-47'),index:1}],'湖西鄉',realNav);assert.equal(northTour[0].positionOffset,0);assert(realNav.isLand(northTour[1].approach.x,northTour[1].approach.z));assert(northTour[1].positionOffset<1,'Tidal attraction uses nearby shore while preserving source coordinate');
let validRecords=0;for(const r of data.records){const p=mapPosition(r),land=p&&realNav.snap(p.x,p.z);if(land){validRecords++;assert(realCoast.isLand(land.x,land.z))}}assert.equal(validRecords,940);
// Compare the acceleration index with an independent full-ring point test.
const brute=(x,z)=>{let inside=false;for(const r of realCoast.rings){let hit=false;for(let i=0,j=r.points.length-1;i<r.points.length;j=i++){const a=r.points[i],b=r.points[j];if((a.z>z)!==(b.z>z)&&x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x)hit=!hit}if(hit)inside=!inside}return inside};
for(let i=0;i<600;i++){const x=MAP.minX+((i*7919)%600)/600*MAP.width,z=MAP.minZ+((i*3571)%601)/601*MAP.height;assert.equal(realCoast.isLand(x,z),brute(x,z))}
for(const area of AREAS){const tour=locateTour(makeTour(data.records.filter(r=>mapPosition(r)),area),area,realNav),spawn=mapSpawn(tour);assert(spawn&&realCoast.isLand(spawn.x,spawn.z),area+' spawn');for(const n of tour){assert.deepEqual({x:n.x,z:n.z},mapPosition(n.record));if(!n.approach)continue;assert(realCoast.isLand(n.approach.x,n.approach.z));const path=realNav.path(spawn,n.approach);if(path){let at=spawn;for(const p of path){assert(realCoast.segment(at,p),area+' path must remain land');at=p}}}for(let angle=0;angle<8;angle++){const p={...spawn};for(let k=0;k<180;k++){movePlayer(p,Math.cos(angle*Math.PI/4),Math.sin(angle*Math.PI/4),.06,12,realNav.isLand);assert(realCoast.isLand(p.x,p.z))}}}
// Projection QA with a mocked GL driver; no browser or network is used.
const gl=new Proxy({}, {get:(t,k)=>k==='getShaderParameter'||k==='getProgramParameter'?()=>true:k==='getAttribLocation'?()=>0:k==='getUniformLocation'?(_,name)=>name:k.startsWith('create')?()=>({}):k.toUpperCase()===k?1:()=>{}});
globalThis.window={devicePixelRatio:1};const canvas={clientWidth:1280,clientHeight:800,getContext:()=>gl,getBoundingClientRect:()=>({left:0,top:0,right:1280,bottom:800,width:1280,height:800})};
const {Engine}=await import('../dist/engine.js');const engine=new Engine(canvas);engine.focus=[60,0,-120];engine.zoom=12;engine.angle=.25;engine.tilt=1.05;engine.render(0,new Geometry());
for(const p of [[60,.98,-120],[64,.98,-125],[56,.98,-114]]){const screen=engine.project(p),ground=engine.ground(screen.x,screen.y,.98);assert(Math.hypot(ground.x-p[0],ground.z-p[2])<1e-5)}
globalThis.Image=class{set src(v){this.url=v}};const tiles=new TileMap(engine);tiles.update();assert(tiles.visible.length>0&&tiles.visible.length<=48);assert(tiles.active<=6);assert(tiles.visible.every(t=>t.z>=9&&t.z<=18));
// Search spans the complete data and respects independent kind and area filters.
assert(filterRecords(data.records,{query:'奎壁山摩西分海',kind:'sight'}).some(r=>r.name==='奎壁山摩西分海'));
assert(filterRecords(data.records,{area:'七美鄉',kind:'temple'}).every(r=>r.area==='七美鄉'&&r.kind==='temple'));
assert.equal(filterRecords(data.records,{kind:'food'}).length,608);
assert.equal(filterRecords(data.records,{query:'確定不存在的地點 XYZ 987'}).length,0);
// Walking remains on land, long frames do not teleport, and backwards input works.
const p={x:20.9,z:0,facing:0};for(let i=0;i<100;i++)movePlayer(p,1,0,.016);assert(insideIsland(p.x,p.z));assert(p.x<21.1);
const q={x:0,z:0,facing:0};movePlayer(q,1,0,100);assert(q.x<=.35);movePlayer(q,-1,0,.06);assert(Math.abs(q.x)<1e-6);
assert.equal(mapPosition({lat:null,lng:null}),null);
assert(mapPosition({lat:23.2,lng:119.4}),'Southern islands now share the real map');
// A fast frame cannot jump a narrow forbidden channel between valid endpoints.
const tunnelActor={x:0,z:0,facing:0};movePlayer(tunnelActor,1,0,.06,12,(x,z)=>!(x>.2&&x<.4));assert(tunnelActor.x<=.2);
// Test detours and disconnected transfers on a small explicit obstacle fixture.
const fixture=new LandNavigation({width:9,height:7,cell:1,minX:0,minZ:0,rows:['000000000','011101010','010101010','010101010','010001010','011111010','000000000']});
const fa=fixture.point(10),fb=fixture.point(14),fp=fixture.path(fa,fb);assert(fp&&fp.length>1,'The path must go around the water cutout');let previous=fa;for(const p of fp){assert(fixture.segment(previous,p));previous=p}
const disconnected=fixture.point(16);assert.equal(fixture.path(fa,disconnected),null);
// All source extrema are recovered by the illustrative tide curve.
let seaEvents=0;
for(const day of Object.values(data.seaDays)){for(const event of day.events){seaEvents++;assert(Math.abs(interpolateTide(day.events,minute(event.time))-Number(event.height))<.001)}for(const m of [0,360,720,1080,1439])assert(Number.isFinite(interpolateTide(day.events,m)))}
assert.equal(seaEvents,2825);
assert.equal(data.forecasts.length,6);assert(data.forecasts.every(g=>Object.keys(g.days).length===31&&Object.values(g.days).reduce((s,d)=>s+d.events.length,0)===120));
const d=data.forecasts[0].days['2026-10-15'];assert.deepEqual(d.events.map(e=>e.time),['01:06','07:31','14:10','19:37']);
assert.deepEqual(data.seaDays['2026-10-15'].date,'2026-10-15');
// Existing stamp data and imported backups remain compatible.
const stamps={};for(const r of data.records.filter(r=>r.kind==='sight').slice(0,6))stamps[r.id]='2026-10-15';
stamps[data.records.find(r=>r.kind==='temple').id]='2026-10-15';
assert.deepEqual(cleanSave({stamps:{...stamps,'fake-id':'2026-10-15','food-2':123},area:'bogus'},data.records).area,'馬公市');
assert(!Object.hasOwn(cleanSave({stamps:{'fake-id':'2026-10-15'}},data.records).stamps,'fake-id'));
stamps['food-2']='2026-10-15';
const migration=cleanSave({version:1,stamps:{...stamps,'food-2':'2026-10-15'},observed:true},data.records);
assert.deepEqual(migration.stamps,stamps);assert(migration.observed);
const index=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
assert(!/https?:\/\/[^"']+\.(js|css)/.test(index),'Game assets must not depend on a remote CDN');
for(const file of ['engine.js','model.js','map.js','navigation.js','coastline.js','tiles.js','game.js','style.css','data.json','assets/penghu-map.jpg','assets/bearbao.png',LAND_FILE,GRID_FILE])assert(fs.existsSync(new URL('../dist/'+file,import.meta.url)));
assert(!/島嶼任務|僅使用：|id="quest"/.test(index));assert(index.includes('id="place-kind"'));assert(!index.includes('id="places-food"'));
assert(index.includes('id="bearbao-avatar"')&&index.includes('assets/bearbao.png'));
const gameSource=fs.readFileSync(new URL('../dist/game.js',import.meta.url),'utf8');assert(!gameSource.includes('drawBear('));assert(gameSource.includes('navigation.isOnRoad(player)||journey?.inTransit'),'Unknown terrain must freeze movement without a verified journey');assert(index.includes('id="ferry-boat"'),'Only ship travel permits an avatar over water');
const avatarBytes=fs.readFileSync(new URL('../dist/assets/bearbao.png',import.meta.url));assert.equal(crypto.createHash('sha256').update(avatarBytes).digest('hex'),'2791856bcf16fd1fc39c67f7ec467659d15cb5790d598c3fb0c1b61d2d0556c7');assert.equal(avatarBytes[25],6,'The original avatar must preserve alpha transparency');
console.log('PASS: same-origin bundled terrain loads without Overpass/cache; actual 2026 Northliao land/sea checks; 296 dissolved island polygons; navigation/geometry hash match; all six-region spawns and paths; indexed geometry agrees with full-ring tests; Bearbao and 977-record/tide/save regressions. Browser UI and external raster tiles were not tested here.');
