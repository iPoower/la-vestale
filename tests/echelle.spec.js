// @ts-check
// Échelle de tempo dans Jouer (3 propres → +4 proposé, 3 ratés → −4 proposé, bornes 40 et tempo cible), raccourcis clavier
// et pédale (focus, appui maintenu, anti-rebond), bouton « Reprendre », et micro : Fa au lieu de Fa♯ dans l'accord de D.
const { test, expect } = require('@playwright/test');

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

const ouvrir = async (page, id, bpm) => {
  await page.goto('./#coach');
  await page.locator('#dc-piece').selectOption(id);
  // @ts-ignore
  await page.evaluate(b => { wkSetBpm(b); wkLadReset(); renderWork(); }, bpm);
};

test('EC1. montée : 3 propres → « Passer à 54 ? », Propre = oui ; plafond au tempo cible (80), plus rien au-delà', async ({ page }) => {
  await ouvrir(page, 'q4sol', 50);
  for (let i = 0; i < 3; i++) await page.locator('#wk-ok').click();
  await expect(page.locator('#wk-lad')).toBeVisible();
  await expect(page.locator('#wk-lad-yes')).toHaveText('Oui, noire = 54');
  await page.locator('#wk-ok').click();                                         // même geste : oui
  await expect(page.locator('#wk-bpm')).toHaveValue('54');
  await expect(page.locator('#wk-lad')).toBeHidden();
  await expect(page.locator('#wk-dots i.on')).toHaveCount(0);
  // @ts-ignore
  expect(await page.evaluate(() => S.coach.q4sol.bpm)).toBe(50);                 // dernier tempo propre retenu
  // @ts-ignore
  await page.evaluate(() => { wkSetBpm(78); wkLadReset(); renderWork(); });
  for (let i = 0; i < 3; i++) await page.locator('#wk-ok').click();
  await expect(page.locator('#wk-lad-yes')).toHaveText('Oui, noire = 80');       // 78 + 4 plafonné à 80
  await page.locator('#wk-lad-yes').click();
  for (let i = 0; i < 3; i++) await page.locator('#wk-ok').click();
  await expect(page.locator('#wk-lad')).toBeHidden();                            // à la cible : plus de proposition
  await expect(page.locator('#wk-msg')).toContainText('tempo cible (80)');
});

test('EC2. descente : 3 ratés → « Redescendre à 50 ? » ; Raté = non ; jamais sous 40 ; changer le tempo à la main remet tout à zéro', async ({ page }) => {
  await ouvrir(page, 'q4sol', 54);
  for (let i = 0; i < 3; i++) await page.locator('#wk-ko').click();
  await expect(page.locator('#wk-msg')).toContainText('Redescendre à 50 ?');
  await page.locator('#wk-ko').click();                                         // non
  await expect(page.locator('#wk-bpm')).toHaveValue('54');
  await expect(page.locator('#wk-lad')).toBeHidden();
  for (let i = 0; i < 3; i++) await page.locator('#wk-ko').click();
  await page.locator('#wk-lad-yes').click();
  await expect(page.locator('#wk-bpm')).toHaveValue('50');
  // @ts-ignore
  await page.evaluate(() => { wkSetBpm(40); wkLadReset(); renderWork(); });
  for (let i = 0; i < 3; i++) await page.locator('#wk-ko').click();
  await expect(page.locator('#wk-lad')).toBeHidden();                            // plancher 40
  await page.locator('#wk-ok').click(); await page.locator('#wk-ok').click();
  await page.locator('#wk-bpm').fill('60');                                       // réglage manuel
  await expect(page.locator('#wk-dots i.on')).toHaveCount(0);
  // @ts-ignore
  expect(await page.evaluate(() => [WK.okRun, WK.koRun, WK.prop])).toEqual([0, 0, null]);
});

test('EC3. raccourcis : Espace/→/↓/Page suivante = Propre, ←/↑/Page précédente = Raté ; appui maintenu et rebond ignorés ; rien dans une liste ; le curseur ne bouge pas', async ({ page }) => {
  await ouvrir(page, 'q4sol', 50);
  const press = async (key, opts = {}) => { await page.keyboard.press(key, opts); await page.waitForTimeout(400); };
  await press('Space'); await expect(page.locator('#wk-dots i.on')).toHaveCount(1);
  await press('ArrowLeft'); await expect(page.locator('#wk-dots i.on')).toHaveCount(0);
  await press('PageDown'); await press('ArrowDown'); await expect(page.locator('#wk-dots i.on')).toHaveCount(2);
  await press('PageUp'); await expect(page.locator('#wk-dots i.on')).toHaveCount(0);
  // rebond : deux appuis à 50 ms → un seul compté
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(50); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(400);
  await expect(page.locator('#wk-dots i.on')).toHaveCount(1);
  // appui maintenu : événements répétés ignorés
  // @ts-ignore
  await page.evaluate(() => { for (let i = 0; i < 5; i++) dispatchEvent(new KeyboardEvent('keydown', { key: ' ', repeat: true, cancelable: true })); });
  await expect(page.locator('#wk-dots i.on')).toHaveCount(1);
  // le curseur de tempo a le focus : → valide « Propre » sans changer le tempo
  await page.locator('#wk-bpm').focus();
  await press('ArrowRight');
  await expect(page.locator('#wk-bpm')).toHaveValue('50');
  await expect(page.locator('#wk-dots i.on')).toHaveCount(2);
  // dans la liste des morceaux, les flèches restent à la liste
  await page.locator('#dc-piece').focus();
  // @ts-ignore
  const before = await page.evaluate(() => WK.okRun);
  // @ts-ignore
  await page.evaluate(() => { const e = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true }); dispatchEvent(e); window.__pd = e.defaultPrevented; });
  // @ts-ignore
  expect(await page.evaluate(() => [WK.okRun, window.__pd])).toEqual([before, false]);
});

