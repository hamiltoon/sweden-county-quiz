import { defineConfig, type Plugin } from 'vite';

/**
 * Genererar en enkel service worker som precachar appens filer (HTML, JS, CSS, kartdata, manifest, ikoner).
 * Cache-namnet innehåller en byggtidsstämpel så att en ny deploy invaliderar den gamla cachen.
 */
function serviceWorkerPlugin(): Plugin {
  const staticAssets = [
    '/',
    '/index.html',
    '/manifest.webmanifest',
    '/data/lan.topo.json',
    '/data/sjoar.topo.json',
    '/data/grannar.topo.json',
    '/icons/icon.svg',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/icon-512-maskable.png',
  ];
  return {
    name: 'simple-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const built = Object.keys(bundle)
        .filter((f) => /\.(js|css)$/.test(f))
        .map((f) => `/${f}`);
      const precache = [...staticAssets, ...built];
      const version = Date.now().toString(36);
      const sw = `/* Genererad av vite.config.ts – Sverigespelet service worker */
const CACHE = 'sverigespelet-${version}';
const PRECACHE = ${JSON.stringify(precache)};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // API:t (topplistan) ska alltid gå till nätet och aldrig cachas.
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // Navigeringar: nätet först (så nya versioner plockas upp), annars cachad index.html.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Övrigt (hashade assets, kartdata): cache först, annars nätet och spara i cachen.
  event.respondWith(
    caches.match(req).then((cached) =>
      cached ||
      fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
    )
  );
});
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: sw });
    },
  };
}

export default defineConfig({
  plugins: [serviceWorkerPlugin()],
  build: {
    target: 'es2022',
    sourcemap: false,
  },
});
