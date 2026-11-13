// @ts-check
// Tests de non-régression : un test par bug corrigé (rapport de test du 11 novembre 2026).
const { test, expect } = require('@playwright/test');
const { spawn } = require('child_process');

const LS = 'vestale-studio-v1';
const backup = data => JSON.stringify({ app: 'la-vestale', version: 1, exported: '2026-11-11T08:00:00Z', data });
const seance = over => ({ id: 's1', ts: Date.parse('2026-11-10T18:00:00'), date: '2026-11-10', piece: 'hymne', min: 20, pass: '', bpm: null, feel: 3, note: '', ...over });

/** Enregistre les messages (toasts) affichés par l'app. */
async function trackToasts(page) {
  await page.addInitScript(() => {
    // @ts-ignore
    window.__toasts = [];
    document.addEventListener('DOMContentLoaded', () => new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => {
      // @ts-ignore
      if (n instanceof HTMLElement && n.className === 'toast') window.__toasts.push(n.textContent);
    }))).observe(document.body, { childList: true }));
  });
}
// @ts-ignore
const toasts = page => page.evaluate(() => window.__toasts);

async function importBody(page, body, confirm = true) {
  await page.goto('./#journal');
  await page.locator('#bk-file').setInputFiles({ name: 'sauvegarde.json', mimeType: 'application/json', buffer: Buffer.from(body) });
  if (confirm) { await expect(page.locator('#dlg')).toBeVisible(); await page.locator('#dlg-ok').click(); }
}

test('R1. service worker : une page d’erreur ou un autre fichier ne remplace jamais l’app en cache', async ({ page }, testInfo) => {
  const port = testInfo.project.name === 'webkit' ? 4177 : 4176;
  const base = `http://localhost:${port}/`;
  const srv = spawn(process.execPath, ['tests/serve.js'], { env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'inherit'] });
  try {
    await new Promise((ok, ko) => { srv.stdout.once('data', ok); srv.once('error', ko); });
    await page.goto(base);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    const r404 = await page.goto(base + 'lien-mal-tape');                // erreur 404 dans le périmètre de l'app
    expect(r404 && r404.status()).toBe(404);
    await page.goto(base + 'fonts/OFL-noto-music.txt');                  // autre fichier, réponse 200
    await page.goto(base + '#seance');
    const state = await page.evaluate(async () => {
      await fetch('./absent.png').catch(() => {});                       // ressource manquante : ne doit pas être mise en cache
      await new Promise(r => setTimeout(r, 300));
      const hit = await caches.match('./index.html');
      return { app: !!hit && (await hit.text()).includes('<title>Studio La Vestale</title>'), absent: !!(await caches.match('./absent.png')) };
    });
    expect(state).toEqual({ app: true, absent: false });
  } finally {
    srv.kill();
  }
  await new Promise(r => (srv.exitCode !== null || srv.signalCode !== null) ? r(null) : srv.once('exit', r));
  await page.goto(base + '#journal');
  await expect(page).toHaveTitle('Studio La Vestale');
  await expect(page.locator('#v-journal')).toBeVisible();
  await page.goto(base + 'lien-mal-tape').catch(() => {});               // hors ligne, un lien mal tapé ouvre l'app
  await expect(page).toHaveTitle('Studio La Vestale');
});

test('R2. import : un fichier abîmé ne bloque plus l’app, les séances lisibles sont gardées', async ({ page }) => {
  await trackToasts(page);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await importBody(page, backup({
    seances: [seance({ id: 'a', feel: 7, min: 9999 }), seance({ id: 'b', date: 'hier' }), 'n’importe quoi', seance({ id: 'c', feel: -2, bpm: 999 })],
    rep: { hymne: { stage: 42, bpm: -3 }, inconnu: { stage: 1 } },
    stats: { lecture: { 'sol:30': { ok: 'x', ko: 2 }, 'bidon': { ok: 1, ko: 1 } }, oreille: { tension: { ok: 3, ko: -1 } } },
    questions: { done: { pedales: 1, inconnue: true }, items: [{ id: 'u1', t: 'Ma question', done: 0 }, { t: 'sans id' }] },
  }), false);
  await expect(page.locator('#dlg-t')).toContainText('Importer 2 séances');
  await expect(page.locator('#dlg-t')).toContainText('2 séance(s) illisible(s) seront ignorées');
  await page.locator('#dlg-ok').click();
  await expect(page.locator('#entries .entry')).toHaveCount(2);
  const saved = await page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), LS);
  expect(saved.seances.map(s => [s.id, s.feel, s.min, s.bpm])).toEqual([['a', 5, 240, null], ['c', 1, 20, null]]);
  expect(saved.rep).toEqual({ hymne: { stage: 0 } });            // étape hors limites : ramenée au début
  expect(saved.stats).toEqual({ lecture: { 'sol:30': { ok: 0, ko: 2 } }, oreille: { tension: { ok: 3, ko: 0 } } });
  expect(saved.questions).toEqual({ done: { pedales: true }, items: [{ id: 'u1', t: 'Ma question', done: false }] });
  expect(await toasts(page)).toContain('Import réussi');
  await page.reload();
  await expect(page.locator('#v-journal')).toBeVisible();
  await page.locator('#tabs a[data-v="seance"]').click();
  await expect(page.locator('#v-seance')).toBeVisible();
  expect(errors).toEqual([]);
});

