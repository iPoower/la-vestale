// @ts-check
// « Mon morceau, de A à Z » : étapes par sections, bon outil à la bonne mesure, micro, mains ensemble, validation, fin.
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

/** Joue au micro simulé ce que l'app demande, tant qu'elle écoute (silence entre deux notes : la touche est relâchée). */
const jouer = (page, max = 60) => page.evaluate(n => { /* @ts-ignore */ clearInterval(EC.iv);
  // @ts-ignore
  for (let k = 0; k < n && EC.on; k++) { const x = EC.seq[EC.i]; if (!x) break; ecFeed(new Float32Array(4096), 48000); window.__play(x.ms); } }, max);
/** Lit sans faute la mesure en cours du déchiffrage. */
const lire = async page => {
  // @ts-ignore
  const items = await page.evaluate(() => DC.items.map(x => x.m));
  for (const m of items) {
    // @ts-ignore
    const l = await page.evaluate(m => spell(m).l, m);
    await page.locator(`#dc-names button[data-l="${l}"]`).click();
    await page.locator(`#kb-dc .key[data-m="${m}"]`).dispatchEvent('pointerdown');
  }
};

test('Z1. le parcours découpe le morceau ; écouter, puis lire la section 1 : le bouton ouvre le déchiffrage à la bonne mesure', async ({ page }) => {
  await page.goto('./#coach');
  await expect(page.locator('#pz-tag')).toHaveText('0/23 étapes');                  // Hymne : 16 mesures, 4 sections
  await expect(page.locator('#pz-step')).toHaveText('Étape 1/23 · Écouter le morceau');
  await page.locator('#pz-act button[data-pa="model"]').click();
  // @ts-ignore
  expect(await page.evaluate(() => [!!BUS, WK.range, WK.hands])).toEqual([true, [0, 15], 'both']);
  await page.locator('#pz-act button[data-pa="ok"]').click();
  await expect(page.locator('#pz-step')).toHaveText('Étape 2/23 · Section 1 · lire les mesures 1 à 4');
  await expect(page.locator('#pz-tag')).toHaveText('1/23 étapes');
  // @ts-ignore
  await page.evaluate(() => { const c = S.coach.hymne; c.d = { 0: 1, 1: 1, 2: 1 }; renderPz(); });   // trois mesures déjà lues
  await expect(page.locator('#pz-act button[data-pa="go"]')).toHaveText('Déchiffrer la mesure 4');
  await page.locator('#pz-act button[data-pa="go"]').click();
  await expect(page.locator('#dc-live')).toBeVisible();
  await expect(page.locator('#dc-pos')).toHaveText('Mesure 4/16');
  await lire(page);
  await expect(page.locator('#dc-fb')).toHaveText('Section 1 lue sans erreur ✓ Retour au parcours pour l’étape suivante.');
  await expect(page.locator('#pz-step')).toHaveText('Étape 3/23 · Section 1 · main droite, mesures 1 à 4');
  await expect(page.locator('#pz-map .pz-pill.done')).toHaveCount(2);
  await expect(page.locator('#pz-map .pz-pill.cur')).toHaveText('M. droite');
  // découpage : 17 mesures → la dernière section absorbe la mesure isolée ; exercice main gauche seule → pas de main droite ni d'« ensemble »
  // @ts-ignore
  const r = await page.evaluate(() => [pzSecs(17), pzSecs(16).length, pzSecs(3), [...new Set(pzSteps('ex1').map(x => x.k))]]);
  expect(r).toEqual([[[0, 3], [4, 7], [8, 11], [12, 16]], 4, [[0, 2]], ['ecoute', 'lire', 'lh', 'entier', 'tempo', 'final']]);
});

