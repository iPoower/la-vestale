// @ts-check
// Badge du haut : un toucher ouvre « Sauvegarder / Importer » ; la progression se garde et se reprend en deux gestes.
const { test, expect } = require('@playwright/test');

test('B1. le badge ouvre les deux choix ; Sauvegarder télécharge et met le badge à jour ; on ferme en touchant ailleurs', async ({ page }) => {
  await page.goto('./#seance');
  await expect(page.locator('#sync')).toHaveText('à sauvegarder');
  await expect(page.locator('#bk-pop')).toBeHidden();
  await page.locator('#sync').click();
  await expect(page.locator('#bk-pop')).toBeVisible();
  await expect(page.locator('#sync')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#bk-pop-t')).toHaveText(/^Fichier d’environ \d+ Ko\. Dernière sauvegarde : jamais\.$/);
  await expect(page.locator('#bk-pop-save')).toHaveText('Sauvegarder');
  await expect(page.locator('#bk-pop-imp')).toHaveText('Importer');
  await page.mouse.click(30, 700);                                                // toucher ailleurs ferme
  await expect(page.locator('#bk-pop')).toBeHidden();
  await page.locator('#sync').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#bk-pop')).toBeHidden();
  await page.locator('#sync').click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#bk-pop-save').click()]);
  expect(download.suggestedFilename()).toBe('la-vestale-sauvegarde.json');
  await expect(page.locator('#bk-pop')).toBeHidden();
  await expect(page.locator('#sync')).toHaveText('sauvegardé aujourd’hui');
  await page.locator('#sync').click();
  await expect(page.locator('#bk-pop-t')).toHaveText(/^Fichier d’environ \d+ Ko\. Dernière sauvegarde : aujourd’hui\.$/);
});

test('B2. Importer depuis le badge : choix du fichier, confirmation, progression reprise (Coach et Solfège compris)', async ({ page }) => {
  await page.goto('./#solfege');
  // @ts-ignore
  await page.evaluate(() => { S.solf.les = { sol: 10 }; S.solf.lv = { sol: 2 }; S.coach = { hymne: { b: { 0: [1, 1, 2, 0] }, c: {}, d: { 0: 1 } } }; saveLocal(); });
  await page.locator('#sync').click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#bk-pop-save').click()]);
  const file = require('fs').readFileSync(await download.path());
  await page.evaluate(() => localStorage.clear());                                 // un autre appareil, vide
  await page.reload();
  // @ts-ignore
  expect(await page.evaluate(() => S.solf.les)).toEqual({});
  await page.locator('#sync').click();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#bk-pop-imp').click()]);
  await expect(page.locator('#bk-pop')).toBeHidden();
  await chooser.setFiles({ name: 'la-vestale.json', mimeType: 'application/json', buffer: file });
  await expect(page.locator('#dlg')).toBeVisible();
  await page.locator('#dlg-ok').click();
  // @ts-ignore
  await expect.poll(() => page.evaluate(() => [S.solf.les, S.solf.lv, S.coach.hymne.d])).toEqual([{ sol: 10 }, { sol: 2 }, { 0: 1 }]);
  await expect(page.locator('#sf-lessons details[data-id="sol"] summary')).toContainText('✓ 10/10');
});

test.describe('sur iPhone', () => {
  test.use({ viewport: { width: 414, height: 896 }, hasTouch: true });
test('B3. au doigt : le badge se touche facilement, la fenêtre tient dans l’écran, ses boutons font 44 px', async ({ page }) => {
  await page.goto('./#coach');
  await page.locator('#sync').tap();
  await expect(page.locator('#bk-pop')).toBeVisible();
  const r = await page.evaluate(() => { const p = document.querySelector('#bk-pop').getBoundingClientRect(), s = getComputedStyle(document.querySelector('#sync'), '::before');
    return { left: p.left >= 0, right: p.right <= 414, btns: [...document.querySelectorAll('#bk-pop .btn')].map(b => Math.round(b.getBoundingClientRect().height) >= 44), hit: s.position, scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
  expect(r).toEqual({ left: true, right: true, btns: [true, true], hit: 'absolute', scroll: 0 });
  await page.touchscreen.tap(30, 820);
  await expect(page.locator('#bk-pop')).toBeHidden();
});
});

test('B4. une seule sauvegarde : toujours le même nom (l’iPhone propose « Remplacer »), contenu compact, date à l’intérieur', async ({ page }) => {
  await page.goto('./#solfege');
  // @ts-ignore
  await page.evaluate(() => { S.solf.les = { sol: 10 }; saveLocal(); });
  const noms = [], tailles = [];
  for (let i = 0; i < 2; i++) {
    await page.locator('#sync').click();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#bk-pop-save').click()]);
    const body = require('fs').readFileSync(await dl.path(), 'utf8'); noms.push(dl.suggestedFilename()); tailles.push(body.length);
    expect(body).not.toContain('\n');                                               // pas d'indentation : plus léger
    expect(JSON.parse(body).exported).toMatch(/^\d{4}-\d{2}-\d{2}T/);              // la date reste dans le fichier
  }
  expect(noms).toEqual(['la-vestale-sauvegarde.json', 'la-vestale-sauvegarde.json']);
  expect(tailles[0]).toBeLessThan(20000);
});
