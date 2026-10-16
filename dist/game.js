import {Engine,Geometry,buildWorld,buildMapMarkers,movePlayer,insideIsland,clamp} from './engine.js?v=20261015-travel8';
import {KINDS,AREAS,makeTour,filterRecords,interpolateTide,cleanSave,minute} from './model.js?v=20261015-travel8';
import {MAP,mapPosition,worldToGeo,LAYERS,WORLD_METRES} from './map.js?v=20261015-travel8';
import {RoadNavigation,loadRoads} from './roads.js?v=20261015-travel8';
import {Coastline,loadTerrain} from './coastline.js?v=20261015-travel8';
import {TileMap} from './tiles.js?v=20261015-travel8';
import {mapPlaces,placeCounts,shownPlaces,categoryKinds,labelLayout,regionalSpawn,REGION_STARTS,MAP_MARKER_LABEL_Y} from './places.js?v=20261015-travel8';
import {placeImages,imageSource} from './media.js?v=20261015-travel8';
import {TravelPlanner,Journey,loadFerries} from './travel.js?v=20261015-travel8';
import {askPlaces} from './ask.js?v=20261016-ask1';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const clock=m=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(Math.round(m%60)).padStart(2,'0')}`;
const SAVE_KEY='bear-penghu-3d-v1';
let data,engine,navigation,nodes=[],route=[],save,player={x:0,z:6,facing:0},started=false,target=null,destination=null,nearest=null,keys=new Set(),last=0,elapsed=0,moving=false,tideHeight=0,simMinute=600,currentPanel='',atlasKind='',atlasArea='',atlasQuery='',atlasLimit=24,tideTab='sea',tideDate=today(),forecastBlock=0,joystick={x:0,y:0},toastTimer,saveAvailable=true,performanceLow=false,mapOverview=false,observingSea=false;
let destinationKey='';
const enabledKinds=categoryKinds();
let journey=null,mapReady=false,mapReturn=null,lastRoadPoint=null,routeRevision=-1,persistElapsed=0;
let inspectPoint=null;
const displayedNodes=()=>{if(!mapMode())return nodes;const shown=shownPlaces(nodes,enabledKinds);return target&&!shown.includes(target)?[...shown,target]:shown};
const areaNodes=()=>nodes.filter(n=>n.record.area===$('#region').value);
const regionSpawn=()=>regionalSpawn(nodes,$('#region').value);
const mapMode=()=>!!engine?.mapVisible;
const approach=n=>mapMode()?n.approach:{x:n.x,z:n.z+1.8};
const distanceTo=n=>{const p=approach(n);if(!p)return Infinity;const straight=Math.hypot(p.x-player.x,p.z-player.z);return mapMode()?(straight>interactionRange()?Infinity:navigation?.distance(player,p,interactionRange())??Infinity):straight};
const interactionRange=()=>mapMode()?.3:2.8;
function stopWalking(){destination=null;route=[];if(mapMode())journey?.cancel();if(engine?.routeMesh&&!journey?.inTransit)engine.setRoute(null);routeRevision=-1}
function clearTarget(){target=null;destinationKey='';stopWalking();$('#destination').hidden=true;document.body.classList.remove('has-target');$$('.place-label').forEach(el=>el.classList.remove('target'))}
function updatePlaceLayers(){
 const counts=placeCounts(data.records),mapped=Object.values(counts).reduce((s,c)=>s+c.mapped,0),shown=displayedNodes().length;
 for(const [kind,c] of Object.entries(counts))$('#place-kind').querySelector(`[value="${kind}"]`).textContent=`${KINDS[kind].label}（${c.total}）`;
 $('#places-summary').textContent=`顯示 ${shown} 個地點 · 數字標記可點開查看`;
 $('#place-layers').hidden=!mapMode();
}
function refreshPlaceVisibility(){
 engine.setWorld(buildMapMarkers(displayedNodes()));updatePlaceLayers();
}
function selectMapPlace(n){
 if(!mapMode()){setTarget(n);return}
 const nearby=n.cluster?.length>1?n.cluster:[n];
 if(nearby.length<2){setTarget(n);return}
 keys.clear();$('#detail-body').innerHTML=`<span class="eyebrow">地標選擇</span><h2>此處有 ${nearby.length} 個地標</h2><p>選擇要查看的美食、景點或廟宇。</p><div class="atlas-list">${nearby.map(other=>`<button class="atlas-item" data-map-place="${other.index}"><span class="kind-tile" style="--tag:${KINDS[other.record.kind].color}">${KINDS[other.record.kind].symbol}</span><div><h3>${escape(other.record.name)}</h3><p>${KINDS[other.record.kind].label} · ${escape(other.record.area)}</p></div></button>`).join('')}</div>`;
 $$('[data-map-place]').forEach(button=>button.onclick=()=>{$('#details').close();setTarget(nodes[Number(button.dataset.mapPlace)])});$('#details').showModal();
}
function planTrip(point){
 if(!mapMode()){destination=point;return true}
 if(!navigation||!journey||!point){toast(navigation?'此地點附近沒有已收錄道路。':'道路與港口資料尚未就緒。');return false}
 if(!navigation.isOnRoad(point))point=navigation.snap(point.x,point.z,.4);
 if(!point){toast('請點選道路；熊寶不會穿越建物或步行渡海。');return false}
 const result=journey.request(player,point,{recordId:target?.record.id||'',area:$('#region').value,name:target?.record.name||''});
 if(!result){stopWalking();toast('此處沒有連通道路或已收錄港口航線，熊寶留在原位。');return false}
 inspectPoint=null;mapOverview=false;routeRevision=-1;persist();
 toast(result.queued?'已更新目的地，抵達下一港口後會接續導航。':result.plan.ports.length?`先沿路到港口，再搭船：${result.plan.ports.join(' → ')}`:`沿道路自動前往${target?.record.name||'目的地'}。`);return true;
}
const sourceFooter=()=>`<div class="source-foot"><p>讀取日期 ${data.meta.readAt}，本版使用讀取時的資料快照。<br>底圖：臺灣通用電子地圖／OpenStreetMap，地標依原表經緯度定位。陸海採隨遊戲提供的國土測繪村里圖資聯集外輪廓判定。<br>道路：© OpenStreetMap contributors，來源 mapstew 向量資料快照 2021-12-17，可能缺少新道路。自動前往和搖桿僅沿收錄道路；離島經已收錄港口搭船；未收錄航線不會自動轉移。地標位置保留原表坐標，互動點取附近道路，與入口可能有距離。<br>陸域資料版本：${escape(navigation?.coast.meta.timestamp||'尚未取得')}。陸域檔案與遊戲一同提供，出發不需查詢外部海岸服務。此輪廓由行政圖資衍生，不反映即時潮位，也不代表實際可通行範圍。</p><a href="https://maps.nlsc.gov.tw/" target="_blank" rel="noopener noreferrer">國土測繪圖資服務雲 ↗</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors（ODbL）↗</a></div>`;

function toast(msg){$('#toast').textContent=msg;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3800)}
function persist(){try{
 save.area=mapReturn?.area||$('#region').value;const actor=mapReturn?.player||player;
 if(navigation?.isOnRoad(actor))lastRoadPoint={edge:actor.edge,t:actor.t};
 if(mapReady){save.position=lastRoadPoint;save.journey=journey?.snapshot()||null}
 localStorage.setItem(SAVE_KEY,JSON.stringify(save));
 }catch{if(saveAvailable){toast('此瀏覽器無法儲存進度，請從手帳匯出備份。');saveAvailable=false}}
}
function updateProgress(){
 $('#stamp-count').textContent=Object.keys(save.stamps).length;
 for(const n of nodes){const el=$(`#label-${n.index}`);if(el)el.classList.toggle('collected',!!save.stamps[n.record.id])}
}
function start(){
 if(started)return;started=true;document.body.classList.remove('not-started');$('#intro').hidden=true;
 mapOverview=false;engine.zoom=innerWidth<700?10:12;if(!mapMode())target=nodes.find(n=>!save.stamps[n.record.id])||nodes[0];updateDestination();toast('用下方選單選美食、景點或廟宇；數字標記可點開，切換鄉市會自動導航。');
}
function setRegion(area,record=null,mode='map'){
 const enteringTide=mode==='tide';
 if(enteringTide&&mapMode())mapReturn={player:{...player},area:$('#region').value,targetId:target?.record.id};
 const returning=!enteringTide?mapReturn:null,previous=returning?.player||player;
 inspectPoint=null;$('#region').value=area;observingSea=enteringTide;destinationKey='';
 const mapped=!observingSea;nodes=mapped?mapPlaces(data.records,navigation):makeTour(data.records,area);
 if(!mapped&&record&&!nodes.some(n=>n.record.id===record.id)){const slot=nodes.find(n=>n.record.kind===record.kind)||nodes[0];slot.record=record}
 engine.mapVisible=mapped;destination=null;route=[];
 if(mapped){
  player=previous;
  if(!mapReady){
   const pos=save.position,valid=Number.isInteger(pos?.edge)&&navigation?.edges[pos.edge]&&Number.isFinite(pos.t)&&pos.t>=0&&pos.t<=1;
   player=navigation?(valid?{...navigation.point(pos.edge,pos.t),facing:0}:regionSpawn()||previous):{...(mapPosition(nodes.find(n=>n.record.id===REGION_STARTS[area])?.record||areaNodes()[0]?.record)||previous),facing:0};
   if(navigation){journey?.restore(player,save.journey);mapReady=true}
  }
  mapReturn=null;
 }else player={x:0,z:6,facing:0};
 target=record?nodes.find(n=>n.record.id===record.id):mapped?nodes.find(n=>n.record.id===(returning?.targetId||journey?.meta.recordId))||null:nodes.find(n=>!save.stamps[n.record.id])||nodes[0];
 engine.setWorld(mapped?buildMapMarkers(displayedNodes()):buildWorld(nodes,area));
 engine.angle=mapped?0:.65;engine.tilt=mapped?1.12:.78;engine.focus=[player.x,0,player.z];if(started){mapOverview=false;engine.zoom=innerWidth<700?10:12}
 $('#labels').innerHTML=nodes.map(n=>`<button class="place-label" id="label-${n.index}" data-node="${n.index}" style="--tag:${KINDS[n.record.kind].color}" title="${escape(KINDS[n.record.kind].label+' · '+n.record.name)}" aria-label="選取${escape(n.record.name)}" hidden><span class="dot">${KINDS[n.record.kind].symbol}</span><span class="place-name">${escape(n.record.name)}</span></button>`).join('');
 $$('.place-label').forEach(el=>{const n=nodes[Number(el.dataset.node)];n.label=el;el.addEventListener('click',()=>{start();selectMapPlace(n)})});
 $('#scene-label').textContent=observingSea?'奎壁山 · 分海觀察示意':`${area} · 道路與港口探索`;
 $('#map-note').textContent=mapped?'橘線：道路 · 藍色虛線：搭船示意':'分海動畫 · 點「全圖」返回原位';
 routeRevision=-1;updatePlaceLayers();persist();updateProgress();updateDestination();
}
function returnToMap(){if(!mapMode())setRegion(mapReturn?.area||save.area)}
function navigateRegion(area){
 returnToMap();const point=regionalSpawn(nodes,area),record=nodes.find(n=>n.record.id===point?.startRecordId)?.record;
 if(!record){toast('此區尚無可用道路目的地，熊寶留在原位。');return}
 navigateTo(record);
}
function setTarget(n,walk=false){if(!n)return;if(!walk)stopWalking();target=n;destinationKey='';if(!enabledKinds[n.record.kind]){$('#place-kind').value=n.record.kind;Object.assign(enabledKinds,categoryKinds(n.record.kind));if(mapMode())refreshPlaceVisibility()}if(mapOverview)engine.zoom=innerWidth<700?10:12;mapOverview=false;inspectPoint=mapMode()?{x:n.x,z:n.z}:null;if(walk)planTrip(approach(n));updateDestination()}
function updateDestination(){
 const visible=started&&!!target;$('#destination').hidden=!visible;document.body.classList.toggle('has-target',visible);if(!visible)return;
 const r=target.record,photo=placeImages(r)[0],end=approach(target),isGoal=journey?.active&&journey.meta.recordId===r.id,queued=journey?.pending?.meta.recordId===r.id;
 const planned=mapMode()&&!isGoal&&end&&navigation?.isOnRoad(player)?journey?.planner.plan(player,end):null;
 const d=mapMode()?(isGoal?journey.remaining(player):planned?.distance??Infinity):distanceTo(target),near=mapMode()?distanceTo(target)<interactionRange():d<interactionRange(),collected=save.stamps[r.id];
 const active=isGoal||queued,canGo=!!planned||!!journey?.inTransit,ports=isGoal?journey.plan.ports:planned?.ports||[];
 const shown=near?'✓':(Number.isFinite(d)?Math.round(d*WORLD_METRES*Math.cos(worldToGeo(player.x,player.z).lat*Math.PI/180)):'—');
 /* 行進中只更新距離數字，不重建整張卡片：手機點按「地點資料與故事」等按鈕時，按鈕不會在手指底下被換掉 */
 const key=[r.id,near,collected,journey?.revision,journey?.label,queued,!!navigation,!!target.approach,mapMode(),canGo,!!end,active,ports.join('>'),Number.isFinite(d),!!photo].join('|');if(key===destinationKey){const n=$('#destination .distance strong');if(n&&n.textContent!==String(shown))n.textContent=shown;return}destinationKey=key;
 const phase=queued?'已排入下一港口後的旅程':isGoal?journey.label:'';
 $('#destination').innerHTML=`<div class="destination-head"><span>目前目的地</span><button id="destination-close" aria-label="關閉目的地並停止導航">×</button></div><span class="tag">${KINDS[r.kind].label} · ${escape(r.area)}</span><h3>${escape(r.name)}</h3>${phase?`<p class="journey-phase" role="status">${escape(phase)}</p>`:''}${ports.length?`<p class="journey-ports">${ports.map(escape).join(' → ')}<small>港口間為遊戲航線示意</small></p>`:photo&&!active?`<button class="destination-photo" id="destination-photo" aria-label="查看${escape(r.name)}相片"><img data-place-photo src="${escape(photo.src)}" alt="${escape(r.name)}" loading="lazy" decoding="async"></button>`:''}<div class="distance"><span>${near?'已抵達道路互動點':active?'旅程剩餘距離':ports.length?'道路＋搭船距離':'沿道路距離'}</span><span><strong>${shown}</strong> <small>${near?'':'公尺'}</small></span></div><button class="primary" id="destination-action" ${mapMode()&&(!navigation||!end||active||!near&&!canGo)?'disabled':''}>${near?(collected?'閱讀地點故事':'閱讀故事・蓋章'):queued?'抵港後接續導航':isGoal?'正在自動導航':mapMode()&&!navigation?'等待道路與港口資料':mapMode()&&!end?'附近無已收錄道路':mapMode()&&!canGo?'無已收錄交通路線':ports.length?'沿路＋搭船前往':'沿道路前往'} <span>${near?'E':'↗'}</span></button><button class="small-button destination-story" id="destination-story">地點資料與故事</button>`;
 $('#destination-close').onclick=()=>{const transit=journey?.inTransit;clearTarget();persist();if(transit)toast('將在下一港口靠岸下船後停止。')};$('#destination-story').onclick=()=>showDetail(r,near);if($('#destination-photo'))$('#destination-photo').onclick=()=>showDetail(r,near);bindPhotoErrors($('#destination'));
 $('#destination-action').onclick=()=>near?showDetail(r,true):setTarget(target,true);
 $$('.place-label').forEach(el=>el.classList.toggle('target',Number(el.dataset.node)===target.index));
}
function interact(){
 if(!started){start();return}if(currentPanel||$('#details').open||$('#help-dialog').open)return;
 let n=displayedNodes().map(n=>({n,d:distanceTo(n)})).sort((a,b)=>a.d-b.d)[0];
 if(n&&n.d<interactionRange()){target=n.n;showDetail(n.n.record,true)}else toast('沿道路走到地標旁的互動點，就可以集章。');
}
function collect(r){
 const node=nodes.find(n=>n.record.id===r.id);if(!node||distanceTo(node)>=interactionRange()){toast('先走到地標旁，再蓋下這枚印章。');return}
 if(save.stamps[r.id])return;save.stamps[r.id]=today();persist();updateProgress();updateDestination();
 toast(`收集成功！${r.name}，已成為你的旅行記憶。`);showDetail(r,true);
 if(currentPanel==='stamps')renderStamps();
}
function navigateTo(r){
 if(!mapPosition(r)){toast('原表座標未提供或超出澎湖圖資範圍。');return}
 if($('#details').open)$('#details').close();closePanel();returnToMap();start();
 $('#region').value=r.area;$('#scene-label').textContent=`前往${r.area} · ${r.name}`;
 setTarget(nodes.find(n=>n.record.id===r.id),true);persist();
}
function safeURL(url){try{const u=new URL(url);return ['https:','http:'].includes(u.protocol)?u.href:''}catch{return ''}}
function photoGallery(record){const images=placeImages(record);return images.length?`<div class="place-gallery">${images.map(image=>`<a class="place-photo" href="${escape(imageSource(image))}" target="_blank" rel="noopener noreferrer"><img data-place-photo src="${escape(image.src)}" alt="${escape(record.name)}" width="${image.width}" height="${image.height}" loading="lazy" decoding="async"><span class="photo-error" hidden>圖片未載入，點此開啟原圖 ↗</span></a>`).join('')}</div>`:''}
function bindPhotoErrors(root=document){root.querySelectorAll('[data-place-photo]').forEach(img=>img.addEventListener('error',()=>{img.hidden=true;const notice=img.parentElement.querySelector('.photo-error');if(notice)notice.hidden=false},{once:true}))}
function showDetail(r,atPlace=false){
 stopWalking();keys.clear();const kind=KINDS[r.kind],stamped=save.stamps[r.id],node=nodes.find(n=>n.record.id===r.id),near=node&&distanceTo(node)<interactionRange();
 const fields=[['所在地',r.area+(r.village?'・'+r.village:'')],['地址',r.address],['電話',r.phone],['營業時間',r.hours],['推薦內容',r.special],['陸海判定',mapPosition(r)?(navigation?(navigation.isLand(...Object.values(mapPosition(r)))?'陸地':'海洋／海岸外側，互動點須另有道路'):'資料尚未取得'):'無法定位'],['道路互動點',node?.approach?`${node.approach.roadName}（距原表標記約 ${Math.round(node.positionOffset*WORLD_METRES*Math.cos(r.lat*Math.PI/180))} 公尺）`:'附近沒有已收錄道路，或尚未載入此探索區'],['座標',r.lat!==null&&r.lng!==null?`${r.lat}, ${r.lng}`:'']].filter(x=>x[1]);
 const festival=r.festival&&Object.values(r.festival).some(Boolean)?`<h4>原表元宵紀錄</h4><p>${Object.values(r.festival).filter(Boolean).map(escape).join('<br>')}</p><p class="small-note">以上為原表所載日期與內容，請留意適用年份。</p>`:'';
 $('#detail-body').innerHTML=`<div class="detail-tag"><span class="tag">${kind.label}</span><span class="eyebrow">${stamped?'已收藏 '+escape(stamped):'ISLAND DISCOVERY'}</span></div><h2>${escape(r.name)}</h2>${photoGallery(r)}<p>${escape(r.description||'原表未提供進一步簡介，可查看下方地點資料。')}</p><dl class="detail-fields">${fields.map(([a,b])=>`<dt>${a}</dt><dd>${escape(b)}</dd>`).join('')}</dl>${r.legend?`<h4>地方傳說</h4><p>${escape(r.legend)}</p>`:''}${festival}<div class="detail-actions">${near&&!stamped?'<button class="primary" id="collect">蓋下旅行印章</button>':`<button class="primary" id="navigate">${stamped?'再次造訪':'設為探索地點'}</button>`}${safeURL(r.url)?`<a href="${escape(safeURL(r.url))}" target="_blank" rel="noopener noreferrer">原表地圖 ↗</a>`:''}</div>`;
 bindPhotoErrors($('#detail-body'));
 if($('#collect'))$('#collect').onclick=()=>collect(r);if($('#navigate'))$('#navigate').onclick=()=>navigateTo(r);
 if(!$('#details').open)$('#details').showModal();
}
function closePanel(){currentPanel='';$('#panel').hidden=true;document.body.classList.remove('panel-open');$$('.dock button').forEach(b=>b.classList.remove('active'));keys.clear()}
function openPanel(name){
 if(currentPanel===name){closePanel();return}stopWalking();keys.clear();currentPanel=name;$('#panel').hidden=false;document.body.classList.add('panel-open');$$('.dock button').forEach(b=>b.classList.toggle('active',b.dataset.panel===name));
 const titles={atlas:['THE ISLAND COLLECTION','澎湖探索圖鑑'],stamps:['YOUR TRAVEL MEMORIES','我的集章手帳'],tides:['THE RHYTHM OF THE SEA','海潮與摩西分海']};
 $('#panel-kicker').textContent=titles[name][0];$('#panel-title').textContent=titles[name][1];
 ({atlas:renderAtlas,stamps:renderStamps,tides:renderTides})[name]();
}
function renderAtlas(){
 $('#panel-body').innerHTML=`<input class="search" id="atlas-search" placeholder="搜尋美食、景點、廟宇、故事…" aria-label="搜尋圖鑑" value="${escape(atlasQuery)}"><div class="filters" id="kind-filters">${[['','全部'],...Object.entries(KINDS).map(([k,v])=>[k,v.label])].map(([k,v])=>`<button class="filter ${atlasKind===k?'selected':''}" data-kind="${k}">${v}</button>`).join('')}</div><div class="filters" id="area-filters">${[['','所有鄉市'],...AREAS.map(a=>[a,a])].map(([k,v])=>`<button class="filter ${atlasArea===k?'selected':''}" data-area="${k}">${v}</button>`).join('')}</div><div class="result-summary" id="atlas-summary"></div><div class="atlas-list" id="atlas-list"></div><button id="load-more" class="load-more">載入更多地點</button>${sourceFooter()}`;
 $('#atlas-search').oninput=e=>{atlasQuery=e.target.value;atlasLimit=24;renderAtlasResults()};
 $$('#kind-filters button').forEach(b=>b.onclick=()=>{atlasKind=b.dataset.kind;atlasLimit=24;$$('#kind-filters button').forEach(x=>x.classList.toggle('selected',x===b));renderAtlasResults()});
 $$('#area-filters button').forEach(b=>b.onclick=()=>{atlasArea=b.dataset.area;atlasLimit=24;$$('#area-filters button').forEach(x=>x.classList.toggle('selected',x===b));renderAtlasResults()});
 $('#load-more').onclick=()=>{atlasLimit+=24;renderAtlasResults()};renderAtlasResults();
}
function renderAtlasResults(){
 const list=filterRecords(data.records,{query:atlasQuery,area:atlasArea,kind:atlasKind});
 $('#atlas-summary').textContent=`找到 ${list.length} 筆地點 · 完整資料庫 ${data.records.length} 筆`;
 $('#atlas-list').innerHTML=list.slice(0,atlasLimit).map(r=>`<button class="atlas-item" data-record="${r.id}">${placeImages(r)[0]?`<img class="atlas-thumb" data-place-photo src="${escape(placeImages(r)[0].src)}" alt="${escape(r.name)}" loading="lazy" decoding="async">`:`<span class="kind-tile" style="--tag:${KINDS[r.kind].color}">${KINDS[r.kind].symbol}</span>`}<div><h3>${escape(r.name)}${save.stamps[r.id]?'<span class="mini-check">✓</span>':''}</h3><p>${escape(r.area)} · ${escape(r.category)}</p></div><span class="arrow">↗</span></button>`).join('')||'<div class="empty">這次沒有找到地點。<br>試試其他關鍵字或鄉市。</div>';
 $$('#atlas-list button').forEach(b=>b.onclick=()=>showDetail(data.records.find(r=>r.id===b.dataset.record)));
 bindPhotoErrors($('#atlas-list'));$('#load-more').hidden=list.length<=atlasLimit;
}
function renderStamps(){
 const list=data.records.filter(r=>save.stamps[r.id]);
 $('#panel-body').innerHTML=`<p>在 3D 場景裡走近地標，閱讀故事，再留下自己的旅行足跡。</p><div class="summary-grid">${Object.entries(KINDS).map(([k,v])=>`<div><strong>${list.filter(r=>r.kind===k).length}</strong><span>${v.label}印章</span></div>`).join('')}</div>${list.length?`<div class="stamp-grid">${list.map(r=>`<button class="stamp" data-record="${r.id}" style="color:${KINDS[r.kind].color}"><span class="stamp-symbol">${KINDS[r.kind].symbol}</span><strong>${escape(r.name)}</strong><small>${escape(save.stamps[r.id])}</small></button>`).join('')}</div>`:'<div class="empty">旅行手帳，等待第一枚印章。<br>走到地標旁，按 E 開始收藏。</div>'}<div class="save-actions"><button id="export-save" class="small-button">匯出進度備份</button><button id="import-save" class="small-button">匯入進度</button></div><input type="file" id="save-file" accept="application/json,.json"><p class="small-note">進度保存在目前的瀏覽器。換裝置前可先匯出備份，再於新裝置匯入。</p>${sourceFooter()}`;
 $$('.stamp[data-record]').forEach(b=>b.onclick=()=>showDetail(data.records.find(r=>r.id===b.dataset.record)));
 $('#export-save').onclick=()=>{const blob=new Blob([JSON.stringify(save,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='熊熊澎湖之旅-進度.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000)};
 $('#import-save').onclick=()=>$('#save-file').click();$('#save-file').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>200000)throw Error('檔案過大');const raw=JSON.parse(await file.text());if(raw.version!==1||!raw.stamps)throw Error('備份格式不符');const incoming=cleanSave(raw,data.records);save.stamps={...save.stamps,...incoming.stamps};save.observed=save.observed||incoming.observed;persist();updateProgress();renderStamps();toast('進度已合併匯入。')}catch{toast('無法匯入，請選擇本遊戲匯出的 JSON 進度備份。')}};
}
function renderTides(){
 const isSea=tideTab==='sea',dates=Object.keys(isSea?data.seaDays:data.forecasts[forecastBlock].days).sort();if(!dates.includes(tideDate))tideDate=dates.find(d=>d>=today())||dates.at(-1);
 $('#panel-body').innerHTML=`<div class="tide-tabs"><button data-tide="sea" class="${isSea?'selected':''}">奎壁山摩西分海</button><button data-tide="forecast" class="${!isSea?'selected':''}">30 天潮汐預報</button></div><div class="tide-controls"><input id="tide-date" type="date" aria-label="潮汐日期" value="${tideDate}" min="${dates[0]}" max="${dates.at(-1)}">${!isSea?`<select id="forecast-block" aria-label="潮汐資料區塊">${data.forecasts.map((g,i)=>`<option value="${i}" ${i===forecastBlock?'selected':''}>區塊 ${g.index}（未標站名）</option>`).join('')}</select>`:''}</div><div id="tide-content"></div>${sourceFooter()}`;
 $$('[data-tide]').forEach(b=>b.onclick=()=>{tideTab=b.dataset.tide;renderTides()});$('#tide-date').onchange=e=>{tideDate=e.target.value;renderTideContent()};if($('#forecast-block'))$('#forecast-block').onchange=e=>{forecastBlock=Number(e.target.value);renderTideContent()};renderTideContent();
}
function tideChart(events,at){
 const points=Array.from({length:97},(_,i)=>({m:i*15,h:interpolateTide(events,i*15)})).filter(x=>x.h!==null);if(!points.length)return '';
 const min=Math.min(...points.map(p=>p.h))-20,max=Math.max(...points.map(p=>p.h))+20,xy=p=>`${(p.m/1440*360+12).toFixed(1)},${(84-(p.h-min)/(max-min)*65).toFixed(1)}`;
 return `<svg class="tide-chart" viewBox="0 0 384 110" role="img" aria-label="潮高插值示意曲線，非實際逐時預報" style="width:100%;margin-top:12px"><path d="M12 84H372" fill="none" stroke="#ccd9c3"/><path d="M${points.map(xy).join(' L')}" fill="none" stroke="#70998a" stroke-width="2.5"/><path d="M${at/1440*360+12} 10V84" stroke="#b68f5e" stroke-dasharray="3 3"/><g fill="#8b9a84" font-size="8"><text x="12" y="103">00:00</text><text x="184" y="103">12:00</text><text x="345" y="103">24:00</text></g></svg>`;
}
function renderTideContent(){
 const isSea=tideTab==='sea',day=isSea?data.seaDays[tideDate]:data.forecasts[forecastBlock].days[tideDate];
 if(!day){$('#tide-content').innerHTML='<div class="empty">原表沒有這個日期的資料，請選擇範圍內的日期。</div>';return}
 if(isSea){
  const pairs=[['緩慢分海',day.open],['緩慢合海',day.close]];
  $('#tide-content').innerHTML=`<div class="tide-summary"><h3>${escape(tideDate)} · 奎壁山</h3><div class="time-pairs">${pairs.map(([a,b])=>`<div>${a}<strong>${b.length?b.map(escape).join(' / '):'原表未列'}</strong></div>`).join('')}</div><p class="small-note">日出 ${escape(day.sunrise||'未列')} · 日沒 ${escape(day.sunset||'未列')}</p></div>${day.reference.length?`<p class="small-note">原表「參考安全通行」：${day.reference.map(escape).join('、')}。此為原表欄位內容，須依現場管制。</p>`:''}<table class="tide-table"><thead><tr><th>潮汐</th><th>潮時</th><th>潮高（原表值）</th></tr></thead><tbody>${day.events.map(e=>`<tr><td class="${e.type==='乾潮'?'low':''}">${escape(e.type)}</td><td>${escape(e.time)}</td><td>${escape(e.height)}</td></tr>`).join('')}</tbody></table><div class="simulator"><h3>讓海，慢慢退去</h3><p>拖曳時間，觀察 3D 場景中礫石步道的變化。</p><div id="tide-chart-wrap">${tideChart(day.events,simMinute)}</div><input id="sim-time" type="range" min="0" max="1439" value="${simMinute}" aria-label="分海示意時間"><div class="slider-labels"><span>00:00</span><span>12:00</span><span>23:59</span></div><output id="sim-output"></output><button id="observe-sea" class="small-button" style="margin-top:14px">${save.observed?'再看一次分海動畫':'觀察分海動畫'}</button><p>潮高以原表極值平滑插值，場景水位為遊戲示意。動畫不判定實際通行條件，赤嶼禁止登島，請遵守現場管制。</p></div><p class="small-note">來源：奎壁山摩西分海。資料範圍 2025/12/31–2027/12/31。</p>`;
  $('#sim-time').oninput=e=>{simMinute=Number(e.target.value);updateSimulation(day);$('#tide-chart-wrap').innerHTML=tideChart(day.events,simMinute)};
  $('#observe-sea').onclick=()=>{start();save.observed=true;closePanel();setRegion('湖西鄉',null,'tide');persist();updateProgress();player.x=16.5;player.z=1;destination=null;engine.angle=1.05;engine.zoom=21;engine.focus=[12,0,0];toast(`已開啟分海示意。場景呈現 ${tideDate} ${clock(simMinute)} 的潮高插值示意，點「全圖」返回底圖。`)};updateSimulation(day);
 }else{
  const group=data.forecasts[forecastBlock];
  $('#tide-content').innerHTML=`<div class="tide-summary"><h3>${escape(tideDate)} · 區塊 ${group.index}</h3><p class="small-note">${escape(day.label).replace(/\n/g,'<br>')}</p></div><p class="small-note">原表重複六組表頭，未提供各區塊的站名。這裡保留原始分組，不對應任何鄉市。日期年份依本次讀取日期推定為 2026。</p><table class="tide-table"><thead><tr><th>潮汐</th><th>時間</th><th>臺灣高程</th><th>當地平均</th><th>海圖</th></tr></thead><tbody>${day.events.map(e=>`<tr><td class="${e.type==='乾潮'?'low':''}">${escape(e.type)}</td><td>${escape(e.time)}</td><td>${escape(e.heightTW)}</td><td>${escape(e.heightLocal)}</td><td>${escape(e.heightChart)}</td></tr>`).join('')}</tbody></table><p class="small-note">高度保留原表值，原表未標單位。區塊表頭位於第 ${group.headerRow} 列。本區資料涵蓋 ${Object.keys(group.days).sort()[0]}–${Object.keys(group.days).sort().at(-1)}，共 ${Object.keys(group.days).length} 日。</p><h4 style="font-size:12px">本區塊所列分／合海欄位</h4><p class="small-note">${day.events.filter(e=>e.open||e.close).map(e=>`${e.open?'緩慢分海 '+escape(e.open):''}${e.close?'緩慢合海 '+escape(e.close):''}（第 ${e.row} 列）`).join('<br>')||'原表未列。'}</p>`;
 }
}
function updateSimulation(day){const h=interpolateTide(day.events,simMinute);tideHeight=h===null?0:clamp(h/200,-.7,.7);if($('#sim-output'))$('#sim-output').textContent=`${clock(simMinute)} · 潮高插值 ${h===null?'無資料':h.toFixed(0)}（原表值）`}

function frame(now){
 const time=now/1000,dt=Math.min(last?time-last:.016,.06);last=time;elapsed+=dt;
 const paused=!!currentPanel||$('#details').open||$('#help-dialog').open;
 let dx=0,dz=0;moving=false;
 if(started&&!paused&&(!mapMode()||(navigation&&(navigation.isOnRoad(player)||journey?.inTransit)))){
  const a=engine.angle,sx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)+joystick.x,sy=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0)+joystick.y;
  if(Math.hypot(sx,sy)>.12&&!journey?.inTransit){mapOverview=false;inspectPoint=null;stopWalking();dx=sx*Math.cos(a)+sy*Math.sin(a);dz=-sx*Math.sin(a)+sy*Math.cos(a)}
  if(mapMode()){
   if(dx||dz)moving=navigation.manual(player,dx,dz,dt*(keys.has('shift')?5:3));
   else moving=(journey?.advance(player,dt)||0)>1e-8;
  }else{
   if(destination&&!dx&&!dz){dx=destination.x-player.x;dz=destination.z-player.z;if(Math.hypot(dx,dz)<.025){player.x=destination.x;player.z=destination.z;destination=null;dx=dz=0}}
   if(dx||dz){const speed=destination?Math.min(7,Math.hypot(dx,dz)/Math.max(dt,.001)):7;moving=movePlayer(player,dx,dz,dt,speed,insideIsland)}
  }
 }
 const mobile=innerWidth<700;
 let focus=mapMode()?(mapOverview?[(MAP.minX+MAP.maxX)/2,0,(MAP.minZ+MAP.maxZ)/2]:inspectPoint?[inspectPoint.x,0,inspectPoint.z]:[player.x,0,player.z]):started?[player.x*.35,0,player.z*.25]:[mobile?2:-11,0,mobile?8:5];
 // Observation viewpoint stays near the tidal causeway until the player moves.
 if(observingSea&&started&&save.observed&&player.x>15&&!moving)focus=[11,0,-1];
 for(const i of [0,2])engine.focus[i]+=(focus[i]-engine.focus[i])*Math.min(1,dt*2);
 if(mapMode()&&mapOverview)engine.zoom=Math.max(MAP.height*Math.sin(engine.tilt)/2,MAP.width/(innerWidth/innerHeight)/2)*1.12;else if(!started)engine.zoom=mapMode()?(mobile?12:20):(mobile?27:24);
 if(mapMode()&&journey?.revision!==routeRevision){engine.setRoute(journey?.active?journey.geometry(player):null);routeRevision=journey?.revision}
 persistElapsed+=dt;if(persistElapsed>=2){persistElapsed=0;persist()}
 const g=new Geometry();
 g.cylinder(player.x,1.025,player.z,.35,.012,.23,'#9ca78f',22);
 for(const n of displayedNodes()){
  if(mapMode()&&(engine.zoom>40||Math.abs(n.x-engine.focus[0])>engine.zoom*innerWidth/innerHeight*1.4||Math.abs(n.z-engine.focus[2])>engine.zoom*1.8))continue;
  const stamped=save.stamps[n.record.id],col=stamped?'#a2bd80':KINDS[n.record.kind].color,y=4.25+Math.sin(time*1.7+n.index)*.15;
  // Real-map miniatures already identify places. Floating crystals would
  // multiply across hundreds of records and hide roads; keep them in the tide illustration only.
  if(!mapMode()&&!stamped){g.cylinder(n.x,y,n.z,.2,.45,.2,col,5,0);g.cylinder(n.x,y-.45,n.z,.2,.45,.2,col,5,0)}
  if(n===target){const p=approach(n);if(p){g.cylinder(p.x,1.07,p.z,.34,.025,.34,'#f8e7ad',24);g.cylinder(p.x,1.1,p.z,.23,.02,.23,'#91ac71',24)}}
 }
 // The water plane rises and falls in the tidal illustration.
 if(!engine.water){const water=new Geometry();water.quad([-160,0,-160],[-160,0,160],[160,0,160],[160,0,-160],'#70bbb9');engine.water=engine.upload(water)}
 // Slightly submerged / exposed causeway segments show the selected tide state.
 const waterY=tideHeight*.7;
 if(Math.abs((engine.lastWater??99)-waterY)>.015){const water=new Geometry();water.quad([-160,waterY,-160],[-160,waterY,160],[160,waterY,160],[160,waterY,-160],'#70bbb9');engine.gl.deleteBuffer(engine.water.buffer);engine.water=engine.upload(water);engine.lastWater=waterY}
 engine.render(time,g);
 const feet=engine.project([player.x,1.05,player.z]),head=engine.project([player.x,4.8,player.z]),avatar=$('#bearbao-avatar');
 if(feet&&head){const size=clamp(Math.abs(head.y-feet.y)*.82,8,100),bob=moving?Math.sin(time*12)*2:Math.sin(time*2)*.3;avatar.style.left=feet.x+'px';avatar.style.top=(feet.y-bob)+'px';avatar.style.width=size+'px';avatar.style.height=size+'px';avatar.style.setProperty('--lean',moving?Math.sin(player.facing+engine.angle)*3+'deg':'0deg');avatar.hidden=(mapMode()&&(!navigation||!navigation.isOnRoad(player)&&!journey?.inTransit))||feet.x< -size||feet.x>innerWidth+size||feet.y<0||feet.y>innerHeight+size}
 const boat=$('#ferry-boat'),sailing=mapMode()&&journey?.inTransit&&!navigation.isLand(player.x,player.z);
 boat.hidden=!sailing||!feet||avatar.hidden;
 if(!boat.hidden){const size=parseFloat(avatar.style.width)||30;boat.style.left=feet.x+'px';boat.style.top=(feet.y+size*.24)+'px';boat.style.width=(size*1.65)+'px';boat.style.height=(size*.7)+'px';boat.style.setProperty('--rock',Math.sin(time*2)*2+'deg')}
 const layout=labelLayout(displayedNodes(),p=>engine.project(p),innerWidth,innerHeight,mapMode()?engine.zoom:10,target?.record.id,mapMode()?MAP_MARKER_LABEL_Y:2);
 for(const n of nodes){const p=layout.get(n.index),el=n.label;if(!el)continue;el.hidden=!p;if(!p)continue;n.cluster=p.members||[n];const count=n.cluster.length,dot=el.querySelector('.dot'),text=count>1?String(count):KINDS[n.record.kind].symbol;if(dot.textContent!==text)dot.textContent=text;el.classList.toggle('cluster',count>1);el.setAttribute('aria-label',count>1?`查看此處 ${count} 個地點`:`選取${n.record.name}`);el.style.left=p.x+'px';el.style.top=p.y+'px';el.classList.toggle('compact',p.compact);el.style.zIndex=p.selected?'3000':String(100+Math.round(p.y));}
 const compass=$('.compass svg');compass.style.transform=`rotate(${-engine.angle*180/Math.PI}deg)`;
 if(Math.floor(elapsed*4)!==Math.floor((elapsed-dt)*4)){
  if(mapMode()){$('#terrain-state').textContent=journey?.active?journey.label:navigation?(navigation.isOnRoad(player)?`熊寶：${navigation.isLand(player.x,player.z)?'陸地道路':'已收錄橋面'} · ${player.roadName}`:'等待道路起點'):'道路與港口載入中';if(journey?.error){toast(journey.error);journey.error=''}}else $('#terrain-state').textContent='分海動畫：獨立示意場景';
  if(started){if(!mapMode()){const best=nodes.map(n=>({n,d:distanceTo(n)})).sort((a,b)=>a.d-b.d)[0];if(!destination&&best?.d<interactionRange()&&target!==best.n)target=best.n}updateDestination()}
 }
 requestAnimationFrame(frame);
}
function bindControls(){
 document.body.classList.add('not-started');$('#start').onclick=start;$('#home').onclick=e=>{e.preventDefault();returnToMap();start();inspectPoint=null;mapOverview=false;engine.focus=[player.x,0,player.z];toast('回到熊寶目前位置。')};$('#help').onclick=()=>{keys.clear();$('#help-dialog').showModal()};$('#help-go').onclick=()=>{$('#help-dialog').close();start()};
 $('#place-kind').onchange=e=>{Object.assign(enabledKinds,categoryKinds(e.target.value));refreshPlaceVisibility()};$('#places-catalog').onclick=()=>openPanel('atlas');
 $('#map-overview').onclick=()=>{returnToMap();mapOverview=true;inspectPoint=null;engine.angle=0;engine.tilt=1.12;toast('全區地圖；用下方下拉選單選類別，點數字查看群組。')};$('#zoom-in').onclick=()=>{mapOverview=false;engine.zoom=clamp(engine.zoom*.72,3,650)};$('#zoom-out').onclick=()=>{mapOverview=false;engine.zoom=clamp(engine.zoom/ .72,3,650)};$('#map-follow').onclick=()=>{mapOverview=false;inspectPoint=null;engine.zoom=innerWidth<700?10:12;engine.focus=[player.x,0,player.z]};
 $$('.dialog-close').forEach(b=>b.onclick=()=>b.closest('dialog').close());$$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close()}}));
 $('#close-panel').onclick=closePanel;$$('[data-panel]').forEach(b=>b.onclick=()=>openPanel(b.dataset.panel));
 $('#region').onchange=e=>navigateRegion(e.target.value);
 setupAsk();
 window.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName))return;const k=e.key.toLowerCase();if(k==='escape'){closePanel();return}if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift','e'].includes(k)){e.preventDefault();if(k==='e'&&!e.repeat)interact();else keys.add(k)}});
 window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{keys.clear();joystick={x:0,y:0};persist()});document.addEventListener('visibilitychange',()=>{keys.clear();joystick={x:0,y:0};last=0;persist()});
 let drag=null;$('#world').addEventListener('pointerdown',e=>{if(currentPanel)return;drag={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:0};$('#world').setPointerCapture(e.pointerId)});
 $('#world').addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.lastX,dy=e.clientY-drag.lastY;drag.moved+=Math.abs(dx)+Math.abs(dy);if(drag.moved>7){engine.angle-=dx*.006;engine.tilt=clamp(engine.tilt+dy*.003,.48,1.1)}drag.lastX=e.clientX;drag.lastY=e.clientY});
 $('#world').addEventListener('pointerup',e=>{if(drag&&drag.moved<7){const p=engine.ground(e.clientX,e.clientY,mapMode()?.98:1.02);if(p){if(mapMode()&&!navigation){toast('道路資料未就緒，步行暫停。')}else if(mapMode()||insideIsland(p.x,p.z)){start();mapOverview=false;clearTarget();planTrip(p)}}}drag=null});$('#world').addEventListener('pointercancel',()=>drag=null);
 $('#world').addEventListener('wheel',e=>{e.preventDefault();mapOverview=false;engine.zoom=clamp(engine.zoom+e.deltaY*.025,3,mapMode()?650:39)},{passive:false});
 /* 手機：兩指縮放地圖（單指拖曳、點選道路維持原本行為） */
 const touches=new Map();let pinch=null;const pinchSpan=()=>{const [a,b]=[...touches.values()];return Math.max(1,Math.hypot(a.x-b.x,a.y-b.y))};
 const onMap=t=>t===$('#world')||!!t?.closest?.('#labels');
 window.addEventListener('pointerdown',e=>{if(currentPanel||e.pointerType!=='touch'||!onMap(e.target))return;touches.set(e.pointerId,{x:e.clientX,y:e.clientY});if(touches.size===2){drag=null;pinch={span:pinchSpan(),zoom:engine.zoom}}});
 window.addEventListener('pointermove',e=>{if(!touches.has(e.pointerId))return;touches.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pinch&&touches.size>=2){mapOverview=false;engine.zoom=clamp(pinch.zoom*pinch.span/pinchSpan(),3,mapMode()?650:39)}});
 const endTouch=e=>{touches.delete(e.pointerId);if(touches.size<2)pinch=null;if(touches.size)drag=null};window.addEventListener('pointerup',endTouch);window.addEventListener('pointercancel',endTouch);
 const joy=$('#joystick'),stick=$('#stick');let joyId=null,joyCenter=null;
 /* 按下時記住搖桿中心：拖曳中下方卡片高度改變、搖桿跟著移位時，方向不會跳動 */
 const updateJoy=e=>{if(!joyCenter){const r=joy.getBoundingClientRect();joyCenter={x:r.left+r.width/2,y:r.top+r.height/2}}const x=e.clientX-joyCenter.x,y=e.clientY-joyCenter.y,scale=Math.min(1,30/Math.hypot(x,y));joystick={x:x*scale/30,y:y*scale/30};stick.style.transform=`translate(${x*scale}px,${y*scale}px)`};
 joy.addEventListener('pointerdown',e=>{e.preventDefault();joyId=e.pointerId;joyCenter=null;joy.setPointerCapture(joyId);updateJoy(e)});joy.addEventListener('pointermove',e=>{if(joyId===e.pointerId)updateJoy(e)});const resetJoy=()=>{joyId=null;joyCenter=null;joystick={x:0,y:0};stick.style.transform=''};joy.addEventListener('pointerup',resetJoy);joy.addEventListener('pointercancel',resetJoy);$('#touch-action').onclick=interact;
 $('#world').addEventListener('webglcontextlost',e=>{e.preventDefault();toast('3D 顯示中斷。進度已保留，請重新載入遊戲。')});
}
/* 問熊寶：本機文字查詢。只列原表地點；「前往」沿用 navigateTo（沿道路／港口搭船，不瞬移） */
const FERRY_AREAS=['望安鄉','七美鄉'];
function closeAsk(){const box=$('#ask-results');if(box){box.hidden=true;box.innerHTML=''}document.body.classList.remove('ask-open')}
function renderAsk(text){
 const box=$('#ask-results');if(!box||!data)return;
 const lat=Math.cos(23.55*Math.PI/180),res=askPlaces(text,data.records,{distanceOf:r=>{const p=mapPosition(r);return p?Math.hypot(p.x-player.x,p.z-player.z):Infinity}});
 if(!res.raw){closeAsk();return}
 const km=d=>Number.isFinite(d)?`直線約 ${(d*WORLD_METRES*lat/1000).toFixed(d*WORLD_METRES*lat<10000?1:0)} 公里`:'無座標';
 const head=res.summary?`<div class="ask-area"><div><strong>${escape(res.area)}</strong><span>${Object.entries(KINDS).map(([k,v])=>`${v.label} ${res.summary[k]}`).join('・')}</span>${FERRY_AREAS.includes(res.area)?'<small>離島：會先沿路到馬公南海交通船碼頭，再搭船前往</small>':''}</div><button class="primary" data-ask-region="${escape(res.area)}">前往${escape(res.area)} <span>↗</span></button></div>`:'';
 const items=res.results.map(({record:r,reason,distance})=>{const photo=placeImages(r)[0],mapped=!!mapPosition(r);return `<li class="ask-item"><button class="ask-info" data-ask-detail="${r.id}">${photo?`<img data-place-photo src="${escape(photo.src)}" alt="" loading="lazy" decoding="async">`:`<span class="ask-symbol" style="--tag:${KINDS[r.kind].color}">${KINDS[r.kind].symbol}</span>`}<span class="ask-text"><b>${escape(r.name)}</b><small>${KINDS[r.kind].label} · ${escape(r.area)} · ${km(distance)}</small>${reason?`<em>${escape(reason)}</em>`:''}</span></button><button class="ask-go" data-ask-go="${r.id}" ${mapped?'':'disabled'}>${mapped?'前往':'缺座標'}</button></li>`}).join('');
 const more=res.total>res.results.length?`<button class="ask-more" data-ask-atlas>共 ${res.total} 筆，在圖鑑看全部 ↗</button>`:'';
 const empty=!res.results.length?`<p class="ask-empty">找不到符合「${escape(res.raw)}」的地點。可以試試地區（七美）、類別（美食、廟）、神明（玄天上帝、媽祖）或地點名稱。</p>`:'';
 box.innerHTML=`<div class="ask-head"><span>熊寶找到 ${res.total} 個地點</span><button class="ask-close" aria-label="關閉查詢結果">×</button></div>${head}${empty}<ul class="ask-list">${items}</ul>${more}`;
 box.hidden=false;document.body.classList.add('ask-open');bindPhotoErrors(box);
 box.querySelector('.ask-close').onclick=closeAsk;
 box.querySelector('[data-ask-region]')?.addEventListener('click',e=>{closeAsk();start();$('#region').value=e.currentTarget.dataset.askRegion;navigateRegion(e.currentTarget.dataset.askRegion)});
 box.querySelectorAll('[data-ask-go]').forEach(b=>b.onclick=()=>{const r=data.records.find(x=>x.id===b.dataset.askGo);closeAsk();navigateTo(r)});
 box.querySelectorAll('[data-ask-detail]').forEach(b=>b.onclick=()=>showDetail(data.records.find(x=>x.id===b.dataset.askDetail)));
 box.querySelector('[data-ask-atlas]')?.addEventListener('click',()=>{closeAsk();atlasQuery=res.keyword;atlasArea=res.area;atlasKind=res.kind;atlasLimit=24;openPanel('atlas')});
}
function setupAsk(){
 const form=$('#ask'),input=$('#ask-input');if(!form||!input)return;let timer=0;
 form.addEventListener('submit',e=>{e.preventDefault();clearTimeout(timer);renderAsk(input.value);input.blur()});
 input.addEventListener('input',()=>{clearTimeout(timer);const v=input.value.trim();if(!v){closeAsk();return}if(v.length>=2)timer=setTimeout(()=>renderAsk(v),350)});
 input.addEventListener('keydown',e=>{if(e.key==='Escape'){closeAsk();input.blur()}});
 $('#world').addEventListener('pointerdown',()=>{if(!$('#ask-results').hidden)closeAsk()});
}
let coastLoading=false;
async function prepareCoastline(){
 if(coastLoading)return;coastLoading=true;$('#coast-retry').disabled=true;$('#coast-retry').hidden=true;$('.geo-status').classList.remove('error');$('#coast-state').textContent='載入道路與陸域資料…';
 try{
  const previousTrip=journey?.snapshot();const [{geo,grid},graph,ferries]=await Promise.all([loadTerrain(),loadRoads(),loadFerries()]);const coast=new Coastline(geo);navigation=new RoadNavigation(graph,coast);journey=new Journey(new TravelPlanner(navigation,ferries,grid.sourceSHA256));if(previousTrip)journey.restore(mapReturn?.player||player,previousTrip);engine.configureMap(MAP,coast);engine.setRoads(navigation.geometry());
  $('#coast-state').textContent='沿道路移動已啟用';$('.geo-status').classList.add('ready');$('#coast-retry').hidden=true;
  if(!observingSea)setRegion($('#region').value,target?.record);if(started)toast('道路已就緒，熊寶會沿路線轉彎前進。');
 }catch(e){$('.geo-status').classList.add('error');$('#coast-state').textContent='道路或陸域未載入，請重試';$('#coast-retry').hidden=false;toast(e.message||'道路或陸域檔案未載入，請按重試。')}
 finally{coastLoading=false;$('#coast-retry').disabled=false}
}
async function init(){
 try{
  const r=await fetch('data.json');if(!r.ok)throw Error('無法載入遊戲資料');data=await r.json();
  let raw={};try{raw=JSON.parse(localStorage.getItem(SAVE_KEY)||'{}')}catch{saveAvailable=false}save=cleanSave(raw,data.records);
  engine=new Engine($('#world'));engine.configureMap(MAP);engine.tiles=new TileMap(engine,s=>{$('#tile-state').textContent=s;$('.geo-status').classList.toggle('has-map-error',s.includes('未載入'))});engine.zoom=44;
  $('#region').innerHTML=AREAS.map(a=>`<option value="${a}">${a}</option>`).join('');bindControls();setRegion(save.area);
  $('#map-layer').onchange=e=>{engine.tiles.setLayer(e.target.value);$('#layer-credit').textContent=LAYERS[e.target.value].credit;$('#layer-credit').href=LAYERS[e.target.value].href};
  $('#coast-retry').onclick=()=>{engine.tiles.retry();prepareCoastline()};$('#map-retry').onclick=()=>engine.tiles.retry();
  $('#north-liao').onclick=()=>navigateTo(data.records.find(r=>r.id==='temple-76'));
  const sea=data.seaDays[tideDate]||Object.values(data.seaDays)[0];updateSimulation(sea);
  $('#loading').hidden=true;requestAnimationFrame(frame);prepareCoastline();
 }catch(e){$('#loading').classList.add('error');$('#loading').innerHTML=`<div class="error-box"><h2>熊寶暫時無法出發</h2><p>${escape(e.message)}</p><button class="primary" onclick="location.reload()">重新載入</button></div>`;console.error(e)}
}
init();
