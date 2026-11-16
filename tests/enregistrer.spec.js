// @ts-check
// S'enregistrer et se réécouter : sur l'appareil seulement (IndexedDB), 12 derniers gardés, ★, modèle, téléchargement.
const { test, expect } = require('@playwright/test');

// Micro simulé qui « joue » un La (oscillateur) : l'enregistrement contient du son.
const MIC = () => {
  // @ts-ignore
  const fn = async () => { const a = ac(), d = a.createMediaStreamDestination(), o = a.createOscillator(); o.frequency.value = 440; o.connect(d); o.start(); return d.stream; };
  if (window.MediaDevices) MediaDevices.prototype.getUserMedia = fn;
};
test.beforeEach(async ({ page }) => { await page.addInitScript(MIC); });
const hasRec = page => page.evaluate(() => !!window.MediaRecorder);

test('G1. enregistrer, réécouter, le modèle, garder, télécharger, supprimer', async ({ page }) => {
  await page.goto('./#coach');
  test.skip(!(await hasRec(page)), 'pas de MediaRecorder dans ce WebKit de test (présent sur iPhone, iOS 14.3+)');
  await expect(page.locator('#rec-n')).toHaveText('0');
  await page.locator('#rec-go').click();
  await expect(page.locator('#rec-go')).toHaveText('Arrêter');
  await expect(page.locator('#rec-t')).toContainText('Hymne à la joie, à partir de la mesure 1');
  await page.waitForTimeout(1600);
  await page.locator('#rec-go').click();
  await expect(page.locator('#rec-t')).toContainText(/Gardé \(0:0[12]\)/);
  await expect(page.locator('#rec-go')).toHaveText('Enregistrer');
  await expect(page.locator('#rec-n')).toHaveText('1');
  await expect(page.locator('#rec-box')).toHaveAttribute('open', '');
  const item = page.locator('#rec-list .rec-item').first();
  await expect(item).toContainText('Hymne à la joie · mesure 1');
  await expect(item.locator('audio')).toHaveAttribute('src', /^blob:/);
  // @ts-ignore
  const size = await page.evaluate(async () => { const l = await recList(); const x = await recBlob(l[0].id); return [x.blob.size, x.meta.mime]; });
  expect(size[0]).toBeGreaterThan(500);
  expect(size[1]).toMatch(/^audio\/(mp4|webm)/);
  await item.locator('button[data-ra="model"]').click();                          // la mesure jouée par l'app
  // @ts-ignore
  await expect.poll(() => page.evaluate(() => !!BUS)).toBe(true);
  await item.locator('button[data-ra="star"]').click();
  await expect(page.locator('#rec-list .rec-item').first().locator('button[data-ra="star"]')).toHaveText('★ Gardé');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#rec-list .rec-item').first().locator('button[data-ra="dl"]').click()]);
  expect(dl.suggestedFilename()).toMatch(/^la-vestale-hymne-m1-\d{4}-\d{2}-\d{2}\.(m4a|webm)$/);
  await page.reload();                                                              // gardé sur l'appareil
  await expect(page.locator('#rec-n')).toHaveText('1');
  await page.locator('#rec-box summary').click();
  await page.locator('#rec-list .rec-item').first().locator('button[data-ra="del"]').click();
  await page.locator('#dlg-ok').click();
  await expect(page.locator('#rec-n')).toHaveText('0');
  // @ts-ignore
  expect(await page.evaluate(() => rtx(['data'], 'readonly', b => b.count()))).toBe(0);   // le son est effacé aussi
});

test('G2. pendant l’écoute au micro : même flux ; arrêter l’écoute garde l’enregistrement ; trop court : rien', async ({ page }) => {
  await page.goto('./#coach');
  test.skip(!(await hasRec(page)), 'pas de MediaRecorder dans ce WebKit de test');
  await page.locator('#dc-hands button[data-h="rh"]').click();
  await page.locator('#ec-go').click();
  await expect(page.locator('#ec-go')).toHaveText('Arrêter l’écoute');
  await page.locator('#rec-go').click();
  // @ts-ignore
  expect(await page.evaluate(() => REC.own)).toBeNull();                            // pas un second micro
  await page.waitForTimeout(1300);
  await page.locator('#ec-go').click();
  await expect(page.locator('#rec-n')).toHaveText('1');
  await page.locator('#rec-go').click();
  await page.locator('#rec-go').click();
  await expect(page.locator('#rec-t')).toHaveText('Trop court : rien n’a été gardé.');
  await expect(page.locator('#rec-n')).toHaveText('1');
});

test('G3. 12 derniers gardés, les ★ en plus ; rien dans l’export', async ({ page }) => {
  await page.goto('./#coach');
  // @ts-ignore
  const r = await page.evaluate(async () => { const now = Date.now();
    await rtx(['meta', 'data'], 'readwrite', (a, b) => { for (let i = 0; i < 15; i++) { const id = 'r' + i; a.put({ id, ts: now - (15 - i) * 1000, piece: 'hymne', bar: 0, hands: 'rh', dur: 3, mime: 'audio/webm', size: 9, star: i === 0 }); b.put({ id, buf: new ArrayBuffer(9) }); } });
    const gone = await recTrim(); const l = await recList(); await renderRec();
    return { gone, n: l.length, oldestKept: l[l.length - 1].id, data: await rtx(['data'], 'readonly', b => b.count()) }; });
  expect(r).toEqual({ gone: 2, n: 13, oldestKept: 'r0', data: 13 });                // r1 et r2 retirés, r0 (★) gardé
  await expect(page.locator('#rec-n')).toHaveText('13');
  await page.goto('./#journal');
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#bk-export').click()]);
  const body = require('fs').readFileSync(await download.path(), 'utf8');
  expect(body).not.toContain('audio/');
});

test('G4. sans enregistreur : message clair, rien ne casse', async ({ page }) => {
  await page.addInitScript(() => { /* @ts-ignore */ delete window.MediaRecorder; });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('./#coach');
  await page.locator('#rec-go').click();
  await expect(page.locator('#rec-t')).toContainText('Enregistrement indisponible dans ce navigateur. Sur iPhone : iOS 14.3 ou plus récent.');
  await page.locator('#rec-box summary').click();
  await expect(page.locator('#rec-list')).toContainText('Aucun enregistrement');
  expect(errors).toEqual([]);
});
