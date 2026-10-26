/**
 * PO-15 (variant C): avslöjandet efter en missad fråga i solospelet.
 * 1. Felklicket och rätt svar syns i samma vy, fria från rutan.
 * 2. Rätt svar har sitt namn på kartan.
 * 3. Efter en miss går spelet vidare med "Nästa" eller efter minst 4 s, och nedräkningen står still
 *    medan man håller fingret på kartan. Rätt på första försöket går vidare lika snabbt som förut.
 * 8. Hinten om att hålla på kartan visas de tre första gångerna per enhet.
 * 9. Efter att tangentbordet använts står nedräkningen still medan fokus är i rutan; Enter går vidare.
 * 10. Avståndet på linjen täcker inte namnet på rätt svar.
 * Dessutom: ingen zoomanimation med "minska rörelse", engelska och axe.
 */
import { MUNICIPALITIES } from '../src/data/municipalities.ts';
import { axe } from './a11y.mjs';
import { ALL_CODES, ANSWERS, COUNTY_BY_CODE, Suite, answerAccepted, clickAnswer, context, mapSettled, shortRuleFor, page, questionText, url } from './lib.mjs';

const MUNICIPALITY_COUNTY = new Map(MUNICIPALITIES.map((m) => [m.code, m.county]));
/** Län långt ifrån varandra, att klicka fel på. */
const FAR_COUNTIES = ['BD', 'M', 'I', 'S'];

/**
 * Felsvar för frågan: andra län, kommuner i samma län eller residensstäder långt bort. Det behövs
 * tre; för kommuner finns fler att ta till om någon inte går att träffa (t.ex. under rutan).
 */
function wrongAnswers(mode, answer) {
  if (mode === 'kommun') {
    const county = MUNICIPALITY_COUNTY.get(answer.code);
    return MUNICIPALITIES.filter((m) => m.county === county && m.code !== answer.code).map((m) => ({ code: m.code }));
  }
  if (answer.point) {
    // Residensstäder minst 150 km bort (gränsen för rätt är 30 km).
    const far = FAR_COUNTIES.map((c) => COUNTY_BY_CODE.get(c)).filter((c) => Math.hypot(c.lat - answer.point.lat, (c.lon - answer.point.lon) / 2) > 1.4);
    return far.slice(0, 3).map((c) => ({ point: { lat: c.lat, lon: c.lon } }));
  }
  if (mode === 'lan' || mode === 'sjo') return FAR_COUNTIES.filter((c) => c !== answer.code).slice(0, 3).map((code) => ({ code }));
  // Landskap: spridda över listan (som går från söder till norr).
  const codes = ALL_CODES[mode].filter((c) => c !== answer.code);
  return [0, Math.floor(codes.length / 2), codes.length - 1].map((i) => ({ code: codes[i] }));
}

/** Var felklicket och rätt svar hamnade, och om namnet syns. */
function measureMiss(p) {
  return p.evaluate(() => {
    const m = document.querySelector('.map').getBoundingClientRect();
    const toast = document.querySelector('.toast.is-visible')?.getBoundingClientRect();
    const under = (r) => !!toast && r.left < toast.right && r.right > toast.left && r.top < toast.bottom && r.bottom > toast.top;
    const inside = (r) => r.left >= m.left - 1 && r.right <= m.right + 1 && r.top >= m.top - 1 && r.bottom <= m.bottom + 1;
    /** Hur stor del av ytan som syns i kartan och inte ligger under rutan (ungefär, med ett rutnät). */
    const visibleShare = (r) => {
      let seen = 0;
      for (let i = 0; i < 10; i++)
        for (let j = 0; j < 10; j++) {
          const x = r.left + ((i + 0.5) * r.width) / 10;
          const y = r.top + ((j + 0.5) * r.height) / 10;
          const pt = { left: x, right: x, top: y, bottom: y };
          if (inside(pt) && !under(pt)) seen++;
        }
      return seen / 100;
    };
    // Det sista felklicket (de tidigare prickarna ligger kvar men behöver inte synas).
    const wrong = [...document.querySelectorAll('.marker-wrong .marker-dot, path.county.is-wrong, path.lake.is-wrong')].pop();
    const target = document.querySelector('.marker-reveal .marker-dot, path.county.is-reveal, path.lake.is-reveal');
    const label = document.querySelector('.marker-labels text:not(.marker-label-wrong), .lake-label.is-shown:not(.is-hidden)');
    const box = (el) => el?.getBoundingClientRect();
    return {
      wrong: wrong ? visibleShare(box(wrong)) : 0,
      target: target ? visibleShare(box(target)) : 0,
      label: label ? { text: label.textContent, visible: inside(box(label)) && !under(box(label)) } : null,
      line: !!document.querySelector('line.reveal-line'),
      distance: document.querySelector('.marker-label-wrong')?.textContent ?? null,
      // Avståndet får inte täcka namnet på rätt svar (UX: Kalmar → Blekinge, 25 km).
      distanceOnName: (() => {
        const d = document.querySelector('.marker-label-wrong')?.getBoundingClientRect();
        const n = label?.getBoundingClientRect();
        return !!d && !!n && d.left < n.right && d.right > n.left && d.top < n.bottom && d.bottom > n.top;
      })(),
      button: document.querySelector('.toast.is-visible .toast-action span:first-child')?.textContent ?? null,
      hint: document.querySelector('.toast.is-visible .toast-hint')?.textContent ?? null,
      transform: document.querySelector('.map-root').getAttribute('transform'),
    };
  });
}

