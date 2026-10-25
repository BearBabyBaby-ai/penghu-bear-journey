// 立體建築試驗：資料檔在澎湖範圍內、三角化面積正確、地點標記不被建物包住
import fs from 'node:fs';import assert from 'node:assert/strict';
import {triangulate} from '../dist/buildings.js';
import {MAP,geoToWorld} from '../dist/map.js';
const data=JSON.parse(fs.readFileSync('dist/geo/penghu-buildings-20261021.json','utf8'));
assert.ok(data.buildings.length>7000);
const area=(xs,zs,idx)=>{let s=0;for(let i=0;i<idx.length;i+=3){const [a,b,c]=idx.slice(i,i+3);s+=Math.abs((xs[b]-xs[a])*(zs[c]-zs[a])-(zs[b]-zs[a])*(xs[c]-xs[a]))/2}return s};
let bad=0;
for(const [h,,,...f] of data.buildings){
  assert.ok(h>0&&h<80);const xs=[],zs=[];for(let i=0;i<f.length;i+=2){xs.push(f[i]);zs.push(f[i+1]);assert.ok(f[i]>MAP.minX&&f[i]<MAP.maxX&&f[i+1]>MAP.minZ&&f[i+1]<MAP.maxZ)}
  let poly=0;for(let i=0;i<xs.length;i++){const j=(i+1)%xs.length;poly+=xs[i]*zs[j]-xs[j]*zs[i]}poly=Math.abs(poly)/2;
  if(Math.abs(area(xs,zs,triangulate(xs,zs))-poly)>poly*.02+1e-9)bad++;
}
assert.ok(bad/data.buildings.length<.005,`三角化失敗 ${bad}`);
const inside=(p,xs,zs)=>{let c=false;for(let i=0,j=xs.length-1;i<xs.length;j=i++)if((zs[i]>p.z)!==(zs[j]>p.z)&&p.x<(xs[j]-xs[i])*(p.z-zs[i])/(zs[j]-zs[i])+xs[i])c=!c;return c};
const recs=JSON.parse(fs.readFileSync('dist/data.json','utf8')).records.filter(r=>Number.isFinite(r.lat)).slice(0,200).map(r=>geoToWorld(r.lng,r.lat));
let covered=0;for(const [,,,...f] of data.buildings){const xs=[],zs=[];for(let i=0;i<f.length;i+=2){xs.push(f[i]);zs.push(f[i+1])}if(recs.some(p=>inside(p,xs,zs)))covered++}
assert.equal(covered,0);
console.log(`PASS buildings: ${data.buildings.length} footprints inside the map, roof triangulation area matches (${bad} fallback), no place marker enclosed. Experiment only.`);
