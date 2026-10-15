import {geoToWorld} from './map.js?v=20261015-travel8';
import {Geometry} from './engine.js?v=20261015-travel8';
export const ROAD_FILE='geo/penghu-roads-20211217.json';
export const ROAD_VERSION='osm-penghu-20211217-v1';
const EPS=1e-7,clamp=v=>Math.max(0,Math.min(1,v));
class Heap{
 constructor(){this.a=[]}
 push(v){const a=this.a;let i=a.length;a.push(v);while(i){const p=(i-1)>>1;if(a[p].f<=v.f)break;a[i]=a[p];i=p}a[i]=v}
 pop(){const a=this.a,v=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let j=i*2+1;if(j+1<a.length&&a[j+1].f<a[j].f)j++;if(a[j].f>=last.f)break;a[i]=a[j];i=j}a[i]=last}return v}
}
export class RoadNavigation{
 constructor(graph,coast){
  if(graph.version!==ROAD_VERSION||!graph.nodes?.length||!graph.edges?.length)throw Error('道路資料版本不符或不完整');
  this.coast=coast;this.meta=graph.source;this.roads=graph.roads;this.nodes=graph.nodes.map(p=>geoToWorld(...p));this.adj=this.nodes.map(()=>[]);this.cells=new Map();this.bin=2;
  this.edges=graph.edges.map(([a,b,r],id)=>{
   if(!this.nodes[a]||!this.nodes[b]||!this.roads[r])throw Error('道路節點資料不完整');
   const p=this.nodes[a],q=this.nodes[b],length=Math.hypot(q.x-p.x,q.z-p.z);if(!Number.isFinite(length)||length<=0)throw Error('道路線段不完整');
   this.adj[a].push(id);this.adj[b].push(id);
   for(let z=Math.floor(Math.min(p.z,q.z)/this.bin);z<=Math.floor(Math.max(p.z,q.z)/this.bin);z++)for(let x=Math.floor(Math.min(p.x,q.x)/this.bin);x<=Math.floor(Math.max(p.x,q.x)/this.bin);x++){const k=x+':'+z;if(!this.cells.has(k))this.cells.set(k,[]);this.cells.get(k).push(id)}
   return{a,b,r,length};
  });
  this.components=new Int32Array(this.nodes.length).fill(-1);this.sizes=[];
  for(let i=0;i<this.nodes.length;i++)if(this.components[i]<0){const c=this.sizes.length,q=[i];this.components[i]=c;for(let j=0;j<q.length;j++)for(const id of this.adj[q[j]]){const e=this.edges[id],n=e.a===q[j]?e.b:e.a;if(this.components[n]<0){this.components[n]=c;q.push(n)}}this.sizes.push(q.length)}
 }
 isLand=(x,z)=>this.coast.isLand(x,z);
 point(edge,t){const e=this.edges[edge],a=this.nodes[e.a],b=this.nodes[e.b];return{x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,edge,t,roadName:this.roads[e.r].name||'未命名道路',component:this.components[e.a]}}
 isOnRoad(p){if(!p||!this.edges[p.edge]||!Number.isFinite(p.t)||p.t<0||p.t>1)return false;const q=this.point(p.edge,p.t);return Math.hypot(p.x-q.x,p.z-q.z)<EPS}
 snap(x,z,maxDistance=1.5){
  if(!Number.isFinite(x)||!Number.isFinite(z))return null;let best=null,dist=maxDistance;const seen=new Set();
  for(let iz=Math.floor((z-maxDistance)/this.bin);iz<=Math.floor((z+maxDistance)/this.bin);iz++)for(let ix=Math.floor((x-maxDistance)/this.bin);ix<=Math.floor((x+maxDistance)/this.bin);ix++)for(const id of this.cells.get(ix+':'+iz)||[]){
   if(seen.has(id))continue;seen.add(id);const e=this.edges[id],a=this.nodes[e.a],b=this.nodes[e.b],t=clamp(((x-a.x)*(b.x-a.x)+(z-a.z)*(b.z-a.z))/e.length**2),p=this.point(id,t),d=Math.hypot(p.x-x,p.z-z);
   // Do not pick an isolated tile sliver as a normal exploration start.
   if(d<dist&&this.sizes[p.component]>=3){dist=d;best={...p,offset:d}}
  }return best;
 }
 path(start,end,limit=Infinity){
  if(!this.isOnRoad(start)||!this.isOnRoad(end)||start.component!==end.component)return null;
  const se=this.edges[start.edge],te=this.edges[end.edge];
  let best=start.edge===end.edge?Math.abs(start.t-end.t)*se.length:Infinity,bestNode=null;
  if(best>limit)best=Infinity;
  const d=new Map(),prev=new Map(),heap=new Heap(),heuristic=n=>Math.hypot(this.nodes[n].x-end.x,this.nodes[n].z-end.z);
  for(const [n,cost] of [[se.a,start.t*se.length],[se.b,(1-start.t)*se.length]])if(cost<=(d.get(n)??Infinity)&&cost<=limit){d.set(n,cost);prev.set(n,null);heap.push({n,g:cost,f:cost+heuristic(n)})}
  while(heap.a.length){const item=heap.pop();if(item.g!==d.get(item.n))continue;if(item.f>Math.min(best,limit)+EPS)break;
   if(item.n===te.a||item.n===te.b){const total=item.g+(item.n===te.a?end.t:1-end.t)*te.length;if(total<best-EPS&&total<=limit){best=total;bestNode=item.n}}
   for(const id of this.adj[item.n]){const e=this.edges[id],n=e.a===item.n?e.b:e.a,g=item.g+e.length;if(g>Math.min(best,limit)||g>=(d.get(n)??Infinity)-EPS)continue;d.set(n,g);prev.set(n,{node:item.n,edge:id});heap.push({n,g,f:g+heuristic(n)})}
  }
  if(!Number.isFinite(best))return null;
  let points=[];
  if(bestNode!==null){const chain=[];let n=bestNode;while(prev.get(n)){const p=prev.get(n);chain.push({node:n,edge:p.edge});n=p.node}points.push(this.point(start.edge,se.a===n?0:1));for(const p of chain.reverse()){const e=this.edges[p.edge];points.push(this.point(p.edge,e.a===p.node?0:1))}}
  points.push({...end});points.distance=best;return points;
 }
 distance(a,b,limit=Infinity){return this.path(a,b,limit)?.distance??Infinity}
 advance(player,dest,budget){
  if(!this.isOnRoad(player)||!this.isOnRoad(dest))return{used:0,reached:false};
  if(player.edge!==dest.edge){const old=this.edges[player.edge],next=this.edges[dest.edge],node=player.t<EPS?old.a:player.t>1-EPS?old.b:null;if(node===null||(next.a!==node&&next.b!==node))return{used:0,reached:false};Object.assign(player,this.point(dest.edge,next.a===node?0:1))}
  const e=this.edges[player.edge],delta=dest.t-player.t,used=Math.min(Math.abs(delta)*e.length,budget),t=clamp(player.t+Math.sign(delta)*used/e.length),before={x:player.x,z:player.z};Object.assign(player,this.point(player.edge,t));if(used>EPS)player.facing=Math.atan2(player.x-before.x,player.z-before.z);return{used,reached:Math.abs(player.t-dest.t)<EPS};
 }
 manual(player,dx,dz,budget){
  if(!this.isOnRoad(player))return false;const norm=Math.hypot(dx,dz);if(norm<EPS)return false;dx/=norm;dz/=norm;let moved=0;
  for(let step=0;step<256&&budget>EPS;step++){
   let edge=this.edges[player.edge],t=player.t,sign;
   const node=t<EPS?edge.a:t>1-EPS?edge.b:null;
   if(node!==null){let chosen=null,score=.18;for(const id of this.adj[node]){const e=this.edges[id],other=this.nodes[e.a===node?e.b:e.a],here=this.nodes[node],dot=((other.x-here.x)*dx+(other.z-here.z)*dz)/e.length;if(dot>score){score=dot;chosen={id,t:e.a===node?0:1,sign:e.a===node?1:-1}}}if(!chosen)break;Object.assign(player,this.point(chosen.id,chosen.t));edge=this.edges[player.edge];t=player.t;sign=chosen.sign;
   }else{const a=this.nodes[edge.a],b=this.nodes[edge.b],dot=((b.x-a.x)*dx+(b.z-a.z)*dz)/edge.length;if(Math.abs(dot)<.18)break;sign=Math.sign(dot)}
   const result=this.advance(player,this.point(player.edge,sign>0?1:0),budget);budget-=result.used;moved+=result.used;if(!result.reached)break;
  }return moved>EPS;
 }
 geometry(points=null){
  const g=new Geometry(),draw=(a,b,width,color,y)=>{const len=Math.hypot(b.x-a.x,b.z-a.z);if(len<EPS)return;const dx=-(b.z-a.z)/len*width,dz=(b.x-a.x)/len*width;g.quad([a.x-dx,y,a.z-dz],[a.x+dx,y,a.z+dz],[b.x+dx,y,b.z+dz],[b.x-dx,y,b.z-dz],color)};
  if(points){for(let i=1;i<points.length;i++)draw(points[i-1],points[i],.045,'#d98736',1.016)}
  else for(const e of this.edges)draw(this.nodes[e.a],this.nodes[e.b],.018,'#a7bca0',.994);
  return g;
 }
}
export async function loadRoads(fetcher=fetch){const response=await fetcher(ROAD_FILE);if(!response.ok)throw Error('內建道路檔案未載入，請按重試。');return response.json()}
