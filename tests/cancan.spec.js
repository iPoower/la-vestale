// @ts-check
// Cancan (Offenbach, travail préparatoire) : 16 mesures d'après la feuille du cours, « tout détaché ».
const { test, expect } = require('@playwright/test');
const { niveaux } = require('./aller');

test('CC1. 16 mesures comme la feuille : mélodie, doigtés imprimés, accords Do–Mi et Si–Sol', async ({ page }) => {
  await page.goto('./#coach');
  // @ts-ignore
  const b = await page.evaluate(() => workBars('cancan').map(x => ({ rh: x.rh.map(e => e[0][0]), d: x.rh.map(e => e[1]), f: x.rh.map(e => e[2] && e[2][0]), lh: x.lh.map(e => e[3]) })));
  expect(b.length).toBe(16);
  const Do = 60, Re = 62, Mi = 64, Fa = 65, Sol = 67, La = 69, Si = 71, Do5 = 72;
  expect(b.map(x => x.rh)).toEqual([
    [Do], [Re, Fa, Mi, Re], [Sol, Sol], [Sol, La, Mi, Fa], [Re, Re], [Re, Fa, Mi, Re],
    [Do, Do5, Si, La], [Sol, Fa, Mi, Re], [Do], [Re, Fa, Mi, Re], [Sol, Sol], [Sol, La, Mi, Fa],
    [Re, Re], [Re, Fa, Mi, Re], [Do, Sol, Re, Mi], [Do, Do]]);
  expect(b.map(x => x.d.join(' '))).toEqual(['4', '1 1 1 1', '2 2', '1 1 1 1', '2 2', '1 1 1 1', '1 1 1 1', '1 1 1 1', '4', '1 1 1 1', '2 2', '1 1 1 1', '2 2', '1 1 1 1', '1 1 1 1', '2 2']);
  // doigtés imprimés : 1 | 2 4 | 5 4 | 4 5 2 3 | 1 2 | 2 4 | 1 5 . 3 | 2 1 3 | 1 … | 1 5 2 3 | 1
  expect([b[0].f[0], b[1].f.slice(0, 2), b[2].f, b[3].f, b[4].f, b[6].f[0], b[6].f[1], b[6].f[3], b[7].f.slice(0, 3), b[14].f, b[15].f[0]])
    .toEqual([1, [2, 4], [5, 4], [4, 5, 2, 3], [1, 2], 1, 5, 3, [2, 1, 3], [1, 5, 2, 3], 1]);
  expect(b.map(x => x.lh.join('+'))).toEqual(['Cdm', 'Gsg', 'Cdm', 'Cdm', 'Gsg', 'Gsg', 'Cdm', 'Gsg', 'Cdm', 'Gsg', 'Cdm', 'Cdm', 'Gsg', 'Gsg', 'Cdm+Gsg', 'Cdm+Cdm']);
  // @ts-ignore
  expect(await page.evaluate(() => [LHC.Cdm, LHC.Gsg])).toEqual([[[48, 52], [4, 2]], [[47, 55], [5, 1]]]);   // Do3-Mi3 (4-2), Si2-Sol3 (5-1)
});

test('CC2. Morceaux : « Mesure par mesure » ouvre le Cancan ; plus de « Pas de notes » ; la consigne reste « par cœur, avec ses articulations »', async ({ page }) => {
  await page.goto('./#morceaux');
  await niveaux(page);
  const card = page.locator('article.piece', { hasText: 'Cancan' });
  await expect(card.locator('.nonotes')).toHaveCount(0);
  await expect(card).toContainText('La mélodie par cœur, avec ses articulations');
  await card.locator('button[data-act="wk"]').click();
  await expect(page.locator('#wk-pos')).toHaveText('Mesure 1/16');
  await expect(page.locator('#wk-info')).toContainText('Do4 · doigt 1 (ronde)');
  await expect(page.locator('#wk-info')).toContainText('accord C (Do–Mi)');
  await expect(page.locator('#wk-src')).toContainText('tout détaché');
  await expect(page.locator('#wk-src')).toContainText('Au crayon');
});

test('CC3. le Cancan travaillé devient le morceau de la séance du jour', async ({ page }) => {
  await page.goto('./#coach');
  await page.locator('#dc-piece').selectOption('cancan');
  // @ts-ignore
  await page.evaluate(() => { S.coach.cancan = Object.assign({ b: {}, c: {} }, S.coach.cancan, { t: Date.now() }); saveLocal(); DAYPLAN = null; });
  // @ts-ignore
  expect(await page.evaluate(() => coachFocus())).toBe('cancan');
  await page.goto('./#seance');
  await expect(page.locator('#blocks')).toContainText('Cancan');
});

test('CC4. Imagine : fiche du cours (protégée, sans notes), noire = 72, grille C – CM7 | F dans Enchaînements', async ({ page }) => {
  await page.goto('./#morceaux');
  await niveaux(page);
  const card = page.locator('article.piece', { hasText: 'Imagine' });
  await expect(card).toContainText('Lennon, arrangement du cours');
  await expect(card.locator('.nonotes')).toHaveCount(1);
  await expect(card.locator('button[data-act="wk"]')).toHaveCount(0);
  await card.locator('button[data-act="metro"]').click();
  await expect(page.locator('#mt-preset')).toHaveValue('imagine');
  // @ts-ignore
  expect(await page.evaluate(() => [PROG.imagine.s.map(x => x[0]).join(' '), CH.C7M.n])).toEqual(['C C7M F C C7M F', [60, 64, 67, 71]]);
});
