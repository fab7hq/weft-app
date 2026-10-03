// Weft's service worker, by hand (web-app.md §3): keep the shell so the app
// opens with no network, and show pushes (§8). It never caches the account
// service's answers, and nothing from a machine passes through here.
const SHELL = 'weft-shell-v1';
const PRECACHE = ['/', '/manifest.webmanifest', '/fonts/sora-variable.woff2', '/icons/icon-192.png', '/icons/apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return;
  // A page: the network first, the kept shell when there is none.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((r) => {
          const copy = r.clone();
          caches.open(SHELL).then((c) => c.put('/', copy));
          return r;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }
  // The shell's files: kept as they are fetched, served from the cache when the network fails.
  event.respondWith(
    fetch(event.request)
      .then((r) => {
        if (r.ok) {
          const copy = r.clone();
          caches.open(SHELL).then((c) => c.put(event.request, copy));
        }
        return r;
      })
      .catch(() => caches.match(event.request)),
  );
});
