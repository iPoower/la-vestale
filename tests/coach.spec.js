// @ts-check
// Coach : une partition jouée au micro, mesure rejouée jusqu'à être propre, conseils, suivi « Où tu bloques ».
const { test, expect } = require('@playwright/test');

// Son de piano de synthèse (côté test seulement) : partiels un peu inharmoniques, deux cordes à 3 cents, bruit de fond.
const PIANO = () => {
  // @ts-ignore
  window.__piano = (m, o = {}) => { const { sr = 48000, n = 4096, a4 = 440, cents = 0, t0 = 0.05, level = 0.2, noise = 0.004 } = o;
    const f0 = a4 * Math.pow(2, (m - 69) / 12) * Math.pow(2, cents / 1200), B = 0.0002 + Math.max(0, m - 60) * 0.00002, out = new Float32Array(n);
    let seed = m * 7919 + 13; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff - 0.5; };
    for (const det of [0, 3]) { const f = f0 * Math.pow(2, det / 1200);
      for (let k = 1; k <= 12; k++) { const fk = k * f * Math.sqrt(1 + B * k * k); if (fk > sr / 2.2) break; const amp = level / 2 * Math.pow(k, -1.1) * (m < 48 && k === 1 ? 0.25 : 1), ph = k * 1.7 + det * 0.05;
        for (let i = 0; i < n; i++) { const t = t0 + i / sr; out[i] += amp * Math.exp(-t * (1.5 + k * 0.6)) * Math.sin(2 * Math.PI * fk * t + ph); } } }
    for (let i = 0; i < n; i++) out[i] += noise * rnd() * 2; return out; };
  // Une note jouée : cinq trames de 70 ms en 70 ms, qui s'éteignent peu à peu (plusieurs notes = un accord).
  // @ts-ignore
  // (trames de 16 384 échantillons, comme le micro de l'app : la hauteur se lit sur les 4 096 dernières)
  window.__play = (ms, o = {}) => { for (const t0 of [0.02, 0.09, 0.16, 0.23, 0.30]) { const bufs = [].concat(ms).map(m => window.__piano(m, { ...o, t0, n: 16384 })); const sum = new Float32Array(16384);
    bufs.forEach(b => b.forEach((v, i) => { sum[i] += v; })); ecFeed(sum.subarray(16384 - 4096), o.sr || 48000, sum); } };
  // Micro simulé : un flux silencieux issu du contexte audio de l'app.
  // @ts-ignore
  // (posé sur le prototype : WebKit recrée l'objet navigator.mediaDevices, une propriété posée dessus se perd)
  // @ts-ignore
  window.__setMic = fn => { if (window.MediaDevices && navigator.mediaDevices) MediaDevices.prototype.getUserMedia = fn; else Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: fn }, configurable: true }); };
  // @ts-ignore
  window.__fakeMic = () => window.__setMic(async () => { const d = ac().createMediaStreamDestination(); window.__dest = d; return d.stream; });
};
test.beforeEach(async ({ page }) => { await page.addInitScript(PIANO); });

/** Coach, main droite de l'Hymne, micro simulé, écoute lancée (sans la boucle du vrai micro). */
const start = async page => {
  await page.goto('./#coach');
  await page.evaluate(() => { /* @ts-ignore */ window.__fakeMic(); });
  await page.locator('#dc-hands button[data-h="rh"]').click();
  await page.locator('#ec-go').click();
  await expect(page.locator('#ec-go')).toHaveText('Arrêter l’écoute');
  // @ts-ignore
  await page.evaluate(() => clearInterval(EC.iv));
  await expect(page.locator('#ec-msg')).toHaveText('Joue : Mi5 · doigt 3');
};
// @ts-ignore
const play = (page, m) => page.evaluate(x => window.__play(x), m);

test('C1. une seule carte de travail : elle passe dans le Coach puis revient dans Séance', async ({ page }) => {
  await page.goto('./#coach');
  await expect(page.locator('#co-slot #wk-card')).toHaveCount(1);
  await expect(page.locator('#wk-card')).toBeVisible();
  await expect(page.locator('#co-tips')).toContainText('Écoute-moi');
  await page.goto('./#seance');
  await expect(page.locator('#v-seance #wk-card')).toHaveCount(1);
  await expect(page.locator('#wk-card')).toBeVisible();
  // @ts-ignore
  expect(await page.evaluate(() => document.querySelector('#wk-home').nextElementSibling.id)).toBe('wk-card');
  await expect(page.locator('#wk-card')).toHaveCount(1);
});

test('C2. une faute : conseil immédiat, la mesure se rejoue ; propre, on passe à la suivante', async ({ page }) => {
  await start(page);
  await play(page, 76); await play(page, 76); await play(page, 77);
  await play(page, 78);                                                         // Fa♯5 au lieu de Sol5
  await expect(page.locator('#ec-fb')).toContainText('j’attends Sol5. Un demi-ton à côté');
  await play(page, 81);                                                         // La5 : deux demi-tons
  await expect(page.locator('#ec-fb')).toContainText('La note voisine');
  await play(page, 79);
  await expect(page.locator('#ec-fb')).toHaveText('Mesure 1 : 2 fautes. On la rejoue jusqu’à ce qu’elle soit propre (essai 2/5).');
  await expect(page.locator('#wk-pos')).toHaveText('Mesure 1/16');
  await expect(page.locator('#ec-msg')).toHaveText('Joue : Mi5 · doigt 3');
  for (const m of [76, 76, 77, 79]) await play(page, m);
  await expect(page.locator('#ec-fb')).toHaveText('Mesure 1 propre après 2 essais. Bravo !');
  await expect(page.locator('#wk-pos')).toHaveText('Mesure 2/16');
  await expect(page.locator('#co-tips')).toContainText('1 mesure propre sur 2 passages');
  await expect(page.locator('#co-tips')).toContainText('Mesure 1 : 2 fautes en 2 passages');
  await expect(page.locator('#co-tips')).toContainText('au lieu de Sol5 (1 fois) : un demi-ton à côté');
  await expect(page.locator('#co-tips')).toContainText('La5 au lieu de Sol5 (1 fois) : la note voisine');
  await page.locator('#co-tips button', { hasText: 'Travailler la mesure 1' }).click();
  await expect(page.locator('#wk-pos')).toHaveText('Mesure 1/16');
});

