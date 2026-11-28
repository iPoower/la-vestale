// @ts-check
// P0 « justesse et données » : chaque test reproduit un défaut relevé par l'audit (rouge avant correctif, vert après).
const { test, expect } = require('@playwright/test');

// Fréquence de la fondamentale (DFT ciblée, fenêtre de Hann, pas de 0,01 Hz) d'un rendu hors ligne de playNote(69).
async function renderLa(page, synth) {
  return page.evaluate(async (synth) => {
    S.meta.a4 = 438;
    const sr = 48000, off = new OfflineAudioContext(1, sr * 2, sr), g = off.createGain(); g.connect(off.destination);
    const sAC = AC, sM = MASTER, st = SMP.state; AC = off; MASTER = g; if (synth) SMP.state = 0;
    try { playNote(69, 0.05, 1.8, 0.8, g); } finally { AC = sAC; MASTER = sM; SMP.state = st; }
    const d = (await off.startRendering()).getChannelData(0), n = 65536, s0 = Math.floor(0.1 * sr), x = new Float32Array(n);
    for (let i = 0; i < n; i++) x[i] = d[s0 + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1)));
    let best = 0, bf = 0;
    for (let f = 430; f <= 448; f += 0.01) { let re = 0, im = 0; const w = 2 * Math.PI * f / sr;
      for (let i = 0; i < n; i += 2) { re += x[i] * Math.cos(w * i); im -= x[i] * Math.sin(w * i); }
      const m = re * re + im * im; if (m > best) { best = m; bf = f; } }
    return bf;
  }, synth);
}

