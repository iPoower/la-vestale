// @ts-check
// Corrections issues d'un audit du Coach et du service worker : un test par constat.
const { test, expect } = require('@playwright/test');
const { aller } = require('./aller');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Micro simulé (compatible Chromium et WebKit : posé sur le prototype de MediaDevices).
const FAKE_MIC = () => {
  // @ts-ignore
  window.__fakeMic = () => {
    const fn = async () => { const d = ac().createMediaStreamDestination(); window.__dest = d; return d.stream; };
    if (window.MediaDevices && navigator.mediaDevices) MediaDevices.prototype.getUserMedia = fn;
    else Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: fn }, configurable: true });
  };
};

test('CA1. écoute deux mains : la main gauche n’efface pas l’allumage simultané de la main droite', async ({ page }) => {
  await page.goto('./#coach');
  await page.locator('#dc-piece').selectOption('hymne');
  await page.locator('#dc-hands button[data-h="both"]').click();
  await page.locator('#wk-bpm').fill('60');
  await page.locator('#wk-play').click();
  // Mesure 1, temps 1 de l'Hymne : Mi5 (main droite) + accord de Do Do3–Mi3–Sol3 (main gauche) attaqués ensemble.
  await expect.poll(async () => page.$$eval('#kb-wk .key.next', ks => ks.map(k => +k.dataset.m).sort((a, b) => a - b)), { timeout: 3000 })
    .toEqual([48, 52, 55, 76]);
  await page.locator('#wk-stop').click();
});

test('CA2. bouton Stop synchronisé entre « Mon morceau, de A à Z », « 2. Jouer » et la fin naturelle', async ({ page }) => {
  await page.goto('./#coach');
  await page.locator('#dc-piece').selectOption('hymne');

  // 1) Stop depuis le parcours : remet aussi 2. Jouer au repos (WK.playing, ◀ ▶, clavier).
  await page.locator('#pz-act button[data-pa="model"]').click();
  await expect(page.locator('#pz-act button[data-pa="stop"]')).toBeVisible();
  await expect(page.locator('#wk-step-next')).toBeDisabled();
  await page.locator('#pz-act button[data-pa="stop"]').click();
  await expect(page.locator('#pz-act button[data-pa="model"]')).toBeVisible();
  // @ts-ignore
  expect(await page.evaluate(() => ({ playing: WK.playing, bus: !!BUS, range: WK.range }))).toEqual({ playing: false, bus: false, range: null });
  await expect(page.locator('#wk-step-next')).toBeEnabled();
  await expect(page.locator('#kb-wk .key.hl')).toHaveCount(1);
  await expect(page.locator('#kb-wk .key.hl2')).toHaveCount(3);

  // 2) Stop depuis 2. Jouer : remet aussi le bouton du parcours sur « ▶ Écouter ».
  await page.locator('#pz-act button[data-pa="model"]').click();
  await expect(page.locator('#pz-act button[data-pa="stop"]')).toBeVisible();
  await page.locator('#wk-stop').click();
  await expect(page.locator('#pz-act button[data-pa="model"]')).toBeVisible();

  // 3) Fin naturelle de la lecture (sans boucle) : BUS vidé, bouton du parcours revenu sur « ▶ Écouter ».
  await page.locator('#wk-bpm').fill('100');
  await page.locator('#wk-play').click();
  // @ts-ignore
  await page.evaluate(() => renderPz());
  await expect(page.locator('#pz-act button[data-pa="stop"]')).toBeVisible();
  // @ts-ignore
  await expect.poll(() => page.evaluate(() => ({ playing: WK.playing, bus: !!BUS })), { timeout: 6000 }).toEqual({ playing: false, bus: false });
  await expect(page.locator('#pz-act button[data-pa="model"]')).toBeVisible();
  await expect(page.locator('#wk-step-next')).toBeEnabled();
});

test('CA3. micro en mode « Deux mains » sur un morceau main gauche seule : bascule sur la main gauche', async ({ page }) => {
  await page.addInitScript(FAKE_MIC);
  await page.goto('./#coach');
  await page.evaluate(() => { /* @ts-ignore */ window.__fakeMic(); });
  await page.locator('#dc-piece').selectOption('alkan311g');
  await page.locator('#dc-hands button[data-h="both"]').click();
  await page.locator('#ec-go').click();
  await expect(page.locator('#ec-go')).toHaveText('Arrêter l’écoute');
  // @ts-ignore
  const st = await page.evaluate(() => ({ on: EC.on, hands: WK.hands, bar: WK.bar }));
  expect(st).toEqual({ on: true, hands: 'lh', bar: 0 });
  await expect(page.locator('#ec-fb')).toContainText('main gauche seule');
  await expect(page.locator('#ec-msg')).toContainText('Joue l’accord : Sol3 + Do4 + Mi4');
  await page.locator('#ec-go').click();
});

test('CA4. changer de morceau ajuste la main si la main choisie n’y joue aucune note', async ({ page }) => {
  await page.goto('./#coach');
  await page.locator('#dc-piece').selectOption('alkan311g');
  await page.locator('#dc-hands button[data-h="lh"]').click();
  await expect(page.locator('#dc-hands button.on')).toHaveText('Main gauche');

  // Vers un morceau main droite seule : bascule sur la main droite (pas de « Silence »).
  await page.locator('#dc-piece').selectOption('twinkle');
  await expect(page.locator('#dc-hands button.on')).toHaveText('Main droite');
  await expect(page.locator('#wk-step-lbl')).not.toHaveText('Silence');

  // Retour vers un morceau main gauche seule : bascule sur la main gauche.
  await page.locator('#dc-piece').selectOption('alkan311g');
  await expect(page.locator('#dc-hands button.on')).toHaveText('Main gauche');
  await expect(page.locator('#wk-step-lbl')).not.toHaveText('Silence');

  // Vers un morceau deux mains : la main choisie reste conservée.
  await page.locator('#dc-piece').selectOption('hymne');
  await expect(page.locator('#dc-hands button.on')).toHaveText('Main gauche');
});

