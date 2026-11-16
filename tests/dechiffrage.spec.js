// @ts-check
// Coach › « 1. Déchiffrer » : carte d'identité du morceau, lecture guidée note par note, puis on joue 2 à 4 mesures.
const { test, expect } = require('@playwright/test');

const MIC = () => {
  // @ts-ignore
  const fn = async () => ac().createMediaStreamDestination().stream;
  if (window.MediaDevices) MediaDevices.prototype.getUserMedia = fn;
};
const name = (page, n) => page.locator('#dc-names button', { hasText: n }).first().click();
const key = (page, m) => page.locator(`#kb-dc .key[data-m="${m}"]`).dispatchEvent('pointerdown');
/** Lit la mesure en cours sans faute : [nom, touche] pour chaque note demandée. */
const lire = async (page, notes) => { for (const [n, m] of notes) { await name(page, n); await key(page, m); } };

test('D1. carte d’identité : tonalité et armure, mesure, mesures identiques, pièges, source', async ({ page }) => {
  await page.goto('./#coach');
  await expect(page.locator('#wk-card h2')).toHaveText('2. Jouer');
  await expect(page.locator('#wk-piece')).toBeHidden();                         // un seul choix de morceau dans le Coach
  const id = page.locator('#dc-id');
  await expect(id).toContainText('Do majeur · aucune altération à la clé');
  await expect(id).toContainText('4/4 : 4 temps par mesure (noire) ; compte 1-2-3-4.');
  await expect(id).toContainText('noire = 100. Pour déchiffrer, commence vers 60');
  await expect(id).toContainText('16 mesures, dont 9 différentes. Identiques : 1 = 5 = 13');
  await expect(id).toContainText('altération hors armure (Fa♯');               // l'accord de Ré de la main gauche
  await page.locator('#dc-piece').selectOption('bebe');
  await expect(id).toContainText('Sol majeur · armure : 1 dièse (Fa♯) : cette note est altérée partout.');
  await expect(page.locator('#wk-pos')).toHaveText(/Mesure 1\//);
  await page.locator('#dc-piece').selectOption('alkan8');
  await expect(id).toContainText('Mi♭ mineur · armure : 6 bémols (Si♭, Mi♭, La♭, Ré♭, Sol♭, Do♭)');
  await expect(id).toContainText('6/8 : 2 grands temps par mesure');
  await expect(id).toContainText('Alkan');                                     // la source et sa licence restent visibles
  await page.locator('#dc-piece').selectOption('arabesqueb');
  await expect(id).toContainText('La mineur');
  // @ts-ignore
  const names = await page.evaluate(() => { setNoms('en'); DCID = ''; renderDc(); return document.querySelector('#dc-id').textContent; });
  expect(names).toContain('A mineur');
});

test('D2. lecture guidée : nommer, trouver la touche, indices ; avec erreurs la mesure n’est pas retenue', async ({ page }) => {
  await page.goto('./#coach');
  await page.locator('#dc-hands button[data-h="rh"]').click();
  await page.locator('#dc-go').click();
  await expect(page.locator('#dc-live')).toBeVisible();
  await expect(page.locator('#dc-q')).toContainText('Note 1/3 · main droite, clé de sol : quelle est la note en rouge ?');   // Mi Mi Fa Sol : le Mi répété est déjà lu
  await expect(page.locator('#dc-staff .nm')).toHaveCount(0);                   // les noms sont cachés
  await expect(page.locator('#dc-after')).toBeHidden();                         // pas de « Jouer » avant d'avoir lu
  await expect(page.locator('#dc-staff .nh.cur')).toHaveCount(1);
  await key(page, 76);
  await expect(page.locator('#dc-fb')).toHaveText('D’abord, nomme la note avec les boutons.');
  await name(page, 'Do');
  await expect(page.locator('#dc-fb')).toHaveText('Pas Do. Clé de sol : lignes de bas en haut Mi Sol Si Ré Fa ; interlignes Fa La Do Mi.');
  await name(page, 'Mi');
  await expect(page.locator('#dc-fb')).toHaveText('Oui, c’est Mi.');
  await expect(page.locator('#dc-q')).toContainText('touche Mi5 sur le clavier ci-dessous (doigt 3)');
  await key(page, 64);
  await expect(page.locator('#dc-fb')).toHaveText('Bonne note, mauvaise octave : Mi5 est plus haut. Repère-toi avec les Do.');
  await key(page, 76);
  await expect(page.locator('#dc-staff .nh.done')).toHaveCount(2);             // les deux Mi
  await name(page, 'Sol');                                                       // Fa attendu : indice par la note d'avant
  await expect(page.locator('#dc-fb')).toHaveText('Pas Sol. Compte depuis la note d’avant (Mi) : 1 note plus haut.');
  await name(page, 'Fa'); await key(page, 77);
  await name(page, 'Sol'); await key(page, 79);
  await expect(page.locator('#dc-fb')).toHaveText('Mesure lue avec 3 erreurs : relis-la une fois pour la fixer.');
  await expect(page.locator('#dc-play')).toBeHidden();
  // @ts-ignore
  expect(await page.evaluate(() => (S.coach.hymne || {}).d)).toBeUndefined();
});

test('D3. deux mesures lues sans faute : retenues, puis « Jouer les mesures 1 à 2 » lance l’écoute au début', async ({ page }) => {
  await page.addInitScript(MIC);
  await page.goto('./#coach');
  await page.locator('#dc-hands button[data-h="rh"]').click();
  await page.locator('#dc-go').click();
  await lire(page, [['Mi', 76], ['Fa', 77], ['Sol', 79]]);
  await expect(page.locator('#dc-fb')).toHaveText('Mesure 1 déchiffrée sans erreur. Lis la suivante, puis joue les deux ensemble.');
  await expect(page.locator('#dc-pos')).toHaveText('Mesure 1/16 · déjà lue ✓');
  await expect(page.locator('#dc-play')).toHaveText('Jouer la mesure 1');
  await page.locator('#dc-next').click();
  await expect(page.locator('#dc-pos')).toHaveText('Mesure 2/16');
  await lire(page, [['Sol', 79], ['Fa', 77], ['Mi', 76], ['Ré', 74]]);
  await expect(page.locator('#dc-fb')).toHaveText('Mesure 2 déchiffrée sans erreur. Place au piano : joue-les.');
  await expect(page.locator('#dc-prog')).toHaveText('2/16 lues');
  await page.locator('#dc-play').click();
  await expect(page.locator('#wk-pos')).toHaveText('Mesure 1/16');
  await expect(page.locator('#ec-go')).toHaveText('Arrêter l’écoute');
  await expect(page.locator('#ec-msg')).toHaveText('Joue : Mi5 · doigt 3');
  await expect(page.locator('#dc-live')).toBeHidden();
  await page.reload();
  await expect(page.locator('#dc-prog')).toHaveText('2/16 lues');
});

test('D4. accords lus note par note, du grave à l’aigu ; altérations ; mesure « piège » ouverte d’un toucher', async ({ page }) => {
  await page.goto('./#coach');
  await page.locator('#dc-hands button[data-h="lh"]').click();
  await page.locator('#dc-go').click();
  await expect(page.locator('#dc-q')).toContainText('main gauche, clé de fa');
  await name(page, 'Si');
  await expect(page.locator('#dc-fb')).toHaveText('Pas Si. Clé de fa : lignes de bas en haut Sol Si Ré Fa La ; interlignes La Do Mi Sol.');
  await name(page, 'Do'); await key(page, 48);
  await name(page, 'Mi'); await key(page, 52);
  await name(page, 'Sol'); await key(page, 55);
  // La mesure piège avec le Fa♯ : on l'ouvre depuis la carte d'identité
  const trap = page.locator('#dc-id button', { hasText: 'Déchiffrer la mesure' }).first();
  const bar = Number((await trap.textContent() || '').replace(/\D/g, ''));
  await trap.click();
  await expect(page.locator('#dc-pos')).toContainText(`Mesure ${bar}/16`);
  // @ts-ignore
  const items = await page.evaluate(() => DC.items.map(x => x.m));
  expect(items).toContain(54);                                                  // Fa♯3
  for (const m of items) {
    // @ts-ignore
    const l = await page.evaluate(m => spell(m).l, m);
    await page.locator(`#dc-names button[data-l="${l}"]`).click();
    if (m === 54) await expect(page.locator('#dc-fb')).toHaveText('Oui, c’est Fa, avec un ♯ écrit devant : Fa♯3. Le ♯ se joue sur la touche juste à droite.');
    await key(page, m === 54 ? 53 : m);
    if (m === 54) { await expect(page.locator('#dc-fb')).toHaveText('Bonne lettre, mais regarde l’altération : il faut Fa♯3.'); await key(page, 54); }
  }
  await expect(page.locator('#dc-fb')).toContainText('Mesure lue avec 1 erreur');
});

test('D5. sur iPhone : tout tient dans l’écran, boutons de 44 px, rien ne déborde', async ({ page }) => {
  await page.setViewportSize({ width: 414, height: 896 });
  await page.goto('./#coach');
  await page.locator('#dc-piece').selectOption('clairlune');
  await page.locator('#dc-go').click();
  const r = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    small: [...document.querySelectorAll('#dc-card button:not(.key), #dc-card select')].filter(e => /** @type {HTMLElement} */ (e).offsetParent !== null && e.getBoundingClientRect().height < 44).map(e => e.textContent),
    keys: document.querySelectorAll('#kb-dc .key').length, staff: document.querySelector('#dc-staff').getBoundingClientRect().width }));
  expect(r.scroll).toBe(0);
  expect(r.small).toEqual([]);
  expect(r.keys).toBeGreaterThan(20);
  expect(r.staff).toBeGreaterThan(330);
  await page.goto('./#seance');                                                  // la carte revient dans Séance avec son titre
  await expect(page.locator('#wk-card h2')).toHaveText('Travailler un morceau');
  await expect(page.locator('#wk-piece')).toBeVisible();
});

