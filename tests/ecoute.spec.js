// @ts-check
// Écoute au micro : reconnaissance des notes (sons de piano de synthèse), piano désaccordé, déroulé dans Séance, micro coupé.
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
  window.__play = (ms, o = {}) => { for (const t0 of [0.02, 0.09, 0.16, 0.23, 0.30]) { const bufs = [].concat(ms).map(m => window.__piano(m, { ...o, t0 })); const sum = new Float32Array(4096);
    bufs.forEach(b => b.forEach((v, i) => { sum[i] += v; })); ecFeed(sum, o.sr || 48000); } };
  // Micro simulé : un flux silencieux issu du contexte audio de l'app.
  // @ts-ignore
  // (posé sur le prototype : WebKit recrée l'objet navigator.mediaDevices, une propriété posée dessus se perd)
  // @ts-ignore
  window.__setMic = fn => { if (window.MediaDevices && navigator.mediaDevices) MediaDevices.prototype.getUserMedia = fn; else Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: fn }, configurable: true }); };
  // @ts-ignore
  window.__fakeMic = () => window.__setMic(async () => { const d = ac().createMediaStreamDestination(); window.__dest = d; return d.stream; });
};
test.beforeEach(async ({ page }) => { await page.addInitScript(PIANO); });

test('E1. le détecteur reconnaît chaque note du La1 au Mi7, juste, faible, dans le bruit, à 44,1 et 48 kHz', async ({ page }) => {
  await page.goto('./#seance');
  // @ts-ignore
  const bad = await page.evaluate(() => { const out = [];
    for (const sr of [48000, 44100]) for (const [label, o] of [['juste', {}], ['faible', { level: 0.04 }], ['bruit', { noise: 0.02 }], ['tenue', { t0: 0.5 }]])
      for (let m = 33; m <= 100; m++) { const d = detectPitch(window.__piano(m, { sr, ...o }), sr), got = d.f ? Math.round(69 + 12 * Math.log2(d.f / 440)) : null; if (got !== m || d.c < 0.8) out.push(`${sr} ${label} ${m}→${got}`); }
    return out; });
  expect(bad).toEqual([]);
  // @ts-ignore
  const quiet = await page.evaluate(() => detectPitch(new Float32Array(4096).map((v, i) => 0.002 * Math.sin(i)), 48000));
  expect(quiet.f).toBe(0);                                                    // silence : rien n'est annoncé
});

test('E2. piano ancien, 45 cents trop bas : le réglage sur le La recale toutes les notes', async ({ page }) => {
  await page.goto('./#seance');
  await page.evaluate(() => { /* @ts-ignore */ window.__fakeMic(); });
  await page.locator('#ec-cal summary').click();
  await page.locator('#ec-cal-go').click();
  await expect(page.locator('#ec-cal-msg')).toContainText('J’écoute');
  const a4 = 440 * Math.pow(2, -45 / 1200);                                   // ≈ 428,7 Hz
  // @ts-ignore
  await page.evaluate(a => { for (let k = 0; k < 9; k++) ecFeed(window.__piano(69, { a4: a, t0: 0.05 + k * 0.07 }), 48000); }, a4);
  await expect(page.locator('#ec-cal-msg')).toContainText(/(3[5-9]|4[0-9]) cents plus bas/);
  // @ts-ignore
  const r = await page.evaluate(a => { const bad = []; for (let m = 36; m <= 96; m++) { const d = detectPitch(window.__piano(m, { a4: a }), 48000), got = Math.round(69 + 12 * Math.log2(d.f / a4())); if (got !== m) bad.push(m); }
    return { bad, on: EC.on, saved: JSON.parse(localStorage.getItem('vestale-studio-v1')).meta.a4 }; }, a4);
  expect(r.bad).toEqual([]);
  expect(r.on).toBe(false);                                                   // le micro s'arrête après le réglage
  expect(Math.abs(r.saved - a4)).toBeLessThan(3);
  await page.reload();
  await expect(page.locator('#ec-cal-msg')).toContainText('cents plus bas');    // réglage gardé
  await page.locator('#ec-cal summary').click();
  await page.locator('#ec-cal-reset').click();
  await expect(page.locator('#ec-cal-msg')).toContainText('440 Hz');
});

