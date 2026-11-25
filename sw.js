// 請假 CP 值 service worker：離線支援（stale-while-revalidate）。VERSION 在 build 時替換。
const VERSION = '0e8364128a';
const CACHE = 'leaveplan-' + VERSION;
const CORE = ['./', './app/', './terms/', './privacy/', './style.css', './core.js', './app.js', './landing.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('leaveplan-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
function cacheKey(req) {
  const url = new URL(req.url);
  if (req.mode !== 'navigate') return req;
  let p = url.pathname.replace(/index\.html$/, '');
  if (!p.endsWith('/')) p += '/';
  return new Request(url.origin + p);
}
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  // 只處理本作品路徑，不碰同網域下其他作品。
  if (!url.pathname.startsWith(new URL('./', self.location).pathname)) return;
  const key = cacheKey(req);
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(key, { ignoreSearch: true });
      const net = fetch(req)
        .then((res) => { if (res.ok) cache.put(key, res.clone()); return res; })
        .catch(async () => hit || (req.mode === 'navigate' && (await cache.match(new URL('./app/', self.location).href))) || Response.error());
      if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
      return net;
    }),
  );
});
