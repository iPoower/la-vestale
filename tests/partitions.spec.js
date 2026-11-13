// @ts-check
// « Mes partitions » : saisie par l'utilisateur, gardée sur l'appareil, travaillée dans Séance.
const { test, expect } = require('@playwright/test');

const LS = 'vestale-studio-v1';
/** Crée une partition depuis l'onglet Morceaux. */
async function nouvelle(page, titre, acc) {
  await page.goto('./#morceaux');
  await page.locator('#my-title').fill(titre);
  if (acc) await page.locator('#my-acc').selectOption(acc);
  await page.locator('#my-new').click();
  await expect(page.locator('#my-ed')).toBeVisible();
}
const touche = (page, nom) => page.locator(`#kb-my .key[aria-label="${nom}"]`).click();

test('P1. saisie : quatre noires remplissent la mesure, l’éditeur passe à la suivante, tout est gardé', async ({ page }) => {
  await nouvelle(page, 'Essai', 'sourire');
  await expect(page.locator('#my-fill')).toContainText('0 / 4 temps · accord de la mesure : Em');
  for (const n of ['Mi4', 'Sol4', 'Si4', 'Sol4']) await touche(page, n);
  await expect(page.locator('#my-pos')).toHaveText('Mesure 2/2');
  await expect(page.locator('#my-fill')).toContainText('accord de la mesure : Em');   // mesure 2 de la feuille : encore Em
  const mine = await page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null').mine, LS);
  expect(mine[0].bars[0].map(e => [e[0], e[1]])).toEqual([[64, 1], [67, 1], [71, 1], [67, 1]]);
  expect(mine[0].acc).toBe('sourire');
  await page.reload();
  await expect(page.locator('#my-list')).toContainText('Essai');
  await expect(page.locator('#my-list')).toContainText('2 mesures');
});

test('P2. « Travailler » : la mélodie à la main droite, la basse de l’accompagnement à la main gauche', async ({ page }) => {
  await nouvelle(page, 'Mélodie', 'sourire');
  await page.locator('#my-dur button[data-myd-d="2"]').click();
  await page.locator('#my-fg').selectOption('3');
  await touche(page, 'Si4');
  await page.locator('#my-rest').click();
  await page.locator('#my-done').click();
  await page.locator('#my-list button[data-myw]').click();
  await expect(page.locator('#v-seance')).toBeVisible();
  await expect(page.locator('#wk-pos')).toHaveText('Mesure 1/2');
  await expect(page.locator('#wk-hands button.on')).toHaveText('Deux mains');
  await expect(page.locator('#wk-info')).toContainText('Si4 · doigt 3 (blanche) · silence (blanche)');
  await expect(page.locator('#wk-info')).toContainText('Mi2 · doigt 5 (noire)');
  await expect(page.locator('#wk-src')).toContainText('reste sur cet appareil');
});

test('P3. durées : une durée trop longue est grisée ; les notes liées ne sont attaquées qu’une fois', async ({ page }) => {
  await nouvelle(page, 'Liaisons');
  await page.locator('#my-dur button[data-myd-d="1"]').click();
  await touche(page, 'Do4');
  await expect(page.locator('#my-dur button[data-myd-d="4"]')).toBeDisabled();
  await expect(page.locator('#my-dur button[data-myd-d="3"]')).toBeEnabled();
  await page.locator('#my-dur button[data-myd-d="3"]').click();
  await page.locator('#my-tie').check();
  await touche(page, 'Ré4');                                         // Ré4 blanche pointée, liée à la suivante
  await page.locator('#my-dur button[data-myd-d="2"]').click();
  await touche(page, 'Ré4');                                         // mesure 2 : Ré4 blanche (liée)
  // @ts-ignore
  const r = await page.evaluate(() => { const id = S.mine[0].id, b = workBars(id); return [b[0].rh.map(e => e[4] && e[4][0]), b[1].rh.map(e => e[4] && e[4][0])]; });
  expect(r).toEqual([[1, 5], [0, null]]);                             // 3 + 2 temps d'une seule attaque ; fin de mesure 2 complétée par un silence
});

test('P4. sécurité : données importées nettoyées, titre affiché comme du texte', async ({ page }) => {
  await page.goto('./#morceaux');
  // @ts-ignore
  const c = await page.evaluate(() => cleanData({ mine: [
    { id: 'u1', t: '<img src=x onerror="window.__x=1">', bpb: 4, acc: 'inconnu', bars: [[[60, 1, 1, 0], [999, 1, 0, 0], [62, 7, 0, 0], [64, 4, 0, 0], [null, 1, 9, 1]]] },
    { id: '../evil', t: 'x', bars: [] }, { id: 'u1', t: 'doublon' }] }).mine);
  expect(c.length).toBe(1);
  expect(c[0].acc).toBe('');
  expect(c[0].bars[0]).toEqual([[60, 1, 1, 0], [null, 1, 0, 1]]);      // note hors clavier, durée inconnue, mesure trop pleine : écartées
  await page.evaluate(m => { /* @ts-ignore */ S.mine = m; /* @ts-ignore */ mineSync(); /* @ts-ignore */ renderMine(); }, c);
  await expect(page.locator('#my-list img')).toHaveCount(0);
  await expect(page.locator('#my-list')).toContainText('<img src=x');
  // @ts-ignore
  expect(await page.evaluate(() => window.__x)).toBeUndefined();
});

test('P5. export, puis suppression avec copie de secours ; rien n’est envoyé sur le réseau', async ({ page }) => {
  const external = [];
  page.on('request', r => { if (!r.url().startsWith('http://localhost')) external.push(r.url()); });
  await nouvelle(page, 'À supprimer');
  await touche(page, 'La4');
  await page.locator('#my-done').click();
  // @ts-ignore
  const exp = await page.evaluate(() => JSON.parse(JSON.stringify({ data: snapData() })).data.mine.length);
  expect(exp).toBe(1);
  await page.locator('#my-list button[data-myd]').click();
  await page.locator('#dlg-ok').click();
  await expect(page.locator('#my-list')).toContainText('Aucune partition');
  // @ts-ignore
  const r = await page.evaluate(() => ({ work: Object.keys(WORK).some(k => WORK[k].mine), snap: loadSnaps().some(s => s.why === 'suppression' && s.data.mine.length === 1) }));
  expect(r).toEqual({ work: false, snap: true });
  expect(external).toEqual([]);
  const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(scroll).toBeLessThanOrEqual(0);
});

test('P6. le fichier exporté contient les partitions ; l’import les restaure sur un appareil vide', async ({ page }) => {
  await nouvelle(page, 'Voyage');
  await touche(page, 'Fa♯4');
  await page.locator('#my-done').click();
  await page.goto('./#journal');
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#bk-export').click()]);
  const body = require('fs').readFileSync(await download.path(), 'utf8');
  const j = JSON.parse(body);
  expect(j.data.mine[0].t).toBe('Voyage');
  expect(j.data.mine[0].bars[0][0][0]).toBe(66);
  j.data.seances = [{ id: 's1', ts: Date.now(), d: '2026-11-10', min: 10 }];   // un import doit contenir au moins le tableau des séances
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('#bk-file').setInputFiles({ name: 'sauvegarde.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(j)) });
  await page.locator('#dlg-ok').click();
  await page.goto('./#morceaux');
  await expect(page.locator('#my-list')).toContainText('Voyage');
  await expect(page.locator('#wk-piece option', { hasText: 'Ma partition · Voyage' })).toHaveCount(1);
});
