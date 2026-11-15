// @ts-check
// Écoute réaliste (Clavier › Enchaînements) : tempo de la partition, reprises, nuances, pédale, ralenti final.
const { test, expect } = require('@playwright/test');

/** Programme une partition entière d'un coup (sans attendre les tranches) et renvoie les notes : [note, début s, durée s, volume]. */
const schedule = (page, id) => page.evaluate(id => {
  // @ts-ignore
  const a = ac(); let fake = a.currentTime; Object.defineProperty(a, 'currentTime', { configurable: true, get: () => fake });
  // @ts-ignore
  const notes = [], o = window.playNote, o2 = window.at; window.playNote = (m, t, d, v) => notes.push([m, t, d, v]);
  // @ts-ignore
  window.at = (s, fn) => { if (String(fn).includes('horizon')) { fake += 1e5; fn(); } };   // tranche suivante tout de suite
  // @ts-ignore
  try { playPiece(id); } finally { window.playNote = o; window.at = o2; delete a.currentTime; stopBus(); }
  const t0 = Math.min(...notes.map(n => n[1]));
  return notes.map(([m, t, d, v]) => [m, +(t - t0).toFixed(3), +d.toFixed(3), +v.toFixed(3)]); }, id);

test('R1. choisir une partition met son tempo de référence ; le curseur monte jusqu’à 160', async ({ page }) => {
  await page.goto('./#clavier');
  await page.locator('#prog-sel button[data-p="w:arabesqueb"]').click();
  await expect(page.locator('#prog-bpm-v')).toHaveText('132');
  expect(await page.locator('#prog-bpm').getAttribute('max')).toBe('160');
  await expect(page.locator('#prog-real-info')).toContainText('reprises et 1re / 2e fins');
  await page.locator('#prog-bpm').fill('70');
  await page.locator('#prog-tempo').click();
  await expect(page.locator('#prog-bpm-v')).toHaveText('132');
  await page.locator('#prog-sel button[data-p="cadence"]').click();               // grille d'accords : réglage masqué
  await expect(page.locator('#prog-real')).toBeHidden();
  await page.locator('#prog-sel button[data-p="w:liszt3"]').click();
  await expect(page.locator('#prog-real-info')).toContainText('pédale de l’édition');
  await page.locator('#prog-sel button[data-p="w:clairlune"]').click();
  await expect(page.locator('#prog-real-info')).toContainText('pédale automatique (approximation)');
});

test('R2. reprises : La candeur se joue 1-8, 1-8, 9-16 (1re fin), 9-15, 17 (2e fin)-23', async ({ page }) => {
  await page.goto('./#clavier');
  // @ts-ignore
  const r = await page.evaluate(() => ({ real: playOrder('candeur', 23).map(i => i + 1), ara: playOrder('arabesqueb', 33).map(i => i + 1).join(','), sans: (document.querySelector('#prog-real').checked = false, playOrder('candeur', 23).length) }));
  expect(r.real).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 9, 10, 11, 12, 13, 14, 15, 17, 18, 19, 20, 21, 22, 23]);
  expect(r.ara).toBe('1,2,3,4,5,6,7,8,9,10,3,4,5,6,7,8,9,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,28,29,30,31,32,33');
  expect(r.sans).toBe(23);                                                         // décoché : partition telle quelle
});

