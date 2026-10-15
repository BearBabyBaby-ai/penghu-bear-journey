// Rebuild from decode-road-tiles.py output. Never connect nearby unrelated ways.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {Coastline} from '../dist/coastline.js';
import {geoToWorld} from '../dist/map.js';
const input=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const coast=new Coastline(JSON.parse(fs.readFileSync(new URL('../dist/geo/penghu-land-20260407.geojson',import.meta.url))));
const allowed=new Set(['secondary','secondary_link','tertiary','tertiary_link','unclassified','residential','living_street','service','pedestrian','footway','path','steps','track','cycleway','road']);
// The archive omits bridge tags. These explicitly named OSM bridge ways are
// the only permitted exception to the administrative land polygon.
const bridges=new Set(['way/60878925','way/60879113','way/60879110','way/294281818','way/294281819']);
const nodes=[],edges=[],roads=[],nodeIds=new Map(),roadIds=new Map(),edgeIds=new Set();
let rejected=0;
function node(key,coord){if(!nodeIds.has(key)){nodeIds.set(key,nodes.length);nodes.push(coord)}return nodeIds.get(key)}
for(const f of input.features){
 const p=f.properties;if(!allowed.has(p.highway)||['no','private'].includes(p.access)||p.foot==='no')continue;
 const bridge=bridges.has(p.id)&&p.name?.includes('橋');
 const roadKey=[p.id,p.highway,p.name||'',bridge?'bridge':''].join('|');
 if(!roadIds.has(roadKey)){roadIds.set(roadKey,roads.length);roads.push({id:p.id,name:p.name||'',highway:p.highway,bridge:!!bridge})}
 const road=roadIds.get(roadKey),coords=f.geometry.coordinates;
 for(let i=1;i<coords.length;i++){
  const a=coords[i-1],b=coords[i],ka=f.grid[i-1].join(':'),kb=f.grid[i].join(':');if(ka===kb)continue;
  if(!bridge&&!coast.segment(geoToWorld(...a),geoToWorld(...b))){rejected++;continue}
  const ai=node(ka,a),bi=node(kb,b),key=ai<bi?ai+':'+bi:bi+':'+ai;if(edgeIds.has(key))continue;
  edgeIds.add(key);edges.push([ai,bi,road]);
 }
}
const graph={version:'osm-penghu-20211217-v1',source:input.properties,nodes,edges,roads};
const output=process.argv[3]||new URL('../dist/geo/penghu-roads-20211217.json',import.meta.url);
fs.writeFileSync(output,JSON.stringify(graph));
console.log(JSON.stringify({nodes:nodes.length,edges:edges.length,roads:roads.length,rejected,sha256:crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex')}));
