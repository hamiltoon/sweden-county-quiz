/**
 * PO-33: minnesreglerna.
 * - Datan: varje regel gäller saker som finns, och `short` är högst 110 tecken.
 * - Avslöjandet: efter en miss på något med en regel står `short` under kartan, kartan är minst
 *   400 px hög på 360 × 740, och spelet väntar på ett tryck.
 * - Slutskärmen: regeln under den missade saken, med "Varför?" och 👍/👎; rösten sparas (på staging).
 * - "Hjälpte minnesregeln?" i nästa omgång, när man svarar rätt på samma sak.
 * - Tipsraden i lägets kort och sidan /minnesregler (kommentar och förslag sparas på staging).
 * Mot produktionen stoppas alla POST till /api/mnemonics av skyddsräcket.
 */
import { MNEMONICS } from '../src/data/mnemonics.ts';
import { COUNTIES } from '../src/data/counties.ts';
import { PROVINCES } from '../src/data/provinces.ts';
import { LAKES } from '../src/data/lakes.ts';
import { MUNICIPALITIES } from '../src/data/municipalities.ts';
import { ANSWERS, Suite, answerAccepted, context, isGuarded, page, questionText, url } from './lib.mjs';
import { axe } from './a11y.mjs';
import { miss, nextQuestion } from './miss.mjs';

const SHORT_MAX = 110;
/** Sjöar vars regel har en kort text, i den ordning reglerna väljs (en regel om saken före en tankeregel). */
const ruleForLake = (id) => {
  const matching = MNEMONICS.filter((r) => r.targets.sjo?.includes(id));
  return matching.find((r) => r.category !== 'princip') ?? matching[0] ?? null;
};
const sleep = (p, ms) => p.waitForTimeout(ms);

function checkData(t) {
  const known = {
    lan: new Set(COUNTIES.map((c) => c.code)),
    stad: new Set(COUNTIES.map((c) => c.code)),
    landskap: new Set(PROVINCES.map((p) => p.code)),
    sjo: new Set(LAKES.map((l) => l.id)),
    kommun: new Set(MUNICIPALITIES.map((m) => m.code)),
  };
  const unknown = MNEMONICS.flatMap((r) => Object.entries(r.targets).flatMap(([kind, ids]) => ids.filter((id) => !known[kind]?.has(id)).map((id) => `${r.id}:${kind}:${id}`)));
  t.check(unknown.length === 0, `regeldatan: alla ${MNEMONICS.length} regler gäller saker som finns ${unknown.join(', ')}`);
  const long = MNEMONICS.filter((r) => r.short && [...r.short].length > SHORT_MAX).map((r) => r.id);
  t.check(long.length === 0, `regeldatan: short är högst ${SHORT_MAX} tecken ${long.join(', ')}`);
  t.check(new Set(MNEMONICS.map((r) => r.id)).size === MNEMONICS.length, 'regeldatan: unika id');
}

/** Svarar rätt tills frågan gäller en sjö vars regel har kort text; ger frågan. */
async function untilRuleLake(p, last = '') {
  for (let i = 0; i < 12; i++) {
    const q = await nextQuestion(p, last);
    const lake = ANSWERS.get(q)?.lake;
    if (lake && ruleForLake(lake)?.short) return q;
    await sleep(p, 450);
    await answerAccepted(p, ANSWERS.get(q));
    last = q;
  }
  throw new Error('ingen sjö med en kort regel kom');
}

/** Svarar rätt på resten av omgången, fram till slutskärmen. */
async function finishRound(p, last) {
  while (await p.locator('.screen-game').count()) {
    const q = await p
      .waitForFunction((last) => {
        const text = document.querySelector('.question')?.textContent?.trim();
        return !document.querySelector('.screen-game') ? '__end__' : text && text !== last && !text.endsWith('…') ? text : false;
      }, last, { timeout: 15000 })
      .then((h) => h.jsonValue());
    if (q === '__end__') break;
    await sleep(p, 450);
    await answerAccepted(p, ANSWERS.get(q));
    last = q;
  }
  await p.waitForSelector('.screen-end .result-list, .screen-end .perfect', { timeout: 15000 });
}

/** En postning till /api/mnemonics: sparad (staging, localhost) eller stoppad (produktionen). */
function posted(run, ctx, p, path, before) {
  if (run.guarded) return Promise.resolve(ctx.blocked.length > before ? 'stoppad' : 'skickad');
  return p.waitForResponse((r) => r.url().includes(`/api/mnemonics/${path}`), { timeout: 8000 }).then((r) => (r.ok() ? 'sparad' : `svar ${r.status()}`), () => 'inget svar');
}

