// @ts-check
// Onglet Solfège : parcours de 10 leçons, chrono (minuteur), records, points faibles, données nettoyées et exportées.
const { test, expect } = require('@playwright/test');

/** Répond à la question en cours : juste (ou faux si `faux`). */
const repondre = async (page, faux = false) => {
  // @ts-ignore
  const a = await page.evaluate(() => SF.cur.ans);
  // @ts-ignore
  const n = await page.evaluate(() => SF.cur.choices.length);
  await page.locator(`#sf-ans button[data-i="${faux ? (a + 1) % n : a}"]`).click();
};

test('F1. onglet : 10 leçons, chrono par thème, rien d’ouvert au départ ; chaque générateur donne des questions cohérentes', async ({ page }) => {
  await page.goto('./#solfege');
  await expect(page.locator('#sf-run')).toBeHidden();
  await expect(page.locator('#sf-lessons details')).toHaveCount(10);
  await expect(page.locator('#sf-type button')).toHaveCount(10);
  await expect(page.locator('#sf-tag')).toHaveText('0/10 acquise');
  // @ts-ignore
  const bad = await page.evaluate(() => { const out = [];
    for (const [t] of SF_TYPES) { if (t === 'mix') continue; for (let i = 0; i < 150; i++) { const q = SF_GEN[t]();
      if (!(q.ans >= 0 && q.ans < q.choices.length) || new Set(q.choices).size !== q.choices.length || /undefined|NaN/.test(q.ex + q.choices.join())) out.push(t); } }
    // accords : fondamentale, tierce (majeure 4 / mineure 3 demi-tons), quinte juste, nom et graphie cohérents
    for (let i = 0; i < 150; i++) { const q = SF_GEN.accords(), ms = q.play[0], r = ms[0] % 12, maj = /majeur/.test(q.choices[q.ans]);
      if ((ms[1] - ms[0]) !== (maj ? 4 : 3) || ms[2] - ms[0] !== 7 || LETTERS_FR[q.draw.notes[0].d % 7] !== q.choices[q.ans].split(' ')[0] || q.draw.notes.some((n, k) => sfMidi(n.d, n.a) !== ms[k])) out.push('accord ' + q.choices[q.ans]); }
    return [...new Set(out)]; });
  expect(bad).toEqual([]);
  // @ts-ignore
  const keys = await page.evaluate(() => { const o = {}; for (let i = 0; i < 600; i++) { const q = SF_GEN.armure(); if (/majeure/.test(q.q)) o[q.draw.key.L.length + (q.draw.key.flat ? 'b' : 's')] = q.choices[q.ans]; } return o; });
  expect(keys).toEqual({ '0s': 'Do majeur', '1s': 'Sol majeur', '2s': 'Ré majeur', '3s': 'La majeur', '4s': 'Mi majeur', '5s': 'Si majeur', '6s': 'Fa♯ majeur',
    '1b': 'Fa majeur', '2b': 'Si♭ majeur', '3b': 'Mi♭ majeur', '4b': 'La♭ majeur', '5b': 'Ré♭ majeur', '6b': 'Sol♭ majeur' });
});

test('F2. leçon : 10 questions, une erreur expliquée, 9/10 = acquise ; gardée après rechargement', async ({ page }) => {
  await page.goto('./#solfege');
  await page.locator('#sf-lessons details').first().locator('summary').click();
  await expect(page.locator('#sf-lessons details').first()).toContainText('Mi Sol Si Ré Fa');
  await page.locator('#sf-lessons button[data-les="sol"]').click();
  await expect(page.locator('#sf-run')).toBeVisible();
  await expect(page.locator('#sf-title')).toHaveText('Leçon · La clé de sol');
  await expect(page.locator('#sf-clock')).toHaveText('1/10');
  await expect(page.locator('#sf-ans button')).toHaveCount(7);
  await repondre(page, true);
  await expect(page.locator('#sf-fb')).toHaveText(/^Non\. (Do|Ré|Mi|Fa|Sol|La|Si)\d : /);
  await expect(page.locator('#sf-ans button.ok')).toHaveCount(1);
  // @ts-ignore
  expect(Object.values(await page.evaluate(() => S.solf.w))).toEqual([2]);        // la note ratée devient un point faible
  for (let i = 1; i < 10; i++) { await expect(page.locator('#sf-ans button:not([disabled])')).toHaveCount(7); await repondre(page); }
  await expect(page.locator('#sf-sum')).toContainText('9 justes, 1 erreur (90 %)');
  await expect(page.locator('#sf-sum')).toContainText('Leçon acquise ✓');
  await expect(page.locator('#sf-sum')).toContainText('À retenir');
  await expect(page.locator('#sf-tag')).toHaveText('1/10 acquise');
  await page.reload();
  await expect(page.locator('#sf-lessons details').first().locator('summary')).toContainText('✓ 9/10');
  await expect(page.locator('#sf-week')).toContainText('10 questions, 90 % justes');
});

