// @ts-check
// Clavier › Enchaînements : clavier complet sans défilement, partitions entières aux deux mains.
const { test, expect } = require('@playwright/test');

const lit = (page, cls) => page.$$eval(`#kb-full .key.${cls}`, ks => ks.map(k => k.getAttribute('aria-label')));
async function level(page) {
  return page.evaluate(async () => {
    // @ts-ignore
    if (window.__ctx !== AC) { window.__ctx = AC; window.__an = AC.createAnalyser(); MASTER.connect(window.__an); }
    // @ts-ignore
    const an = window.__an, buf = new Float32Array(2048); let max = 0;
    for (let i = 0; i < 10; i++) { an.getFloatTimeDomainData(buf); let s = 0; for (const v of buf) s += v * v; max = Math.max(max, Math.sqrt(s / buf.length)); await new Promise(r => setTimeout(r, 40)); }
    return max;
  });
}

test('E1. le clavier complet tient dans l’écran et contient toutes les notes, pour chaque choix', async ({ page }) => {
  await page.goto('./#clavier');
  const ids = await page.$$eval('#prog-sel button', bs => bs.map(b => b.getAttribute('data-p')));
  expect(ids).toEqual(expect.arrayContaining(['grille', 'letitbe', 'w:hymne', 'w:fontaine', 'w:tabac']));
  for (const id of ids) {
    await page.locator(`#prog-sel button[data-p="${id}"]`).click();
    const r = await page.evaluate(id => {
      const wrap = document.querySelector('#kb-full'), have = new Set([...document.querySelectorAll('#kb-full .key')].map(k => +k.getAttribute('data-m')));
      // @ts-ignore
      const pid = id.startsWith('w:') ? id.slice(2) : null, ms = [];
      // @ts-ignore
      if (pid) workBars(pid).forEach(b => [...b.rh, ...b.lh].forEach(e => e[0] && ms.push(...e[0])));
      // @ts-ignore
      else PROG[id].s.forEach(([n]) => ms.push(CH[n].b, ...voicing(n, 0)));
      // @ts-ignore
      return { scroll: wrap.scrollWidth - wrap.clientWidth, missing: ms.filter(m => !have.has(m)) };
    }, id);
    expect(r, id).toEqual({ scroll: 0, missing: [] });
  }
});

test('E2. Hymne en partition : 16 mesures, les deux mains s’allument, la mesure avance, le son joue', async ({ page }) => {
  await page.goto('./#clavier');
  await page.locator('#prog-sel button[data-p="w:hymne"]').click();
  await expect(page.locator('#prog-seq span')).toHaveCount(16);
  await expect(page.locator('#prog-seq span').nth(11)).toHaveText('12 · D/G7');
  await expect(page.locator('#prog-pat button[data-p="croches"]')).toBeDisabled();
  await page.locator('#prog-bpm').fill('110');                                  // mesure ≈ 2,2 s
  await page.locator('#prog-play').click();
  await page.waitForTimeout(400);
  expect(await lit(page, 'hl')).toEqual(['Mi5']);                               // main droite : Mi5
  expect((await lit(page, 'hl2')).sort()).toEqual(['Do3', 'Mi3', 'Sol3']);      // main gauche : accord C
  await expect(page.locator('#prog-seq span.now')).toHaveText('1 · C');
  expect(await level(page)).toBeGreaterThan(0.02);
  await page.waitForTimeout(2300);
  await expect(page.locator('#prog-seq span.now')).toHaveText('2 · G7');
  expect((await lit(page, 'hl2')).sort()).toEqual(['Fa3', 'Si2', 'Sol3']);
  await page.locator('#prog-stop').click();
  await expect(page.locator('#kb-full .key.hl, #kb-full .key.hl2')).toHaveCount(0);
  await expect(page.locator('#prog-seq span.now')).toHaveCount(0);
});

test('E3. grilles d’accords : basse (vert) et accord (doré) sur le clavier complet', async ({ page }) => {
  await page.goto('./#clavier');
  await page.locator('#prog-sel button[data-p="cadence"]').click();
  await expect(page.locator('#prog-pat button[data-p="croches"]')).toBeEnabled();
  await page.locator('#prog-play').click();
  await page.waitForTimeout(300);
  expect((await lit(page, 'hl')).sort()).toEqual(['Do4', 'Mi4', 'Sol4']);
  expect(await lit(page, 'hl2')).toEqual(['Do3']);
  await page.locator('#prog-stop').click();
  await expect(page.locator('#kb-full .key.hl, #kb-full .key.hl2')).toHaveCount(0);
});

test('E4. J’ai du bon tabac en partition : 24 mesures, silence de fin de phrase respecté', async ({ page }) => {
  await page.goto('./#clavier');
  await page.locator('#prog-sel button[data-p="w:tabac"]').click();
  await expect(page.locator('#prog-seq span')).toHaveCount(24);
  await expect(page.locator('#prog-src')).toContainText('toute la partition, deux mains (24 mesures)');
  await page.locator('#prog-bpm').fill('110');
  await page.locator('#prog-play').click();
  await page.waitForTimeout(400 + 3 * 60000 / 110 * 4 + 3 * 60000 / 110);        // mesure 4, 4e temps : silence
  await expect(page.locator('#prog-seq span.now')).toHaveText('4 · C');
  expect(await lit(page, 'hl')).toEqual([]);
  expect(await lit(page, 'hl2')).toEqual([]);
  await page.locator('#prog-stop').click();
});
