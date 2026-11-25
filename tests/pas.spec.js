// @ts-check
// Le clavier n'allume que ce qui se joue ensuite (accord par accord), pas toute la mesure.
const { test, expect } = require('@playwright/test');
const lit = page => page.$$eval('#kb-wk .key.hl, #kb-wk .key.hl2', ks => ks.map(k => k.getAttribute('aria-label') + (k.classList.contains('hl2') ? '·MG' : '')).sort());

test('PA1. Alkan, mesure 4 : 7 accords ; seul l’accord en cours est allumé ; ◀ ▶ bornés', async ({ page }) => {
  await page.goto('./#coach');
  await page.locator('#dc-piece').selectOption('alkan311');
  // @ts-ignore
  await page.evaluate(() => { WK.hands = 'both'; wkGo(3); });
  await expect(page.locator('#wk-step-lbl')).toHaveText('Accord 1/7');
  expect(await lit(page)).toEqual(['Do4·MG', 'Mi4·MG', 'Mi5', 'Sol3·MG', 'Sol4', 'Sol5']);
  await expect(page.locator('#wk-step-prev')).toBeDisabled();
  await page.locator('#wk-step-next').click();
  await expect(page.locator('#wk-step-lbl')).toHaveText('Accord 2/7');
  expect(await lit(page)).toEqual(['Fa4·MG', 'Ré5', 'Si3·MG', 'Sol3·MG', 'Sol4', 'Sol5']);
  for (let i = 0; i < 6; i++) await page.locator('#wk-step-next').click({ force: true });
  await expect(page.locator('#wk-step-lbl')).toHaveText('Accord 7/7');
  await expect(page.locator('#wk-step-next')).toBeDisabled();
  await page.locator('#wk-next').click();                                          // mesure suivante : retour à l'accord 1
  await expect(page.locator('#wk-step-lbl')).toHaveText('Accord 1/7');
  // main droite seule : les touches vertes disparaissent
  await page.locator('#dc-hands button[data-h="rh"]').click();
  expect((await lit(page)).some(x => x.endsWith('·MG'))).toBe(false);
});

test('PA2. pendant l’écoute, rien d’allumé en fixe (seule la note jouée) ; à l’arrêt, l’accord en cours revient', async ({ page }) => {
  await page.goto('./#seance');
  await page.locator('#wk-play').click();
  // @ts-ignore
  expect(await page.evaluate(() => WK.playing)).toBe(true);
  await expect(page.locator('#kb-wk .key.hl, #kb-wk .key.hl2')).toHaveCount(0);
  await expect(page.locator('#wk-step-next')).toBeDisabled();
  await page.locator('#wk-stop').click();
  await expect(page.locator('#kb-wk .key.hl2')).toHaveCount(3);                    // accord de Do de l'Hymne, mesure 1
  await expect(page.locator('#kb-wk .key.hl')).toHaveCount(1);
});

test('PA3. pendant l’écoute, les touches jouées s’allument en couleur (laiton main droite, vert main gauche)', async ({ page }) => {
  await page.goto('./#coach');
  await page.locator('#wk-play').click();
  // 1er temps de la mesure 1 de l'Hymne : Mi5 (main droite, laiton) + Do3, Mi3, Sol3 (main gauche, vert)
  await expect(page.locator('#kb-wk .key.next-rh')).toHaveCount(1);
  await expect(page.locator('#kb-wk .key.next-rh')).toHaveAttribute('aria-label', 'Mi5');
  await expect(page.locator('#kb-wk .key.next-lh')).toHaveCount(3);
  const bg = await page.evaluate(() => [
    getComputedStyle(document.querySelector('#kb-wk .key.next-rh')).backgroundImage,
    getComputedStyle(document.querySelector('#kb-wk .key.next-lh')).backgroundImage,
  ]);
  expect(bg[0]).toContain('243, 217, 149');                                        // dégradé laiton (main droite)
  expect(bg[1]).toContain('214, 226, 166');                                        // dégradé vert (main gauche)
  await page.locator('#wk-stop').click();
  await expect(page.locator('#kb-wk .key.next, #kb-wk .key.next-rh, #kb-wk .key.next-lh')).toHaveCount(0);

  // Main gauche seule : uniquement des touches vertes pendant l'écoute
  await page.locator('#dc-hands button[data-h="lh"]').click();
  await page.locator('#wk-play').click();
  await expect(page.locator('#kb-wk .key.next-lh')).toHaveCount(3);
  await expect(page.locator('#kb-wk .key.next-rh')).toHaveCount(0);
  await page.locator('#wk-stop').click();
});
