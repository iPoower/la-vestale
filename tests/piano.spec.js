// @ts-check
// Son de piano échantillonné (Steinway & Sons modèle B, University of Iowa) : chargement, lecture, secours, hors ligne.
const { test, expect } = require('@playwright/test');

/** Attend que les 29 enregistrements soient décodés (le chargement démarre au premier toucher). */
const ready = async page => {
  await page.locator('#wk-play').click();
  // @ts-ignore
  await expect.poll(() => page.evaluate(() => SMP.state), { timeout: 15000 }).toBe(2);
  await page.locator('#wk-stop').click();
};
const level = page => page.evaluate(async () => {
  // @ts-ignore
  if (window.__ctx !== AC) { window.__ctx = AC; window.__an = AC.createAnalyser(); MASTER.connect(window.__an); }
  // @ts-ignore
  const an = window.__an, buf = new Float32Array(2048); let max = 0;
  for (let i = 0; i < 10; i++) { an.getFloatTimeDomainData(buf); let s = 0; for (const v of buf) s += v * v; max = Math.max(max, Math.sqrt(s / buf.length)); await new Promise(r => setTimeout(r, 40)); }
  return max;
});

test('ST1. les 29 enregistrements se chargent ; chaque note part sans blanc au début', async ({ page }) => {
  await page.goto('./#seance');
  // @ts-ignore
  await expect.poll(() => page.evaluate(() => SMP.state), { timeout: 15000 }).toBe(2);   // chargés dès l'ouverture, sans toucher
  // @ts-ignore
  expect(await page.evaluate(() => AC)).toBeNull();                           // aucun son n'a encore été lancé
  // @ts-ignore
  const r = await page.evaluate(() => SMP_NOTES.map(n => { const b = SMP.buf[n], x = b.getChannelData(0); let pk = 0; for (let i = 0; i < x.length; i++) pk = Math.max(pk, Math.abs(x[i]));
    let on = 0; while (Math.abs(x[on]) < pk * 0.02) on++; return [n, +(on / b.sampleRate * 1000).toFixed(1), +b.duration.toFixed(1), pk > 0.3]; }));
  expect(r.length).toBe(29);
  expect(r.filter(([, on]) => on > 4)).toEqual([]);                            // attaque dans les 4 premières millisecondes
  expect(r.filter(([, , d]) => d < 1.8)).toEqual([]);
  expect(r.every(x => x[3])).toBe(true);
});

test('ST2. une fois chargé, chaque note joue l’enregistrement le plus proche, à la bonne hauteur', async ({ page }) => {
  await page.goto('./#clavier');
  await page.locator('#kb-main .key[data-m="60"]').click();
  // @ts-ignore
  await expect.poll(() => page.evaluate(() => SMP.state), { timeout: 15000 }).toBe(2);
  await page.evaluate(() => { window.__osc = 0; window.__src = [];
    const o = AudioContext.prototype.createOscillator; AudioContext.prototype.createOscillator = function () { window.__osc++; return o.call(this); };
    const b = AudioContext.prototype.createBufferSource; AudioContext.prototype.createBufferSource = function () { const s = b.call(this); window.__src.push(s); return s; }; });
  // @ts-ignore
  const r = await page.evaluate(() => { const out = {}; for (const m of [60, 61, 62, 23, 108]) { window.__src = []; playNote(m, 0, 1, .8); const s = window.__src.find(x => x.buffer && x.buffer.duration > 1);
    out[m] = [SMP_NOTES.find(n => SMP.buf[n] === s.buffer), +s.playbackRate.value.toFixed(4)]; } return { out, osc: window.__osc }; });
  expect(r.out).toEqual({ 60: [60, 1], 61: [60, 1.0595], 62: [63, 0.9439], 23: [24, 0.9439], 108: [108, 1] });
  expect(r.osc).toBe(0);                                                       // plus de son de synthèse
  await page.locator('#kb-main .key[data-m="64"]').click();
  await page.waitForTimeout(120);
  expect(await level(page)).toBeGreaterThan(0.02);
});

test.describe('sans service worker', () => {
  test.use({ serviceWorkers: 'block' });                                       // sinon le cache hors ligne fournit les sons
test('ST3. sons absents : le son de synthèse joue, sans erreur, et l’app n’insiste pas', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  let asked = 0;
  await page.route('**/samples/*.mp3', r => { asked++; return r.fulfill({ status: 404, body: '' }); });
  await page.goto('./#clavier');
  for (let i = 0; i < 6; i++) { await page.locator('#kb-main .key[data-m="60"]').click(); await page.waitForTimeout(250); }
  // @ts-ignore
  expect(await page.evaluate(() => [SMP.state, SMP.fail])).toEqual([0, 3]);
  expect(asked).toBeLessThanOrEqual(87);                                       // 3 essais de 29 fichiers au plus
  await page.locator('#kb-main .key[data-m="64"]').click();
  await page.waitForTimeout(100);
  expect(await level(page)).toBeGreaterThan(0.02);
  expect(errors).toEqual([]);
});
});

