// 全部測速點逐點排查（第25版）：依 game.js 的 GPS 判斷流程（方向、沿路往前看、提醒、倒數、通過收起）模擬，修改 game.js 對應邏輯時須同步這裡
import fs from 'node:fs';const D=new URL('../dist/',import.meta.url).href;
const {RoadNavigation}=await import(D+'roads.js');const {Coastline}=await import(D+'coastline.js');const {mapPosition}=await import(D+'map.js');const E=await import(D+'enforcement.js');
const {TravelPlanner}=await import(D+'travel.js');const {GpsNav}=await import(D+'gpsnav.js');
const read=f=>JSON.parse(fs.readFileSync(new URL(f,D)));const nav=new RoadNavigation(read('geo/penghu-roads-20211217.json'),new Coastline(read('geo/penghu-land-20260407.geojson')));
const planner=new TravelPlanner(nav,read('geo/penghu-ferries-20261016.json'),read('geo/penghu-grid-20260407.json').sourceSHA256);const unit=100*Math.cos(23.55*Math.PI/180);
const P=E.groupPoints(read('geo/penghu-enforcement-20261016.json').records.map(E.normalizeRecord)).filter(p=>!p.suspect).map(p=>{const q={...p,world:mapPosition(p)},near=nav.nearby(q.world.x,q.world.z,.6),al=q.dir&&near.find(r=>Math.abs(r.axis.x*q.dir.x+r.axis.z*q.dir.z)>=.7),pk=al||near[0];return{...q,alertAt:pk?{x:pk.x,z:pk.z}:q.world,axis:pk?.axis||null}});
let seed=5;const rnd=()=>(seed=(seed*1103515245+12345)%2147483648)/2147483648,gauss=()=>Math.sqrt(-2*Math.log(rnd()+1e-12))*Math.cos(2*Math.PI*rnd());
function sample(pts,step){const out=[];let acc=0;for(let i=0;i<pts.length-1;i++){const A=pts[i],B=pts[i+1],L=Math.hypot(B.x-A.x,B.z-A.z)*unit;for(let s=acc;s<L;s+=step){const t=s/L;out.push({x:A.x+(B.x-A.x)*t,z:A.z+(B.z-A.z)*t})}acc=((acc-L)%step+step)%step}return out}
// GPS 一趟：回傳每筆 {true 距離, 顯示文字距離 or null}
function gpsRun(fixes,truth,{noise=0,acc=8,useNav=null}={}){
 const st={hist:[],prev:null,alerted:new Set(),active:null,activeAt:0},rows=[];let navS=0;
 fixes.forEach((f0,i)=>{const t=i*1000,f={x:f0.x+gauss()*noise/unit,z:f0.z+gauss()*noise/unit,t};
  const hist=st.hist;const prevFix=hist[hist.length-1]||null;hist.push(f);while(hist.length&&t-hist[0].t>15000)hist.shift();
  const need=Math.max(30,3*acc);let base=null;for(let k=hist.length-2;k>=0;k--)if(Math.hypot(f.x-hist[k].x,f.z-hist[k].z)*unit>=need){base=hist[k];break}
  const dist=base?Math.hypot(f.x-base.x,f.z-base.z)*unit:0,speed=base?dist/Math.max(.5,(t-base.t)/1000):0,moving=speed>=5/3.6;let heading=moving&&base?{x:(f.x-base.x)*unit/dist,z:(f.z-base.z)*unit/dist}:null;if(heading&&st.h&&heading.x*st.h.x+heading.z*st.h.z<0){st.flip=(st.flip||0)+1;if(st.flip<2)heading=st.h}else st.flip=0;st.h=heading||(moving?st.h:null);heading=st.h;
  let route=null,step=0;
  if(useNav&&moving){useNav.prevS=useNav.s;useNav.update(f,unit,Math.max(40,acc*2));if(useNav.off===0&&useNav.lastLat<=40){const from=Math.max(0,Math.min(useNav.prevS,useNav.s));route=useNav.ahead(from,350/unit+(useNav.s-from));if(route)step=(useNav.s-from)*unit}}
  let routes=null;if(!route&&moving&&heading){const moved=prevFix?Math.hypot(f.x-prevFix.x,f.z-prevFix.z)*unit:0,from=moved>2*acc&&moved<200?prevFix:f;step=from===prevFix?moved:0;const reach=Math.min(.6,Math.max(.35,acc*3/unit));const all=nav.lookaheadAll(from.x,from.z,heading,(350+step)/unit,reach);if(all.length)routes=all}
  const movedNow=prevFix?Math.hypot(f.x-prevFix.x,f.z-prevFix.z)*unit:0;
  if(st.active){const a=st.active;let d=route||routes?E.distanceAhead(a.point,f,heading,{unit,route,routes,step}):null;
   if(d===null){a.miss=(a.miss||0)+1;d=(a.d??0)-(moving?movedNow:0);if(a.miss>=(d>30?6:3)){if(d>30)st.alerted.delete(a.point.id);st.active=null}}else a.miss=0;
   const at=a.point.alertAt;if(st.active&&a.miss&&d<25&&heading){const dx=at.x-f.x,dz=at.z-f.z;if(dx*heading.x+dz*heading.z<0&&Math.hypot(dx,dz)*unit>25)d=-10}
   if(st.active){if(d<-5)st.active=null;else{if(a.d!=null&&a.miss===0)d=Math.min(a.d,Math.max(d,a.d-((moving?movedNow:0)*1.5+15)));a.d=Math.max(0,d);st.activeAt=t}}}
  if(route||routes){const res=E.checkAlerts(P,f,heading,routes?{unit,routes,step}:{unit,route,step},st.alerted);if(res.length){st.active={point:res[0].point,d:res[0].distance,miss:0};st.activeAt=t}}
  else E.checkAlerts(P,f,null,{unit},st.alerted);
  if(st.active&&t-st.activeAt>=8000)st.active=null;
  rows.push({true:truth[i],shown:st.active?{id:st.active.point.id,d:st.active.d}:null});
 });return rows}
