// @ts-check
// Rythme au micro : décompte, début de chaque note situé dans le signal, à l’heure / un peu / faute, bilan de mesure.
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
// Jeu simulé sur une ligne de temps : chaque note [midi, début (s), durée (s)] ; une trame de 16 384 échantillons toutes les 70 ms.
const PERFORM = () => {
  // @ts-ignore
  window.__perform = (notes, from, to, sr = 48000) => { const N = 16384;
    for (let T = from; T <= to + 1e-9; T += 0.07) { const w = new Float32Array(N), ws = T - N / sr;
      for (const [m, on, dur] of notes) { const off = on + dur; if (on >= T || off <= ws) continue; const a = Math.max(on, ws), b = Math.min(off, T), s = Math.round((a - ws) * sr), n = Math.round((b - a) * sr); if (n <= 0) continue;
        // @ts-ignore
        const x = window.__piano(m, { sr, t0: a - on, n, noise: 0 }); for (let i = 0; i < n && s + i < N; i++) w[s + i] += x[i]; }
      for (let i = 0; i < N; i++) w[i] += 0.002 * (Math.random() - 0.5);
      // @ts-ignore
      ecFeed(w.subarray(N - 4096), sr, w, T); } };
};
test.beforeEach(async ({ page }) => { await page.addInitScript(PIANO); await page.addInitScript(PERFORM); });

/** Coach, main droite de l'Hymne, rythme coché, noire = 100 (0,6 s) ; la mesure 1 commence à 5 s (horloge simulée). */
const start = async (page, view = 'coach') => {
  await page.goto('./#' + view);
  await page.evaluate(() => { /* @ts-ignore */ window.__fakeMic(); });
  await page.locator(view === 'coach' ? '#dc-hands button[data-h="rh"]' : '#wk-hands button[data-h="rh"]').click();
  await page.locator('#wk-bpm').evaluate(e => { /** @type {HTMLInputElement} */ (e).value = '100'; e.dispatchEvent(new Event('input')); });
  await page.locator('#ec-rz').check();
  await page.locator('#ec-go').click();
  await expect(page.locator('#ec-go')).toHaveText('Arrêter l’écoute');
  // @ts-ignore
  await page.evaluate(() => { clearInterval(EC.iv); RZ.t0 = RZ.grid = 5; RZ.lat = 0; EC.lastOn = -1e9; });
};
// @ts-ignore
const perform = (page, notes, from, to) => page.evaluate(([n, f, t]) => window.__perform(n, f, t), [notes, from, to]);
const bar1 = (t0, dev = [0, 0, 0, 0]) => [76, 76, 77, 79].map((m, i) => [m, t0 + i * 0.6 + dev[i], 0.5]);

test('R1. à l’heure : chaque note le dit, bilan 4/4, décompte, pulsation, temps affiché', async ({ page }) => {
  await start(page);
  await expect(page.locator('#ec-msg')).toHaveText('Joue : Mi5 · doigt 3 · temps 1');
  await expect(page.locator('#ec-beat')).toBeVisible();
  // @ts-ignore
  expect(await page.evaluate(() => RZ.spb)).toBeCloseTo(0.6, 5);
  await perform(page, [[72, 4.3, 0.3]], 4.2, 4.65);                                // joué pendant le décompte : ignoré
  // @ts-ignore
  expect(await page.evaluate(() => [EC.i, EC.ko])).toEqual([0, 0]);
  await perform(page, bar1(5, [0, 0.03, -0.04, 0.02]), 4.7, 7.2);
  await expect(page.locator('#ec-fb')).toHaveText('Mesure 1 propre. Rythme : 4/4 à l’heure.');
  await expect(page.locator('#wk-pos')).toHaveText('Mesure 2/16');
  await expect(page.locator('#ec-msg')).toHaveText('Joue : Sol5 · temps 1');
  // @ts-ignore
  expect(await page.evaluate(() => RZ.t0)).toBeCloseTo(7.4, 5);                   // la mesure suivante, sur la barre de mesure
});

