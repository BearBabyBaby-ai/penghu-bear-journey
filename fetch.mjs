// 下載澎湖建物輪廓（OSM Overpass 與 Microsoft Global ML Building Footprints），只取澎湖範圍
import fs from 'node:fs';import zlib from 'node:zlib';
const logs=[];const _l=console.log;console.log=(...a)=>{logs.push(a.join(' '));_l(...a)};process.on('exit',()=>fs.writeFileSync('data/log.txt',logs.join('\n')));
const S=23.1,W=119.3,N=23.85,E=119.75;
fs.mkdirSync('data',{recursive:true});
// OSM
const q=`[out:json][timeout:300];(way["building"](${S},${W},${N},${E});relation["building"](${S},${W},${N},${E}););out geom tags;`;
for(const host of ['https://overpass-api.de/api/interpreter','https://overpass.private.coffee/api/interpreter','https://maps.mail.ru/osm/tools/overpass/api/interpreter','https://overpass.kumi.systems/api/interpreter']){
  try{const r=await fetch(host,{method:'POST',body:'data='+encodeURIComponent(q),headers:{'content-type':'application/x-www-form-urlencoded','user-agent':'penghu-bear-journey-experiment/1.0 (github.com/BearBabyBaby-ai)'}});
    if(!r.ok){console.log('osm',host,r.status,(await r.text()).slice(0,300));continue}
    const j=await r.json();fs.writeFileSync('data/osm-buildings.json.gz',zlib.gzipSync(JSON.stringify(j)));console.log('osm elements',j.elements.length);break}catch(e){console.log('osm err',host,e.message)}
}
// Microsoft
function quadkey(x,y,z){let k='';for(let i=z;i>0;i--){let d=0;const m=1<<(i-1);if(x&m)d++;if(y&m)d+=2;k+=d}return k}
const tile=(lat,lng,z)=>{const n=2**z,x=Math.floor((lng+180)/360*n),r=lat*Math.PI/180,y=Math.floor((1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*n);return{x,y}};
const keys=new Set();const a=tile(N,W,9),b=tile(S,E,9);for(let x=a.x;x<=b.x;x++)for(let y=a.y;y<=b.y;y++)keys.add(quadkey(x,y,9));
console.log('quadkeys',[...keys]);
const links=(await (await fetch('https://minedbuildings.z5.web.core.windows.net/global-buildings/dataset-links.csv')).text()).trim().split('\n').slice(1).map(l=>l.split(','));
console.log('ms taiwan rows',links.filter(l=>/taiwan/i.test(l[0])).length,links.filter(l=>/taiwan/i.test(l[0])).slice(0,5).map(l=>l[1]).join(' '));
const hits=links.filter(l=>keys.has(l[1]));console.log('ms files',hits.map(h=>h[0]+' '+h[1]+' '+h[4]));
const out=[];
for(const h of hits){const buf=Buffer.from(await (await fetch(h[2])).arrayBuffer());const text=zlib.gunzipSync(buf).toString();
  for(const line of text.split('\n')){if(!line.trim())continue;const f=JSON.parse(line);const c=f.geometry.coordinates[0][0];if(c[0]>=W&&c[0]<=E&&c[1]>=S&&c[1]<=N)out.push(f)}}
console.log('ms features',out.length);
fs.writeFileSync('data/ms-buildings.json.gz',zlib.gzipSync(JSON.stringify({type:'FeatureCollection',features:out})));
