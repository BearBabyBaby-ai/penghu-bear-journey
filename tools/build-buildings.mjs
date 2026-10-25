// 立體建築試驗：把 Overture Maps 建物輪廓（含 OpenStreetMap 與 Shi et al. 東亞建物資料）轉成遊戲世界座標。
// 輪廓座標不平移，只換算成遊戲的 EPSG:3857 世界座標；原始資料幾乎沒有高度，樓高為依類別與面積推估的示意值。
// 地點標記所在的建物不輸出，避免把標記包在建物裡面。
import fs from 'node:fs';
import zlib from 'node:zlib';
import {geoToWorld,WORLD_METRES} from '../dist/map.js';

const SRC='sources/buildings/overture-buildings-2026-10-21.json.gz';
const OUT='dist/geo/penghu-buildings-20261021.json';
const src=JSON.parse(zlib.gunzipSync(fs.readFileSync(SRC)));
const places=JSON.parse(fs.readFileSync('dist/data.json','utf8')).records.filter(r=>Number.isFinite(r.lat)&&Number.isFinite(r.lng));

const inside=(pt,ring)=>{let c=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [xi,yi]=ring[i],[xj,yj]=ring[j];if((yi>pt[1])!==(yj>pt[1])&&pt[0]<(xj-xi)*(pt[1]-yi)/(yj-yi)+xi)c=!c}return c};
// 穩定的偽亂數（同一棟每次都同高）
const hash=s=>{let h=2166136261;for(const ch of s){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return (h>>>0)/4294967295};
const FLOOR=3.3;
function estimate(p,area,key){
  if(p.height>0)return {h:p.height,est:false};
  if(p.floors>0)return {h:p.floors*FLOOR,est:false};
  const r=hash(key),c=p.class||'';
  if(/shelter|hut|roof|toilets|bunker|shed|kiosk/.test(c))return {h:3,est:true};
  if(/storage_tank/.test(c))return {h:8,est:true};
  if(/temple|church|shrine/.test(c)||p.subtype==='religious')return {h:9+r*3,est:true};
  if(/school|office|hotel|dormitory|public|library|hospital/.test(c))return {h:(3+Math.floor(r*2))*FLOOR,est:true};
  if(area<30)return {h:FLOOR,est:true};
  if(area<120)return {h:(2+Math.floor(r*2))*FLOOR,est:true};
  if(area<600)return {h:(2+Math.floor(r*3))*FLOOR,est:true};
  return {h:(2+Math.floor(r*2))*FLOOR,est:true};
}

const out=[];let skipped=0,tiny=0;
for(const f of src.features){
  const ring=f.geometry.coordinates[0].slice(0,-1);if(ring.length<3)continue;
  if(places.some(r=>inside([r.lng,r.lat],ring))){skipped++;continue}
  let pts=ring.map(([lng,lat])=>geoToWorld(lng,lat));
  // 世界座標的有號面積（單位²），換成平方公尺
  let a=0;for(let i=0;i<pts.length;i++){const p=pts[i],q=pts[(i+1)%pts.length];a+=p.x*q.z-q.x*p.z}a/=2;
  const area=Math.abs(a)*WORLD_METRES*WORLD_METRES;if(area<8){tiny++;continue}
  if(a>0)pts.reverse(); // 統一方向，讓牆面法線朝外
  const c=ring.reduce((s,p)=>[s[0]+p[0]/ring.length,s[1]+p[1]/ring.length],[0,0]);
  const {h,est}=estimate(f.properties,area,c[0].toFixed(6)+','+c[1].toFixed(6));
  const kind=f.properties.subtype==='religious'||/temple/.test(f.properties.class||'')?1:0;
  out.push([Math.round(h*10)/10,kind,est?1:0,...pts.flatMap(p=>[Math.round(p.x*1000)/1000,Math.round(p.z*1000)/1000])]);
}
fs.writeFileSync(OUT,JSON.stringify({
  version:'penghu-buildings-20261021-exp1',
  note:'建物輪廓：Overture Maps 2026-10-21（OpenStreetMap ODbL、Shi et al. 2023 CC BY 4.0）；高度多為推估示意值',
  unitMetres:WORLD_METRES,
  format:'[高度公尺, 類型(1=廟宇), 推估(1=是), x0,z0,x1,z1,…]',
  buildings:out
}));
console.log(`建物 ${out.length} 棟（地點所在略過 ${skipped}、過小略過 ${tiny}），${(fs.statSync(OUT).size/1024).toFixed(0)} KB`);
