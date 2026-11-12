// La Vestale : fonctionne hors ligne. Changer VERSION à chaque mise à jour.
const VERSION = 'la-vestale-v4';
const FONTS = ['atkinson-hyperlegible-latin-400', 'atkinson-hyperlegible-latin-700', 'cormorant-garamond-latin-500', 'cormorant-garamond-latin-600',
  'cormorant-garamond-latin-700', 'noto-music-latin-400', 'noto-music-clefs-400'].map(f => './fonts/' + f + '.woff2');
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/apple-touch-icon.png', ...FONTS];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate') {
    // Réseau d'abord pour recevoir les mises à jour, cache si hors ligne.
    // Seule une vraie réponse de l'app (200, adresse de l'app) remplace la copie en cache : jamais une page d'erreur ni un autre fichier.
    const scope = new URL(self.registration.scope);
    const isApp = url.pathname === scope.pathname || url.pathname === scope.pathname + 'index.html';
    e.respondWith(fetch(req).then(r => {
      if (r.ok && isApp && !r.redirected) { const copy = r.clone(); caches.open(VERSION).then(c => c.put('./index.html', copy)); return r; }
      if (r.ok || !isApp) return r;
      return caches.match('./index.html').then(hit => hit || r);
    }).catch(() => caches.match('./index.html')));
    return;
  }
  if (url.origin === location.origin) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return r; })));
  }
});
