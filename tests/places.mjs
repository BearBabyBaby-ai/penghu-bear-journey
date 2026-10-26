import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mapPlaces,placeCounts,shownPlaces,categoryKinds,labelLayout,MAP_MARKER_LABEL_Y} from '../dist/places.js';
import {AREAS,makeTour} from '../dist/model.js';
import {mapPosition,MAP,mapSpawn} from '../dist/map.js';
import {RoadNavigation} from '../dist/roads.js';
import {Coastline} from '../dist/coastline.js';
import {Engine,Geometry} from '../dist/engine.js';
const read=file=>JSON.parse(fs.readFileSync(new URL('../dist/'+file,import.meta.url)));
const data=read('data.json'),nav=new RoadNavigation(read('geo/penghu-roads-20211217.json'),new Coastline(read('geo/penghu-land-20260407.geojson')));
const places=mapPlaces(data.records,nav),withoutRoads=mapPlaces(data.records,null),counts=placeCounts(data.records);
assert.deepEqual(counts,{food:{total:608,mapped:590},sight:{total:181,mapped:181},temple:{total:188,mapped:169}});
assert.equal(places.length,940);assert.equal(withoutRoads.length,940,'Place display must not wait for road data');
assert.equal(new Set(places.map(n=>n.record.id)).size,940);
assert.equal(places.filter(n=>!n.approach).length,19,'Missing roads must not hide source places');
for(const area of AREAS){const list=places.filter(n=>n.record.area===area);assert(list.length>9,area+' must include places beyond the nine-stop sample');assert(mapSpawn(list));const oldIds=new Set(makeTour(data.records,area).map(n=>n.record.id));assert(list.some(n=>!oldIds.has(n.record.id)))}
for(const n of places)assert.deepEqual({x:n.x,z:n.z},mapPosition(n.record));
assert.equal(shownPlaces(places,{food:true,sight:true,temple:true}).length,940);
assert.equal(shownPlaces(places,{food:false,sight:false,temple:true}).length,169);
assert.equal(shownPlaces(places,{food:false,sight:true,temple:false}).length,181);
assert.equal(shownPlaces(places,{food:false,sight:false,temple:false}).length,0);
assert.equal(shownPlaces(places,{food:true,sight:true,temple:true}).length,940,'Toggling a category must not mutate its source');
// CPU projection check at real desktop/phone viewport sizes; no browser is used.
const gl=new Proxy({}, {get:(t,k)=>k==='getShaderParameter'||k==='getProgramParameter'?()=>true:k==='getAttribLocation'?()=>0:k==='getUniformLocation'?(_,name)=>name:k.startsWith('create')?()=>({}):k.toUpperCase()===k?1:()=>{}});
globalThis.window={devicePixelRatio:1};
for(const [width,height] of [[1024,795],[1440,900],[390,844],[320,568]]){
 const canvas={clientWidth:width,clientHeight:height,getContext:()=>gl},engine=new Engine(canvas);engine.focus=[(MAP.minX+MAP.maxX)/2,0,(MAP.minZ+MAP.maxZ)/2];engine.angle=0;engine.tilt=1.12;engine.zoom=Math.max(MAP.height*Math.sin(engine.tilt)/2,MAP.width/(width/height)/2)*1.12;engine.render(0,new Geometry());
 const layout=labelLayout(places,p=>engine.project(p),width,height,engine.zoom,null,MAP_MARKER_LABEL_Y);assert(layout.size<940,`${width}x${height}: dense pins must be grouped`);assert.equal([...layout.values()].reduce((sum,p)=>sum+p.members.length,0),940);assert.equal(new Set([...layout.values()].flatMap(p=>p.members.map(n=>n.record.id))).size,940,'Every source place stays accessible exactly once');
 for(const n of places){const p=layout.get(n.index);if(!p)continue;const expected=engine.project([n.x,MAP_MARKER_LABEL_Y,n.z]);assert.deepEqual({x:p.x,y:p.y},expected);assert(p.compact)}
 const target=places[0],selected=labelLayout(places,p=>engine.project(p),width,height,engine.zoom,target.record.id,MAP_MARKER_LABEL_Y);assert(!selected.get(target.index).compact,'The selected name must remain readable even at overview scale');
}
// Crowding may shorten names but must retain all co-located pins for selection.
const overlap=places.slice(0,4),layout=labelLayout(overlap,()=>({x:100,y:100}),390,844,12,overlap[2].record.id);assert.equal(layout.size,2);assert.equal([...layout.values()].reduce((sum,p)=>sum+p.members.length,0),4);assert(!layout.get(overlap[2].index).compact);assert.equal([...layout.values()].filter(p=>!p.compact).length,1);
assert.equal(labelLayout(overlap,()=>({x:-100,y:-100}),390,844,12,null).size,0);
assert.equal(data.records.length,977,'Unlocated temples remain available in the complete atlas');
assert.deepEqual(categoryKinds(),{food:false,sight:true,temple:false});for(const kind of ['food','sight','temple'])assert.equal(shownPlaces(places,categoryKinds(kind)).length,counts[kind].mapped);assert.equal(shownPlaces(places,categoryKinds('all')).length,940);
console.log('PASS places: all 940 georeferenced records, all six regions beyond nine-stop samples, all 19 roadless places retained, reversible category filters, exact marker anchors and crowded/selected names at desktop and phone projection sizes. Browser layout was not tested.');