test('Z2. main droite au micro : les 4 mesures propres → section acquise, l’écoute s’arrête, étape suivante ; sinon, ce qu’il reste', async ({ page }) => {
  await page.goto('./#coach');
  await page.evaluate(() => { /* @ts-ignore */ window.__fakeMic(); const c = S.coach.hymne = { b: {}, c: {}, d: { 0: 1, 1: 1, 2: 1, 3: 1 }, f: { ecoute: 1 } }; renderPz(); });
  await expect(page.locator('#pz-step')).toContainText('Section 1 · main droite');
  await page.locator('#pz-act button[data-pa="go"]').click();
  await expect(page.locator('#ec-go')).toHaveText('Arrêter l’écoute');
  await expect(page.locator('#wk-hands button.on')).toHaveText('Main droite');
  await jouer(page);
  await expect(page.locator('#ec-fb')).toHaveText('Section 1, main droite : acquise ✓ Retour au parcours pour l’étape suivante.');
  await expect(page.locator('#ec-go')).toHaveText('Écoute-moi');                     // on ne déborde pas sur la section 2
  await expect(page.locator('#wk-pos')).toHaveText('Mesure 4/16');
  // @ts-ignore
  expect(await page.evaluate(() => S.coach.hymne.h)).toEqual({ rh: { 0: 1, 1: 1, 2: 1, 3: 1 } });
  await expect(page.locator('#pz-step')).toHaveText('Étape 4/23 · Section 1 · main gauche, mesures 1 à 4');
  // main gauche : une mesure reste fautive (sans « rejouer ») → arrêt en fin de section avec ce qu'il reste
  await page.locator('#co-redo').uncheck();
  await page.locator('#pz-act button[data-pa="go"]').click();
  await expect(page.locator('#ec-go')).toHaveText('Arrêter l’écoute');
  // @ts-ignore
  await page.evaluate(() => { clearInterval(EC.iv); window.__play([48, 55]); for (let i = 0; i < 4; i++) ecFeed(new Float32Array(4096), 48000); });   // Do + Sol sans Mi : une faute
  await jouer(page);
  await expect(page.locator('#ec-fb')).toHaveText('Section 1, main gauche : il reste à réussir mesure 1. Reprends-la, ou valide l’étape toi-même si le micro ne t’entend pas.');
  await expect(page.locator('#pz-act button[data-pa="go"]')).toHaveText('Jouer au micro · mesure 1');
  await page.locator('#pz-act button[data-pa="self"]').click();                      // le micro n'entend pas : je valide moi-même
  await expect(page.locator('#dlg-t')).toContainText('Valider « Section 1 · main gauche, mesures 1 à 4 » toi-même');
  await page.locator('#dlg-ok').click();
  await expect(page.locator('#pz-step')).toHaveText('Étape 5/23 · Section 1 · mains ensemble, mesures 1 à 4');
});

test('Z3. mains ensemble : trois fois propre d’affilée (« Raté » remet à zéro) ; modèle du passage ; revenir à une étape par la carte', async ({ page }) => {
  await page.goto('./#coach');
  // @ts-ignore
  await page.evaluate(() => { S.coach.hymne = { b: {}, c: {}, d: { 0: 1, 1: 1, 2: 1, 3: 1 }, h: { rh: { 0: 1, 1: 1, 2: 1, 3: 1 }, lh: { 0: 1, 1: 1, 2: 1, 3: 1 } }, f: { ecoute: 1 } }; renderPz(); });
  await expect(page.locator('#pz-step')).toContainText('Section 1 · mains ensemble');
  await page.locator('#pz-act button[data-pa="model"]').click();
  // @ts-ignore
  expect(await page.evaluate(() => [!!BUS, WK.range])).toEqual([true, [0, 3]]);
  const ok = page.locator('#pz-act button[data-pa="ok"]');
  await ok.click(); await ok.click();
  await expect(page.locator('#pz-act .n')).toHaveText('2/3');
  await page.locator('#pz-act button[data-pa="ko"]').click();
  await expect(page.locator('#pz-act .n')).toHaveText('0/3');
  await expect(page.locator('#pz-fb')).toContainText('reprends plus lentement');
  await ok.click(); await ok.click(); await ok.click();
  await expect(page.locator('#pz-step')).toHaveText('Étape 6/23 · Section 2 · lire les mesures 5 à 8');
  // @ts-ignore
  expect(await page.evaluate(() => S.coach.hymne.e)).toEqual({ 0: 1 });
  await page.locator('#pz-map-box summary').click();
  await expect(page.locator('#pz-map .pz-row')).toHaveCount(6);                     // début, 4 sections, fin
  await page.locator('#pz-map .pz-pill', { hasText: 'Enchaîner' }).first().click();
  await expect(page.locator('#pz-step')).toContainText('Enchaîner les sections 1 et 2');
  await expect(page.locator('#pz-how')).toContainText('mesures 1 à 8');
  await page.reload();
  await expect(page.locator('#pz-tag')).toHaveText('5/23 étapes');                   // gardé
});

