// @ts-check
// Accompagnement de la séance guidée : choix du morceau du jour, lien Coach sur la carte, échauffement main gauche
// cohérent avec #gauche, consigne et suivi en direct dans #run-bar, reprise après rechargement et bilan pré-rempli.
const { test, expect } = require('@playwright/test');

test('SG1. mercredi (Cancan) : accès direct au Coach ; choix du morceau du jour gardé et appliqué à toute la séance', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-25T10:00:00')); // un mercredi
  await page.goto('./#seance');
  await expect(page.locator('#today-title')).toHaveText('Cancan, tout détaché');
  const coachBtn = page.locator('#today-actions a', { hasText: 'Travailler au Coach' });
  await expect(coachBtn).toHaveCount(1);
  await coachBtn.click();
  await expect(page.locator('#v-coach')).toBeVisible();
  await expect(page.locator('#wk-piece')).toHaveValue('cancan');

  await page.goto('./#seance');
  await page.locator('#today-piece').selectOption('cancan');
  await expect(page.locator('#jour-why')).toContainText('Cancan');
  await expect(page.locator('#blocks li').nth(1)).toContainText('Cancan (travail préparatoire) : mesures 1 et 2');
  await page.reload();
  await expect(page.locator('#today-piece')).toHaveValue('cancan');
  await expect(page.locator('#blocks li').nth(1)).toContainText('Cancan (travail préparatoire) : mesures 1 et 2');
});

test('SG2. bloc 1 « Échauffement main gauche » : vrai exercice #gauche mis en valeur et consigne visible dans #run-bar', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-25T10:00:00'));
  await page.goto('./#seance');
  await page.locator('#today-piece').selectOption('cancan');
  await page.locator('#go-seance').click();
  await expect(page.locator('#v-gauche')).toBeVisible();
  await expect(page.locator('#run-bar')).toBeVisible();
  await expect(page.locator('#rb-sub')).toContainText('Exercice «');
  await expect(page.locator('#ex-list article.ex-pick')).toHaveCount(1);
  const pickedTitle = await page.locator('#ex-list article.ex-pick h3').textContent();
  expect(pickedTitle).toMatch(/^[1-4] · /);                                     // exercice débutant (1 à 4) pour un morceau Niveau 1–2
  await expect(page.locator('#rb-sub')).toContainText(pickedTitle || '');
});

test('SG3. suivi en direct dans #run-bar et minuteur non brutal à 00:00', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-25T10:00:00') });
  await page.goto('./#seance');
  await page.locator('#today-piece').selectOption('cancan');
  await page.locator('#go-seance').click();
  await page.clock.runFor(200);

  // Fin du minuteur du bloc 1 (4 min) : prévient sans basculer brutalement de bloc
  await page.clock.fastForward(4 * 60 * 1000 + 1000);
  await expect(page.locator('#rb-t')).toHaveText(/^1\/\d · Échauffement main gauche$/);
  await expect(page.locator('#rb-c')).toHaveText('00:00');
  await expect(page.locator('#rb-next')).toHaveClass(/\bdue\b/);
  await expect(page.locator('#rb-sub')).toContainText('Temps écoulé');

  // Passage au bloc 2 (Déchiffrer 2 mesures du Cancan) : déchiffrer m. 1 et m. 2 allume « ✓ » dans #rb-sub
  await page.locator('#rb-next').click();
  await page.clock.runFor(200);
  await expect(page.locator('#rb-t')).toHaveText(/^2\/\d · Déchiffrer 2 mesures$/);
  await expect(page.locator('#rb-sub')).toContainText('Cancan (travail préparatoire) : mesures 1 et 2');
  for (let k = 0; k < 2; k++) {
    // @ts-ignore
    const items = await page.evaluate(() => DC.items.map(x => x.m));
    for (const m of items) {
      // @ts-ignore
      const l = await page.evaluate(m => spell(m).l, m);
      await page.locator(`#dc-names button[data-l="${l}"]`).click();
      await page.locator(`#kb-dc .key[data-m="${m}"]`).dispatchEvent('pointerdown');
    }
    if (k === 0) await page.locator('#dc-next').click();
  }
  await expect(page.locator('#rb-sub')).toContainText('2/2 mesures déchiffrées ✓');
  await expect(page.locator('#rb-next')).toHaveClass(/\bdue\b/);
});

test('SG4. reprise fiable après rechargement : étape, temps cumulé et barre conservés', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-25T10:00:00') });
  await page.goto('./#seance');
  await page.locator('#today-piece').selectOption('hymne');
  await page.locator('#go-seance').click();
  await page.clock.fastForward(90 * 1000);                                       // 1 min 30 sur le bloc 1
  await page.locator('#rb-next').click();                                        // passe au bloc 2
  await page.clock.fastForward(60 * 1000);                                       // 1 min sur le bloc 2
  await page.locator('#rb-pause').click();                                       // sauvegarde l'instant exact

  await page.reload();
  await expect(page.locator('#run-bar')).toBeVisible();
  await expect(page.locator('#rb-t')).toHaveText(/^2\/\d · Déchiffrer 2 mesures$/);
  await expect(page.locator('#rb-pause')).toHaveText('▶');
  await expect(page.locator('#rb-sub')).toContainText('Hymne à la joie');
  await page.goto('./#seance');
  await expect(page.locator('#go-seance')).toHaveText('▶ Reprendre ma séance');
});

test('SG5. bilan de fin pré-rempli avec le vrai morceau, les mesures travaillées et le tempo', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-25T10:00:00') });
  await page.goto('./#seance');
  await page.locator('#today-piece').selectOption('gurlitt');
  await page.locator('#go-seance').click();
  await page.clock.runFor(200);
  await page.locator('#rb-next').click();                                        // bloc 2 : déchiffrer Gurlitt m. 1
  await page.clock.fastForward(60 * 1000);
  // Déchiffre m. 1 de Gurlitt
  // @ts-ignore
  const items = await page.evaluate(() => DC.items.map(x => x.m));
  for (const m of items) {
    // @ts-ignore
    const l = await page.evaluate(m => spell(m).l, m);
    await page.locator(`#dc-names button[data-l="${l}"]`).click();
    await page.locator(`#kb-dc .key[data-m="${m}"]`).dispatchEvent('pointerdown');
  }
  await page.locator('#rb-next').click();                                        // bloc 3 : jouer Gurlitt
  await page.clock.runFor(200);
  await page.locator('#wk-bpm').fill('68');
  await page.locator('#wk-ok').click();                                          // 1 mesure validée propre
  await expect(page.locator('#rb-sub')).toContainText('1 mesure jouée propre ✓');

  // Termine la séance jusqu'à « Terminer »
  for (let i = 0; i < 6; i++) {
    if ((await page.locator('#rb-next').textContent()) === 'Terminer') break;
    await page.locator('#rb-next').click();
    await page.clock.runFor(200);
  }
  await page.locator('#rb-next').click();
  await page.clock.runFor(300);
  await expect(page.locator('#logform')).toBeVisible();
  await expect(page.locator('#f-piece')).toHaveValue('gurlitt');
  await expect(page.locator('#f-pass')).toHaveValue('mesure 1');
  await expect(page.locator('#f-bpm')).toHaveValue('68');
  await expect(page.locator('#f-note')).toHaveValue(/1 mesure déchiffrée, 1 mesure propre au Coach/);
  expect(await page.evaluate(() => localStorage.getItem('vestale-seance-v1'))).toBeNull();
});
