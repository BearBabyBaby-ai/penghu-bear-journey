// 「我的位置」導航：路線從使用者位置規劃，依定位更新進度、剩餘距離、偏離與抵達（熊寶移動由 game.js 沿路跟隨，不在此測）
import assert from 'node:assert/strict';import fs from 'node:fs';
import {RoadNavigation} from '../dist/roads.js';import {Coastline} from '../dist/coastline.js';import {TravelPlanner} from '../dist/travel.js';import {geoToWorld} from '../dist/map.js';import {GpsNav} from '../dist/gpsnav.js';
const read=f=>JSON.parse(fs.readFileSync(new URL('../dist/'+f,import.meta.url)));
const nav=new RoadNavigation(read('geo/penghu-roads-20211217.json'),new Coastline(read('geo/penghu-land-20260407.geojson'))),planner=new TravelPlanner(nav,read('geo/penghu-ferries-20261016.json'),read('geo/penghu-grid-20260407.json').sourceSHA256),unit=100*Math.cos(23.55*Math.PI/180);
const a=geoToWorld(119.5665,23.5655),b=geoToWorld(119.5850,23.5560),from=nav.snap(a.x,a.z,1),to=nav.snap(b.x,b.z,1);
const plan=planner.plan(from,to);assert(plan&&!plan.ports.length);const g=new GpsNav(plan,to,{name:'測試'});
assert(Math.abs(g.total-plan.distance)<1e-6,'路線總長一致');
let seed=3;const rnd=()=>(seed=(seed*1103515245+12345)%2147483648)/2147483648,noise=()=>(rnd()-.5)*2*8/unit;
let last=0,back=0;for(let s=0;s<=g.total;s+=11/unit){const p=g.point(s);g.update({x:p.x+noise(),z:p.z+noise()},unit);if(g.s<last-1e-9)back++;last=g.s;assert.equal(g.off,0,'沿路線行駛不判定偏離')}
assert.equal(back,0,'進度不倒退');assert(g.arrived(unit),'到終點 30 公尺內判定抵達');
const h=new GpsNav(plan,to,{});const mid=h.point(h.total/2);h.update(mid,unit);const ahead=h.ahead(h.s,300/unit);assert(ahead&&ahead.length>=2&&Math.hypot(ahead[0].x-mid.x,ahead[0].z-mid.z)<1e-6,'前方路線從目前位置開始');
const loc=h.locate(mid),cands=[1,-1].map(k=>({x:mid.x-loc.dir.z*1.5*k,z:mid.z+loc.dir.x*1.5*k})),far=cands.find(c=>h.project(c,-Infinity,Infinity).d*unit>100);assert(far);h.update(far,unit);h.update(far,unit);assert(h.off>=2,'離路線 100 公尺以上判定偏離');
assert(h.geometry().v.length>0);
console.log(`PASS gpsnav: route from your position (${Math.round(g.total*unit)} m), progress never goes back with ±8 m GPS noise, arrival within 30 m, ahead path for speed alerts, off-route detection.`);
