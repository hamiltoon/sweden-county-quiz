/**
 * Skyddsräcket: utom mot staging och localhost får testerna aldrig skicka resultat till
 * topplistan, skapa passkeys, ändra ett kontos språk eller rösta på minnesregler. Här prövas att anropen verkligen stoppas
 * i webbläsaren, innan de lämnar den, och att skyddet är på för alla andra adresser.
 */
import { GUARDED, Suite, context, isGuarded, page, url } from './lib.mjs';

export default async function guard(run) {
  const t = new Suite(run, 'guard');
  t.check(isGuarded('https://sverigespelet.hamiltoon.workers.dev/'), 'skyddet är på mot produktionen');
  t.check(isGuarded('https://sverigespelet.se/'), 'skyddet är på mot en okänd adress, t.ex. en framtida egen domän');
  t.check(!isGuarded('https://sverigespelet-staging.hamiltoon.workers.dev/'), 'skyddet är av mot staging');
  t.check(!isGuarded('http://localhost:8787/'), 'skyddet är av mot localhost');
  t.check(GUARDED.length === 4, 'topplistan, passkeys, kontots språk och minnesreglerna skyddas');
  // Samma skydd som mot produktionen, här påslaget oavsett adress.
  const ctx = await context(run, 'desktop', { guard: true });
  const p = await page(ctx);
  await p.goto(url(run));
  const attempts = [
    ['POST', '/api/scores'],
    ['POST', '/api/passkey/register/options'],
    ['POST', '/api/passkey/login/options'],
    ['POST', '/api/me/language'],
    ['POST', '/api/mnemonics/vote'],
    ['POST', '/api/mnemonics/helped'],
    ['POST', '/api/mnemonics/comment'],
    ['POST', '/api/mnemonics/suggest'],
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
  const rules = await p.evaluate(() => fetch('/api/mnemonics').then((r) => r.status));
  t.check(rules === 200, `att läsa minnesreglernas röster går fortfarande (${rules})`);
  await ctx.close();
  return t;
}
