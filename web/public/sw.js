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

// A push from a machine (remote.md §10): shown, one per agent (the tag), and
// the badge set to how many agents need the person. Safari ignores a
// notification's data, so the agent travels in the tag.
self.addEventListener('push', (event) => {
  let p = {};
  try {
    p = event.data ? event.data.json() : {};
  } catch {
    return;
  }
  if (!p.agent) return;
  const shown = self.registration.showNotification(p.title || 'Weft', { body: p.body || 'needs your input', tag: p.agent });
  const badge = 'setAppBadge' in self.navigator ? self.navigator.setAppBadge(p.count || 0).catch(() => {}) : Promise.resolve();
  event.waitUntil(Promise.all([shown, badge]));
});

// A tap: remember which agent to open, then bring the app forward. It never
// answers anything.
self.addEventListener('notificationclick', (event) => {
  const agent = event.notification.tag;
  event.notification.close();
  event.waitUntil(
    remember(agent).then(async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) {
        open.postMessage({ type: 'open', agent });
        return open.focus();
      }
      return self.clients.openWindow('/');
    }),
  );
});

/** `{open: agent}` in IndexedDB, which the app reads and clears on start. */
function remember(agent) {
  return new Promise((done) => {
    const r = indexedDB.open('weft', 1);
    r.onupgradeneeded = () => {
      for (const name of ['devices', 'macs', 'open']) r.result.createObjectStore(name);
    };
    r.onsuccess = () => {
      const t = r.result.transaction('open', 'readwrite');
      t.objectStore('open').put(agent, 'open');
      t.oncomplete = () => done();
      t.onerror = () => done();
    };
    r.onerror = () => done();
  });
}