test('F3. chrono : minuteur, fin automatique, record, pause en arrière-plan', async ({ page }) => {
  await page.clock.install();
  await page.goto('./#solfege');
  await page.locator('#sf-type button[data-t="interv"]').click();
  await expect(page.locator('#sf-rec')).toHaveText('Pas encore de record');
  await page.locator('#sf-go').click();
  await expect(page.locator('#sf-title')).toHaveText('Chrono · Intervalles');
  await expect(page.locator('#sf-clock')).toHaveText('1:00');
  for (let i = 0; i < 3; i++) { await repondre(page); await page.clock.runFor(700); }
  await repondre(page, true);
  await page.clock.runFor(2300);
  await expect(page.locator('#sf-prog')).toHaveText('3 justes · 1 erreur');
  // l'app passe en arrière-plan : le minuteur s'arrête
  // @ts-ignore
  const before = await page.evaluate(() => SF.end - Date.now());
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.clock.runFor(20000);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  // @ts-ignore
  const after = await page.evaluate(() => SF.end - Date.now());
  expect(Math.abs(after - before)).toBeLessThan(400);
  await page.clock.runFor(60000);
  await expect(page.locator('#sf-sum')).toContainText('3 justes, 1 erreur (75 %)');
  await expect(page.locator('#sf-sum')).toContainText('Premier record !');
  await expect(page.locator('#sf-rec')).toHaveText('Record : 3');
  await expect(page.locator('#sf-again')).toBeVisible();
  // @ts-ignore
  expect(await page.evaluate(() => S.solf.best)).toEqual({ 'interv:1': 3 });
});

test('F4. points faibles : ce qui est raté revient plus souvent ; séance du jour ; données nettoyées et exportées', async ({ page }) => {
  await page.goto('./#solfege');
  // @ts-ignore
  const n = await page.evaluate(() => { S.solf.w = { 'sol:31': 30 }; let k = 0; for (let i = 0; i < 300; i++) if (SF_GEN.sol().k === '31') k++; return k; });
  expect(n).toBeGreaterThan(150);                                                  // Sol4 tiré bien plus souvent (normalement 1 fois sur 13)
  // @ts-ignore
  expect(await page.evaluate(() => sfWeakType())).toBe('sol');
  // @ts-ignore
  const c = await page.evaluate(() => cleanSolf({ les: { sol: 9, 'x y': 3, fa: 99 }, best: { 'sol:1': 12, 'sol:3': 4, '<b>:1': 2 }, hist: [[1, 'sol', 60, 5, 1], [2, 'Bad!', 1, 1, 1], 'x'], w: { 'sol:31': 3, 'sol:<x>': 2, 'fa:20': 0 } }));
  expect(c).toEqual({ les: { sol: 9 }, best: { 'sol:1': 12 }, hist: [[1, 'sol', 60, 5, 1]], w: { 'sol:31': 3 } });
  // @ts-ignore
  await page.evaluate(() => { S.solf.les = { sol: 10 }; saveLocal(); });
  await page.goto('./#journal');
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#bk-export').click()]);
  const j = JSON.parse(require('fs').readFileSync(await download.path(), 'utf8'));
  expect(j.data.solf.les).toEqual({ sol: 10 });
  // séance du jour, jour pair : 2 min de solfège sur le point faible ; « Ouvrir » amène au chrono réglé
  await page.clock.setFixedTime(new Date('2026-11-17T10:00:00'));
  await page.goto('./#seance');
  const li = page.locator('#blocks li', { hasText: 'Solfège' });
  await expect(li).toContainText('Chrono 1 min : clé de sol (ton point faible).');
  await li.locator('a').click();
  await expect(page.locator('#v-solfege')).toBeVisible();
  await expect(page.locator('#sf-type button.on')).toHaveText('Clé de sol');
  await expect(page.locator('#sf-dur button.on')).toHaveText('1 min');
});
