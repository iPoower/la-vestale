// @ts-check
const { test, expect } = require('@playwright/test');

// Un vendredi sans progression, avec une horloge identique sur les deux navigateurs.
const vendredi = new Date('2026-01-09T10:00:00');

for (const bouton of ['Commencer ma séance', 'Démarrer']) {
  for (const format of [
    { id: 'court', minutes: 15, blocs: [5, 5, 5], premier: 'Repères' },
    { id: 'jour', minutes: 30, blocs: [4, 6, 16, 2, 2], premier: 'Échauffement main gauche' },
    { id: 'std', minutes: 35, blocs: [5, 10, 10, 10], premier: 'Repères' },
  ]) {
    test(`${bouton} lance le format de ${format.minutes} minutes le jour de cours`, async ({ page }) => {
      await page.clock.install({ time: vendredi });
      await page.goto('./#seance');
      await page.locator(`#fmt button[data-f="${format.id}"]`).click();
      await page.getByRole('link', { name: 'Voir le programme' }).click();
      const accueil = page.locator('#go-seance');
      await expect(accueil).toHaveText(`▶ Commencer ma séance · ${format.minutes} min`);
      await expect(page.locator('#blocks .m')).toHaveText(format.blocs.map(min => `${min}′`));

      const depuisAccueil = bouton === 'Commencer ma séance';
      await (depuisAccueil ? accueil : page.locator('#t-start')).click();
      await expect(page.locator('#rb-t')).toHaveText(`1/${format.blocs.length} · ${format.premier}`);
      await expect(page.locator('#rb-pause')).toHaveAccessibleName('Pause');
      const exercice = format.id === 'jour' ? /#gauche$/ : /#clavier$/;
      await expect(page).toHaveURL(depuisAccueil ? exercice : /#seance$/);
    });
  }
}

test('le jour de cours propose 15 minutes et la veille propose 30 minutes', async ({ page }) => {
  for (const [date, duree] of [['2026-01-08', 30], ['2026-01-09', 15]]) {
    await page.clock.setFixedTime(new Date(`${date}T10:00:00`));
    await page.goto('./');
    await expect(page.locator('#fmt button[aria-pressed="true"]')).toContainText(`${duree} min`);
    await expect(page.locator('#go-seance')).toContainText(`${duree} min`);
  }
});

test('une séance de 35 minutes conserve son deuxième bloc et son temps après rechargement', async ({ page }) => {
  await page.clock.install({ time: vendredi });
  await page.goto('./#seance');
  await page.locator('#fmt button[data-f="std"]').click();
  await page.locator('#t-start').click();
  await page.locator('#t-skip').click();
  await page.clock.fastForward(60_000);
  await page.locator('#t-start').click();
  const restant = await page.locator('#rb-c').innerText();
  await page.reload();
  await expect(page.locator('#fmt button[aria-pressed="true"]')).toHaveText('35 min');
  await expect(page.locator('#rb-c')).toHaveText(restant);
  await expect(page.locator('#go-seance')).toContainText('Reprendre');
  await page.locator('#go-seance').click();
  await expect(page.locator('#rb-t')).toHaveText('2/4 · Passage difficile');
  await expect(page).toHaveURL(/#tempo$/);
});

test('une ancienne séance standard du jour de cours reprend ses trois blocs de cinq minutes', async ({ page }) => {
  await page.clock.install({ time: vendredi });
  await page.goto('./#seance');
  await page.evaluate(() => localStorage.setItem('vestale-seance-v1', JSON.stringify({
    day: '2026-01-09', fmt: 'std', plan: null, idx: 1, acc: 320, blockAcc: 20, log: {},
  })));
  await page.reload();
  await expect(page.locator('#fmt button[aria-pressed="true"]')).toHaveText('15 min');
  await expect(page.locator('#rb-t')).toHaveText('2/3 · Un passage');
  await expect(page.locator('#rb-c')).toHaveText('04:40');
  await page.locator('#go-seance').click();
  await expect(page).toHaveURL(/#tempo$/);
});

test('la reprise de 30 minutes garde le programme démarré si le prochain morceau a changé', async ({ page }) => {
  await page.clock.install({ time: vendredi });
  await page.goto('./#seance');
  await page.locator('#fmt button[data-f="jour"]').click();
  await page.locator('#today-piece').selectOption('cancan');
  await page.locator('#t-start').click();
  await page.locator('#t-skip').click();
  await page.locator('#t-start').click();
  await page.locator('#today-piece').selectOption('hymne');
  await page.reload();
  await expect(page.locator('#rb-sub')).toContainText('Cancan');
  await expect(page.locator('#blocks .m')).toHaveText(['4′', '6′', '16′', '2′', '2′']);
});

test('le bilan distingue la durée prévue du temps joué et Démarrer relance le même format', async ({ page }) => {
  await page.clock.setFixedTime(vendredi);
  await page.goto('./#seance');
  await page.locator('#fmt button[data-f="std"]').click();
  await page.locator('#t-end').click();
  await expect(page.locator('#f-min')).toHaveValue('35');
  await page.locator('#f-cancel').click();
  await page.locator('#t-start').click();
  await page.reload();
  await expect(page.locator('#rb-t')).toHaveText('1/4 · Repères');
  await expect(page.locator('#go-seance')).toContainText('Reprendre');
  await page.locator('#t-end').click();
  await expect(page.locator('#f-min')).toHaveValue('1');
  await page.locator('#f-cancel').click();
  await page.locator('#t-start').click();
  await expect(page.locator('#rb-t')).toHaveText('1/4 · Repères');
  await expect(page.locator('#rb-pause')).toHaveAccessibleName('Pause');
});
