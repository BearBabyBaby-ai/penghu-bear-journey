// 交通船資訊工作表：CSV 解析與欄位對應（不連網）
import assert from 'node:assert/strict';import fs from 'node:fs';
import {parseCSV,ferryRowsFromCSV,loadFerrySheet} from '../dist/ferry-sheet.js';
const csv='航線,營運單位,船名,出發港,出發港緯度,出發港經度,抵達港,抵達港緯度,抵達港經度,官方時刻表／航線資料,出發港座標依據,抵達港座標依據,遊戲說明,整理日期\r\n"馬公南海交通船碼頭 ⇄ 桶盤漁港",馬公市公所（委託營運）,桶盤之星,馬公南海交通船碼頭,23.56,119.57,桶盤漁港,23.51,119.51,https://example.gov.tw/a,"含,逗號與""引號""","第一行\n第二行",示意,2026-10-16\r\n,,,,,,,,,,,,,\r\n';
assert.equal(parseCSV(csv).length,2);
const rows=ferryRowsFromCSV(csv);assert.equal(rows.length,1);assert.equal(rows[0].vessel,'桶盤之星');assert.equal(rows[0].to,'桶盤漁港');assert.equal(rows[0].source,'https://example.gov.tw/a');
assert.equal(ferryRowsFromCSV('a,b\n1,2'),null,'wrong header rejected');
const ok=await loadFerrySheet(async()=>({ok:true,text:async()=>csv}));assert.equal(ok.length,1);
assert.equal(await loadFerrySheet(async()=>{throw Error('offline')}),null,'offline falls back to bundled routes');
// 內建航線檔的每條航線都要能在工作表格式中表達（港名一致）
const ferries=JSON.parse(fs.readFileSync(new URL('../dist/geo/penghu-ferries-20261016.json',import.meta.url)));
for(const l of ferries.links){assert(ferries.ports.some(p=>p.id===l.from)&&ferries.ports.some(p=>p.id===l.to));assert(l.operator&&l.source)}
console.log('PASS ferry-sheet: CSV quoting/newlines, header mapping, offline fallback, bundled routes carry operator and source.');
