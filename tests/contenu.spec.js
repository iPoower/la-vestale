// @ts-check
// Cohérence du contenu pédagogique : répertoire, préréglages, mélodies, accords et plan du jour.
const { test, expect } = require('@playwright/test');

test('C1. chaque morceau du répertoire a son préréglage de métronome', async ({ page }) => {
  await page.goto('./#morceaux');
  // @ts-ignore
  const ids = await page.evaluate(() => PIECES.map(p => p.id));
  expect(ids.length).toBeGreaterThanOrEqual(16);
  for (const id of ids) {
    await page.goto('./#morceaux');
    await page.locator(`button[data-act="metro"][data-id="${id}"]`).click();
    await expect(page.locator('#v-tempo')).toBeVisible();
    await expect(page.locator('#mt-preset'), id).toHaveValue(id);
  }
});

test('C2. chaque mélodie tombe juste en mesures et reste sur le clavier', async ({ page }) => {
  await page.goto('./#clavier');
  // @ts-ignore
  const mel = await page.evaluate(() => Object.fromEntries(Object.entries(MEL).map(([k, m]) => [k, { beats: m.n.reduce((a, x) => a + x[1], 0), lo: Math.min(...m.n.map(x => x[0])), hi: Math.max(...m.n.map(x => x[0])) }])));
  expect(mel).toEqual({
    fontaine: expect.objectContaining({ beats: 48 }),
    hymne: expect.objectContaining({ beats: 64 }),       // 16 mesures à 4/4
    twinkle: expect.objectContaining({ beats: 48 }),     // 12 mesures à 4/4
    wenceslas: expect.objectContaining({ beats: 68 }),   // 17 mesures à 4/4
  });
  for (const [k, m] of Object.entries(mel)) { expect(m.lo, k).toBeGreaterThanOrEqual(48); expect(m.hi, k).toBeLessThanOrEqual(84); }
  // @ts-ignore
  const links = await page.evaluate(() => PIECES.filter(p => p.mel).map(p => [p.id, !!MEL[p.mel]]));
  for (const [id, ok] of links) expect(ok, id).toBe(true);
});

test('C3. les nouvelles mélodies se jouent pas à pas depuis le répertoire', async ({ page }) => {
  for (const [id, title, first] of [['twinkle', 'Ah ! vous dirai-je maman', 'Do4'], ['wenceslas', 'Good King Wenceslas', 'Do4 · doigt 1']]) {
    await page.goto('./#morceaux');
    await page.locator(`button[data-act="mel"][data-id="${id}"]`).click();
    await expect(page.locator('#mel-sel button.on')).toHaveText(title);
    await page.locator('#mel-step').click();
    await expect(page.locator('#mel-next')).toHaveText(`Joue : ${first}`);
  }
});

test('C4. accord D (Ré) et formes de main gauche du cours', async ({ page }) => {
  await page.goto('./#clavier');
  await page.locator('#chord-chips .chip[data-c="D"]').click();
  await expect(page.locator('#chord-info')).toContainText('D · Ré majeur');
  await expect(page.locator('#chord-info')).toContainText('Ré – Fa♯ – La');
  await expect(page.locator('#chord-info')).toContainText('doigts 4 et 2');
  await page.locator('#chord-chips .chip[data-c="G7"]').click();
  await expect(page.locator('#chord-info')).toContainText('Si–Fa–Sol, doigts 5-2-1');
});

test('C5. répertoire : cible imprimée unique, conseils et nouvelles questions', async ({ page }) => {
  await page.goto('./#morceaux');
  const card = page.locator('article.piece', { hasText: 'Ah ! vous dirai-je maman' });
  await expect(card).toContainText('cible 96');
  await expect(card).not.toContainText('96–96');
  await expect(page.locator('article.piece', { hasText: 'Chant modal en sol' })).toContainText('cible 66–80');
  await expect(page.locator('article.piece', { hasText: 'Allegretto' })).toContainText('una corda');
  await page.goto('./#journal');
  await expect(page.locator('#q-list')).toContainText('una corda');
});

test('C6. plan du mercredi : devoir du Cancan par cœur', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-11T10:00:00') }); // un mercredi
  await page.goto('./#seance');
  await expect(page.locator('#today-title')).toHaveText('Cancan, tout détaché');
  await expect(page.locator('#today-desc')).toContainText('par cœur');
});

test('C7. grilles des chansons du cours : accords connus, lecture sans erreur', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('./#clavier');
  // @ts-ignore
  const unknown = await page.evaluate(() => Object.values(PROG).flatMap(p => p.s.map(x => x[0])).filter(n => !CH[n]));
  expect(unknown).toEqual([]);
  for (const [id, text] of [['letitbe', 'noire = 72'], ['sourire', 'noire = 80']]) {
    await page.locator(`#prog-sel button[data-p="${id}"]`).click();
    await expect(page.locator('#prog-src')).toContainText(text);
    await page.locator('#prog-play').click();
    await expect(page.locator('#prog-seq span.now')).toHaveCount(1);
    await page.locator('#prog-stop').click();
  }
  await page.locator('#chord-chips .chip[data-c="F7M"]').click();
  await expect(page.locator('#chord-info')).toContainText('Fa – La – Do – Mi');
  await page.goto('./#morceaux');
  await expect(page.locator('article.piece', { hasText: 'Le Petit Poney' })).toContainText('cible 84');
  await expect(page.locator('article.piece', { hasText: 'Let It Be' })).toContainText('cible 72');
  expect(errors).toEqual([]);
});
