// @ts-check
// « Il y a ton sourire » : accompagnement complet (grille de la feuille), sans mélodie ni paroles.
const { test, expect } = require('@playwright/test');

test('S1. 33 mesures numérotées comme la feuille : intro Em, puis Em C G D huit fois', async ({ page }) => {
  await page.goto('./#seance');
  // @ts-ignore
  const ch = await page.evaluate(() => workBars('sourire').map(b => b.rh[0][3]));
  expect(ch.length).toBe(33);
  expect(ch.slice(0, 6)).toEqual(['Em', 'Em', 'C', 'G', 'D', 'Em']);
  expect([ch[16], ch[21], ch[29], ch[32]]).toEqual(['D', 'Em', 'Em', 'D']);   // mesures 17, 22, 30, 33
});

test('S2. Séance : accord nommé, quatre noires regroupées, basse au 1er temps', async ({ page }) => {
  await page.goto('./#seance');
  await page.locator('#wk-piece').selectOption('sourire');
  await expect(page.locator('#wk-pos')).toHaveText('Mesure 1/33');
  await expect(page.locator('#wk-info')).toContainText('accord Em : Si3 + Mi4 + Sol4 · doigts 1-3-5 (noire) ×4');
  await expect(page.locator('#wk-info')).toContainText('Mi2 · doigt 5 (noire)');
  await page.locator('#wk-next').click();
  await page.locator('#wk-next').click();
  await expect(page.locator('#wk-info')).toContainText('accord C : Do4 + Mi4 + Sol4 · doigts 1-3-5');
  await expect(page.locator('#wk-info')).toContainText('Do3');
  await expect(page.locator('#wk-src')).toContainText('protégées');
});

test('S3. aucune parole du morceau dans l’app', async ({ page }) => {
  await page.goto('./');
  const html = await page.content();
  for (const w of ['qui se lève', 'trajectoire', 'lueur d', 'ton âme au diable', 'éphémère']) expect(html, w).not.toContain(w);
});

test('S4. mesures 1 à 5 comme la partie piano de la feuille : positions des accords, basses, silence en mesure 2', async ({ page }) => {
  await page.goto('./#seance');
  // @ts-ignore
  const b = await page.evaluate(() => workBars('sourire').slice(0, 6).map(x => ({ rh: x.rh.map(e => e[0]), lh: x.lh.map(e => [e[0], e[1]]) })));
  const EM = [59, 64, 67], C = [60, 64, 67], G = [59, 62, 67], D = [57, 62, 66];   // Si3-Mi4-Sol4, Do4-Mi4-Sol4, Si3-Ré4-Sol4, La3-Ré4-Fa♯4
  expect(b.map(x => x.rh)).toEqual([EM, EM, C, G, D, EM].map(ch => [ch, ch, ch, ch]));   // quatre noires par mesure
  expect(b[0].lh).toEqual([[[40], 1], [null, 1], [null, 2]]);                     // mesure 1 : Mi2, soupir, demi-pause
  expect(b[1].lh).toEqual([[null, 4]]);                                             // mesure 2 : pause d'une mesure
  expect(b.slice(2, 5).map(x => x.lh[0])).toEqual([[[48], 1], [[43], 1], [[50], 1]]);  // Do3, Sol2, Ré3 au 1er temps
  await page.locator('#wk-piece').selectOption('sourire');
  await page.locator('#wk-next').click();
  await expect(page.locator('#wk-info')).not.toContainText('Mi2');                  // mesure 2 : rien à la main gauche
  for (let i = 0; i < 3; i++) await page.locator('#wk-next').click();
  await expect(page.locator('#wk-info')).toContainText('accord D : La3 + Ré4 + Fa♯4');
});

test('S5. comme la feuille : pas d’armure, le ♯ écrit devant le Fa (mesure 5) ; le déchiffrage le nomme Fa♯', async ({ page }) => {
  await page.goto('./#coach');
  await page.locator('#dc-piece').selectOption('sourire');
  await expect(page.locator('#wk-key')).toHaveText('Tonalité : Mi mineur · pas d’armure sur ta feuille : Fa♯ écrit devant la note');
  await expect(page.locator('#wk-staff .ks')).toHaveCount(0);
  await expect(page.locator('#wk-staff .acc')).toHaveCount(0);                      // mesure 1 : aucune altération
  // @ts-ignore
  await page.evaluate(() => wkGo(4));
  await expect(page.locator('#wk-staff .acc')).toHaveCount(1);                      // un seul ♯, valable jusqu'à la barre
  await expect(page.locator('#wk-staff .acc')).toHaveText('♯');
  await page.locator('#dc-hands button[data-h="rh"]').click();
  await page.locator('#dc-go').click();
  await expect(page.locator('#dc-key')).toContainText('pas d’armure');
  // @ts-ignore
  const items = await page.evaluate(() => DC.items.map(x => x.m));
  expect(items.slice(0, 3).sort()).toEqual([57, 62, 66]);
  for (const m of items.slice(0, 3)) {
    // @ts-ignore
    const l = await page.evaluate(m => spell(m).l, m);
    await page.locator(`#dc-names button[data-l="${l}"]`).click();
    if (m === 66) await expect(page.locator('#dc-fb')).toContainText('Fa♯');
    await page.locator(`#kb-dc .key[data-m="${m}"]`).dispatchEvent('pointerdown');
  }
});