test('R2 bis. des données déjà abîmées sur l’appareil sont réparées au lancement', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(k => localStorage.setItem(k, JSON.stringify({ seances: [{ id: 'z', ts: 1, date: '2026-11-10', piece: 'hymne', min: 5, feel: 7 }], meta: { lastBackup: 'x' } })), LS);
  await page.reload();
  await expect(page.locator('#v-seance')).toBeVisible();
  await page.locator('#tabs a[data-v="journal"]').click();
  await expect(page.locator('#entries .entry')).toHaveCount(1);
  await expect(page.locator('#sync')).toHaveText('à sauvegarder');
});

test('R2 ter. un fichier qui n’est pas une sauvegarde est refusé sans rien modifier', async ({ page }) => {
  await trackToasts(page);
  await importBody(page, JSON.stringify({ app: 'autre', data: { seances: [] } }), false);
  await page.waitForTimeout(300);
  await expect(page.locator('#dlg')).toBeHidden();
  expect(await toasts(page)).toEqual(['Fichier non reconnu']);
  expect(await page.evaluate(k => localStorage.getItem(k), LS)).toBeNull();
});

test('R3. import : aucun champ piégé n’exécute de code', async ({ page }) => {
  const trap = '<img src=x onerror="window.__pwned=1">';
  await importBody(page, backup({
    seances: [seance({ id: trap, min: trap, bpm: trap, feel: trap, pass: trap, note: trap, piece: trap })],
    stats: { lecture: { [`${trap}:30`]: { ok: 0, ko: 1 } }, oreille: {} },
    questions: { done: {}, items: [{ id: trap, t: trap }] },
  }));
  await page.locator('#tabs a[data-v="lecture"]').click();
  await page.locator('#tabs a[data-v="journal"]').click();
  await page.waitForTimeout(500);
  // @ts-ignore
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  await expect(page.locator('#entries img')).toHaveCount(0);
  await expect(page.locator('#entries')).toContainText('<img src=x');      // affiché comme du texte
});

test('R4. clé de fa : les deux points encadrent la 4e ligne', async ({ page }) => {
  await page.goto('./#lecture');
  await page.locator('#lec-clef button[data-c="fa"]').click();
  const dots = await page.evaluate(async () => {
    const el = [...document.querySelectorAll('#staff text')].find(e => e.textContent === '\u{1D122}');
    if (!el) return null;
    const x = +(el.getAttribute('x') || 0), y = +(el.getAttribute('y') || 0), fs = +(el.getAttribute('font-size') || 0);
    await document.fonts.load(`${fs}px "Noto Music"`, '\u{1D122}');
    // Rendu du même glyphe aux mêmes coordonnées, agrandi 4 fois, puis repérage des deux points (partie la plus à droite).
    const K = 4, c = document.createElement('canvas'); c.width = 320 * K; c.height = 170 * K;
    const g = c.getContext('2d'); if (!g) return null;
    g.scale(K, K); g.font = `${fs}px "Noto Music"`; g.fillStyle = '#000'; g.fillText('\u{1D122}', x, y);
    const px = g.getImageData(0, 0, c.width, c.height).data, ink = (i, j) => px[(j * c.width + i) * 4 + 3] > 128;
    let right = 0;
    for (let j = 0; j < c.height; j++) for (let i = 0; i < c.width; i++) if (ink(i, j) && i > right) right = i;
    const rows = [];
    for (let j = 0; j < c.height; j++) { let on = false; for (let i = right - 2 * K; i <= right; i++) if (ink(i, j)) on = true; rows.push(on); }
    const centers = []; let start = -1;
    rows.forEach((on, j) => { if (on && start < 0) start = j; if (!on && start >= 0) { centers.push((start + j - 1) / 2 / K); start = -1; } });
    return centers;
  });
  expect(dots).not.toBeNull();
  // Lignes de la portée : y = 130, 114, 98, 82 (4e ligne, fa3), 66. Points attendus dans les interlignes autour de 82.
  expect(dots).toHaveLength(2);
  const [a, b] = /** @type {number[]} */ (dots);
  expect(a).toBeGreaterThan(70); expect(a).toBeLessThan(78);
  expect(b).toBeGreaterThan(86); expect(b).toBeLessThan(94);
});

