/**
 * PO-15: avslöjandet efter en missad fråga i solospelet, i varianterna ?v=a, b och c.
 * 1. Felklicket och rätt svar syns i samma vy, fria från rutan.
 * 2. Rätt svar har sitt namn på kartan.
 * 3. Efter en miss går spelet vidare först med "Nästa" (a) eller efter minst 4 s (b, c), och
 *    nedräkningen står still medan man håller fingret på kartan (b). Rätt på första försöket går
 *    vidare lika snabbt som förut.
 * Dessutom: linjen med avståndet (c), ingen zoomanimation med "minska rörelse", och engelska.
 */
import { MUNICIPALITIES } from '../src/data/municipalities.ts';
import { axe } from './a11y.mjs';
import { ALL_CODES, ANSWERS, COUNTY_BY_CODE, Suite, answerAccepted, clickAnswer, context, mapSettled, page, questionText, url } from './lib.mjs';

const MUNICIPALITY_COUNTY = new Map(MUNICIPALITIES.map((m) => [m.code, m.county]));
/** Län långt ifrån varandra, att klicka fel på. */
const FAR_COUNTIES = ['BD', 'M', 'I', 'S'];

/** Tre felsvar för frågan: andra län, kommuner i samma län eller residensstäder långt bort. */
function wrongAnswers(mode, answer) {
  if (mode === 'kommun') {
    const county = MUNICIPALITY_COUNTY.get(answer.code);
    return MUNICIPALITIES.filter((m) => m.county === county && m.code !== answer.code)
      .slice(0, 3)
      .map((m) => ({ code: m.code }));
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
      button: document.querySelector('.toast.is-visible .toast-action')?.textContent ?? null,
      transform: document.querySelector('.map-root').getAttribute('transform'),
    };
  });
}

const sleep = (p, ms) => p.waitForTimeout(ms);

/** Svarar rätt på frågorna tills läget har den sortens fråga som ska missas (blandat behövs inte här). */
async function nextQuestion(p, last) {
  return p
    .waitForFunction((last) => {
      const text = document.querySelector('.question')?.textContent?.trim();
      return text && text !== last && !text.endsWith('…') ? text : false;
    }, last, { timeout: 15000 })
    .then((h) => h.jsonValue());
}

