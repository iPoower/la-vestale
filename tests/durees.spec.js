// @ts-check
// Mesure par mesure : ligne « Compte » et explication « Pourquoi ces durées ? ».
const { test, expect } = require('@playwright/test');
const { niveaux } = require('./aller');

async function cancan(page) {
  await page.goto('./#morceaux');
  await niveaux(page);
  await page.locator('article.piece', { hasText: 'Cancan' }).locator('button[data-act="wk"]').click();
  await expect(page.locator('#wk-pos')).toHaveText('Mesure 1/16');
}

test('D1. Cancan mesure 1 : la ronde se compte 1 2 3 4 et l’app explique pourquoi', async ({ page }) => {
  await cancan(page);
  await expect(page.locator('#wk-info .wk-count')).toHaveText('Compte : Do4 (1 2 3 4)');
  const why = page.locator('#wk-info .wk-why');
  await why.locator('summary').click();
  await expect(why).toContainText('Chaque mesure contient 4 temps');
  await expect(why).toContainText('Ici : 4 = 4, la mesure est complète.');
  await expect(why).toContainText('Ronde : tête blanche, sans hampe. Elle dure 4 temps.');
  // le libellé existant ne change pas
  await expect(page.locator('#wk-info')).toContainText('Do4 · doigt 1 (ronde)');
});

test('D2. Cancan mesures 2 et 3 : noires puis blanches, l’explication reste ouverte d’une mesure à l’autre', async ({ page }) => {
  await cancan(page);
  await page.locator('#wk-info .wk-why summary').click();
  await page.locator('#wk-next').click();
  await expect(page.locator('#wk-info .wk-count')).toHaveText('Compte : Ré4 (1) · Fa4 (2) · Mi4 (3) · Ré4 (4)');
  await expect(page.locator('#wk-info .wk-why')).toHaveAttribute('open', '');
  await expect(page.locator('#wk-info .wk-why')).toContainText('Ici : 1 + 1 + 1 + 1 = 4');
  await page.locator('#wk-next').click();
  await expect(page.locator('#wk-info .wk-count')).toHaveText('Compte : Sol4 (1 2) · Sol4 (3 4)');
  await expect(page.locator('#wk-info .wk-why')).toContainText('Blanche : tête blanche avec une hampe. Elle dure 2 temps.');
});

test('D3. main gauche seule : le compte suit les accords', async ({ page }) => {
  await cancan(page);
  await page.locator('#wk-hands button[data-h="lh"]').click();
  await expect(page.locator('#wk-info .wk-count')).toHaveText('Compte : accord C (Do–Mi) (1 2 3 4)');
});

test('D4. mesure composée (Clair de lune, 9/8) : pas de compte en noires, pas de « la noire vaut 1 temps »', async ({ page }) => {
  await page.goto('./#coach');
  // @ts-ignore
  await page.evaluate(() => { WK.id = 'clairlune'; WK.bar = 0; renderWork(); });
  await expect(page.locator('#wk-info .wk-count')).toHaveCount(0);
  await expect(page.locator('#wk-info')).not.toContainText('la noire vaut 1 temps');
});
