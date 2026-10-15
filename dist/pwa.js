// 註冊 App 用的 service worker（只在 HTTPS 或 localhost 生效；不影響遊戲本身）
if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost')){
  addEventListener('load',()=>navigator.serviceWorker.register('sw.js',{scope:'./'}).catch(()=>{}));
}
