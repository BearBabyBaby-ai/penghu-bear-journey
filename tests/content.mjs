import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {mapPlaces,regionalSpawn,REGION_STARTS} from '../dist/places.js';
import {RoadNavigation} from '../dist/roads.js';
import {Coastline} from '../dist/coastline.js';
import {worldToGeo} from '../dist/map.js';
import {placeImages,imageSource} from '../dist/media.js';
import {data as LIVE_DATA} from './live.mjs';
import {migrateId} from '../dist/id-migrate.js';
const read=name=>JSON.parse(fs.readFileSync(new URL('../'+name,import.meta.url)));
const data=LIVE_DATA;
const nav=new RoadNavigation(read('dist/geo/penghu-roads-20211217.json'),new Coastline(read('dist/geo/penghu-land-20260407.geojson'))),nodes=mapPlaces(data.records,nav);
for(const [area,id]of Object.entries(REGION_STARTS)){const spawn=regionalSpawn(nodes,area);assert(nav.isOnRoad(spawn),area);assert.equal(spawn.startRecordId,id)}
const white=regionalSpawn(nodes,'白沙鄉'),gupo=nodes.find(n=>n.record.name==='姑婆嶼'),geo=worldToGeo(white.x,white.z);
assert.equal(white.startName,'澎湖水族館');assert.equal(white.component,5);assert.notEqual(white.component,gupo.approach.component);assert(geo.lat>23.64&&geo.lat<23.66&&geo.lng>119.59&&geo.lng<119.62);
const shuffled=[gupo,...nodes.filter(n=>n!==gupo).reverse()];assert.equal(regionalSpawn(shuffled,'白沙鄉').startRecordId,migrateId('sight-100'),'Never use the first source row as the district start');
const missingPreferred=nodes.filter(n=>n.record.id!==migrateId('sight-100'));assert.equal(regionalSpawn(missingPreferred,'白沙鄉').component,5,'Fallback stays on the main connected district road component');
assert.equal(regionalSpawn([],'白沙鄉'),null);
// 照片只來自同一列的圖資欄（原表雲端硬碟檔案），沒有照片就是空的；地圖連結不當照片
for(const r of data.records){const imgs=placeImages(r);assert(imgs.length<=1);for(const i of imgs){assert(i.src.includes(i.driveFileId));assert.equal(imageSource(i),i.sourceURL)}}
assert(data.records.reduce((n,r)=>n+placeImages(r).length,0)>100);assert.equal(placeImages({images:[{src:'https://example.test/a.jpg',width:1,height:1}]}).length,0);assert.equal(imageSource({sourceURL:'javascript:alert(1)'}),'');
const nonImage=data.records.find(r=>r.id===migrateId('food-551'));assert(nonImage,'food-551 still in the sheet');assert.equal(placeImages(nonImage).length,0);assert(nonImage.imageLinks[0].includes('maps.app.goo.gl'));
console.log('PASS content: live sheet records; six explicit mainland/district starts including Baisha aquarium; photos only from each row\'s own photo column, no invented photo for the map-only link.');
