/** En hel omgång i varje läge, med rätt svar på varje fråga, fram till slutskärmen. */
import { ANSWERS, Suite, clickAnswer, context, page, questionText } from './lib.mjs';

const MODES = ['lan', 'landskap', 'kommun', 'stad', 'ort', 'sjo', 'blandat'];

async function playRound(run, t, mode) {
  const ctx = await context(run, 'iphone');
  const p = await page(ctx);
  await p.goto(run.base);
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
    await clickAnswer(p, answer);
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

export default async function solo(run) {
  const t = new Suite(run, 'solo');
  await Promise.all(
    MODES.map((mode) =>
      playRound(run, t, mode).catch((e) => t.check(false, `${mode}: ${e.message.split('\n')[0]}`)),
    ),
  );
  return t;
}
