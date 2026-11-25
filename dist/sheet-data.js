// 遊戲資料：開啟時直接讀熊熊綜合系統的五個工作表（景點、美食清單、廟宇、奎壁山摩西分海、澎湖縣-未來30天潮汐預報），
// 不在儲存庫留資料備份、不在手機另外存。地點 id 依名稱固定（景點、廟宇：區域(村里)＋名稱；美食：區域(鄉市)＋名稱），
// 試算表調整列的順序也不會影響集章；改了村里或名稱就視為新的地點。

export const BOOK='1LOr4_3ugTHvTIi4UIfgVz2atVFh2K32zh7YKrrHxTwk';
export const SHEETS={food:['美食清單',1582663006],sight:['景點',2085392869],temple:['廟宇',2137991614],sea:['奎壁山摩西分海',1122135459],forecast:['澎湖縣-未來30天潮汐預報',776158339]};

const tx=v=>String(v??'').trim();
const num=v=>{const s=tx(v).replace(/,/g,'');if(!s)return null;const n=Number(s);return Number.isFinite(n)?n:null};
/* FNV-1a 32 位元：同樣的名稱永遠得到同樣的編號 */
function hash(text){let h=0x811c9dc5;for(const ch of String(text)){h^=ch.codePointAt(0);h=Math.imul(h,0x01000193)>>>0}return h.toString(16).padStart(8,'0')}
export function placeId(kind,name,place){return `${kind}-h${hash(`${tx(place)}|${tx(name)}`)}`}
const placeOf=o=>o.kind==='food'?o.area:o.village;

const DRIVE=/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=|thumbnail\?id=)([\w-]{20,})/;
function photos(raw){
  const value=tx(raw);if(!value)return{images:[],imageLinks:[]};
  const id=(value.match(DRIVE)||[])[1];
  if(id)return{images:[{sourceURL:`https://drive.google.com/file/d/${id}/view`,driveFileId:id,src:`https://lh3.googleusercontent.com/d/${id}=w1600`,width:0,height:0}],imageLinks:[]};
  return{images:[],imageLinks:/^https?:\/\//.test(value)?[value]:[]};
}


/* parseCSV 會略過空白列；列號要對回原表，所以這裡另外保留空白列 */
function rawRows(text){
  const rows=[];let row=[],cell='',quoted=false;text=String(text||'').replace(/^﻿/,'');
  for(let i=0;i<text.length;i++){const c=text[i];
    if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++}else quoted=false}else cell+=c;continue}
    if(c==='"')quoted=true;else if(c===','){row.push(cell);cell=''}else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell=''}else cell+=c}
  if(cell!==''||row.length){row.push(cell);rows.push(row)}
  return rows;
}
function sheetRows(text){const all=rawRows(text),head=(all[0]||[]).map(s=>String(s).replace(/\s+/g,''));const col=k=>head.indexOf(k);return all.slice(1).map((r,i)=>({row:i+2,get:k=>{const c=col(k);return c<0?'':tx(r[c])}}))}

export function buildRecords(csv){
  const out=[],seen=new Map();
  const add=(kind,sheet,r,o)=>{if(!o.name)return;let id=placeId(kind,o.name,placeOf({...o,kind}));const n=(seen.get(id)||0)+1;seen.set(id,n);if(n>1)id+=`-${n}`;
    const p=photos(r.get('圖資來源'));out.push({...o,lat:num(r.get('Latitude')),lng:num(r.get('Longitude')),url:r.get('完整網址')||r.get('短網址'),id,kind,sheet,row:r.row,images:p.images,...(p.imageLinks.length?{imageLinks:p.imageLinks}:{})})};
  for(const r of sheetRows(csv.sight))add('sight','景點',r,{name:r.get('景點名稱'),area:r.get('區域(鄉市)'),village:r.get('區域(村里)'),category:r.get('主類別'),description:r.get('簡易說明'),special:r.get('次類別'),phone:'',address:r.get('地址'),hours:'',legend:r.get('傳說')});
  for(const r of sheetRows(csv.food))add('food','美食清單',r,{area:r.get('區域(鄉市)'),village:'',mainCategory:r.get('主類別'),category:r.get('類別'),name:r.get('名稱'),description:r.get('代表餐食／服務'),special:r.get('推薦菜色／行程'),phone:r.get('電話'),address:r.get('地址'),hours:r.get('營業時間'),legend:''});
  for(const r of sheetRows(csv.temple))add('temple','廟宇',r,{name:r.get('廟宇名稱'),area:r.get('區域(鄉市)'),village:r.get('區域(村里)'),category:'廟宇',description:r.get('廟宇史蹟'),special:r.get('主祀'),phone:r.get('電話'),address:r.get('地址'),hours:'',legend:r.get('傳說'),
    festival:{theme:r.get('元宵主題'),feature:r.get('元宵特色'),dates:r.get('元宵活動日期範圍(YYYY/MM/DD-YYYY/MM/DD)'),hours:r.get('元宵活動時間'),content:r.get('元宵活動內容')}});
  return out;
}

