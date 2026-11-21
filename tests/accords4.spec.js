// @ts-check
// Apprendre › 4 accords : I, IV, V, vi (consigne du prof : « si on contrôle ces accords, on a presque tout le répertoire »).
const { test, expect } = require('@playwright/test');

test('Q41. sous-onglet « 4 accords » : tableau I IV V vi, 4 tonalités, Do recommandé, noms selon la tonalité', async ({ page }) => {
  await page.goto('./#oreille');
  await page.locator('#subtabs a[data-v="accords4"]').click();
  await expect(page.locator('#v-accords4')).toBeVisible();
  await expect(page.locator('#v-accords4 .q4-t tbody tr').nth(0)).toHaveText(/En Do\s*C\s*F\s*G\s*Am/);
  await expect(page.locator('#v-accords4 .q4-t tbody tr').nth(1)).toHaveText(/En Sol\s*G\s*C\s*D\s*Em/);
  await expect(page.locator('#q4-list li')).toHaveCount(4);
  await expect(page.locator('#q4-list li').first()).toHaveClass(/rec/);
  await expect(page.locator('#q4-tag')).toHaveText('0/4 tonalités');
  await expect(page.locator('#q4-list li').nth(1)).toContainText('D (La3–Ré4–Fa♯4)');      // positions de la feuille de Saez
  await expect(page.locator('#q4-list li').nth(3)).toContainText('B♭ (Ré4–Fa4–Si♭4)');     // Si♭, pas La♯, en Fa majeur
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('Q42. exercices : tonalité écrite et armure, grille jouée deux fois, deux accords par mesure, basse à la main gauche', async ({ page }) => {
  await page.goto('./#accords4');
  // @ts-ignore
  const r = await page.evaluate(() => ['q4do', 'q4sol', 'q4re', 'q4fa'].map(id => [keyLine(dcKey(id)), workBars(id).map(b => b.rh.map(e => e[3]).join(' ')).join(' | '), workBars(id)[0].lh.map(e => e[0][0])]));
  expect(r[0]).toEqual(['Tonalité : Do majeur · aucune altération à la clé', 'C G | Am F | C G | Am F', [48, 43]]);
  expect(r[1]).toEqual(['Tonalité : Sol majeur · Fa♯ à la clé', 'Em C | G D | Em C | G D', [40, 48]]);
  expect(r[2]).toEqual(['Tonalité : Ré majeur · Fa♯, Do♯ à la clé', 'D A | Bm G | D A | Bm G', [50, 45]]);
  expect(r[3]).toEqual(['Tonalité : Fa majeur · Si♭ à la clé', 'F C | Dm B♭ | F C | Dm B♭', [41, 48]]);
  await page.locator('#q4-list button[data-q4="q4sol"]').click();
  await expect(page.locator('#v-coach')).toBeVisible();
  // @ts-ignore
  await expect.poll(() => page.evaluate(() => [WK.id, WK.hands, WK.bar])).toEqual(['q4sol', 'both', 0]);
});

test('Q43. progression : 4 mesures propres en Do → acquis, Sol recommandé ; oreille « I, IV, V ou vi » avec Do de référence', async ({ page }) => {
  await page.goto('./#accords4');
  // @ts-ignore
  await page.evaluate(() => { const b = {}; for (let i = 0; i < 4; i++) b[i] = [0, 1, 1, 0]; S.coach.q4do = { b, c: {} }; saveLocal(); renderQ4(); });
  await expect(page.locator('#q4-list li').nth(0)).toHaveClass(/done/);
  await expect(page.locator('#q4-list li').nth(1)).toHaveClass(/rec/);
  await expect(page.locator('#q4-tag')).toHaveText('1/4 tonalités');
  await page.locator('#q4-ear').click();
  await expect(page.locator('#v-oreille')).toBeVisible();
  await expect(page.locator('#ear-mode button.on')).toHaveText('I, IV, V ou vi');
  await expect(page.locator('#ear-ans button')).toHaveText(['I · C', 'IV · F', 'V · G', 'vi · Am']);
  // @ts-ignore
  const right = await page.evaluate(() => EAR.degre.ans(earCur.c));
  await page.locator(`#ear-ans button[data-a="${right}"]`).click();
  await expect(page.locator('#ear-fb')).not.toHaveText('');
});
