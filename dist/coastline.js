import {geoToWorld,insideMap} from './map.js?v=20261015-travel8';
export const LAND_FILE='geo/penghu-land-20260407.geojson';
export const GRID_FILE='geo/penghu-grid-20260407.json';
export const LAND_VERSION='nlsc-penghu-20260407-v1';
export class Coastline{
 constructor(geo){
  const polygons=geo.geometry?.type==='MultiPolygon'?geo.geometry.coordinates:geo.geometry?.type==='Polygon'?[geo.geometry.coordinates]:null;
  if(!polygons?.length)throw Error('陸域多邊形資料不完整');
  this.rings=polygons.flatMap(p=>p.map(r=>{const points=r.map(([lng,lat])=>geoToWorld(lng,lat));return{points,minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minZ:Math.min(...points.map(p=>p.z)),maxZ:Math.max(...points.map(p=>p.z))}}));
  this.meta=geo.properties||{};this.bin=2;this.edges=[];this.edgeRows=new Map();this.edgeCells=new Map();
  const put=(map,key,id)=>{let list=map.get(key);if(!list){list=[];map.set(key,list)}list.push(id)};
  for(const r of this.rings){const p=r.points;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[j],b=p[i];if(a.x===b.x&&a.z===b.z)continue;const id=this.edges.length;this.edges.push([a,b]);const x0=Math.floor(Math.min(a.x,b.x)/this.bin),x1=Math.floor(Math.max(a.x,b.x)/this.bin),z0=Math.floor(Math.min(a.z,b.z)/this.bin),z1=Math.floor(Math.max(a.z,b.z)/this.bin);for(let z=z0;z<=z1;z++){put(this.edgeRows,z,id);for(let x=x0;x<=x1;x++)put(this.edgeCells,x+':'+z,id)}}}
 }
 segment(a,b,land=true){
  if(!insideMap(a.x,a.z)||!insideMap(b.x,b.z)||this.isLand(a.x,a.z)!==land||this.isLand(b.x,b.z)!==land)return false;
  const dx=b.x-a.x,dz=b.z-a.z,x0=Math.floor(Math.min(a.x,b.x)/this.bin),x1=Math.floor(Math.max(a.x,b.x)/this.bin),z0=Math.floor(Math.min(a.z,b.z)/this.bin),z1=Math.floor(Math.max(a.z,b.z)/this.bin);
  const hits=(id)=>{const[p,q]=this.edges[id],ex=q.x-p.x,ez=q.z-p.z,den=dx*ez-dz*ex;if(Math.abs(den)<1e-12)return false;const qx=p.x-a.x,qz=p.z-a.z,t=(qx*ez-qz*ex)/den,u=(qx*dz-qz*dx)/den;return t>1e-9&&t<1-1e-9&&u>=0&&u<=1};
  if((x1-x0+1)*(z1-z0+1)>this.edgeCells.size){for(let id=0;id<this.edges.length;id++)if(hits(id))return false}
  else{const visited=new Set();for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++)for(const id of this.edgeCells.get(x+':'+z)||[]){if(visited.has(id))continue;visited.add(id);if(hits(id))return false}}
  return true;
 }
 seaSegment(a,b){return this.segment(a,b,false)}
 isLand=(x,z)=>{
  if(!insideMap(x,z))return false;let inside=false;
  // Spatial row index preserves the same even/odd test, including ocean holes.
  for(const id of this.edgeRows.get(Math.floor(z/this.bin))||[]){const[a,b]=this.edges[id];if((a.z>z)!==(b.z>z)&&x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x)inside=!inside}return inside;
 };

}
export function validateCoastline(geo){
 const c=new Coastline(geo),land=geoToWorld(119.6704986,23.5970241),sea=geoToWorld(119.55,23.60);
 if(!c.isLand(land.x,land.z)||c.isLand(sea.x,sea.z))throw Error('內建陸域資料檢核未通過，請重新載入。');return c;
}
export async function loadTerrain(fetcher=fetch){
 const [landResponse,gridResponse]=await Promise.all([fetcher(LAND_FILE),fetcher(GRID_FILE)]);
 if(!landResponse.ok||!gridResponse.ok)throw Error('內建陸域檔案未載入，請按重試。');
 const [text,grid]=await Promise.all([landResponse.text(),gridResponse.json()]);const geo=JSON.parse(text);
 if(geo.properties?.version!==LAND_VERSION||grid.sourceVersion!==LAND_VERSION)throw Error('陸域與導航資料版本不一致，請重新載入。');
 if(globalThis.crypto?.subtle){const bytes=new TextEncoder().encode(text),hash=await globalThis.crypto.subtle.digest('SHA-256',bytes),hex=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');if(hex!==grid.sourceSHA256)throw Error('陸域與導航資料不相符，請重新載入。')}
 validateCoastline(geo);return{geo,grid};
}
