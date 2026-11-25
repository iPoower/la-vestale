// La Vestale : fonctionne hors ligne. Changer VERSION à chaque mise à jour.
const VERSION = 'la-vestale-v64';
const NAV_WAIT_MS = 3000;   // au-delà, la page s'ouvre depuis le cache (le réseau finit en arrière-plan)
const FONTS = ['atkinson-hyperlegible-latin-400', 'atkinson-hyperlegible-latin-700', 'cormorant-garamond-latin-500', 'cormorant-garamond-latin-600',
  'cormorant-garamond-latin-700', 'noto-music-latin-400', 'noto-music-clefs-400'].map(f => './fonts/' + f + '.woff2');
// Sons de piano (Steinway & Sons modèle B, University of Iowa Electronic Music Studios) : une note sur trois, Do1 à Do8.
const SAMPLES = Array.from({ length: 29 }, (_, i) => './samples/p' + (24 + 3 * i) + '.mp3');
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/apple-touch-icon.png', ...FONTS, ...SAMPLES];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  // Uniquement nos anciens caches : l'adresse ipoower.github.io est partagée avec d'autres apps (Race Control…), dont les caches ne doivent jamais être touchés.
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('la-vestale-') && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
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
    const net = fetch(req).then(r => {
      if (r.ok && isApp && !r.redirected) { const copy = r.clone(); return caches.open(VERSION).then(c => c.put('./index.html', copy)).catch(() => {}).then(() => r); }
      if (r.ok || !isApp) return r;
      return caches.match('./index.html').then(hit => hit || r);
    });
    const safe = net.catch(() => caches.match('./index.html'));
    if (!isApp) { e.respondWith(safe); return; }
    // Réseau lent (wifi faible au piano) : au-delà de NAV_WAIT_MS, la copie en cache s'ouvre tout de suite ;
    // la réponse du réseau, si elle arrive, met quand même le cache à jour pour la prochaine ouverture.
    e.waitUntil(net.catch(() => {}));
    e.respondWith(caches.match('./index.html').then(hit => {
      if (!hit) return safe;
      return Promise.race([safe, new Promise(res => setTimeout(() => res(hit), NAV_WAIT_MS))]).then(r => r || hit);
    }));
    return;
  }
  if (url.origin === location.origin) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return r; })));
  }
});