test('Z4. jusqu’au bout : morceau terminé ; données nettoyées, exportées et fusionnées à l’import ; le lecteur normal ne garde pas le passage', async ({ page }) => {
  await page.goto('./#coach');
  // @ts-ignore
  await page.evaluate(() => { const st = pzSteps('hymne'); st.slice(0, -1).forEach(x => { PZ.sel = null; pzMark(x); }); });
  await expect(page.locator('#pz-step')).toHaveText('Étape 23/23 · T’enregistrer');
  await page.locator('#pz-act button[data-pa="ok"]').click();
  await expect(page.locator('#pz-step')).toHaveText('Morceau terminé 🎉');
  await expect(page.locator('#pz-tag')).toHaveText('23/23 étapes');
  // @ts-ignore
  expect(await page.evaluate(() => S.rep.hymne.stage)).toBe(5);
  // @ts-ignore
  const c = await page.evaluate(() => cleanCoach({ hymne: { b: {}, c: {}, h: { rh: { 0: 1, x: 1, 2: 'oui' }, zz: { 0: 1 } }, e: { 0: 1, 999: 1 }, l: { 1: 1 }, f: { ecoute: 1, pirate: 1 } } }));
  expect(c).toEqual({ hymne: { b: {}, c: {}, h: { rh: { 0: 1 } }, e: { 0: 1 }, l: { 1: 1 }, f: { ecoute: 1 } } });
  await page.goto('./#journal');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#bk-export').click()]);
  const buf = require('fs').readFileSync(await dl.path());
  expect(JSON.parse(buf.toString()).data.coach.hymne.f).toEqual({ ecoute: 1, entier: 1, tempo: 1, final: 1 });
  // sur un autre appareil où une étape différente est déjà faite : les deux sont gardées
  // @ts-ignore
  await page.evaluate(() => { S.coach = { hymne: { b: {}, c: {}, h: { lh: { 9: 1 } }, e: { 3: 1 } } }; saveLocal(); });
  await page.locator('#bk-file').setInputFiles({ name: 'la-vestale-sauvegarde.json', mimeType: 'application/json', buffer: buf });
  await page.locator('#dlg-ok').click();
  await expect(page.locator('.toast', { hasText: 'Import réussi' })).toBeVisible();
  // @ts-ignore
  await expect.poll(() => page.evaluate(() => [S.coach.hymne.h.lh[9], S.coach.hymne.h.rh[0], Object.keys(S.coach.hymne.e).length, S.coach.hymne.f.final])).toEqual([1, 1, 4, 1]);
  await page.goto('./#seance');
  await page.locator('#wk-play').click();
  // @ts-ignore
  expect(await page.evaluate(() => WK.range)).toBeNull();                           // « Écouter » de Séance joue la mesure, pas un passage
});

test.describe('sur iPhone', () => {
  test.use({ viewport: { width: 414, height: 896 }, hasTouch: true });
test('Z5. la carte du parcours tient dans l’écran, boutons de 44 px, rien ne déborde (Clair de lune : 18 sections)', async ({ page }) => {
  await page.goto('./#coach');
  await page.locator('#dc-piece').selectOption('clairlune');
  await expect(page.locator('#pz-tag')).toHaveText(/^0\/\d+ étapes$/);
  await page.locator('#pz-map-box summary').tap();
  const r = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth, rows: document.querySelectorAll('#pz-map .pz-row').length,
    small: [...document.querySelectorAll('#pz-card button, #pz-card select')].filter(e => /** @type {HTMLElement} */ (e).offsetParent !== null && e.getBoundingClientRect().height < 44).length }));
  expect(r).toEqual({ scroll: 0, rows: 20, small: 0 });
});
});
