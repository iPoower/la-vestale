// @ts-check
// Import d'une sauvegarde : fusion (rien de ce qui est sur le téléphone n'est perdu), exercices et réglages repris, bilan affiché.
const { test, expect } = require('@playwright/test');

/** Exporte depuis Journal et renvoie le contenu du fichier. */
const exporter = async page => { await page.goto('./#journal'); const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#bk-export').click()]); return require('fs').readFileSync(await dl.path()); };
const importer = async (page, buf) => { await page.locator('#bk-file').setInputFiles({ name: 'la-vestale.json', mimeType: 'application/json', buffer: buf }); await page.locator('#dlg-ok').click(); };

test('M1. fusion : un fichier plus ancien n’efface pas les exercices faits depuis ; le meilleur des deux est gardé ; deux imports = un seul', async ({ page }) => {
  await page.goto('./#solfege');
  // @ts-ignore
  await page.evaluate(() => { S.solf.les = { sol: 10 }; S.solf.lv = { sol: 2 }; S.stats.lecture = { 'sol:31': { ok: 5, ko: 1 } }; S.coach = { hymne: { b: { 0: [1, 1, 2, 0] }, c: {}, d: { 0: 1 } } }; saveLocal(); });
  const vieux = await exporter(page);
  // après la sauvegarde, on progresse encore sur ce téléphone
  // @ts-ignore
  await page.evaluate(() => { S.solf.les.fa = 9; S.solf.lv.sol = 3; S.stats.lecture['sol:31'].ok = 9; S.stats.lecture['fa:20'] = { ok: 2, ko: 0 }; S.coach.hymne.d[1] = 1; S.coach.hymne.b[0] = [1, 3, 4, 0]; saveLocal(); });
  await importer(page, vieux);
  await expect(page.locator('.toast', { hasText: 'Import réussi · progression reprise' })).toBeVisible();
  // @ts-ignore
  const r = await page.evaluate(() => [S.solf.les, S.solf.lv, S.stats.lecture, S.coach.hymne.d, S.coach.hymne.b[0]]);
  expect(r).toEqual([{ sol: 10, fa: 9 }, { sol: 3 }, { 'sol:31': { ok: 9, ko: 1 }, 'fa:20': { ok: 2, ko: 0 } }, { 0: 1, 1: 1 }, [1, 3, 4, 0]]);
  await importer(page, vieux);                                                       // une seconde fois : rien ne double
  // @ts-ignore
  expect(await page.evaluate(() => [S.stats.lecture['sol:31'], S.seances.length])).toEqual([{ ok: 9, ko: 1 }, 0]);
});

test('M2. Do Ré Mi ⇄ C D E et sprints de lecture : gardés, affichés, et repris sur un appareil vide avec les réglages', async ({ page }) => {
  await page.goto('./#lecture');
  for (let i = 0; i < 4; i++) {                                                      // Do Ré Mi ⇄ C D E : 4 bonnes réponses
    // @ts-ignore
    const good = await page.evaluate(() => TR.cur.good);
    await page.locator(`#tr-ans button[data-v="${good}"]`).click();
    await page.waitForTimeout(900);
  }
  await expect(page.locator('#tr-tot')).toHaveText('Depuis le début : 4 justes sur 4 · meilleure série 4');
  // @ts-ignore
  await page.evaluate(() => { S.stats.sprint = { n: 2, best: 19, sec: 41 }; S.meta.a4 = 438; saveLocal(); setNoms('both', true); renderLecTot(); });
  await expect(page.locator('#lec-tot')).toContainText('meilleur sprint : 19/20 en 41 s');
  const buf = await exporter(page);
  const j = JSON.parse(buf.toString());
  expect(j.data.settings).toEqual({ a4: 438, noms: 'both' });
  await page.evaluate(() => localStorage.clear());                                  // nouvel appareil
  await page.reload();
  await importer(page, buf);
  await page.goto('./#lecture');
  await expect(page.locator('#tr-tot')).toHaveText('Depuis le début : 4 justes sur 4 · meilleure série 4');
  await expect(page.locator('#lec-tot')).toContainText('meilleur sprint : 19/20 en 41 s');
  // @ts-ignore
  expect(await page.evaluate(() => [S.meta.a4, NOMS, localStorage.getItem('vestale-noms')])).toEqual([438, 'both', 'both']);
});

test('M3. réglages déjà présents sur ce téléphone : gardés ; données abîmées dans le fichier : ignorées', async ({ page }) => {
  await page.goto('./#journal');
  // @ts-ignore
  await page.evaluate(() => { S.meta.a4 = 441; saveLocal(); setNoms('en', true); });
  const buf = Buffer.from(JSON.stringify({ app: 'la-vestale', version: 1, exported: '2026-11-16T10:00:00Z',
    data: { seances: [], stats: { lecture: {}, oreille: {}, noms: { ok: 'x', ko: -3, best: 2 }, sprint: { n: 1, best: 99, sec: 30 } }, settings: { a4: 438, noms: 'fr' } } }));
  await importer(page, buf);
  // @ts-ignore
  expect(await page.evaluate(() => [S.meta.a4, NOMS, S.stats.noms, S.stats.sprint])).toEqual([441, 'en', { ok: 0, ko: 0, best: 2 }, { n: 1, best: 0, sec: 30 }]);
});
