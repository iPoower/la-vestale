// @ts-check
// Audit du 15/11 : noms de la portée lisibles, accompagnements fiables dans « Mes partitions », Journal rangé.
const { test, expect } = require('@playwright/test');

test('U1. portée en mode « les deux » : aucun nom de note ne chevauche le précédent, sur aucune mesure', async ({ page }) => {
  await page.goto('./#clavier');
  await page.locator('#noms button[data-n="both"]').click();
  await page.goto('./#seance');
  // @ts-ignore
  const bad = await page.evaluate(() => { const out = []; for (const id of ['alkan8', 'bach846', 'clairlune', 'schumann1', 'alkan311', 'liszt3', 'bach120']) { wkSelect(id);
    workBars(id).forEach((b, i) => { wkGo(i); const rows = {}; document.querySelectorAll('#wk-staff .nm').forEach(t => { const bb = /** @type {SVGTextElement} */ (t).getBBox(); (rows[t.getAttribute('y')] = rows[t.getAttribute('y')] || []).push([bb.x, bb.x + bb.width]); });
      for (const r of Object.values(rows)) { r.sort((a, c) => a[0] - c[0]); for (let k = 1; k < r.length; k++) if (r[k][0] < r[k - 1][1]) { out.push(`${id} m${i + 1}`); break; } } }); } return out; });
  expect(bad).toEqual([]);
  await page.locator('#wk-piece').selectOption('hymne');
  expect(await page.$$eval('#wk-staff .nm', c => c.map(x => x.textContent))).toContain('Mi/E');   // les mesures aérées gardent leurs noms
});

test('U2. « Mes partitions » : seuls les accompagnements à 2, 3 ou 4 temps sans levée sont proposés', async ({ page }) => {
  await page.goto('./#morceaux');
  const accs = await page.$$eval('#my-acc option', o => o.map(x => x.value));
  expect(accs).toContain('sourire');
  expect(accs).toContain('hymne');
  expect(accs).not.toContain('twinkle');                               // main droite seule : rien à accompagner
  expect(accs).not.toContain('bach120');                               // levée d'un temps
  expect(accs).not.toContain('clairlune');                             // 9/8
  await page.locator('#my-title').fill('Essai');
  await page.locator('#my-acc').selectOption('alkan8');                 // 6/8 écrit en 3 temps : gardé tel quel
  await page.locator('#my-new').click();
  await page.reload();
  // @ts-ignore
  expect(await page.evaluate(() => [S.mine[0].bpb, S.mine[0].acc])).toEqual([3, 'alkan8']);
});

test('U3. Journal : le choix du morceau est rangé par niveau et contient tout le répertoire', async ({ page }) => {
  await page.goto('./#journal');
  // @ts-ignore
  const r = await page.evaluate(() => { openLog(30); const sel = document.querySelector('#f-piece'); return { groups: [...sel.querySelectorAll('optgroup')].map(g => g.label), n: sel.querySelectorAll('optgroup option').length, all: PIECES.every(p => [...sel.options].some(o => o.value === p.id)), extra: [...sel.options].slice(-2).map(o => o.value) }; });
  expect(r.groups).toEqual(['Niveau 1 · Débutant', 'Niveau 2 · Facile', 'Niveau 3 · Intermédiaire', 'Niveau 4 · Avancé', 'Niveau 5 · Objectif']);
  expect(r.n).toBe(32);
  expect(r.all).toBe(true);
  expect(r.extra).toEqual(['accords', 'libre']);
});
