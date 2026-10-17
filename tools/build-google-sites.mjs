// 產生 Google 協作平台「全頁嵌入 → 嵌入程式碼」用的單一 index.html：
// 遊戲的 HTML、CSS、全部程式碼都內嵌在這一個檔案裡；資料、道路、相片、角色圖等大型檔案
// 以 <base> 指向正式網址（GitHub Pages）讀取。每次遊戲更新後執行：node tools/build-google-sites.mjs
import fs from 'node:fs';
const BASE=process.argv[2]||'https://bearbabybaby-ai.github.io/penghu-bear-journey/';
const D='dist/',read=f=>fs.readFileSync(D+f,'utf8');
const ORDER=['map','engine','model','media','coastline','navigation','places','roads','tiles','travel','ask','ferry-sheet','enforcement'];
const ident=n=>'__m_'+n.replace(/-/g,'_');
const rewriteImports=src=>src.replace(/^import \{([^}]*)\} from '\.\/([\w-]+)\.js[^']*';\s*$/gm,(_,names,mod)=>`const {${names.split(',').map(s=>s.trim()).filter(Boolean).map(s=>s.replace(/\s+as\s+/,':')).join(',')}}=${ident(mod)};`);
let bundle='';
for(const m of ORDER){
 let src=rewriteImports(read(m+'.js'));const names=[];
 src=src.replace(/^export (async function|function|class|const|let) (\w+)/gm,(_,kind,name)=>{names.push(name);return `${kind} ${name}`});
 if(/^\s*export\b/m.test(src)||/^import /m.test(src))throw Error(m+': unsupported export/import form');
 bundle+=`const ${ident(m)}=(()=>{\n${src}\nreturn {${names.join(',')}};\n})();\n`;
}
let game=rewriteImports(read('game.js'));if(/^import /m.test(game))throw Error('game.js imports left');
bundle+=`(()=>{\n${game}\n})();\n`;
let html=read('index.html');
const css=read('style.css'),mobile=read('mobile-layout.js');
html=html.replace(/<link rel="stylesheet" href="style\.css[^"]*">/,()=>`<style>\n${css}\n</style>`);
html=html.replace(/<link rel="manifest"[^>]*>/,'');
html=html.replace(/\s*<script type="module" src="game\.js[^"]*"><\/script>/,'').replace(/\s*<script type="module" src="mobile-layout\.js[^"]*"><\/script>/,'').replace(/\s*<script src="pwa\.js[^"]*"><\/script>/,'');
if(/<script[^>]+src=/.test(html)||/href="style\.css/.test(html))throw Error('external script/style left');
// 協作平台會把嵌入碼包進它自己的頁面，原本的 <base> 可能失效：靜態網址全部改成絕對網址，執行時再把 <base> 插到最前面，並讓相對路徑的 fetch 一律指向正式網址
html=html.replace(/(src|href|data-src)="(?![a-z]+:|#|\/\/)([^"]+)"/gi,(_,attr,url)=>`${attr}="${BASE}${url}"`);
bundle=`(()=>{const ROOT=${JSON.stringify(BASE)};try{const b=document.createElement('base');b.href=ROOT;document.head.prepend(b)}catch{}const f=window.fetch.bind(window);window.fetch=(u,o)=>f(typeof u==='string'&&!/^[a-z][a-z0-9+.-]*:/i.test(u)?new URL(u,ROOT).href:u,o)})();\n`+bundle;
html=html.replace('<head>',()=>`<head>\n <!-- Google 協作平台全頁嵌入版（由 tools/build-google-sites.mjs 從 dist/ 產生，程式碼全部內嵌；資料與圖片從正式網址讀取） -->\n <base href="${BASE}">`);
html=html.replace('</body>',()=>`<script>\n${bundle}</script>\n<script>\n${mobile}\n</script>\n</body>`);
const out=process.argv[3]||'google-sites/index.html';fs.mkdirSync(out.replace(/[^/]+$/,''),{recursive:true});fs.writeFileSync(out,html);
console.log(out,(html.length/1024).toFixed(0)+'KB');
