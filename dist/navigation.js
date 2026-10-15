import {MAP} from './map.js?v=20261015-travel8';
const SQRT2=Math.SQRT2;
export class LandNavigation{
 constructor(data,grid=null){
  this.coast=data.rings?data:null;
  if(grid){if(grid.sourceVersion!==this.coast?.meta.version||grid.cell!==.65||grid.runs?.length!==grid.height)throw Error("陸域導航資料不完整");data=grid;}
  this.cell=data.cell||.65;this.minX=data.minX??MAP.minX;this.minZ=data.minZ??MAP.minZ;
  this.w=data.width||Math.ceil(MAP.width/this.cell);this.h=data.height||Math.ceil(MAP.height/this.cell);
  const size=this.w*this.h;this.walk=new Uint8Array(size);this.components=new Int32Array(size);
  if(data.runs){for(let y=0;y<this.h;y++){const row=data.runs[y];if(row.length%2)throw Error("陸域導航資料不完整");for(let k=0;k<row.length;k+=2){const a=row[k],b=row[k+1];if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b>this.w||a>=b)throw Error("陸域導航資料範圍錯誤");this.walk.fill(1,y*this.w+a,y*this.w+b)}}}
  else if(data.rows){for(let y=0;y<this.h;y++)for(let x=0;x<this.w;x++)this.walk[y*this.w+x]=data.rows[y][x]==='1'?1:0}
  else{
   // Scanline rasterization accelerates paths. Collision still tests exact vectors.
   for(let y=0;y<this.h;y++){const z=this.minZ+(y+.5)*this.cell,hits=[];
    for(const ring of this.coast.rings){if(z<ring.minZ||z>=ring.maxZ)continue;const p=ring.points;for(let i=0,j=p.length-1;i<p.length;j=i++)if((p[i].z>z)!==(p[j].z>z))hits.push(p[i].x+(z-p[i].z)*(p[j].x-p[i].x)/(p[j].z-p[i].z))}
    hits.sort((a,b)=>a-b);for(let k=0;k+1<hits.length;k+=2){const left=Math.max(0,Math.ceil((hits[k]-this.minX)/this.cell-.5)),right=Math.min(this.w,Math.ceil((hits[k+1]-this.minX)/this.cell-.5));this.walk.fill(1,y*this.w+left,y*this.w+right)}
   }
  }
  const queue=new Int32Array(size);let component=0;
  for(let start=0;start<size;start++)if(this.walk[start]&&!this.components[start]){
   component++;let head=0,end=1;queue[0]=start;this.components[start]=component;
   while(head<end){const i=queue[head++],x=i%this.w,y=Math.floor(i/this.w);for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]]){const nx=x+dx,ny=y+dy,j=ny*this.w+nx;if(nx<0||ny<0||nx>=this.w||ny>=this.h||!this.walk[j]||this.components[j])continue;this.components[j]=component;queue[end++]=j}}
  }
  this.componentCount=component;this.isLand.segment=(a,b)=>this.segment(a,b);
 }
 index(x,z){const px=Math.floor((x-this.minX)/this.cell),py=Math.floor((z-this.minZ)/this.cell);return px<0||py<0||px>=this.w||py>=this.h?-1:py*this.w+px}
 point(i){return{x:(i%this.w+.5)*this.cell+this.minX,z:(Math.floor(i/this.w)+.5)*this.cell+this.minZ}}
 isLand=(x,z)=>{if(this.coast)return this.coast.isLand(x,z);const i=this.index(x,z);return i>=0&&!!this.walk[i]};
 componentAt(x,z){const i=this.index(x,z);return i<0?0:this.components[i]}
 snap(x,z,requiredComponent=0,maxDistance=4){
  if(this.isLand(x,z)&&(!requiredComponent||this.componentAt(x,z)===requiredComponent))return{x,z};
  const cx=Math.floor((x-this.minX)/this.cell),cy=Math.floor((z-this.minZ)/this.cell),radius=Math.ceil(maxDistance/this.cell);let best=maxDistance*maxDistance,near=null;
  for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){const px=cx+dx,py=cy+dy,i=py*this.w+px;if(px<0||py<0||px>=this.w||py>=this.h||!this.walk[i]||(requiredComponent&&this.components[i]!==requiredComponent))continue;const p=this.point(i),d=(p.x-x)**2+(p.z-z)**2;if(d<best&&this.isLand(p.x,p.z)){best=d;near=p}}
  return near;
 }
 segment(a,b){if(this.coast)return this.coast.segment(a,b);const d=Math.hypot(b.x-a.x,b.z-a.z),steps=Math.max(1,Math.ceil(d/(Math.min(this.cell*.25,.04))));for(let k=0;k<=steps;k++){const t=k/steps;if(!this.isLand(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t))return false}return true}
 path(a,b){
  const start=this.index(a.x,a.z),end=this.index(b.x,b.z);
  if(start<0||end<0||!this.walk[start]||!this.walk[end]||this.components[start]!==this.components[end])return null;
  if(!this.segment(a,this.point(start))||!this.segment(this.point(end),b))return null;
  if(this.segment(a,b))return[{x:b.x,z:b.z}];
  const n=this.walk.length,cost=new Float64Array(n).fill(Infinity),parent=new Int32Array(n).fill(-1),closed=new Uint8Array(n),heap=[];
  const push=(i,f)=>{let k=heap.length;heap.push({i,f});while(k>0){const p=(k-1)>>1;if(heap[p].f<=f)break;heap[k]=heap[p];k=p}heap[k]={i,f}};
  const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){let k=0;while(k*2+1<heap.length){let c=k*2+1;if(c+1<heap.length&&heap[c+1].f<heap[c].f)c++;if(heap[c].f>=last.f)break;heap[k]=heap[c];k=c}heap[k]=last}return top.i};
  const ex=end%this.w,ey=Math.floor(end/this.w),heuristic=i=>Math.hypot(i%this.w-ex,Math.floor(i/this.w)-ey);
  cost[start]=0;push(start,heuristic(start));
  while(heap.length){const i=pop();if(closed[i])continue;if(i===end){
    const path=[];for(let j=end;j!==start;j=parent[j])path.push(this.point(j));path.reverse();path.unshift(this.point(start));path.push({x:b.x,z:b.z});
    // Simplify only where the entire line segment remains on land.
    const out=[];let origin=a,k=0;while(k<path.length){let far=k;while(far+1<path.length&&this.segment(origin,path[far+1]))far++;out.push(path[far]);origin=path[far];k=far+1}return out;
   }
   closed[i]=1;const x=i%this.w,y=Math.floor(i/this.w);
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy,j=ny*this.w+nx;if(nx<0||ny<0||nx>=this.w||ny>=this.h||!this.walk[j]||closed[j])continue;
    if(dx&&dy&&(!this.walk[y*this.w+nx]||!this.walk[ny*this.w+x]))continue;
    if(this.coast&&!this.segment(this.point(i),this.point(j)))continue;
    const next=cost[i]+(dx&&dy?SQRT2:1);if(next<cost[j]){cost[j]=next;parent[j]=i;push(j,next+heuristic(j))}
   }
  }
  return null;
 }
}
