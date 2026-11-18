// @ts-check
// Navigation à 5 onglets : on touche l'onglet du groupe, puis le sous-onglet (Apprendre et Plus), comme au doigt.
const GROUP = { seance: 'aujourdhui', coach: 'jouer', solfege: 'apprendre', lecture: 'apprendre', oreille: 'apprendre', morceaux: 'morceaux',
  clavier: 'plus', tempo: 'plus', gauche: 'plus', astuces: 'plus', journal: 'plus' };
/** @param {import('@playwright/test').Page} page @param {string} v */
async function aller(page, v) {
  const sub = page.locator(`#subtabs a[data-v="${v}"]`);
  if (await sub.isVisible()) return sub.click();
  await page.locator(`#tabs a[data-g="${GROUP[v]}"]`).click();
  if (GROUP[v] === 'apprendre' || GROUP[v] === 'plus') await page.locator(`#subtabs a[data-v="${v}"]`).click();
}
/** Morceaux : ouvre chaque niveau replié en touchant son en-tête, comme au doigt. @param {import('@playwright/test').Page} page */
async function niveaux(page) {
  const closed = page.locator('#pieces details.pc-grp:not([open]) > summary');
  while (await closed.count()) await closed.first().click();
}
module.exports = { aller, GROUP, niveaux };
