// @ts-check
// Titres rangés partout (même ordre) et aide au solfège : la mesure sur la portée, noms et comptage.
const { test, expect } = require('@playwright/test');

test('R1. Séance : morceaux rangés par groupes, titres harmonisés, exercices et partitions à part', async ({ page }) => {
  await page.goto('./#seance');
  const groups = await page.$$eval('#wk-piece optgroup', gs => gs.map(g => g.getAttribute('label')));
  expect(groups).toEqual(['Niveau 1 · Débutant', 'Niveau 2 · Facile', 'Niveau 3 · Intermédiaire', 'Niveau 4 · Avancé', 'Niveau 5 · Objectif', 'Exercices de main gauche']);
  const opts = await page.$$eval('#wk-piece option', os => os.map(o => o.textContent));
  expect(opts.slice(0, 7)).toEqual(['Hymne à la joie', 'À la claire fontaine', 'J’ai du bon tabac', 'Au clair de la lune', 'Frère Jacques', 'Ah ! vous dirai-je maman', 'Good King Wenceslas']);
  expect(opts).toContain('Bébé s’endort — Chrétien');
  expect(opts).toContain('La chanson de la folle — Alkan');
  expect(opts.some(o => /Main gauche ·|\(Bach\)|\(Chrétien\)|Alkan ·/.test(o))).toBe(false);
});

test('R2. Enchaînements, Répertoire et Tempo suivent le même rangement', async ({ page }) => {
  await page.goto('./#clavier');
  expect(await page.$$eval('#prog-sel .grp', s => s.map(x => x.textContent))).toEqual(['Grilles d’accords', 'Partitions complètes']);
  expect(await page.locator('#prog-sel button', { hasText: '· partition' }).count()).toBe(0);
  await page.goto('./#morceaux');
  expect(await page.$$eval('#pieces .grp-h > span:first-child', s => s.map(x => x.textContent))).toEqual(['Niveau 1 · Débutant', 'Niveau 2 · Facile', 'Niveau 3 · Intermédiaire', 'Niveau 4 · Avancé', 'Niveau 5 · Objectif']);
  await expect(page.locator('#pieces article.piece')).toHaveCount(32);
  await page.goto('./#tempo');
  expect(await page.$$eval('#mt-preset > option', o => o.map(x => x.value))).toEqual(['libre']);
  expect(await page.$$eval('#mt-preset optgroup', g => g.length)).toBe(5);
});

test('R3. portée : notes de la mesure, noms, comptage « 1 2 3 4 » ; liaisons et altérations visibles', async ({ page }) => {
  await page.goto('./#seance');
  await expect(page.locator('#wk-staff-box')).toHaveAttribute('open', '');
  // Hymne, mesure 1 : 4 noires à droite + accord de 3 notes à gauche
  await expect(page.locator('#wk-staff .nh')).toHaveCount(7);
  expect(await page.$$eval('#wk-staff .cnt', c => c.map(x => x.textContent))).toEqual(['1', '2', '3', '4']);
  expect(await page.$$eval('#wk-staff .nm', c => c.map(x => x.textContent))).toContain('Do Mi Sol');
  // Bébé s'endort, mesure 8 : Mi♭ à la main gauche, croches non (blanche + noire + soupir)
  await page.locator('#wk-piece').selectOption('bebe');
  for (let i = 0; i < 7; i++) await page.locator('#wk-next').click();
  expect(await page.$$eval('#wk-staff .acc', a => a.map(x => x.textContent))).toEqual(['♭']);   // Mi♭ (gauche) ; le Fa♯ est à la clé (Sol majeur)
  await expect(page.locator('#wk-staff .ks')).toHaveCount(2);                                      // un ♯ par portée
  await expect(page.locator('#wk-key')).toHaveText('Tonalité : Sol majeur · Fa♯ à la clé');
  await expect(page.locator('#wk-staff .rest')).toHaveCount(1);
  // Mesure 2 : Sol grave lié depuis la mesure 1 (marqué ⁀) ; croches comptées « et »
  for (let i = 0; i < 6; i++) await page.locator('#wk-prev').click();
  expect(await page.$$eval('#wk-staff .nm', c => c.map(x => x.textContent))).toContain('Sol⁀ Do');
  expect(await page.$$eval('#wk-staff .cnt', c => c.map(x => x.textContent))).toEqual(['1', 'et', '2', 'et', '3']);
});

test('R4. la portée suit les mains choisies, le réglage des noms, et tient à l’écran', async ({ page }) => {
  await page.goto('./#seance');
  await page.locator('#wk-hands button[data-h="rh"]').click();
  await expect(page.locator('#wk-staff .nh')).toHaveCount(4);
  await page.goto('./#clavier');
  await page.locator('#noms button[data-n="en"]').click();
  await page.goto('./#seance');
  expect(await page.$$eval('#wk-staff .nm', c => c.map(x => x.textContent))).toContain('E');
  const r = await page.evaluate(() => { const s = document.querySelector('#wk-staff').getBoundingClientRect(); return [s.right <= document.documentElement.clientWidth, document.documentElement.scrollWidth - document.documentElement.clientWidth]; });
  expect(r).toEqual([true, 0]);
});

test('R5. chaque mesure de chaque morceau et exercice se dessine sans erreur', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('./#seance');
  // @ts-ignore
  const bad = await page.evaluate(() => { const out = []; for (const id of Object.keys(WORK)) { wkSelect(id); workBars(id).forEach((b, i) => { wkGo(i);
    const n = document.querySelectorAll('#wk-staff .nh').length, want = [...b.rh, ...b.lh].reduce((s, e) => s + (e[0] ? e[0].length : 0), 0); if (n !== want) out.push(`${id} m${i + 1} ${n}/${want}`); }); } return out; });
  expect(bad).toEqual([]);
  expect(errors).toEqual([]);
});

test('R6. notes très graves ou très aiguës : écrites une octave plus près avec « 8vb » / « 8va », sans sortir du cadre', async ({ page }) => {
  await page.goto('./#seance');
  await page.locator('#wk-piece').selectOption('alkan8');
  await expect(page.locator('#wk-staff .oct')).toContainText('8vb');
  const maxY = await page.$$eval('#wk-staff .nh', n => Math.max(...n.map(e => +e.getAttribute('cy'))));
  expect(maxY).toBeLessThan(220);                                     // au-dessus des noms et du comptage
});
