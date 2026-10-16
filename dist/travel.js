import {geoToWorld} from './map.js?v=20261015-travel8';
import {Geometry} from './engine.js?v=20261015-travel8';
export const FERRY_FILE='geo/penghu-ferries-20261016.json';
export const FERRY_VERSION='penghu-ferry-game-20261016-v3';
const gap=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),same=(a,b)=>gap(a,b)<1e-6;
const length=points=>points.slice(1).reduce((n,p,i)=>n+gap(points[i],p),0);
export class TravelPlanner{
 constructor(roads,data,landSHA256){
  if(data.version!==FERRY_VERSION||data.landSHA256!==landSHA256)throw Error('港口航線與陸域版本不符');
  this.roads=roads;this.notice=data.notice;
  this.ports=data.ports.map(p=>{const road=roads.point(p.road.edge,p.road.t),sea=geoToWorld(...p.seaGeo);if(!roads.isLand(road.x,road.z)||roads.isLand(sea.x,sea.z)||gap(road,sea)>2.00001)throw Error('港區接駁位置不符');return{...p,road,sea}});
  this.links=data.links.map(l=>{const from=this.port(l.from),to=this.port(l.to),points=l.points.map(p=>geoToWorld(...p));if(!from||!to||!same(points[0],from.sea)||!same(points.at(-1),to.sea)||points.slice(1).some((p,i)=>!roads.coast.seaSegment(points[i],p)))throw Error('遊戲航線穿越陸地或端點不符');return{...l,points}});
 }
 port(id){return this.ports.find(p=>p.id===id)}
 plan(start,end){
  const roads=this.roads;if(!roads.isOnRoad(start)||!roads.isOnRoad(end))return null;
  const direct=roads.path(start,end);if(direct)return{origin:{...start},end:{...end},legs:[{type:'walk',label:'沿道路前往',points:[{...start},...direct]}],distance:direct.distance,ports:[]};
  // 港口圖：起點／終點／各港口為節點；邊＝同一陸塊上的道路步行，或已收錄航線。
  // 同一陸塊可能有多個港口（本島有馬公、赤崁、岐頭），也可能要「下船→沿路走到另一港→再搭船」（例：吉貝→赤崁→馬公→望安）。
  // 以 Dijkstra 取「步行＋航程」總長最短者；沒有收錄航線的島嶼仍回傳 null，不推測。
  const walkCache=this.walkCache||(this.walkCache=new Map()),portWalk=(p,q)=>{const k=p.id+'>'+q.id;if(!walkCache.has(k))walkCache.set(k,roads.path(p.road,q.road));return walkCache.get(k)};
  const edges=new Map(),add=(u,v,cost,data)=>{if(!edges.has(u))edges.set(u,[]);edges.get(u).push({v,cost,data})};
  for(const p of this.ports){
   if(p.road.component===start.component){const w=roads.path(start,p.road);if(w)add('S',p.id,w.distance,{walk:w,from:{...start},to:p})}
   if(p.road.component===end.component){const w=roads.path(p.road,end);if(w)add(p.id,'E',w.distance,{walk:w,from:p.road,to:null})}
   for(const q of this.ports)if(q!==p&&q.road.component===p.road.component){const w=portWalk(p,q);if(w)add(p.id,q.id,w.distance,{walk:w,from:p.road,to:q})}
  }
  for(const l of this.links){add(l.from,l.to,length(l.points),{link:l,forward:true});add(l.to,l.from,length(l.points),{link:l,forward:false})}
  const dist=new Map([['S',0]]),prev=new Map(),open=new Set(['S']),done=new Set();
  while(open.size){let at=null;for(const id of open)if(at===null||dist.get(id)<dist.get(at))at=id;open.delete(at);done.add(at);if(at==='E')break;
   for(const e of edges.get(at)||[]){if(done.has(e.v))continue;const d=dist.get(at)+e.cost;if(d<(dist.get(e.v)??Infinity)){dist.set(e.v,d);prev.set(e.v,{u:at,e});open.add(e.v)}}}
  if(!prev.has('E'))return null;
  const steps=[];for(let at='E';at!=='S';at=prev.get(at).u)steps.unshift(prev.get(at).e);
  if(!steps.some(e=>e.data.link))return null;
  const legs=[],ids=[];
  for(const e of steps){
   if(e.data.walk){const w=e.data.walk;legs.push({type:'walk',label:e.data.to?`沿道路前往${e.data.to.name}`:'下船後沿道路前往目的地',points:[{...e.data.from},...w]});continue}
   const l=e.data.link,a=this.port(e.data.forward?l.from:l.to),b=this.port(e.data.forward?l.to:l.from),points=e.data.forward?l.points:[...l.points].reverse();
   if(ids.at(-1)!==a.id)ids.push(a.id);ids.push(b.id);
   legs.push({type:'port',label:`${a.name} · 港區登船`,points:[a.road,a.sea]},
    {type:'ferry',label:`熊寶搭船：${a.name} → ${b.name}`,points,from:a.id,to:b.id},
    {type:'port',label:`${b.name} · 靠港下船`,points:[b.sea,b.road],arrival:b.id});
  }
  return{origin:{...start},end:{...end},legs,distance:legs.reduce((n,l)=>n+length(l.points),0),ports:ids.map(id=>this.port(id).name)};
 }
}
// All legs consume time and distance. A phase change may update road metadata
// only at the same coordinate; it must never assign a remote actor position.
export class Journey{
 constructor(planner){this.planner=planner;this.revision=0;this.plan=null;this.legIndex=0;this.pointIndex=1;this.elapsed=0;this.wait=0;this.initialWait=0;this.pending=null;this.cancelAtPort=false;this.meta={}}
 get active(){return !!this.plan}
 get leg(){return this.plan?.legs[this.legIndex]}
 get inTransit(){return this.active&&this.leg.type!=='walk'}
 get label(){return this.active&&this.wait>0?'已靠港 · 準備接續旅程':this.leg?.label||''}
 request(player,end,meta={}){
  if(this.inTransit){this.pending={end:{...end},meta};this.cancelAtPort=false;this.revision++;return{queued:true}}
  const plan=this.planner.plan(player,end);if(!plan)return null;
  this.plan=plan;this.meta=meta;this.legIndex=0;this.pointIndex=1;this.elapsed=0;this.wait=0;this.initialWait=0;this.pending=null;this.cancelAtPort=false;this.revision++;return{queued:false,plan};
 }
 cancel(){this.pending=null;if(this.inTransit){this.cancelAtPort=true;return false}this.plan=null;this.revision++;return true}
 advance(player,dt,speed=3){
  let seconds=dt,moved=0;
  for(let guard=0;this.active&&seconds>1e-9&&guard<2048;guard++){
   if(this.wait>0){const held=Math.min(seconds,this.wait);this.wait-=held;seconds-=held;this.elapsed+=held;if(seconds<1e-9)break}
   const leg=this.leg,dest=leg.points[this.pointIndex];
   if(!dest){
    const arrival=leg.arrival;this.legIndex++;this.pointIndex=1;this.revision++;
    if(arrival&&this.pending){const pending=this.pending;this.plan=null;this.pending=null;const changed=this.request(player,pending.end,pending.meta);if(!changed){this.plan=null;this.error='抵港後無可用路線'}else{this.wait=.8;this.initialWait=.8}continue}
    if(arrival&&this.cancelAtPort){this.plan=null;break}
    if(this.legIndex>=this.plan.legs.length){this.plan=null;break}if(arrival)this.wait=.8;continue;
   }
   const velocity=leg.type==='ferry'?14:leg.type==='port'?1.5:speed;
   let used=0,reached=false;
   if(leg.type==='walk')({used,reached}=this.planner.roads.advance(player,dest,seconds*velocity));
   else{
    const d=gap(player,dest);used=Math.min(d,seconds*velocity);reached=d-used<1e-8;
    if(d>1e-10){const dx=dest.x-player.x,dz=dest.z-player.z;player.x+=dx/d*used;player.z+=dz/d*used;player.facing=Math.atan2(dx,dz)}
    if(reached&&leg.arrival)Object.assign(player,leg.points.at(-1));
   }
   if(!used&&!reached){this.error='路線中斷，已停止';this.plan=null;break}
   seconds-=used/velocity;this.elapsed+=used/velocity;moved+=used;if(reached)this.pointIndex++;else break;
  }return moved;
 }
 remaining(player){if(!this.active)return 0;let result=0,at=player;for(let i=this.legIndex;i<this.plan.legs.length;i++){const leg=this.plan.legs[i],points=leg.points.slice(i===this.legIndex?this.pointIndex:1);for(const p of points){result+=gap(at,p);at=p}}return result}
 snapshot(){return this.active?{version:FERRY_VERSION,origin:{edge:this.plan.origin.edge,t:this.plan.origin.t},end:{edge:this.plan.end.edge,t:this.plan.end.t},elapsed:this.elapsed,initialWait:this.initialWait,meta:this.meta,pending:this.pending?{end:{edge:this.pending.end.edge,t:this.pending.end.t},meta:this.pending.meta}:null,cancelAtPort:this.cancelAtPort}:null}
 restore(player,raw){
  if(raw?.version!==FERRY_VERSION||!Number.isFinite(raw.elapsed)||raw.elapsed<0||raw.elapsed>3600)return false;
  const decode=p=>Number.isInteger(p?.edge)&&this.planner.roads.edges[p.edge]&&Number.isFinite(p.t)&&p.t>=0&&p.t<=1?this.planner.roads.point(p.edge,p.t):null;
  const origin=decode(raw.origin),end=decode(raw.end);if(!origin||!end||!this.request(origin,end,raw.meta||{}))return false;
  this.initialWait=Number.isFinite(raw.initialWait)?Math.max(0,Math.min(.8,raw.initialWait)):0;this.wait=this.initialWait;
  Object.assign(player,origin);let remaining=raw.elapsed;
  while(remaining>1e-9&&this.active){const dt=Math.min(.5,remaining);this.advance(player,dt);remaining-=dt}
  if(raw.pending&&this.active){const end=decode(raw.pending.end);if(end)this.pending={end,meta:raw.pending.meta||{}}}this.cancelAtPort=!!raw.cancelAtPort;return true;
 }
 geometry(player){
  const g=new Geometry();if(!this.active)return g;
  const draw=(a,b,type)=>{const distance=gap(a,b);if(distance<1e-8)return;const dx=-(b.z-a.z)/distance*.045,dz=(b.x-a.x)/distance*.045,steps=type==='ferry'?Math.ceil(distance/.8):1;
   for(let i=0;i<steps;i++){const t=i/steps,u=Math.min(1,(i+(type==='ferry'?.6:1))/steps),p={x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t},q={x:a.x+(b.x-a.x)*u,z:a.z+(b.z-a.z)*u};g.quad([p.x-dx,1.016,p.z-dz],[p.x+dx,1.016,p.z+dz],[q.x+dx,1.016,q.z+dz],[q.x-dx,1.016,q.z-dz],type==='ferry'?'#468fa7':'#d98736')}
  };
  let at=player;for(let i=this.legIndex;i<this.plan.legs.length;i++)for(const p of this.plan.legs[i].points.slice(i===this.legIndex?this.pointIndex:1)){draw(at,p,this.plan.legs[i].type);at=p}return g;
 }
}
export async function loadFerries(fetcher=fetch){const r=await fetcher(FERRY_FILE);if(!r.ok)throw Error('港口航線資料未載入');return r.json()}