test('D6. tonalité à la clé, comme sur la feuille ; altérations jusqu’à la barre ; réponse et suite visibles sans défiler', async ({ page }) => {
  await page.setViewportSize({ width: 414, height: 896 });
  await page.goto('./#coach');
  await page.locator('#dc-piece').selectOption('bebe');
  // @ts-ignore
  const acc = await page.evaluate(() => { const k = dcKey('bebe'); return [staffAcc([[[65], 1], [[66], 1], [[65], 1], [[77], 1]], k), staffAcc([[[66], 1], [[66], 1]], k), k.acc]; });
  expect(acc[0]).toEqual([['♮'], ['♯'], ['♮'], ['♮']]);                         // Fa naturel annule la clé ; le ♯ écrit vaut jusqu'à la barre ; autre octave : à part
  expect(acc[1]).toEqual([[''], ['']]);                                          // Fa♯ en Sol majeur : rien à écrire
  expect(acc[2]).toEqual({ 3: '♯' });
  await page.locator('#dc-hands button[data-h="rh"]').click();
  // @ts-ignore
  await page.evaluate(() => wkGo(7));
  await page.locator('#dc-go').click();
  await expect(page.locator('#dc-key')).toHaveText('Tonalité : Sol majeur · Fa♯ à la clé');
  await expect(page.locator('#dc-staff .ks')).toHaveCount(2);
  await expect(page.locator('#dc-staff .acc')).toHaveCount(0);                   // le Fa♯ n'est pas réécrit devant la note
  // @ts-ignore
  const ord = await page.evaluate(() => ['dc-key', 'dc-staff', 'dc-q', 'dc-fb', 'dc-after', 'dc-names', 'kb-dc'].map(id => document.getElementById(id)).every((e, i, a) => !i || (a[i - 1].compareDocumentPosition(e) & 4)));
  expect(ord).toBe(true);                                                        // la réponse et la suite sont au-dessus du clavier
  // @ts-ignore
  const items = await page.evaluate(() => DC.items.map(x => x.m));
  for (const m of items) {
    // @ts-ignore
    const l = await page.evaluate(m => spell(m).l, m);
    await page.locator(`#dc-names button[data-l="${l}"]`).click();
    if (m % 12 === 6) await expect(page.locator('#dc-fb')).toHaveText(`Oui, c’est Fa. Attention : Fa♯ est à la clé (Sol majeur), donc c’est Fa♯${Math.floor(m / 12) - 1}, touche juste à droite.`);
    await expect(page.locator('#kb-dc')).toHaveClass(/dc-target/);
    const fb = await page.locator('#dc-fb').boundingBox(), kb = await page.locator('#kb-dc').boundingBox();
    expect(fb && fb.y).toBeGreaterThan(40);                                     // la réponse est à l'écran
    expect(kb && kb.y + kb.height).toBeLessThanOrEqual(896 + 1);                 // le clavier aussi
    await page.locator(`#kb-dc .key[data-m="${m}"]`).dispatchEvent('pointerdown');
  }
  await expect(page.locator('#dc-names')).toBeHidden();
  await expect(page.locator('#dc-next')).toHaveText('Mesure suivante →');
  await expect(page.locator('#dc-next')).toHaveClass(/primary/);
  const nx = await page.locator('#dc-next').boundingBox();
  expect(nx && nx.y > 40 && nx.y + nx.height <= 896).toBe(true);                 // « Mesure suivante » visible tout de suite
  await page.locator('#dc-next').click();
  await expect(page.locator('#dc-pos')).toContainText('Mesure 9/');
  await expect(page.locator('#dc-names')).toBeVisible();
});

