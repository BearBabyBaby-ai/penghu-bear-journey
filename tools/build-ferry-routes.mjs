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
// 只採用與外海相連的海面格（港內被防波堤圍住、走不出去的格子不能當登船點）
const openSea=(()=>{const o=geoToWorld(119.45,23.45),s0=sea.index(o.x,o.z),seen=new Uint8Array(sea.walk.length),q=[s0];seen[s0]=1;
 while(q.length){const i=q.pop(),x=i%sea.w,y=Math.floor(i/sea.w);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy,j=ny*sea.w+nx;if(nx<0||ny<0||nx>=sea.w||ny>=sea.h||!sea.walk[j]||seen[j])continue;if(dx&&dy&&(!sea.walk[y*sea.w+nx]||!sea.walk[ny*sea.w+x]))continue;if(!sea.segment(sea.point(i),sea.point(j)))continue;seen[j]=1;q.push(j)}}
 return seen})();
const definitions=[
 {id:'magong',name:'馬公南海交通船碼頭',area:'馬公市',geo:[119.57115227484034,23.567073895790582],reference:'https://auth.penghu-go.tw/portIntro/detail?testflag=boat&uuid=7caf3e1a-e3f7-4880-a14e-a57681adb98f',positionNote:'官方候船室嵌入地圖的參考中心；依使用者指正（2026-10-16），南海諸島（望安、七美、桶盤、虎井）交通船由南海遊客中心「右側（東側）」出發，上船點 board 設在遊客中心東南側岸邊道路；不是實測泊位',board:[119.57196,23.56626]},
 {id:'wangan',name:'望安潭門港',area:'望安鄉',geo:[119.50734248262197,23.36173485500874],reference:'https://auth.penghu-go.tw/portIntro/detail?testflag=boat&uuid=5c6d0f4c-aa8e-45e9-ae8d-34128c5f75d9',positionNote:'官方潭門港嵌入地圖的參考中心；不是實測泊位'},
 {id:'qimei',name:'七美南滬港',area:'七美鄉',geo:[119.418851,23.195879],reference:'https://www.cga.gov.tw/GipOpen/wSite/public/Attachment/f114070806.pdf',positionNote:'七美漁港安檢所座標，南港村南滬26之3，鄰近26之4候船處；不是實測泊位'},
 {id:'chikan',name:'赤崁漁港（北海遊客中心）',area:'白沙鄉',geo:[119.60296,23.668020],reference:'https://www.cga.gov.tw/GipOpen/wSite/public/Attachment/f114070806.pdf',positionNote:'海巡署赤崁漁港安檢所座標（白沙鄉赤崁村37-3號）；白沙鄉公所交通船「白沙之星」赤崁⇄吉貝；不是實測泊位'},
 {id:'jibei',name:'吉貝漁港',area:'白沙鄉',geo:[119.613771,23.740449],reference:'https://www.cga.gov.tw/GipOpen/wSite/public/Attachment/f114070806.pdf',positionNote:'海巡署吉貝漁港安檢所座標（白沙鄉吉貝村8-14號）；港池被防波堤圍住，港區接駁放寬至約200公尺；不是實測泊位',maxTransfer:2},
 {id:'qitou',name:'岐頭漁港',area:'白沙鄉',geo:[119.610187,23.649004],reference:'https://www.cga.gov.tw/GipOpen/wSite/public/Attachment/f114070806.pdf',positionNote:'海巡署岐頭漁港安檢所座標（白沙鄉岐頭村1-3號）；白沙鄉公所交通船「鳥嶼號」岐頭⇄鳥嶼、「員貝號」岐頭⇄員貝；不是實測泊位'},
 {id:'niaoyu',name:'鳥嶼漁港',area:'白沙鄉',geo:[119.656845,23.660071],reference:'https://www.cga.gov.tw/GipOpen/wSite/public/Attachment/f114070806.pdf',positionNote:'海巡署鳥嶼漁港安檢所座標（白沙鄉鳥嶼村211號之1）；不是實測泊位'},
 {id:'chongguang',name:'重光碼頭',area:'馬公市',geo:[119.5714334,23.5846237],reference:'https://chyfun.com/penghu-transport-island/',positionNote:'海巡署名冊無重光安檢所；以旅遊資訊「碼頭在重光威靈殿後方」，採熊熊綜合系統廟宇表「重光-威靈殿」座標為參考點，再找最近道路與外海；白沙鄉公所交通船「大倉號」重光⇄大倉；不是實測泊位'},
 {id:'dacang',name:'大倉漁港',area:'白沙鄉',geo:[119.569955,23.618104],reference:'https://www.cga.gov.tw/GipOpen/wSite/public/Attachment/f114070806.pdf',positionNote:'海巡署大倉漁港安檢所座標（白沙鄉大倉村1-1號）；不是實測泊位'},
 {id:'tongpan',name:'桶盤漁港',area:'馬公市',geo:[119.518222,23.511532],reference:'https://www.cga.gov.tw/GipOpen/wSite/public/Attachment/f114070806.pdf',positionNote:'海巡署桶盤漁港安檢所座標（馬公市桶盤里29之1號）；馬公市公所委託交通船「桶盤之星」南海遊客中心⇄桶盤；不是實測泊位'},
 {id:'hujing',name:'虎井漁港',area:'馬公市',geo:[119.517871,23.486939],reference:'https://www.cga.gov.tw/GipOpen/wSite/public/Attachment/f114070806.pdf',positionNote:'海巡署虎井漁港安檢所座標（馬公市虎井里76-3號）；馬公市公所交通船南海遊客中心⇄虎井；不是實測泊位'},
 {id:'yuanbei',name:'員貝漁港',area:'白沙鄉',geo:[119.631760,23.647280],reference:'https://www.cga.gov.tw/GipOpen/wSite/public/Attachment/f114070806.pdf',positionNote:'海巡署員貝漁港安檢所座標（白沙鄉員貝村6鄰22之3號）；不是實測泊位'},
];
const ports=definitions.map(port=>{
 // board：上船點（使用者指正的實際出發側）；沒有就用官方參考中心
 const centre=geoToWorld(...(port.board||port.geo)),road=roads.snap(centre.x,centre.z);if(!road)throw Error(port.id+' road missing');
 if(Math.hypot(road.x-centre.x,road.z-centre.z)>3)throw Error(port.id+' nearest road is too far from the official port reference');
 let best=null,score=Infinity;const i=sea.index(centre.x,centre.z),cx=i%sea.w,cy=Math.floor(i/sea.w);
 const limit=port.maxTransfer||1.5,reach=Math.ceil(limit/sea.cell)+2;
 for(let dz=-reach;dz<=reach;dz++)for(let dx=-reach;dx<=reach;dx++){
  const cell=(cy+dz)*sea.w+cx+dx,p=sea.point(cell);if(!sea.walk[cell]||sea.components[cell]!==1||!openSea[cell]||coast.isLand(p.x,p.z))continue;
  const length=Math.hypot(p.x-road.x,p.z-road.z);if(length>limit||length>=score)continue;
  // A short port transfer may cross the shore once, never another island.
  let changes=0,previous=coast.isLand(road.x,road.z);for(let n=1;n<=100;n++){const land=coast.isLand(road.x+(p.x-road.x)*n/100,road.z+(p.z-road.z)*n/100);if(land!==previous)changes++;previous=land}
  if(changes!==1)continue;best=p;score=length;
 }
 if(!best)throw Error(port.id+' no short boarding connector');
 const seaGeo=worldToGeo(best.x,best.z);const {maxTransfer,board,...clean}=port;return{...clean,road:{edge:road.edge,t:road.t},seaGeo:[seaGeo.lng,seaGeo.lat],transferMetres:score*100};
});
// 航線與營運資訊（只寫官方或已查證資料；船名未查證者留空，不推測）
const COUNTY='https://www.phpto.gov.tw/home.jsp?id=106',BAISHA='https://www.baisha.gov.tw/ch/home.jsp?id=113',MAGONG='https://www.penghu.gov.tw/Tmakun/ch/home.jsp?id=247';
const ROUTES=[
 {from:'magong',to:'wangan',operator:'澎湖縣政府公共車船管理處',vessel:'',source:COUNTY},
 {from:'wangan',to:'qimei',operator:'澎湖縣政府公共車船管理處',vessel:'',source:COUNTY},
 {from:'chikan',to:'jibei',operator:'白沙鄉公所',vessel:'白沙之星',source:BAISHA},
 {from:'qitou',to:'niaoyu',operator:'白沙鄉公所',vessel:'鳥嶼號',source:BAISHA},
 {from:'qitou',to:'yuanbei',operator:'白沙鄉公所',vessel:'員貝號',source:BAISHA},
 {from:'chongguang',to:'dacang',operator:'白沙鄉公所',vessel:'大倉號',source:BAISHA},
 {from:'magong',to:'tongpan',operator:'馬公市公所（委託營運）',vessel:'桶盤之星',source:MAGONG},
 {from:'magong',to:'hujing',operator:'馬公市公所',vessel:'',source:MAGONG}
];
const links=[];for(const {from,to,...info} of ROUTES){
 const a=ports.find(p=>p.id===from),b=ports.find(p=>p.id===to),start=geoToWorld(...a.seaGeo),end=geoToWorld(...b.seaGeo),path=sea.path(start,end);if(!path)throw Error(from+'→'+to+' sea route missing');
 let previous=start;for(const p of path){if(!coast.seaSegment(previous,p))throw Error('Sea corridor crosses land');previous=p}
 links.push({from,to,...info,points:[start,...path].map(p=>{const geo=worldToGeo(p.x,p.z);return[geo.lng,geo.lat]})});
}
const output={version:'penghu-ferry-game-20261016-v4',readAt:'2026-10-16',landSHA256:crypto.createHash('sha256').update(text).digest('hex'),routeReference:'https://www.phpto.gov.tw/home.jsp?id=106',routeReferences:{'馬公⇄望安⇄七美':'https://www.phpto.gov.tw/home.jsp?id=106','赤崁⇄吉貝、岐頭⇄鳥嶼、岐頭⇄員貝、重光⇄大倉（白沙鄉公所交通船）':'https://www.baisha.gov.tw/ch/home.jsp?id=113','南海遊客中心⇄桶盤、南海遊客中心⇄虎井（馬公市公所交通船）':'https://www.penghu.gov.tw/Tmakun/ch/home.jsp?id=247'},notice:'遊戲航線與港區登船示意，非實測航道；不代表即時船班、票價或通航狀態。',ports,links};
fs.writeFileSync('dist/geo/penghu-ferries-20261016.json',JSON.stringify(output));
console.log(ports.map(p=>({port:p.name,transferMetres:p.transferMetres})),links.map(l=>({from:l.from,to:l.to,points:l.points.length})));