const sleep = (p, ms) => p.waitForTimeout(ms);

/** Svarar rätt på frågorna tills läget har den sortens fråga som ska missas (blandat behövs inte här). */
export async function nextQuestion(p, last) {
  return p
    .waitForFunction((last) => {
      const text = document.querySelector('.question')?.textContent?.trim();
      return text && text !== last && !text.endsWith('…') ? text : false;
    }, last, { timeout: 15000 })
    .then((h) => h.jsonValue());
}

/** Missar första frågan med tre felsvar. Ger frågan och rätt svar. */
export async function miss(p, mode, { withRule = false } = {}) {
  let q = await nextQuestion(p, '');
  await sleep(p, 450);
  let answer = ANSWERS.get(q);
  if (!answer) throw new Error(`känner inte igen frågan "${q}"`);
  // Nedräkningen gäller bara en miss utan minnesregel (PO-33); frågor med regel besvaras rätt.
  for (let i = 0; !withRule && shortRuleFor(mode, answer) && i < 12; i++) {
    await answerAccepted(p, answer);
    q = await nextQuestion(p, q);
    await sleep(p, 450);
    answer = ANSWERS.get(q);
  }
  const wrong = wrongAnswers(mode, answer);
  let given = 0;
  for (const w of wrong) {
    if (given < 2) {
      // Ett felsvar som inte går att träffa hoppas över; nästa tas i stället.
      if (!(await answerAccepted(p, w).then(() => true, () => false))) continue;
      given++;
      // Vänta tills den korta felrutan gått, så att nästa felsvar tas emot för sig.
      await sleep(p, 1400);
      continue;
    }
    // Det sista felsvaret klickas inte om i onödan (ett klick till på kartan skulle gå vidare i b
    // och c), bara om det förstorade kartan i stället för att räknas (små kommuner).
    await watch(p, q, '.toast-action');
    for (let attempt = 0; attempt < 4; attempt++) {
      if (!(await clickAnswer(p, w).then(() => true, () => false))) break;
      if (await p.waitForSelector('.toast-action', { timeout: 4000 }).then(() => true, () => false)) return { q, answer };
      await mapSettled(p);
    }
  }
  throw new Error(`frågan gick inte att missa med tre felsvar (${q})`);
}

/**
 * Mäter i sidan (performance.now) när `selector` (knappen eller rätt-rutan) visas och när nästa fråga kommer, så att testets egen
 * fördröjning under last inte påverkar tiderna.
 */