test('ST4. le détecteur du mode écoute reconnaît le vrai Steinway, du La1 au Do7', async ({ page }) => {
  await page.goto('./#seance');
  await ready(page);
  // @ts-ignore
  const r = await page.evaluate(() => SMP_NOTES.map(n => { const b = SMP.buf[n], x = b.getChannelData(0), out = [n];
    for (const t0 of [0.08, 0.3, 0.7]) { const i = Math.round(t0 * b.sampleRate), d = detectPitch(x.slice(i, i + 4096), b.sampleRate); out.push(d.f && d.c >= 0.8 ? Math.round(69 + 12 * Math.log2(d.f / 440)) : null); }
    return out; }));
  const inRange = r.filter(([n]) => n >= 33 && n <= 96);
  expect(inRange.filter(([n, ...got]) => got.some(g => g !== null && g !== n))).toEqual([]);   // jamais une fausse note
  expect(inRange.filter(([n, ...got]) => got.filter(g => g === n).length < 2)).toEqual([]);    // reconnue sur au moins 2 instants sur 3
  expect(inRange.filter(([n, ...got]) => n <= 90 && got.some(g => g !== n))).toEqual([]);      // jusqu'au Fa♯6 : reconnue à chaque instant
});

test('ST5. hors ligne : les 29 enregistrements sont dans le cache de la version courante', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => navigator.serviceWorker.ready);
  const n = await page.evaluate(async () => { const keys = (await caches.keys()).filter(k => k.startsWith('la-vestale-')); const c = await caches.open(keys[keys.length - 1]);
    return (await c.keys()).filter(r => /\/samples\/p\d+\.mp3$/.test(r.url)).length; });
  expect(n).toBe(29);
});

test('ST6. accords du vrai Steinway : justes reconnus, fausses notes repérées', async ({ page }) => {
  await page.goto('./#seance');
  // @ts-ignore
  await expect.poll(() => page.evaluate(() => SMP.state), { timeout: 15000 }).toBe(2);
  // @ts-ignore
  const r = await page.evaluate(() => {
    // Accord joué à partir des enregistrements (variation de vitesse, comme l'app), fenêtre de 16 384 échantillons.
    const mix = (ms, t0) => { const n = 16384; let sr = 44100; const out = new Float32Array(n);
      for (const m of ms) { let s = SMP_NOTES[0]; for (const c of SMP_NOTES) if (Math.abs(c - m) < Math.abs(s - m)) s = c;
        const b = SMP.buf[s], x = b.getChannelData(0), rate = Math.pow(2, (m - s) / 12), st = Math.round(t0 * b.sampleRate); sr = b.sampleRate;
        for (let i = 0; i < n; i++) { const p = st + i * rate, k = Math.floor(p), f = p - k; out[i] += (x[k] || 0) * (1 - f) + (x[k + 1] || 0) * f; } }
      return { buf: out, sr }; };
    const good = [[48, 52, 55], [47, 53, 55], [50, 54], [64, 67, 71], [64, 67, 72], [36, 48], [48, 52, 55, 60], [55, 59, 62, 67]];
    const bad = [[[48, 52, 55], [48, 51, 55], [52]], [[48, 52, 55], [48, 55], [52]], [[64, 67, 71], [64, 68, 71], [67]], [[47, 53, 55], [48, 52, 55], [47, 53]], [[64, 67, 72], [64], [67, 72]], [[50, 54], [48, 53], [50, 54]],
      [[47, 53, 55], [47, 55], [53]], [[64, 67, 71], [64, 71], [67]], [[48, 52, 55, 60], [48, 55, 60], [52]]];   // tierce oubliée : piège des harmoniques communes
    const refused = [], unseen = [];
    for (const ch of good) for (const t0 of [0.12, 0.3, 0.6]) { const { buf, sr } = mix(ch, t0); const p = chordCheck(buf, sr, ch); if (!p.every(Boolean)) refused.push(`${ch}@${t0}`); }
    for (const [want, play, miss] of bad) for (const t0 of [0.12, 0.3, 0.6]) { const { buf, sr } = mix(play, t0); const p = chordCheck(buf, sr, want), found = want.filter((m, k) => !p[k]); if (!miss.every(m => found.includes(m))) unseen.push(`${want}/${play}@${t0}`); }
    // Do + Sol joués fort sans le Mi, à plusieurs instants : le Mi ne doit jamais être cru présent
    for (const t0 of [0.08, 0.12, 0.2, 0.3, 0.45, 0.6, 0.9]) { const { buf, sr } = mix([48, 55], t0); if (chordCheck(buf, sr, [48, 52, 55])[1]) unseen.push(`Do+Sol@${t0}`); }
    return { refused, unseen }; });
  expect(r.unseen).toEqual([]);                                                  // aucune fausse note ratée
  expect(r.refused).toEqual([]);                                                 // aucun accord juste refusé
});
