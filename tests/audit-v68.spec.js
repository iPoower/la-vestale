// @ts-check
const { readFile } = require('node:fs/promises');
const { test, expect } = require('@playwright/test');

async function prepareNote(page, note) {
  await page.goto('./#seance');
  await page.locator('#quicklog').click();
  await page.locator('#f-note').fill(note);
}

async function addPartition(page, title) {
  await page.goto('./#morceaux');
  await page.locator('#my-title').fill(title);
  await page.locator('#my-new').click();
  await page.locator('#kb-my button[aria-label="Do4"]').click();
  await page.locator('#my-done').click();
}

async function exportBackup(page) {
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#bk-export').click()]);
  return JSON.parse(await readFile(await download.path(), 'utf8'));
}

test('AV1. le journal conserve deux saisies simultanées, même à la même milliseconde', async ({ page, context }) => {
  const second = await context.newPage();
  const now = new Date('2026-01-10T10:00:00Z');
  await Promise.all([page.clock.setFixedTime(now), second.clock.setFixedTime(now)]);
  await Promise.all([prepareNote(page, 'Note de test A'), prepareNote(second, 'Note de test B')]);
  await Promise.all([page.locator('#f-save').click(), second.locator('#f-save').click()]);
  for (const tab of [page, second]) {
    await expect(tab.locator('#logform')).toBeHidden();
    await tab.goto('./#journal');
    await expect(tab.locator('#entries .entry')).toHaveCount(2);
    await expect(tab.locator('#entries')).toContainText('Note de test A');
    await expect(tab.locator('#entries')).toContainText('Note de test B');
  }
  await page.locator('#entries .entry', { hasText: 'Note de test A' }).getByRole('button', { name: 'Supprimer' }).click();
  await page.locator('#dlg-ok').click();
  await expect(second.locator('#entries .entry')).toHaveCount(1);
  await second.reload();
  await expect(second.locator('#entries')).toContainText('Note de test B');
  await expect(second.locator('#entries')).not.toContainText('Note de test A');
});

test('AV2. un changement de durée demande confirmation et Annuler préserve la séance en pause', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-01-10T10:00:00Z') });
  await page.goto('./#seance');
  const standard = page.locator('#fmt [data-f="std"]');
  const short = page.locator('#fmt [data-f="court"]');
  await standard.click();
  await page.locator('#t-start').click();
  await page.locator('#t-skip').click();
  await page.clock.fastForward(60_000);
  await page.locator('#t-start').click();
  const time = await page.locator('#rb-c').innerText();

  await short.click();
  await expect(page.locator('#dlg-t')).toContainText('abandonner la séance en pause');
  await page.locator('#dlg-no').click();
  await page.reload();
  await expect(standard).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#rb-t')).toHaveText('2/4 · Passage difficile');
  await expect(page.locator('#rb-c')).toHaveText(time);

  await short.click();
  await page.locator('#dlg-ok').click();
  await expect(short).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#run-bar')).toBeHidden();
});

test('AV3. le témoin signale une partition ajoutée depuis le dernier export', async ({ page }) => {
  await prepareNote(page, 'Séance sauvegardée');
  await page.locator('#f-save').click();
  await expect(page.locator('#logform')).toBeHidden();
  await page.goto('./#journal');
  const original = await exportBackup(page);
  await expect(page.locator('#bk-last')).toContainText('tout est à l’abri');
  await addPartition(page, 'Partition après export');
  await expect(page.locator('#sync')).toHaveText('à sauvegarder');
  await page.goto('./#journal');
  await page.reload();
  await expect(page.locator('#bk-last')).toContainText('modifications depuis le dernier export');
  expect(original.data.mine).toEqual([]);
  expect((await exportBackup(page)).data.mine[0].t).toBe('Partition après export');
  await page.reload();
  await expect(page.locator('#bk-last')).toContainText('tout est à l’abri');
});

test('AV4. le bilan et le journal gardent le titre de la partition personnelle travaillée', async ({ page }) => {
  const title = 'Étude de test';
  await addPartition(page, title);
  await page.goto('./#seance');
  await page.locator('#fmt [data-f="jour"]').click();
  await page.locator('#today-piece').selectOption({ label: title });
  await page.locator('#t-start').click();
  await page.locator('#t-end').click();
  await expect(page.locator('#f-piece option:checked')).toHaveText(title);
  await page.locator('#f-save').click();
  await expect(page.locator('#logform')).toBeHidden();
  await page.goto('./#journal');
  await page.reload();
  await expect(page.locator('#entries')).toContainText(title);
  expect((await exportBackup(page)).data.seances[0].pieceTitle).toBe(title);
});

test('AV5. Flash accords valide les touches du piano jouées avec Entrée et Espace', async ({ page }) => {
  await page.goto('./#accords4');
  await page.locator('#qf-hint').click();
  const highlighted = page.locator('#kb-qf .key.hl');
  await expect(highlighted).toHaveCount(3);
  const notes = await highlighted.evaluateAll(keys => keys.map(key => key.getAttribute('data-m')));
  for (const [index, midi] of notes.entries()) {
    const key = page.locator(`#kb-qf [data-m="${midi}"]`);
    await key.focus();
    await page.keyboard.press(index === 1 ? 'Space' : 'Enter');
  }
  await expect(page.locator('#qf-tag')).toHaveText('1/10');
});
