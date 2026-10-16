// 由 sources/enforcement/ 的澎湖縣警察局官方 CSV 產生遊戲內建檔與試算表「測速與科技執法」的列。
// 只把原始資料中對調的經緯度欄位換回來；座標數值不改、不吸附道路。
import fs from 'node:fs';
import {parseCSV} from '../dist/ferry-sheet.js';
import {normalizeRecord,ENFORCE_HEADERS,groupPoints} from '../dist/enforcement.js';
const READ_AT='2026-10-16';
const SRC={
 speed:{file:'sources/enforcement/fixed-speed-pb140320.csv',label:'固定測速',page:'https://opendata.penghu.gov.tw/dataset/pb140320-2022-07-14-1657785496',updated:'2026-08-13'},
 tech:{file:'sources/enforcement/tech-enforcement-pb140300.csv',label:'科技執法',page:'https://opendata.penghu.gov.tw/dataset/pb140300-2025-02-21-1740105639',updated:'2026-08-12'}
};
// 已知原始資料問題（見 sources/enforcement/SOURCE.md）
const SUSPECT={'固定測速-21':'原始座標（23.555, 119.65828）位於湖西鄉東南側，與地名「通梁」（白沙鄉）不符，疑似原始資料錯誤；遊戲顯示但不提醒'};
const records=[];
for(const [key,s] of Object.entries(SRC)){
 const [head,...rows]=parseCSV(fs.readFileSync(s.file,'utf8'));const col=k=>head.indexOf(k),get=(r,k)=>col(k)<0?'':r[col(k)].trim();
 for(const r of rows){
  const raw={type:s.label,no:get(r,'設備編號'),name:get(r,'設置地點'),area:get(r,'行政區'),lat:get(r,'座標緯度'),lng:get(r,'座標經度'),limit:get(r,'速限'),direction:get(r,'拍攝方向'),items:get(r,'取締項目'),techKind:get(r,'科技執法種類'),dept:get(r,'管轄分局')||get(r,'轄區分局'),model:get(r,'型式'),source:s.page,updated:s.updated,date:READ_AT};
  const n=normalizeRecord(raw),notes=[];if(n.swapped)notes.push('原始資料緯度、經度兩欄對調，已依數值範圍換回（數值未改）');const sus=SUSPECT[`${s.label}-${raw.no}`];if(sus)notes.push(sus);
  records.push({...raw,lat:n.lat,lng:n.lng,limit:n.limit,note:notes.join('；')});
 }
}
const out={version:'penghu-enforcement-20261016-v1',readAt:READ_AT,provider:'澎湖縣政府警察局交通警察隊（澎湖縣政府開放資料平台）',license:'政府資料開放授權條款',sources:Object.values(SRC).map(({label,page,updated})=>({label,page,updated})),records};
fs.writeFileSync('dist/geo/penghu-enforcement-20261016.json',JSON.stringify(out,null,1)+'\n');
const sheet=[ENFORCE_HEADERS,...records.map(r=>[r.type,Number(r.no),r.name,r.area,r.lat,r.lng,r.limit??'',r.direction,r.items,r.techKind,r.dept,r.model,r.source,r.updated,r.date,r.note])];
fs.writeFileSync('sources/enforcement/sheet-rows.json',JSON.stringify(sheet));
const pts=groupPoints(records.map(normalizeRecord));
console.log(records.length,'records,',pts.length,'points,',pts.filter(p=>p.tech).length,'tech,',pts.filter(p=>p.suspect).length,'suspect,',records.filter(r=>r.note.includes('對調')).length,'swapped');
