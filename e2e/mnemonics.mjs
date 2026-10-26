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
import { miss } from './miss.mjs';

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

/** Sjöarna som har samma regel som `id` (t.ex. Vänern och Vättern). */
const partnersOf = (id) => LAKES.map((l) => l.id).filter((other) => other !== id && ruleForLake(other)?.id === ruleForLake(id)?.id);

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
  await p.waitForSelector('.screen-end .btn-row', { timeout: 15000 });
}

/** En postning till /api/mnemonics: sparad (staging, localhost) eller stoppad (produktionen). */
function posted(run, ctx, p, path, before) {
  if (run.guarded) return Promise.resolve(ctx.blocked.length > before ? 'stoppad' : 'skickad');
  return p.waitForResponse((r) => r.url().includes(`/api/mnemonics/${path}`), { timeout: 8000 }).then((r) => (r.ok() ? 'sparad' : `svar ${r.status()}`), () => 'inget svar');
}

/** Antal regler (med kort text eller inte) som gäller någon sjö: så många rader får slutskärmen om alla missas. */
const LAKE_RULES = new Set(LAKES.map((l) => ruleForLake(l.id)?.id).filter(Boolean)).size;

/** Svarar på nästa fråga, eller ger '__end__' när omgången är slut. */
function nextOrEnd(p, last) {
  return p
    .waitForFunction((last) => {
      const text = document.querySelector('.question')?.textContent?.trim();
      return !document.querySelector('.screen-game') ? '__end__' : text && text !== last && !text.endsWith('…') ? text : false;
    }, last, { timeout: 15000 })
    .then((h) => h.jsonValue());
}

async function revealAndEnd(run, t) {
  const ctx = await context(run, 'android');
  const p = await page(ctx);
  await p.goto(url(run));
  await p.click('.mode-btn[data-mode="sjo"]');
  await p.waitForSelector('.screen-game .map path');
  // Första omgången: missa alla tio sjöarna. Den första sjön som har en kort regel som den delar med
  // en annan sjö (t.ex. Vänern och Vättern) kontrolleras i avslöjandet.
  let rule = null;
  let ruleLakes = [];
  let last = '';
  for (;;) {
    const q = await nextOrEnd(p, last);
    if (q === '__end__') break;
    await sleep(p, 450);
    const lake = ANSWERS.get(q).lake;
    await miss(p, 'sjo', { withRule: true });
    if (!rule && ruleForLake(lake)?.short && partnersOf(lake).length) {
      rule = ruleForLake(lake);
      ruleLakes = [lake, ...partnersOf(lake)];
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
      await nextOrEnd(p, q);
      t.check(!(await p.$('.mnemonic-strip')), 'avslöjandet: regeln försvinner med nästa fråga');
    } else {
      await p.click('.toast-action');
    }
    last = q;
  }
  await p.waitForSelector('.screen-end .mnemonic-rules', { timeout: 15000 });
  if (!t.check(!!rule, 'första omgången hade en sjö med en kort regel som gäller två sjöar')) return;

  // Slutskärmen: en rad per regel, de tre första synliga, "Visa alla (N)" och en länk till alla regler.
  const end = await p.evaluate((id) => {
    const rows = [...document.querySelectorAll('.mnemonic-rules li.mnemonic')];
    const row = rows.find((r) => r.dataset.rule === id);
    return {
      rows: rows.length,
      visible: rows.filter((r) => !r.hidden).length,
      sameRule: rows.filter((r) => r.dataset.rule === id).length,
      showAll: document.querySelector('.mnemonic-show-all')?.textContent ?? null,
      link: document.querySelector('.mnemonic-rules a.mnemonic-link')?.getAttribute('href') ?? null,
      about: row?.querySelector('.mnemonic-about')?.textContent ?? null,
      text: row?.querySelector('.mnemonic-text')?.textContent?.trim() ?? null,
      more: !!row?.querySelector('details.mnemonic-more'),
      votes: row?.querySelectorAll('.vote-btn').length ?? 0,
    };
  }, rule.id);
  t.check(end.rows === LAKE_RULES && end.visible === 3 && end.showAll === `Visa alla (${LAKE_RULES})`, `slutskärmen: ${end.rows} regler, ${end.visible} synliga och "${end.showAll}"`);
  const names = ruleLakes.map((id) => LAKES.find((l) => l.id === id).name);
  t.check(end.sameRule === 1 && names.every((n) => end.about?.includes(n)), `slutskärmen: regeln står en gång med sjöarna i rubriken ("${end.about}")`);
  t.check(end.text === `💡 ${rule.short}` && end.more && end.votes === 2, `slutskärmen: kort text, Mer och 👍/👎 ${JSON.stringify({ text: end.text, more: end.more, votes: end.votes })}`);
  t.check(end.link === '/minnesregler', `slutskärmen: länken "Alla minnesregler" (${end.link})`);
  const layout = await p.evaluate(() => {
    const again = document.querySelector('.btn-row .btn-primary').getBoundingClientRect().top + scrollY;
    const rules = document.querySelector('.mnemonic-rules').getBoundingClientRect().height;
    return { again: Math.round(again), rules: Math.round(rules) };
  });
  t.note(`slutskärmen efter tio missade sjöar på 360 × 740: Spela igen ${layout.again} px ned, varav minnesreglerna ${layout.rules} px`);
  await p.$eval('.mnemonic-rules', (el) => el.scrollIntoView({ block: 'start' }));
  await t.shot(p, 'slutskarm-regel');
  await p.click('.mnemonic-show-all');
  const all = await p.evaluate(() => ({
    visible: [...document.querySelectorAll('.mnemonic-rules li.mnemonic')].filter((r) => !r.hidden).length,
    focused: document.activeElement?.classList.contains('mnemonic') ?? false,
  }));
  t.check(all.visible === LAKE_RULES && all.focused, `slutskärmen: "Visa alla" visar alla ${all.visible} och flyttar fokus till nästa regel`);
  await p.click(`.mnemonic[data-rule="${rule.id}"] details.mnemonic-more summary`);
  t.check(await p.isVisible(`.mnemonic[data-rule="${rule.id}"] details.mnemonic-more[open] p`), 'slutskärmen: Mer fäller ut hela texten och varför');
  await axe(t, p, 'slutskärmen med minnesregler');
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

  // Nästa omgång, med rätt på alla sjöar: "Hjälpte minnesregeln?" om en av reglerna från förra omgången.
  const seenRules = new Set(LAKES.map((l) => ruleForLake(l.id)?.id).filter(Boolean));
  await p.click('.btn-row .btn-primary');
  await p.waitForSelector('.screen-game .map path');
  await finishRound(p, '');
  const helped = await p.evaluate(() => document.querySelector('.mnemonic-helped')?.dataset.rule ?? null);
  t.check(!!helped && seenRules.has(helped), `nästa omgång: "Hjälpte minnesregeln?" om ${helped}, en regel från förra omgången`);
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
  const again = await p.evaluate(() => document.querySelector('.mnemonic-helped')?.dataset.rule ?? null);
  t.check(again !== helped, `tredje omgången: frågan om ${helped} ställs inte igen (nu: ${again ?? 'ingen'})`);
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

