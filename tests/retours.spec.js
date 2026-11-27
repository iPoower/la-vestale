// @ts-check
// Retours du test sur PC (Claude, Chrome 157, Windows) : durée de séance, déchiffrage sans saut de page,
// main qui suit l'étape du parcours, Morceaux plus court et plus sûr, Stop pendant l'écoute, « Pour le plaisir ».
const { test, expect } = require('@playwright/test');

test('RT1. séance de moins d’une minute : 1 min proposée (pas 30) ; la barre disparaît ; « Commencer » repart de zéro', async ({ page }) => {
  await page.clock.install();
  await page.goto('./#seance');
  await page.locator('#fmt button[data-f="jour"]').click();
  await page.locator('#go-seance').click();
  for (let i = 0; i < 4; i++) { await page.clock.runFor(6000); await page.locator('#rb-next').click(); }
  await page.clock.runFor(6000);
  await page.locator('#rb-next').click();                                          // « Terminer » après ~30 s
  await page.clock.runFor(300);
  await expect(page.locator('#logform')).toBeVisible();
  await expect(page.locator('#f-min')).toHaveValue('1');
  await expect(page.locator('#run-bar')).toBeHidden();
  await page.locator('#go-seance').click();
  await expect(page.locator('#rb-t')).toHaveText(/^1\/\d · /);
});

test.describe('sur PC', () => {
  test.use({ viewport: { width: 1164, height: 760 } });
test('RT2. déchiffrage : la page ne saute plus entre deux réponses (les clics tombent au bon endroit)', async ({ page }) => {
  await page.goto('./#coach');
  await page.locator('#dc-hands button[data-h="both"]').click();
  await page.locator('#dc-go').click();
  await page.waitForTimeout(100);
  const ys = [];
  // @ts-ignore
  const items = await page.evaluate(() => DC.items.map(x => x.m));
  for (const m of items) {
    // @ts-ignore
    const l = await page.evaluate(m => spell(m).l, m);
    ys.push(await page.evaluate(() => window.scrollY));
    await page.locator(`#dc-names button[data-l="${l}"]`).click();
    ys.push(await page.evaluate(() => window.scrollY));
    await page.locator(`#kb-dc .key[data-m="${m}"]`).click();
  }
  expect(new Set(ys).size).toBe(1);                                                // aucune remontée ni descente pendant la lecture
  await expect(page.locator('#dc-fb')).toContainText('Mesure 1 déchiffrée sans erreur');
});
});

test('RT3. parcours : section lue → la main affichée passe à « Main droite », puis « Main gauche »', async ({ page }) => {
  await page.goto('./#coach');
  // @ts-ignore
  await page.evaluate(() => { S.coach.hymne = { b: {}, c: {}, d: { 0: 1, 1: 1, 2: 1 }, f: { ecoute: 1 } }; WK.hands = 'both'; renderWork(); renderPz(); });
  await page.locator('#pz-act button[data-pa="go"]').click();                     // lire la mesure 4
  // @ts-ignore
  const items = await page.evaluate(() => DC.items.map(x => x.m));
  for (const m of items) {
    // @ts-ignore
    const l = await page.evaluate(m => spell(m).l, m);
    await page.locator(`#dc-names button[data-l="${l}"]`).click();
    await page.locator(`#kb-dc .key[data-m="${m}"]`).dispatchEvent('pointerdown');
  }
  await expect(page.locator('#pz-step')).toContainText('main droite');
  await expect(page.locator('#dc-hands button.on')).toHaveText('Main droite');
  await expect(page.locator('#wk-hands button.on')).toHaveText('Main droite');
  await page.locator('#pz-act button[data-pa="self"]').click();
  await page.locator('#dlg-ok').click();
  await expect(page.locator('#dc-hands button.on')).toHaveText('Main gauche');
});