function watch(p, q, selector) {
  return p.evaluate(([q, selector]) => {
    const w = (window.__miss = { shown: null, next: null, held: 0 });
    // Hur länge man höll på kartan (då står nedräkningen still).
    let downAt = null;
    addEventListener('pointerdown', () => (downAt = performance.now()), true);
    addEventListener('pointerup', () => downAt !== null && ((w.held += performance.now() - downAt), (downAt = null)), true);
    new MutationObserver(() => {
      const now = performance.now();
      if (w.shown === null && document.querySelector(selector)) w.shown = now;
      if (w.shown !== null && w.next === null && document.querySelector('.question')?.textContent?.trim() !== q) w.next = now;
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class'] });
  }, [q, selector]);
}

/** Hur länge (ms) rutan har visats, och hur länge det dröjde innan nästa fråga kom. */
function missTiming(p) {
  return p.evaluate(() => ({ elapsed: performance.now() - window.__miss.shown, until: window.__miss.next === null ? null : window.__miss.next - window.__miss.shown, held: window.__miss.held }));
}

async function round(run, t, mode, { hold = false } = {}) {
  const name = mode;
  const ctx = await context(run, 'iphone');
  const p = await page(ctx);
  await p.goto(url(run));
  await p.click(`.mode-btn[data-mode="${mode}"]`);
  await p.waitForSelector('.screen-game .map path');
  const { q } = await miss(p, mode);
  // Fokus före hållet (ett tryck på kartan tar fokus från knappen, som det ska).
  const focused = await p.evaluate(() => document.activeElement?.classList.contains('toast-action') ?? false);
  let heldSince = null;
  if (hold) {
    // Håll fingret (musen) på kartan, efter spärren mot dubbeltryck: nedräkningen står still medan
    // vyn mäts och fotograferas, och sedan i minst 3 s.
    await sleep(p, 800);
    const m = await p.locator('.map').boundingBox();
    await p.mouse.move(m.x + m.width / 2, m.y + m.height / 2);
    await p.mouse.down();
    heldSince = Date.now();
  }
  await sleep(p, 900);
  await mapSettled(p);
  const r = await measureMiss(p);
  await t.shot(p, `${mode}-miss`);
  t.check(r.wrong > 0.1 && r.target > 0.95, `${name}: felklicket (${Math.round(r.wrong * 100)} %) och rätt svar (${Math.round(r.target * 100)} %) syns i samma vy, fritt från rutan – ${q}`);
  const place = q.replace(/^Var ligger /, '').replace(/ i .+ län\?$/, '').replace(/\?$/, '');
  t.check(r.label?.text === place && r.label.visible, `${name}: namnet "${r.label?.text}" står på kartan och syns (väntat "${place}")`);
  t.check(r.button === 'Nästa' && focused, `${name}: knappen "${r.button}" har fokus`);
  t.check(r.hint === 'Håll ned på kartan för att titta längre', `${name}: hinten första gången på enheten ("${r.hint}")`);
  // Avståndet står på linjen, eller saknas om linjen är för kort (under 40 px) eller trång.
  t.check(r.line && (r.distance === null || (/^\d+ km$/.test(r.distance) && !r.distanceOnName)), `${name}: linjen till rätt svar, avståndet "${r.distance ?? 'dolt'}" täcker inte namnet`);

  if (heldSince !== null) {
    await sleep(p, Math.max(0, 3000 - (Date.now() - heldSince)));
    const paused = await p.$eval('.toast-action', (b) => b.classList.contains('is-paused'));
    await p.mouse.up();
    t.check(paused, `${name}: nedräkningen står still medan man håller på kartan`);
  }
  await nextQuestion(p, q);
  const { until, held } = await missTiming(p);
  const after = (until - held) / 1000;
  // Minst 4 s från att rutan syns (utöver tiden man höll på kartan); nedräkningen kollar var 100:e ms.
  t.check(after >= 4 && after < 4.6, `${name}: går vidare av sig självt efter ${after.toFixed(2)} s${held > 500 ? ` (plus ${(held / 1000).toFixed(1)} s då man höll på kartan)` : ''}`);

  // Rätt på första försöket går vidare lika snabbt som förut (1,5 s).
  const q2 = await questionText(p);
  await sleep(p, 450);
  await watch(p, q2, '.toast-ok.is-visible');
  await answerAccepted(p, ANSWERS.get(q2));
  await nextQuestion(p, q2);
  const fast = (await missTiming(p)).until / 1000;
  t.check(fast >= 1.4 && fast < 1.7 && !(await p.$('.toast-action')), `${name}: rätt direkt går vidare efter ${fast.toFixed(1)} s utan knapp`);
  t.check(p.errors.length === 0, `${name}: inga fel i sidan ${p.errors.slice(0, 3).join(' | ')}`);
  await ctx.close();
}

/**
 * Med "minska rörelse" hoppar kartan direkt till vyn med felklicket och svaret. Enheten har redan
 * sett hinten tre gånger, så den visas inte.
 */
async function reducedMotion(run, t) {
  const ctx = await context(run, 'android', { reducedMotion: true });
  await ctx.addInitScript(() => localStorage.setItem('sverigespelet.holdHints.v1', '3'));
  const p = await page(ctx);
  await p.goto(url(run));
  await p.click('.mode-btn[data-mode="stad"]');
  await p.waitForSelector('.screen-game .map path');
  await miss(p, 'stad');
  await sleep(p, 80);
  const early = await measureMiss(p);
  await sleep(p, 800);
  const late = await measureMiss(p);
  t.check(early.transform === late.transform, `minska rörelse: ingen zoomanimation (${early.transform} → ${late.transform})`);
  t.check(!(await p.isVisible('.advance-bar')), 'minska rörelse: ingen rörlig nedräkningsstapel, bara siffran');
  t.check(late.hint === null, `hinten visas inte en fjärde gång på enheten ("${late.hint}")`);
  await ctx.close();
}

/**
 * WCAG 2.2.1: när tangentbordet har använts står nedräkningen still medan fokus är i rutan. Enter
 * på "Nästa" går vidare, och flyttas fokus ut ur rutan räknar den ned igen.
 */
async function keyboard(run, t) {
  const ctx = await context(run, 'desktop');
  const p = await page(ctx);
  await p.goto(url(run));
  await p.click('.mode-btn[data-mode="lan"]');
  await p.waitForSelector('.screen-game .map path');
  await p.keyboard.press('Shift');
  const first = await miss(p, 'lan');
  await sleep(p, 5500);
  const paused = await p.$eval('.toast-action', (b) => b.classList.contains('is-paused')).catch(() => false);
  t.check(paused && (await questionText(p)) === first.q, 'tangentbord: nedräkningen står still medan fokus är på "Nästa"');
  // Nedräkningen står still, så axe hinner gå igenom rutan med knappen och hinten.
  await axe(t, p, 'fel-rutan med knappen');
  await p.keyboard.press('Enter');
  t.check((await nextQuestion(p, first.q)) !== first.q, 'tangentbord: Enter på "Nästa" går vidare');
  const second = await miss(p, 'lan');
  await sleep(p, 1500);
  await p.keyboard.press('Tab');
  const out = await p.evaluate(() => !document.activeElement?.closest('.toast'));
  const moved = await nextQuestion(p, second.q).then(() => true, () => false);
  t.check(out && moved, 'tangentbord: med fokus utanför rutan räknar den ned och går vidare');
  await ctx.close();
}

/** På engelska heter knappen "Next". Frågorna är på engelska, så svaren gissas: klicka fel län tills en fråga missas. */
async function english(run, t) {
  const ctx = await context(run, 'android', { lang: 'en' });
  const p = await page(ctx);
  await p.goto(url(run));
  await p.click('.mode-btn[data-mode="lan"]');
  await p.waitForSelector('.screen-game .map path');
  for (let i = 0; i < 12 && !(await p.$('.toast.is-visible .toast-action')); i++) {
    await answerAccepted(p, { code: FAR_COUNTIES[i % 2] });
    await sleep(p, 1600);
  }
  const r = await measureMiss(p);
  t.check(r.button === 'Next' && r.hint === 'Press and hold the map to look longer', `engelska: knappen "${r.button}", hinten "${r.hint}"`);
  await t.shot(p, 'en-miss');
  await ctx.close();
}

export default async function miss_(run) {
  const t = new Suite(run, 'miss');
  const rounds = [['lan'], ['sjo'], ['stad', { hold: true }], ['kommun', { hold: true }], ['ort'], ['landskap']];
  await Promise.all([
    ...rounds.map(([mode, opts]) => round(run, t, mode, opts).catch((e) => t.check(false, `${mode}: ${e.message.split('\n')[0]}`))),
    reducedMotion(run, t).catch((e) => t.check(false, `minska rörelse: ${e.message.split('\n')[0]}`)),
    english(run, t).catch((e) => t.check(false, `engelska: ${e.message.split('\n')[0]}`)),
    keyboard(run, t).catch((e) => t.check(false, `tangentbord: ${e.message.split('\n')[0]}`)),
  ]);
  return t;
}
