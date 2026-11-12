// @ts-check
// Main gauche : positions de départ affichées sur le clavier, liens depuis le répertoire, repères et questions.
const { test, expect } = require('@playwright/test');

/** Touches allumées de la carte Main gauche : [nom de la note, doigt], de la plus grave à la plus aiguë. */
const lit = page => page.$$eval('#kb-mg .key.hl', ks => ks.map(k => [k.getAttribute('aria-label'), (k.querySelector('.fg') || {}).textContent || ''])
  .sort((a, b) => 0));

async function pick(page, label) {
  await page.locator('#mg-sel button', { hasText: label }).click();
}

const EXPECTED = {
  'Méthode : pouces sur le Do': [['Sol3', '4'], ['La3', '3'], ['Si3', '2'], ['Do4', '1']],
  'Hymne : accord C': [['Do3', '5'], ['Mi3', '3'], ['Sol3', '1']],
  'Hymne : G7': [['Si2', '5'], ['Fa3', '2'], ['Sol3', '1']],
  'Hymne : D (mesure 12)': [['Ré3', '4'], ['Fa♯3', '2']],
  'Fontaine : Sol3 et Fa♯3': [['Fa♯3', '3'], ['Sol3', '2']],
  'Cancan : C': [['Do3', '4'], ['Mi3', '2']],
  'Cancan : G7': [['Si2', '5'], ['Fa3', '1']],
};

test('M1. chaque position allume les bonnes touches avec le bon doigt', async ({ page }) => {
  await page.goto('./#clavier');
  for (const [label, keys] of Object.entries(EXPECTED)) {
    await pick(page, label);
    const got = await lit(page);
    const sortByPitch = arr => arr.slice().sort((a, b) => keys.findIndex(k => k[0] === a[0]) - keys.findIndex(k => k[0] === b[0]));
    expect(sortByPitch(got), label).toEqual(keys);
    await expect(page.locator('#kb-mg .fg')).toHaveCount(keys.length);   // aucun numéro resté de la position précédente
  }
});

test('M2. statut honnête : feuille imprimée ou annotation à vérifier', async ({ page }) => {
  await page.goto('./#clavier');
  await pick(page, 'Hymne : G7');
  await expect(page.locator('#mg-info')).toContainText('D’après ta feuille');
  await expect(page.locator('#mg-info')).toContainText('5 → Si2 · 2 → Fa3 · 1 → Sol3');
  await pick(page, 'Cancan : C');
  await expect(page.locator('#mg-info')).toContainText('À vérifier en cours');
});

test('M3. depuis le répertoire, « Main gauche » ouvre la bonne position, carte à l’écran', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('./#morceaux');
  const hymne = page.locator('article.piece', { hasText: 'Hymne à la joie' });
  await expect(hymne).toContainText('C : 5 Do3, 3 Mi3, 1 Sol3. G7 : 5 Si2, 2 Fa3, 1 Sol3.');
  await hymne.locator('button[data-act="mg"]').click();
  await expect(page.locator('#v-clavier')).toBeVisible();
  await expect(page.locator('#mg-sel button.on')).toHaveText('Hymne : accord C');
  await expect.poll(async () => { const b = await page.locator('#mg-card h2').boundingBox(); return !!b && b.y > 0 && b.y < 844; }).toBe(true);
  await expect.poll(async () => { const b = await page.locator('#kb-mg .key.hl').first().boundingBox(); return !!b && b.x >= 0 && b.x + b.width <= 390; }).toBe(true);
  await page.locator('#mg-play').click();
  expect(errors).toEqual([]);
});

test('M4. morceaux sans position sûre : « à confirmer », questions ajoutées', async ({ page }) => {
  await page.goto('./#morceaux');
  for (const title of ['J’ai du bon tabac', 'Le Petit Poney', 'Orientale', 'Let It Be', 'Il y a ton sourire']) {
    const card = page.locator('article.piece', { hasText: title });
    await expect(card, title).toContainText('À confirmer en cours');
    await expect(card.locator('button[data-act="mg"]'), title).toHaveCount(0);
  }
  await expect(page.locator('article.piece', { hasText: 'Cancan' })).toContainText('À confirmer en cours : C = Do3 (4) + Mi3 (2)');
  await page.goto('./#journal');
  await expect(page.locator('#q-list')).toContainText('Main gauche : position de départ');
  await expect(page.locator('#q-list')).toContainText('Cancan, main gauche');
});

test('M5. repères de la clé de fa, exercice C ↔ G7 et noms anglais', async ({ page }) => {
  await page.goto('./#clavier');
  const card = page.locator('#mg-card');
  await card.locator('summary', { hasText: 'Lire la portée du bas' }).click();
  await expect(card).toContainText('Les deux points de la clé encadrent la ligne du Fa');
  await expect(card).toContainText('Lignes de bas en haut : Sol, Si, Ré, Fa, La.');
  await card.locator('summary', { hasText: 'Exercice de 5 minutes' }).click();
  await expect(card).toContainText('Dix allers-retours lents');
  await pick(page, 'Hymne : accord C');
  await page.locator('#lbl-en').check();
  await expect(page.locator('#mg-info')).toContainText('5 → C3 · 3 → E3 · 1 → G3');
  await expect(page.locator('#kb-mg .fg')).toHaveCount(3);
});

test('M6. À la claire fontaine : position lue sur la feuille, accessible depuis le répertoire', async ({ page }) => {
  await page.goto('./#morceaux');
  const card = page.locator('article.piece', { hasText: 'À la claire fontaine' });
  await expect(card).toContainText('Rondes sur Sol3 avec le 2 (imprimé)');
  await expect(card).not.toContainText('À confirmer en cours');
  await card.locator('button[data-act="mg"]').click();
  await expect(page.locator('#mg-sel button.on')).toHaveText('Fontaine : Sol3 et Fa♯3');
  await expect(page.locator('#mg-info')).toContainText('3 → Fa♯3 · 2 → Sol3');
  await expect(page.locator('#mg-info')).toContainText('dièse de rappel');
  await page.goto('./#journal');
  await expect(page.locator('#q-list')).not.toContainText('position de départ (doigt et note) pour À la claire fontaine');
});
