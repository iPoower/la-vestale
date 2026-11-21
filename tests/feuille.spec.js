// @ts-check
// « La feuille fait foi » : un morceau tiré d'une feuille du cours écrit sa tonalité (et l'absence d'armure) dans sa source ;
// l'app ne la devine jamais (erreur passée : « Il y a ton sourire » affiché en Sol majeur avec un ♯ à la clé).
const { test, expect } = require('@playwright/test');

test('FF1. chaque morceau « d’après ta feuille » écrit sa tonalité ; l’armure affichée la respecte', async ({ page }) => {
  await page.goto('./');
  // @ts-ignore
  const r = await page.evaluate(() => Object.keys(WORK).filter(id => /ta feuille/.test(WORK[id].src || '')).map(id => {
    const src = WORK[id].src, m = src.match(/(Do|Ré|Mi|Fa|Sol|La|Si)(♯|♭)? (majeur|mineur)/), k = dcKey(id);
    return { id, ecrite: m ? m[0] : null, affichee: k.name, armure: k.sig.length, nosig: !!WORK[id].nosig, sansArmureDit: /sans armure/.test(src) };
  }));
  expect(r.length).toBeGreaterThanOrEqual(8);
  for (const x of r) {
    expect(x.ecrite, x.id + ' : tonalité écrite dans la source').not.toBeNull();
    expect(x.affichee, x.id + ' : tonalité affichée = tonalité écrite').toBe(x.ecrite);
    expect(x.nosig, x.id + ' : « sans armure » dans la source ⇔ nosig').toBe(x.sansArmureDit);
    if (x.nosig) expect(x.armure, x.id + ' : rien à la clé').toBe(0);
  }
  // les deux cas de la feuille de Saez : Mi mineur, sans armure
  expect(r.find(x => x.id === 'sourire')).toMatchObject({ ecrite: 'Mi mineur', armure: 0, nosig: true });
});
