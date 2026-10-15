// Small, dependency-free WebGL renderer. All world geometry is built locally.
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const unit=a=>{const n=Math.hypot(...a)||1;return a.map(v=>v/n)};
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
function mult(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let i=0;i<4;i++)o[c*4+r]+=a[i*4+r]*b[c*4+i];return o}
function lookAt(eye,at){const z=unit(sub(eye,at)),x=unit(cross([0,1,0],z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1])}
function ortho(l,r,b,t,n,f){return new Float32Array([2/(r-l),0,0,0,0,2/(t-b),0,0,0,0,-2/(f-n),0,-(r+l)/(r-l),-(t+b)/(t-b),-(f+n)/(f-n),1])}
const color=h=>{if(Array.isArray(h))return h;h=h.replace('#','');return [0,2,4].map(n=>parseInt(h.slice(n,n+2),16)/255)};

export class Geometry{
 constructor(){this.v=[]}
 tri(a,b,c,col){const n=unit(cross(sub(b,a),sub(c,a))),co=color(col);for(const p of [a,b,c])this.v.push(...p,...n,...co)}
 quad(a,b,c,d,col){this.tri(a,b,c,col);this.tri(a,c,d,col)}
 box(x,y,z,w,h,d,col,rot=0){
  const co=Math.cos(rot),si=Math.sin(rot),p=(a,b,c)=>[x+a*co+c*si,y+b,z-a*si+c*co];
  const a=p(-w/2,0,-d/2),b=p(w/2,0,-d/2),c=p(w/2,h,-d/2),e=p(-w/2,h,-d/2),f=p(-w/2,0,d/2),g=p(w/2,0,d/2),i=p(w/2,h,d/2),j=p(-w/2,h,d/2);
  this.quad(a,e,c,b,col);this.quad(f,g,i,j,col);this.quad(a,f,j,e,col);this.quad(b,c,i,g,col);this.quad(e,j,i,c,col);this.quad(a,b,g,f,col);
 }
 cylinder(x,y,z,rx,h,rz,col,sides=14,topScale=1){
  for(let i=0;i<sides;i++){
   const a=i/sides*Math.PI*2,b=(i+1)/sides*Math.PI*2,p=t=>[x+Math.cos(t)*rx,y,z+Math.sin(t)*rz],q=t=>[x+Math.cos(t)*rx*topScale,y+h,z+Math.sin(t)*rz*topScale];
   this.quad(p(a),q(a),q(b),p(b),col);this.tri([x,y+h,z],q(b),q(a),col);
  }
 }
 sphere(x,y,z,rx,ry,rz,col,sides=12,rings=7){
  const p=(a,b)=>[x+Math.cos(a)*Math.sin(b)*rx,y+Math.cos(b)*ry,z+Math.sin(a)*Math.sin(b)*rz];
  for(let j=0;j<rings;j++)for(let i=0;i<sides;i++)this.quad(p(i/sides*Math.PI*2,j/rings*Math.PI),p((i+1)/sides*Math.PI*2,j/rings*Math.PI),p((i+1)/sides*Math.PI*2,(j+1)/rings*Math.PI),p(i/sides*Math.PI*2,(j+1)/rings*Math.PI),col);
 }
 island(x,z,rx,rz,y,col,seed=0){
  const n=70,r=(i)=>1+.035*Math.sin(i*.8+seed)+.025*Math.cos(i*1.7+seed),p=(i,k,yy)=>{const a=i/n*Math.PI*2;return[x+Math.cos(a)*rx*k*r(i),yy,z+Math.sin(a)*rz*k*r(i)]};
  for(let i=0;i<n;i++){this.tri([x,y,z],p(i+1,1,y),p(i,1,y),col);this.quad(p(i,.96,y-1.4),p(i,1,y),p(i+1,1,y),p(i+1,.96,y-1.4),'#c8b093')}
 }
 roof(x,y,z,w,d,h,col){
  const a=[x-w/2,y,z-d/2],b=[x+w/2,y,z-d/2],c=[x+w/2,y,z+d/2],e=[x-w/2,y,z+d/2],f=[x,y+h,z-d/2],g=[x,y+h,z+d/2];
  this.tri(a,b,f,col);this.tri(e,g,c,col);this.quad(a,f,g,e,col);this.quad(b,c,g,f,col);
 }
}

