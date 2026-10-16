// Exercise actual event handlers in Node with a minimal DOM adapter. This is
// control/state QA, not a browser layout, WebGL, or screenshot test.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as engineModule from '../dist/engine.js';
import * as model from '../dist/model.js';
import * as map from '../dist/map.js';
import * as places from '../dist/places.js';
import * as media from '../dist/media.js';
import {RoadNavigation} from '../dist/roads.js';
import {Coastline} from '../dist/coastline.js';
import {TravelPlanner,Journey} from '../dist/travel.js';
import * as enf from '../dist/enforcement.js';
const read=f=>JSON.parse(fs.readFileSync(new URL('../dist/'+f,import.meta.url))),data=read('data.json'),nav=new RoadNavigation(read('geo/penghu-roads-20211217.json'),new Coastline(read('geo/penghu-land-20260407.geojson'))),planner=new TravelPlanner(nav,read('geo/penghu-ferries-20261016.json'),read('geo/penghu-grid-20260407.json').sourceSHA256);
class Element{
 constructor(){this.value='';this.innerHTML='';this.open=false;this.style={setProperty(){}};this.classList={add(){},remove(){},toggle(){}}}
 querySelector(){return new Element()}
 querySelectorAll(){return[]}
 setAttribute(){}
 addEventListener(){}
 showModal(){this.open=true}
 close(){this.open=false}
}
const elements=new Map(),get=s=>{if(!elements.has(s))elements.set(s,new Element());return elements.get(s)};
const document={body:new Element(),activeElement:{tagName:'BODY'},querySelector:s=>s==='#destination-photo'&&!get('#destination').innerHTML.includes('id="destination-photo"')?null:get(s),querySelectorAll:()=>[],addEventListener(){}};
const storage=new Map(),context=vm.createContext({...engineModule,...model,...map,...places,...media,...enf,RoadNavigation,Coastline,TravelPlanner,Journey,document,window:{addEventListener(){}},innerWidth:390,innerHeight:844,localStorage:{setItem(k,v){storage.set(k,v)}},Intl,Date,Set,Map,console,setTimeout:()=>1,clearTimeout(){},requestAnimationFrame(){},performance:{now:()=>Date.now()},isSecureContext:true,navigator:{geolocation:{watchPosition(ok){globalThis.__gpsFix=ok;ok({coords:{latitude:23.5745,longitude:119.6395,accuracy:12}});return 7},clearWatch(){}}}});
let source=fs.readFileSync(new URL('../dist/game.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/\ninit\(\);\s*$/,'');
source+=`\nglobalThis.controlTest={setup(d,n,planner){data=d;navigation=n;nodes=mapPlaces(d.records,n);journey=new Journey(planner);save=cleanSave({},d.records);player=regionalSpawn(nodes,'馬公市');engine={mapVisible:true,zoom:12,angle:0,tilt:1.12,focus:[player.x,0,player.z],water:{},lastWater:0,setWorld(){},setRoute(){},project(){return null},render(){}};started=true;mapReady=true;$('#region').value='馬公市';$('#place-kind').value='sight';bindControls()},state:()=>({player:{...player},journey,save,shown:displayedNodes().length,area:$('#region').value,map:mapMode()}),frame,setRegion,returnToMap,gps:()=>gps,clearTarget,enforce:()=>enforce,prepareEnforcePoints};`;
vm.runInContext(source,context);const api=context.controlTest;api.setup(data,nav,planner);
const initial=api.state().player;get('#region').value='西嶼鄉';get('#region').onchange({target:get('#region')});let state=api.state();
assert.equal(state.area,'西嶼鄉');assert(state.journey.active);assert.equal(state.journey.plan.ports.length,0);assert.equal(state.player.x,initial.x);assert.equal(state.player.z,initial.z,'Region dropdown does not relocate Bearbao');
api.frame(1000);state=api.state();assert(Math.hypot(state.player.x-initial.x,state.player.z-initial.z)>0);assert(nav.isOnRoad(state.player));
const afterFrame=state.player;get('#place-kind').value='food';get('#place-kind').onchange({target:get('#place-kind')});state=api.state();assert(state.shown>=590&&state.shown<=591);assert(state.journey.active,'View filters must not cancel travel');assert.equal(state.player.x,afterFrame.x);
get('#region').value='七美鄉';get('#region').onchange({target:get('#region')});state=api.state();assert(state.journey.plan.ports.length===3);{const end=state.journey.plan.end,q=state.journey.planner?.port?.('qimei');assert(q,'qimei port');assert(Math.hypot(end.x-q.road.x,end.z-q.road.z)<1e-6,'七美 region goes to 南滬港');assert.equal(state.journey.plan.ports.at(-1),'七美南滬港')}{get('#region').value='望安鄉';get('#region').onchange({target:get('#region')});const s2=api.state(),w=s2.journey.pending?null:s2.journey.planner.port('wangan');if(s2.journey.plan&&!s2.journey.pending&&w){const e=s2.journey.plan.end;assert(Math.hypot(e.x-w.road.x,e.z-w.road.z)<1e-6,'望安 region goes to 潭門港')}assert.equal((s2.journey.pending?.plan||s2.journey.plan).ports.at(-1),'望安潭門港')}assert.equal(state.player.x,afterFrame.x);assert.equal(state.player.z,afterFrame.z);
const beforeScene=state.player;api.setRegion('湖西鄉',null,'tide');assert(!api.state().map);api.returnToMap();assert(api.state().map);assert.equal(api.state().player.x,beforeScene.x);assert.equal(api.state().player.z,beforeScene.z,'Tide illustration must return to the retained map position');
get('#home').onclick({preventDefault(){}});assert.equal(api.state().player.x,beforeScene.x,'Logo follows current position');assert.equal(api.state().player.z,beforeScene.z);
assert(!get('#destination').innerHTML.includes('destination-start'));
const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');assert(html.includes('id="place-kind"'));assert(html.includes('value="all"'));assert(!html.includes('id="places-food"'));assert(html.includes('id="ferry-boat"'));
// 點鄉市：清掉問熊寶關鍵字、改顯示地區資訊
api.setup(data,nav,planner);get('#ask-input').value='七美';get('#region').value='湖西鄉';get('#region').onchange({target:get('#region')});
assert.equal(get('#ask-input').value,'','Region choice clears the ask keyword');assert.equal(get('#ask-results').hidden,false);assert(get('#ask-results').innerHTML.includes('地區資訊')&&get('#ask-results').innerHTML.includes('湖西鄉'));
// GPS：熊寶沿道路跟上使用者位置，不瞬移
api.setup(data,nav,planner);api.clearTarget();const gpsStart=api.state().player;get('#gps-toggle').onclick();state=api.state();
assert(api.gps().on&&api.gps().road,'GPS fix snapped to a recorded road');assert(state.journey.active&&state.journey.meta.gps,'Bearbao plans a road trip toward the user');assert.equal(state.player.x,gpsStart.x);assert.equal(state.player.z,gpsStart.z,'GPS never teleports Bearbao');
api.frame(1000);api.frame(1300);state=api.state();assert(nav.isOnRoad(state.player)&&Math.hypot(state.player.x-gpsStart.x,state.player.z-gpsStart.z)>0,'Bearbao walks along roads toward the user');
get('#gps-toggle').onclick();assert(!api.gps().on);assert(!api.state().journey.active,'Turning GPS off stops the follow trip');
// 測速／科技執法：熊寶沿路前往湖西時，前方同向的測速點會提醒；熊寶位置不受影響
api.setup(data,nav,planner);api.clearTarget();{const e=api.enforce();e.points=enf.groupPoints(read('geo/penghu-enforcement-20261016.json').records.map(enf.normalizeRecord));api.prepareEnforcePoints();e.on=true;
get('#region').value='湖西鄉';get('#region').onchange({target:get('#region')});const seen=[];let t=1000;for(let i=0;i<4000&&api.state().journey.active;i++){t+=50;api.frame(t);const a=get('#enforce-alert');if(!a.hidden&&a.textContent&&!seen.includes(a.textContent))seen.push(a.textContent)}
assert(seen.length>=2&&seen.every(x=>/^前方 \d+ 公尺｜/.test(x)),'enforcement alerts along the road trip: '+seen.join(' / '));assert(nav.isOnRoad(api.state().player));e.on=false}
console.log('PASS controls: real region/category handlers preserve position; Magong→Xiyu road route, Qimei port itinerary, region choice clears ask keyword and shows region info, GPS follow walks along roads without teleport, speed-camera alerts along a real road trip, view filter keeps navigation, tide round-trip and logo keep map position. Minimal Node DOM adapter only; browser appearance remains untested.');
