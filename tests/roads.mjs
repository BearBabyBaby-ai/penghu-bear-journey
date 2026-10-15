import assert from 'node:assert/strict';
import fs from 'node:fs';
import {RoadNavigation,ROAD_VERSION,ROAD_FILE,loadRoads} from '../dist/roads.js';
import {Coastline} from '../dist/coastline.js';
import {worldToGeo,mapPosition,locateTour,mapSpawn} from '../dist/map.js';
import {AREAS,makeTour} from '../dist/model.js';
const read=file=>JSON.parse(fs.readFileSync(new URL('../dist/'+file,import.meta.url)));
const fixture=(points,edges)=>new RoadNavigation({version:ROAD_VERSION,source:{timestamp:'fixture'},nodes:points.map(([x,z])=>{const g=worldToGeo(x,z);return[g.lng,g.lat]}),edges:edges.map(e=>[...e,0]),roads:[{id:'fixture',name:'U形測試道路',highway:'residential',bridge:false}]},{isLand:()=>true});
const n=fixture([[0,0],[0,4],[4,4],[4,0],[.2,0],[.2,-4],[4,-4]],[[0,1],[1,2],[2,3],[4,5],[5,6]]);
const a=n.point(0,.05),b=n.point(2,.95),path=n.path(a,b);
assert(path&&path.length===3);assert(Math.abs(path.distance-11.6)<1e-6);
assert(path.distance>Math.hypot(a.x-b.x,a.z-b.z)*2,'Road route must detour around the block');
assert.equal(n.path(a,n.point(3,.05)),null,'Nearby disconnected roads must not connect');
assert.equal(n.snap(2,0,.4),null,'An empty block must not become a road');
assert.equal(n.distance(a,b,.3),Infinity,'Cannot stamp through a block');
assert(Math.abs(n.path(n.point(0,.2),n.point(0,.3)).distance-.4)<1e-7);
assert(n.path(n.point(0,.2),n.point(0,.3),.5));
assert.equal(n.path(n.point(0,.2),n.point(0,.3),.3),null);
assert.equal(n.path({...a,x:2},b),null,'Reject an actor away from its claimed road');
function walk(nav,start,path){
 const player={...start},initial={...start};let length=0;
 for(const dest of path){let count=0;while(true){assert(++count<10000);const before={...player},result=nav.advance(player,dest,.071);assert(nav.isOnRoad(player));assert(result.used>0||result.reached,'A valid route must advance at every turn');if(result.used>0){const e=nav.edges[player.edge],other=nav.edges[before.edge];if(player.edge!==before.edge)assert(before.t<1e-7||before.t>1-1e-7);assert(Math.abs(Math.hypot(player.x-before.x,player.z-before.z)-result.used)<1e-6);assert(e&&other)}length+=result.used;if(result.reached)break}}
 assert(Math.abs(length-path.distance)<1e-5);assert(Math.hypot(player.x-initial.x,player.z-initial.z)<=length+1e-6);return player;
}
const finish=walk(n,a,path);assert(Math.hypot(finish.x-b.x,finish.z-b.z)<1e-7);
const diagonal={...n.point(0,.5)};n.manual(diagonal,1,1,4);assert(n.isOnRoad(diagonal));assert(diagonal.x>1.9&&Math.abs(diagonal.z-4)<1e-7,'Manual control turns only at the shared junction');
const sideways={...n.point(0,.5)};assert(!n.manual(sideways,1,0,2));assert(Math.abs(sideways.x)<1e-7,'Sideways input cannot cross a block');
const deadEnd={...n.point(2,.9)};n.manual(deadEnd,0,-1,5);assert(Math.abs(deadEnd.z)<1e-7);n.manual(deadEnd,0,-1,5);assert(Math.abs(deadEnd.z)<1e-7,'Stop at the end of a road');n.manual(deadEnd,0,1,1);assert(deadEnd.z>.9,'Reverse input follows the same road');
const invalidAdvance={...a};assert.equal(n.advance(invalidAdvance,n.point(3,.1),10).used,0);assert.deepEqual(invalidAdvance,a);
// Real packaged geometry: routes, all six area starts and every movement sample
// must stay on original road edges. Sea exceptions require named source bridges.
const graph=read(ROAD_FILE),coast=new Coastline(read('geo/penghu-land-20260407.geojson')),roads=new RoadNavigation(graph,coast),data=read('data.json');
assert.equal(graph.nodes.length,24489);assert.equal(graph.edges.length,26746);assert.equal(graph.source.tiles.length,121);assert.equal(graph.source.timestamp,'2021-12-17T05:28+08:00');
assert(graph.source.tiles.every(t=>/^[0-9a-f]{40}$/.test(t.sha)&&t.z===14));
assert(graph.roads.every(r=>!['motorway','construction','proposed'].includes(r.highway)));
const bridgeIds=new Set(['way/60878925','way/60879113','way/60879110','way/294281818','way/294281819']);let bridgeEdges=0;
for(const e of roads.edges){const meta=roads.roads[e.r];if(!coast.segment(roads.nodes[e.a],roads.nodes[e.b])){assert(meta.bridge&&bridgeIds.has(meta.id)&&meta.name.includes('橋'));bridgeEdges++}}
assert(bridgeEdges>0);
let valid=0,approaches=0;for(const r of data.records){const p=mapPosition(r);if(p){valid++;if(roads.snap(p.x,p.z))approaches++}}
assert.equal(valid,940);assert.equal(approaches,921);
for(const area of AREAS){const tour=locateTour(makeTour(data.records.filter(r=>mapPosition(r)),area),area,roads),spawn=mapSpawn(tour);assert(roads.isOnRoad(spawn),area);for(const target of tour){assert.deepEqual({x:target.x,z:target.z},mapPosition(target.record));if(!target.approach)continue;assert(roads.isOnRoad(target.approach));const path=roads.path(spawn,target.approach);if(path)walk(roads,spawn,path)}for(let direction=0;direction<8;direction++){const actor={...spawn};for(let step=0;step<80;step++){roads.manual(actor,Math.cos(direction*Math.PI/4),Math.sin(direction*Math.PI/4),.18);assert(roads.isOnRoad(actor))}}}
const get=id=>{const p=mapPosition(data.records.find(r=>r.id===id));return roads.snap(p.x,p.z)};
const magong=get('sight-3'),temple=get('temple-8'),north=get('temple-76');
const cityPath=roads.path(magong,temple);assert(cityPath.length>=8&&cityPath.distance>5&&cityPath.distance<9);walk(roads,magong,cityPath);
const northPath=roads.path(magong,north);assert(northPath&&northPath.length>100);walk(roads,magong,northPath);
assert.equal(roads.path(magong,get('temple-179')),null,'Magong must not walk across the sea to Wang-an');
const request=[];await loadRoads(async file=>{request.push(file);return new Response(JSON.stringify(graph))});assert.deepEqual(request,[ROAD_FILE]);await assert.rejects(loadRoads(async()=>new Response('',{status:404})),/未載入/);
assert.throws(()=>new RoadNavigation({...graph,version:'wrong'},coast),/版本/);
const geometry=roads.geometry([magong,...cityPath]);assert(geometry.v.length>0&&geometry.v.every(Number.isFinite));
const game=fs.readFileSync(new URL('../dist/game.js',import.meta.url),'utf8');assert(game.includes('navigation.manual(player'));const travel=fs.readFileSync(new URL('../dist/travel.js',import.meta.url),'utf8');assert(travel.includes('roads.advance(player')); assert(!game.includes('allowAreaTransfer'));assert(!game.includes('new LandNavigation'));assert(!game.includes('切換至此地道路起點'));assert(!game.includes('destination-start'));assert(game.includes('沿道路距離'));assert(game.includes('2021-12-17'));
console.log(`PASS roads: U-shaped detour, disconnected roads, partial edges, short road-distance interaction, road-locked joystick/reverse/dead ends; ${roads.nodes.length} source nodes/${roads.edges.length} edges, ${bridgeEdges} verified bridge segments; all six area starts, Magong city turns and Northliao route. Browser UI was not tested.`);
