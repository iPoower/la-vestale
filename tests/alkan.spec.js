// @ts-check
// Apprendre › Alkan : parcours en six niveaux, accords du Prélude op. 31 n° 1 (version simplifiée jouable), culture et quiz.
const { test, expect } = require('@playwright/test');

test('AK1. sous-onglet Alkan : accords nommés mesure par mesure, niveau 1 recommandé, pas de débordement', async ({ page }) => {
  await page.goto('./#solfege');
  await page.locator('#subtabs a[data-v="alkan"]').click();
  await expect(page.locator('#v-alkan')).toBeVisible();
  await expect(page.locator('#ak-tag')).toHaveText('Niveau 1/6');
  await expect(page.locator('#ak-chords li')).toHaveCount(10);
  await expect(page.locator('#ak-chords li').nth(0)).toHaveText('C/G (Sol3–Do4–Mi4) → G7 (Sol3–Si3–Fa4)');
  await expect(page.locator('#ak-chords li').nth(6)).toHaveText('Am (La3–Do4) → E7 (Sol♯3–Ré4)');
  await expect(page.locator('#ak-chords li').nth(8)).toHaveText('A/C♯ (Do♯3–La3–Do♯4) → D (Ré3–La3–Ré4)');
  await expect(page.locator('#ak-levels li')).toHaveCount(6);
  await expect(page.locator('#ak-levels li.rec')).toHaveCount(1);
  await expect(page.locator('#ak-levels li').first()).toHaveClass(/rec/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.locator('#ak-cult')).toContainText('Chopin');
});

test('AK2. version simplifiée : 10 mesures, deux blanches de main gauche, doigtés proposés ; « Les jouer » ouvre Jouer en main gauche', async ({ page }) => {
  await page.goto('./#alkan');
  // @ts-ignore
  const b = await page.evaluate(() => workBars('alkan311g').map(x => ({ rh: x.rh.map(e => [e[0], e[1]]), lh: x.lh.map(e => [e[0], e[1], e[2], e[3]]) })));
  expect(b.length).toBe(10);
  expect(b.every(x => x.rh.length === 1 && x.rh[0][0] === null && x.rh[0][1] === 4)).toBe(true);
  expect(b.every(x => x.lh.length === 2 && x.lh.every(e => e[1] === 2))).toBe(true);
  expect(b[0].lh).toEqual([[[55, 60, 64], 2, [5, 2, 1], 'C/G'], [[55, 59, 65], 2, [5, 3, 1], 'G7']]);
  await page.locator('#ak-go').click();
  await expect(page.locator('#v-coach')).toBeVisible();
  // @ts-ignore
  await expect.poll(() => page.evaluate(() => [WK.id, WK.hands, WK.bar])).toEqual(['alkan311g', 'lh', 0]);
  await expect(page.locator('#wk-pos')).toHaveText('Mesure 1/10');
});

test('AK3. la progression vient du jeu : mesures propres → niveau 2 acquis, niveau 3 recommandé', async ({ page }) => {
  await page.goto('./#alkan');
  // @ts-ignore
  await page.evaluate(() => { const b = {}; for (let i = 0; i < 10; i++) b[i] = [0, 1, 1, 0]; S.coach.alkan311g = { b, c: {} }; S.coach.alkan311 = { b: {}, c: {}, f: { ecoute: 1 } }; saveLocal(); renderAlkan(); });
  await expect(page.locator('#ak-levels li').nth(0)).toHaveClass(/done/);
  await expect(page.locator('#ak-levels li').nth(1)).toHaveClass(/done/);
  await expect(page.locator('#ak-levels li').nth(1)).toContainText('✓ acquis');
  await expect(page.locator('#ak-levels li').nth(2)).toHaveClass(/rec/);
  await expect(page.locator('#ak-tag')).toHaveText('Niveau 3/6');
  await page.locator('#ak-levels button[data-ak="3"]').click();
  // @ts-ignore
  await expect.poll(() => page.evaluate(() => [WK.id, WK.hands])).toEqual(['alkan311', 'rh']);
});

test('AK4. quiz Alkan : ouvre le Solfège sur le chapitre Alkan ; le chapitre est aussi dans la culture', async ({ page }) => {
  await page.goto('./#alkan');
  await page.locator('#ak-quiz').click();
  await expect(page.locator('#v-solfege')).toBeVisible();
  await expect(page.locator('#sf-cult details[data-id="calkan"]')).toContainText('Festin d’Ésope');
  // @ts-ignore
  await expect.poll(() => page.evaluate(() => SF.on && SF.type === 'culture')).toBe(true);
});