test('R2. note en retard : faute de rythme nommée, mesure rejouée au Coach, retard retenu dans « Où tu bloques »', async ({ page }) => {
  await start(page);
  const notes = [...bar1(5, [0, 0, 0.35, 0]), ...bar1(7.4)];                     // trames continues, comme un vrai micro
  await perform(page, notes, 4.7, 6.73);
  await expect(page.locator('#ec-fb')).toHaveText(/^Juste : Fa5 · mais en retard de 0,3[3-7] s : prépare le doigt pendant la note d’avant\.$/);
  await perform(page, notes, 6.8, 7.2);
  await expect(page.locator('#ec-fb')).toHaveText('Mesure 1 : 1 faute. On la rejoue jusqu’à ce qu’elle soit propre (essai 2). Rythme : 3/4 à l’heure.');
  await expect(page.locator('#wk-pos')).toHaveText('Mesure 1/16');
  // @ts-ignore
  expect(await page.evaluate(() => RZ.t0)).toBeCloseTo(7.4, 5);
  await expect(page.locator('#co-tips')).toContainText('Fa5 souvent en retard (1 fois) : prépare le doigt pendant la note d’avant');
  await perform(page, notes, 7.27, 9.6);                                           // la fin du Sol déborde sur la mesure rejouée : pas une note
  await expect(page.locator('#ec-fb')).toHaveText('Mesure 1 propre après 2 essais. Bravo ! Rythme : 4/4 à l’heure.');
  await expect(page.locator('#wk-pos')).toHaveText('Mesure 2/16');
});

test('R3. un peu en avance : pas de faute ; trop en avance : faute ; après une fausse note, le rythme n’est plus jugé', async ({ page }) => {
  await start(page, 'seance');
  const notes = [[76, 5, 0.4], [76, 5.43, 0.3], [77, 6.2 - 0.45, 0.4], [78, 6.8, 0.25], [79, 7.15, 0.5]];   // Mi, Mi un peu tôt, Fa trop tôt, Fa♯ faux, Sol
  await perform(page, notes, 4.7, 5.68);
  await expect(page.locator('#ec-fb')).toHaveText('Juste : Mi5 · un peu en avance');
  await perform(page, notes, 5.75, 6.38);
  await expect(page.locator('#ec-fb')).toHaveText(/^Juste : Fa5 · mais en avance de 0,4[3-7] s : attends le temps, compte à voix haute\.$/);
  await perform(page, notes, 6.45, 7.6);                                             // Fa♯ (fausse note), puis Sol bien en retard
  await expect(page.locator('#wk-pos')).toHaveText('Mesure 2/16');                 // dans Séance, on avance
  await expect(page.locator('#ec-fb')).toHaveText('Mesure 1 : 2 fautes. Rythme : 1/3 à l’heure.');   // Mi à l'heure ; Mi « un peu » ; Fa trop tôt ; le Sol n'est pas jugé
  // @ts-ignore
  const c = await page.evaluate(() => S.coach.hymne.c);
  expect(c).toEqual({ '77>t-': 1, '79>78': 1 });
});

test('R4. sans la case : rien ne change (pas de décompte, pas de pulsation, pas de temps affiché)', async ({ page }) => {
  await page.goto('./#coach');
  await page.evaluate(() => { /* @ts-ignore */ window.__fakeMic(); });
  await page.locator('#dc-hands button[data-h="rh"]').click();
  await page.locator('#ec-go').click();
  await expect(page.locator('#ec-msg')).toHaveText('Joue : Mi5 · doigt 3');
  await expect(page.locator('#ec-beat')).toBeHidden();
  // @ts-ignore
  expect(await page.evaluate(() => RZ.on)).toBe(false);
  await page.locator('#ec-rz').check();                                             // cochée en cours d'écoute : décompte, la mesure repart
  await expect(page.locator('#ec-msg')).toHaveText('Joue : Mi5 · doigt 3 · temps 1');
  await expect(page.locator('#ec-beat')).toBeVisible();
  await page.locator('#ec-go').click();
  await expect(page.locator('#ec-beat')).toBeHidden();
});

test('R5. 6/8 : les temps se comptent en noires pointées ; levée : la première note tombe au bon endroit', async ({ page }) => {
  await page.goto('./#coach');
  await page.evaluate(() => { /* @ts-ignore */ window.__fakeMic(); });
  await page.locator('#dc-piece').selectOption('alkan8');
  await page.locator('#dc-hands button[data-h="rh"]').click();
  await page.locator('#ec-rz').check();
  await page.locator('#ec-go').click();
  // @ts-ignore
  const r = await page.evaluate(() => ({ bu: RZ.bu, seq: EC.seq.map(x => x.at), beats: document.querySelectorAll('#ec-beat i').length }));
  expect(r.bu).toBe(1.5);
  expect(r.beats).toBe(2);
  await page.locator('#dc-piece').selectOption('bach120');                           // menuet avec levée
  await page.locator('#ec-go').click();
  await page.locator('#ec-go').click();
  // @ts-ignore
  const at = await page.evaluate(() => EC.seq[0].at);
  // @ts-ignore
  expect(at).toBe(await page.evaluate(() => WORK.bach120.bpb - WORK.bach120.pickup));
});
