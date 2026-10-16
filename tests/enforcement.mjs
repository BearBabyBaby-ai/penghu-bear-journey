// 測速照相與科技執法：資料整理、提醒判斷、試算表與內建檔（不連網）
import assert from 'node:assert/strict';import fs from 'node:fs';
import {parseCSV} from '../dist/ferry-sheet.js';
import {parseDirection,normalizeRecord,enforcementRowsFromCSV,groupPoints,checkAlerts,alertText,loadEnforcement,ENFORCE_HEADERS,ENFORCE_FILE} from '../dist/enforcement.js';
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
console.log(`PASS enforcement: ${records.length} official rows (${points.length} points, 4 tech, 27 swapped lat/lng columns restored without changing values, 1 suspect not alerted); sheet CSV round-trip and bundled fallback; ahead/direction/once/rearm/range alerts.`);
