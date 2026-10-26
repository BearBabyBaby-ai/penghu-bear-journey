import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {mapPlaces,regionalSpawn,REGION_STARTS} from '../dist/places.js';
import {RoadNavigation} from '../dist/roads.js';
import {Coastline} from '../dist/coastline.js';
import {worldToGeo} from '../dist/map.js';
import {placeImages,imageSource} from '../dist/media.js';
const read=name=>JSON.parse(fs.readFileSync(new URL('../'+name,import.meta.url)));
const data=read('dist/data.json'),snapshot=read('sources/approved-sheet-snapshot-20261015.json'),manifest=read('dist/assets/places/PHOTO-MANIFEST.json');
const nav=new RoadNavigation(read('dist/geo/penghu-roads-20211217.json'),new Coastline(read('dist/geo/penghu-land-20260407.geojson'))),nodes=mapPlaces(data.records,nav);
for(const [area,id]of Object.entries(REGION_STARTS)){const spawn=regionalSpawn(nodes,area);assert(nav.isOnRoad(spawn),area);assert.equal(spawn.startRecordId,id)}
const white=regionalSpawn(nodes,'白沙鄉'),gupo=nodes.find(n=>n.record.name==='姑婆嶼'),geo=worldToGeo(white.x,white.z);
assert.equal(white.startName,'澎湖水族館');assert.equal(white.component,5);assert.notEqual(white.component,gupo.approach.component);assert(geo.lat>23.64&&geo.lat<23.66&&geo.lng>119.59&&geo.lng<119.62);
const shuffled=[gupo,...nodes.filter(n=>n!==gupo).reverse()];assert.equal(regionalSpawn(shuffled,'白沙鄉').startRecordId,'sight-100','Never use the first source row as the district start');
const missingPreferred=nodes.filter(n=>n.record.id!=='sight-100');assert.equal(regionalSpawn(missingPreferred,'白沙鄉').component,5,'Fallback stays on the main connected district road component');
assert.equal(regionalSpawn([],'白沙鄉'),null);
assert.equal(snapshot.food.values.length-1,608);for(let i=1;i<snapshot.food.values.length;i++){const row=snapshot.food.values[i],record=data.records.find(r=>r.id==='food-'+(i+1));assert(record);assert.equal(record.name,row[3]);assert.equal(record.area,row[0]);assert.equal(record.lat,row[10]?Number(row[10]):null);assert.equal(record.lng,row[11]?Number(row[11]):null)}
assert.equal(manifest.photos.length,141);assert.deepEqual(Object.fromEntries(['food','sight','temple'].map(k=>[k,manifest.photos.filter(p=>p.recordId.startsWith(k+'-')).length])),{food:11,sight:96,temple:34});
const sourceRows=new Map(snapshot.images.map(p=>[p.sheet+':'+p.row,p.raw]));for(let i=1;i<snapshot.food.values.length;i++)if(snapshot.food.values[i][12])sourceRows.set('美食清單:'+(i+1),snapshot.food.values[i][12]);
for(const photo of manifest.photos){const record=data.records.find(r=>r.id===photo.recordId),image=placeImages(record).find(i=>i.driveFileId===photo.id);assert(record&&image);assert.equal(photo.recordName,record.name);assert(sourceRows.get(record.sheet+':'+record.row).includes(photo.id),'Photo must match that exact source row');assert.equal(image.src,photo.src);assert(imageSource(image).includes(photo.id));const bytes=fs.readFileSync(new URL('../dist/'+image.src,import.meta.url));assert.equal(bytes.toString('ascii',8,12),'WEBP');assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),photo.sha256);assert.equal(bytes.length,photo.bytes);assert(image.width<=1600&&image.height<=1600);assert(/^[a-f0-9]{64}$/.test(photo.sourceSHA256))}
assert.equal(data.records.reduce((n,r)=>n+placeImages(r).length,0),141);assert.equal(placeImages({images:[{src:'https://example.test/a.jpg',width:1,height:1}]}).length,0);assert.equal(imageSource({sourceURL:'javascript:alert(1)'}),'');
const nonImage=data.records.find(r=>r.id==='food-551');assert.equal(placeImages(nonImage).length,0);assert(nonImage.imageLinks[0].includes('maps.app.goo.gl'));
console.log('PASS content: all 608 food rows match the source; six explicit mainland/district starts including Baisha aquarium; 141 original-row photo mappings with valid portable WebP assets and SHA-256, no invented photo for the map-only link.');