test('E3. Séance : notes justes, note répétée, fausse note, mauvaise octave, passage à la mesure suivante', async ({ page }) => {
  await page.goto('./#seance');
  await page.evaluate(() => { /* @ts-ignore */ window.__fakeMic(); });
  await page.locator('#ec-go').click();
  await expect(page.locator('#ec-go')).toHaveText('Arrêter l’écoute');
  // @ts-ignore
  await page.evaluate(() => clearInterval(EC.iv));
  await expect(page.locator('#wk-hands button.on')).toHaveText('Main droite');  // une main à la fois
  await expect(page.locator('#ec-msg')).toHaveText('Joue : Mi5 · doigt 3');
  await expect(page.locator('#kb-wk .key.next')).toHaveAttribute('aria-label', 'Mi5');
  // @ts-ignore
  await page.evaluate(() => window.__play(76));
  await expect(page.locator('#ec-fb')).toHaveText('Juste : Mi5');
  // la même note résonne encore : elle ne compte pas une deuxième fois sans nouvelle attaque
  // @ts-ignore
  expect(await page.evaluate(() => { for (const t0 of [0.37, 0.44, 0.51]) ecFeed(window.__piano(76, { t0 }), 48000); return [EC.ok, EC.i]; })).toEqual([1, 1]);
  // @ts-ignore
  await page.evaluate(() => { window.__play(76); window.__play(77); });         // Mi rejoué, puis Fa
  await expect(page.locator('#ec-msg')).toHaveText('Joue : Sol5 · doigt 5');
  // @ts-ignore
  await page.evaluate(() => window.__play(72));                                // fausse note : Do5
  await expect(page.locator('#ec-fb')).toHaveText('J’entends Do5, j’attends Sol5.');
  await expect(page.locator('#ec-score')).toHaveText('Justes 3 À revoir 1');
  // @ts-ignore
  await page.evaluate(() => window.__play(67));                                // bonne note, une octave trop bas
  await expect(page.locator('#ec-fb')).toContainText('Bonne note, mais je l’entends plus bas (Sol4)');
  await expect(page.locator('#ec-score')).toHaveText('Justes 3 À revoir 1');
  // @ts-ignore
  await page.evaluate(() => window.__play(79));
  await expect(page.locator('#wk-pos')).toHaveText('Mesure 2/16');             // mesure terminée : la suivante s'affiche
  await expect(page.locator('#ec-msg')).toContainText('Joue : Sol5');
  await page.locator('#ec-skip').click();
  await expect(page.locator('#ec-msg')).toContainText('Joue : Fa5');
});

test('E4. main gauche : un accord est entendu sans être vérifié ; fin du morceau annoncée', async ({ page }) => {
  await page.goto('./#seance');
  await page.evaluate(() => { /* @ts-ignore */ window.__fakeMic(); });
  await page.locator('#wk-piece').selectOption('ex2');                          // quatre mesures, une ronde par mesure
  await page.locator('#wk-hands button[data-h="lh"]').click();
  await page.locator('#ec-go').click();
  await expect(page.locator('#ec-msg')).toHaveText('Joue : Do3 · doigt 5');
  // @ts-ignore
  await page.evaluate(() => clearInterval(EC.iv));
  // @ts-ignore
  await page.evaluate(() => { window.__play(48); window.__play(41); window.__play(43); });
  await expect(page.locator('#wk-pos')).toHaveText('Mesure 4/4');
  // @ts-ignore
  await page.evaluate(() => window.__play(48));
  await expect(page.locator('#ec-fb')).toHaveText('Morceau terminé : 4 justes, 0 à revoir.');
  await expect(page.locator('#ec-go')).toHaveText('Écoute-moi');
  await page.locator('#wk-piece').selectOption('hymne');
  await page.locator('#wk-hands button[data-h="lh"]').click();
  await page.locator('#ec-go').click();
  await expect(page.locator('#ec-msg')).toContainText('Joue l’accord : Do3 + Mi3 + Sol3');
  // @ts-ignore
  await page.evaluate(() => clearInterval(EC.iv));
  // @ts-ignore
  await page.evaluate(() => window.__play([48, 52, 55]));
  await expect(page.locator('#wk-pos')).toHaveText('Mesure 2/16');
  await expect(page.locator('#ec-fb')).toHaveText('Accord entendu (non vérifié).');
});

