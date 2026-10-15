import {mapPosition,locateTour} from './map.js?v=20261015-travel8';
// The real map always uses the complete source collection. The nine-stop tour
// belongs only to the separate illustrative tide scene.
export function mapPlaces(records,navigation){
 return locateTour(records.filter(r=>mapPosition(r)).map((record,index)=>({record,index})),'',navigation);
}
export function placeCounts(records){
 return Object.fromEntries(['food','sight','temple'].map(kind=>{const list=records.filter(r=>r.kind===kind);return[kind,{total:list.length,mapped:list.filter(r=>mapPosition(r)).length}]}));
}
// Explicit familiar starts, never the first spreadsheet row (which may be an
// offshore island). Other records and their real coordinates remain unchanged.
export const REGION_STARTS={'馬公市':'sight-3','湖西鄉':'temple-76','白沙鄉':'sight-100','西嶼鄉':'sight-126','七美鄉':'sight-162','望安鄉':'sight-174'};
export function regionalSpawn(nodes,area){
 const local=nodes.filter(n=>n.record.area===area&&n.approach);
 let chosen=local.find(n=>n.record.id===REGION_STARTS[area]);
 if(!chosen){const counts=new Map();for(const n of local){const c=n.approach.component??0;counts.set(c,(counts.get(c)||0)+1)}const main=[...counts].sort((a,b)=>b[1]-a[1])[0]?.[0];chosen=local.find(n=>(n.approach.component??0)===main)}
 return chosen?{...chosen.approach,facing:0,startRecordId:chosen.record.id,startName:chosen.record.name}:null;
}
export function shownPlaces(nodes,enabled){return nodes.filter(n=>enabled[n.record.kind]!==false)}
export function categoryKinds(kind='sight'){return Object.fromEntries(['food','sight','temple'].map(k=>[k,kind==='all'||kind===k]))}
export const MAP_MARKER_LABEL_Y=1.48;
// Keep every in-view map pin; shorten crowded labels to a category pin instead
// of removing the underlying place or moving its geographic coordinate.
export function labelLayout(nodes,project,width,height,zoom,targetId,anchorY=2){
 const out=new Map(),occupied=[],groups=[];
 const ordered=[...nodes].sort((a,b)=>Number(b.record.id===targetId)-Number(a.record.id===targetId)||a.index-b.index);
 for(const n of ordered){const p=project([n.x,anchorY,n.z]);if(!p||p.x<0||p.x>width||p.y<0||p.y>height)continue;
  const selected=n.record.id===targetId,radius=width<700?42:34;
  const nearby=groups.find(g=>!g.selected&&!selected&&Math.hypot(g.x-p.x,g.y-p.y)<radius);
  if(nearby){nearby.members.push(n);continue}
  groups.push({...p,n,selected,members:[n]});
 }
 for(const group of groups){const {n,selected,...p}=group;
  const w=Math.min(170,44+n.record.name.length*11),box={left:p.x-w/2,right:p.x+w/2,top:p.y-30,bottom:p.y};
  const overlaps=occupied.some(b=>box.left<b.right+4&&box.right>b.left-4&&box.top<b.bottom+4&&box.bottom>b.top-4);
  const full=selected||(p.members.length===1&&zoom<=40&&!overlaps);
  if(full)occupied.push(box);out.set(n.index,{...p,compact:!full,selected});
 }return out;
}