async function revealAndEnd(run, t) {
  const ctx = await context(run, 'android');
  const p = await page(ctx);
  await p.goto(url(run));
  await p.click('.mode-btn[data-mode="sjo"]');
  await p.waitForSelector('.screen-game .map path');
  const q = await untilRuleLake(p);
  const rule = ruleForLake(ANSWERS.get(q).lake);
  await miss(p, 'sjo', { withRule: true });
  await sleep(p, 900);
  const r = await p.evaluate(() => ({
    strip: document.querySelector('.mnemonic-strip')?.textContent?.trim() ?? null,
    rule: document.querySelector('.mnemonic-strip')?.dataset.rule ?? null,
    mapHeight: document.querySelector('.map').getBoundingClientRect().height,
    stripVisible: (() => {
      const s = document.querySelector('.mnemonic-strip')?.getBoundingClientRect();
      return !!s && s.bottom <= innerHeight + 1 && s.top >= 0;
    })(),
    countdown: !!document.querySelector('.toast-action .advance-count'),
  }));
  await t.shot(p, 'avslojande-regel');
  t.check(r.rule === rule.id && r.strip === `💡 ${rule.short}` && r.stripVisible, `avslöjandet: "${r.strip}" under kartan (${q})`);
  t.check(r.mapHeight >= 400, `avslöjandet: kartan är ${Math.round(r.mapHeight)} px hög på 360 × 740 (minst 400)`);
  t.check(!r.countdown, 'avslöjandet: ingen nedräkning när en regel visas');
  await sleep(p, 5500);
  t.check((await questionText(p)) === q, 'avslöjandet: med en regel väntar spelet på ett tryck (står kvar efter 6 s)');
  await p.click('.toast-action');
  const next = await nextQuestion(p, q);
  t.check(!(await p.$('.mnemonic-strip')), 'avslöjandet: regeln försvinner med nästa fråga');
  await sleep(p, 450);
  await answerAccepted(p, ANSWERS.get(next));
  await finishRound(p, next);

  // Slutskärmen: regeln under den missade sjön, med "Varför?" och röstknappar.
  const end = await p.evaluate((id) => {
    const box = document.querySelector(`.result-list .mnemonic[data-rule="${id}"]`);
    return box ? { text: box.querySelector('.mnemonic-text')?.textContent?.trim(), why: !!box.querySelector('details.mnemonic-why'), votes: box.querySelectorAll('.vote-btn').length } : null;
  }, rule.id);
  t.check(end?.text === `💡 ${rule.text}` && end.why === !!rule.why && end.votes === 2, `slutskärmen: regeln under den missade sjön med Varför? och 👍/👎 ${JSON.stringify(end)}`);
  await t.shot(p, 'slutskarm-regel');
  await axe(t, p, 'slutskärmen med en minnesregel');
  const before = ctx.blocked.length;
  const saving = posted(run, ctx, p, 'vote', before);
  await p.click(`.mnemonic[data-rule="${rule.id}"] .vote-btn[data-vote="1"]`);
  const result = await saving;
  const pressed = await p.getAttribute(`.mnemonic[data-rule="${rule.id}"] .vote-btn[data-vote="1"]`, 'aria-pressed');
  t.check(pressed === 'true' && result === (run.guarded ? 'stoppad' : 'sparad'), `slutskärmen: 👍 är vald och rösten ${result}`);
  if (!run.guarded) {
    const mine = await p.evaluate(async () => {
      const device = JSON.parse(localStorage.getItem('sverigespelet.device.v1'));
      return (await (await fetch(`/api/mnemonics?device=${device}`)).json()).mine;
    });
    t.check(mine[rule.id] === 1, `servern har enhetens röst på ${rule.id} (${JSON.stringify(mine)})`);
  }

  // Nästa omgång: rätt på samma sjö → "Hjälpte minnesregeln?" en gång.
  await p.click('.btn-row .btn-primary');
  await p.waitForSelector('.screen-game .map path');
  await finishRound(p, '');
  const helped = await p.evaluate(() => document.querySelector('.mnemonic-helped')?.dataset.rule ?? null);
  t.check(helped === rule.id, `nästa omgång: "Hjälpte minnesregeln?" om ${helped} (väntat ${rule.id})`);
  await t.shot(p, 'hjalpte-regeln');
  const helpedBefore = ctx.blocked.length;
  const answering = posted(run, ctx, p, 'helped', helpedBefore);
  await p.click('.mnemonic-helped [data-helped="yes"]');
  const answered = await answering;
  t.check((await p.textContent('.mnemonic-helped'))?.trim() === 'Tack!' && answered === (run.guarded ? 'stoppad' : 'sparad'), `"Hjälpte"-svaret ${answered}, och rutan säger tack`);
  // En tredje omgång frågar inte igen om samma regel.
  await p.click('.btn-row .btn-primary');
  await p.waitForSelector('.screen-game .map path');
  await finishRound(p, '');
  t.check(!(await p.$('.mnemonic-helped')), 'tredje omgången: frågan ställs bara en gång per regel');
  t.check(p.errors.length === 0, `inga fel i sidan ${p.errors.slice(0, 3).join(' | ')}`);
  if (run.guarded) t.check(ctx.blocked.every((b) => b.startsWith('POST /api/mnemonics/') || b.startsWith('POST /api/scores')), `bara stoppade röster och resultat ${ctx.blocked.join(', ')}`);
  await ctx.close();
}

