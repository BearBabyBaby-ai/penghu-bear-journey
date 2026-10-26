// 在 `npx cap add android` 之後執行：放入原生程式、圖示、權限與子母畫面設定、版本號。
// 用法：node scripts/patch-android.mjs   環境變數：VERSION_CODE、VERSION_NAME、TEST_BUILD=1（沒有正式金鑰時的測試版）
import fs from 'node:fs';import path from 'node:path';
const A='android/app/src/main',pkgDir=path.join(A,'java/io/github/bearbabybaby_ai/penghubear');
const must=(c,msg)=>{if(!c){console.error('patch-android: '+msg);process.exit(1)}};
// 1. 原生程式
fs.mkdirSync(pkgDir,{recursive:true});
for(const f of fs.readdirSync('native'))fs.copyFileSync(path.join('native',f),path.join(pkgDir,f));
// 2. 啟動圖示（tools/build-app-icons.py 產生，只縮放）
const copyDir=(src,dst)=>{for(const e of fs.readdirSync(src,{withFileTypes:true})){const s=path.join(src,e.name),d=path.join(dst,e.name);if(e.isDirectory()){fs.mkdirSync(d,{recursive:true});copyDir(s,d)}else fs.copyFileSync(s,d)}};
copyDir('res',path.join(A,'res'));
// 3. AndroidManifest：權限、子母畫面
const mf=path.join(A,'AndroidManifest.xml');let m=fs.readFileSync(mf,'utf8');
const perms=['android.permission.INTERNET','android.permission.ACCESS_COARSE_LOCATION','android.permission.ACCESS_FINE_LOCATION','android.permission.FOREGROUND_SERVICE','android.permission.FOREGROUND_SERVICE_LOCATION','android.permission.POST_NOTIFICATIONS','android.permission.VIBRATE','android.permission.WAKE_LOCK'];
for(const p of perms)if(!m.includes(`"${p}"`))m=m.replace('</manifest>',`    <uses-permission android:name="${p}" />\n</manifest>`);
must(/<activity[\s\S]*?android:name="[^"]*MainActivity"/.test(m)||m.includes('.MainActivity'),'找不到 MainActivity');
m=m.replace(/<activity\b/,'<activity android:supportsPictureInPicture="true" android:resizeableActivity="true"');
m=m.replace(/android:configChanges="([^"]*)"/,(all,v)=>{const set=new Set(v.split('|'));for(const k of ['screenSize','smallestScreenSize','screenLayout','orientation'])set.add(k);return `android:configChanges="${[...set].join('|')}"`});
fs.writeFileSync(mf,m);
// 4. 版本、目標 SDK（34：維持與原本 App 相同的畫面範圍，不強制滿版）
const vg='android/variables.gradle';let v=fs.readFileSync(vg,'utf8');v=v.replace(/targetSdkVersion\s*=\s*\d+/,'targetSdkVersion = 34');fs.writeFileSync(vg,v);
const bg='android/app/build.gradle';let b=fs.readFileSync(bg,'utf8');
const code=Number(process.env.VERSION_CODE||1000),name=process.env.VERSION_NAME||'26.0';
b=b.replace(/versionCode\s+\d+/,`versionCode ${code}`).replace(/versionName\s+"[^"]*"/,`versionName "${name}"`);
if(process.env.TEST_BUILD==='1')b=b.replace(/defaultConfig\s*\{/,'defaultConfig {\n        applicationIdSuffix ".test"');
fs.writeFileSync(bg,b);
if(process.env.TEST_BUILD==='1'){const sf=path.join(A,'res/values/strings.xml');let s=fs.readFileSync(sf,'utf8');s=s.replace(/(<string name="app_name">)[^<]*(<\/string>)/,'$1熊熊澎湖之旅（測試）$2').replace(/(<string name="title_activity_main">)[^<]*(<\/string>)/,'$1熊熊澎湖之旅（測試）$2');fs.writeFileSync(sf,s)}
console.log('patch-android: ok',{code,name,test:process.env.TEST_BUILD==='1'});
