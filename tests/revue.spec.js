// @ts-check
// Corrections issues d'une revue externe (musicien et développeur) : un test par constat.
const { test, expect } = require('@playwright/test');

/** Remplace une fonction globale de l'app par un espion qui note ses appels (puis appelle l'originale). */
async function spy(page, name) {
  await page.evaluate(name => {
    // @ts-ignore
    const orig = window[name]; window['__' + name] = [];
    // @ts-ignore
    window[name] = function (...a) { window['__' + name].push(a); return orig.apply(this, a); };
  }, name);
}
// @ts-ignore
const calls = (page, name) => page.evaluate(n => window['__' + n], name);

test('V1. « Deux mains » sur téléphone : tout le morceau visible, toutes les touches allumées à l’écran', async ({ page }) => {
  for (const id of ['hymne', 'fontaine', 'tabac']) {
    await page.goto('./#seance');
    await page.locator('#wk-piece').selectOption(id);
    const r = await page.evaluate(() => {
      const w = document.querySelector('#kb-wk'), box = w.getBoundingClientRect();
      const lit = [...w.querySelectorAll('.key.hl, .key.hl2')].map(k => k.getBoundingClientRect());
      return { scroll: w.scrollWidth - w.clientWidth, n: lit.length, outside: lit.filter(b => b.left < box.left - 1 || b.right > box.right + 1).length };
    });
    expect(r.scroll, id).toBe(0);
    expect(r.n, id).toBeGreaterThan(1);
    expect(r.outside, id).toBe(0);
  }
});

test('V2. boucle au tempo exact : une reprise toutes les 2,40 s à noire = 100', async ({ page }) => {
  await page.goto('./#seance');
  await spy(page, 'playNote');
  await page.locator('#wk-hands button[data-h="rh"]').click();
  await page.locator('#wk-bpm').fill('100');
  await page.locator('#wk-loop').check();
  await page.locator('#wk-play').click();
  await page.waitForTimeout(5300);
  await page.locator('#wk-stop').click();
  const starts = (await calls(page, 'playNote')).filter(c => c[0] === 76 && c[1] > 0).map(c => c[1]);
  // Mesure 1 de l'Hymne : Mi5 Mi5 Fa5 Sol5 → deux Mi5 par tour ; on garde le premier de chaque tour.
  const firsts = starts.filter((t, i) => i % 2 === 0);
  expect(firsts.length).toBeGreaterThanOrEqual(3);
  for (let i = 1; i < firsts.length; i++) expect(Math.abs(firsts[i] - firsts[i - 1] - 2.4)).toBeLessThan(0.001);
});

test('V2 bis. décompte d’une mesure, clic sur chaque temps, et « 2 mesures » enchaînées', async ({ page }) => {
  await page.goto('./#seance');
  await spy(page, 'playNote'); await spy(page, 'click');
  await page.locator('#wk-bpm').fill('100');
  await page.locator('#wk-click').check();
  await page.locator('#wk-span button[data-n="2"]').click();
  await page.locator('#wk-play').click();
  await page.waitForTimeout(300);
  const clicks = (await calls(page, 'click')).map(c => c[0]);
  const notes = await calls(page, 'playNote');
  expect(clicks.length).toBe(12);                                   // 4 de décompte + 4 × 2 mesures
  const first = Math.min(...notes.map(n => n[1]));
  expect(Math.abs(first - clicks[0] - 2.4)).toBeLessThan(0.001);    // la musique part après la mesure de décompte
  const rh = notes.filter(n => n[0] >= 60).map(n => n[0]);
  expect(rh).toEqual([76, 76, 77, 79, 79, 77, 76, 74]);             // mesures 1 et 2 de l'Hymne, main droite
  await page.locator('#wk-stop').click();
});

test('V3. « Croches arpégées » garde la septième de G7 et de F7M', async ({ page }) => {
  await page.goto('./#clavier');
  await spy(page, 'playNote');
  await page.locator('#prog-sel button[data-p="cadence"]').click();
  await page.locator('#prog-pat button[data-p="croches"]').click();
  await page.locator('#prog-play').click();
  await page.locator('#prog-stop').click();
  expect((await calls(page, 'playNote')).map(c => c[0])).toContain(77);   // Fa de G7
  await spy(page, 'playNote');
  await page.locator('#prog-sel button[data-p="letitbe"]').click();
  await page.locator('#prog-play').click();
  await page.locator('#prog-stop').click();
  expect((await calls(page, 'playNote')).map(c => c[0])).toContain(76);   // Mi de F7M
});

test('V4. exercice C ↔ G7 : Sol3 est la 1re touche Sol à gauche du Do du milieu', async ({ page }) => {
  await page.goto('./#clavier');
  await expect(page.locator('#mg-card')).toContainText('1re touche Sol à gauche du Do du milieu');
  await expect(page.locator('#mg-card')).not.toContainText('2e touche Sol');
});

test('V5. le service worker ne supprime jamais les caches des autres apps de l’adresse', async ({ page }) => {
  await page.addInitScript(() => { caches.open('race-control-essai'); caches.open('la-vestale-v1'); });
  await page.goto('./');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(500);
  const keys = await page.evaluate(() => caches.keys());
  expect(keys).toContain('race-control-essai');                      // autre app : intact
  expect(keys).not.toContain('la-vestale-v1');                       // notre ancienne version : nettoyée
});

test('V6. « Comparer » en mode « Quel accord » joue les six accords', async ({ page }) => {
  await page.goto('./#oreille');
  await page.locator('#ear-mode button[data-m="nom"]').click();
  await spy(page, 'seqChords');
  await page.locator('#ear-cmp').click();
  expect((await calls(page, 'seqChords'))[0][0]).toEqual(['C', 'F', 'G', 'Am', 'Dm', 'Em']);
});

test('V7. écran allumé pendant le métronome ; le métronome continue dans les autres onglets', async ({ page }) => {
  await page.addInitScript(() => {
    // @ts-ignore
    window.__wl = [];
    // @ts-ignore
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async () => { window.__wl.push('demande'); return { release: async () => { window.__wl.push('libère'); }, addEventListener() {} }; } } });
  });
  await page.goto('./#tempo');
  await page.locator('#mt-go').click();
  await page.locator('#tabs a[data-v="seance"]').click();
  // @ts-ignore
  expect(await page.evaluate(() => MT.on)).toBe(true);
  await expect(page.locator('#mt-chip')).toBeVisible();
  await expect(page.locator('#mt-chip')).toContainText('Arrêter');
  await page.locator('#mt-chip').click();
  // @ts-ignore
  expect(await page.evaluate(() => MT.on)).toBe(false);
  await expect(page.locator('#mt-chip')).toBeHidden();
  // @ts-ignore
  await expect.poll(() => page.evaluate(() => window.__wl)).toEqual(['demande', 'libère']);
});

test('V8. confort : chiffres alignés, liens « Ouvrir » au doigt, octave française signalée', async ({ page }) => {
  await page.goto('./#tempo');
  expect(await page.locator('#mt-bpm').evaluate(e => getComputedStyle(e).fontVariantNumeric)).toContain('lining-nums');
  await page.goto('./#seance');
  const h = await page.locator('#blocks a').first().evaluate(e => e.getBoundingClientRect().height);
  expect(h).toBeGreaterThanOrEqual(44);
  await page.goto('./#clavier');
  await expect(page.locator('#v-clavier .hint').first()).toContainText('En France, on l’appelle souvent Do3');
});
