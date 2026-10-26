import fs from 'node:fs';
import crypto from 'node:crypto';
import polygonClipping from './vendor/polygon-clipping.cjs';
import {Coastline} from '../dist/coastline.js';
import {LandNavigation} from '../dist/navigation.js';
const source=process.argv[2];if(!source)throw Error('Provide the downloaded 20260407 Penghu source GeoJSON path');
const bytes=fs.readFileSync(source),raw=JSON.parse(bytes),features=raw.features;
if(features.length!==106||features.some(f=>f.properties.COUNTYCODE!=='10016'))throw Error('Unexpected source coverage');
const polygons=features.flatMap(f=>f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates);
const coordinates=polygonClipping.union(...polygons);
const geo={type:'Feature',properties:{source:'內政部國土測繪中心村里界圖之澎湖陸域聯集',sourceURL:'https://data.gov.tw/dataset/7438',version:'nlsc-penghu-20260407-v1',timestamp:'2026-04-07',sourceFeatureCount:features.length,sourceBlob:'9e68875c2f6cb6d626371a23d2612a856cbf9261',downloadSHA256:crypto.createHash('sha256').update(bytes).digest('hex'),method:'Union of Penghu village polygons; internal boundaries removed; no invented coastline or land expansion',limitation:'行政圖資衍生陸域輪廓，非即時潮線或實際通行路線。'},geometry:{type:'MultiPolygon',coordinates}};
const out=JSON.stringify(geo),path='dist/geo/penghu-land-20260407.geojson';fs.writeFileSync(path,out+'\n');
const coast=new Coastline(geo),nav=new LandNavigation(coast),runs=[];
for(let y=0;y<nav.h;y++){const row=[];for(let x=0;x<nav.w;){if(!nav.walk[y*nav.w+x]){x++;continue}const start=x;while(x<nav.w&&nav.walk[y*nav.w+x])x++;row.push(start,x)}runs.push(row)}
const grid={schema:1,sourceVersion:geo.properties.version,sourceSHA256:crypto.createHash('sha256').update(out+'\n').digest('hex'),width:nav.w,height:nav.h,cell:nav.cell,minX:nav.minX,minZ:nav.minZ,runs};
fs.writeFileSync('dist/geo/penghu-grid-20260407.json',JSON.stringify(grid)+'\n');
let area=0;for(const p of coordinates)for(let k=0;k<p.length;k++){const ring=p[k],sum=Math.abs(ring.slice(1).reduce((v,b,i)=>v+ring[i][0]*b[1]-b[0]*ring[i][1],0))*.5;area+=(k?-1:1)*sum*111320**2*Math.cos(23.5*Math.PI/180)}
console.log(JSON.stringify({features:features.length,polygons:coordinates.length,vertices:coordinates.flat(2).length,areaKm2:area/1e6,geoBytes:out.length,gridBytes:JSON.stringify(grid).length,landCells:nav.walk.reduce((s,v)=>s+v,0),components:nav.componentCount}));
if(area/1e6<120||area/1e6>150)throw Error('Unexpected land footprint; administrative marine areas must not be included');
