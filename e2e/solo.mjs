/** En hel omgång i varje läge, med rätt svar på varje fråga, fram till slutskärmen. */
import { ANSWERS, SMALLEST_MUNICIPALITIES, Suite, answerAccepted, context, countyFill, mapSettled, page, pointIn, url } from './lib.mjs';

const MODES = ['lan', 'landskap', 'kommun', 'stad', 'ort', 'sjo', 'blandat'];

async function playRound(run, t, mode) {
  const ctx = await context(run, 'iphone');
  const p = await page(ctx);
  await p.goto(url(run));
  await p.click(`.mode-btn[data-mode="${mode}"]`);
  await p.waitForSelector('.screen-game .map path');
  let answered = 0;
  let last = '';
  while (await p.locator('.screen-game').count()) {
    // Vänta på nästa fråga (och att kartan zoomat ut efter den förra).
    const q = await p
      .waitForFunction((last) => {
        const text = document.querySelector('.question')?.textContent?.trim();
        return !document.querySelector('.screen-game') ? '__end__' : text && text !== last && !text.endsWith('…') ? text : false;
      }, last, { timeout: 15000 })
      .then((h) => h.jsonValue());
    if (q === '__end__') break;
    await p.waitForTimeout(450);
    const answer = ANSWERS.get(q);
    if (!t.check(!!answer, `${mode}: känner igen frågan "${q}"`)) break;
    if (mode === 'kommun' && answered < 3) {
      // PO-16: kartan zoomar in så att länet fyller den.
      await mapSettled(p);
      const fill = await countyFill(p, answer.code);
      if (!t.check(fill.inside && fill.share >= 0.6, `kommun: länet fyller kartan (${Math.round(fill.share * 100)} %, helt synligt ${fill.inside}) – ${q}`)) await t.shot(p, 'kommun-fel-vy');
      if (answered === 0) await t.shot(p, 'kommun-inzoomat');
    }
    if (mode === 'kommun' && answered === 0) {
      // PO-16: de minsta kommunerna går att träffa (med zoom om det behövs). Sedan tillbaka till länet.
      for (const [code, name] of Object.entries(SMALLEST_MUNICIPALITIES)) {
        // Från hela Sverige, så att kommunen ligger i bild oavsett vilket län frågan gäller.
        await p.click('button[aria-label="Återställ zoom"]');
        await p.waitForTimeout(500);
        t.check(!!(await pointIn(p, `path.county[data-code="${code}"]`)), `kommun: ${name} går att träffa`);
      }
      await p.click('button[aria-label="Återställ zoom"]');
      await p.waitForTimeout(500);
    }
    await answerAccepted(p, answer);
    if (answered === 0) {
      await p.waitForSelector('.toast.is-visible');
      t.check(/^Rätt!/.test((await p.textContent('.toast')).trim()), `${mode}: första svaret blir rätt ("${(await p.textContent('.toast')).trim()}")`);
      await t.shot(p, `${mode}-fraga`);
    }
    answered++;
    last = q;
  }
  await p.waitForSelector('.screen-end .recap-map', { timeout: 15000 });
  await p.waitForTimeout(1200);
  const summary = (await p.textContent('.score-sub'))?.trim() ?? '';
  t.check(/^(\d+) av \1 rätt \(100 %\)/.test(summary), `${mode}: slutskärmen efter ${answered} frågor: "${summary}"`);
  await t.shot(p, `${mode}-slut`);
  t.check(p.errors.length === 0, `${mode}: inga fel i sidan ${p.errors.slice(0, 3).join(' | ')}`);
  t.check(ctx.blocked.length === 0, `${mode}: inga stoppade anrop ${ctx.blocked.join(', ')}`);
  await ctx.close();
}

/**
 * PO-16: ett tryck på en för liten kommun förstorar kartan och förklarar det de tre första gångerna
 * på enheten, och utanför länet är kartan nedtonad.
 */
async function kommunMagnify(run, t) {
  const ctx = await context(run, 'iphone');
  const p = await page(ctx);
  await p.goto(url(run));
  await p.click('.mode-btn[data-mode="kommun"]');
  await p.waitForFunction(() => / i .+ län\?$/.test(document.querySelector('.question')?.textContent ?? '') && document.querySelector('.map path'));
  await mapSettled(p);
  const dim = await p.evaluate(() => ({ outside: document.querySelectorAll('path.county.is-outside').length, all: document.querySelectorAll('path.county').length }));
  t.check(dim.outside > 200 && dim.outside < dim.all, `kommun: kartan utanför länet är nedtonad (${dim.outside} av ${dim.all} kommuner)`);
  const scale = () => p.evaluate(() => Number(/scale\(([\d.]+)/.exec(document.querySelector('.map-root').getAttribute('transform') ?? '')?.[1] ?? 1));
  const hints = [];
  for (let i = 0; i < 4; i++) {
    // Från hela Sverige, där Sundbyberg är långt under 28 px.
    await p.click('button[aria-label="Återställ zoom"]');
    await mapSettled(p);
    const box = await p.$eval('path.county[data-code="0183"]', (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    const before = await scale();
    await p.mouse.click(box.x, box.y);
    await p.waitForTimeout(250);
    hints.push(await p.evaluate(() => document.querySelector('.toast-info.is-visible')?.textContent?.trim() ?? ''));
    await mapSettled(p);
    t.check((await scale()) > before * 1.4, `kommun: tryck ${i + 1} på Sundbyberg förstorar kartan (×${before.toFixed(1)} → ×${(await scale()).toFixed(1)})`);
    if (i === 0) await t.shot(p, 'kommun-forstorat');
    await p.waitForTimeout(1800);
  }
  t.check(hints.slice(0, 3).every((h) => h === 'Liten kommun – förstorat, tryck igen') && hints[3] === '', `kommun: förklaringen visas de tre första gångerna (${hints.map((h) => h || '–').join(' | ')})`);
  t.check(p.errors.length === 0, `kommun, förstoring: inga fel i sidan ${p.errors.slice(0, 3).join(' | ')}`);
  await ctx.close();
}

/** PO-16: med "minska rörelse" zoomar kartan in på länet direkt, utan animation. */
async function kommunReducedMotion(run, t) {
  const ctx = await context(run, 'android', { reducedMotion: true });
  const p = await page(ctx);
  await p.goto(url(run));
  await p.click('.mode-btn[data-mode="kommun"]');
  await p.waitForFunction(() => / i .+ län\?$/.test(document.querySelector('.question')?.textContent ?? '') && document.querySelector('.map path'));
  const answer = ANSWERS.get((await p.textContent('.question')).trim());
  await p.waitForTimeout(60);
  const fill = await countyFill(p, answer.code);
  t.check(fill.inside && fill.share >= 0.6, `kommun med minska rörelse: länet fyller kartan direkt (${Math.round(fill.share * 100)} %)`);
  await ctx.close();
}

export default async function solo(run) {
  const t = new Suite(run, 'solo');
  await Promise.all([
    ...MODES.map((mode) => playRound(run, t, mode).catch((e) => t.check(false, `${mode}: ${e.message.split('\n')[0]}`))),
    kommunReducedMotion(run, t).catch((e) => t.check(false, `kommun med minska rörelse: ${e.message.split('\n')[0]}`)),
    kommunMagnify(run, t).catch((e) => t.check(false, `kommun, förstoring: ${e.message.split('\n')[0]}`)),
  ]);
  return t;
}
