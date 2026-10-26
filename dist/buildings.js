// 立體建築試驗：把建物輪廓拉高成方塊。只畫熊寶／鏡頭附近、拉近時才畫，避免手機負擔過重。
// 輪廓不平移；高度多為推估示意值（見 geo/penghu-buildings-*.json 的 note）。
export const BUILDINGS_FILE='geo/penghu-buildings-20261021.json';
const CHUNK=10;          // 每格 10 世界單位＝1 公里
const BASE=.985;         // 底圖圖磚在 y=.98，建物底部略高一點
export const EXAG=1.5;   // 高度誇大倍數，讓澎湖低矮的房子看得出立體
export const MAX_ZOOM=24;// 視野半高超過 2.4 公里就不畫

const hex=h=>[0,2,4].map(n=>parseInt(h.slice(n+1,n+3),16)/255);
const STYLE=[{wall:hex('#efe7d8'),roof:hex('#d9d1c3')},{wall:hex('#efe0bc'),roof:hex('#b9694f')}];

/* 簡單的耳切法三角化（輪廓已統一方向） */
export function triangulate(xs,zs){
  const n=xs.length,idx=[...Array(n).keys()],out=[];
  let area=0;for(let i=0;i<n;i++){const j=(i+1)%n;area+=xs[i]*zs[j]-xs[j]*zs[i]}
  const sgn=area<0?-1:1,cr=(a,b,c)=>((xs[b]-xs[a])*(zs[c]-zs[a])-(zs[b]-zs[a])*(xs[c]-xs[a]))*sgn;
  const inTri=(p,a,b,c)=>cr(a,b,p)>=0&&cr(b,c,p)>=0&&cr(c,a,p)>=0;
  let guard=0;
  while(idx.length>3&&guard++<n*n){
    let cut=false;
    for(let i=0;i<idx.length;i++){
      const a=idx[(i+idx.length-1)%idx.length],b=idx[i],c=idx[(i+1)%idx.length];
      if(cr(a,b,c)<=0)continue;
      if(idx.some(p=>p!==a&&p!==b&&p!==c&&inTri(p,a,b,c)))continue;
      out.push(a,b,c);idx.splice(i,1);cut=true;break;
    }
    if(!cut)break;
  }
  if(idx.length===3)out.push(...idx);
  else if(idx.length>3)for(let i=1;i<idx.length-1;i++)out.push(idx[0],idx[i],idx[i+1]); // 退而求其次：扇形
  return out;
}

export class Buildings{
  constructor(engine,data){
    this.engine=engine;this.chunks=new Map();this.count=0;
    for(const b of data.buildings){
      const [h,kind,,...flat]=b,xs=[],zs=[];for(let i=0;i<flat.length;i+=2){xs.push(flat[i]);zs.push(flat[i+1])}
      const cx=xs.reduce((s,v)=>s+v,0)/xs.length,cz=zs.reduce((s,v)=>s+v,0)/zs.length,key=Math.floor(cx/CHUNK)+','+Math.floor(cz/CHUNK);
      if(!this.chunks.has(key))this.chunks.set(key,{cx:(Math.floor(cx/CHUNK)+.5)*CHUNK,cz:(Math.floor(cz/CHUNK)+.5)*CHUNK,items:[],mesh:null});
      this.chunks.get(key).items.push({h:h/100*EXAG,kind,xs,zs});this.count++;
    }
  }
  build(chunk){
    const v=[];
    const push=(x,y,z,n,c)=>v.push(x,y,z,n[0],n[1],n[2],c[0],c[1],c[2]);
    for(const b of chunk.items){
      const {xs,zs,h}=b,s=STYLE[b.kind],top=BASE+h,n=xs.length;
      // 牆面：每邊一個四邊形，法線朝外
      for(let i=0;i<n;i++){
        const j=(i+1)%n,dx=xs[j]-xs[i],dz=zs[j]-zs[i],len=Math.hypot(dx,dz)||1,nm=[-dz/len,0,dx/len];
        const shade=s.wall;
        push(xs[i],BASE,zs[i],nm,shade);push(xs[j],BASE,zs[j],nm,shade);push(xs[j],top,zs[j],nm,shade);
        push(xs[i],BASE,zs[i],nm,shade);push(xs[j],top,zs[j],nm,shade);push(xs[i],top,zs[i],nm,shade);
      }
      // 屋頂
      const t=triangulate(xs,zs);
      for(const k of t)push(xs[k],top,zs[k],[0,1,0],s.roof);
    }
    const gl=this.engine.gl,buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(v),gl.STATIC_DRAW);
    chunk.mesh={buffer:buf,count:v.length/9};
  }
  visible(){
    const e=this.engine;if(!e.mapVisible||e.zoom>MAX_ZOOM)return [];
    const c=e.canvas,aspect=Math.max(1,c.clientWidth/Math.max(1,c.clientHeight)),r=e.zoom*aspect*2.2+CHUNK,f=e.focus;
    return [...this.chunks.values()].filter(k=>Math.hypot(k.cx-f[0],k.cz-f[2])<r);
  }
  render(){
    let built=0;
    for(const k of this.visible()){
      if(!k.mesh){if(built>=3)continue;this.build(k);built++} // 每幀最多新建 3 格，避免卡頓
      this.engine.draw(k.mesh);
    }
  }
}

export async function loadBuildings(engine,fetcher=globalThis.fetch){
  try{const res=await fetcher(BUILDINGS_FILE);if(!res.ok)return null;return new Buildings(engine,await res.json())}catch{return null}
}
