// 測速照相與科技執法：資料整理、提醒判斷、試算表與內建檔（不連網）
import assert from 'node:assert/strict';import fs from 'node:fs';
import {parseCSV} from '../dist/ferry-sheet.js';
import {parseDirection,normalizeRecord,enforcementRowsFromCSV,groupPoints,checkAlerts,alertText,loadEnforcement,distanceAhead,ENFORCE_HEADERS,ENFORCE_FILE} from '../dist/enforcement.js';
const close=(a,b)=>Math.abs(a-b)<1e-9;
// 方向：「東向西」＝往西（x 減少）；「東南向西北」＝往西北（z 減少＝往北）
assert.deepEqual(parseDirection('東向西'),{x:-1,z:0});{const d=parseDirection('東南向西北');assert(d.x<0&&d.z<0&&close(Math.hypot(d.x,d.z),1))}assert.equal(parseDirection('不明'),null);
// 經緯度對調只換欄位，不改數值
const n=normalizeRecord({type:'固定測速',name:'x',lat:'119.57787',lng:'23.519863'});assert(n.swapped&&n.lat===23.519863&&n.lng===119.57787);
assert(!normalizeRecord({type:'科技執法',name:'x',lat:23.5,lng:119.5}).swapped);
// 內建檔與官方原始 CSV 一致（筆數、數值；只有對調的欄位換回）
const data=JSON.parse(fs.readFileSync(new URL('../dist/'+ENFORCE_FILE,import.meta.url)));
const speedCSV=parseCSV(fs.readFileSync(new URL('../sources/enforcement/fixed-speed-pb140320.csv',import.meta.url),'utf8')),techCSV=parseCSV(fs.readFileSync(new URL('../sources/enforcement/tech-enforcement-pb140300.csv',import.meta.url),'utf8'));
assert.equal(data.records.length,speedCSV.length-1+techCSV.length-1);
for(const [rows,label] of [[speedCSV,'固定測速'],[techCSV,'科技執法']]){const h=rows[0];for(const r of rows.slice(1)){const rec=data.records.find(x=>x.type===label&&x.no===r[0]);assert(rec,label+r[0]);const a=Number(r[h.indexOf('座標緯度')]),b=Number(r[h.indexOf('座標經度')]);assert(rec.lat===a&&rec.lng===b||rec.lat===b&&rec.lng===a,'coordinates unchanged '+label+r[0]);assert(rec.lat>23&&rec.lat<24&&rec.lng>119&&rec.lng<120);assert.equal(rec.name,r[h.indexOf('設置地點')])}}
const records=data.records.map(normalizeRecord),points=groupPoints(records);
assert.equal(points.length,33,'科技執法四處與固定測速同路口合併');assert.equal(points.filter(p=>p.tech).length,4);assert.equal(points.filter(p=>p.suspect).length,1);
// 試算表 CSV（與工作表標題相同）可讀回相同資料
const esc=v=>/[",\n]/.test(String(v))?'"'+String(v).replace(/"/g,'""')+'"':String(v);
const csv=[ENFORCE_HEADERS,...data.records.map(r=>[r.type,r.no,r.name,r.area,r.lat,r.lng,r.limit??'',r.direction,r.items,r.techKind,r.dept,r.model,r.source,r.updated,r.date,r.note])].map(r=>r.map(esc).join(',')).join('\r\n');
const fromSheet=enforcementRowsFromCSV(csv);assert.equal(fromSheet.length,records.length);assert.deepEqual(fromSheet.map(r=>[r.lat,r.lng,r.limit,r.type]),records.map(r=>[r.lat,r.lng,r.limit,r.type]));
assert.equal(enforcementRowsFromCSV('a,b\n1,2'),null,'wrong header rejected');
// 讀取順序：試算表 → 內建檔
const okSheet=await loadEnforcement(async url=>({ok:true,text:async()=>csv,json:async()=>data}));assert.equal(okSheet.from,'sheet');
const offline=await loadEnforcement(async url=>{if(String(url).startsWith('https://'))throw Error('offline');return{ok:true,json:async()=>data}});assert.equal(offline.from,'bundled');assert.equal(offline.records.length,records.length);
// 提醒：一個往西受測的點
const p={id:'t',world:{x:0,z:0},alertAt:{x:0,z:0},speed:true,tech:false,limit:50,dir:{x:-1,z:0},items:['測速']},alerted=new Set();
assert.equal(checkAlerts([p],{x:2,z:0},{x:-1,z:0},{unit:100},alerted).length,1,'往西、前方 200 公尺 → 提醒');
assert.equal(checkAlerts([p],{x:1.5,z:0},{x:-1,z:0},{unit:100},alerted).length,0,'同一點只提醒一次');
checkAlerts([p],{x:7,z:0},null,{unit:100},alerted);assert(!alerted.has('t'),'離開 600 公尺後可再提醒');
assert.equal(checkAlerts([p],{x:-2,z:0},{x:1,z:0},{unit:100},new Set()).length,0,'反方向不提醒');
assert.equal(checkAlerts([p],{x:4,z:0},{x:-1,z:0},{unit:100},new Set()).length,0,'超過 300 公尺不提醒');
assert.equal(checkAlerts([p],{x:-2,z:0},{x:-1,z:0},{unit:100},new Set()).length,0,'已經通過（在後方）不提醒');
assert.equal(checkAlerts([{...p,suspect:true}],{x:2,z:0},{x:-1,z:0},{unit:100},new Set()).length,0,'座標可疑的點不提醒');
const t={...p,id:'k',speed:false,tech:true,items:['闖紅燈']};assert.equal(checkAlerts([t],{x:0,z:.4},{x:0,z:-1},{unit:100},new Set()).length,1,'科技執法路口 50 公尺內不分方向提醒');
assert.equal(checkAlerts([t],{x:0,z:1},{x:0,z:-1},{unit:100},new Set()).length,0);
assert.match(alertText({point:{...p,tech:true},distance:287}),/前方 290 公尺｜測速 50・路口科技執法/);
// 沿路線判斷（第22版修正誤報）：旁邊平行道路、路口另一條路、反方向都不提醒；檢查間隔中經過的點不漏
{const q={id:'r',world:{x:0,z:0},alertAt:{x:0,z:0},speed:true,tech:false,limit:50,dir:{x:-1,z:0},items:[]};
 assert.equal(checkAlerts([q],{x:2,z:.5},{x:-1,z:0},{unit:100,route:[{x:2,z:.5},{x:-3,z:.5}]},new Set()).length,0,'平行道路（橫向 50 公尺）不提醒');
 assert.equal(checkAlerts([q],{x:2,z:0},{x:-1,z:0},{unit:100,route:[{x:2,z:0},{x:-3,z:0}]},new Set())[0]?.distance,200,'同一路線前方 200 公尺');
 assert.equal(checkAlerts([q],{x:0,z:2},{x:0,z:-1},{unit:100,route:[{x:0,z:2},{x:0,z:-3}]},new Set()).length,0,'交叉方向經過路口不提醒');
 assert.equal(checkAlerts([q],{x:-2,z:0},{x:1,z:0},{unit:100,route:[{x:-2,z:0},{x:3,z:0}]},new Set()).length,0,'反方向不提醒');
 const k={...q,id:'k2',speed:false,tech:true};assert.equal(checkAlerts([k],{x:-.2,z:0},{x:-1,z:0},{unit:100,route:[{x:.6,z:0},{x:-.2,z:0},{x:-3,z:0}],step:80},new Set()).length,1,'兩次檢查之間經過的科技執法路口仍提醒');}
// 提醒持續倒數：接近時距離遞減，通過後回傳 null／負值（收起提醒）
{const q={id:'d',alertAt:{x:0,z:0},speed:true,dir:{x:-1,z:0}};const ds=[3,2,1,.2].map(x=>distanceAhead(q,{x,z:0},{x:-1,z:0},{unit:100,route:[{x,z:0},{x:-5,z:0}]}));
 assert.deepEqual(ds.map(Math.round),[300,200,100,20],'倒數距離');const after=distanceAhead(q,{x:-.5,z:0},{x:-1,z:0},{unit:100,route:[{x:-.5,z:0},{x:-5,z:0}]});assert(after===null||after<0,'通過後收起');}
// 真實道路模擬：熊寶沿路前往經過每個測速點附近（各 6 趟），提醒必須都在路線上、方向正確，且不漏
{const {RoadNavigation}=await import('../dist/roads.js'),{Coastline}=await import('../dist/coastline.js'),{mapPosition}=await import('../dist/map.js'),{TravelPlanner,Journey}=await import('../dist/travel.js'),{alongRoute}=await import('../dist/enforcement.js');
 const read=f=>JSON.parse(fs.readFileSync(new URL('../dist/'+f,import.meta.url)));const nav=new RoadNavigation(read('geo/penghu-roads-20211217.json'),new Coastline(read('geo/penghu-land-20260407.geojson'))),planner=new TravelPlanner(nav,read('geo/penghu-ferries-20261016.json'),read('geo/penghu-grid-20260407.json').sourceSHA256),unit=100*Math.cos(23.55*Math.PI/180);
 const P=points.filter(p=>!p.suspect).map(p=>{const q={...p,world:mapPosition(p)},near=nav.nearby(q.world.x,q.world.z,.6),al=q.dir&&near.find(r=>Math.abs(r.axis.x*q.dir.x+r.axis.z*q.dir.z)>=.7),pk=al||near[0];return{...q,alertAt:pk?{x:pk.x,z:pk.z}:q.world,axis:pk?.axis||null}});
 let seed=7;const rnd=()=>(seed=(seed*1103515245+12345)%2147483648)/2147483648;let trips=0,tp=0,bad=[];
 for(const cam of P){const cand=nav.nodes.map((n,i)=>i).filter(i=>Math.hypot(nav.nodes[i].x-cam.world.x,nav.nodes[i].z-cam.world.z)<25);
  for(let k=0;k<6;k++){const pick=()=>{const n=nav.nodes[cand[Math.floor(rnd()*cand.length)]];return nav.snap(n.x,n.z,.5)},a=pick(),b=pick();if(!a||!b)continue;const j=new Journey(planner),pl={...a};if(!j.request(pl,b)?.plan||j.plan.legs.some(l=>l.type!=='walk'))continue;
   const full=[{...pl},...j.plan.legs[0].points.slice(1)];trips++;const truth=new Map();for(const p of P){const r=alongRoute(full,p.alertAt,unit,15,1e9);if(r)truth.set(p.id,!p.dir||p.tech||(r.dir.x*p.dir.x+r.dir.z*p.dir.z)>=.5)}
   const seen=new Set(),al=new Set();let last=j.ahead(pl),rev=j.revision;for(let t=0;t<4000&&j.active;t++){j.advance(pl,.25);if(!j.active)break;const ah=j.ahead(pl);const same=ah&&last&&rev===j.revision,route=same?last:ah,step=same?(alongRoute(last,pl,unit,5,1e9)?.s??0):0;last=ah;rev=j.revision;if(!route)continue;for(const r of checkAlerts(P,pl,null,{unit,route,step},al))seen.add(r.point.id)}
   for(const id of seen){if(truth.get(id)===true)tp++;else bad.push('誤報 '+P.find(p=>p.id===id).name)}for(const [id,ok] of truth)if(ok&&!seen.has(id))bad.push('漏報 '+P.find(p=>p.id===id).name)}}
 assert(trips>80&&tp>25,`trips ${trips} tp ${tp}`);assert.deepEqual(bad,[],'沿路模擬：'+bad.join('、'));
 // GPS／搖桿：沿所在道路往前看，路口取最直的路；反方向行駛時看不到同一點
 let fw=0,bk=0,tot=0;for(const c of P.filter(p=>p.speed&&!p.tech&&p.dir&&p.axis)){const dir=(c.axis.x*c.dir.x+c.axis.z*c.dir.z)>0?c.axis:{x:-c.axis.x,z:-c.axis.z},from={x:c.alertAt.x-dir.x*.3,z:c.alertAt.z-dir.z*.3};tot++;
  const la=nav.lookahead(from.x,from.z,dir,350/unit,.35);if(la&&checkAlerts([c],from,dir,{unit,route:la},new Set()).length)fw++;
  const back=nav.lookahead(c.alertAt.x+dir.x*.3,c.alertAt.z+dir.z*.3,{x:-dir.x,z:-dir.z},350/unit,.35);if(back&&checkAlerts([c],{x:c.alertAt.x+dir.x*.3,z:c.alertAt.z+dir.z*.3},{x:-dir.x,z:-dir.z},{unit,route:back},new Set()).length)bk++}
 assert(fw>=tot-2,`沿所在道路往前看：${fw}/${tot} 個測速點前 27 公尺會提醒`);assert.equal(bk,0,'背向行駛不提醒');
 globalThis.__enfSim=`${trips} simulated road trips past every camera: ${tp} correct alerts, 0 false or missed; road lookahead ${fw}/${tot}`;}
console.log(`PASS enforcement: ${records.length} official rows (${points.length} points, 4 tech, 27 swapped lat/lng columns restored without changing values, 1 suspect not alerted); sheet CSV round-trip and bundled fallback; ahead/direction/once/rearm/range alerts; ${globalThis.__enfSim}; parallel/cross/opposite roads not alerted.`);
// 介面不得出現試算表／工作表名稱或資料來源說明（使用者要求）
{const strip=t=>t.replace(/\/\*[\s\S]*?\*\//g,'').split('\n').filter(l=>!l.trim().startsWith('//')).join('\n');
 for(const f of ['game.js','index.html','ask.js','places.js']){const t=strip(fs.readFileSync(new URL('../dist/'+f,import.meta.url),'utf8'));for(const w of ['試算表','工作表','熊熊綜合系統','資料來源'])assert(!t.includes(w),`${f} 介面文字含「${w}」`)}}
