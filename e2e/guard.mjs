/**
 * Skyddsräcket: mot produktionen får testerna aldrig skicka resultat till topplistan, skapa
 * passkeys eller ändra ett kontos språk. Här prövas att anropen verkligen stoppas i webbläsaren,
 * innan de lämnar den, och att produktionens adress känns igen.
 */
import { GUARDED, Suite, context, isProduction, page } from './lib.mjs';

export default async function guard(run) {
  const t = new Suite(run, 'guard');
  t.check(isProduction('https://sverigespelet.hamiltoon.workers.dev/'), 'produktionens adress känns igen');
  t.check(!isProduction('https://sverigespelet-staging.hamiltoon.workers.dev/'), 'staging räknas inte som produktion');
  t.check(GUARDED.length === 3, 'topplistan, passkeys och kontots språk skyddas');
  // Samma skydd som mot produktionen, här påslaget oavsett adress.
  const ctx = await context(run, 'desktop', { guard: true });
  const p = await page(ctx);
  await p.goto(run.base);
  const attempts = [
    ['POST', '/api/scores'],
    ['POST', '/api/passkey/register/options'],
    ['POST', '/api/passkey/login/options'],
    ['POST', '/api/me/language'],
  ];
  for (const [method, path] of attempts) {
    const result = await p.evaluate(
      ([method, path]) => fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: '{}' }).then((r) => `svar ${r.status}`, () => 'stoppat'),
      [method, path],
    );
    t.check(result === 'stoppat', `${method} ${path}: ${result}`);
  }
  t.check(ctx.blocked.length === attempts.length, `alla ${attempts.length} anrop stoppades i webbläsaren`);
  const read = await p.evaluate(() => fetch('/api/scores?mode=lan').then((r) => r.status));
  t.check(read === 200, `att läsa topplistan går fortfarande (${read})`);
  await ctx.close();
  return t;
}
