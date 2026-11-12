// @ts-check
// Lecture › Rythme : rythmes par niveau, notation, écoute, frappe jugée sur l'horloge audio, progression.
const { test, expect } = require('@playwright/test');

const LS = 'vestale-studio-v1';
/** Impose un rythme connu (liste de [durée, silence?]). */
async function setRhythm(page, ev) {
  await page.evaluate(ev => {
    // @ts-ignore
    RY.ev = ev.map(([d, r]) => ({ d, r: !!r })); RY.exp = ryOnsets(RY.ev).filter((o, i) => !RY.ev[i].r); ryDraw();
  }, ev);
}
/** Frappe le bouton aux instants donnés (en temps de la mesure), d'après l'horloge audio. */
async function tapAt(page, beats) {
  await page.evaluate(async beats => {
    // @ts-ignore
    const st = RY.barStart, spb = 60 / +document.querySelector('#ry-bpm').value, sleep = ms => new Promise(r => setTimeout(r, ms));
    // @ts-ignore
    for (const b of beats) { while (AC.currentTime < st + b * spb) await sleep(2); document.querySelector('#ry-tap').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); }
  }, beats);
}

test('Y1. rythmes générés : 4 temps justes, valeurs du niveau, au moins une note, nouveauté du niveau présente', async ({ page }) => {
  await page.goto('./#lecture');
  const r = await page.evaluate(() => {
    const allowed = { 1: [1, 2], 2: [1, 2, 4], 3: [1, 2, 4, .5], 4: [1, 2, 4, .5, 1.5] }, out = {};
    for (const lvl of [1, 2, 3, 4]) {
      let bad = 0;
      for (let k = 0; k < 300; k++) {
        // @ts-ignore
        const ev = ryGen(lvl), sum = ev.reduce((a, e) => a + e.d, 0);
        const okVals = ev.every(e => allowed[lvl].includes(e.d) && (!e.r || (lvl >= 2 && (e.d === 1 || e.d === 2))));
        const need = { 1: () => true, 2: () => ev.some(e => e.r || e.d === 4), 3: () => ev.some(e => e.d === .5), 4: () => ev.some(e => e.d === 1.5) }[lvl]();
        if (sum !== 4 || !okVals || !ev.some(e => !e.r) || !need) bad++;
      }
      out[lvl] = bad;
    }
    return out;
  });
  expect(r).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0 });
});

test('Y2. notation : têtes, silences, ligature des croches, point et comptage « et »', async ({ page }) => {
  await page.goto('./#lecture');
  await setRhythm(page, [[1.5], [.5], [.5], [.5], [1, true]]);   // noire pointée, croche, deux croches, soupir
  await expect(page.locator('#ry-staff .ry-n')).toHaveCount(4);
  await expect(page.locator('#ry-staff .ry-r')).toHaveCount(1);
  await expect(page.locator('#ry-staff circle')).toHaveCount(1);   // le point de la noire pointée
  await expect(page.locator('#ry-staff rect')).toHaveCount(1);     // la ligature des deux croches
  await expect(page.locator('#ry-staff text', { hasText: 'et' })).toHaveCount(2);
});

test('Y3. frappe juste sur le clic : « Réussi »', async ({ page }) => {
  await page.goto('./#lecture');
  await page.locator('#ry-bpm').fill('100');
  await setRhythm(page, [[1], [1], [2]]);
  await page.locator('#ry-go').click();
  await tapAt(page, [0, 1, 2]);
  await expect(page.locator('#ry-fb')).toContainText('Réussi', { timeout: 6000 });
  await expect(page.locator('#ry-fb')).toContainText('3 à l’heure');
  await expect(page.locator('#ry-ok')).toHaveText('1');
});

test('Y4. frappes en retard ou dans un silence : « À reprendre », détail des erreurs', async ({ page }) => {
  await page.goto('./#lecture');
  await page.locator('#ry-bpm').fill('100');
  await page.locator('#ry-lvl button[data-l="2"]').click();
  await setRhythm(page, [[1], [1, true], [2]]);                    // noire, soupir, blanche
  await page.locator('#ry-go').click();
  await tapAt(page, [0, 1, 2.5]);                                  // frappe dans le soupir, blanche trop tard
  await expect(page.locator('#ry-fb')).toContainText('À reprendre', { timeout: 6000 });
  await expect(page.locator('#ry-fb')).toContainText('oubliée');
  await expect(page.locator('#ry-fb')).toContainText('en trop (un silence ?)');
  await expect(page.locator('#ry-ok')).toHaveText('0');
});

test('Y5. jugement : à l’heure, en retard, oubliée, frappe en trop', async ({ page }) => {
  await page.goto('./#lecture');
  // @ts-ignore
  const j = await page.evaluate(() => ryJudge([0, 1, 2], [0.05, 1.15, 2.3, 3.1], 1));
  expect(j.res.map(r => r.v)).toEqual(['ok', 'tard', 'manqué']);
  expect(j.extra).toBe(2);
  expect(j.success).toBe(false);
});

test('Y6. trois réussites : conseil de niveau suivant, progression gardée après rechargement', async ({ page }) => {
  await page.goto('./#lecture');
  await page.locator('#ry-bpm').fill('100');
  for (let i = 1; i <= 3; i++) {
    await setRhythm(page, [[2], [2]]);
    await page.locator('#ry-go').click();
    await tapAt(page, [0, 2]);
    await expect(page.locator('#ry-ok')).toHaveText(String(i), { timeout: 6000 });
  }
  await expect(page.locator('#ry-fb')).toContainText('passe au niveau 2');
  await page.locator('#ry-lvl button[data-l="3"]').click();
  await page.reload();
  await page.locator('#tabs a[data-v="lecture"]').click();
  await expect(page.locator('#ry-tag')).toHaveText('Niveau 3');
  await expect(page.locator('#ry-tot')).toHaveText('3');
  const st = await page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null').stats.rythme, LS);
  expect(st).toEqual({ lvl: 3, ok: 3, ko: 0 });
});

test('Y7. « Écouter » joue chaque note du rythme ; la barre d’espace frappe aussi', async ({ page }) => {
  await page.goto('./#lecture');
  await setRhythm(page, [[1], [.5], [.5], [2]]);
  await page.evaluate(() => {
    // @ts-ignore
    const o = window.playNote; window.__n = 0; window.playNote = function (...a) { if (a[0] === 72) window.__n++; return o.apply(this, a); };
  });
  await page.locator('#ry-listen').click();
  // @ts-ignore
  expect(await page.evaluate(() => window.__n)).toBe(4);
  await page.locator('#ry-go').click();
  await page.waitForTimeout(200);
  await page.keyboard.press('Space');
  // @ts-ignore
  expect(await page.evaluate(() => RY.taps.length)).toBe(1);
});
