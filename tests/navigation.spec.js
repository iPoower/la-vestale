// @ts-check
// 5 onglets (Aujourd'hui, Jouer, Apprendre, Morceaux, Plus), sous-onglets, « Commencer ma séance » et sa barre, visite guidée.
const { test, expect } = require('@playwright/test');

test('N1. 5 onglets ; Apprendre et Plus ont leurs sous-onglets et rouvrent la dernière section ; les adresses directes marchent', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('#tabs a')).toHaveText(['Aujourd’hui', 'Jouer', 'Apprendre', 'Morceaux', 'Plus']);
  await expect(page.locator('#tabs a.on')).toHaveText('Aujourd’hui');
  await expect(page.locator('#subtabs')).toBeHidden();
  await page.locator('#tabs a[data-g="apprendre"]').click();
  await expect(page.locator('#v-solfege')).toBeVisible();
  await expect(page.locator('#subtabs a')).toHaveText(['Solfège', 'Lecture', 'Oreille', 'Alkan']);
  await page.locator('#subtabs a[data-v="lecture"]').click();
  await expect(page.locator('#v-lecture')).toBeVisible();
  await expect(page.locator('#subtabs a.on')).toHaveText('Lecture');
  await page.locator('#tabs a[data-g="plus"]').click();
  await expect(page.locator('#subtabs a')).toHaveText(['Clavier', 'Tempo', 'Main gauche', 'Astuces', 'Journal']);
  await page.locator('#subtabs a[data-v="journal"]').click();
  await page.locator('#tabs a[data-g="apprendre"]').click();
  await expect(page.locator('#v-lecture')).toBeVisible();                          // la dernière section d'Apprendre
  await page.locator('#tabs a[data-g="plus"]').click();
  await expect(page.locator('#v-journal')).toBeVisible();                          // la dernière de Plus
  await page.goto('./#oreille');
  await expect(page.locator('#tabs a.on')).toHaveText('Apprendre');
  await expect(page.locator('#subtabs a.on')).toHaveText('Oreille');
  await page.locator('#tabs a[data-g="jouer"]').click();
  await expect(page.locator('#v-coach')).toBeVisible();
  await expect(page.locator('#subtabs')).toBeHidden();
});

test('N2. « Commencer ma séance » : la séance démarre, ouvre chaque étape, la barre du haut suit partout jusqu’à « Terminer »', async ({ page }) => {
  await page.goto('./#seance');
  await expect(page.locator('#run-bar')).toBeHidden();
  await page.locator('#go-seance').click();
  await expect(page.locator('#v-gauche')).toBeVisible();                           // 1re étape : échauffement main gauche
  await expect(page.locator('#run-bar')).toBeVisible();
  await expect(page.locator('#rb-t')).toHaveText(/^1\/\d · Échauffement main gauche$/);
  await expect(page.locator('#rb-c')).toHaveText(/^0[34]:\d\d$/);
  await page.locator('#rb-next').click();
  await expect(page.locator('#rb-t')).toHaveText(/^2\/\d · Déchiffrer 2 mesures$/);
  await expect(page.locator('#v-coach')).toBeVisible();
  await expect(page.locator('#dc-live')).toBeVisible();                            // le déchiffrage est ouvert
  await page.locator('#rb-pause').click();
  await expect(page.locator('#rb-pause')).toHaveText('▶');
  await page.locator('#tabs a[data-g="aujourdhui"]').click();
  await expect(page.locator('#go-seance')).toHaveText('▶ Reprendre ma séance');
  await page.locator('#go-seance').click();
  await expect(page.locator('#v-coach')).toBeVisible();
  await expect(page.locator('#rb-pause')).toHaveText('❚❚');
  // jusqu'à la dernière étape, puis « Terminer » : retour à Aujourd'hui pour noter la séance
  for (let i = 0; i < 6; i++) { if ((await page.locator('#rb-next').textContent()) === 'Terminer') break; await page.locator('#rb-next').click(); }
  await expect(page.locator('#rb-next')).toHaveText('Terminer');
  await page.locator('#rb-next').click();
  await expect(page.locator('#v-seance')).toBeVisible();
  await expect(page.locator('#logform')).toBeVisible();
});

test('N3. visite guidée au premier lancement : 5 étapes, ne revient plus ; « Revoir la visite » dans Plus › Astuces', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('#tour')).toBeVisible();
  await expect(page.locator('#tour-step')).toHaveText('Visite · 1/5');
  for (let i = 0; i < 4; i++) await page.locator('#tour-next').click();
  await expect(page.locator('#tour-h')).toHaveText('Morceaux et Plus');
  await expect(page.locator('#tour-next')).toHaveText('C’est parti');
  await page.locator('#tour-next').click();
  await expect(page.locator('#tour')).toBeHidden();
  await page.reload();
  await expect(page.locator('#tour')).toBeHidden();
  await page.goto('./#astuces');
  await page.locator('#tour-again').click();
  await expect(page.locator('#v-seance')).toBeVisible();
  await expect(page.locator('#tour-step')).toHaveText('Visite · 1/5');
  await page.locator('#tour-skip').click();
  await expect(page.locator('#tour')).toBeHidden();
});

test.describe('sur iPhone', () => {
  test.use({ viewport: { width: 375, height: 667 }, hasTouch: true });              // le plus petit écran courant
test('N4. les 5 onglets tiennent sans défiler ; sous-onglets et barre de séance aussi', async ({ page }) => {
  await page.goto('./#journal');
  await page.locator('#go-seance').evaluate(b => /** @type {HTMLElement} */ (b).click());
  const r = await page.evaluate(() => { const t = document.querySelector('#tabs'), s = document.querySelector('#subtabs'), rb = document.querySelector('#run-bar');
    const subs = [...s.querySelectorAll('a')].every(a => { const b = a.getBoundingClientRect(); return b.left >= 0 && b.right <= 375; });
    return { subs, tabs: t.scrollWidth <= t.clientWidth + 1, all: [...t.querySelectorAll('a')].every(a => { const b = a.getBoundingClientRect(); return b.left >= 0 && b.right <= 375; }), page: document.documentElement.scrollWidth - document.documentElement.clientWidth, bar: rb.getBoundingClientRect().right <= 375 }; });
  expect(r).toEqual({ subs: true, tabs: true, all: true, page: 0, bar: true });
});
});
