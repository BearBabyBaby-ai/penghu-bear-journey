export const KINDS={food:{label:'美食',symbol:'食',color:'#c78861'},sight:{label:'景點',symbol:'景',color:'#6c9d91'},temple:{label:'廟宇',symbol:'廟',color:'#b19463'}};
export const AREAS=['馬公市','湖西鄉','白沙鄉','西嶼鄉','七美鄉','望安鄉'];
export const SPOTS=[[-12,7],[-7,11],[4,11],[12,5],[15,-2],[9,-9],[0,-11],[-9,-8],[-15,-1]];
const preferred=['山水沙灘','觀音亭親水遊憩區','奎壁山摩西分海','澎湖水族館','澎湖跨海大橋','二崁古厝群','池東大菓葉玄武岩','漁翁島燈塔(西嶼燈塔)','雙心石滬','天后宮','風櫃聽濤'];
export function makeTour(records,area){
 const list=[];
 for(const kind of ['sight','temple']){
  const pool=records.filter(r=>r.area===area&&r.kind===kind);
  pool.sort((a,b)=>Number(preferred.some(p=>b.name.includes(p)))-Number(preferred.some(p=>a.name.includes(p)))||a.row-b.row);
  list.push(...pool.slice(0,kind==='sight'?5:4));
 }
 return list.map((record,i)=>({record,x:SPOTS[i][0],z:SPOTS[i][1],index:i}));
}
export function filterRecords(records,{query='',area='',kind=''}={}){
 const q=query.trim().toLowerCase();return records.filter(r=>(!area||r.area===area)&&(!kind||r.kind===kind)&&(!q||[r.name,r.category,r.description,r.special,r.village,r.address].some(s=>String(s).toLowerCase().includes(q))));
}
export function minute(time){const [h,m]=time.split(':').map(Number);return h*60+m}
export function interpolateTide(events,at){
 const samples=events.filter(e=>e.time&&Number.isFinite(Number(e.height))).map(e=>({t:minute(e.time),h:Number(e.height)})).sort((a,b)=>a.t-b.t);
 if(!samples.length)return null;if(samples.length===1)return samples[0].h;
 // Extend using the last/first neighboring extrema for a continuous illustrative curve.
 const all=[{t:samples.at(-1).t-1440,h:samples.at(-1).h},...samples,{t:samples[0].t+1440,h:samples[0].h}];
 for(let i=1;i<all.length;i++)if(at<=all[i].t){const a=all[i-1],b=all[i],t=Math.max(0,Math.min(1,(at-a.t)/(b.t-a.t)));return a.h+(b.h-a.h)*(1-Math.cos(t*Math.PI))/2}
 return samples.at(-1).h;
}
export function cleanSave(raw,records){
 const valid=new Set(records.map(r=>r.id)),stamps={};
 if(raw&&typeof raw==='object'&&raw.stamps&&typeof raw.stamps==='object')for(const [k,v]of Object.entries(raw.stamps))if(valid.has(k)&&typeof v==='string'&&/^\d{4}-\d\d-\d\d/.test(v))stamps[k]=v.slice(0,10);
 const point=p=>Number.isInteger(p?.edge)&&p.edge>=0&&p.edge<10000000&&Number.isFinite(p.t)&&p.t>=0&&p.t<=1?{edge:p.edge,t:p.t}:null;
 const meta=m=>{const r=records.find(r=>r.id===m?.recordId);return r?{recordId:r.id,area:r.area,name:r.name}:{}};
 const j=raw?.journey,origin=point(j?.origin),end=point(j?.end),pendingEnd=point(j?.pending?.end);
 const journey=origin&&end&&Number.isFinite(j.elapsed)&&j.elapsed>=0&&j.elapsed<=3600?{version:j.version,origin,end,elapsed:j.elapsed,initialWait:Number.isFinite(j.initialWait)?Math.max(0,Math.min(.8,j.initialWait)):0,meta:meta(j.meta),cancelAtPort:!!j.cancelAtPort,pending:pendingEnd?{end:pendingEnd,meta:meta(j.pending.meta)}:null}:null;
 return{version:1,stamps,observed:!!raw?.observed,area:AREAS.includes(raw?.area)?raw.area:AREAS[0],position:point(raw?.position),journey};
}
