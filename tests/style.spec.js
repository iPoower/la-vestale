// @ts-check
// Morceaux « ton style » : Burgmüller, Schumann, Bach, Alkan, Liszt, Debussy (domaine public ou Creative Commons, Mutopia).
const { test, expect } = require('@playwright/test');

test('S1. sept morceaux libres, rangés et attribués ; Clair de lune en 9/8 (trois grands temps)', async ({ page }) => {
  await page.goto('./#seance');
  // @ts-ignore
  const r = await page.evaluate(() => ['candeur', 'arabesqueb', 'schumann1', 'bach846', 'alkan311', 'liszt3', 'clairlune'].map(id => [id, workBars(id).length, WORK[id].bpb, /Mutopia/.test(WORK[id].src)]));
  expect(r).toEqual([['candeur', 23, 4, true], ['arabesqueb', 33, 2, true], ['schumann1', 22, 2, true], ['bach846', 35, 4, true], ['alkan311', 10, 4, true], ['liszt3', 61, 4, true], ['clairlune', 72, 4.5, true]]);
  await expect(page.locator('#wk-piece optgroup[label="Niveau 4 · Avancé"] option')).toHaveText(['Prélude op. 31 n° 1 — Alkan', 'La chanson de la folle — Alkan', 'Consolation n° 3 — Liszt']);
  await expect(page.locator('#wk-piece optgroup[label="Niveau 5 · Objectif"] option')).toHaveText(['Clair de lune — Debussy']);
  await page.locator('#wk-piece').selectOption('liszt3');
  await expect(page.locator('#wk-src')).toContainText('Creative Commons BY 3.0');
  await page.locator('#wk-piece').selectOption('alkan311');
  await expect(page.locator('#wk-src')).toContainText('BY-SA 3.0');
});

test('S2. Prélude de Bach, mesure 1 : Do–Mi à gauche, Sol–Do–Mi brisés à droite', async ({ page }) => {
  await page.goto('./#seance');
  // @ts-ignore
  const b = await page.evaluate(() => { const m = workBars('bach846')[0]; return { rh: [...new Set(m.rh.flatMap(e => e[0] || []))].sort(), lh: [...new Set(m.lh.flatMap(e => e[0] || []))].sort() }; });
  expect(b.lh).toEqual([60, 64]);                                        // Do4, Mi4 tenus
  expect(b.rh).toEqual([67, 72, 76]);                                    // Sol4, Do5, Mi5
});

test('S3. temps composés : clic sur 3 grands temps (Clair de lune), 2 (Alkan 6/8)', async ({ page }) => {
  await page.goto('./#seance');
  for (const [id, want] of [['clairlune', 3], ['alkan8', 2], ['bach846', 4]]) {
    await page.locator('#wk-piece').selectOption(id);
    await page.locator('#wk-click').check();
    await page.evaluate(() => { /* @ts-ignore */ const o = window.click; window.__c = 0; window.click = function (...a) { window.__c++; return o.apply(this, a); }; });
    await page.locator('#wk-play').click();
    // @ts-ignore
    const n = await page.evaluate(() => window.__c);
    // décompte d'une mesure + la mesure jouée
    expect(n % want, id).toBe(0);
    expect(n / want, id).toBeGreaterThanOrEqual(1);
    await page.locator('#wk-stop').click();
    await page.evaluate(() => { /* @ts-ignore */ window.click = window.click; });
  }
  await page.locator('#wk-piece').selectOption('clairlune');
  for (let i = 0; i < 4; i++) await page.locator('#wk-next').click();                 // mesure 5 : trois grands temps de croches
  expect(await page.$$eval('#wk-staff .cnt', c => c.map(x => x.textContent).join(' '))).toBe('1 · · 2 · · 3 · ·');
});

test('S5. Enchaînements : un long morceau démarre vite et se programme par tranches (Clair de lune)', async ({ page }) => {
  await page.goto('./#clavier');
  await page.locator('#prog-sel button[data-p="w:clairlune"]').click();
  await page.locator('#prog-bpm').fill('110');
  await page.evaluate(() => { /* @ts-ignore */ const o = window.playNote; window.__n = 0; window.playNote = function (...a) { window.__n++; return o.apply(this, a); }; });
  await page.locator('#prog-play').click();
  // @ts-ignore
  const first = await page.evaluate(() => window.__n);
  expect(first).toBeGreaterThan(10);
  expect(first).toBeLessThan(400);                                     // pas les 1 467 notes d'un coup
  await page.waitForTimeout(4000);
  // @ts-ignore
  expect(await page.evaluate(() => window.__n)).toBeGreaterThan(first); // la suite arrive en route
  await page.locator('#prog-stop').click();
  // @ts-ignore
  const stopped = await page.evaluate(() => window.__n);
  await page.waitForTimeout(3000);
  // @ts-ignore
  expect(await page.evaluate(() => window.__n)).toBe(stopped);          // Stop arrête aussi la programmation
});

test('S4. chemin vers Alkan : étapes 2, 3 et 4 complétées', async ({ page }) => {
  await page.goto('./#morceaux');
  await expect(page.locator('#path li').nth(1)).toContainText('La candeur');
  await expect(page.locator('#path li').nth(2)).toContainText('Prélude op. 31 n° 1');
  await expect(page.locator('#path li').nth(3)).toContainText('Clair de lune');
  await expect(page.locator('#path li').nth(3)).toContainText('0/2 prêts');
});

test('S6. partitions complètes : un lien PDF gratuit pour chaque morceau libre, sur la carte et dans Séance', async ({ page }) => {
  await page.goto('./#morceaux');
  const links = await page.$$eval('#pieces a[data-pdf]', a => a.map(x => [x.dataset.pdf, x.getAttribute('href'), x.getAttribute('target'), x.getAttribute('rel')]));
  expect(links.map(l => l[0]).sort()).toEqual(['alkan311', 'alkan8', 'arabesqueb', 'bach120', 'bach846', 'candeur', 'clairlune', 'liszt3', 'schumann1']);
  expect(links.every(([, h, tg, rel]) => /^https:\/\/www\.mutopiaproject\.org\/ftp\/.+-a4\.pdf$/.test(h) && tg === '_blank' && rel === 'noopener')).toBe(true);
  await page.goto('./#seance');
  await page.locator('#wk-piece').selectOption('liszt3');
  await expect(page.locator('#wk-pdf a')).toHaveText('Partition complète (PDF)');
  await page.locator('#wk-piece').selectOption('hymne');
  await expect(page.locator('#wk-pdf a')).toHaveCount(0);                // pas de PDF pour un air sans édition Mutopia
});
