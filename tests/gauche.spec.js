// @ts-check
// Onglet « Main gauche » : 8 exercices écrits pour l'app, ouverts en main gauche seule dans « Travailler un morceau ».
const { test, expect } = require('@playwright/test');

test('G1. huit exercices, mesures justes, main droite au silence', async ({ page }) => {
  await page.goto('./#gauche');
  await expect(page.locator('#ex-list article')).toHaveCount(8);
  // @ts-ignore
  const r = await page.evaluate(() => EX.map(x => { const b = workBars(x.id); return { id: x.id, ok: b.every(m => Math.abs(m.lh.reduce((a, e) => a + e[1], 0) - x.bpb) < 1e-9 && m.rh.length === 1 && m.rh[0][0] === null), n: b.length }; }));
  expect(r.every(x => x.ok)).toBe(true);
  expect(r.map(x => x.n)).toEqual([4, 4, 4, 4, 4, 4, 4, 4]);
  const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(scroll).toBeLessThanOrEqual(0);
});

test('G2. « Travailler » ouvre l’exercice en main gauche seule, avec les doigts', async ({ page }) => {
  await page.goto('./#gauche');
  await page.locator('button[data-ex="ex3"]').click();
  await expect(page.locator('#v-seance')).toBeVisible();
  await expect(page.locator('#wk-piece')).toHaveValue('ex3');
  await expect(page.locator('#wk-hands button.on')).toHaveText('Main gauche');
  const lit = await page.$$eval('#kb-wk .key.hl2', ks => Object.fromEntries(ks.map(k => [k.getAttribute('aria-label'), (k.querySelector('.fg') || {}).textContent])));
  expect(lit).toEqual({ Do3: '5', Mi3: '3', Sol3: '1' });
  await page.locator('#wk-next').click();
  await expect(page.locator('#wk-info')).toContainText('Do3 + Fa3 + La3 · doigts 5-2-1');
});

test('G3. gamme de Do : passage du pouce noté (5-4-3-2-1, puis 3-2-1)', async ({ page }) => {
  await page.goto('./#gauche');
  // @ts-ignore
  const f = await page.evaluate(() => workBars('ex7').slice(0, 2).flatMap(b => b.lh.map(e => e[2][0])));
  expect(f).toEqual([5, 4, 3, 2, 1, 3, 2, 1]);
});

test('G4. « Écouter » joue l’exercice ; les octaves descendent jusqu’au Fa1', async ({ page }) => {
  await page.goto('./#gauche');
  await page.evaluate(() => {
    // @ts-ignore
    const o = window.playNote; window.__notes = []; window.playNote = function (...a) { window.__notes.push(a[0]); return o.apply(this, a); };
  });
  await page.locator('button[data-exl="ex8"]').click();
  // @ts-ignore
  const notes = await page.evaluate(() => window.__notes);
  expect(Math.min(...notes)).toBe(29);
  expect(notes.length).toBe(16);
});
