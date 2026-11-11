// @ts-check
// Tests de La Vestale : chargement, PWA (manifeste, service worker, hors ligne), polices locales,
// sauvegarde Export/Import et navigation. Lancement : npm test (voir README).
const { test, expect } = require('@playwright/test');
const { spawn } = require('child_process');
const fs = require('fs');

const TABS = ['seance', 'clavier', 'oreille', 'lecture', 'tempo', 'morceaux', 'journal'];
const FONT_FILES = ['atkinson-hyperlegible-latin-400', 'atkinson-hyperlegible-latin-700', 'cormorant-garamond-latin-500',
  'cormorant-garamond-latin-600', 'cormorant-garamond-latin-700', 'noto-music-latin-400', 'noto-music-clefs-400'];

/** Ouvre l'app et attend que le service worker contrôle la page (avec un rechargement si besoin). */
async function openControlled(page, url = './#seance') {
  await page.goto(url);
  await page.evaluate(() => navigator.serviceWorker.ready);
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) {
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  }
}

/** Largeur et hauteur d'un PNG, lues dans l'en-tête IHDR. */
function pngSize(buf) {
  expect(buf.subarray(1, 4).toString('latin1')).toBe('PNG');
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

test('1. chargement sans erreur console ni requête vers un tiers', async ({ page }) => {
  const errors = [];
  const foreign = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('request', r => { const u = new URL(r.url()); if (!['localhost', '127.0.0.1'].includes(u.hostname) && u.protocol.startsWith('http')) foreign.push(r.url()); });
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto('./');
  await expect(page.locator('#v-seance')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => navigator.serviceWorker.ready);
  expect(errors).toEqual([]);
  expect(foreign).toEqual([]);
});

test('2. manifeste valide, chemins relatifs', async ({ page, request }) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBe('manifest.webmanifest');
  const res = await request.get('manifest.webmanifest');
  expect(res.ok()).toBe(true);
  expect(res.headers()['content-type']).toContain('application/manifest+json');
  const m = await res.json();
  expect(m.name).toBe('La Vestale');
  expect(m.short_name).toBeTruthy();
  expect(m.start_url).toBe('./#seance');
  expect(m.scope).toBe('./');
  expect(m.display).toBe('standalone');
  expect(m.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
  for (const i of m.icons) expect(i.src.startsWith('/') || /^https?:/.test(i.src)).toBe(false);
  expect(m.icons.map(i => `${i.sizes}${i.purpose ? ' ' + i.purpose : ''}`)).toEqual(['192x192', '512x512', '512x512 maskable']);
});

test('3. icônes 180, 192, 512 et 512 maskable aux bonnes dimensions', async ({ page, request }) => {
  await page.goto('./');
  expect(await page.locator('link[rel="apple-touch-icon"]').getAttribute('href')).toBe('icons/apple-touch-icon.png');
  const expected = { 'icons/apple-touch-icon.png': 180, 'icons/icon-192.png': 192, 'icons/icon-512.png': 512, 'icons/icon-512-maskable.png': 512 };
  for (const [src, size] of Object.entries(expected)) {
    const r = await request.get(src);
    expect(r.ok(), src).toBe(true);
    expect(r.headers()['content-type']).toBe('image/png');
    expect(pngSize(await r.body()), src).toEqual({ w: size, h: size });
  }
});

test('4. service worker enregistré, contrôle la page, cache la-vestale-v2 complet', async ({ page }) => {
  await openControlled(page);
  const info = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const keys = await caches.keys();
    const cache = await caches.open('la-vestale-v2');
    const urls = (await cache.keys()).map(r => new URL(r.url).pathname);
    return { scope: reg && reg.scope, script: reg && reg.active && reg.active.scriptURL, keys, urls };
  });
  expect(info.scope).toBe(new URL('./', page.url()).href);
  expect(info.script).toMatch(/\/sw\.js$/);
  expect(info.keys).toEqual(['la-vestale-v2']);
  for (const p of ['/', '/index.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/apple-touch-icon.png', ...FONT_FILES.map(f => `/fonts/${f}.woff2`)]) {
    expect(info.urls, p).toContain(p);
  }
});

