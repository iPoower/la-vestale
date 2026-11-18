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
  await expect(page.locator('#sf-lessons details')).toHaveCount(15);                // 5 par niveau
  await expect(page.locator('#sf-lessons h3')).toHaveText(['Débutant', /^Intermédiaire/, /^Avancé/]);
  await expect(page.locator('#sf-type button')).toHaveCount(11);
  await expect(page.locator('#sf-tag')).toHaveText('Débutant');
  await expect(page.locator('#sf-level')).toContainText('Ton niveau : Débutant · 0/5 leçons de ce niveau acquises');
  // @ts-ignore
  const bad = await page.evaluate(() => { const out = [];
    for (const t of [...SF_BASE, 'culture']) for (const lv of [1, 2, 3]) for (let i = 0; i < 60; i++) { const q = SF_GEN[t](lv);
      if (!(q.ans >= 0 && q.ans < q.choices.length) || new Set(q.choices).size !== q.choices.length || /undefined|NaN/.test(q.ex + q.choices.join())) out.push(t + lv); }
    // accords (tous niveaux) : intervalles réels conformes au nom, fondamentale et graphie cohérentes
    const IV = { majeur: '0,4,7', mineur: '0,3,7', diminué: '0,3,6', augmenté: '0,4,8', septième: '0,4,7,10' };
    for (let i = 0; i < 300; i++) { const q = SF_GEN.accords(3), ms = q.play[0], name = q.choices[q.ans];
      if (ms.map(m => m - ms[0]).join() !== IV[name.split(' ')[1]] || LETTERS_FR[q.draw.notes[0].d % 7] !== name.split(' ')[0] || q.draw.notes.some((n, k) => sfMidi(n.d, n.a) !== ms[k])) out.push('accord ' + name); }
    // intervalles qualifiés (avancé) : nombre de notes et demi-tons réels
    for (let i = 0; i < 300; i++) { const q = SF_GEN.interv(3), [a, b] = q.play.length === 1 ? q.play[0] : q.play, n = q.draw.notes[1].d - q.draw.notes[0].d + 1, [nom, qual] = q.choices[q.ans].split(' ');
      if (nom !== SF_INT[n - 2] || SF_Q[n][b - a] !== qual) out.push('intervalle ' + q.choices[q.ans]); }
    return [...new Set(out)]; });
  expect(bad).toEqual([]);
  // @ts-ignore
  const keys = await page.evaluate(() => { const o = {}; for (let i = 0; i < 1500; i++) { const q = SF_GEN.armure(3); o[(/majeure/.test(q.q) ? '' : 'm') + q.draw.key.L.length + (q.draw.key.flat ? 'b' : 's')] = q.choices[q.ans]; } return o; });
  expect(keys).toEqual({ '0s': 'Do majeur', '1s': 'Sol majeur', '2s': 'Ré majeur', '3s': 'La majeur', '4s': 'Mi majeur', '5s': 'Si majeur', '6s': 'Fa♯ majeur',
    '1b': 'Fa majeur', '2b': 'Si♭ majeur', '3b': 'Mi♭ majeur', '4b': 'La♭ majeur', '5b': 'Ré♭ majeur', '6b': 'Sol♭ majeur', '7s': 'Do♯ majeur', '7b': 'Do♭ majeur',
    m0s: 'La mineur', m1s: 'Mi mineur', m2s: 'Si mineur', m3s: 'Fa♯ mineur', m4s: 'Do♯ mineur', m5s: 'Sol♯ mineur', m6s: 'Ré♯ mineur', m7s: 'La♯ mineur',
    m1b: 'Ré mineur', m2b: 'Sol mineur', m3b: 'Do mineur', m4b: 'Fa mineur', m5b: 'Si♭ mineur', m6b: 'Mi♭ mineur', m7b: 'La♭ mineur' });
});

test('F2. leçon : 10 questions, une erreur expliquée, 9/10 = acquise ; gardée après rechargement', async ({ page }) => {
  await page.goto('./#solfege');
  await page.locator('#sf-lessons details').first().locator('summary').click();
  await expect(page.locator('#sf-lessons details').first()).toContainText('Mi Sol Si Ré Fa');
  await page.locator('#sf-lessons button[data-les="sol"]').click();
  await expect(page.locator('#sf-run')).toBeVisible();
  await expect(page.locator('#sf-title')).toHaveText('Leçon · La clé de sol');
  await expect(page.locator('#sf-clock')).toHaveText('Question 1/10');
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
  await expect(page.locator('#sf-sum')).toContainText('Niveau Intermédiaire débloqué : Clé de sol !');
  await expect(page.locator('#sf-level')).toContainText('1/5 leçons de ce niveau acquises');
  // @ts-ignore
  expect(await page.evaluate(() => S.solf.lv)).toEqual({ sol: 2 });
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
  await expect(page.locator('#sf-title')).toHaveText('Chrono · Intervalles · Débutant');
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
  expect(await page.evaluate(() => S.solf.best)).toEqual({ 'interv:1:1': 3 });
});

