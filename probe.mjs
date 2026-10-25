import fs from 'node:fs';
const out=[];const log=s=>{out.push(s);console.log(s)};
for(const id of [39523,157002,127248]){try{const r=await fetch(`https://data.gov.tw/api/v2/rest/dataset/${id}`);const t=await r.text();log(`== ${id} ${r.status}\n`+t.slice(0,2500))}catch(e){log(id+' err '+e.message)}}
try{const r=await fetch('https://data.gov.tw/api/v2/rest/dataset?q='+encodeURIComponent('澎湖 建物'));log('== search '+r.status+'\n'+(await r.text()).slice(0,3000))}catch(e){log('search err '+e.message)}
try{const r=await fetch('https://overturemaps-us-west-2.s3.amazonaws.com/?list-type=2&prefix=release/&delimiter=/');log('== overture '+(await r.text()).match(/release\/[^<]+/g)?.join(' '))}catch(e){log('ov err '+e.message)}
fs.mkdirSync('data',{recursive:true});fs.writeFileSync('data/probe.txt',out.join('\n'));
