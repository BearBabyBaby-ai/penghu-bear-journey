import {Geometry} from './engine.js?v=20261025-3d1';
import {MAP,WORLD_METRES,LAYERS,tileAt,tileBounds} from './map.js?v=20261015-travel8';
// Browser requests only the current viewport; no raster tiles are bundled or prefetched.
export class TileMap{
 constructor(engine,onStatus=()=>{}){this.engine=engine;this.layer='nlsc';this.cache=new Map();this.active=0;this.onStatus=onStatus;this.lastStatus='';this.lastUpdate=0;this.visible=[]}
 setLayer(layer){if(!LAYERS[layer])return;this.layer=layer;this.lastUpdate=0;this.lastStatus='';this.report('載入底圖…')}
 report(s){if(s!==this.lastStatus){this.lastStatus=s;this.onStatus(s)}}
 update(){
  const e=this.engine,c=e.canvas,r=c.getBoundingClientRect(),points=[[r.left,r.top],[r.right,r.top],[r.left,r.bottom],[r.right,r.bottom]].map(([x,y])=>e.ground(x,y,.98)).filter(Boolean);
  if(points.length!==4)return;
  const mpp=2*e.zoom*WORLD_METRES/Math.max(1,c.clientHeight);let z=Math.max(9,Math.min(18,Math.round(Math.log2(40075016.6856/(256*mpp)))));
  const range=()=>({a:tileAt(z,Math.max(MAP.minX,Math.min(...points.map(p=>p.x))),Math.max(MAP.minZ,Math.min(...points.map(p=>p.z)))),b:tileAt(z,Math.min(MAP.maxX,Math.max(...points.map(p=>p.x))),Math.min(MAP.maxZ,Math.max(...points.map(p=>p.z))))});
  let {a,b}=range();while(z>9&&(b.x-a.x+1)*(b.y-a.y+1)>48){z--;({a,b}=range())}
  const visible=[];for(let y=a.y;y<=b.y;y++)for(let x=a.x;x<=b.x;x++)visible.push({z,x,y,key:`${this.layer}/${z}/${x}/${y}`});
  // Projection/viewport mistakes must never trigger a large tile download.
  this.visible=visible.length<=48?visible.sort((p,q)=>(p.x-(a.x+b.x)/2)**2+(p.y-(a.y+b.y)/2)**2-((q.x-(a.x+b.x)/2)**2+(q.y-(a.y+b.y)/2)**2)):[];
  for(const t of this.visible){let entry=this.cache.get(t.key);if(!entry){entry={...t,layer:this.layer,state:'queued'};this.cache.set(t.key,entry)}entry.used=performance.now()}
  const wanted=new Set(this.visible.map(t=>t.key));for(const [key,t] of this.cache)if(!wanted.has(key)&&t.state==='queued')this.cache.delete(key);
  for(const t of this.visible){const entry=this.cache.get(t.key);if(this.active>=6)break;if(entry.state==='queued')this.load(entry)}
  const ready=this.visible.filter(t=>this.cache.get(t.key)?.state==='ready').length,failed=this.visible.filter(t=>this.cache.get(t.key)?.state==='error').length;
  this.report(failed?`${failed} 張底圖未載入，可切換另一來源`:(ready<this.visible.length?'載入底圖…':''));
  if(this.cache.size>96){const stale=[...this.cache.values()].filter(t=>!wanted.has(t.key)&&t.state!=='loading').sort((a,b)=>a.used-b.used);for(const t of stale){if(this.cache.size<=96)break;if(t.texture)e.gl.deleteTexture(t.texture);if(t.mesh)e.gl.deleteBuffer(t.mesh.buffer);this.cache.delete(t.key)}}
 }
 load(t){
  t.state='loading';this.active++;const img=new Image();img.crossOrigin='anonymous';let settled=false;const finish=()=>{if(settled)return false;settled=true;clearTimeout(timer);this.active--;return true};const timer=setTimeout(()=>{if(finish()){t.state='error';img.src=''}},15000);timer.unref?.();
  img.onload=()=>{if(!finish())return;try{const gl=this.engine.gl;t.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t.texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
   t.bounds=tileBounds(t.z,t.x,t.y);const b=t.bounds,g=new Geometry();g.quad([b.minX,.98,b.minZ],[b.minX,.98,b.maxZ],[b.maxX,.98,b.maxZ],[b.maxX,.98,b.minZ],'#ffffff');t.mesh=this.engine.upload(g);t.state='ready';
  }catch{t.state='error'}};
  img.onerror=()=>{if(finish())t.state='error'};img.src=LAYERS[t.layer].url(t.z,t.x,t.y);
 }
 retry(){for(const [k,t]of this.cache)if(t.state==='error')this.cache.delete(k);this.lastUpdate=0}
 render(){
  if(performance.now()-this.lastUpdate>150){this.update();this.lastUpdate=performance.now()}
  const e=this.engine,gl=e.gl;
  for(const t of this.visible){const entry=this.cache.get(t.key);if(entry?.state!=='ready')continue;const b=entry.bounds;gl.bindTexture(gl.TEXTURE_2D,entry.texture);gl.uniform2f(e.uniform.uMapSize,b.maxX-b.minX,b.maxZ-b.minZ);gl.uniform2f(e.uniform.uMapOrigin,b.minX,b.minZ);e.draw(entry.mesh,0,1)}
 }
}
