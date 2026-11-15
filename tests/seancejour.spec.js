// @ts-check
// Séance du jour (30 min) et révision espacée des mesures (J+1, J+3, J+7…).
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

const DAY = d => new Date(`2026-11-${String(d).padStart(2, '0')}T10:00:00`);
const blocs = page => page.locator('#blocks li').evaluateAll(ls => ls.map(l => [l.querySelector('b').textContent, +l.querySelector('.m').textContent.replace('′', '')]));
/** Joue la mesure 1 de l'Hymne (main droite) au Coach ; `faute` ajoute une fausse note. */
const mesure1 = async (page, faute) => {
  await page.goto('./#coach');
  await page.evaluate(() => { /* @ts-ignore */ window.__fakeMic(); });
  await page.locator('#dc-hands button[data-h="rh"]').click();
  // @ts-ignore
  await page.evaluate(() => { ecStop(); wkGo(0); });                             // l'app rouvre là où on s'était arrêté
  await page.locator('#ec-go').click();
  await expect(page.locator('#ec-go')).toHaveText('Arrêter l’écoute');
  // @ts-ignore
  await page.evaluate(f => { clearInterval(EC.iv); for (const m of f ? [76, 76, 77, 72, 79] : [76, 76, 77, 79]) window.__play(m); }, faute);
};

test('J1. premier jour : 30 minutes, déchiffrer et jouer le début, chaque bloc ouvre la bonne mesure', async ({ page }) => {
  await page.clock.setFixedTime(DAY(16));
  await page.goto('./#seance');
  await expect(page.locator('#fmt button.on')).toHaveText('Du jour · 30 min');
  await page.locator('#fmt button[data-f="court"]').click();
  await page.locator('#today-actions a', { hasText: 'Ma séance du jour · 30 min' }).click();   // en haut de Séance
  await expect(page.locator('#fmt button.on')).toHaveText('Du jour · 30 min');
  const b = await blocs(page);
  expect(b.map(x => x[0])).toEqual(['Échauffement main gauche', 'Déchiffrer 2 mesures', 'Jouer ce que tu as lu', 'Oreille', 'Pour le plaisir']);
  expect(b.reduce((s, x) => s + x[1], 0)).toBe(30);
  await expect(page.locator('#blocks li').nth(1)).toContainText('Hymne à la joie : mesures 1 et 2');
  await page.locator('#blocks li').nth(1).locator('a').click();
  await expect(page.locator('#v-coach')).toBeVisible();
  await expect(page.locator('#dc-live')).toBeVisible();
  await expect(page.locator('#dc-pos')).toHaveText('Mesure 1/16');
  await page.goto('./#seance');
  await page.locator('#blocks li').first().locator('a').click();
  await expect(page.locator('#v-gauche')).toBeVisible();
  await page.goto('./#seance');
  await page.locator('#fmt button[data-f="std"]').click();
  await expect(page.locator('#blocks li')).toHaveCount(4);                     // les formats d'avant restent là
});

test('J2. révision espacée : apprise un jour, revient le lendemain, puis à 3 jours ; ratée, revient le lendemain', async ({ page }) => {
  await page.clock.setFixedTime(DAY(16));
  await mesure1(page, false);
  // @ts-ignore
  const d0 = await page.evaluate(() => dayN());
  // @ts-ignore
  expect(await page.evaluate(() => S.coach.hymne.r)).toEqual({ 0: [1, d0 + 1, d0] });
  await page.goto('./#seance');
  expect((await blocs(page)).map(x => x[0])).not.toContain('Révision espacée');   // rien à réviser le jour même

  await page.clock.setFixedTime(DAY(17));
  await page.reload();
  const b = await blocs(page);
  expect(b.map(x => x[0])).toContain('Révision espacée');
  expect(b.reduce((s, x) => s + x[1], 0)).toBe(30);
  await expect(page.locator('#blocks li', { hasText: 'Révision espacée' })).toContainText('Hymne à la joie : mesure 1. Une fois chacune');
  await page.goto('./#coach');
  await expect(page.locator('#co-tips')).toContainText('À réviser aujourd’hui');
  await mesure1(page, false);
  await expect(page.locator('#ec-fb')).toHaveText('Mesure 1 propre. Révision réussie : elle revient dans 3 jours.');
  // @ts-ignore
  expect(await page.evaluate(() => S.coach.hymne.r[0])).toEqual([2, d0 + 4, d0 + 1]);
  await mesure1(page, true);                                                     // rejouée le même jour : ne compte plus
  // @ts-ignore
  expect(await page.evaluate(() => S.coach.hymne.r[0])).toEqual([2, d0 + 4, d0 + 1]);

  await page.clock.setFixedTime(DAY(20));
  await page.reload();
  await mesure1(page, true);
  await expect(page.locator('#ec-fb')).toContainText('Révision ratée : elle revient demain.');
  // @ts-ignore
  expect(await page.evaluate(() => S.coach.hymne.r[0])).toEqual([1, d0 + 5, d0 + 4]);
});

test('J3. mesures difficiles dans la séance ; séance figée pendant qu’elle tourne ; données nettoyées', async ({ page }) => {
  await page.clock.setFixedTime(DAY(16));
  await page.goto('./#seance');
  // @ts-ignore
  await page.evaluate(() => { S.coach = { hymne: { b: { 3: [4, 0, 2, 1], 7: [1, 1, 2, 0] }, c: {}, d: { 0: 1, 1: 1 }, t: Date.now() } }; DAYPLAN = null; renderBlocks(); });
  const b = await blocs(page);
  expect(b.map(x => x[0])).toEqual(['Échauffement main gauche', 'Mesures difficiles', 'Déchiffrer 2 mesures', 'Jouer ce que tu as lu', 'Oreille', 'Pour le plaisir']);
  await expect(page.locator('#blocks li', { hasText: 'Mesures difficiles' })).toContainText('Hymne à la joie : mesure 4, au Coach jusqu’à ce qu’elle soit propre.');   // la 8 est déjà propre
  await expect(page.locator('#blocks li', { hasText: 'Déchiffrer' })).toContainText('mesures 3 et 4');
  await page.locator('#t-start').click();
  // @ts-ignore
  await page.evaluate(() => { S.coach.hymne.b = {}; renderBlocks(); });
  expect((await blocs(page)).map(x => x[0])).toContain('Mesures difficiles');     // pas de bloc qui disparaît en cours de séance
  await page.locator('#blocks li', { hasText: 'Mesures difficiles' }).locator('a').click();
  await expect(page.locator('#wk-pos')).toHaveText('Mesure 4/16');
  // @ts-ignore
  const c = await page.evaluate(() => cleanCoach({ hymne: { b: {}, c: {}, r: { 0: [2, 20000, 19999], 1: [9, 1, 1], x: [1, 1, 1], 2: 'z' }, t: 'hier' } }));
  expect(c).toEqual({ hymne: { b: {}, c: {}, r: { 0: [2, 20000, 19999] } } });
});