/** Tipsraden i lägets kort, och sidan /minnesregler med röster, kommentarer och förslag. */
async function startAndPage(run, t) {
  const ctx = await context(run, 'iphone');
  const p = await page(ctx);
  await p.goto(url(run));
  const tip = (await p.textContent('.mode-btn[data-mode="lan"] .mode-tip').catch(() => null))?.trim();
  t.check(/^Tips: /.test(tip ?? '') && [...tip].length <= SHORT_MAX + 6, `lägeskortet för län har en tipsrad: "${tip}"`);
  const lakeTip = (await p.textContent('.mode-btn[data-mode="sjo"] .mode-tip').catch(() => null))?.trim();
  t.check(lakeTip === 'Tips: Slutar sjön på -jaure eller -träsk ligger den i Lappland.', `lägeskortet för sjöar har en tipsrad: "${lakeTip}"`);
  t.check(!(await p.$('.mode-btn[data-mode="ort"] .mode-tip')), 'lägeskortet för fler städer har ingen tipsrad (ingen tankeregel)');

  await p.click('a.mnemonic-link');
  await p.waitForSelector('.mnemonics-page h1');
  t.check(new URL(p.url()).pathname === '/minnesregler', `länken öppnar /minnesregler (${new URL(p.url()).pathname})`);
  await p.waitForFunction(() => document.querySelector('.mnemonics-status')?.textContent === '', null, { timeout: 8000 }).catch(() => undefined);
  const info = await p.evaluate(() => ({
    cards: document.querySelectorAll('.mnemonic-card').length,
    status: document.querySelector('.mnemonics-status')?.textContent,
    stats: document.querySelector('.mnemonic-card .mnemonic-stats')?.textContent,
  }));
  t.check(info.cards === MNEMONICS.length && info.status === '' && /^👍 \d+ · 👎 \d+/.test(info.stats ?? ''), `sidan visar alla ${info.cards} regler med röster (${info.stats})`);
  await t.shot(p, 'minnesregler');
  await axe(t, p, '/minnesregler');

  const first = MNEMONICS[0].id;
  await p.click(`.mnemonic-card[data-rule="${first}"] .mnemonic-discuss summary`);
  await p.fill(`#comment-${first}`, 'e2e: bra regel');
  const commentBefore = ctx.blocked.length;
  const commenting = posted(run, ctx, p, 'comment', commentBefore);
  await p.click(`.mnemonic-card[data-rule="${first}"] .mnemonic-form button[type="submit"]`);
  const commented = await commenting;
  t.check(commented === (run.guarded ? 'stoppad' : 'sparad'), `kommentaren ${commented}`);
  if (!run.guarded) {
    await p.waitForFunction((id) => [...document.querySelectorAll(`.mnemonic-card[data-rule="${id}"] .mnemonic-comments li`)].some((li) => li.textContent.includes('e2e: bra regel')), first);
  }
  await p.check('input[name="kind"][value="wish"]');
  await p.fill('#suggest-text', 'e2e: en regel för Gotland');
  const suggestBefore = ctx.blocked.length;
  const suggesting = posted(run, ctx, p, 'suggest', suggestBefore);
  await p.click('.mnemonic-suggest button[type="submit"]');
  const suggested = await suggesting;
  t.check(suggested === (run.guarded ? 'stoppad' : 'sparad'), `förslaget ${suggested}`);

  await p.goBack();
  await p.waitForSelector('.screen-start .mode-list');
  t.check(new URL(p.url()).pathname === '/', 'bakåt leder till startskärmen');
  t.check(p.errors.length === 0, `inga fel i sidan ${p.errors.slice(0, 3).join(' | ')}`);
  await ctx.close();
}

/** På engelska har reglerna ingen text än: ingen tipsrad, och sidan säger det. */
async function english(run, t) {
  const ctx = await context(run, 'android', { lang: 'en' });
  const p = await page(ctx);
  await p.goto(url(run, 'minnesregler'));
  await p.waitForSelector('.mnemonics-page h1');
  const text = await p.textContent('.mnemonics-page');
  t.check(text.includes('only in Swedish') && !(await p.$('.mnemonic-card')), 'engelska: sidan säger att reglerna bara finns på svenska');
  await p.goto(url(run));
  t.check(!(await p.$('.mode-tip')), 'engelska: ingen tipsrad i lägeskorten');
  await ctx.close();
}

export default async function mnemonics(run) {
  const t = new Suite(run, 'regler');
  run.guarded = isGuarded(run.base);
  checkData(t);
  await Promise.all([
    revealAndEnd(run, t).catch((e) => t.check(false, `avslöjande och slutskärm: ${e.message.split('\n')[0]}`)),
    startAndPage(run, t).catch((e) => t.check(false, `lägeskort och sida: ${e.message.split('\n')[0]}`)),
    english(run, t).catch((e) => t.check(false, `engelska: ${e.message.split('\n')[0]}`)),
  ]);
  return t;
}

