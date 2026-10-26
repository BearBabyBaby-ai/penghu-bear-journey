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

/* 沿路線往前找：回傳路線上離提醒點最近（橫向 tol 公尺內）的第一個位置與該段行進方向。
   route[0] 為目前位置；第一段只看前方（已經通過的不算）。 */
export function alongRoute(route,a,unit,tol,max){
  let s=0;
  for(let i=0;i<route.length-1;i++){
    const A=route[i],B=route[i+1],dx=B.x-A.x,dz=B.z-A.z,L=Math.hypot(dx,dz);if(L<1e-9)continue;
    let t=((a.x-A.x)*dx+(a.z-A.z)*dz)/(L*L);
    if(i===0&&t<0){s+=L;continue}
    t=Math.max(0,Math.min(1,t));
    const lat=Math.hypot(A.x+dx*t-a.x,A.z+dz*t-a.z)*unit;
    if(lat<=tol)return{s:(s+t*L)*unit,dir:{x:dx/L,z:dz/L}};
    s+=L;if(s*unit>max)break;
  }
  return null;
}

/* 前方提醒：pos／heading 為世界座標與行進方向單位向量，unit＝每世界單位的實際公尺數。
   有 route（熊寶自動前往的道路路線，第一點為上次檢查位置）時：提醒點必須在路線上（橫向 15 公尺內），距離用沿路距離，
   測速還要求該段路的行進方向與受測方向相同（夾角 60° 內）；這樣旁邊平行道路、交叉路口另一條路的測速不會誤報。
   沒有路線（搖桿、GPS）時：提醒點必須在行進方向正前方的走廊內（橫向 lateral 公尺內），
   測速點所在道路須與行進方向平行，且受測方向相同。
   科技執法路口：沿路（或直線）techRange 公尺內，不分方向。step＝上次檢查後移動的公尺數，
   用來補足檢查間隔，避免移動較快時直接跳過 50 公尺的路口範圍。
   同一點提醒一次，離開 rearm 公尺後才會再提醒。原始座標疑似有誤的點不提醒。 */
export function checkAlerts(points,pos,heading,opts={},alerted=new Set()){
  /* routes：多條可能的前方路線（沒有規劃路線、路口有幾條直行方向時），任一條上有就提醒，取最近的距離 */
  if(opts.routes){const seen=new Map();for(const route of opts.routes){const probe=new Set(alerted);for(const r of checkAlertsOne(points,pos,heading,{...opts,routes:null,route},probe))if(!seen.has(r.point.id)||r.distance<seen.get(r.point.id).distance)seen.set(r.point.id,r)}
    if(!opts.routes.length)checkAlertsOne(points,pos,null,{...opts,routes:null},alerted);
    for(const r of seen.values())alerted.add(r.point.id);
    // 可再提醒：離開 rearm 公尺後
    for(const p of points){const a=p.alertAt||p.world;if(a&&alerted.has(p.id)&&!seen.has(p.id)&&Math.hypot(a.x-pos.x,a.z-pos.z)*(opts.unit||1)>(opts.rearm||600))alerted.delete(p.id)}
    return [...seen.values()].sort((a,b)=>a.distance-b.distance)}
  return checkAlertsOne(points,pos,heading,opts,alerted);
}
function checkAlertsOne(points,pos,heading,{unit=1,range=300,techRange=50,rearm=600,route=null,lateral=20,step=0}={},alerted=new Set()){
  const out=[],techReach=techRange+Math.max(0,Math.min(step,150));
  for(const p of points){
    const a=p.alertAt||p.world;if(!a||p.suspect)continue;
    const dx=a.x-pos.x,dz=a.z-pos.z,d=Math.hypot(dx,dz)*unit;
    if(alerted.has(p.id)){if(d>rearm)alerted.delete(p.id);continue}
    let hit=null;
    if(route&&route.length>1){
      // route[0] 是上次檢查時的位置，step 公尺後才是目前位置：剛好在這段間隔經過的點也不會漏掉
      const r=alongRoute(route,a,unit,15,range+step);
      if(r){
        const ahead=Math.max(0,r.s-step),same=!p.dir||(r.dir.x*p.dir.x+r.dir.z*p.dir.z)>=.5;
        if(p.speed&&r.s-step<=range&&same)hit=ahead;
        if(p.tech&&r.s-step<=techRange)hit=hit===null?ahead:Math.min(hit,ahead);
      }
    }else if(heading){
      const along=(dx*heading.x+dz*heading.z)*unit,lat=Math.abs(dx*heading.z-dz*heading.x)*unit;
      const same=!p.dir||(heading.x*p.dir.x+heading.z*p.dir.z)>=.5,parallel=!p.axis||Math.abs(heading.x*p.axis.x+heading.z*p.axis.z)>=.7;
      if(p.speed&&along>=0&&along<=range&&lat<=lateral&&same&&parallel)hit=along;
      if(p.tech&&d<=techReach&&along>=0)hit=hit===null?d:Math.min(hit,d);
    }
    if(hit!==null){alerted.add(p.id);out.push({point:p,distance:hit})}
  }
  return out.sort((a,b)=>a.distance-b.distance);
}

/* 已提醒的點：沿路線（或正前方走廊）還剩多少公尺；回傳負值或 null 表示已經通過 */
export function distanceAhead(p,pos,heading,{unit=1,route=null,routes=null,step=0,lateral=20,max=400}={}){
  const a=p.alertAt||p.world;if(!a)return null;
  if(routes){let best=null;for(const r of routes){const d=distanceAhead(p,pos,heading,{unit,route:r,step,lateral,max});if(d!==null&&(best===null||d<best))best=d}return best}
  if(route&&route.length>1){const r=alongRoute(route,a,unit,15,max+step);return r?r.s-step:null}
  if(!heading)return null;const dx=a.x-pos.x,dz=a.z-pos.z,along=(dx*heading.x+dz*heading.z)*unit,lat=Math.abs(dx*heading.z-dz*heading.x)*unit;
  return lat<=lateral*2?along:null;
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
