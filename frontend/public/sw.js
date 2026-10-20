// AniTrack service worker: keeps the app shell and static files so the site opens fast and works offline.
// Live data (/api/...) is never cached here; My List keeps its own offline copy inside the app.
const VERSION = 'anitrack-v6';
const SHELL = VERSION + '-shell';
const IMAGES = VERSION + '-img';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(['./', 'icon-192.png'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

async function trim(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length > max) await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);

  if (url.pathname.includes('/api/') || url.pathname.endsWith('.mp3')) return; // always live

  // pages: network first, saved shell when offline
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(SHELL).then((c) => c.put('./', copy));
        return res;
      }).catch(() => caches.match('./'))
    );
    return;
  }

  // our own built files have hashed names: cache first
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(SHELL).then((c) => c.put(req, copy)); }
        return res;
      }))
    );
    return;
  }

  // cover art from AniList: show the saved one at once, refresh in the background
  if (/(^|\.)anilist\.co$/.test(url.hostname) && req.destination === 'image') {
    e.respondWith(
      caches.open(IMAGES).then(async (c) => {
        const hit = await c.match(req);
        const net = fetch(req).then((res) => { if (res.ok || res.type === 'opaque') { c.put(req, res.clone()); trim(IMAGES, 250); } return res; }).catch(() => hit);
        return hit || net;
      })
    );
  }
});