export class Engine{
 constructor(canvas){
  this.canvas=canvas;this.gl=canvas.getContext('webgl',{antialias:true,alpha:false,powerPreference:'high-performance'});
  if(!this.gl)throw new Error('此瀏覽器無法啟用 WebGL 3D，請開啟硬體加速或改用支援 WebGL 的瀏覽器。');
  const gl=this.gl;
  const vs=`attribute vec3 aPos;attribute vec3 aNormal;attribute vec3 aColor;uniform mat4 uMatrix;varying vec3 vColor;varying vec3 vWorld;varying vec3 vNormal;void main(){vColor=aColor;vWorld=aPos;vNormal=aNormal;gl_Position=uMatrix*vec4(aPos,1.);}`;
  const fs=`precision highp float;varying vec3 vColor;varying vec3 vWorld;varying vec3 vNormal;uniform float uTime;uniform float uWater;uniform float uNight;uniform float uMap;uniform vec2 uMapSize;uniform vec2 uMapOrigin;uniform sampler2D uTexture;void main(){if(uMap>.5){vec2 uv=vec2((vWorld.x-uMapOrigin.x)/uMapSize.x,1.-(vWorld.z-uMapOrigin.y)/uMapSize.y);gl_FragColor=vec4(texture2D(uTexture,uv).rgb,1.);return;}vec3 c=vColor;float light=.66+.34*max(dot(normalize(vNormal),normalize(vec3(-.5,1.,.7))),0.);c*=light;if(uWater>.5){float w=sin(vWorld.x*.7+uTime*.9)*sin(vWorld.z*.9-uTime*.6);float w2=sin(vWorld.x*2.+vWorld.z*1.1+uTime);c=mix(vec3(.14,.63,.70),vec3(.37,.79,.78),smoothstep(-.9,.9,w));c+=.045*smoothstep(.9,1.,w2);float fog=smoothstep(48.,110.,length(vWorld.xz));c=mix(c,vec3(.69,.84,.84),fog);}c=mix(c,c*vec3(.47,.58,.83),uNight*.65);gl_FragColor=vec4(c,1.);}`;
  const compile=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s};
  this.program=gl.createProgram();gl.attachShader(this.program,compile(gl.VERTEX_SHADER,vs));gl.attachShader(this.program,compile(gl.FRAGMENT_SHADER,fs));gl.linkProgram(this.program);
  if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));
  gl.useProgram(this.program);this.attr=['aPos','aNormal','aColor'].map(x=>gl.getAttribLocation(this.program,x));this.uniform=Object.fromEntries(['uMatrix','uTime','uWater','uNight','uMap','uMapSize','uMapOrigin','uTexture'].map(x=>[x,gl.getUniformLocation(this.program,x)]));
  gl.enable(gl.DEPTH_TEST);this.angle=.65;this.tilt=.78;this.zoom=34;this.focus=[0,0,0];this.night=0;
  this.dynamic=gl.createBuffer();this.world=null;this.water=null;this.matrix=null;this.rect=null;
  // Always bind a complete texture, including the uncovered-island illustration mode.
  this.mapTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.mapTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 }
 configureMap(bounds,coast=null){
  const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=Math.round(1536*bounds.height/bounds.width);const ctx=canvas.getContext('2d');
  ctx.fillStyle='#bbdce5';ctx.fillRect(0,0,canvas.width,canvas.height);
  if(coast){ctx.beginPath();for(const r of coast.rings){r.points.forEach((p,i)=>{const x=(p.x-bounds.minX)/bounds.width*canvas.width,y=(p.z-bounds.minZ)/bounds.height*canvas.height;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.closePath()}ctx.fillStyle='#e6ecd5';ctx.fill('evenodd')}
  const gl=this.gl;gl.bindTexture(gl.TEXTURE_2D,this.mapTexture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,canvas);
  this.mapSize=[bounds.width,bounds.height];this.mapOrigin=[bounds.minX,bounds.minZ];
  if(this.mapMesh)gl.deleteBuffer(this.mapMesh.buffer);const g=new Geometry();g.quad([bounds.minX,.85,bounds.minZ],[bounds.minX,.85,bounds.maxZ],[bounds.maxX,.85,bounds.maxZ],[bounds.maxX,.85,bounds.minZ],'#ffffff');this.mapMesh=this.upload(g);
 }
 upload(geo){const gl=this.gl,b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(geo.v),gl.STATIC_DRAW);return{buffer:b,count:geo.v.length/9}}
 setWorld(geo){if(this.world)this.gl.deleteBuffer(this.world.buffer);this.world=this.upload(geo)}
 setRoads(geo){if(this.roadMesh)this.gl.deleteBuffer(this.roadMesh.buffer);this.roadMesh=geo?this.upload(geo):null}
 setRoute(geo){if(this.routeMesh)this.gl.deleteBuffer(this.routeMesh.buffer);this.routeMesh=geo?this.upload(geo):null}
 draw(mesh,water=0,map=0){const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);this.attr.forEach((a,i)=>{gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,3,gl.FLOAT,false,36,i*12)});gl.uniform1f(this.uniform.uWater,water);gl.uniform1f(this.uniform.uMap,map);gl.drawArrays(gl.TRIANGLES,0,mesh.count)}
 render(time,dynamic){
  const gl=this.gl,c=this.canvas,dpr=Math.min(window.devicePixelRatio||1,1.8),w=Math.floor(c.clientWidth*dpr),h=Math.floor(c.clientHeight*dpr);
  if(c.width!==w||c.height!==h){c.width=w;c.height=h}gl.viewport(0,0,w,h);gl.clearColor(...(this.mapVisible?[.929,.969,1,1]:[.69,.84,.84,1]));gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);
  const f=this.focus,eye=[f[0]+Math.sin(this.angle)*55*Math.cos(this.tilt),55*Math.sin(this.tilt),f[2]+Math.cos(this.angle)*55*Math.cos(this.tilt)],aspect=w/h;
  const depth=Math.max(150,this.zoom*3);this.matrix=mult(ortho(-this.zoom*aspect,this.zoom*aspect,-this.zoom,this.zoom,-depth,depth+100),lookAt(eye,f));
  gl.uniformMatrix4fv(this.uniform.uMatrix,false,this.matrix);gl.uniform1f(this.uniform.uTime,time);gl.uniform1f(this.uniform.uNight,this.night);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.mapTexture);gl.uniform1i(this.uniform.uTexture,0);gl.uniform2f(this.uniform.uMapSize,...(this.mapSize||[1,1]));gl.uniform2f(this.uniform.uMapOrigin,...(this.mapOrigin||[0,0]));
  if(this.mapVisible&&this.mapMesh){this.draw(this.mapMesh,0,1);this.tiles?.render();if(this.roadMesh)this.draw(this.roadMesh);if(this.routeMesh)this.draw(this.routeMesh)}else if(this.water)this.draw(this.water,1);if(this.world)this.draw(this.world);
  gl.bindBuffer(gl.ARRAY_BUFFER,this.dynamic);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(dynamic.v),gl.DYNAMIC_DRAW);this.draw({buffer:this.dynamic,count:dynamic.v.length/9});
 }
 project(p){if(!this.matrix)return null;const m=this.matrix;return{x:((m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12])*.5+.5)*this.canvas.clientWidth,y:(.5-(m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13])*.5)*this.canvas.clientHeight}}
 ground(clientX,clientY,y=1.02){
  if(!this.matrix)return null;const r=this.canvas.getBoundingClientRect(),a=(clientX-r.left)/r.width*2-1,b=1-(clientY-r.top)/r.height*2,m=this.matrix;
  const e=a-m[4]*y-m[12],f=b-m[5]*y-m[13],det=m[0]*m[9]-m[8]*m[1];
  if(Math.abs(det)<1e-8)return null;return{x:(e*m[9]-m[8]*f)/det,z:(m[0]*f-e*m[1])/det};
 }
}

