// @ts-check
// Séance › Travailler un morceau : mesure par mesure, main droite et main gauche.
const { test, expect } = require('@playwright/test');

const LS = 'vestale-studio-v1';
/** Touches allumées : { nom: doigt } pour une classe donnée (hl = main droite, hl2 = main gauche). */
const keys = (page, cls) => page.$$eval(`#kb-wk .key.${cls}`, ks => Object.fromEntries(ks.map(k => [k.getAttribute('aria-label'), (k.querySelector('.fg') || {}).textContent || ''])));

test('T1. données : chaque mesure fait juste 4 temps aux deux mains, nombre de mesures attendu', async ({ page }) => {
  await page.goto('./#seance');
  // @ts-ignore
  const r = await page.evaluate(() => Object.fromEntries(Object.keys(WORK).map(id => {
    // @ts-ignore
    const bars = workBars(id), bpb = WORK[id].bpb, sum = evs => evs.reduce((a, e) => a + e[1], 0);
    // @ts-ignore
    const pk = WORK[id].pickup || 0, len = i => (i === 0 && pk ? pk : bpb);
    return [id, { n: bars.length, ok: bars.every((b, i) => Math.abs(sum(b.rh) - len(i)) < 1e-9 && Math.abs(sum(b.lh) - len(i)) < 1e-9) }];
  })));
  expect(r).toEqual({ hymne: { n: 16, ok: true }, fontaine: { n: 12, ok: true }, tabac: { n: 24, ok: true }, clair: { n: 16, ok: true }, frere: { n: 8, ok: true }, bach120: { n: 29, ok: true }, alkan8: { n: 45, ok: true } });
});

test('T2. Hymne, mesure 1 : notes et doigts des deux mains sur le clavier', async ({ page }) => {
  await page.goto('./#seance');
  await expect(page.locator('#wk-pos')).toHaveText('Mesure 1/16');
  expect(await keys(page, 'hl')).toEqual({ Mi5: '3', Fa5: '', Sol5: '5' });      // octave du Do5, comme sur la feuille
  expect(await keys(page, 'hl2')).toEqual({ Do3: '5', Mi3: '3', Sol3: '1' });
  await expect(page.locator('#wk-info')).toContainText('Main droite');
  await expect(page.locator('#wk-info')).toContainText('accord C : Do3 + Mi3 + Sol3 · doigts 5-3-1 (ronde)');
  await expect(page.locator('#wk-prev')).toBeDisabled();
});

test('T3. navigation : mesure 12 de l’Hymne (D puis G7), dernière mesure, boutons bornés', async ({ page }) => {
  await page.goto('./#seance');
  for (let i = 0; i < 11; i++) await page.locator('#wk-next').click();
  await expect(page.locator('#wk-pos')).toHaveText('Mesure 12/16');
  expect(await keys(page, 'hl2')).toEqual({ Si2: '5', 'Ré3': '4', Fa3: '2', 'Fa♯3': '2', Sol3: '1' });
  expect(await keys(page, 'hl')).toEqual({ Do5: '1', 'Ré5': '2', Sol4: '1' });    // pouce qui redescend sur Sol4
  await expect(page.locator('#wk-info')).toContainText('D (Ré–Fa♯) : Ré3 + Fa♯3 · doigts 4-2 (blanche)');
  for (let i = 0; i < 4; i++) await page.locator('#wk-next').click();
  await expect(page.locator('#wk-pos')).toHaveText('Mesure 16/16');
  await expect(page.locator('#wk-next')).toBeDisabled();
});

test('T4. mains séparées : seule la main choisie s’allume et s’affiche', async ({ page }) => {
  await page.goto('./#seance');
  await page.locator('#wk-hands button[data-h="lh"]').click();
  expect(Object.keys(await keys(page, 'hl'))).toEqual([]);
  expect(Object.keys(await keys(page, 'hl2')).length).toBe(3);
  await expect(page.locator('#wk-info')).not.toContainText('Main droite');
  await page.locator('#wk-hands button[data-h="rh"]').click();
  expect(Object.keys(await keys(page, 'hl2'))).toEqual([]);
  await expect(page.locator('#wk-info')).not.toContainText('Main gauche');
});

test('T5. l’app retient la dernière mesure de chaque morceau', async ({ page }) => {
  await page.goto('./#seance');
  for (let i = 0; i < 4; i++) await page.locator('#wk-next').click();
  await page.locator('#wk-piece').selectOption('tabac');
  await expect(page.locator('#wk-pos')).toHaveText('Mesure 1/24');
  for (let i = 0; i < 11; i++) await page.locator('#wk-next').click();
  await page.reload();
  await expect(page.locator('#wk-pos')).toHaveText('Mesure 5/16');      // Hymne rouvert à la mesure où je m'étais arrêté
  await page.locator('#wk-piece').selectOption('tabac');
  await expect(page.locator('#wk-pos')).toHaveText('Mesure 12/24');
  expect(await keys(page, 'hl')).toEqual({ 'Ré5': '2' });
  expect(await keys(page, 'hl2')).toEqual({ Si2: '5', Sol3: '1' });
  await expect(page.locator('#wk-info')).toContainText('silence (noire)');
  const rep = await page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null').rep, LS);
  expect([rep.hymne.m, rep.tabac.m]).toEqual([4, 11]);
});

