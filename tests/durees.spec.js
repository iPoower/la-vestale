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

test('D5. toutes les partitions ont le volet ; doubles croches et triolets : compte par temps', async ({ page }) => {
  await page.goto('./#coach');
  // @ts-ignore
  const r = await page.evaluate(() => Object.keys(WORK).map(id => { WK.id = id; WK.bar = 0; WK.hands = 'both'; renderWork(); const w = WORK[id];
    return { id, simple: !w.beat && Number.isInteger(w.bpb), count: !!document.querySelector('#wk-info .wk-count'), why: !!document.querySelector('#wk-info .wk-why'), txt: document.querySelector('#wk-info').textContent }; }));
  expect(r.filter(x => !x.why).map(x => x.id)).toEqual([]);
  expect(r.filter(x => x.simple && !x.count).map(x => x.id)).toEqual([]);
  const alkan = r.find(x => x.id === 'alkan311');
  expect(alkan && alkan.txt).toContain('temps 2 :');
  expect(alkan && alkan.txt).toContain('Triolet');
  expect(alkan && alkan.txt).not.toContain('0,333');
});

test('D6. Mes partitions : le compte apparaît aussi sur une partition saisie', async ({ page }) => {
  await page.goto('./#morceaux');
  await page.locator('#my-title').fill('Essai compte');
  await page.locator('#my-new').click();
  for (const n of ['Do4', 'Ré4', 'Mi4', 'Fa4']) await page.locator(`#kb-my .key[aria-label="${n}"]`).click();
  await page.locator('#my-done').click();
  await page.locator('#my-list button[data-myw]').click();
  await expect(page.locator('#wk-info .wk-count')).toHaveText('Compte : Do4 (1) · Ré4 (2) · Mi4 (3) · Fa4 (4)');
});
