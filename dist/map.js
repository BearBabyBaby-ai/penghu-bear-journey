// One EPSG:3857 coordinate system for tiles, records, coastline and movement.
const R=6378137, RAD=Math.PI/180;
export const ORIGIN={lng:119.55,lat:23.50};
export const WORLD_METRES=100;
export function mercator(lng,lat){return{x:R*lng*RAD,y:R*Math.log(Math.tan(Math.PI/4+lat*RAD/2))}}
const origin=mercator(ORIGIN.lng,ORIGIN.lat);
export function geoToWorld(lng,lat){const m=mercator(lng,lat);return{x:(m.x-origin.x)/WORLD_METRES,z:(origin.y-m.y)/WORLD_METRES}}
export function worldToGeo(x,z){return{lng:(origin.x+x*WORLD_METRES)/R/RAD,lat:(2*Math.atan(Math.exp((origin.y-z*WORLD_METRES)/R))-Math.PI/2)/RAD}}
const nw=geoToWorld(119.2,23.86),se=geoToWorld(119.86,23.12);
export const MAP={minX:nw.x,maxX:se.x,minZ:nw.z,maxZ:se.z,width:se.x-nw.x,height:se.z-nw.z,areas:['馬公市','湖西鄉','白沙鄉','西嶼鄉','望安鄉','七美鄉']};
export const insideMap=(x,z)=>x>MAP.minX&&x<MAP.maxX&&z>MAP.minZ&&z<MAP.maxZ;
export function mapPosition(record){if(!Number.isFinite(record?.lat)||!Number.isFinite(record?.lng))return null;const p=geoToWorld(record.lng,record.lat);return insideMap(p.x,p.z)?p:null}
export function tileBounds(z,x,y){const n=2**z,lon=t=>t/n*360-180,lat=t=>Math.atan(Math.sinh(Math.PI*(1-2*t/n)))/RAD;const a=geoToWorld(lon(x),lat(y)),b=geoToWorld(lon(x+1),lat(y+1));return{minX:a.x,maxX:b.x,minZ:a.z,maxZ:b.z}}
export function tileAt(z,x,v){const g=worldToGeo(x,v),n=2**z;return{x:Math.floor((g.lng+180)/360*n),y:Math.floor((1-Math.asinh(Math.tan(g.lat*RAD))/Math.PI)/2*n)}}
export const LAYERS={
 nlsc:{label:'臺灣通用電子地圖',url:(z,x,y)=>`https://wmts.nlsc.gov.tw/wmts/EMAP/default/GoogleMapsCompatible/${z}/${y}/${x}`,credit:'© 內政部國土測繪中心',href:'https://maps.nlsc.gov.tw/'},
 osm:{label:'OpenStreetMap',url:(z,x,y)=>`https://tile.openstreetmap.org/${z}/${x}/${y}.png`,credit:'© OpenStreetMap contributors',href:'https://www.openstreetmap.org/copyright'}
};
export function locateTour(nodes,area,navigation){return nodes.map(n=>{const p=mapPosition(n.record);if(!p)return{...n,mapped:false,approach:null};const land=navigation?.snap(p.x,p.z);return{...n,...p,mapped:true,approach:land,mapAnchor:p,positionOffset:land?Math.hypot(land.x-p.x,land.z-p.z):null}})}
export function mapSpawn(nodes){const n=nodes.find(n=>n.approach);return n?{...n.approach,facing:0}:null}
