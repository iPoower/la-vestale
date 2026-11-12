// @ts-check
// Sauvegarde : copies automatiques sur l'appareil (restauration réversible) et rappel d'export en un toucher.
const { test, expect } = require('@playwright/test');

const LS = 'vestale-studio-v1';
const SNAP = 'vestale-copies-v1';
const DAY = 864e5;
const seance = (id, over = {}) => ({ id, ts: Date.parse('2026-11-10T18:00:00') + id.charCodeAt(0), date: '2026-11-10', piece: 'hymne', min: 20, pass: '', bpm: null, feel: 3, note: `note ${id}`, ...over });
const snaps = page => page.evaluate(k => JSON.parse(localStorage.getItem(k) || '[]'), SNAP);
const state = page => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), LS);

/** Écrit des données sur l'appareil puis relance l'app. */
async function seed(page, data, snapList) {
  await page.goto('./');
  await page.evaluate(([k, v, sk, sv]) => { localStorage.setItem(k, JSON.stringify(v)); if (sv) localStorage.setItem(sk, JSON.stringify(sv)); else localStorage.removeItem(sk); }, [LS, data, SNAP, snapList]);
  await page.reload();
  await expect(page.locator('#v-seance')).toBeVisible();
}

async function noteSeance(page, note) {
  await page.locator('#tabs a[data-v="seance"]').click();
  await page.locator('#quicklog').click();
  await page.locator('#f-note').fill(note);
  await page.locator('#f-save').click();
  await expect(page.locator('#logform')).toBeHidden();
}

async function restore(page, index, confirm = true) {
  await page.locator('#tabs a[data-v="journal"]').click();
  await page.locator('#snap-sel').selectOption(String(index));
  await page.locator('#snap-restore').click();
  await expect(page.locator('#dlg')).toBeVisible();
  await page.locator(confirm ? '#dlg-ok' : '#dlg-no').click();
}

test('S1. une copie par jour au lancement, aucune copie vide ni en double', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-10T09:00:00') });
  await page.goto('./');
  expect(await snaps(page)).toEqual([]);                                 // premier lancement, rien à copier
  await seed(page, { seances: [seance('a'), seance('b')] });
  let list = await snaps(page);
  expect(list.map(s => [s.why, s.n])).toEqual([['auto', 2]]);
  expect(list[0].data.seances.map(s => s.id)).toEqual(['a', 'b']);
  await page.reload();
  expect(await snaps(page)).toHaveLength(1);                             // même jour : pas de doublon
  await page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [LS, { seances: [seance('c'), seance('a'), seance('b')] }]);
  await page.clock.setSystemTime(new Date('2026-11-11T09:00:00'));
  await page.reload();
  list = await snaps(page);
  expect(list.map(s => [s.why, s.n])).toEqual([['auto', 3], ['auto', 2]]);
});

test('S2. suppression d’une séance : copie avant, restauration, puis retour en arrière possible', async ({ page }) => {
  await seed(page, { seances: [seance('a'), seance('b')], meta: { lastBackup: Date.now() } });
  await noteSeance(page, 'séance du jour');                              // l'état diffère de la copie du jour
  await page.locator('#tabs a[data-v="journal"]').click();
  await expect(page.locator('#entries .entry')).toHaveCount(3);
  await page.locator('#entries .entry', { hasText: 'séance du jour' }).locator('button[data-del]').click();
  await page.locator('#dlg-ok').click();
  await expect(page.locator('#entries .entry')).toHaveCount(2);
  let list = await snaps(page);
  expect(list.map(s => [s.why, s.n])).toEqual([['suppression', 3], ['auto', 2]]);
  await expect(page.locator('#snap-sel option').first()).toContainText('3 séance(s) · avant suppression');

  await restore(page, 0, false);                                          // annuler ne change rien
  await expect(page.locator('#entries .entry')).toHaveCount(2);

  await restore(page, 0);                                                 // la séance supprimée revient
  await expect(page.locator('#entries .entry')).toHaveCount(3);
  await expect(page.locator('#entries')).toContainText('séance du jour');
  expect((await state(page)).seances).toHaveLength(3);
  list = await snaps(page);
  expect(list.map(s => [s.why, s.n])).toEqual([['restauration', 2], ['suppression', 3], ['auto', 2]]);

  await restore(page, 0);                                                 // et la restauration s'annule elle-même
  await expect(page.locator('#entries .entry')).toHaveCount(2);
  await page.reload();
  await page.locator('#tabs a[data-v="journal"]').click();
  await expect(page.locator('#entries .entry')).toHaveCount(2);
});

