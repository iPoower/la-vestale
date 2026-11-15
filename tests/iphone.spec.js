// @ts-check
// iPhone 11 Pro Max (414 × 896, tactile) : confort au doigt, pas de zoom de Safari, onglet Astuces.
const { test, expect, devices } = require('@playwright/test');

const { defaultBrowserType, ...iphone } = devices['iPhone 11 Pro Max'];
test.use(iphone);

const VIEWS = ['seance', 'coach', 'clavier', 'oreille', 'lecture', 'tempo', 'morceaux', 'gauche', 'astuces', 'journal'];

test('I1. aucun champ sous 16 px (zoom de Safari), aucune page qui déborde, marges d’encoche actives', async ({ page }) => {
  for (const v of VIEWS) {
    await page.goto('./#' + v);
    if (v === 'morceaux') { await page.locator('#my-title').fill('x'); await page.locator('#my-new').click(); }
    // @ts-ignore
    if (v === 'journal') await page.evaluate(() => openLog(30));
    const r = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      small: [...document.querySelectorAll('input:not([type=range]):not([type=checkbox]):not([type=file]),select,textarea')].filter(e => /** @type {HTMLElement} */ (e).offsetParent !== null && parseFloat(getComputedStyle(e).fontSize) < 16).map(e => e.id) }));
    expect(r, v).toEqual({ scroll: 0, small: [] });
  }
  expect(await page.locator('meta[name=viewport]').getAttribute('content')).toContain('viewport-fit=cover');
});

test('I2. cibles d’au moins 44 px, pas de zoom sur double appui, pas de sélection sur les touches', async ({ page }) => {
  for (const v of VIEWS) {
    await page.goto('./#' + v);
    const small = await page.evaluate(() => [...document.querySelectorAll('.view.on button:not(.key), .view.on a.btn, .view.on summary, .view.on label.toggle, .view.on select')]
      .filter(e => /** @type {HTMLElement} */ (e).offsetParent !== null).map(e => [e.id || (e.textContent || '').trim().slice(0, 20), Math.round(e.getBoundingClientRect().height)]).filter(([, h]) => h < 44));
    expect(small, v).toEqual([]);
  }
  await page.goto('./#clavier');
  const cs = await page.evaluate(() => { const k = getComputedStyle(document.querySelector('#kb-main .key')), b = getComputedStyle(document.querySelector('#prog-play'));
    return [k.webkitUserSelect || k.userSelect, b.touchAction]; });
  expect(cs).toEqual(['none', 'manipulation']);
});

test('I3. Astuces : astuce du jour (aussi dans Séance), une autre au toucher, sept thèmes, routine cliquable', async ({ page }) => {
  await page.goto('./#astuces');
  const tip = await page.locator('#tip-text').textContent();
  expect((tip || '').length).toBeGreaterThan(20);
  await page.locator('#tip-next').tap();
  await expect(page.locator('#tip-text')).not.toHaveText(tip || '');
  await expect(page.locator('#tip-list details')).toHaveCount(7);
  await page.locator('#tip-list summary', { hasText: 'Sur iPhone' }).tap();
  await expect(page.locator('#tip-list details[open] li')).toHaveCount(8);
  await page.locator('#routine a', { hasText: 'Main gauche' }).tap();
  await expect(page.locator('#v-gauche')).toBeVisible();
  await page.goto('./#seance');
  await expect(page.locator('#tip-mini-t')).toHaveText(tip || '');          // la même astuce toute la journée
  await page.locator('#tip-mini').tap();
  await expect(page.locator('#v-astuces')).toBeVisible();
});

test('I4. l’astuce change chaque jour et reste dans la liste', async ({ page }) => {
  await page.goto('./#astuces');
  // @ts-ignore
  const r = await page.evaluate(() => { const a = tipIndex(new Date(2026, 10, 15, 8)), b = tipIndex(new Date(2026, 10, 15, 23)), c = tipIndex(new Date(2026, 10, 16, 0)), old = tipIndex(new Date(2020, 0, 1));
    return { same: a === b, next: c === (a + 1) % TIPS.length, n: TIPS.length, inRange: old >= 0 && old < TIPS.length }; });
  expect(r).toEqual({ same: true, next: true, n: 46, inRange: true });
});

test('I5. Séance au doigt : mesure suivante, écoute et portée utilisables sur l’iPhone', async ({ page }) => {
  await page.goto('./#seance');
  await page.locator('#wk-next').tap();
  await expect(page.locator('#wk-pos')).toHaveText('Mesure 2/16');
  await page.locator('#wk-play').tap();
  // @ts-ignore
  expect(await page.evaluate(() => AC.state)).toBe('running');
  const box = await page.locator('#wk-staff').boundingBox();
  expect(box && box.width).toBeGreaterThan(330);
  expect(box && box.x + box.width).toBeLessThanOrEqual(414);
});
