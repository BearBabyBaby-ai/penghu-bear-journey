import assert from 'node:assert/strict';
import fs from 'node:fs';
import {TravelPlanner,Journey,loadFerries,FERRY_FILE} from '../dist/travel.js';
import {RoadNavigation} from '../dist/roads.js';
import {Coastline} from '../dist/coastline.js';
import {mapPlaces,regionalSpawn} from '../dist/places.js';
import {cleanSave} from '../dist/model.js';
const read=f=>JSON.parse(fs.readFileSync(new URL('../dist/'+f,import.meta.url)));
const coast=new Coastline(read('geo/penghu-land-20260407.geojson')),roads=new RoadNavigation(read('geo/penghu-roads-20211217.json'),coast),ferries=read(FERRY_FILE),hash=read('geo/penghu-grid-20260407.json').sourceSHA256;
const planner=new TravelPlanner(roads,ferries,hash),data=read('data.json'),nodes=mapPlaces(data.records,roads),get=area=>regionalSpawn(nodes,area),distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
assert.throws(()=>new TravelPlanner(roads,ferries,'wrong'),/版本/);
const broken=structuredClone(ferries);broken.links[0].points[1]=[119.5725,23.5665];assert.throws(()=>new TravelPlanner(roads,broken,hash),/陸地/);
for(const from of ['馬公市','西嶼鄉','望安鄉','七美鄉'])for(const to of ['馬公市','西嶼鄉','望安鄉','七美鄉']){
 if(from===to)continue;
 const a=get(from),b=get(to),actor={...a},before={...actor},trip=new Journey(planner),result=trip.request(actor,b,{recordId:b.startRecordId});
 assert(result,from+'→'+to);assert.deepEqual(actor,before,'Selecting a region must not move the actor');
 const expectFerry=a.component!==b.component;assert.equal(result.plan.legs.some(l=>l.type==='ferry'),expectFerry);
 let samples=0,seaSamples=0;
 while(trip.active){assert(++samples<20000);const old={...actor},leg=trip.leg,oldPoint=trip.pointIndex;const used=trip.advance(actor,.06);assert(distance(old,actor)<=.840001,'No instant position changes at stage boundaries');assert(used>=distance(old,actor)-1e-6);
  if(leg.type==='walk'&&trip.leg?.type==='walk')assert(roads.isOnRoad(actor),'Land walking must stay on the recorded road');
  if(leg.type==='ferry'&&trip.leg===leg){assert(!coast.isLand(actor.x,actor.z));let at=old;for(let p=oldPoint;p<trip.pointIndex;p++){assert(coast.seaSegment(at,leg.points[p]));at=leg.points[p]}assert(coast.seaSegment(at,actor));seaSamples++}
 }
 assert(distance(actor,b)<1e-6);assert(roads.isOnRoad(actor));if(expectFerry)assert(seaSamples>50);
}
const a=get('馬公市'),q=get('七美鄉'),w=get('望安鄉'),x=get('西嶼鄉'),actor={...a},trip=new Journey(planner);trip.request(actor,q,{recordId:q.startRecordId});
while(trip.leg.type!=='ferry')trip.advance(actor,.06);
const before={...actor};assert(trip.request(actor,x,{recordId:x.startRecordId}).queued);assert.deepEqual(actor,before,'Mid-sea changes queue instead of jumping');
let count=0;while(trip.active&&trip.meta.recordId!==x.startRecordId){assert(++count<10000);trip.advance(actor,.06)}
assert(roads.isOnRoad(actor),'Queued change waits until road boarding point');assert.equal(trip.meta.recordId,x.startRecordId);
while(trip.active)trip.advance(actor,.06);assert(distance(actor,x)<1e-6);
const cancelled=new Journey(planner),at={...a};cancelled.request(at,q);while(cancelled.leg.type!=='ferry')cancelled.advance(at,.06);assert.equal(cancelled.cancel(),false);
while(cancelled.active)cancelled.advance(at,.06);assert(roads.isOnRoad(at));assert(distance(at,planner.port('wangan').road)<1e-6,'Sea cancellation ends at the next port');
const original=new Journey(planner),atSea={...a};original.request(atSea,q,{recordId:q.startRecordId});while(original.leg.type!=='ferry')original.advance(atSea,.06);for(let i=0;i<40;i++)original.advance(atSea,.06);
const raw=cleanSave({version:1,stamps:{},position:{edge:a.edge,t:a.t},journey:original.snapshot()},data.records),resumed=new Journey(planner),restored={...a};assert(resumed.restore(restored,raw.journey));assert(distance(restored,atSea)<1e-6,'Reload resumes the same ship position');assert.equal(resumed.leg.type,'ferry');
for(let i=0;i<30;i++){original.advance(atSea,.06);resumed.advance(restored,.06)}assert(distance(restored,atSea)<1e-6);
assert.equal(cleanSave({position:{edge:-1,t:10},journey:{origin:{edge:1,t:0},end:{edge:2,t:0},elapsed:Infinity}},data.records).journey,null);
// 白沙鄉公所交通船：赤崁⇄吉貝、岐頭⇄鳥嶼、岐頭⇄員貝；跨島需下船沿路走到另一港再搭船
const byId=id=>nodes.find(n=>n.record.id===id);
for(const [id,ports] of [['sight-96',['赤崁漁港（北海遊客中心）','吉貝漁港']],['sight-118',['岐頭漁港','鳥嶼漁港']],['temple-132',['岐頭漁港','員貝漁港']]]){
 const target=byId(id);assert(target?.approach,id+' has a road approach');const plan=planner.plan(a,target.approach);assert(plan,id+' reachable by ferry');assert.deepEqual(plan.ports,ports);
 const actor={...a},trip=new Journey(planner);trip.request(actor,target.approach,{recordId:id});let last={...actor},guard=0;
 while(trip.active&&guard++<20000){trip.advance(actor,.06);assert(distance(last,actor)<1.2,'no teleport on '+id);last={...actor}}
 assert(!trip.active&&distance(actor,target.approach)<1e-6,id+' arrives');
}
{const jb=byId('sight-96').approach,q7=get('七美鄉'),plan=planner.plan(jb,q7);assert(plan,'吉貝→七美 via walking between main-island ports');assert.deepEqual(plan.ports,['吉貝漁港','赤崁漁港（北海遊客中心）','馬公南海交通船碼頭','望安潭門港','七美南滬港']);assert(plan.legs.some((l,i)=>l.type==='walk'&&i>0&&i<plan.legs.length-1),'walk between ports')}
const unserved=nodes.find(n=>n.record.name==='姑婆嶼');assert.equal(planner.plan(a,unserved.approach),null,'No invented ferry to an unserved island');
const requested=[];await loadFerries(async path=>{requested.push(path);return new Response(JSON.stringify(ferries))});assert.deepEqual(requested,[FERRY_FILE]);await assert.rejects(loadFerries(async()=>new Response('',{status:404})),/未載入/);
console.log('PASS travel: 白沙鄉公所交通船 吉貝／鳥嶼／員貝 and 吉貝→七美 multi-port trips; all 12 regional road/ferry directions; no teleport per frame; sea corridors avoid land; port-only boarding; queued reroutes; cancel at next port; exact ship-position save/resume; unsupported islands stay put. Browser visuals were not tested.');
