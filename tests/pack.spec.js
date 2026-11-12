// @ts-check
// Pack libre de droits : chansons traditionnelles, Bach (domaine public), Alkan (Mutopia, CC BY-SA), chemin vers Alkan.
const { test, expect } = require('@playwright/test');

/** Notes de la main droite d'une mesure (1 = première), en hauteurs MIDI. */
// @ts-ignore
const rhNotes = (page, id, bar) => page.evaluate(([id, bar]) => workBars(id)[bar - 1].rh.map(e => e[0] ? e[0][0] : null), [id, bar]);

test('K1. Au clair de la lune : phrase en Do, pont qui descend (Ré Ré Ré Ré, La La, Ré Do Si La, Sol)', async ({ page }) => {
  await page.goto('./#seance');
  expect(await rhNotes(page, 'clair', 1)).toEqual([60, 60, 60, 62]);
  expect(await rhNotes(page, 'clair', 2)).toEqual([64, 62]);
  expect(await rhNotes(page, 'clair', 9)).toEqual([62, 62, 62, 62]);
  expect(await rhNotes(page, 'clair', 10)).toEqual([57, 57]);            // La3, sous le Ré
  expect(await rhNotes(page, 'clair', 11)).toEqual([62, 60, 59, 57]);
  expect(await rhNotes(page, 'clair', 12)).toEqual([55]);                // Sol3, ronde
  expect(await rhNotes(page, 'clair', 16)).toEqual([60]);
});

test('K2. Frère Jacques : croches de la mesure 5, bourdon Do–Sol à la main gauche', async ({ page }) => {
  await page.goto('./#seance');
  // @ts-ignore
  const m5 = await page.evaluate(() => workBars('frere')[4].rh.map(e => [e[0][0], e[1]]));
  expect(m5).toEqual([[67, .5], [69, .5], [67, .5], [65, .5], [64, 1], [60, 1]]);
  await page.locator('#wk-piece').selectOption('frere');
  await expect(page.locator('#wk-info')).toContainText('bourdon Do–Sol : Do3 + Sol3');
});

test('K3. Menuet de Bach : levée d’un temps, 28 mesures ensuite, notes tenues non rejouées', async ({ page }) => {
  await page.goto('./#seance');
  // @ts-ignore
  const r = await page.evaluate(() => { const b = workBars('bach120'); return { n: b.length, levee: b[0].rh.map(e => e[0] && e[0][0]), m4: b[3].rh[0] }; });
  expect(r.n).toBe(29);
  expect(r.levee).toEqual([64]);                                         // Mi4 en levée
  expect(r.m4[4]).toEqual([0]);                                          // Mi5 lié depuis la mesure 3 : pas de nouvelle attaque
});

test('K4. Alkan : 45 mesures, noms en bémols (Mi♭ mineur), main gauche tout en bas du piano', async ({ page }) => {
  await page.goto('./#seance');
  await page.locator('#wk-piece').selectOption('alkan8');
  await expect(page.locator('#wk-pos')).toHaveText('Mesure 1/45');
  await expect(page.locator('#wk-info')).toContainText('Mi♭1 + La♭1');
  await expect(page.locator('#wk-info')).not.toContainText('♯');
  await expect(page.locator('#wk-src')).toContainText('Creative Commons BY-SA 4.0');
  const scroll = await page.evaluate(() => { const w = document.querySelector('#kb-wk'); return w.scrollWidth - w.clientWidth; });
  expect(scroll).toBe(0);                                                // de Mi♭1 à Si♭6, tout visible
});

test('K5. chaque partition du pack se joue en entier aux deux mains (son mesuré)', async ({ page }) => {
  await page.goto('./#clavier');
  for (const id of ['clair', 'frere', 'bach120', 'alkan8']) {
    await page.locator(`#prog-sel button[data-p="w:${id}"]`).click();
    await page.locator('#prog-bpm').fill('110');
    await page.locator('#prog-play').click();
    await page.waitForTimeout(1500);
    const lvl = await page.evaluate(async () => {
      // @ts-ignore
      if (window.__ctx !== AC) { window.__ctx = AC; window.__an = AC.createAnalyser(); MASTER.connect(window.__an); }
      // @ts-ignore
      const an = window.__an, buf = new Float32Array(2048); let max = 0;
      for (let i = 0; i < 10; i++) { an.getFloatTimeDomainData(buf); let s = 0; for (const v of buf) s += v * v; max = Math.max(max, Math.sqrt(s / buf.length)); await new Promise(r => setTimeout(r, 40)); }
      return max;
    });
    expect(lvl, id).toBeGreaterThan(0.01);
    await page.locator('#prog-stop').click();
  }
});

test('K6. chemin vers Alkan : 5 étapes, une étape avance quand ses morceaux sont prêts', async ({ page }) => {
  await page.goto('./#morceaux');
  await expect(page.locator('#path li')).toHaveCount(5);
  await expect(page.locator('#path li').nth(2)).toContainText('La chanson de la folle au bord de la mer');
  await expect(page.locator('#path li').nth(4)).toContainText('Le Festin d’Ésope');
  await expect(page.locator('#path li').nth(1)).toContainText('0/1 prêts');
  const card = page.locator('article.piece', { hasText: 'Menuet en la mineur' });
  for (let i = 0; i < 5; i++) await card.locator('button[data-act="up"]').click();
  await expect(page.locator('#path li').nth(1)).toContainText('1/1 prêts');
  await expect(page.locator('article.piece', { hasText: 'La chanson de la folle' })).toContainText('Creative Commons BY-SA 4.0');
});