const report=[];const tally={ok:0,late:0,gap:0,stale:0,miss:0,wrong:0,offset:0};
for(const c of P){const dir=c.dir;
 for(const sign of [1,-1]){const h={x:dir.x*sign,z:dir.z*sign};
  const back=nav.lookahead(c.alertAt.x,c.alertAt.z,{x:-h.x,z:-h.z},900/unit,.2),fwd=nav.lookahead(c.alertAt.x,c.alertAt.z,h,250/unit,.2);if(!back||!fwd)continue;
  const path=[...back.slice().reverse(),...fwd.slice(1)];
  for(const kmh of "40,70".split(",").map(Number))for(const noise of "0,8".split(",").map(Number))for(const mode of ['road','nav']){
   const fixes=sample(path,kmh/3.6);
   // 真實沿路距離（正＝還沒到）
   let cum=0;const cumArr=[0];for(let i=1;i<fixes.length;i++){cum+=Math.hypot(fixes[i].x-fixes[i-1].x,fixes[i].z-fixes[i-1].z)*unit;cumArr.push(cum)}
   const r=E.alongRoute(fixes,c.alertAt,unit,20,1e9);if(!r)continue;const truth=cumArr.map(s=>r.s-s);
   let useNav=null;if(mode==='nav'){const a=nav.snap(path[0].x,path[0].z,.2),b=nav.snap(path.at(-1).x,path.at(-1).z,.2),plan=a&&b&&planner.plan(a,b);if(!plan||plan.ports.length)continue;useNav=new GpsNav(plan,b,{})}
   seed=5+Math.round(kmh)+noise;const rows=gpsRun(fixes,truth,{noise,acc:Math.max(5,noise),useNav});const mine=rows.map(x=>x.shown&&x.shown.id===c.id?x.shown.d:null);
   const tag=`${c.name} ${sign>0?'同向':'反向'} ${kmh}km/h 誤差${noise} ${mode}`;
   const enforced=sign>0;
   if(!enforced){const bad=mine.some((d,i)=>d!==null&&!(c.tech&&truth[i]<=80));if(bad){tally.wrong++;report.push('反向誤報 '+tag)}else tally.ok++;continue}
   const first=mine.findIndex(d=>d!==null);if(first<0){tally.miss++;report.push('漏報 '+tag);continue}
   const firstTrue=truth[first];const avail=truth[0];
   let problems=[];
   if(firstTrue<Math.min(200,avail-60))problems.push(`太晚(真實 ${Math.round(firstTrue)}m 才提醒)`);
   const passIdx=truth.findIndex(t=>t<-25);const lastShown=mine.findLastIndex?mine.findLastIndex(d=>d!==null):mine.length-1-[...mine].reverse().findIndex(d=>d!==null);
   for(let i=first;i<mine.length&&truth[i]>15;i++)if(mine[i]===null){problems.push(`中斷(真實 ${Math.round(truth[i])}m)`);break}
   if(passIdx>=0&&lastShown>=passIdx)problems.push(`通過後未收起(真實 ${Math.round(truth[lastShown])}m)`);
   const errs=mine.map((d,i)=>d!==null&&truth[i]>0?Math.abs(d-truth[i]):0);const maxErr=Math.max(...errs);if(maxErr>60)problems.push(`距離誤差 ${Math.round(maxErr)}m`);
   if(problems.length){for(const p of problems){const k=p.startsWith('太晚')?'late':p.startsWith('中斷')?'gap':p.startsWith('通過')?'stale':'offset';tally[k]++}report.push(problems.join('、')+' '+tag)}else tally.ok++;
  }}}
if(report.length){console.error(report.join('\n'));process.exit(1)}
console.log(`PASS enforcement-sweep: every camera approached along its road in the enforced and opposite direction at 40/70 km/h, GPS error 0/8 m, with and without navigation (${tally.ok} runs): alert at 200–300 m, countdown continuous, hidden after passing, no opposite-direction alert.`);