test('CA5. carte d’identité d’un morceau sans armure (nosig) : indique l’altération écrite devant la note', async ({ page }) => {
  await page.goto('./#coach');
  await page.locator('#dc-piece').selectOption('sourire');
  await expect(page.locator('#dc-id')).toContainText('Mi mineur · pas d’armure sur ta feuille : Fa♯ écrit devant la note');
  await expect(page.locator('#dc-id')).not.toContainText('aucune altération à la clé');

  await page.locator('#dc-piece').selectOption('sourireFa');
  await expect(page.locator('#dc-id')).toContainText('pas d’armure sur ta feuille : Fa♯ écrit devant la note');

  await page.locator('#dc-piece').selectOption('hymne');
  await expect(page.locator('#dc-id')).toContainText('Do majeur · aucune altération à la clé');
});

test('CA6. fin de déchiffrage : toucher le clavier n’efface pas le message de réussite', async ({ page }) => {
  await page.goto('./#coach');
  await page.locator('#dc-piece').selectOption('hymne');
  await page.locator('#dc-hands button[data-h="rh"]').click();
  await page.locator('#dc-go').click();

  // Déchiffre toute la mesure 1 (main droite : Mi5, Fa5, Sol5 ; la répétition de Mi5 est regroupée).
  for (;;) {
    // @ts-ignore
    const cur = await page.evaluate(() => DC.k < DC.items.length ? { l: spell(DC.items[DC.k].m).l, m: DC.items[DC.k].m } : null);
    if (!cur) break;
    await page.locator(`#dc-names button[data-l="${cur.l}"]`).click();
    await page.locator(`#kb-dc .key[data-m="${cur.m}"]`).click();
  }
  await expect(page.locator('#dc-after')).toBeVisible();
  await expect(page.locator('#dc-fb')).toContainText('déchiffrée sans erreur');

  // Toucher des touches après coup ne doit rien écraser.
  await page.locator('#kb-dc .key[data-m="72"]').click();
  await page.locator('#kb-dc .key[data-m="76"]').click();
  await expect(page.locator('#dc-fb')).toContainText('déchiffrée sans erreur');
  await expect(page.locator('#dc-fb')).not.toContainText('D’abord, nomme la note');
});

test('CA7. pendant le déchiffrage, « 2. Jouer » masque la réponse puis la rétablit à la fin', async ({ page }) => {
  await page.goto('./#coach');
  await page.locator('#dc-piece').selectOption('hymne');
  await page.locator('#dc-hands button[data-h="rh"]').click();

  await expect(page.locator('#co-slot')).not.toHaveClass(/dc-mask/);
  await expect(page.locator('#wk-mask')).toBeHidden();

  await page.locator('#dc-go').click();
  await expect(page.locator('#co-slot')).toHaveClass(/dc-mask/);
  await expect(page.locator('#wk-mask')).toBeVisible();
  const masked = await page.evaluate(() => {
    const s = getComputedStyle(document.querySelector('#kb-wk'));
    return { filter: s.filter, pe: s.pointerEvents };
  });
  expect(masked.filter).toContain('blur(');
  expect(masked.pe).toBe('none');

  // Fin de mesure : la réponse redevient visible.
  for (;;) {
    // @ts-ignore
    const cur = await page.evaluate(() => DC.k < DC.items.length ? { l: spell(DC.items[DC.k].m).l, m: DC.items[DC.k].m } : null);
    if (!cur) break;
    await page.locator(`#dc-names button[data-l="${cur.l}"]`).click();
    await page.locator(`#kb-dc .key[data-m="${cur.m}"]`).click();
  }
  await expect(page.locator('#co-slot')).not.toHaveClass(/dc-mask/);
  await expect(page.locator('#wk-mask')).toBeHidden();

  // Quitter le Coach en plein déchiffrage retire aussi le masque.
  await page.locator('#dc-next').click();
  await expect(page.locator('#co-slot')).toHaveClass(/dc-mask/);
  await aller(page, 'seance');
  await expect(page.locator('#co-slot')).not.toHaveClass(/dc-mask/);
});

test('CA8. service worker : réseau lent à l’ouverture → la copie en cache répond au bout de 3 s', async ({ page }) => {
  const ROOT = path.resolve(__dirname, '..');
  const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
    '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
  let slow = false;
  const timers = [];
  const srv = http.createServer((req, res) => {
    let rel = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.resolve(ROOT, '.' + rel);
    const send = () => fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(buf);
    });
    if (slow && rel === '/index.html') { timers.push(setTimeout(send, 10000)); return; }
    send();
  });
  await new Promise(ok => srv.listen(0, 'localhost', ok));
  const addr = srv.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  const base = `http://localhost:${port}/`;
  try {
    await page.goto(base);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);

    await page.goto('about:blank');
    slow = true;
    const t0 = Date.now();
    await page.goto(base + '#coach', { waitUntil: 'domcontentloaded' });
    const dt = Date.now() - t0;
    await expect(page.locator('#v-coach')).toBeVisible();
    expect(dt).toBeLessThan(7000);                                         // servi depuis le cache (~3 s), sans attendre les 10 s réseau
  } finally {
    timers.forEach(clearTimeout);
    srv.closeAllConnections?.();
    await new Promise(ok => srv.close(() => ok(null)));
  }
});
