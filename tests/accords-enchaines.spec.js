// @ts-check
// Accords de 3 notes enchaînés, au micro, avec les vrais sons de piano de l'app (samples/) :
// flux continu lu comme le micro (trame de 70 ms, fenêtre de 16 384 échantillons), accord d'avant tenu (pédale),
// conditions de téléphone (graves affaiblis, bruit, réverbération de pièce).
// Bug corrigé (v67) : le verdict tombait à la 3e trame (≈ 0,26 s après l'attaque), quand la fenêtre contenait encore
// l'accord d'avant ; l'accord juste était refusé (« Il manque Do3 et Mi3 »), y compris le premier accord grave.
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // @ts-ignore
    const mic = async () => ac().createMediaStreamDestination().stream;
    if (window.MediaDevices && navigator.mediaDevices) MediaDevices.prototype.getUserMedia = mic;
    else Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: mic }, configurable: true });
  });
});

// Joue « avant » puis « joué » (attaque à 1,2 s) ; l'app attend « avant » puis « attendu ». Rend le verdict du 2e accord.
const ENCHAINE = async ({ avant, tenu, joue, attendu }) => {
  // @ts-ignore
  clearInterval(EC.iv); S.meta.a4 = 440; const SR = 48000, smp = {};
  for (let m = 24; m <= 108; m += 3) { const ab = await (await fetch('./samples/p' + m + '.mp3')).arrayBuffer(); smp[m] = (await new OfflineAudioContext(1, 1, SR).decodeAudioData(ab)).getChannelData(0); }
  const N = SR * 3, T = SR * 1.2, out = new Float32Array(N);
  const note = (m, t0, tOff) => { const base = Math.min(108, Math.max(24, 24 + 3 * Math.round((m - 24) / 3))), src = smp[base], r = Math.pow(2, (m - base) / 12);
    for (let i = t0; i < N; i++) { const pos = (i - t0) * r, k = pos | 0; if (k + 1 >= src.length) break; let v = src[k] + (src[k + 1] - src[k]) * (pos - k);
      if (tOff != null && i > tOff) v *= Math.exp(-(i - tOff) / (SR * 0.08)); out[i] += 0.1 * v; } };
  avant.forEach(m => note(m, SR * 0.3, tenu ? null : T - SR * 0.05));
  joue.forEach(m => note(m, T, null));
  let seed = 3; for (let i = 0; i < N; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; out[i] += 0.012 * (seed / 0x7fffffff - 0.5); }
  for (let pass = 0; pass < 2; pass++) { const a = Math.exp(-2 * Math.PI * 180 / SR); let px = 0, py = 0; for (let i = 0; i < N; i++) { const x = out[i], y = a * (py + x - px); px = x; py = y; out[i] = y; } }
  for (const [d, g] of [[0.031, 0.35], [0.047, 0.25], [0.083, 0.15]]) { const D = Math.round(d * SR); for (let i = N - 1; i >= D; i--) out[i] += g * out[i - D]; }
  // @ts-ignore
  Object.assign(EC, { armed: true, sm: null, n: 0, loud: 0, low: 0, last: null, votes: null, cv: 0, pk: 0, prev: 0, i: 0, ok: 0, ko: 0, seq: [{ ms: avant, fg: null, at: 0 }, { ms: attendu, fg: null, at: 1 }] });
  const res = [];
  for (let end = 16384; end <= N; end += Math.round(SR * 0.07)) { const w = out.slice(end - 16384, end);
    // @ts-ignore
    const b4 = EC.ok + EC.ko; ecFeed(w.subarray(16384 - 4096), SR, w);
    // @ts-ignore
    if (EC.ok + EC.ko > b4) { res.push(document.querySelector('#ec-fb').textContent); if (end > T) break; } }
  return res;
};

test('AE1. G7 tenu (pédale) puis C, à la main gauche : les deux accords justes, du premier coup', async ({ page }) => {
  await page.goto('./#coach');
  await page.locator('#dc-hands button[data-h="lh"]').click();
  await page.locator('#ec-go').click();
  const r = await page.evaluate(ENCHAINE, { avant: [47, 53, 55], tenu: true, joue: [48, 52, 55], attendu: [48, 52, 55] });
  expect(r).toEqual(['Accord juste : Si2 + Fa3 + Sol3', 'Accord juste : Do3 + Mi3 + Sol3']);
});

test('AE2. C tenu puis Am, à la main droite : les deux accords justes', async ({ page }) => {
  await page.goto('./#coach');
  await page.locator('#ec-go').click();
  const r = await page.evaluate(ENCHAINE, { avant: [60, 64, 67], tenu: true, joue: [57, 60, 64], attendu: [57, 60, 64] });
  expect(r).toEqual(['Accord juste : Do4 + Mi4 + Sol4', 'Accord juste : La3 + Do4 + Mi4']);
});

test('AE3. accords faux toujours refusés, avec la seule note qui manque : C sans Mi, C mineur, G7 sans Fa', async ({ page }) => {
  await page.goto('./#coach');
  await page.locator('#dc-hands button[data-h="lh"]').click();
  await page.locator('#ec-go').click();
  for (const [avant, joue, attendu, manque] of [
    [[47, 53, 55], [48, 55], [48, 52, 55], 'Il manque Mi3.'],
    [[47, 53, 55], [48, 51, 55], [48, 52, 55], 'Il manque Mi3.'],
    [[48, 52, 55], [47, 55], [47, 53, 55], 'Il manque Fa3.'],
  ]) {
    const r = await page.evaluate(ENCHAINE, { avant, tenu: true, joue, attendu });
    expect(r[r.length - 1]).toContain(manque);
  }
});