test('T6. écouter la mesure, en boucle : le son revient au tour suivant', async ({ page }) => {
  await page.goto('./#seance');
  await page.locator('#wk-bpm').fill('100');                              // mesure de 2,4 s
  await page.locator('#wk-loop').check();
  await page.locator('#wk-play').click();
  const level = () => page.evaluate(async () => {
    // @ts-ignore
    if (window.__ctx !== AC) { window.__ctx = AC; window.__an = AC.createAnalyser(); MASTER.connect(window.__an); }
    // @ts-ignore
    const an = window.__an, buf = new Float32Array(2048); let max = 0;
    for (let i = 0; i < 10; i++) { an.getFloatTimeDomainData(buf); let s = 0; for (const v of buf) s += v * v; max = Math.max(max, Math.sqrt(s / buf.length)); await new Promise(r => setTimeout(r, 40)); }
    return max;
  });
  await page.waitForTimeout(150);
  expect(await level()).toBeGreaterThan(0.02);
  await page.waitForTimeout(2500);                                          // 2e tour de boucle
  expect(await level()).toBeGreaterThan(0.02);
  await expect(page.locator('#kb-wk .key.next')).not.toHaveCount(0);
  await page.locator('#wk-stop').click();
  await expect(page.locator('#kb-wk .key.next')).toHaveCount(0);
});

test('T7. trois fois « Propre » : conseil d’enchaîner ; « Raté » remet à zéro', async ({ page }) => {
  await page.goto('./#seance');
  for (let i = 1; i <= 2; i++) { await page.locator('#wk-ok').click(); await expect(page.locator('#wk-msg')).toHaveText(`${i}/3 fois propre.`); }
  await page.locator('#wk-ok').click();
  await expect(page.locator('#wk-msg')).toContainText('passe à la mesure suivante');
  await expect(page.locator('#wk-dots i.on')).toHaveCount(3);
  await page.locator('#wk-ko').click();
  await expect(page.locator('#wk-dots i.on')).toHaveCount(0);
});

test('T8. depuis le répertoire, « Mesure par mesure » ouvre le bon morceau dans Séance', async ({ page }) => {
  await page.goto('./#morceaux');
  await expect(page.locator('article.piece', { hasText: 'Le Petit Poney' }).locator('button[data-act="wk"]')).toHaveCount(0);
  await page.locator('article.piece', { hasText: 'À la claire fontaine' }).locator('button[data-act="wk"]').click();
  await expect(page.locator('#v-seance')).toBeVisible();
  await expect(page.locator('#wk-piece')).toHaveValue('fontaine');
  await expect(page.locator('#wk-pos')).toHaveText('Mesure 1/12');
  expect(await keys(page, 'hl')).toEqual({ Sol4: '1', Si4: '' });
  expect(await keys(page, 'hl2')).toEqual({ Sol3: '2' });
  await expect.poll(async () => { const b = await page.locator('#wk-card h2').boundingBox(); return !!b && b.y > 0 && b.y < 844; }).toBe(true);
});

test('T9. Odysseus : au répertoire, métronome à 3/4 et accord Cm, sans notes du morceau', async ({ page }) => {
  await page.goto('./#morceaux');
  const card = page.locator('article.piece', { hasText: 'Odysseus' });
  await expect(card).toContainText('Ludwig Göransson');
  await expect(card).toContainText('cible 81');
  await expect(card.locator('button[data-act="mel"], button[data-act="wk"]')).toHaveCount(0);
  await card.locator('button[data-act="metro"]').click();
  await expect(page.locator('#mt-beats button.on')).toHaveText('3/4');
  await page.goto('./#clavier');
  await page.locator('#chord-chips .chip[data-c="Cm"]').click();
  await expect(page.locator('#chord-info')).toContainText('Do – Mi♭ – Sol');
  await page.goto('./#journal');
  await expect(page.locator('#q-list')).toContainText('Odysseus');
});

test('T10. les deux mains ne jouent jamais la même touche en même temps', async ({ page }) => {
  await page.goto('./#seance');
  // @ts-ignore
  const clashes = await page.evaluate(() => Object.keys(WORK).flatMap(id => workBars(id).flatMap((b, i) => {
    const spans = hand => { let t = 0; return b[hand].flatMap(e => { const s = t; t += e[1]; return e[0] ? e[0].map(m => [m, s, t]) : []; }); };
    const r = spans('rh'), l = spans('lh');
    return r.flatMap(([m, a, z]) => l.filter(([n, c, d]) => n === m && a < d && c < z).map(() => `${id} mesure ${i + 1} note ${m}`));
  })));
  expect(clashes).toEqual([]);
});