test('5. polices locales chargées, clés de sol et de fa comprises', async ({ page }) => {
  const fontUrls = [];
  page.on('request', r => { if (r.resourceType() === 'font') fontUrls.push(new URL(r.url())); });
  await page.goto('./#lecture');
  const loaded = await page.evaluate(async () => {
    const out = {};
    for (const [k, spec, text] of [
      ['atkinson400', '400 16px "Atkinson Hyperlegible"', 'Séance'], ['atkinson700', '700 16px "Atkinson Hyperlegible"', 'Séance'],
      ['cormorant500', '500 16px "Cormorant Garamond"', 'Vestale'], ['cormorant600', '600 16px "Cormorant Garamond"', 'Vestale'],
      ['cormorant700', '700 16px "Cormorant Garamond"', 'Vestale'], ['clefs', '62px "Noto Music"', '\u{1D11E}\u{1D122}'],
    ]) {
      const faces = await document.fonts.load(spec, text);
      out[k] = faces.length > 0 && faces.every(f => f.status === 'loaded') && document.fonts.check(spec, text);
    }
    return out;
  });
  expect(loaded).toEqual({ atkinson400: true, atkinson700: true, cormorant500: true, cormorant600: true, cormorant700: true, clefs: true });
  expect(fontUrls.length).toBeGreaterThan(0);
  for (const u of fontUrls) { expect(u.hostname).toBe('localhost'); expect(u.pathname).toMatch(/^\/fonts\/[a-z0-9-]+\.woff2$/); }
  await expect(page.locator('#v-lecture svg text').first()).toBeAttached();
});

test('6. rechargement hors ligne fonctionnel (serveur réellement arrêté)', async ({ page }, testInfo) => {
  // Serveur dédié, puis arrêté : la page ne peut plus venir que du service worker (comme en mode avion).
  // context.setOffline() n'est pas utilisé : sous WebKit, Playwright échoue sur un rechargement servi par un service worker.
  const port = testInfo.project.name === 'webkit' ? 4175 : 4174;
  const base = `http://localhost:${port}/`;
  const srv = spawn(process.execPath, ['tests/serve.js'], { env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'inherit'] });
  try {
    await new Promise((ok, ko) => { srv.stdout.once('data', ok); srv.once('error', ko); });
    await openControlled(page, base + '#seance');
  } finally {
    srv.kill();
  }
  await new Promise(r => (srv.exitCode !== null || srv.signalCode !== null) ? r() : srv.once('exit', r));
  expect((await page.request.get(base).catch(e => e)) instanceof Error).toBe(true); // le serveur ne répond plus

  await page.reload();
  await expect(page).toHaveTitle('Studio La Vestale');
  await expect(page.locator('#v-seance')).toBeVisible();
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.locator('#tabs a[data-v="journal"]').click();
  await expect(page.locator('#v-journal')).toBeVisible();
  const fontsOk = await page.evaluate(async () => {
    await document.fonts.load('600 16px "Cormorant Garamond"', 'V');
    await document.fonts.load('62px "Noto Music"', '\u{1D11E}');
    return document.fonts.check('600 16px "Cormorant Garamond"', 'V') && document.fonts.check('62px "Noto Music"', '\u{1D11E}');
  });
  expect(fontsOk).toBe(true);
  // Un accès direct à un autre onglet fonctionne aussi hors ligne.
  await page.goto(base + '#tempo');
  await expect(page.locator('#v-tempo')).toBeVisible();
});

