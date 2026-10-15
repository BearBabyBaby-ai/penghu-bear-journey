import fs from 'node:fs';
const data=JSON.parse(fs.readFileSync('dist/data.json','utf8'));
const assets=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const byId=new Map(assets.map(a=>[a.id,a])),rows=[];
for(const record of data.records)for(const image of record.images||[]){
 const asset=byId.get(image.driveFileId);if(!asset)throw Error('No photo asset for '+record.id);
 Object.assign(image,{src:asset.src,width:asset.width,height:asset.height});
 rows.push({recordId:record.id,recordName:record.name,sheet:record.sheet,row:record.row,sourceURL:image.sourceURL,...asset});
}
fs.writeFileSync('dist/data.json',JSON.stringify(data)+'\n');
fs.writeFileSync('dist/assets/places/PHOTO-MANIFEST.json',JSON.stringify({date:'2026-10-15',method:'Original spreadsheet photos, EXIF orientation, fit within 1600 px, WebP q84, no crop or retouch',photos:rows},null,2)+'\n');
console.log(JSON.stringify({photos:rows.length,byKind:Object.fromEntries(['food','sight','temple'].map(k=>[k,rows.filter(r=>r.recordId.startsWith(k+'-')).length]))}));
