// @ts-check
// « Depuis le début » : les mesures déjà vues restent sur la portée, « Écouter » les joue d'un coup,
// et le micro peut les faire rejouer d'affilée (pas d'arrêt sur une faute, bilan à la fin).
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

/** Joue au micro simulé ce que l'app demande, tant qu'elle écoute (silence entre deux notes : la touche est relâchée). */
const jouer = (page, max = 60) => page.evaluate(n => { /* @ts-ignore */ clearInterval(EC.iv);
  // @ts-ignore
  for (let k = 0; k < n && EC.on; k++) { const x = EC.seq[EC.i]; if (!x) break; ecFeed(new Float32Array(4096), 48000); window.__play(x.ms); } }, max);

test('DB1. « Depuis le début » : mesures 1 à 3 au-dessus de la 4, écoute 1 → 4 ; le choix est gardé', async ({ page }, info) => {
  await page.setViewportSize({ width: 414, height: 896 });
  await page.goto('./#coach');
  await expect(page.locator('#wk-hist')).toBeHidden();
  await page.locator('#wk-span button[data-n="0"]').click();
  await expect(page.locator('#wk-thru-row')).toBeVisible();
  await expect(page.locator('#wk-thru')).toBeHidden();                            // mesure 1 : rien avant
  for (let i = 0; i < 3; i++) await page.locator('#wk-next').click();
  await expect(page.locator('#wk-pos')).toHaveText('Mesure 4/16');
  await expect(page.locator('#wk-hist')).toBeVisible();
  await expect(page.locator('#wk-hist-t')).toHaveText('Déjà vues : mesures 1 à 3. En dessous, la mesure 4.');
  await expect(page.locator('#wk-hist-g svg')).toHaveCount(3);
  await expect(page.locator('#wk-hist-g figcaption')).toHaveText(['Mesure 1', 'Mesure 2', 'Mesure 3']);
  for (let i = 0; i < 3; i++) expect(await page.locator('#wk-hist-g svg').nth(i).locator('ellipse, path, text').count()).toBeGreaterThan(5);   // chaque mesure est dessinée
  await expect(page.locator('#wk-play')).toHaveText('Écouter 1 → 4');
  await expect(page.locator('#wk-thru')).toHaveText('🎤 Rejouer 1 → 4 au micro');
  const box = await page.locator('#wk-hist').boundingBox();
  expect(box && box.width).toBeLessThanOrEqual(414);                              // pas de débordement sur iPhone
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(414);
  await page.locator('#wk-hist').scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('depuis-le-debut.png') });
  // @ts-ignore
  expect(await page.evaluate(() => wkSeg().length)).toBe(4);
  await page.locator('#wk-play').click();
  // @ts-ignore
  expect(await page.evaluate(() => !!BUS)).toBe(true);
  await page.locator('#wk-stop').click();
  // le déchiffrage écoute la seule mesure lue, même en « Depuis le début »
  // (le bouton s'affiche après la lecture : on appelle son action)
  await page.evaluate(() => { /* @ts-ignore */ document.getElementById('dc-listen').click(); });
  // @ts-ignore
  expect(await page.evaluate(() => [WK.range, wkSeg().length])).toEqual([[3, 3], 1]);
  await page.locator('#wk-stop').click();
  await page.locator('#wk-next').click();
  // @ts-ignore
  expect(await page.evaluate(() => [WK.range, wkSeg().length])).toEqual([null, 5]);   // changer de mesure efface la plage
  await page.locator('#wk-prev').click();
  await page.reload();
  await expect(page.locator('#wk-span button.on')).toHaveText('Depuis le début');  // gardé d'une séance à l'autre
  await expect(page.locator('#wk-hist-g svg')).toHaveCount(3);
  await page.locator('#wk-span button[data-n="1"]').click();
  await expect(page.locator('#wk-hist')).toBeHidden();
  await expect(page.locator('#wk-thru-row')).toBeHidden();
  await expect(page.locator('#wk-play')).toHaveText('Écouter la mesure');
  // @ts-ignore
  expect(await page.evaluate(() => wkSeg().length)).toBe(1);
});

test('DB2. rejouer 1 → 4 au micro, sans faute : on repart de la mesure 1, bilan, puis mesure 5', async ({ page }) => {
  await page.goto('./#coach');
  await page.evaluate(() => { /* @ts-ignore */ window.__fakeMic(); });
  await page.locator('#dc-hands button[data-h="rh"]').click();
  await page.locator('#wk-span button[data-n="0"]').click();
  // @ts-ignore
  await page.evaluate(() => wkGo(3));
  await page.locator('#wk-thru').click();
  await expect(page.locator('#ec-go')).toHaveText('Arrêter l’écoute');
  await expect(page.locator('#wk-pos')).toHaveText('Mesure 1/16');
  await jouer(page);
  await expect(page.locator('#ec-fb')).toHaveText('Mesures 1 à 4 d’un coup, toutes propres. Bravo ! Passe à la mesure 5.');
  await expect(page.locator('#ec-go')).toHaveText('Écoute-moi');                  // l'écoute s'arrête à la mesure 4
  await expect(page.locator('#wk-pos')).toHaveText('Mesure 5/16');
  await expect(page.locator('#wk-play')).toHaveText('Écouter 1 → 5');
  // @ts-ignore
  expect(await page.evaluate(() => WK.thru)).toBe(null);
});

test('DB3. une faute à la mesure 2 : on ne s’arrête pas, bilan « À reprendre : mesure 2 », on reste à la 4', async ({ page }) => {
  await page.goto('./#coach');
  await page.evaluate(() => { /* @ts-ignore */ window.__fakeMic(); });
  await page.locator('#dc-hands button[data-h="rh"]').click();
  await expect(page.locator('#co-redo')).toBeChecked();                           // le Coach rejouerait la mesure… pas ici
  await page.locator('#wk-span button[data-n="0"]').click();
  // @ts-ignore
  await page.evaluate(() => wkGo(3));
  await page.locator('#wk-thru').click();
  await expect(page.locator('#ec-go')).toHaveText('Arrêter l’écoute');
  await page.evaluate(() => { /* @ts-ignore */ clearInterval(EC.iv); let bad = true;
    // @ts-ignore
    for (let k = 0; k < 80 && EC.on; k++) { const x = EC.seq[EC.i]; if (!x) break; ecFeed(new Float32Array(4096), 48000);
      // @ts-ignore
      if (bad && WK.bar === 1) { bad = false; window.__play(x.ms[0] + 2); ecFeed(new Float32Array(4096), 48000); }
      // @ts-ignore
      window.__play(x.ms); } });
  await expect(page.locator('#ec-fb')).toHaveText('Mesures 1 à 4 d’un coup : 3 propres sur 4. À reprendre : mesure 2.');
  await expect(page.locator('#wk-pos')).toHaveText('Mesure 4/16');
  // « Écoute-moi » ensuite : écoute normale, pas un nouveau passage
  // @ts-ignore
  expect(await page.evaluate(() => WK.thru)).toBe(null);
});