test('R3. nuances de l’édition (La candeur : p puis forte), sinon appui sur le 1er temps ; ralenti final', async ({ page }) => {
  await page.goto('./#clavier');
  await page.locator('#prog-sel button[data-p="w:candeur"]').click();
  await page.locator('#prog-bpm').fill('120');
  const n = await schedule(page, 'w:candeur'.slice(2));
  const vols = [...new Set(n.map(x => x[3]))];
  expect(vols.length).toBeGreaterThan(5);                                         // plusieurs nuances
  // ralenti : la dernière mesure dure plus longtemps que la première
  const starts = n.map(x => x[1]).sort((a, b) => a - b), first = starts.filter(s => s < starts[0] + 2).length;
  const end = starts[starts.length - 1];
  expect(end).toBeGreaterThan(37 * 4 * 0.5 + 0.05);                               // 38 mesures jouées : dernière mesure à 74 s sans ralenti, plus tard avec
  await page.locator('#prog-sel button[data-p="w:hymne"]').click();
  await page.locator('#prog-bpm').fill('120');
  const h = await schedule(page, 'hymne');
  const m1 = h.filter(x => x[1] < 0.6 && x[0] >= 60);                            // 1er temps, main droite
  const m2 = h.filter(x => x[1] > 0.4 && x[1] < 0.9 && x[0] >= 60);               // 2e temps
  expect(m1[0][3]).toBeGreaterThan(m2[0][3]);                                     // appui sur le 1er temps
  const rh = h.filter(x => x[0] >= 60).map(x => x[1]);
  // @ts-ignore
  const beats = await page.evaluate(() => { const b = workBars('hymne'), last = b[b.length - 1].rh, total = b.length * 4; return total - last.filter(e => e[0]).slice(-1)[0][1] - (last[last.length - 1][0] ? 0 : last[last.length - 1][1]); });
  expect(rh[rh.length - 1]).toBeGreaterThan(beats * 0.5 + 0.1);                   // la dernière note arrive plus tard : ralenti
  expect(first).toBeGreaterThan(0);
});

test('R4. pédale : Clair de lune tient les notes jusqu’au changement de basse ; décoché, durées écrites', async ({ page }) => {
  await page.goto('./#clavier');
  await page.locator('#prog-sel button[data-p="w:clairlune"]').click();
  await page.locator('#prog-bpm').fill('60');
  const withPed = await schedule(page, 'clairlune');
  await page.locator('#prog-real').uncheck();
  await page.locator('#prog-bpm').fill('60');
  const dry = await schedule(page, 'clairlune');
  expect(withPed.length).toBe(dry.length);                                         // mêmes notes
  const sum = a => a.reduce((s, x) => s + x[2], 0);
  expect(sum(withPed)).toBeGreaterThan(sum(dry) * 1.3);                            // les notes résonnent plus longtemps
  // @ts-ignore
  expect(await page.evaluate(() => [REAL.liszt3.ped.length, REAL.liszt3.ped.every(([a, b]) => b > a)])).toEqual([34, true]);
});

test('R5. décoché : lecture métronomique identique à avant (tempo constant, volumes fixes)', async ({ page }) => {
  await page.goto('./#clavier');
  await page.locator('#prog-sel button[data-p="w:hymne"]').click();
  await page.locator('#prog-real').uncheck();
  await expect(page.locator('#prog-real-info')).toContainText('Lecture métronomique');
  await page.locator('#prog-bpm').fill('120');
  const n = await schedule(page, 'hymne');
  expect([...new Set(n.map(x => x[3]))].sort()).toEqual([0.6, 0.75]);
  const rh = n.filter(x => x[0] >= 60).map(x => x[1]);
  // @ts-ignore
  const beats = await page.evaluate(() => { const b = workBars('hymne'), last = b[b.length - 1].rh, total = b.length * 4; return total - last.filter(e => e[0]).slice(-1)[0][1] - (last[last.length - 1][0] ? 0 : last[last.length - 1][1]); });
  expect(rh[rh.length - 1]).toBeCloseTo(beats * 0.5, 2);                          // dernière note à sa place exacte : pas de ralenti
  expect(n.length).toBe(await page.evaluate(() => /* @ts-ignore */ workBars('hymne').reduce((a, b) => a + [...b.rh, ...b.lh].reduce((s, e) => s + (e[0] ? e[0].filter((m, j) => (e[4] ? e[4][j] : e[1]) > 0).length : 0), 0), 0)));
});