test('C3. trois fautes sur la même note : conseil d’isoler le passage ; hésitation retenue', async ({ page }) => {
  await start(page);
  // @ts-ignore
  await page.evaluate(() => { EC.shownAt = performance.now() - 5000; });       // plus de 4 s avant la bonne note
  await play(page, 76);
  for (const m of [60, 62, 65]) await play(page, m);                           // trois fausses notes sur le 2e Mi
  await expect(page.locator('#ec-fb')).toContainText('Isole ce passage');
  // @ts-ignore
  const r = await page.evaluate(() => S.coach.hymne.b[0]);
  expect(r).toEqual([3, 0, 0, 1]);                                              // 3 fautes, 1 hésitation, mesure pas encore finie
});

test('C4. sans « rejouer » ou dans Séance, la mesure fautive n’est pas répétée', async ({ page }) => {
  await start(page);
  await page.locator('#co-redo').uncheck();
  for (const m of [76, 76, 78, 77, 79]) await play(page, m);
  await expect(page.locator('#wk-pos')).toHaveText('Mesure 2/16');
  await page.goto('./#seance');                                                 // l'écoute continue dans Séance
  await expect(page.locator('#ec-go')).toHaveText('Arrêter l’écoute');
  await page.locator('#co-redo').evaluate(e => { /** @type {HTMLInputElement} */ (e).checked = true; });
  // touche relâchée (l'étouffoir coupe le Sol), puis Sol Fa Mi + une faute
  // @ts-ignore
  await page.evaluate(() => ecFeed(new Float32Array(4096), 48000));
  for (const m of [79, 77, 76, 72]) await play(page, m);
  for (const m of [74]) await play(page, m);
  await expect(page.locator('#wk-pos')).toHaveText('Mesure 3/16');
  // @ts-ignore
  expect(await page.evaluate(() => S.coach.hymne.b[1])).toEqual([1, 0, 1, 0]);   // la faute est quand même retenue
  await page.goto('./#clavier');                                                // ailleurs, le micro se coupe
  // @ts-ignore
  expect(await page.evaluate(() => EC.on)).toBe(false);
});

test('C5. suivi gardé après rechargement, exporté, importé, nettoyé ; « Effacer » le remet à zéro', async ({ page }) => {
  await start(page);
  for (const m of [76, 76, 77, 72, 79]) await play(page, m);
  await page.reload();
  await expect(page.locator('#co-tips')).toContainText('Do5 au lieu de Sol5 (1 fois)');
  await page.goto('./#journal');
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#bk-export').click()]);
  const j = JSON.parse(require('fs').readFileSync(await download.path(), 'utf8'));
  expect(j.data.coach.hymne.c).toEqual({ '79>72': 1 });
  j.data.coach['mauvais id!'] = { b: { 0: [1, 1, 1, 1] } };
  j.data.coach.hymne.b.zz = [9, 9, 9, 9];
  j.data.coach.hymne.c['<script>'] = 4;
  j.data.coach.hymne.b[0] = [1, -5, 'x', 2];
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('#bk-file').setInputFiles({ name: 'sauvegarde.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(j)) });
  await page.locator('#dlg-ok').click();
  // @ts-ignore
  await expect.poll(() => page.evaluate(() => JSON.stringify(S.coach, (k, v) => k === 't' ? undefined : v))).toBe(JSON.stringify({ hymne: { b: { 0: [1, 0, 0, 2] }, c: { '79>72': 1 } } }));
  await page.goto('./#coach');
  await page.locator('#co-reset').click();
  await page.locator('#dlg-ok').click();
  await expect(page.locator('#co-tips')).toContainText('Tes mesures difficiles');
  // @ts-ignore
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('vestale-studio-v1')).coach)).toEqual({});
});

test('C6. accord incomplet dans le Coach : note manquante retenue, geste conseillé', async ({ page }) => {
  await page.goto('./#coach');
  await page.evaluate(() => { /* @ts-ignore */ window.__fakeMic(); });
  await page.locator('#dc-hands button[data-h="lh"]').click();
  await page.locator('#ec-go').click();
  // @ts-ignore
  await page.evaluate(() => clearInterval(EC.iv));
  await play(page, [48, 55]);
  await expect(page.locator('#ec-fb')).toHaveText('Il manque Mi3. Rejoue l’accord. Pose tous les doigts ensemble avant d’appuyer.');
  await play(page, [48, 52, 55]);
  await expect(page.locator('#ec-fb')).toContainText('Mesure 1 : 1 faute');
  await expect(page.locator('#co-tips')).toContainText('il te manque souvent Mi3 (1 fois)');
});
