// 測速照相與科技執法：讀取熊熊綜合系統試算表「測速與科技執法」工作表（公開 CSV，不需 API 金鑰），
// 讀不到時改用內建檔。資料來源為澎湖縣政府警察局開放資料；座標保留原值（只把原始資料對調的經緯度欄位換回來）。
// 本檔只做資料整理與「前方提醒」判斷，不移動熊寶。
import {parseCSV} from './ferry-sheet.js?v=20261016-sheet1';

export const ENFORCE_SHEET={id:'1LOr4_3ugTHvTIi4UIfgVz2atVFh2K32zh7YKrrHxTwk',gid:777020,name:'測速與科技執法'};
export const ENFORCE_FILE='geo/penghu-enforcement-20261016.json';
export const ENFORCE_HEADERS=['類型','設備編號','設置地點','鄉市','緯度','經度','速限','拍攝方向','取締項目','科技執法種類','管轄分局','型式','官方資料','資料更新日期','整理日期','備註'];

// 世界座標：x 向東、z 向南
const DIRS={東:[1,0],西:[-1,0],南:[0,1],北:[0,-1]};
/* 「東南向西北」＝車輛由東南往西北行駛（受測方向），回傳行進方向單位向量 */
export function parseDirection(text){
  const m=String(text||'').replace(/\s/g,'').match(/^([東西南北]{1,2})向([東西南北]{1,2})$/);if(!m)return null;
  const v=[...m[2]].reduce((a,c)=>[a[0]+DIRS[c][0],a[1]+DIRS[c][1]],[0,0]),n=Math.hypot(v[0],v[1]);
  return n?{x:v[0]/n,z:v[1]/n}:null;
}
const num=v=>{const n=Number(String(v??'').replace(/^'/,'').trim());return Number.isFinite(n)?n:null};

/* 一筆紀錄：經緯度若明顯對調（緯度欄 >90）就換回來，其餘數值不改 */
export function normalizeRecord(r){
  let lat=num(r.lat),lng=num(r.lng),swapped=false;
  if(lat!==null&&lng!==null&&Math.abs(lat)>90&&Math.abs(lng)<=90){[lat,lng]=[lng,lat];swapped=true}
  const type=String(r.type||'').includes('科技')?'tech':'speed';
  return{type,no:String(r.no??'').trim(),name:String(r.name||'').trim(),area:String(r.area||'').trim(),lat,lng,swapped,limit:num(r.limit),direction:String(r.direction||'').trim(),items:String(r.items||'').trim(),techKind:String(r.techKind||'').trim(),dept:String(r.dept||'').trim(),model:String(r.model||'').trim(),source:String(r.source||'').trim(),updated:String(r.updated||'').replace(/^'/,'').trim(),date:String(r.date||'').replace(/^'/,'').trim(),note:String(r.note||'').trim(),suspect:/疑似|不符/.test(String(r.note||''))};
}

export function enforcementRowsFromCSV(text){
  const [head,...body]=parseCSV(text);if(!head)return null;
  const h=head.map(s=>s.trim());if(['類型','設置地點','緯度','經度'].some(k=>!h.includes(k)))return null;
  const get=(row,k)=>{const i=h.indexOf(k);return i<0?'':String(row[i]??'').trim()};
  return body.map(row=>normalizeRecord({type:get(row,'類型'),no:get(row,'設備編號'),name:get(row,'設置地點'),area:get(row,'鄉市'),lat:get(row,'緯度'),lng:get(row,'經度'),limit:get(row,'速限'),direction:get(row,'拍攝方向'),items:get(row,'取締項目'),techKind:get(row,'科技執法種類'),dept:get(row,'管轄分局'),model:get(row,'型式'),source:get(row,'官方資料'),updated:get(row,'資料更新日期'),date:get(row,'整理日期'),note:get(row,'備註')})).filter(r=>r.name&&r.lat!==null&&r.lng!==null);
}

/* 同一座標（同一路口）的測速與科技執法合併成一個點 */
export function groupPoints(records){
  const map=new Map();
  for(const r of records){const key=r.lat.toFixed(5)+','+r.lng.toFixed(5);if(!map.has(key))map.set(key,{id:'enf-'+(map.size+1),lat:r.lat,lng:r.lng,records:[]});map.get(key).records.push(r)}
  return [...map.values()].map(p=>{const speed=p.records.find(r=>r.type==='speed'),tech=p.records.find(r=>r.type==='tech'),main=tech||speed;
    return{...p,name:main.name,area:main.area,speed:!!speed,tech:!!tech,limit:(speed||tech).limit,direction:(speed||tech).direction,dir:parseDirection((speed||tech).direction),items:[...new Set(p.records.flatMap(r=>r.items.split(/[、,，]/)).map(s=>s.trim()).filter(Boolean))],suspect:p.records.some(r=>r.suspect)}});
}

/* 前方提醒：pos／heading 為世界座標與行進方向單位向量，unit＝每世界單位的實際公尺數。
   測速：前方（夾角 45° 內）range 公尺內且行進方向與受測方向相同（夾角 60° 內）。
   科技執法路口：techRange 公尺內（不分方向）；若同時測速且方向相同，以測速距離提早提醒。
   同一點提醒一次，離開 rearm 公尺後才會再提醒。原始座標疑似有誤的點不提醒。 */
export function checkAlerts(points,pos,heading,{unit=1,range=300,techRange=50,rearm=600}={},alerted=new Set()){
  const out=[];
  for(const p of points){
    const a=p.alertAt||p.world;if(!a||p.suspect)continue;
    const dx=a.x-pos.x,dz=a.z-pos.z,dw=Math.hypot(dx,dz),d=dw*unit;
    if(alerted.has(p.id)){if(d>rearm)alerted.delete(p.id);continue}
    if(!heading)continue;
    const ahead=dw<1e-9?1:(dx*heading.x+dz*heading.z)/dw,same=!p.dir||(heading.x*p.dir.x+heading.z*p.dir.z)>=.5;
    let hit=false;
    if(p.speed&&d<=range&&ahead>=Math.SQRT1_2&&same)hit=true;
    if(p.tech&&d<=techRange&&ahead>=0)hit=true;
    if(hit){alerted.add(p.id);out.push({point:p,distance:d})}
  }
  return out.sort((a,b)=>a.distance-b.distance);
}

export function alertText({point:p,distance}){
  const m=Math.max(10,Math.round(distance/10)*10);
  if(p.speed&&p.limit)return `前方 ${m} 公尺｜測速 ${p.limit}${p.tech?'・路口科技執法':''}`;
  return `前方 ${m} 公尺｜路口科技執法${p.items.length?'：'+p.items.join('、'):''}`;
}

export async function loadEnforcementSheet(fetcher=globalThis.fetch){
  const base=`https://docs.google.com/spreadsheets/d/${ENFORCE_SHEET.id}`;
  const urls=[`${base}/export?format=csv&gid=${ENFORCE_SHEET.gid}&_=${Date.now()}`,`${base}/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(ENFORCE_SHEET.name)}&_=${Date.now()}`];
  for(const url of urls){try{const res=await fetcher(url,{cache:'no-store'});if(!res.ok)continue;const rows=enforcementRowsFromCSV(await res.text());if(rows?.length)return rows}catch{}}
  return null;
}

/* 先讀試算表，讀不到改用內建檔；回傳 {records,from} */
export async function loadEnforcement(fetcher=globalThis.fetch){
  const sheet=await loadEnforcementSheet(fetcher);if(sheet)return{records:sheet,from:'sheet'};
  try{const res=await fetcher(ENFORCE_FILE);if(res.ok){const data=await res.json();return{records:data.records.map(normalizeRecord),from:'bundled',meta:data}}}catch{}
  return{records:[],from:'none'};
}
