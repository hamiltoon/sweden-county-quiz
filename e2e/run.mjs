/**
 * Acceptanstesterna: `npm run test:e2e -- [adress]` (standard: staging).
 *
 *   --verbose   skriv ut alla kontroller, inte bara de som fallerar
 *   --only=a,b  kör bara vissa tester (start, solo, live, guard)
 *
 * Skärmbilderna hamnar i e2e-results/<tid>/<test>/. Mot produktionen stoppas allt som skulle
 * skriva på topplistan eller skapa passkeys (se lib.mjs).
 */
import { join } from 'node:path';
import { STAGING, chromium, isProduction } from './lib.mjs';
import start from './start.mjs';
import solo from './solo.mjs';
import live from './live.mjs';
import guard from './guard.mjs';

const SUITES = { guard, start, solo, live };
const args = process.argv.slice(2);
const base = (args.find((a) => /^https?:/.test(a)) ?? process.env.BASE ?? STAGING).replace(/\/?$/, '/');
const only = args.find((a) => a.startsWith('--only='))?.slice(7).split(',');
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const run = {
  base,
  verbose: args.includes('--verbose'),
  out: join(process.cwd(), 'e2e-results', stamp),
  browser: await chromium.launch(),
};

console.log(`Acceptanstester mot ${base}${isProduction(base) ? ' (produktion: skrivande anrop stoppas)' : ''}`);
const started = Date.now();
const results = await Promise.all(
  Object.entries(SUITES)
    .filter(([name]) => !only || only.includes(name))
    .map(async ([name, suite]) => {
      const t0 = Date.now();
      try {
        const t = await suite(run);
        return { name, failures: t.failures, checks: t.checks, shots: t.shots, ms: Date.now() - t0 };
      } catch (e) {
        return { name, failures: [e.message.split('\n')[0]], checks: 0, shots: 0, ms: Date.now() - t0 };
      }
    }),
);
await run.browser.close();

let failed = 0;
for (const r of results) {
  failed += r.failures.length;
  console.log(`${r.failures.length ? '✗' : '✓'} ${r.name}: ${r.checks - r.failures.length}/${r.checks} kontroller, ${r.shots} skärmbilder, ${(r.ms / 1000).toFixed(0)} s`);
  for (const f of r.failures) console.log(`    ${f}`);
}
console.log(`${failed ? `${failed} fel` : 'Allt gick igenom'} på ${((Date.now() - started) / 1000).toFixed(0)} s. Skärmbilder: ${run.out}`);
process.exit(failed ? 1 : 0);
