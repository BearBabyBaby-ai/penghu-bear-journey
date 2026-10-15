// Reproducible game ferry corridors. Official sources identify the ports and
// connections; exact sea polylines below are generated from the packaged mask,
// not surveyed shipping channels, sailing schedules, or real navigation advice.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {geoToWorld,worldToGeo} from '../dist/map.js';
import {Coastline} from '../dist/coastline.js';
import {RoadNavigation} from '../dist/roads.js';
import {LandNavigation} from '../dist/navigation.js';
const read=f=>JSON.parse(fs.readFileSync('dist/'+f));
const text=fs.readFileSync('dist/geo/penghu-land-20260407.geojson','utf8'),coast=new Coastline(JSON.parse(text));
const roads=new RoadNavigation(read('geo/penghu-roads-20211217.json'),coast),grid=read('geo/penghu-grid-20260407.json');
const runs=grid.runs.map(row=>{const out=[];let end=0;for(let i=0;i<row.length;i+=2){if(row[i]>end)out.push(end,row[i]);end=row[i+1]}if(end<grid.width)out.push(end,grid.width);return out});
const sea=new LandNavigation({...grid,runs});sea.coast={isLand:(x,z)=>!coast.isLand(x,z),segment:(a,b)=>coast.seaSegment(a,b)};
const definitions=[
 {id:'magong',name:'馬公南海交通船碼頭',area:'馬公市',geo:[119.57115227484034,23.567073895790582],reference:'https://auth.penghu-go.tw/portIntro/detail?testflag=boat&uuid=7caf3e1a-e3f7-4880-a14e-a57681adb98f',positionNote:'官方候船室嵌入地圖的參考中心；不是實測泊位'},
 {id:'wangan',name:'望安潭門港',area:'望安鄉',geo:[119.50734248262197,23.36173485500874],reference:'https://auth.penghu-go.tw/portIntro/detail?testflag=boat&uuid=5c6d0f4c-aa8e-45e9-ae8d-34128c5f75d9',positionNote:'官方潭門港嵌入地圖的參考中心；不是實測泊位'},
 {id:'qimei',name:'七美南滬港',area:'七美鄉',geo:[119.418851,23.195879],reference:'https://www.cga.gov.tw/GipOpen/wSite/public/Attachment/f114070806.pdf',positionNote:'七美漁港安檢所座標，南港村南滬26之3，鄰近26之4候船處；不是實測泊位'}
];
const ports=definitions.map(port=>{
 const centre=geoToWorld(...port.geo),road=roads.snap(centre.x,centre.z);if(!road)throw Error(port.id+' road missing');
 let best=null,score=Infinity;const i=sea.index(centre.x,centre.z),cx=i%sea.w,cy=Math.floor(i/sea.w);
 for(let dz=-5;dz<=5;dz++)for(let dx=-5;dx<=5;dx++){
  const cell=(cy+dz)*sea.w+cx+dx,p=sea.point(cell);if(!sea.walk[cell]||sea.components[cell]!==1||coast.isLand(p.x,p.z))continue;
  const length=Math.hypot(p.x-road.x,p.z-road.z);if(length>1.5||length>=score)continue;
  // A short port transfer may cross the shore once, never another island.
  let changes=0,previous=coast.isLand(road.x,road.z);for(let n=1;n<=100;n++){const land=coast.isLand(road.x+(p.x-road.x)*n/100,road.z+(p.z-road.z)*n/100);if(land!==previous)changes++;previous=land}
  if(changes!==1)continue;best=p;score=length;
 }
 if(!best)throw Error(port.id+' no short boarding connector');
 const seaGeo=worldToGeo(best.x,best.z);return{...port,road:{edge:road.edge,t:road.t},seaGeo:[seaGeo.lng,seaGeo.lat],transferMetres:score*100};
});
const links=[];for(const [from,to]of [['magong','wangan'],['wangan','qimei']]){
 const a=ports.find(p=>p.id===from),b=ports.find(p=>p.id===to),start=geoToWorld(...a.seaGeo),end=geoToWorld(...b.seaGeo),path=sea.path(start,end);if(!path)throw Error(from+'→'+to+' sea route missing');
 let previous=start;for(const p of path){if(!coast.seaSegment(previous,p))throw Error('Sea corridor crosses land');previous=p}
 links.push({from,to,points:[start,...path].map(p=>{const geo=worldToGeo(p.x,p.z);return[geo.lng,geo.lat]})});
}
const output={version:'penghu-ferry-game-20261015-v1',readAt:'2026-10-15',landSHA256:crypto.createHash('sha256').update(text).digest('hex'),routeReference:'https://www.phpto.gov.tw/home.jsp?id=106',notice:'遊戲航線與港區登船示意，非實測航道；不代表即時船班、票價或通航狀態。',ports,links};
fs.writeFileSync('dist/geo/penghu-ferries-20261015.json',JSON.stringify(output));
console.log(ports.map(p=>({port:p.name,transferMetres:p.transferMetres})),links.map(l=>({from:l.from,to:l.to,points:l.points.length})));
