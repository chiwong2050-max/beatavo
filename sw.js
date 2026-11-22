/* Beatavo service worker — caches the app shell only.
   Videos live on YouTube and are never cached or intercepted. */

const VERSION = 'v2';
const SHELL_CACHE = `beatavo-shell-${VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './watch/',
  './watch/index.html',
  './privacy/',
  './privacy/index.html',
  './assets/css/styles.css',
  './assets/js/data.js',
  './assets/js/home.js',
  './assets/js/player.js',
  './manifest.json',
  './assets/icons/favicon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/images/og.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never touch cross-origin requests (YouTube, ytimg, fonts, etc).
  if (url.origin !== self.location.origin) return;

  const isNavigation =
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');
  const isData = url.pathname.endsWith('/data/videos.json');

  if (isNavigation || isData) {
    event.respondWith(networkFirst(req));
    return;
  }

  event.respondWith(cacheFirst(req));
});

async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    // Offline fallback for navigations.
    return (await cache.match('./index.html')) || Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  if (fresh && fresh.ok) cache.put(request, fresh.clone());
  return fresh;
}