test.describe('P0 justesse et données', () => {
  test('P0-1a. la synthèse suit le diapason réglé : La4 = 438 Hz (± 0,1)', async ({ page }) => {
    await page.goto('./#seance');
    expect(await page.evaluate(() => { S.meta.a4 = 438; return hz(69); })).toBeCloseTo(438, 6);
    const f = await renderLa(page, true);
    expect(Math.abs(f - 438)).toBeLessThan(0.1);
  });

  test('P0-1b. le piano enregistré suit le diapason et sa table de justesse (La4 à 438 Hz, aigus corrigés)', async ({ page }) => {
    await page.goto('./#seance');
    await page.waitForFunction(() => SMP.state === 2, null, { timeout: 20000 });
    // Le La4 enregistré : sa hauteur fluctue naturellement de ± 1 à 2 cents (battement des trois cordes) ; ± 0,6 Hz ≈ ± 2,4 cents.
    const f = await renderLa(page, false);
    expect(Math.abs(f - 438)).toBeLessThan(0.6);
    // Vitesse de lecture : demi-tons × diapason × correction mesurée de l'enregistrement (La7 et Do8 sonnaient un quart de ton trop bas).
    const r = await page.evaluate(() => { S.meta.a4 = 438; return [69, 70, 105, 108, 24].map(m => [m, smpRate(m)]); });
    const C = { 69: 4.2, 105: -68.7, 108: -62.2, 24: -18.3 }, k = 438 / 440;
    expect(r[0][1]).toBeCloseTo(k * Math.pow(2, -C[69] / 1200), 6);
    // La♯4 = La4 enregistré + 1 demi-ton
    expect(r[1][1]).toBeCloseTo(k * Math.pow(2, 1 / 12) * Math.pow(2, -C[69] / 1200), 6);
    expect(r[2][1]).toBeCloseTo(k * Math.pow(2, -C[105] / 1200), 6);
    expect(r[3][1]).toBeCloseTo(k * Math.pow(2, -C[108] / 1200), 6);
    expect(r[4][1]).toBeCloseTo(k * Math.pow(2, -C[24] / 1200), 6);
  });

  test('P0-2. solfège : les deux notes d’un intervalle se suivent (0,45 s d’écart)', async ({ page }) => {
    await page.goto('./#solfege');
    await page.evaluate(() => ac()); await page.waitForTimeout(900);
    const r = await page.evaluate(() => {
      const calls = [], orig = playNote; window.playNote = (m, t) => calls.push([m, t]);
      try {
        SF.on = true; SF.n = 0; SF.ok = 0; SF.ko = 0; SF.times = []; SF.errs = []; SF.qT = Date.now();
        SF.cur = { t: 'interv', k: 'test', q: '?', choices: ['a', 'b'], ans: 0, ex: 'x', play: [60, 64] };
        try { sfAnswer(0); } catch (e) { /* la suite de l'interface n'importe pas ici */ }
      } finally { window.playNote = orig; SF.on = false; clearTimeout(SF.next); }
      return { calls, now: AC.currentTime };
    });
    expect(r.calls.length).toBe(2);
    expect(r.calls[0][1]).toBeGreaterThanOrEqual(r.now - 0.01);
    expect(r.calls[1][1] - r.calls[0][1]).toBeCloseTo(0.45, 3);
  });

  test('P0-3. anacrouse : la levée ne reçoit que ses clics, sans accent ; le décompte la précède', async ({ page }) => {
    await page.goto('./#seance');
    await page.evaluate(() => ac());
    await page.locator('#wk-piece').selectOption('bach120');
    await page.locator('#wk-click').check();
    const run = (bar) => page.evaluate((bar) => {
      const cs = [], notes = [], oc = click, on = playNote;
      window.click = (t, k) => cs.push([t, k]); window.playNote = (m, t) => notes.push(t);
      try { WK.span = 1; WK.range = null; wkGo(bar); $('#wk-loop').checked = false; playWork(); }
      finally { window.click = oc; window.playNote = on; wkStop(); }
      const spb = 60 / +$('#wk-bpm').value, t0 = Math.min(...cs.map(c => c[0]));
      return { spb, clicks: cs.map(([t, k]) => [+((t - t0) / spb).toFixed(3), k]), first: +((Math.min(...notes) - t0) / spb).toFixed(3) };
    }, bar);
    const a = await run(0);
    // 3/4 avec levée d'un temps : décompte « 1, 2 », puis la levée sur le 3e temps (un clic, non accentué).
    expect(a.clicks).toEqual([[0, 'acc'], [1, 'beat'], [2, 'beat']]);
    expect(a.first).toBe(2);
    const b = await run(1);
    // Mesure complète : décompte d'une mesure puis 3 clics, le premier accentué.
    expect(b.clicks).toEqual([[0, 'acc'], [1, 'beat'], [2, 'beat'], [3, 'acc'], [4, 'beat'], [5, 'beat']]);
    expect(b.first).toBe(3);
  });

  test('P0-4. orthographe selon l’armure : Mi♭ mineur (6 ♭) écrit Do♭, sans bécarre', async ({ page }) => {
    await page.goto('./#coach');
    const r = await page.evaluate(() => { wkSelect('alkan8'); const k = dcKey('alkan8'), b = workBars('alkan8')[0];
      const lh = staffAcc(b.lh, k), at35 = [];
      b.lh.forEach((e, i) => e[0] && e[0].forEach((m, j) => { if (m === 35) at35.push(lh[i][j]); }));
      const s = spell(35); return { sig: k.sig, l: s.l, a: s.a, d: s.d, name: wkNm(35), at35 }; });
    expect(r.sig).toContain('Do♭');
    expect([r.l, r.a, r.d]).toEqual([0, '♭', 14]);   // Do♭2 : lettre Do, octave 2
    expect(r.name).toBe('Do♭2');
    expect(r.at35.length).toBeGreaterThan(0);
    expect(r.at35.every(x => x === '')).toBe(true);  // l'armure suffit : ni bécarre ni ♭ répété
    // Ailleurs, rien ne change : Si3 reste Si3 en Do majeur.
    const c = await page.evaluate(() => { wkSelect('hymne'); const s = spell(59); return [s.l, s.a, wkNm(59)]; });
    expect(c).toEqual([6, '', 'Si3']);
  });

  test('P0-5. métronome en retard : il se recale au lieu de rattraper tous les temps d’un coup', async ({ page }) => {
    await page.goto('./#tempo');
    await page.evaluate(() => ac()); await page.waitForTimeout(500);
    const r = await page.evaluate(() => { const cs = [], o = click; window.click = (t) => cs.push(t);
      MT.bpm = 120; MT.on = true; MT.sub = false; MT.beats = 4; MT.queue = []; MT.next = AC.currentTime - 2.0; MT.i = 0;
      try { mtSchedule(); } finally { window.click = o; MT.on = false; }
      return { n: cs.length, late: cs.filter(t => t < AC.currentTime - 0.005).length }; });
    expect(r.late).toBe(0);
    expect(r.n).toBeLessThanOrEqual(2);
  });

  test('P0-6a. stockage plein : les copies de sécurité sont purgées et l’état est enregistré', async ({ page }) => {
    await page.goto('./#seance');
    const r = await page.evaluate(() => {
      localStorage.setItem('vestale-copies-v1', JSON.stringify([{ ts: 1, why: 'auto', data: { seances: [] } }]));
      const P = Storage.prototype, orig = P.setItem;
      P.setItem = function (k, v) { if (k === LS && this.getItem('vestale-copies-v1') !== null) throw new DOMException('plein', 'QuotaExceededError'); return orig.call(this, k, v); };
      S.meta.p0 = 'ok'; let ret;
      try { ret = saveLocal(); } finally { P.setItem = orig; }
      return { ret, saved: JSON.parse(localStorage.getItem(LS) || '{}').meta?.p0, copies: localStorage.getItem('vestale-copies-v1') };
    });
    expect(r.saved).toBe('ok');
    expect(r.copies).toBeNull();
  });

  test('P0-6b. stockage plein sans issue : l’app prévient au lieu de se taire', async ({ page }) => {
    await page.goto('./#seance');
    const r = await page.evaluate(() => { const P = Storage.prototype, orig = P.setItem;
      P.setItem = function (k, v) { if (k === LS) throw new DOMException('plein', 'QuotaExceededError'); return orig.call(this, k, v); };
      let ret; try { ret = saveLocal(); } finally { P.setItem = orig; }
      return { ret, toast: [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | ') }; });
    expect(r.ret).toBe(false);
    expect(r.toast).toMatch(/stockage|plein/i);
  });

  test('P0-6c. import : fichier de plus de 5 Mo refusé ; listes bornées à l’assainissement', async ({ page }) => {
    await page.goto('./#seance');
    const r = await page.evaluate(async () => {
      let read = false; await importData({ size: 6e6, text: async () => { read = true; return '{}'; } });
      const toast = [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | ');
      const items = Array.from({ length: 1000 }, (_, i) => ({ id: 'q' + i, t: 'question ' + i }));
      const d = cleanData({ seances: [], questions: { items } });
      return { read, toast, nItems: d.questions.items.length, maxSeances: SEANCES_MAX };
    });
    expect(r.read).toBe(false);
    expect(r.toast).toMatch(/5 Mo/);
    expect(r.nItems).toBeLessThanOrEqual(300);
    expect(r.maxSeances).toBeGreaterThanOrEqual(2000);
  });

  test('P0-7. solfège : les points faibles survivent au rechargement, quels que soient leurs noms', async ({ page }) => {
    await page.goto('./#solfege');
    const r = await page.evaluate(() => {
      const keys = new Set();
      for (const t of Object.keys(SF_GEN)) for (const lv of [1, 2, 3]) for (let i = 0; i < 150; i++) { try { const q = SF_GEN[t](lv); keys.add(t + ':' + q.k); } catch (e) {} }
      SF_CULT.forEach(C => C[3].forEach((_, i) => keys.add('culture:' + C[0] + '.' + i)));
      const all = [...keys], lost = [];
      for (let i = 0; i < all.length; i += 250) { const w = {}; all.slice(i, i + 250).forEach(k => { w[k] = 2; });
        const kept = cleanSolf({ w }).w; Object.keys(w).forEach(k => { if (!(k in kept)) lost.push(k); }); }
      return { n: all.length, lost: lost.slice(0, 12), nLost: lost.length, re: Object.keys(cleanSolf({ w: { 'tons:Ré-Mi': 2 } }).w) };
    });
    expect(r.n).toBeGreaterThan(50);
    expect({ nLost: r.nLost, lost: r.lost }).toEqual({ nLost: 0, lost: [] });
    expect(r.re).toEqual(['tons:Ré-Mi']);
  });

  test('P0-8. aucune journée de cours écrite dans l’app', async ({ page }) => {
    await page.goto('./');
    const html = await page.evaluate(() => document.documentElement.outerHTML + [...document.scripts].map(s => s.textContent).join('\n'));
    expect(html).not.toMatch(/cours (le )?(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)/i);
    expect(html).not.toMatch(/prof (le )?(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)/i);
  });
});