test('7. cycle complet : noter une séance, Exporter, vider, Importer, séance revenue', async ({ page }, testInfo) => {
  const NOTE = 'Essai automatisé : mesures 1 à 4 au calme';
  await page.goto('./#seance');
  await page.locator('#quicklog').click();
  await expect(page.locator('#logform')).toBeVisible();
  await page.locator('#f-piece').selectOption('hymne');
  await page.locator('#f-min').fill('25');
  await page.locator('#f-pass').fill('mesures 1 à 4');
  await page.locator('#f-bpm').fill('72');
  await page.locator('#f-feel button[data-v="4"]').click();
  await page.locator('#f-note').fill(NOTE);
  await page.locator('#f-save').click();

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('vestale-studio-v1') || 'null'));
  expect(saved.seances).toHaveLength(1);
  const seance = saved.seances[0];
  expect(seance).toMatchObject({ piece: 'hymne', min: 25, pass: 'mesures 1 à 4', bpm: 72, feel: 4, note: NOTE });

  await page.goto('./#journal');
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#bk-export').click()]);
  expect(download.suggestedFilename()).toMatch(/^la-vestale-\d{4}-\d{2}-\d{2}\.json$/);
  const file = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(file);
  const exportedText = fs.readFileSync(file, 'utf8');
  const exported = JSON.parse(exportedText);
  expect(exported.app).toBe('la-vestale');
  expect(exported.data.seances).toEqual([seance]);

  await page.evaluate(() => localStorage.clear());
  await page.reload();
  expect(await page.evaluate(() => localStorage.getItem('vestale-studio-v1'))).toBeNull();
  await expect(page.locator('#entries')).not.toContainText(NOTE);

  // Le contenu exact du fichier exporté est réimporté. On passe son contenu plutôt que son chemin :
  // Chromium ignore un fichier dont le chemin contient un accent (le dossier de test dérive du titre « séance »).
  await page.locator('#bk-file').setInputFiles({ name: download.suggestedFilename(), mimeType: 'application/json', buffer: Buffer.from(exportedText) });
  await expect(page.locator('#dlg')).toBeVisible();
  await expect(page.locator('#dlg-t')).toContainText('Importer 1 séances');
  await page.locator('#dlg-ok').click();
  await expect(page.locator('.toast').filter({ hasText: 'Import réussi' })).toBeVisible();
  await expect(page.locator('#entries')).toContainText(NOTE);
  await expect(page.locator('#entries')).toContainText('Hymne à la joie');
  const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('vestale-studio-v1') || 'null'));
  expect(restored.seances).toEqual([seance]);
  // La séance survit aussi à un rechargement.
  await page.reload();
  await expect(page.locator('#entries')).toContainText(NOTE);
});

test('8. navigation par clic dans les 7 onglets', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('./');
  for (const v of [...TABS.slice(1), TABS[0]]) {
    await page.locator(`#tabs a[data-v="${v}"]`).click();
    await expect(page).toHaveURL(new RegExp(`#${v}$`));
    await expect(page.locator(`#v-${v}`)).toBeVisible();
    await expect(page.locator(`#tabs a[data-v="${v}"]`)).toHaveClass(/\bon\b/);
    await expect(page.locator('.view:visible')).toHaveCount(1);
  }
  expect(errors).toEqual([]);
});

test('9. accès direct par URL à chacun des 7 onglets', async ({ page }) => {
  for (const v of TABS) {
    await page.goto(`./#${v}`);
    await expect(page.locator(`#v-${v}`)).toBeVisible();
    await expect(page.locator('.view:visible')).toHaveCount(1);
  }
  await page.goto('./#inconnu');
  await expect(page.locator('#v-seance')).toBeVisible();
});

test('10. aucun défilement horizontal en 390 × 844 sur les 7 onglets', async ({ page }) => {
  await page.goto('./');
  for (const v of TABS) {
    await page.locator(`#tabs a[data-v="${v}"]`).click();
    await expect(page.locator(`#v-${v}`)).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `onglet ${v}`).toBeLessThanOrEqual(0);
  }
});