test('EC4. « Reprendre » : 4 accords en Sol à 50 sans historique ; sinon la révision due ou le dernier morceau, à son dernier tempo propre', async ({ page }) => {
  await page.goto('./#seance');
  await expect(page.locator('#go-resume')).toHaveText('↻ Reprendre : Les 4 accords en Sol (vi IV I V) · mesure 1 · noire = 50');
  await page.locator('#go-resume').click();
  await expect(page.locator('#v-coach')).toBeVisible();
  // @ts-ignore
  await expect.poll(() => page.evaluate(() => [WK.id, WK.bar, +$('#wk-bpm').value])).toEqual(['q4sol', 0, 50]);
  // @ts-ignore
  await page.evaluate(() => { S.coach = { cancan: { b: {}, c: {}, t: Date.now(), bpm: 62 } }; S.rep.cancan = { stage: 1, m: 6 }; saveLocal(); });
  await page.goto('./#seance');
  await expect(page.locator('#go-resume')).toHaveText('↻ Reprendre : Cancan (travail préparatoire) · mesure 7 · noire = 62');
  // @ts-ignore
  await page.evaluate(() => { S.coach.hymne = { b: {}, c: {}, t: 1, r: { 3: [1, dayN() - 1, dayN() - 2] } }; saveLocal(); renderToday(); });
  await expect(page.locator('#go-resume')).toContainText('révision du jour');
  await expect(page.locator('#go-resume')).toContainText('Hymne à la joie · mesure 4');
});

/** Fait jouer au micro simulé l'accord attendu, ou une variante. */
const accord = (page, f) => page.evaluate(src => { /* @ts-ignore */ clearInterval(EC.iv);
  // @ts-ignore
  const x = EC.seq[EC.i]; const ms = eval(src)(x.ms); ecFeed(new Float32Array(4096), 48000); window.__play(ms); return x.ms; }, f.toString());

test('EC5. micro, piano simulé : l’accord de D juste passe ; avec Fa au lieu de Fa♯, il est refusé, même juste après Sol', async ({ page }) => {
  await page.goto('./#coach');
  await page.evaluate(() => { /* @ts-ignore */ window.__fakeMic(); });
  await page.locator('#dc-piece').selectOption('q4sol');
  // @ts-ignore
  await page.evaluate(() => { WK.hands = 'both'; wkGo(1); });                   // mesure 2 : G puis D
  await page.locator('#ec-go').click();
  await expect(page.locator('#ec-go')).toHaveText('Arrêter l’écoute');
  // @ts-ignore
  expect(await page.evaluate(() => EC.seq.map(x => x.ms.slice().sort((a, b) => a - b).join('.')))).toEqual(['59.62.67', '57.62.66']);                                                   // le micro écoute une main à la fois : ici la main droite
  await accord(page, ms => ms);                                                    // G juste
  // @ts-ignore
  await expect.poll(() => page.evaluate(() => EC.i)).toBe(1);
  // D avec Fa naturel, joué aussitôt après Sol (résonance de Sol encore là)
  // @ts-ignore
  const avant = await page.evaluate(() => EC.bErr);
  await page.evaluate(() => { /* @ts-ignore */ const g = window.__piano; const sum = new Float32Array(16384);
    for (const t0 of [0.02, 0.09, 0.16, 0.23, 0.30]) { sum.fill(0);
      // @ts-ignore
      for (const m of [57, 62, 65]) g(m, { t0, n: 16384 }).forEach((v, i) => { sum[i] += v; });
      // @ts-ignore
      for (const m of [59, 62, 67]) g(m, { t0: t0 + 0.6, n: 16384, level: 0.06 }).forEach((v, i) => { sum[i] += v; });
      // @ts-ignore
      ecFeed(sum.subarray(16384 - 4096), 48000, sum); } });
  // @ts-ignore
  expect(await page.evaluate(() => EC.i)).toBe(1);                                // pas accepté
  // @ts-ignore
  expect(await page.evaluate(() => EC.bErr)).toBeGreaterThan(avant);              // compté comme faute
  await accord(page, ms => ms);                                                    // D juste (avec Fa♯)
  // @ts-ignore
  await expect(page.locator('#ec-fb')).toContainText('Mesure 2 : 1 faute. On la rejoue');   // la faute est comptée : la mesure se rejoue
  // @ts-ignore
  expect(await page.evaluate(() => [WK.bar, EC.i])).toEqual([1, 0]);
});
