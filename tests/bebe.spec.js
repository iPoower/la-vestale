// @ts-check
// « Bébé s'endort » (Hedwige Chrétien, domaine public) : notes relevées, basse tenue, Mi bémol bien nommé.
const { test, expect } = require('@playwright/test');

/** Notes de la main droite d'une mesure (1 = première), en hauteurs MIDI (null = silence). */
// @ts-ignore
const rhNotes = (page, bar) => page.evaluate(b => workBars('bebe')[b - 1].rh.map(e => e[0] ? e[0][0] : null), bar);

test('B1. notes de la main droite : thème, réponse en Do, fin sur l’accord de Sol', async ({ page }) => {
  await page.goto('./#seance');
  expect(await rhNotes(page, 1)).toEqual([null, 71, 74, 71]);               // silence, Si Ré Si
  expect(await rhNotes(page, 2)).toEqual([69, 71, 69, 67, 69]);             // La Si La Sol La
  expect(await rhNotes(page, 12)).toEqual([74, 73, null]);                  // Ré, Do♯
  expect(await rhNotes(page, 13)).toEqual([null, 72, 79, 72]);              // Do bécarre, Sol aigu
  // @ts-ignore
  const fin = await page.evaluate(() => { const b = workBars('bebe'); return [b.length, b[17].rh[0][0], b[17].lh[0][0]]; });
  expect(fin).toEqual([18, [62, 67], [55, 59]]);                            // Sol majeur : Sol3 Si3 / Ré4 Sol4
});

test('B2. Séance : Sol grave tenu (liaison), Mi♭ écrit en bémol, Do♯ en dièse', async ({ page }) => {
  await page.goto('./#seance');
  await page.locator('#wk-piece').selectOption('bebe');
  await expect(page.locator('#wk-pos')).toHaveText('Mesure 1/18');
  await expect(page.locator('#wk-src')).toContainText('Domaine public');
  for (let i = 0; i < 7; i++) await page.locator('#wk-next').click();
  await expect(page.locator('#wk-info')).toContainText('Sol3 + Mi♭4');
  for (let i = 0; i < 4; i++) await page.locator('#wk-next').click();
  await expect(page.locator('#wk-info')).toContainText('Do♯5');
  // @ts-ignore
  const ties = await page.evaluate(() => workBars('bebe').map(b => b.lh[0][4][0]));
  expect(ties.slice(0, 4)).toEqual([16, 0, 0, 0]);                          // une seule attaque pour 4 mesures
});

test('B3. une mesure liée travaillée seule fait quand même entendre la basse', async ({ page }) => {
  await page.goto('./#seance');
  await page.locator('#wk-piece').selectOption('bebe');
  await page.locator('#wk-next').click();                                   // mesure 2 : Sol3 lié depuis la mesure 1
  await page.locator('#wk-bpm').fill('100');
  await page.evaluate(() => {
    // @ts-ignore
    const o = window.playNote; window.__n = []; window.playNote = function (...a) { window.__n.push([a[0], a[2]]); return o.apply(this, a); };
  });
  await page.locator('#wk-play').click();
  // @ts-ignore
  const n = await page.evaluate(() => window.__n);
  const g3 = n.find(([m]) => m === 55);
  expect(g3).toBeTruthy();
  expect(g3[1]).toBeLessThanOrEqual(2.4 + 1e-6);                            // 4 temps à 100 = 2,4 s, sans déborder
});

test('B4. au répertoire et au chemin vers Alkan (étape 1), pas d’exercice dans Enchaînements', async ({ page }) => {
  await page.goto('./#morceaux');
  await expect(page.locator('article.piece', { hasText: 'Bébé s’endort' })).toContainText('Hedwige Chrétien');
  await expect(page.locator('#path li').nth(0)).toContainText('Bébé s’endort');
  await page.goto('./#clavier');
  await expect(page.locator('#prog-sel button[data-p="w:bebe"]')).toHaveCount(1);
  await expect(page.locator('#prog-sel button[data-p^="w:ex"]')).toHaveCount(0);
});