test('E5. micro refusé ou absent : message clair, rien ne casse', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('./#seance');
  // @ts-ignore
  await page.evaluate(() => window.__setMic(async () => { const e = new Error('non'); e.name = 'NotAllowedError'; throw e; }));
  await page.locator('#ec-go').click();
  await expect(page.locator('#ec-fb')).toContainText('Micro refusé');
  await expect(page.locator('#ec-go')).toHaveText('Écoute-moi');
  await page.evaluate(() => { Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true }); });
  await page.locator('#ec-go').click();
  await expect(page.locator('#ec-fb')).toHaveText('Micro indisponible dans ce navigateur.');
  await page.locator('#wk-play').click();                                       // le son de l'app marche toujours
  // @ts-ignore
  expect(await page.evaluate(() => AC.state)).toBe('running');
  expect(errors).toEqual([]);
});

test('E6. le micro est coupé : écoute d’un passage, changement d’onglet, app en arrière-plan', async ({ page }) => {
  await page.goto('./#seance');
  await page.evaluate(() => { /* @ts-ignore */ window.__fakeMic(); });
  // @ts-ignore
  const live = () => page.evaluate(() => window.__dest.stream.getTracks().map(t => t.readyState).join());
  await page.locator('#ec-go').click();
  await expect(page.locator('#ec-skip')).toBeVisible();
  expect(await live()).toBe('live');
  await page.locator('#wk-play').click();
  // @ts-ignore
  expect(await page.evaluate(() => EC.on)).toBe(false);
  expect(await live()).toBe('ended');
  await page.locator('#wk-stop').click();
  await page.locator('#ec-go').click();
  await expect(page.locator('#ec-skip')).toBeVisible();
  await page.locator('#tabs a[data-v="clavier"]').click();
  await expect(page.locator('#v-clavier')).toBeVisible();                       // le changement d'onglet est traité
  // @ts-ignore
  expect(await page.evaluate(() => EC.on)).toBe(false);
  await page.locator('#tabs a[data-v="seance"]').click();
  await page.locator('#ec-go').click();
  await expect(page.locator('#ec-skip')).toBeVisible();
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  // @ts-ignore
  expect(await page.evaluate(() => [EC.on, EC_ON])).toEqual([false, false]);
  expect(await live()).toBe('ended');
});

test('E7. chaîne complète avec un vrai flux audio : une note jouée dans le « micro » est reconnue', async ({ page }) => {
  await page.goto('./#seance');
  await page.evaluate(() => { /* @ts-ignore */ window.__fakeMic(); });
  await page.locator('#ec-go').click();
  await expect(page.locator('#ec-msg')).toHaveText('Joue : Mi5 · doigt 3');
  // Mi5 riche en harmoniques, envoyé dans le flux du micro simulé pendant 0,8 s
  await page.evaluate(() => { /* @ts-ignore */ const a = AC, d = window.__dest, g = a.createGain(); g.gain.value = 0.25; g.connect(d);
    [1, 2, 3, 4].forEach(k => { const o = a.createOscillator(), gk = a.createGain(); o.frequency.value = 659.255 * k; gk.gain.value = 1 / (k * k); o.connect(gk); gk.connect(g); o.start(); o.stop(a.currentTime + 0.8); }); });
  await expect(page.locator('#ec-fb')).toHaveText('Juste : Mi5', { timeout: 4000 });
  await expect(page.locator('#ec-msg')).toHaveText('Joue : Mi5');
});

test('E8. départ annulé : quitter Séance pendant la demande du micro ne laisse pas le micro ouvert', async ({ page }) => {
  await page.goto('./#seance');
  // micro qui met 400 ms à répondre, comme la fenêtre d'autorisation
  // @ts-ignore
  await page.evaluate(() => window.__setMic(() => new Promise(res => setTimeout(() => { const d = ac().createMediaStreamDestination(); window.__dest = d; res(d.stream); }, 400))));
  await page.locator('#ec-go').click();
  await page.locator('#tabs a[data-v="clavier"]').click();
  await page.waitForTimeout(700);
  // @ts-ignore
  expect(await page.evaluate(() => [EC.on, EC_ON, window.__dest.stream.getTracks().map(t => t.readyState).join()])).toEqual([false, false, 'ended']);
});