test('R5. Orientale : le métronome prend son préréglage et garde le tempo', async ({ page }) => {
  await trackToasts(page);
  await page.goto('./#morceaux');
  await page.locator('button[data-act="metro"][data-id="orientale"]').click();
  await expect(page.locator('#v-tempo')).toBeVisible();
  await expect(page.locator('#mt-preset')).toHaveValue('orientale');
  await page.locator('#mt-plus').click();
  await page.locator('#ld-save').click();
  await expect.poll(() => toasts(page)).toContain('Tempo 62 gardé pour Orientale');
  expect(await page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null').rep.orientale.bpm, LS)).toBe(62);
});

test('R6. « Copier pour Claude » : un seul message, jamais « Copié » après un refus', async ({ page }) => {
  await trackToasts(page);
  await page.goto('./#journal');
  await page.locator('#coach-go').click();
  await expect.poll(async () => (await toasts(page)).length).toBe(1);
  await page.waitForTimeout(300);
  const t = await toasts(page);
  expect(t).toHaveLength(1);
  expect(['Copié : colle-le dans Claude', 'Copie refusée par le navigateur']).toContain(t[0]);
});

test('R7. formulaire : un tempo hors de 20 à 240 n’est pas enregistré', async ({ page }) => {
  await page.goto('./#seance');
  for (const [typed, expected] of [['-5', null], ['999', null], ['72', 72]]) {
    await page.locator('#quicklog').click();
    await page.locator('#f-piece').selectOption('cancan');
    await page.locator('#f-bpm').fill(String(typed));
    await page.locator('#f-save').click();
    const s = await page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), LS);
    expect(s.seances[0].bpm, `tempo saisi ${typed}`).toBe(expected);
  }
  const rep = await page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null').rep, LS);
  expect(rep.cancan.bpm).toBe(72);
});

test('R8. Morceaux → Mélodie : la carte Mélodies est à l’écran avec la bonne mélodie', async ({ page }) => {
  await page.goto('./#morceaux');
  await page.locator('button[data-act="mel"][data-id="hymne"]').click();
  await expect(page.locator('#v-clavier')).toBeVisible();
  await expect(page.locator('#mel-sel button.on')).toHaveText('Hymne à la joie');
  await expect.poll(async () => { const b = await page.locator('#mel-sel').boundingBox(); return b && b.y > 0 && b.y + b.height < 844; }).toBe(true);
});

test('R8 bis. plan du lundi « Mélodie pas à pas » lance le pas à pas', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-09T10:00:00') }); // un lundi
  await page.goto('./#seance');
  await page.locator('#today-actions a', { hasText: 'Mélodie pas à pas' }).click();
  await page.clock.runFor(1000);
  await expect(page.locator('#v-clavier')).toBeVisible();
  await expect(page.locator('#mel-sel button.on')).toHaveText('À la claire fontaine');
  await expect(page.locator('#kb-main .key.next')).toHaveCount(1);
  await expect(page.locator('#mel-next')).toHaveText(/^Joue : Sol4/);
});

test('R9. lecture : passer en noms anglais garde la question déjà répondue verrouillée', async ({ page }) => {
  await page.goto('./#lecture');
  // Mauvaise réponse volontaire : une bonne réponse passe seule à la note suivante.
  // @ts-ignore
  const wrong = await page.evaluate(() => (((lecCur.d % 7) + 7) % 7 + 1) % 7);
  await page.locator(`#lec-ans button[data-l="${wrong}"]`).click();
  await expect(page.locator('#lec-ans button:disabled')).toHaveCount(7);
  const marks = await page.locator('#lec-ans button.ok, #lec-ans button.ko').count();
  await page.locator('#tabs a[data-v="clavier"]').click();
  await page.locator('#noms button[data-n="en"]').click();
  await page.locator('#tabs a[data-v="lecture"]').click();
  await expect(page.locator('#lec-ans button').first()).toHaveText('C');
  await expect(page.locator('#lec-ans button:disabled')).toHaveCount(7);
  expect(await page.locator('#lec-ans button.ok, #lec-ans button.ko').count()).toBe(marks);
  await page.locator('#lec-next').click();
  await expect(page.locator('#lec-ans button:disabled')).toHaveCount(0);
});