const iso=s=>{const m=tx(s).match(/(\d{4})\D(\d{1,2})\D(\d{1,2})/);return m?`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`:''};
export function buildSeaDays(text){
  const days={};
  for(const r of sheetRows(text)){
    const date=iso(r.get('完整日期'));if(!date)continue;
    const d=days[date]||(days[date]={date,events:[],open:[],close:[],reference:[],sunrise:'',sunset:''});
    if(r.get('潮時'))d.events.push({time:r.get('潮時'),type:r.get('狀態'),height:r.get('潮汐高度'),row:r.row});
    if(r.get('緩慢分海'))d.open.push(r.get('緩慢分海'));
    if(r.get('緩慢合海'))d.close.push(r.get('緩慢合海'));
    if(r.get('參考安全通行'))d.reference.push(r.get('參考安全通行'));
    if(!d.sunrise&&r.get('日出'))d.sunrise=r.get('日出');
    if(!d.sunset&&r.get('日沒'))d.sunset=r.get('日沒');
  }
  return days;
}

/* 30 天潮汐預報：原表重複六組表頭；日期只有月日，年份依讀取當天推定（跨年自動往後一年） */
export function buildForecasts(text,today=new Date()){
  const rows=rawRows(text),out=[];let group=null,day=null;
  const now=new Date(today.toLocaleString('en-US',{timeZone:'Asia/Taipei'})),year=now.getFullYear(),month=now.getMonth()+1;
  const yearOf=m=>m<month-6?year+1:m>month+6?year-1:year;
  rows.forEach((r,i)=>{
    const first=tx(r[0]);
    if(first==='日期'){group={index:out.length+1,headerRow:i+1,days:{}};out.push(group);day=null;return}
    if(!group)return;
    if(first){const m=first.match(/(\d{1,2})\/(\d{1,2})/);if(m){const key=`${yearOf(+m[1])}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;day=group.days[key]={label:first,events:[]}}else day=null}
    if(!day||!tx(r[1]))return;
    day.events.push({type:tx(r[1]),time:tx(r[2]),heightTW:tx(r[3]),heightLocal:tx(r[4]),heightChart:tx(r[5]),open:tx(r[6]),close:tx(r[7]),row:i+1});
  });
  return out;
}

async function grab(key,fetcher){
  const [name,gid]=SHEETS[key],base=`https://docs.google.com/spreadsheets/d/${BOOK}`;
  for(const url of [`${base}/export?format=csv&gid=${gid}&_=${Date.now()}`,`${base}/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(name)}&_=${Date.now()}`]){
    try{const res=await fetcher(url,{cache:'no-store'});if(!res.ok)continue;const text=await res.text();if(text&&!/^\s*</.test(text))return text}catch{}
  }
  return null;
}

export async function loadSheetData(fetcher=globalThis.fetch){
  const keys=Object.keys(SHEETS),texts=await Promise.all(keys.map(k=>grab(k,fetcher))),csv=Object.fromEntries(keys.map((k,i)=>[k,texts[i]]));
  if(!csv.food||!csv.sight||!csv.temple)throw Error('目前讀不到最新資料，請連上網路後重新載入');
  const records=buildRecords(csv);if(!records.length)throw Error('目前讀不到最新資料，請連上網路後重新載入');
  return{meta:{sheets:keys.map(k=>SHEETS[k][0])},records,seaDays:csv.sea?buildSeaDays(csv.sea):{},forecasts:csv.forecast?buildForecasts(csv.forecast):[]};
}
