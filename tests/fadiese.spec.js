// @ts-check
// Contrôle des altérations (consigne du prof pour « Il y a ton sourire » : surveiller les Fa♯) :
// touches entourées et rappel écrit, conseil précis du micro, exercice G → D → Em.
const { test, expect } = require('@playwright/test');

test('FA1. Il y a ton sourire : Fa♯ de l’accord D entouré et nommé ; rien sur les mesures sans altération ni à la clé (Fontaine)', async ({ page }) => {
  await page.goto('./#coach');
  await page.locator('#dc-piece').selectOption('sourire');
  // @ts-ignore
  await page.evaluate(() => { WK.hands = 'both'; wkGo(4); });                   // mesure 5 : D = La–Ré–Fa♯
  await expect(page.locator('#kb-wk .key.accd')).toHaveCount(1);
  await expect(page.locator('#kb-wk .key.accd')).toHaveAttribute('aria-label', 'Fa♯4');
  await expect(page.locator('#wk-info .wk-accd')).toContainText('À contrôler : Fa♯4');
  await page.locator('#wk-prev').click();                                         // mesure 4 (G) : plus rien
  await expect(page.locator('#kb-wk .key.accd')).toHaveCount(0);
  await expect(page.locator('#wk-info .wk-accd')).toHaveCount(0);
  await page.locator('#dc-piece').selectOption('fontaine');
  // @ts-ignore
  await page.evaluate(() => wkGo(7));                                             // Fa♯ à la clé : pas à « contrôler »
  await expect(page.locator('#kb-wk .key.accd')).toHaveCount(0);
  await page.locator('#dc-piece').selectOption('hymne');
  // @ts-ignore
  await page.evaluate(() => wkGo(11));                                            // mesure 12 : Fa♯ puis Fa bécarre
  await expect(page.locator('#wk-info .wk-accd')).toContainText('Fa3, Fa♯3');
});

test('FA2. micro : Fa joué au lieu de Fa♯ → « Fa♯4, pas Fa4 … touche noire juste à droite »', async ({ page }) => {
  await page.goto('./#coach');
  // @ts-ignore
  const r = await page.evaluate(() => { EC.same = {}; return [ecTip(66, 65, null), ecTip(70, 71, null), ecTip(64, 65, null)]; });
  expect(r[0]).toBe('Fa♯4, pas Fa4 : le ♯ vaut jusqu’à la barre. Touche noire juste à droite.');
  expect(r[1]).toBe('La♯4, pas Si4 : le ♯ vaut jusqu’à la barre. Touche noire juste à gauche.');
  expect(r[2]).toBe('Un demi-ton à côté : regarde le ♯ ou le ♭, à la clé ou devant la note.');
});

test('FA3. exercice « contrôle du Fa♯ » : G → D → Em, sans armure, le ♯ écrit à chaque mesure de D', async ({ page }) => {
  await page.goto('./#coach');
  // @ts-ignore
  const b = await page.evaluate(() => workBars('sourireFa').map(x => [x.rh[0][3], x.rh[0][0].join('.'), x.rh.length]));
  expect(b.map(x => x[0])).toEqual(['G', 'D', 'Em', 'G', 'D', 'Em', 'D', 'Em']);
  expect(b[1]).toEqual(['D', '57.62.66', 4]);
  await page.locator('#dc-piece').selectOption('sourireFa');
  await expect(page.locator('#wk-key')).toHaveText('Tonalité : Mi mineur · pas d’armure sur ta feuille : Fa♯ écrit devant la note');
  await page.locator('#wk-next').click();
  await expect(page.locator('#wk-staff .ks')).toHaveCount(0);
  await expect(page.locator('#wk-staff .acc')).toHaveCount(1);
  await expect(page.locator('#kb-wk .key.accd')).toHaveAttribute('aria-label', 'Fa♯4');
});
