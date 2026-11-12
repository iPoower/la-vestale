// @ts-check
// Son : « Écouter » doit jouer à chaque fois, y compris après les pannes typiques de l'iPhone
// (contexte fermé, « interrupted », suspendu, retour d'arrière-plan). On mesure le vrai signal produit.
const { test, expect } = require('@playwright/test');

/** Niveau sonore maximal (RMS) mesuré sur la sortie de l'app pendant `ms`. */
async function level(page, ms = 600) {
  return page.evaluate(async ms => {
    // @ts-ignore
    const ctx = AC, out = MASTER;
    // @ts-ignore
    if (window.__ctx !== ctx) { window.__ctx = ctx; window.__an = ctx.createAnalyser(); window.__an.fftSize = 2048; out.connect(window.__an); }
    // @ts-ignore
    const an = window.__an, buf = new Float32Array(2048); let max = 0; const t0 = performance.now();
    while (performance.now() - t0 < ms) { an.getFloatTimeDomainData(buf); let s = 0; for (const v of buf) s += v * v; max = Math.max(max, Math.sqrt(s / buf.length)); await new Promise(r => setTimeout(r, 40)); }
    return max;
  }, ms);
}
// @ts-ignore
const ctxId = page => page.evaluate(() => { if (!AC) return null; if (!AC.__id) AC.__id = Math.random(); return AC.__id; });

test('A1. chaque « Écouter » joue à chaque fois (3 clics de suite)', async ({ page }) => {
  for (const [tab, btn] of [['clavier', '#mg-play'], ['clavier', '#mel-play'], ['oreille', '#ear-play'], ['clavier', '#prog-play']]) {
    await page.goto('./#' + tab);
    for (let i = 1; i <= 3; i++) {
      await page.locator(btn).click();
      await page.waitForTimeout(120);
      expect(await level(page), `${btn} clic ${i}`).toBeGreaterThan(0.02);
    }
  }
});

test('A2. contexte fermé par le système : un nouveau est créé et le son revient', async ({ page }) => {
  await page.goto('./#clavier');
  await page.locator('#mg-play').click();
  const first = await ctxId(page);
  // @ts-ignore
  await page.evaluate(() => AC.close());
  await page.waitForTimeout(200);
  await page.locator('#mg-play').click();
  await page.waitForTimeout(120);
  expect(await ctxId(page)).not.toBe(first);
  expect(await level(page)).toBeGreaterThan(0.02);
});

test('A3. contexte « interrupted » (iPhone) qui ne repart pas : remplacé au toucher suivant', async ({ page }) => {
  await page.goto('./#clavier');
  await page.locator('#mg-play').click();
  const first = await ctxId(page);
  await page.evaluate(() => {
    // Simule l'état propre à iOS : « interrupted », et une reprise qui ne se fait jamais.
    // @ts-ignore
    Object.defineProperty(AC, 'state', { get: () => 'interrupted' }); AC.resume = () => new Promise(() => {});
  });
  await page.locator('#mg-play').click();
  await page.waitForTimeout(120);
  expect(await ctxId(page)).not.toBe(first);
  // @ts-ignore
  expect(await page.evaluate(() => AC.state)).toBe('running');
  expect(await level(page)).toBeGreaterThan(0.02);
});

test('A4. contexte suspendu : relancé au toucher, le son revient', async ({ page }) => {
  await page.goto('./#oreille');
  await page.locator('#ear-play').click();
  // @ts-ignore
  await page.evaluate(() => AC.suspend());
  // @ts-ignore
  expect(await page.evaluate(() => AC.state)).toBe('suspended');
  await page.locator('#ear-play').click();
  await page.waitForTimeout(150);
  // @ts-ignore
  expect(await page.evaluate(() => AC.state)).toBe('running');
  expect(await level(page)).toBeGreaterThan(0.02);
});

test('A5. après un passage en arrière-plan, un contexte neuf joue au toucher suivant', async ({ page }) => {
  await page.goto('./#clavier');
  await page.locator('#mg-play').click();
  const first = await ctxId(page);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.locator('#mg-play').click();
  await page.waitForTimeout(120);
  expect(await ctxId(page)).not.toBe(first);
  expect(await level(page)).toBeGreaterThan(0.02);
});

test('A6. le métronome s’arrête proprement si le contexte doit être recréé', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('./#tempo');
  await page.locator('#mt-go').click();
  await expect(page.locator('#mt-go')).toHaveText('Arrêter');
  // @ts-ignore
  await page.evaluate(() => AC.close());
  await page.locator('#mt-go').click();                 // arrête
  await page.locator('#mt-go').click();                 // relance sur un contexte neuf
  await expect(page.locator('#mt-go')).toHaveText('Arrêter');
  await page.waitForTimeout(150);
  expect(await level(page, 1500)).toBeGreaterThan(0.005);       // au moins un clic à 60 battements par minute
  await page.locator('#mt-go').click();
  expect(errors).toEqual([]);
});
