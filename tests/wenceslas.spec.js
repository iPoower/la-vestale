// @ts-check
// Good King Wenceslas comme la feuille du cours : Do4 en clé de fa (main gauche) aux mesures 4, 8, 12 et 17 ;
// mesure 14 : Si3 en blanche à la main gauche sous le Ré.
const { test, expect } = require('@playwright/test');

test('GW1. mains comme la feuille : Do4 à la main gauche (mesures 4, 8, 12, 17), Si3 en mesure 14', async ({ page }) => {
  await page.goto('./#coach');
  // @ts-ignore
  const b = await page.evaluate(() => workBars('wenceslas').map(x => ({ rh: x.rh.map(e => e[0] ? e[0][0] : null), lh: x.lh.map(e => [e[0] ? e[0][0] : null, e[1]]) })));
  expect(b.length).toBe(17);
  for (const i of [3, 7, 11]) {
    expect(b[i].rh, 'mesure ' + (i + 1)).toEqual([null]);                        // pause à la main droite
    expect(b[i].lh, 'mesure ' + (i + 1)).toEqual([[60, 2], [60, 2]]);           // Do4 Do4 en blanches, clé de fa
  }
  expect(b[16].rh).toEqual([null]);
  expect(b[16].lh).toEqual([[60, 4]]);                                          // fin : Do4 en ronde à la main gauche
  expect(b[13].rh).toEqual([60, 60, 62]);                                       // Do Do Ré (blanche)
  expect(b[13].lh).toEqual([[null, 2], [59, 2]]);                               // demi-pause puis Si3 sous le Ré
  expect(b[15].lh).toEqual([[null, 4]]);                                        // mesure 16 : à vérifier sur la feuille
  expect(b[0].rh).toEqual([60, 60, 60, 62]);                                    // le reste ne bouge pas
  expect(b[2].lh.map(e => e[0])).toEqual([57, 55, 57, 59]);
});