test('RT4. Morceaux : niveaux repliés (seul le niveau en cours ouvert), sommaire, recherche ; « Étape suivante » demande confirmation', async ({ page }) => {
  await page.setViewportSize({ width: 414, height: 896 });
  await page.goto('./#morceaux');
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  expect(h).toBeLessThan(7800);                                                    // 17 600 px avant, ~6 700 après (13 morceaux en Niveau 1)
  const grp = page.locator('#pieces details.pc-grp');
  await expect(grp).toHaveCount(5);
  await expect(page.locator('#pc-toc button')).toHaveCount(5);
  await expect(page.locator('#pieces details.pc-grp[open]')).toHaveCount(1);       // rien de commencé : niveau 1 seul
  await expect(grp.nth(0)).toHaveAttribute('open', '');
  await expect(page.locator('#pieces .pc-more[open]')).toHaveCount(0);
  // sommaire : ouvre le niveau 4 et y descend
  await page.locator('#pc-toc button[data-pcg="3"]').click();
  await expect(grp.nth(3)).toHaveAttribute('open', '');
  await expect(grp.nth(3).locator(':scope > summary')).toBeInViewport();
  // recherche : ouvre le niveau trouvé, cache les autres ; vide → on retrouve l’état d’avant
  await page.locator('#pc-q').fill('debussy');
  await expect(page.locator('#pieces article.piece:visible')).toHaveCount(1);
  await expect(page.locator('#pc-n')).toHaveText('1 morceau');
  await expect(page.locator('#pieces details.pc-grp:visible')).toHaveCount(1);
  await page.locator('#pc-q').fill('');
  await expect(page.locator('#pieces details.pc-grp:visible')).toHaveCount(5);
  await expect(page.locator('#pieces details.pc-grp[open]')).toHaveCount(2);
  const card = page.locator('article.piece', { hasText: 'Hymne à la joie' });
  await card.locator('button[data-act="up"]').click();
  await expect(page.locator('#dlg-t')).toContainText('Passer « Hymne à la joie » à l’étape « Lecture » ?');
  await page.locator('#dlg-no').click();
  // @ts-ignore
  expect(await page.evaluate(() => (S.rep.hymne || {}).stage || 0)).toBe(0);      // « Annuler » : rien ne bouge
  await card.locator('button[data-act="up"]').click();
  await page.locator('#dlg-ok').click();
  // @ts-ignore
  expect(await page.evaluate(() => S.rep.hymne.stage)).toBe(1);
  await expect(grp.nth(0).locator(':scope > summary')).toContainText('1 en cours');
  await expect(page.locator('#pieces details.pc-grp[open]')).toHaveCount(2);       // l’affichage ne se referme pas
  // au prochain lancement : seul le niveau où un morceau est en cours est ouvert
  await page.reload();
  await expect(page.locator('#pieces details.pc-grp[open]')).toHaveCount(1);
});

test('RT5. parcours : « Stop » pendant l’écoute ; « Pour le plaisir » ouvre un morceau déjà avancé', async ({ page }) => {
  await page.goto('./#coach');
  await page.locator('#pz-act button[data-pa="model"]').click();
  await expect(page.locator('#pz-act button[data-pa="stop"]')).toHaveText('■ Stop');
  await page.locator('#pz-act button[data-pa="stop"]').click();
  await expect(page.locator('#pz-act button[data-pa="model"]')).toBeVisible();
  // @ts-ignore
  expect(await page.evaluate(() => !!BUS)).toBe(false);
  // @ts-ignore
  await page.evaluate(() => { S.rep.fontaine = { stage: 4 }; saveLocal(); DAYPLAN = null; });
  await page.goto('./#seance');
  await page.locator('#fmt button[data-f="jour"]').click();
  const li = page.locator('#blocks li', { hasText: 'Pour le plaisir' });
  await expect(li).toContainText('À la claire fontaine en entier');
  await li.locator('a').click();
  await expect(page.locator('#v-coach')).toBeVisible();
  // @ts-ignore
  await expect.poll(() => page.evaluate(() => [WK.id, WK.bar])).toEqual(['fontaine', 0]);
});
