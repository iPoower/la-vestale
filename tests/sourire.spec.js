// @ts-check
// « Il y a ton sourire » : accompagnement complet (grille de la feuille), sans mélodie ni paroles.
const { test, expect } = require('@playwright/test');

test('S1. 33 mesures numérotées comme la feuille : intro Em, puis Em C G D huit fois', async ({ page }) => {
  await page.goto('./#seance');
  // @ts-ignore
  const ch = await page.evaluate(() => workBars('sourire').map(b => b.rh[0][3]));
  expect(ch.length).toBe(33);
  expect(ch.slice(0, 6)).toEqual(['Em', 'Em', 'C', 'G', 'D', 'Em']);
  expect([ch[16], ch[21], ch[29], ch[32]]).toEqual(['D', 'Em', 'Em', 'D']);   // mesures 17, 22, 30, 33
});

test('S2. Séance : accord nommé, quatre noires regroupées, basse au 1er temps', async ({ page }) => {
  await page.goto('./#seance');
  await page.locator('#wk-piece').selectOption('sourire');
  await expect(page.locator('#wk-pos')).toHaveText('Mesure 1/33');
  await expect(page.locator('#wk-info')).toContainText('accord Em : Mi4 + Sol4 + Si4 · doigts 1-3-5 (noire) ×4');
  await expect(page.locator('#wk-info')).toContainText('Mi2 · doigt 5 (noire)');
  await page.locator('#wk-next').click();
  await page.locator('#wk-next').click();
  await expect(page.locator('#wk-info')).toContainText('accord C : Mi4 + Sol4 + Do5 · doigts 1-2-5');
  await expect(page.locator('#wk-info')).toContainText('Do3');
  await expect(page.locator('#wk-src')).toContainText('protégées');
});

test('S3. aucune parole du morceau dans l’app', async ({ page }) => {
  await page.goto('./');
  const html = await page.content();
  for (const w of ['qui se lève', 'trajectoire', 'lueur d', 'ton âme au diable', 'éphémère']) expect(html, w).not.toContain(w);
});
