// Asset packaging only: preserve composition, use EXIF orientation, fit within
// 1600 px without cropping, and encode web-sized copies of the source photos.
// Requires ImageMagick `convert` and `identify`; the deployed game does not.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
const request=await new Promise((resolve,reject)=>{
 let input='';const tty=process.stdin.isTTY;if(tty){process.stdin.setRawMode(true);process.stderr.write('Ready for photo transfer JSON on stdin (input is hidden).\n')}
 process.stdin.setEncoding('utf8');process.stdin.on('data',chunk=>{input+=chunk;if(input.includes('\n')){if(tty)process.stdin.setRawMode(false);process.stdin.pause();try{resolve(JSON.parse(input))}catch(e){reject(e)}}});
});
const run=(cmd,args)=>new Promise((resolve,reject)=>{const p=spawn(cmd,args,{stdio:['ignore','pipe','pipe']});let output='';p.stdout.on('data',s=>output+=s);p.on('error',reject);p.on('close',code=>code?reject(Error(cmd+' failed')):resolve(output.trim()))});
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const cache=path.resolve(request.cacheRoot),out=path.resolve('dist/assets/places');await fs.mkdir(cache,{recursive:true});await fs.mkdir(out,{recursive:true});
let results=[];try{results=JSON.parse(await fs.readFile(request.manifestPath,'utf8'))}catch{}
const pending=[...request.entries],errors=[];let completed=0;
async function worker(){while(pending.length){const item=pending.shift();try{
 if(!/^[A-Za-z0-9_-]+$/.test(item.id))throw Error('Invalid image id');
 const destination=path.join(out,item.id+'.webp'),cached=path.join(cache,item.id),previous=results.find(r=>r.id===item.id);
 if(previous){try{if(hash(await fs.readFile(destination))===previous.sha256){completed++;continue}}catch{}}
 let original;try{original=await fs.readFile(cached);if(original.length!==item.bytes)throw Error('Stale cache')}catch{
  const response=await fetch(item.transfer.download_url,{signal:AbortSignal.timeout(90000)});if(!response.ok)throw Error('Download HTTP '+response.status);original=Buffer.from(await response.arrayBuffer());if(original.length!==item.bytes)throw Error('Source byte size mismatch');await fs.writeFile(cached,original);
 }
 await run('convert',[cached,'-auto-orient','-resize','1600x1600>','-quality','84',destination]);
 const [width,height]=(await run('identify',['-format','%w %h',destination])).split(' ').map(Number),bytes=await fs.readFile(destination);
 const result={id:item.id,title:item.name,src:'assets/places/'+item.id+'.webp',width,height,bytes:bytes.length,sha256:hash(bytes),sourceBytes:original.length,sourceSHA256:hash(original),transform:'EXIF orientation; fit within 1600x1600; WebP quality 84; no crop or retouch'};
 results=results.filter(r=>r.id!==item.id);results.push(result);completed++;
 }catch(e){errors.push({id:item.id,error:e.message})}}}
await Promise.all(Array.from({length:4},worker));
await fs.writeFile(request.manifestPath,JSON.stringify(results,null,2));
console.log(JSON.stringify({completed,stored:results.length,totalBytes:results.reduce((s,r)=>s+r.bytes,0),errors}));if(errors.length)process.exitCode=1;
