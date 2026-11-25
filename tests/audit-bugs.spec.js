// @ts-check
// Non-régression des 8 bugs trouvés lors de l'audit complet (v66) :
// 1. Interruption audio entre onglets ne verrouille plus WK.playing ni ◀ ▶
// 2. Fin de son court (Oreille, Clavier, Flash) ne fait plus afficher « ■ Stop » à tort sur le parcours
// 3. Écouter dans « 4 accords » n'écrase plus le morceau actif du Coach
// 4. Quitter un onglet coupe proprement la lecture audio et les touches allumées
// 5. Flash accords : anti double-clic rapide sur « ✓ Plaqué au piano » + changement de langue après 10/10
// 6. Bilan de fin de séance guidée inclut les accords travaillés en Flash accords + boutons Stop sur Main gauche & Mes partitions.
const { test, expect } = require('@playwright/test');

test('AU1. interruption audio et changement d’onglet : Coach déverrouillé, pas de faux « ■ Stop » ni de fuite audio', async ({ page }) => {
  await page.goto('./#coach');
  await page.locator('#wk-play').click();
  // @ts-ignore
  expect(await page.evaluate(() => WK.playing)).toBe(true);
  await expect(page.locator('#wk-step-next')).toBeDisabled();

  // Quitter #coach vers #oreille coupe l'audio et remet WK.playing à false
  await page.goto('./#oreille');
  // @ts-ignore
  expect(await page.evaluate(() => ({ bus: !!BUS, wkPlaying: WK.playing, pzPlaying: PZ.playing }))).toEqual({ bus: false, wkPlaying: false, pzPlaying: false });

  // Jouer dans Oreille puis revenir dans Coach : le parcours affiche « ▶ Écouter », pas « ■ Stop », et ◀ ▶ sont actifs
  await page.locator('#ear-play').click();
  await page.goto('./#coach');
  await expect(page.locator('#pz-act button[data-pa="model"]')).toBeVisible();
  await expect(page.locator('#wk-step-next')).toBeEnabled();
  await expect(page.locator('#kb-wk .key.next')).toHaveCount(0);
  await expect(page.locator('#kb-wk .key.hl')).toHaveCount(1);

  // Quitter #clavier pendant Enchaînements coupe l'audio et éteint #kb-full
  await page.goto('./#clavier');
  await page.locator('#prog-play').click();
  await page.waitForTimeout(150);
  await page.goto('./#seance');
  // @ts-ignore
  expect(await page.evaluate(() => !!BUS)).toBe(false);
  await page.goto('./#clavier');
  await expect(page.locator('#kb-full .key.hl, #kb-full .key.hl2')).toHaveCount(0);
});

test('AU2. 4 accords : écouter une grille ne remplace plus le morceau choisi dans Jouer', async ({ page }) => {
  await page.goto('./#coach');
  await page.locator('#dc-piece').selectOption('sourire');
  // @ts-ignore
  expect(await page.evaluate(() => WK.id)).toBe('sourire');

  await page.goto('./#accords4');
  await page.locator('#q4-list button[data-q4l="q4do"]').click();
  // @ts-ignore
  expect(await page.evaluate(() => !!BUS)).toBe(true);
  await page.locator('#q4-stop').click();
  // @ts-ignore
  expect(await page.evaluate(() => !!BUS)).toBe(false);

  await page.goto('./#coach');
  // @ts-ignore
  expect(await page.evaluate(() => WK.id)).toBe('sourire');
  await expect(page.locator('#dc-piece')).toHaveValue('sourire');
});

test('AU3. Flash accords : anti double-clic rapide et changement de langue après 10/10 repart proprement', async ({ page }) => {
  await page.goto('./#accords4');
  await page.locator('#qf-set button[data-s="do"]').click();
  // 3 clics rapides (< 100 ms) ne comptent qu'une seule fois
  await page.locator('#qf-ok').click();
  await page.locator('#qf-ok').click();
  await page.locator('#qf-ok').click();
  await expect(page.locator('#qf-tag')).toHaveText('1/10');

  // Fin de série simulée (9/10 -> 10/10)
  // @ts-ignore
  await page.evaluate(() => { QF.done = 9; QF.wait = false; qfUpdateTag(); });
  await page.locator('#qf-ok').click();
  await expect(page.locator('#qf-tag')).toHaveText('10/10');
  await expect(page.locator('#qf-ok')).toBeDisabled();

  // Changer de langue après 10/10 relance une nouvelle série active
  await page.locator('#qf-lang button[data-l="en"]').click();
  await expect(page.locator('#qf-tag')).toHaveText('0/10');
  await expect(page.locator('#qf-ok')).toBeEnabled();
});

test('AU4. séance guidée : le bilan de fin mentionne les accords travaillés en Flash accords', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-18T10:00:00')); // dayN() % 3 === 0 → Accords & FR⇄EN
  await page.goto('./#seance');
  await page.locator('#go-seance').click();
  for (let i = 0; i < 6; i++) {
    if ((await page.locator('#rb-t').textContent() || '').includes('Accords & FR⇄EN')) break;
    await page.locator('#rb-next').click();
  }
  await expect(page.locator('#v-accords4')).toBeVisible();
  await page.waitForTimeout(100);
  await page.locator('#qf-ok').click();
  await expect(page.locator('#rb-sub')).toContainText('1/10 accords');

  // Termine la séance jusqu'à « Terminer »
  for (let i = 0; i < 4; i++) {
    if ((await page.locator('#rb-next').textContent()) === 'Terminer') break;
    await page.locator('#rb-next').click();
  }
  await page.locator('#rb-next').click();
  await expect(page.locator('#logform')).toBeVisible();
  await expect(page.locator('#f-note')).toHaveValue(/1 accord en Flash accords/);
});

test('AU5. boutons ■ Stop sur Main gauche et Mes partitions (liste + éditeur)', async ({ page }) => {
  await page.goto('./#gauche');
  await page.locator('#ex-list button[data-exl]').first().click();
  // @ts-ignore
  expect(await page.evaluate(() => !!BUS)).toBe(true);
  await page.locator('#ex-list button[data-exs]').first().click();
  // @ts-ignore
  expect(await page.evaluate(() => !!BUS)).toBe(false);

  await page.goto('./#morceaux');
  await page.locator('#my-title').fill('Test Stop');
  await page.locator('#my-new').click();
  await page.locator('#kb-my .key[data-m="60"]').dispatchEvent('pointerdown');
  await page.locator('#my-play').click();
  // @ts-ignore
  expect(await page.evaluate(() => !!BUS)).toBe(true);
  await page.locator('#my-stop').click();
  // @ts-ignore
  expect(await page.evaluate(() => !!BUS)).toBe(false);
  await page.locator('#my-done').click();
  await page.locator('#my-list button[data-myl]').first().click();
  // @ts-ignore
  expect(await page.evaluate(() => !!BUS)).toBe(true);
  await page.locator('#my-list button[data-mys]').first().click();
  // @ts-ignore
  expect(await page.evaluate(() => !!BUS)).toBe(false);
});
