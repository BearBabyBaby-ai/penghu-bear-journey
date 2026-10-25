// 「我的位置」導航：開著定位選目的地時，路線從使用者的實際位置規劃，
// 依每次定位把使用者對到路線上，算出已走距離、剩餘距離與是否偏離路線。
// 本檔只做路線計算，不移動熊寶（熊寶仍由 game.js 沿收錄道路跟著使用者）。
import {Geometry} from './engine.js?v=20261025-3d1';

export class GpsNav{
  constructor(plan,end,meta={}){
    this.plan=plan;this.end={...end};this.meta=meta;this.pts=[];this.s=0;this.off=0;this.lastLat=0;
    let s=0,prev=null;
    for(const leg of plan.legs)for(const p of leg.points){
      if(prev){const d=Math.hypot(p.x-prev.x,p.z-prev.z);if(d<1e-9){continue}s+=d}
      this.pts.push({x:p.x,z:p.z,s,type:leg.type});prev=p;
    }
    this.total=s;
  }
  /* 把位置投影到路線上：先在目前進度附近（往回 back、往前 ahead 世界單位）找，找不到再全段找 */
  locate(p,back=.6,ahead=6){
    const near=this.project(p,this.s-back,this.s+ahead);
    if(near&&near.d<.45)return near;
    const all=this.project(p,-Infinity,Infinity);return !near||all&&all.d<near.d?all:near;
  }
  project(p,from,to){
    let best=null;
    for(let i=0;i<this.pts.length-1;i++){
      const A=this.pts[i],B=this.pts[i+1];if(B.s<from||A.s>to)continue;
      const dx=B.x-A.x,dz=B.z-A.z,L=B.s-A.s;if(L<1e-9)continue;
      const t=Math.max(0,Math.min(1,((p.x-A.x)*dx+(p.z-A.z)*dz)/(L*L))),x=A.x+dx*t,z=A.z+dz*t,d=Math.hypot(p.x-x,p.z-z);
      if(!best||d<best.d)best={s:A.s+t*L,d,x,z,dir:{x:dx/L,z:dz/L},type:B.type};
    }
    return best;
  }
  /* 每次定位呼叫：unit＝每世界單位公尺數，tol＝離路線多遠算偏離（公尺） */
  update(p,unit,tol=40){
    const r=this.locate(p);if(!r)return null;
    this.lastLat=r.d*unit;
    /* 進度只往前：定位飄移造成的小倒退不算；往回走超過約 27 公尺視同偏離，之後重新規劃 */
    if(this.lastLat<=tol&&r.s>=this.s-.3){this.off=0;this.s=Math.max(this.s,r.s)}else this.off++;
    return r;
  }
  remaining(){return Math.max(0,this.total-this.s)}
  arrived(unit,within=30){return this.remaining()*unit<=within}
  point(s){
    s=Math.max(0,Math.min(this.total,s));
    for(let i=0;i<this.pts.length-1;i++){const A=this.pts[i],B=this.pts[i+1];if(s<=B.s){const L=B.s-A.s||1,t=(s-A.s)/L;return{x:A.x+(B.x-A.x)*t,z:A.z+(B.z-A.z)*t,type:B.type}}}
    const q=this.pts[this.pts.length-1];return{x:q.x,z:q.z,type:q.type};
  }
  /* 從 s 起往前的陸路（遇到港口／船段就停），給測速提醒用 */
  ahead(from,length){
    const out=[this.point(from)];if(out[0].type&&out[0].type!=='walk')return null;
    for(const q of this.pts){if(q.s<=from)continue;if(q.type!=='walk'||q.s-from>length)break;out.push({x:q.x,z:q.z})}
    if(out.length<2){const end=this.point(Math.min(this.total,from+length));if(end.type!=='walk')return null;out.push({x:end.x,z:end.z})}
    return out;
  }
  /* 從目前進度起的路線（橘線＝道路、虛線＝船），與熊寶自動前往同樣的畫法 */
  geometry(){
    const g=new Geometry(),pts=[this.point(this.s),...this.pts.filter(q=>q.s>this.s)];
    for(let i=0;i<pts.length-1;i++){
      const a=pts[i],b=pts[i+1],type=b.type,d=Math.hypot(b.x-a.x,b.z-a.z);if(d<1e-8)continue;
      const nx=-(b.z-a.z)/d*.045,nz=(b.x-a.x)/d*.045,steps=type==='ferry'?Math.ceil(d/.8):1,col=type==='ferry'?'#468fa7':'#d98736';
      for(let k=0;k<steps;k++){const t=k/steps,u=Math.min(1,(k+(type==='ferry'?.6:1))/steps),p={x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t},q={x:a.x+(b.x-a.x)*u,z:a.z+(b.z-a.z)*u};g.quad([p.x-nx,1.016,p.z-nz],[p.x+nx,1.016,p.z+nz],[q.x+nx,1.016,q.z+nz],[q.x-nx,1.016,q.z-nz],col)}
    }
    return g;
  }
}
