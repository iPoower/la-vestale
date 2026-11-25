// @ts-check
// Accords & bilingue FR⇄EN (niveau 3 Accords dans Do Ré Mi ⇄ C D E, Flash accords, rotation séance du jour)
// + 4 correctifs de l'onglet Alkan (Stop + surlignage, mesure cliquable, niveau 1 vers #pz-card, écoute directe).
const { test, expect } = require('@playwright/test');

test('AB1. Do Ré Mi ⇄ C D E niveau 3 (Accords), mémo 3 ancres et raccourci « Afficher Do / C partout »', async ({ page }) => {
  await page.goto('./#lecture');
  await page.locator('#tr-lvl button[data-l="3"]').click();
  // @ts-ignore
  const r = await page.evaluate(() => {
    let bad = 0;
    for (let k = 0; k < 60; k++) {
      trNew();
      const c = TR.cur, vals = [...document.querySelectorAll('#tr-ans button')].map(b => b.dataset.v);
      const pair = TR_CHORDS.find(([en, fr]) => (c.toEN ? fr === c.q && en === c.good : en === c.q && fr === c.good));
      if (!pair || !vals.includes(c.good) || new Set(vals).size !== 6 || vals.length !== 6) bad++;
    }
    return bad;
  });
  expect(r).toBe(0);
  // @ts-ignore
  const good = await page.evaluate(() => TR.cur.good);
  await page.locator(`#tr-ans button[data-v="${good}"]`).click();
  await expect(page.locator('#tr-fb')).toContainText('Juste');

  await expect(page.locator('#tr-card details')).toContainText('A = La');
  await page.locator('#tr-both').click();
  await expect(page.locator('#tr-both')).toHaveText('Mode « Do / C » actif ✓');
  await expect(page.locator('#lec-ans button').first()).toHaveText('Do · C');
  await page.locator('#tr-both').click();
  await expect(page.locator('#tr-both')).toHaveText('Afficher « Do / C » partout');
});

test('AB2. 4 accords : tableau 4 tonalités, notes pivots, Stop et Flash accords bilingue (indice, clavier, série)', async ({ page }) => {
  await page.goto('./#accords4');
  await expect(page.locator('#v-accords4 .q4-t tbody tr')).toHaveCount(4);
  await expect(page.locator('#v-accords4 .q4-t tbody tr').nth(2)).toHaveText(/En Ré\s*D\s*G\s*A\s*Bm/);
  await expect(page.locator('#v-accords4 .q4-t tbody tr').nth(3)).toHaveText(/En Fa\s*F\s*B♭\s*C\s*Dm/);
  await expect(page.locator('#q4-list li').first()).toContainText('notes pivots');

  // Écoute + Stop sur 4 accords
  await page.locator('#q4-list button[data-q4l="q4do"]').click();
  // @ts-ignore
  expect(await page.evaluate(() => !!BUS)).toBe(true);
  await page.locator('#q4-stop').click();
  // @ts-ignore
  expect(await page.evaluate(() => !!BUS)).toBe(false);

  // Flash accords : indice + validation au clavier + changement de famille + note pivot
  await page.locator('#qf-set button[data-s="sol"]').click();
  await page.locator('#qf-lang button[data-l="en"]').click();
  await expect(page.locator('#qf-tag')).toHaveText('0/10');
  await page.locator('#qf-hint').click();
  await expect(page.locator('#kb-qf .key.hl')).toHaveCount(3);
  await expect(page.locator('#qf-fb')).toContainText('=');
  // Tape les 3 notes de l'accord courant sur le mini-clavier
  // @ts-ignore
  const notes = await page.evaluate(() => QF_DB[QF.cur][2]);
  for (const m of notes) await page.locator(`#kb-qf .key[data-m="${m}"]`).click();
  await expect(page.locator('#qf-tag')).toHaveText('1/10');
  await expect(page.locator('#qf-fb')).toContainText('Juste !');
  await page.waitForTimeout(550);
  await expect(page.locator('#qf-pivot')).toContainText(/depuis /i);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});

test('AB3. séance du jour : la rotation 3 jours intègre « Accords & FR⇄EN » (30 min) et suit le Flash accords', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-17T10:00:00')); // dayN() % 3 === 2 → Accords & FR⇄EN
  await page.goto('./#seance');
  const blocs = await page.locator('#blocks li').evaluateAll(ls => ls.map(l => [l.querySelector('b').textContent, +l.querySelector('.m').textContent.replace('′', '')]));
  expect(blocs.map(x => x[0])).toContain('Accords & FR⇄EN');
  expect(blocs.reduce((s, x) => s + x[1], 0)).toBe(30);

  await page.locator('#go-seance').click();
  for (let i = 0; i < 6; i++) {
    if ((await page.locator('#rb-t').textContent() || '').includes('Accords & FR⇄EN')) break;
    await page.locator('#rb-next').click();
  }
  await expect(page.locator('#v-accords4')).toBeVisible();
  await page.locator('#qf-ok').click();
  await expect(page.locator('#rb-sub')).toContainText('1/10 accords');
});

test('AB4. Alkan : bouton Stop + surlignage, mesure cliquable, conseil octave m. 9, niveau 1 vers parcours A à Z, écoute directe', async ({ page }) => {
  await page.goto('./#alkan');
  await expect(page.locator('#v-alkan')).toContainText('Mesure 9 (A/C♯ et D) : accord d’une octave complète');

  // Lecture globale + surlignage + Stop
  await page.locator('#ak-play').click();
  // @ts-ignore
  expect(await page.evaluate(() => !!BUS)).toBe(true);
  await page.waitForTimeout(150);
  await expect(page.locator('#ak-chords li.now')).toHaveCount(1);
  await page.locator('#ak-stop').click();
  // @ts-ignore
  expect(await page.evaluate(() => !!BUS)).toBe(false);
  await expect(page.locator('#ak-chords li.now')).toHaveCount(0);

  // Clic sur la mesure 7 seule
  await page.locator('#ak-chords li').nth(6).click();
  await expect(page.locator('#ak-chords li').nth(6)).toHaveClass(/\bnow\b/);
  await page.locator('#ak-stop').click();

  // Niveau 1 : ouvre Jouer avec la carte parcours (#pz-card) en haut à l'écran
  await page.locator('#ak-levels button[data-ak="0"]').click();
  await expect(page.locator('#v-coach')).toBeVisible();
  // @ts-ignore
  await expect.poll(() => page.evaluate(() => WK.id)).toBe('alkan311');
  await expect.poll(async () => { const b = await page.locator('#pz-card').boundingBox(); return !!b && b.y >= 0 && b.y < 300; }).toBe(true);

  // Bouton « ▶ Écouter » dans « À écouter » ouvre Clavier › Enchaînements sur La chanson de la folle
  await page.goto('./#alkan');
  await page.locator('#v-alkan button[data-aklisten="alkan8"]').click();
  await expect(page.locator('#v-clavier')).toBeVisible();
  await expect(page.locator('#prog-sel button.on')).toHaveAttribute('data-p', 'w:alkan8');
  await page.locator('#prog-stop').click();
});
