// @ts-check
// Accords graves au micro : cordes inharmoniques, fondamentale faible (micro d’iPhone), réglage du La, Coach qui ne bloque plus.
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

// Accord de piano droit : cordes plus ou moins inharmoniques (B), fondamentale faible, deux cordes par note.
const PIANO_DROIT = () => {
  // @ts-ignore
  window.__droit = (ms, o = {}) => { const { sr = 48000, n = 16384, a4 = 438, B = 0.001, t0 = 0.3, det = 3 } = o, out = new Float32Array(n);
    for (const m of ms) { const f0 = a4 * Math.pow(2, (m - 69) / 12);
      for (const d of [0, det]) for (let k = 1; k <= 14; k++) { const fk = k * f0 * Math.pow(2, d / 1200) * Math.sqrt(1 + B * k * k); if (fk > sr / 2.2) break;
        const amp = 0.12 * Math.pow(k, -0.9) * (k === 1 ? 0.15 : 1), ph = k * 1.3 + d;
        for (let i = 0; i < n; i++) { const t = t0 + i / sr; out[i] += amp * Math.exp(-t * (1 + k * 0.4)) * Math.sin(2 * Math.PI * fk * t + ph); } } }
    let s = 7; for (let i = 0; i < n; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; out[i] += 0.003 * (s / 0x7fffffff - 0.5); }
    return out; };
};
test.beforeEach(async ({ page }) => { await page.addInitScript(PIANO_DROIT); });

test('G1. accords graves de piano droit (G7, C, D de l’Hymne) : reconnus à tout instant ; faux accords refusés', async ({ page }) => {
  await page.goto('./#coach');
  // @ts-ignore
  const r = await page.evaluate(() => { S.meta.a4 = 438; const bad = [];
    for (const [name, ms] of [['G7', [47, 53, 55]], ['C', [48, 52, 55]], ['D', [50, 54]]]) for (const B of [0.0004, 0.001, 0.002]) for (const t0 of [0.1, 0.3, 0.6]) for (const det of [2, 6]) {
      // @ts-ignore
      const ok = chordCheck(window.__droit(ms, { B, t0, det }), 48000, ms); if (!ok.every(Boolean)) bad.push(`${name} B${B} t${t0} ±${det} : manque ${ms.filter((m, k) => !ok[k]).map(wkNm).join('+')}`); }
    const faux = [];
    for (const [want, play, miss] of [[[47, 53, 55], [47, 55], 53], [[48, 52, 55], [48, 55], 52], [[47, 53, 55], [47, 54, 55], 53], [[48, 52, 55], [48, 51, 55], 52]]) for (const B of [0.0004, 0.001, 0.002]) for (const t0 of [0.1, 0.3, 0.6]) {
      // @ts-ignore
      const ok = chordCheck(window.__droit(play, { B, t0 }), 48000, want); if (ok[want.indexOf(miss)]) faux.push(`${want} joué ${play} B${B} t${t0}`); }
    return { bad, faux }; });
  expect(r.bad).toEqual([]);
  expect(r.faux).toEqual([]);
});

test('G2. réglage du La très éloigné (420,2 Hz) : dit dès l’écoute ; après 3 accords ratés, le conseil le rappelle', async ({ page }) => {
  await page.goto('./#coach');
  await page.evaluate(() => { /* @ts-ignore */ S.meta.a4 = 420.2; saveLocal(); /* @ts-ignore */ window.__fakeMic(); });
  await page.locator('#dc-hands button[data-h="lh"]').click();
  await page.locator('#ec-go').click();
  await expect(page.locator('#ec-fb')).toContainText('Ton réglage du La est à 420,2 Hz (80 cents plus bas que 440)');
  // @ts-ignore
  await page.evaluate(() => { clearInterval(EC.iv); for (let k = 0; k < 3; k++) { window.__play([48, 55]); for (let i = 0; i < 4; i++) ecFeed(new Float32Array(4096), 48000); } });
  await expect(page.locator('#ec-fb')).toContainText('Rejoue l’accord. Ton réglage du La est à 420,2 Hz');
  await page.goto('./#coach');
  // @ts-ignore
  await page.evaluate(() => { S.meta.a4 = 438; saveLocal(); ecStop(); });
  await page.locator('#ec-go').click();
  await expect(page.locator('#ec-fb')).not.toContainText('Ton réglage du La');
});

test('G3. Coach : 5 essais au plus sur une mesure, puis on avance ; « Passer la note » sur un accord ne laisse pas de faute', async ({ page }) => {
  await page.goto('./#coach');
  await page.evaluate(() => { /* @ts-ignore */ window.__fakeMic(); });
  await page.locator('#dc-hands button[data-h="lh"]').click();
  await page.locator('#ec-go').click();
  // @ts-ignore
  await page.evaluate(() => clearInterval(EC.iv));
  await expect(page.locator('#ec-msg')).toContainText('Joue l’accord : Do3 + Mi3 + Sol3');
  // 5 passages ratés (Do + Sol sans Mi, puis l'accord juste pour finir la mesure)
  for (let k = 0; k < 5; k++) {
    // @ts-ignore
    await page.evaluate(() => { window.__play([48, 55]); for (let i = 0; i < 4; i++) ecFeed(new Float32Array(4096), 48000); window.__play([48, 52, 55]); for (let i = 0; i < 4; i++) ecFeed(new Float32Array(4096), 48000); });
  }
  await expect(page.locator('#ec-fb')).toHaveText('Mesure 1 : on avance après 5 essais. Elle t’attend dans « Où tu bloques » : travaille-la lentement, mains séparées.');
  await expect(page.locator('#wk-pos')).toHaveText('Mesure 2/16');
  // mesure 2 : accord raté 3 fois, puis « Passer la note » → mesure propre, on avance sans la rejouer
  // @ts-ignore
  await page.evaluate(() => { for (let k = 0; k < 3; k++) { window.__play([43, 50]); for (let i = 0; i < 4; i++) ecFeed(new Float32Array(4096), 48000); } });
  await expect(page.locator('#ec-fb')).toContainText('touche « Passer la note »');
  await page.locator('#ec-skip').click();
  await expect(page.locator('#wk-pos')).toHaveText('Mesure 3/16');
});