test('S3. import : copie avant, et retour à l’état d’avant l’import', async ({ page }) => {
  await seed(page, { seances: [seance('a')], meta: { lastBackup: Date.now() } });
  await noteSeance(page, 'avant import');
  await page.locator('#tabs a[data-v="journal"]').click();
  const body = JSON.stringify({ app: 'la-vestale', version: 1, exported: '2026-11-11T08:00:00Z', data: { seances: [seance('x', { note: 'importée' })], rep: { hymne: { stage: 4 } } } });
  await page.locator('#bk-file').setInputFiles({ name: 'sauvegarde.json', mimeType: 'application/json', buffer: Buffer.from(body) });
  await page.locator('#dlg-ok').click();
  await expect(page.locator('#entries')).toContainText('importée');
  expect((await snaps(page))[0]).toMatchObject({ why: 'import', n: 2 });
  await restore(page, 0);
  await expect(page.locator('#entries')).not.toContainText('importée');
  await expect(page.locator('#entries .entry')).toHaveCount(2);
  expect((await state(page)).rep).toEqual({});
});

test('S4. dix copies au plus, copies abîmées ignorées et nettoyées à la restauration', async ({ page }) => {
  const now = Date.now();
  const old = Array.from({ length: 12 }, (_, i) => ({ ts: now - (i + 1) * DAY, why: 'auto', n: 1, data: { seances: [seance('z', { note: `copie ${i}` })] } }));
  old.splice(1, 0, { ts: 'x', why: 'auto', data: {} }, { ts: now, why: 'inconnu', data: {} }, 'pas une copie');
  old[0].data.seances[0].feel = 7;                                        // valeur hors limites dans la copie la plus récente
  await seed(page, { seances: [seance('a'), seance('b')] }, old);
  const list = await snaps(page);
  expect(list).toHaveLength(10);
  expect(list[0]).toMatchObject({ why: 'auto', n: 2 });                   // nouvelle copie en tête
  expect(list[1].data.seances[0].note).toBe('copie 0');
  await expect(page.locator('#snap-sel option')).toHaveCount(10);
  await restore(page, 1);
  expect((await state(page)).seances.map(s => [s.note, s.feel])).toEqual([['copie 0', 5]]);
});

test('S5. si les copies ne peuvent pas s’écrire, la séance est quand même enregistrée', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(k => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function (key, v) { if (key === k) throw new DOMException('quota', 'QuotaExceededError'); return set.call(this, key, v); }; }, SNAP);
  await page.goto('./');
  await noteSeance(page, 'malgré le quota');
  expect((await state(page)).seances.map(s => s.note)).toEqual(['malgré le quota']);
  await page.locator('#tabs a[data-v="journal"]').click();
  await expect(page.locator('#snap-sel option')).toHaveText('Aucune copie pour l’instant');
  await expect(page.locator('#snap-restore')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('S6. rappel : jamais sauvegardé → bandeau après la séance, export en un toucher', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('#bk-remind')).toBeHidden();
  await noteSeance(page, 'première séance');
  await expect(page.locator('#bk-remind')).toBeVisible();
  await expect(page.locator('#rm-t')).toContainText('que sur ce téléphone');
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#rm-go').click()]);
  expect(download.suggestedFilename()).toMatch(/^la-vestale-\d{4}-\d{2}-\d{2}\.json$/);
  await expect(page.locator('#bk-remind')).toBeHidden();
  await expect(page.locator('#sync')).toHaveText('sauvegardé aujourd’hui');
  await noteSeance(page, 'deuxième séance');
  await expect(page.locator('#bk-remind')).toBeHidden();                 // sauvegarde récente : pas de rappel
});

test('S7. rappel : seulement après 7 jours, « Plus tard » reporte de 24 h', async ({ page }) => {
  const t0 = new Date('2026-11-12T18:00:00');
  await page.clock.install({ time: t0 });
  await seed(page, { seances: [seance('a')], meta: { lastBackup: +t0 - 3 * DAY } });
  await noteSeance(page, 'à 3 jours');
  await expect(page.locator('#bk-remind')).toBeHidden();
  await seed(page, { seances: [seance('a')], meta: { lastBackup: +t0 - 8 * DAY } });
  await noteSeance(page, 'à 8 jours');
  await expect(page.locator('#bk-remind')).toBeVisible();
  await expect(page.locator('#rm-t')).toContainText('8 jours');
  await page.locator('#rm-later').click();
  await expect(page.locator('#bk-remind')).toBeHidden();
  await noteSeance(page, 'reportée');
  await expect(page.locator('#bk-remind')).toBeHidden();
  await page.reload();                                                    // le report survit au rechargement
  await noteSeance(page, 'toujours reportée');
  await expect(page.locator('#bk-remind')).toBeHidden();
  await page.clock.setSystemTime(new Date(+t0 + 25 * 3600e3));
  await noteSeance(page, 'le lendemain');
  await expect(page.locator('#bk-remind')).toBeVisible();
});