export const insideIsland=(x,z)=>x*x/(21.1*21.1)+z*z/(15.4*15.4)<1;
export function movePlayer(player,dx,dz,dt,speed=5.8,inside=insideIsland){
 const length=Math.hypot(dx,dz);if(!length)return false;
 const before={x:player.x,z:player.z},step=Math.min(dt,.06)*speed,x=player.x+dx/length*step,z=player.z+dz/length*step;
 // Check every traversed segment to stop fast movement tunneling across water.
 const safe=(a,b,c,d)=>{if(inside.segment)return inside.segment({x:a,z:b},{x:c,z:d});const count=Math.max(1,Math.ceil(Math.hypot(c-a,d-b)/.065));for(let i=1;i<=count;i++)if(!inside(a+(c-a)*i/count,b+(d-b)*i/count))return false;return true};
 if(safe(player.x,player.z,x,z)){player.x=x;player.z=z}else{if(safe(player.x,player.z,x,player.z))player.x=x;if(safe(player.x,player.z,player.x,z))player.z=z}
 player.facing=Math.atan2(dx,dz);return Math.hypot(player.x-before.x,player.z-before.z)>1e-7;
}

export function buildMapMarkers(nodes){
 const g=new Geometry();
 // Miniature category symbols, not surveyed buildings. One world unit is 100
 // Mercator metres: tall stems obscured whole streets in dense town centres.
 // Keep each symbol within 30m × 30m and 40m high, anchored at its source point.
 for(const n of nodes){const{x,z,record:r}=n,y=1.035;
  if(r.kind==='food'){
   // A low counter and striped canopy, with two slender supports.
   g.box(x,y,z,.24,.11,.18,'#ce8e66');
   g.box(x,y+.11,z,.26,.025,.2,'#fff2d8');
   for(const side of [-1,1])g.box(x+side*.105,y+.13,z,.018,.13,.018,'#a47756');
   for(let stripe=0;stripe<4;stripe++)g.box(x-.105+stripe*.07,y+.26,z,.07,.045,.24,stripe%2?'#fff2d8':'#c57551');
   g.box(x,y+.02,z+.092,.14,.055,.008,'#edc49b');
  }else if(r.kind==='temple'){
   // Two warm red eaves make temples distinct from shops.
   g.box(x,y,z,.23,.14,.18,'#efe2bf');
   g.box(x,y,z+.093,.065,.105,.012,'#815e4d');
   for(const side of [-1,1])g.box(x+side*.087,y,z+.093,.022,.14,.022,'#a35f4c');
   g.roof(x,y+.14,z,.30,.25,.075,'#ae6553');
   g.box(x,y+.215,z,.14,.035,.12,'#efe2bf');
   g.roof(x,y+.25,z,.22,.18,.065,'#bd7956');
  }else if(/燈塔/.test(r.name)){
   g.cylinder(x,y,z,.055,.25,.055,'#f8f1da',8,.85);
   g.cylinder(x,y+.25,z,.085,.035,.085,'#678f85',8);
   g.cylinder(x,y+.285,z,.045,.055,.045,'#e2bd72',8);
   g.cylinder(x,y+.34,z,.075,.04,.075,'#5f837a',8,0);
  }else if(/大橋|橋/.test(r.name)){
   for(const side of [-1,1])g.box(x+side*.095,y,z,.035,.11,.12,'#8aa699');
   g.box(x,y+.11,z,.29,.035,.14,'#f0e6cb');
   for(const side of [-1,1])g.box(x,y+.145,z+side*.065,.29,.045,.015,'#6d998b');
  }else if(/沙灘|海岸/.test(r.name)){
   g.cylinder(x,y,z,.14,.018,.11,'#ecd4a4',10);
   g.cylinder(x,y+.018,z,.012,.19,.012,'#a88b65',6);
   g.cylinder(x,y+.208,z,.12,.06,.12,'#7fa99a',8,0);
  }else{
   // Three small basalt columns represent the remaining island landmarks.
   for(const [dx,dz,h] of [[-.065,.025,.16],[.015,-.025,.28],[.075,.045,.20]])g.cylinder(x+dx,y,z+dz,.052,h,.052,'#7d9f91',6,.9);
  }
 }
 return g;
}