test('F4. points faibles : ce qui est raté revient plus souvent ; séance du jour ; données nettoyées et exportées', async ({ page }) => {
  await page.goto('./#solfege');
  // @ts-ignore
  const n = await page.evaluate(() => { S.solf.w = { 'sol:31': 30 }; let k = 0; for (let i = 0; i < 300; i++) if (SF_GEN.sol(1).k === '31') k++; return k; });
  expect(n).toBeGreaterThan(150);                                                  // Sol4 tiré bien plus souvent (normalement 1 fois sur 13)
  // @ts-ignore
  expect(await page.evaluate(() => sfWeakType())).toBe('sol');
  // @ts-ignore
  const c = await page.evaluate(() => cleanSolf({ les: { sol: 9, 'x y': 3, fa: 99 }, best: { 'sol:1': 12, 'sol:1:2': 7, 'sol:3': 4, 'sol:1:9': 1, '<b>:1': 2 }, hist: [[1, 'sol', 60, 5, 1], [2, 'Bad!', 1, 1, 1], 'x'], w: { 'sol:31': 3, 'sol:<x>': 2, 'fa:20': 0 }, lv: { sol: 3, fa: 7, 'x!': 2 } }));
  expect(c).toEqual({ les: { sol: 9 }, best: { 'sol:1': 12, 'sol:1:2': 7 }, hist: [[1, 'sol', 60, 5, 1]], w: { 'sol:31': 3 }, lv: { sol: 3 } });
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

test('F5. niveaux : les questions se durcissent, 🔒 tant que non débloqué, un chrono à 90 % débloque', async ({ page }) => {
  await page.clock.install();
  await page.goto('./#solfege');
  // @ts-ignore
  const r = await page.evaluate(() => { const span = (t, lv) => { let lo = 99, hi = 0; for (let i = 0; i < 300; i++) { const d = SF_GEN[t](lv).draw.notes[0].d; lo = Math.min(lo, d); hi = Math.max(hi, d); } return [lo, hi]; };
    const has = (f, n) => { for (let i = 0; i < 400; i++) if (f()) return true; return false; };
    return { sol: [1, 2, 3].map(lv => span('sol', lv)), fa: [1, 2, 3].map(lv => span('fa', lv)),
      rest1: has(() => SF_GEN.durees(1).draw.fig.rest), rest2: has(() => SF_GEN.durees(2).draw.fig.rest),
      min1: has(() => /mineure/.test(SF_GEN.armure(1).q)), min3: has(() => /mineure/.test(SF_GEN.armure(3).q)),
      sev1: has(() => /septième/.test(SF_GEN.accords(2).choices[SF_GEN.accords(2).ans])), sev3: has(() => { const q = SF_GEN.accords(3); return /septième|diminué|augmenté/.test(q.choices[q.ans]); }),
      big1: has(() => SF_GEN.armure(1).draw.key.L.length > 2), qual3: has(() => / (majeure|mineure|juste)/.test(SF_GEN.interv(3).choices.join())) }; });
  expect(r.sol).toEqual([[30, 38], [28, 40], [25, 43]]);                          // sur la portée, + 1 ligne, + 2 lignes supplémentaires
  expect(r.fa).toEqual([[18, 26], [16, 28], [13, 31]]);
  expect([r.rest1, r.rest2, r.min1, r.min3, r.sev1, r.sev3, r.big1, r.qual3]).toEqual([false, true, false, true, false, true, false, true]);
  await page.locator('#sf-type button[data-t="tons"]').click();
  await expect(page.locator('#sf-lvl button')).toHaveText(['Débutant', 'Intermédiaire 🔒', 'Avancé 🔒']);
  await page.locator('#sf-go').click();
  for (let i = 0; i < 10; i++) { await repondre(page); await page.clock.runFor(700); }
  await page.clock.runFor(60000);
  await expect(page.locator('#sf-sum')).toContainText('10 justes, 0 erreur (100 %)');
  await expect(page.locator('#sf-sum')).toContainText('Niveau Intermédiaire débloqué : Tons, demi-tons !');
  await expect(page.locator('#sf-lvl button')).toHaveText(['Débutant', 'Intermédiaire', 'Avancé 🔒']);
  await page.locator('#sf-type button[data-t="sol"]').click();
  await page.locator('#sf-type button[data-t="tons"]').click();
  await expect(page.locator('#sf-lvl button.on')).toHaveText('Intermédiaire');      // le chrono reprend au niveau débloqué
});

test('F6. culture musicale : 8 chapitres, faits datés, quiz complet, acquis ; chrono « Culture »', async ({ page }) => {
  await page.goto('./#solfege');
  await expect(page.locator('#sf-cult details')).toHaveCount(8);
  const piano = page.locator('#sf-cult details[data-id="cpiano"]');
  await piano.locator('summary').click();
  await expect(piano).toContainText('Bartolomeo Cristofori');
  await expect(piano).toContainText('88 touches');
  await expect(page.locator('#sf-cult details[data-id="cromant"]')).toContainText('Alkan');
  await expect(page.locator('#sf-cult details[data-id="cmod"]')).toContainText('Suite bergamasque');
  await piano.locator('button[data-cul]').click();
  await expect(page.locator('#sf-title')).toHaveText('Culture · Le piano');
  await expect(page.locator('#sf-clock')).toHaveText('Question 1/6');
  await expect(page.locator('#sf-staff')).toBeHidden();                         // pas de portée vide pour une question de culture
  const seen = new Set();
  for (let i = 0; i < 6; i++) { await expect(page.locator('#sf-ans button:not([disabled])')).toHaveCount(4); seen.add(await page.locator('#sf-q').textContent()); await repondre(page, i === 0); }
  expect(seen.size).toBe(6);                                                        // les 6 questions, sans répétition
  await expect(page.locator('#sf-sum')).toContainText('5 justes, 1 erreur');
  await expect(page.locator('#sf-sum')).toContainText('Chapitre acquis ✓');
  await expect(page.locator('#sf-sum')).toContainText('→');                        // la question ratée et sa réponse
  await expect(page.locator('#sf-cult details[data-id="cpiano"] summary')).toContainText('✓ 5/6');
  await page.locator('#sf-type button[data-t="culture"]').click();
  await expect(page.locator('#sf-lvl')).toBeHidden();
  // @ts-ignore
  const n = await page.evaluate(() => SF_CULT.reduce((s, c) => s + c[3].length, 0));
  expect(n).toBeGreaterThanOrEqual(45);
});
