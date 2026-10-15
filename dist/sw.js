/* =====================================================================
   熊熊澎湖之旅 App - service worker（比照熊熊綜合系統 App 的做法）
   ・畫面與程式（html／js／css／json）：先連網取最新版，沒網路才用上次的版本
     → GitHub 更新後，App 下次開啟就是新版，不必重新安裝 APK
   ・相片、圖示、熊寶圖：存一份在手機（檔名固定、內容不變），加快開啟
   ・地圖圖磚（其他網站）：照常連網，不離線打包
   只有更換圖示或 manifest.json 時，才需要把下面的 VERSION 改一個新名稱
   ===================================================================== */
const VERSION = 'penghu-bear-2026-10-16-v1';
const SHELL_CACHE = `shell-${VERSION}`;
const MEDIA_CACHE = 'media';
const SHELL = ['./', './index.html', './manifest.json', './style.css', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './assets/bearbao.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('shell-') && k !== SHELL_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request, key, fresh) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = fresh ? await fetch(request.url, { cache: 'no-store', credentials: 'same-origin' }) : await fetch(request);
    if (response && response.ok) cache.put(key || request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(key || request);
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(MEDIA_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; /* 圖磚等外部資源照常連網 */
  if (request.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html')) {
    event.respondWith(networkFirst(request, './index.html', true));
  } else if (/\/(assets|icons)\//.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(networkFirst(request));
  }
});