export function buildWorld(nodes,area){
 const g=new Geometry();g.island(0,0,24,18,.3,'#eddbb6');g.island(0,0,22.2,16.6,.96,'#b5c98a');
 // Winding sandy paths radiate out of a small arrival plaza.
 g.cylinder(0,.97,5,3.9,.035,3,'#e9dbb6',40);
 for(const n of nodes){const steps=Math.ceil(Math.hypot(n.x,n.z-5)/.62);for(let i=0;i<=steps;i++){const t=i/steps;g.cylinder(n.x*t,.98,5+(n.z-5)*t,.49,.02,.49,'#ded7af',9)}}
 // Coastal basalt and a stylized tidal causeway: an illustration, not surveyed terrain.
 for(let i=0;i<18;i++){const a=i*.55,x=-20+Math.sin(a)*2.4,z=-7+i*.62;g.cylinder(x,.15,z,.8,1.5+(i%4)*.33,.75,i%2?'#697d76':'#7d8d7b',6)}
 for(let i=0;i<18;i++){const t=i/17;g.cylinder(21+t*12,-.52,Math.sin(t*5)*1.5-1,.52,.37,.6,'#9d9888',7)}
 g.island(35,-2,3.7,3.2,.25,'#aeb594');for(let i=0;i<12;i++)g.cylinder(34+(i%4)*.8,.2,-3+Math.floor(i/4)*.9,.5,.8+(i%3)*.35,.5,'#687f70',6);
 for(let i=0;i<48;i++){const a=i*2.399,rx=13+(i%5)*1.4,x=Math.cos(a)*rx,z=Math.sin(a)*rx*.72;if(nodes.some(n=>Math.hypot(x-n.x,z-n.z)<3)||Math.hypot(x,z-5)<3)continue;g.cylinder(x,.99,z,.12,.55,.12,'#8f9874',6);g.sphere(x,1.9,z,.8,.9,.75,i%3?'#8da96d':'#aac38a',8,4)}
 // Small harbor, dock and waves.
 g.box(-7,.9,16.3,1.5,.2,5.2,'#c3a789');for(let i=0;i<7;i++)g.box(-7,1.12,14.1+i*.66,1.55,.05,.09,'#a68b73');
 for(let i=0;i<12;i++){const a=i*.72;g.cylinder(Math.cos(a)*24.5,-.06,Math.sin(a)*18.8,.32,.1,.5,'#e6e8cd',12)}
 for(const n of nodes){
  const{x,z,record:r}=n;g.cylinder(x,1,z,1.5,.04,1.45,'#9dbb7c',16);
  if(r.kind==='temple'){
   g.box(x,1,z,2.7,1.8,2,'#f0e4c4');g.roof(x,2.8,z,3.5,2.6,.8,'#aa6250');g.roof(x,3.38,z,2.1,1.8,.48,'#be7758');
   for(const q of [-1,1]){g.cylinder(x+q,1,z+1,.1,1.9,.1,'#b15f4c',8);g.sphere(x+q*1.75,3,z,.21,.18,.22,'#d6ba69',8,4)}
   g.box(x,1.05,z+1.03,.65,1.1,.12,'#6d7361');g.cylinder(x,1,z+1.7,.3,.48,.3,'#b99d6f',10);
  }else if(/燈塔/.test(r.name)){
   g.cylinder(x,1,z,.62,3.8,.62,'#fbf6df',16,.72);g.cylinder(x,4.8,z,.72,.22,.72,'#557e7e',16);g.cylinder(x,5.02,z,.4,.65,.4,'#e3c079',12);g.cylinder(x,5.67,z,.66,.45,.66,'#435c61',12,0);
  }else if(/大橋|橋/.test(r.name)){
   g.box(x,1.65,z,4,.3,.9,'#f3e9d3');for(const a of [-1.5,0,1.5])g.box(x+a,1,z,.17,.65,.65,'#d6cdae');for(let i=0;i<6;i++)g.box(x-1.9+i*.76,1.95,z+.4,.08,.6,.08,'#eeeece');
  }else if(/玄武岩|海蝕|風櫃|石/.test(r.name)){
   for(let i=0;i<11;i++)g.cylinder(x+(i%4)*.55-.8,1,z+Math.floor(i/4)*.6-.5,.38,1.3+(i%4)*.4,.38,'#6e8178',6);
  }else if(/沙灘|海岸/.test(r.name)){
   g.cylinder(x,1,z,2,.08,1.5,'#f2d4a2',22);g.cylinder(x+.4,1.1,z,.07,1.5,.07,'#b99978',8);g.cylinder(x+.4,2.6,z,1,.45,1,'#d59079',12,0);
  }else if(/水族館/.test(r.name)){
   g.box(x,1,z,3,1.5,2,'#eef2d2');g.roof(x,2.5,z,3.3,2.3,.8,'#77a9ac');g.box(x,1.4,z+1.03,2.6,.7,.06,'#82b7b5');
  }else{
   g.box(x,1,z,2.2,1.4,1.8,'#e8ddbd');g.roof(x,2.4,z,2.7,2.2,.75,'#a68b70');g.box(x,1.1,z+.93,.6,.9,.06,'#7a9385');
  }
 }
 // Arrival sign and tiny luggage crate.
 g.box(0,1.05,7,.14,1.3,.14,'#a18d71');g.box(0,2,7,1.8,.65,.13,'#f4edcf');g.box(2,1.06,7,.6,.55,.45,'#c29067');
 return g;
}

