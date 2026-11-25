// @ts-check
// Toutes les partitions : morceaux du domaine public travaillables mesure par mesure ; morceaux protégés signalés clairement.
const { test, expect } = require('@playwright/test');
const { niveaux } = require('./aller');

test('Q1. « Ah ! vous dirai-je maman » et « Good King Wenceslas » : mesures justes, Sol–La–Si à la main gauche', async ({ page }) => {
  await page.goto('./#seance');
  // @ts-ignore
  const r = await page.evaluate(() => { const t = workBars('twinkle'), w = workBars('wenceslas'), n = e => e[0] ? e[0][0] : null;
    return { tn: t.length, t1: [t[0].lh.map(n), t[0].rh.map(n)], wn: w.length, w2: [w[1].rh.map(n), w[1].lh.map(n)], w3: [w[2].rh.map(e => [n(e), e[1]]), w[2].lh.map(n)] }; });
  expect(r.tn).toBe(12);
  expect(r.t1).toEqual([[55, 55, null], [null, 62, 62]]);               // Sol3 Sol3 à gauche, Ré4 Ré4 à droite (feuille n° 54)
  expect(r.wn).toBe(17);
  expect(r.w2).toEqual([[60, 60, null], [null, 55]]);                 // Do Do à droite, puis Sol3 (blanche) à gauche
  expect(r.w3).toEqual([[[null, 4]], [57, 55, 57, 59]]);               // mesure 3 : toute à la main gauche
  await page.locator('#wk-piece').selectOption('wenceslas');
  await page.locator('#wk-next').click(); await page.locator('#wk-next').click();
  await expect(page.locator('#wk-info')).toContainText('Main gauche');
  await expect(page.locator('#wk-info')).toContainText('Si3');
  expect(await page.locator('#kb-wk .key.hl2').count()).toBe(1);         // seul le 1er son : La3 (puis Sol3, La3, Si3 avec ▶)
  await expect(page.locator('#kb-wk .key.hl2')).toHaveAttribute('aria-label', 'La3');
});

test('Q2. répertoire : chaque morceau sans notes le dit, et propose « Mes partitions »', async ({ page }) => {
  await page.goto('./#morceaux');
  await niveaux(page);
  // @ts-ignore
  const without = await page.evaluate(() => PIECES.filter(p => !WORK[p.id] && !p.mel).length);
  await expect(page.locator('#pieces .nonotes')).toHaveCount(without);
  expect(without).toBe(13);                                                       // Cancan : notes ajoutées ; Imagine : œuvre protégée, sans notes
  await expect(page.locator('article.piece', { hasText: 'Hymne à la joie' }).locator('.nonotes')).toHaveCount(0);
  const card = page.locator('article.piece', { hasText: 'Orientale' });
  await expect(card).toContainText('Pas de notes dans l’app');
  await card.locator('button[data-act="mine"]').click();
  await expect(page.locator('#my-title')).toHaveValue('Orientale');
  await expect(page.locator('#my-title')).toBeFocused();
});
