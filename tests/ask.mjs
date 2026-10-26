// 問熊寶：本機文字查詢回歸測試（只用原表資料，不連外部服務）
import fs from 'node:fs';import assert from 'node:assert/strict';
import {parseAsk,askPlaces} from '../dist/ask.js';
const data=JSON.parse(fs.readFileSync(new URL('../dist/data.json',import.meta.url),'utf8'));const R=data.records;
let q=parseAsk('想去玄天上帝廟');assert.equal(q.kind,'temple');assert.equal(q.keyword,'玄天上帝');
let a=askPlaces('想去玄天上帝廟',R);assert(a.total>=10,'玄天上帝 temples found');assert(a.results.every(x=>x.record.kind==='temple'));
assert(a.results.some(x=>x.record.id==='temple-2'),'山水上帝廟 included');
a=askPlaces('想去七美',R);assert.equal(a.area,'七美鄉');assert(a.results.length>0&&a.results.every(x=>x.record.area==='七美鄉'));assert(a.summary&&a.summary.sight>0);
a=askPlaces('馬公有什麼好吃的',R);assert.equal(a.kind,'food');assert(a.results.every(x=>x.record.area==='馬公市'&&x.record.kind==='food'));
a=askPlaces('天后宮',R);assert(a.results.length&&/天后/.test(a.results[0].record.name+a.results[0].record.description));
a=askPlaces('望安的廟',R);assert(a.results.every(x=>x.record.area==='望安鄉'&&x.record.kind==='temple'));
a=askPlaces('雙心石滬',R);assert(a.results.length&&a.results[0].record.name.includes('雙心'));
a=askPlaces('完全不存在的地方xyz',R);assert.equal(a.results.length,0,'no invented places');
for(const t of ['想去七美','玄天上帝','馬公美食','附近的廟'])for(const x of askPlaces(t,R,{distanceOf:()=>1}).results)assert(R.includes(x.record),'results come from source records only');
console.log('PASS ask: local query parsing (area/category/nearby/keyword + deity aliases), 玄天上帝 temples, 七美 overview, 馬公美食, no invented places; no network or API.');