test.describe('au doigt (écran tactile)', () => {
  test.use({ hasTouch: true, viewport: { width: 414, height: 896 } });
test('D7. vrais touchers : la dernière touche ne déclenche pas le bouton qui apparaît ; « Mesure suivante » enchaîne', async ({ page }) => {
  await page.goto('./#coach');
  await page.locator('#dc-hands button[data-h="both"]').tap();
  await page.locator('#dc-go').tap();
  for (let k = 0; k < 2; k++) {                                                   // mesures 1 puis 2, deux mains
    // @ts-ignore
    const items = await page.evaluate(() => DC.items.map(x => x.m));
    for (const m of items) {
      // @ts-ignore
      const l = await page.evaluate(m => spell(m).l, m);
      await page.locator(`#dc-names button[data-l="${l}"]`).tap();
      await expect(page.locator('#kb-dc')).toHaveClass(/dc-target/);
      await page.locator(`#kb-dc .key[data-m="${m}"]`).tap();
      await page.waitForTimeout(320);
    }
    await expect(page.locator('#dc-live')).toBeVisible();                         // pas de clic fantôme sur « Jouer »
    await expect(page.locator('#dc-after')).toBeVisible();
    // @ts-ignore
    expect(await page.evaluate(() => EC.on)).toBe(false);
    if (k === 0) { await page.locator('#dc-next').tap(); await expect(page.locator('#dc-pos')).toHaveText('Mesure 2/16'); }
  }
  await expect(page.locator('#dc-fb')).toHaveText('Mesure 2 déchiffrée sans erreur. Place au piano : joue-les.');
  await expect(page.locator('#dc-play')).toHaveText('Jouer les mesures 1 à 2');
});
});
