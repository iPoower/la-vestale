// @ts-check
// Alignement complet sur les feuilles du cours (Recueil des cours + Il y a ton sourire) :
// Ah ! vous dirai-je maman (n° 54), Good King Wenceslas, Imagine, Hymne à la joie, Orientale, Le Petit Poney,
// À la claire fontaine, Deux études de Gurlitt (p. 17).
const { test, expect } = require('@playwright/test');

test('AL1. Ah ! vous dirai-je maman (n° 54) : Sol majeur sans armure, 2 mains, 4 noires m. 2/6/10, doigtés imprimés', async ({ page }) => {
  await page.goto('./#coach');
  await page.locator('#dc-piece').selectOption('twinkle');
  // @ts-ignore
  const r = await page.evaluate(() => {
    const k = dcKey('twinkle'), bs = workBars('twinkle');
    const fmt = evs => evs.map(e => [e[0] ? e[0][0] : null, e[1], e[2] ? e[2][0] : null]);
    return { key: k.name, sig: k.sig.length, nosig: !!WORK.twinkle.nosig, n: bs.length,
      m1: { lh: fmt(bs[0].lh), rh: fmt(bs[0].rh) },
      m2: { lh: fmt(bs[1].lh), rh: fmt(bs[1].rh) },
      m3: { lh: fmt(bs[2].lh), rh: fmt(bs[2].rh) },
      m4: { lh: fmt(bs[3].lh), rh: fmt(bs[3].rh) },
      m6: { lh: fmt(bs[5].lh), rh: fmt(bs[5].rh) },
      m9: { lh: fmt(bs[8].lh), rh: fmt(bs[8].rh) },
      m10: { lh: fmt(bs[9].lh), rh: fmt(bs[9].rh) },
      m12: { lh: fmt(bs[11].lh), rh: fmt(bs[11].rh) } };
  });
  expect(r.key).toBe('Sol majeur');
  expect(r.nosig).toBe(true);
  expect(r.sig).toBe(0);
  expect(r.n).toBe(12);
  expect(r.m1).toEqual({ lh: [[55, 1, 3], [55, 1, null], [null, 2, null]], rh: [[null, 2, null], [62, 1, 2], [62, 1, null]] });
  expect(r.m2.rh).toEqual([[64, 1, null], [64, 1, null], [62, 1, null], [62, 1, null]]);
  expect(r.m3).toEqual({ rh: [[60, 1, null], [60, 1, null], [null, 2, null]], lh: [[null, 2, null], [59, 1, 1], [59, 1, null]] });
  expect(r.m4.lh).toEqual([[57, 1, null], [57, 1, null], [55, 2, null]]);
  expect(r.m6.lh).toEqual([[59, 1, null], [59, 1, null], [57, 1, null], [57, 1, null]]);
  expect(r.m9.rh).toEqual([[null, 2, null], [62, 1, 2], [62, 1, null]]);
  expect(r.m10.rh).toEqual([[64, 1, null], [64, 1, null], [62, 1, null], [62, 1, null]]);
  expect(r.m12.lh).toEqual([[57, 1, null], [57, 1, null], [55, 2, null]]);
  await expect(page.locator('#wk-staff .ks')).toHaveCount(0);                    // aucune armure dessinée à la clé
});

test('AL2. Imagine : C (3 temps), CM7 (1 temps), F (4 temps) × 2', async ({ page }) => {
  await page.goto('./#clavier');
  // @ts-ignore
  const seq = await page.evaluate(() => PROG.imagine.s);
  expect(seq).toEqual([['C', 3], ['C7M', 1], ['F', 4], ['C', 3], ['C7M', 1], ['F', 4]]);
  await page.locator('#prog-sel button[data-p="imagine"]').click();
  await expect(page.locator('#prog-src')).toContainText('C (3 temps) – CM7 (4e temps) | F (4 temps)');
});

test('AL3. Hymne m. 10 (crayon séparé de l’imprimé), Fontaine sans date, Poney mesures 4 et 8', async ({ page }) => {
  await page.goto('./#seance');
  // @ts-ignore
  const r = await page.evaluate(() => {
    const h10 = workBars('hymne')[9].rh;
    return {
      hymneM10LastFinger: h10[h10.length - 1][2],
      hymneSrc: WORK.hymne.src,
      fontaineMelSrc: MEL.fontaine.src,
      poneyNote: MG.poney.note,
      orientaleMg: MG.orientale,
    };
  });
  expect(r.hymneM10LastFinger).toBeNull();                                      // le « 1 » m. 10 est au crayon, pas imprimé
  expect(r.hymneSrc).toContain('crayon');
  expect(r.fontaineMelSrc).not.toMatch(/\d{2}\/\d{2}/);                         // aucune date de cours dans le dépôt
  expect(r.poneyNote).toContain('mesure 4');
  expect(r.poneyNote).toContain('mesure 8');
  expect(r.orientaleMg).toMatchObject({ ok: true, pos: [[5, 45], [1, 52]] });
});

test('AL4. Deux études de Gurlitt (p. 17) : 16 mesures, Do majeur, doigtés imprimés et portée valide', async ({ page }) => {
  await page.goto('./#coach');
  await page.locator('#dc-piece').selectOption('gurlitt');
  await expect(page.locator('#dc-id')).toContainText('Do majeur · aucune altération à la clé');
  // @ts-ignore
  const r = await page.evaluate(() => {
    const bs = workBars('gurlitt');
    return {
      n: bs.length,
      m1rh: bs[0].rh.map(e => [e[0][0], e[1], e[2] ? e[2][0] : null]),
      m1lh: bs[0].lh.map(e => [e[0][0], e[1], e[2] ? e[2][0] : null]),
      m8lh: bs[7].lh.map(e => [e[0][0], e[1], e[2] ? e[2][0] : null]),
      m9rh: bs[8].rh.map(e => [e[0][0], e[1], e[2] ? e[2][0] : null]),
      m9lh: bs[8].lh.map(e => [e[0][0], e[1], e[2] ? e[2][0] : null]),
      m16: [bs[15].rh[0][0][0], bs[15].lh[0][0][0], bs[15].lh[0][2][0]],
    };
  });
  expect(r.n).toBe(16);
  expect(r.m1rh).toEqual([[76, 1, 3], [72, 1, 1], [74, 1, null], [76, 1, null]]);
  expect(r.m1lh).toEqual([[48, 4, 5]]);
  expect(r.m8lh).toEqual([[52, 1, 3], [55, 1, 1], [48, 2, 5]]);
  expect(r.m9rh).toEqual([[72, 4, 1]]);
  expect(r.m9lh).toEqual([[52, 1, 3], [55, 1, 1], [53, 1, null], [52, 1, null]]);
  expect(r.m16).toEqual([72, 52, 3]);
  await expect(page.locator('#wk-staff .nh')).toHaveCount(5);                   // mesure 1 : 4 noires MD + 1 ronde MG
});
