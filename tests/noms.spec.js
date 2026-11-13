// @ts-check
// Noms des notes : Do Ré Mi, C D E ou les deux ; exercice de traduction dans Lecture.
const { test, expect } = require('@playwright/test');

test('N1. « Les deux » : touches, Séance et réponses de Lecture dans les deux systèmes ; choix gardé', async ({ page }) => {
  await page.goto('./#clavier');
  await expect(page.locator('#noms button.on')).toHaveText('Do Ré Mi');
  await page.locator('#noms button[data-n="both"]').click();
  await expect(page.locator('#kb-main .key[data-m="64"]')).toHaveAttribute('aria-label', 'Mi4 (E4)');
  expect(await page.locator('#kb-main .key[data-m="60"] .kl').evaluate(e => e.textContent)).toBe('Do4\nC4');
  await page.goto('./#seance');
  await expect(page.locator('#wk-info')).toContainText('Mi5 (E5)');
  await page.goto('./#lecture');
  await expect(page.locator('#lec-ans button').first()).toHaveText('Do · C');
  await page.reload();
  await expect(page.locator('#noms button.on')).toHaveText('Les deux');
  await page.locator('#tabs a[data-v="clavier"]').click();
  await page.locator('#noms button[data-n="fr"]').click();
  await expect(page.locator('#kb-main .key[data-m="64"]')).toHaveAttribute('aria-label', 'Mi4');
});

test('N2. traduction : juste, faux, série et question suivante', async ({ page }) => {
  await page.goto('./#lecture');
  // @ts-ignore
  let good = await page.evaluate(() => TR.cur.good);
  await page.locator(`#tr-ans button[data-v="${good}"]`).click();
  await expect(page.locator('#tr-fb')).toContainText('Juste');
  await expect(page.locator('#tr-streak')).toHaveText('Série 1');
  await expect(page.locator('#tr-ans button:disabled')).toHaveCount(0);       // question suivante seule
  // @ts-ignore
  good = await page.evaluate(() => TR.cur.good);
  await page.locator(`#tr-ans button:not([data-v="${good}"])`).first().click();
  await expect(page.locator('#tr-fb')).toContainText(`= ${good}`);
  await expect(page.locator(`#tr-ans button[data-v="${good}"]`)).toHaveClass(/ok/);
  await expect(page.locator('#tr-ko')).toHaveText('1');
  await expect(page.locator('#tr-streak')).toHaveText('Série 0');
});

test('N3. le bon couple Do Ré Mi ⇄ C D E, aux deux niveaux, toujours parmi les réponses', async ({ page }) => {
  await page.goto('./#lecture');
  await page.locator('#tr-lvl button[data-l="2"]').click();
  // @ts-ignore
  const r = await page.evaluate(() => { const F = ['Do', 'Ré', 'Mi', 'Fa', 'Sol', 'La', 'Si'], E = ['C', 'D', 'E', 'F', 'G', 'A', 'B']; let bad = 0, alt = 0;
    for (let k = 0; k < 200; k++) { trNew(); const c = TR.cur, base = c.q.replace(/[♯♭]/, ''), a = c.q.slice(base.length), i = (c.toEN ? F : E).indexOf(base);
      const vals = [...document.querySelectorAll('#tr-ans button')].map(b => b.dataset.v);
      if (i < 0 || c.good !== (c.toEN ? E : F)[i] + a || !vals.includes(c.good) || new Set(vals).size !== vals.length || vals.length !== 6) bad++; if (a) alt++; }
    return { bad, alt }; });
  expect(r.bad).toBe(0);
  expect(r.alt).toBeGreaterThan(50);
  const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(scroll).toBeLessThanOrEqual(0);
});