/** Missar första frågan med tre felsvar. Ger frågan och rätt svar. */
async function miss(p, mode) {
  const q = await nextQuestion(p, '');
  await sleep(p, 450);
  const answer = ANSWERS.get(q);
  if (!answer) throw new Error(`känner inte igen frågan "${q}"`);
  const wrong = wrongAnswers(mode, answer);
  for (const w of wrong.slice(0, -1)) {
    await answerAccepted(p, w);
    // Vänta tills den korta felrutan gått, så att nästa felsvar tas emot för sig.
    await sleep(p, 1400);
  }
  // Det sista felsvaret klickas inte om i onödan (ett klick till på kartan skulle gå vidare i b och c),
  // bara om det förstorade kartan i stället för att räknas (små kommuner).
  await watch(p, q, '.toast-action');
  for (let attempt = 0; attempt < 4; attempt++) {
    await clickAnswer(p, wrong.at(-1));
    if (await p.waitForSelector('.toast-action', { timeout: 4000 }).then(() => true, () => false)) return { q, answer };
    await mapSettled(p);
  }
  throw new Error(`det sista felsvaret togs inte emot (${q})`);
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

async function variantRound(run, t, variant, mode, device = 'iphone') {
  const name = `${variant}, ${mode}`;
  const ctx = await context(run, device);
  const p = await page(ctx);
  await p.goto(url(run, `?v=${variant}`));
  await p.click(`.mode-btn[data-mode="${mode}"]`);
  await p.waitForSelector('.screen-game .map path');
  const { q } = await miss(p, mode);
  // Fokus före hållet i b (ett tryck på kartan tar fokus från knappen, som det ska).
  const focused = await p.evaluate(() => document.activeElement?.classList.contains('toast-action') ?? false);
  let heldSince = null;
  if (variant === 'b') {
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
  await t.shot(p, `${variant}-${mode}-miss`);
  t.check(r.wrong > 0.1 && r.target > 0.95, `${name}: felklicket (${Math.round(r.wrong * 100)} %) och rätt svar (${Math.round(r.target * 100)} %) syns i samma vy, fritt från rutan – ${q}`);
  const place = q.replace(/^Var ligger /, '').replace(/ i .+ län\?$/, '').replace(/\?$/, '');
  t.check(r.label?.text === place && r.label.visible, `${name}: namnet "${r.label?.text}" står på kartan och syns (väntat "${place}")`);
  t.check(/^Nästa/.test(r.button ?? '') && focused, `${name}: knappen "${r.button}" har fokus`);
  if (variant === 'c') t.check(r.line && /^\d+ km$/.test(r.distance ?? ''), `${name}: linjen till rätt svar med avståndet "${r.distance}"`);
  else t.check(!r.line, `${name}: ingen linje`);

  if (variant === 'a') {
    // Ingen nedräkning i a, så axe hinner gå igenom rutan med knappen.
    await axe(t, p, `${name}, fel-rutan med knappen`);
    await sleep(p, Math.max(0, 6000 - (await missTiming(p)).elapsed));
    const { elapsed, until } = await missTiming(p);
    t.check(until === null && (await questionText(p)) === q, `${name}: ingen automatik, frågan står kvar efter ${(elapsed / 1000).toFixed(1)} s`);
    await p.click('.toast-action');
    t.check((await nextQuestion(p, q)) !== q, `${name}: "Nästa" går vidare`);
  } else {
    if (heldSince !== null) {
      await sleep(p, Math.max(0, 3000 - (Date.now() - heldSince)));
      const paused = await p.$eval('.toast-action', (b) => b.classList.contains('is-paused'));
      await p.mouse.up();
      t.check(paused, `${name}: nedräkningen står still medan man håller på kartan`);
    }
    await nextQuestion(p, q);
    const { until, held } = await missTiming(p);
    const after = (until - held) / 1000;
    // Minst 4 s från att rutan syns (b: utöver tiden man höll på kartan); nedräkningen kollar var 100:e ms.
    t.check(after >= 4 && after < 4.6, `${name}: går vidare av sig självt efter ${after.toFixed(2)} s${held > 500 ? ` (plus ${(held / 1000).toFixed(1)} s då man höll på kartan)` : ''}`);
  }

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

/** Med "minska rörelse" hoppar kartan direkt till vyn med felklicket och svaret. */
async function reducedMotion(run, t) {
  const ctx = await context(run, 'android', { reducedMotion: true });
  const p = await page(ctx);
  await p.goto(url(run, '?v=b'));
  await p.click('.mode-btn[data-mode="stad"]');
  await p.waitForSelector('.screen-game .map path');
  await miss(p, 'stad');
  await p.waitForSelector('.toast.is-visible .toast-action');
  await sleep(p, 80);
  const early = (await measureMiss(p)).transform;
  await sleep(p, 800);
  const late = (await measureMiss(p)).transform;
  t.check(early === late, `minska rörelse: ingen zoomanimation (${early} → ${late})`);
  t.check(!(await p.isVisible('.advance-bar')), 'minska rörelse: ingen rörlig nedräkningsstapel, bara siffran');
  await ctx.close();
}

/** På engelska heter knappen "Next". Frågorna är på engelska, så svaren gissas: klicka fel län tills en fråga missas. */
async function english(run, t) {
  const ctx = await context(run, 'android', { lang: 'en' });
  const p = await page(ctx);
  await p.goto(url(run, '?v=a'));
  await p.click('.mode-btn[data-mode="lan"]');
  await p.waitForSelector('.screen-game .map path');
  for (let i = 0; i < 12 && !(await p.$('.toast.is-visible .toast-action')); i++) {
    await answerAccepted(p, { code: FAR_COUNTIES[i % 2] });
    await sleep(p, 1600);
  }
  const button = (await p.textContent('.toast.is-visible .toast-action').catch(() => null))?.trim();
  t.check(button === 'Next', `engelska: knappen heter "${button}"`);
  await t.shot(p, 'en-miss');
  await ctx.close();
}

export default async function miss_(run) {
  const t = new Suite(run, 'miss');
  const rounds = [
    ['a', 'lan'],
    ['a', 'sjo'],
    ['b', 'stad'],
    ['b', 'kommun'],
    ['c', 'ort'],
    ['c', 'landskap'],
    ['c', 'kommun'],
  ];
  await Promise.all([
    ...rounds.map(([v, mode]) => variantRound(run, t, v, mode).catch((e) => t.check(false, `${v}, ${mode}: ${e.message.split('\n')[0]}`))),
    reducedMotion(run, t).catch((e) => t.check(false, `minska rörelse: ${e.message.split('\n')[0]}`)),
    english(run, t).catch((e) => t.check(false, `engelska: ${e.message.split('\n')[0]}`)),
  ]);
  return t;
}
