// Service worker : met l'app en cache pour qu'elle s'ouvre sans réseau.
// À CHAQUE MODIFICATION DES FICHIERS, augmente ce numéro de version
// pour que les appareils récupèrent la nouvelle version.
const VERSION = 'fonte-v1.5.0';

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './fonts/archivo.woff2',
  './vendor/supabase.js',
  './js/app.js',
  './js/store.js',
  './js/sync.js',
  './js/calc.js',
  './js/ui.js',
  './js/charts.js',
  './js/timer.js',
  './js/presets.js',
  './js/views/common.js',
  './js/views/workout.js',
  './js/views/history.js',
  './js/views/progress.js',
  './js/views/body.js',
  './js/views/more.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/apple-touch-icon.png',
];

// cache: 'reload' : on télécharge toujours les fichiers frais, jamais une copie
// gardée par le navigateur (GitHub Pages autorise 10 minutes de cache).
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase et autres : réseau direct
  if (url.pathname.endsWith('/sw.js')) return; // vérification de version : toujours le réseau
  if (url.pathname.includes('/docs/')) return; // tutoriels vidéo : lecture directe (Safari lit les vidéos par morceaux)

  // config.js : réseau d'abord, en contournant le cache HTTP du navigateur,
  // pour prendre en compte une modification tout de suite
  if (url.pathname.endsWith('/config.js')) {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req)),
    );
    return;
  }

  // Navigation : la page de l'app depuis le cache
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then((hit) => hit || fetch(req)),
    );
    return;
  }

  // Fichiers de l'app : cache d'abord, réseau sinon
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
      }
      return res;
    })),
  );
});
