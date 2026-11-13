// @ts-check
// Sur PC (Chrome, Brave, Edge…) : écran large, onglets du navigateur, changement de morceau pendant l'écoute.
const { test, expect } = require('@playwright/test');

test.use({ viewport: { width: 1366, height: 768 } });

/** Niveau sonore (RMS max sur ~0,4 s) mesuré à la sortie du contexte audio courant. */
const level = page => page.evaluate(async () => {
  // @ts-ignore
  if (window.__ctx !== AC) { window.__ctx = AC; window.__an = AC.createAnalyser(); MASTER.connect(window.__an); }
  // @ts-ignore
  const an = window.__an, buf = new Float32Array(2048); let max = 0;
  for (let i = 0; i < 10; i++) { an.getFloatTimeDomainData(buf); let s = 0; for (const v of buf) s += v * v; max = Math.max(max, Math.sqrt(s / buf.length)); await new Promise(r => setTimeout(r, 40)); }
  return max;
});
const switchTab = page => page.evaluate(() => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
  document.dispatchEvent(new Event('visibilitychange'));
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  document.dispatchEvent(new Event('visibilitychange'));
});

test('PC1. changer d’onglet du navigateur pendant Alkan ne coupe plus le morceau au retour', async ({ page }) => {
  await page.goto('./#clavier');
  await page.locator('#prog-sel button[data-p="w:alkan8"]').click();
  await page.locator('#prog-play').click();
  await page.waitForTimeout(1000);
  // @ts-ignore
  await page.evaluate(() => { window.__c1 = AC; });
  await switchTab(page);
  await page.locator('#kb-main .key[data-m="72"]').click();       // toucher une note au retour
  await page.waitForTimeout(800);
  // @ts-ignore
  expect(await page.evaluate(() => [window.__c1 === AC, AC.state])).toEqual([true, 'running']);
  expect(await level(page)).toBeGreaterThan(0.02);                 // Alkan joue toujours
});

test('PC2. choisir un autre morceau dans Enchaînements arrête celui qui joue', async ({ page }) => {
  await page.goto('./#clavier');
  await page.locator('#prog-sel button[data-p="w:alkan8"]').click();
  await page.locator('#prog-play').click();
  await page.waitForTimeout(1000);
  expect(await level(page)).toBeGreaterThan(0.02);
  await page.locator('#prog-sel button[data-p="w:bach120"]').click();
  await page.waitForTimeout(600);
  expect(await level(page)).toBeLessThan(0.005);
  await page.locator('#prog-play').click();
  await page.waitForTimeout(1000);
  expect(await level(page)).toBeGreaterThan(0.02);
});

test('PC3. sur grand écran, le petit clavier de Lecture tient sans défiler ; aucune page ne déborde', async ({ page }) => {
  for (const v of ['seance', 'clavier', 'oreille', 'lecture', 'tempo', 'morceaux', 'gauche', 'journal']) {
    await page.goto('./#' + v);
    const r = await page.evaluate(() => ({ page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      kb: [...document.querySelectorAll('.view.on .kb-wrap')].filter(k => /** @type {HTMLElement} */ (k).offsetParent).map(k => k.scrollWidth - k.clientWidth) }));
    expect(r.page, v).toBeLessThanOrEqual(0);
    if (v === 'lecture') expect(Math.max(...r.kb)).toBeLessThanOrEqual(1);
  }
});
