/**
 * Acceptanstesterna: `npm run test:e2e -- [adress]` (standard: staging).
 *
 *   --verbose     skriv ut alla kontroller, inte bara de som fallerar
 *   --only=a,b    kör bara vissa tester (start, solo, miss, live, guard, a11y)
 *   --any-build   vänta inte på att servern kör bygget i dist/
 *
 * Före testerna väntar run.mjs (upp till tre minuter) på att servern serverar samma bygge som
 * ligger i dist/, så att en körning direkt efter en deploy inte testar en blandning av gammalt och nytt.
 *
 * Skärmbilderna hamnar i e2e-results/<tid>/<test>/. Utom mot staging och localhost stoppas allt
 * som skulle skriva på topplistan eller skapa passkeys (se lib.mjs).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { STAGING, chromium, isGuarded } from './lib.mjs';
import start from './start.mjs';
import solo from './solo.mjs';
import live from './live.mjs';
import guard from './guard.mjs';
import a11y from './a11y.mjs';
import miss from './miss.mjs';

const SUITES = { guard, start, solo, miss, live, a11y };
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

console.log(`Acceptanstester mot ${base}${isGuarded(base) ? ' (inte staging eller localhost: skrivande anrop stoppas)' : ''}`);
if (!args.includes('--any-build')) await waitForBuild(base);

/** Väntar tills servern serverar samma huvudskript som dist/index.html pekar på. */
async function waitForBuild(base) {
  const local = join(process.cwd(), 'dist', 'index.html');
  if (!existsSync(local)) return;
  const script = (html) => /src="(\/assets\/index-[^"]+\.js)"/.exec(html)?.[1] ?? null;
  const expected = script(readFileSync(local, 'utf8'));
  if (!expected) return;
  const until = Date.now() + 3 * 60_000;
  let served = null;
  while (Date.now() < until) {
    served = await fetch(`${base}?build=${Date.now()}`, { cache: 'no-store' })
      .then((r) => r.text())
      .then(script, () => null);
    if (served === expected) {
      console.log(`Servern kör bygget i dist/ (${expected}).`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  console.log(`Servern kör ${served ?? 'okänt bygge'}, inte bygget i dist/ (${expected}). Deploya, eller kör med --any-build.`);
  process.exit(2);
}
const started = Date.now();
const results = await Promise.all(
  Object.entries(SUITES)
    .filter(([name]) => !only || only.includes(name))
    .map(async ([name, suite]) => {
      const t0 = Date.now();
      try {
        const t = await suite(run);
        return { name, failures: t.failures, notes: t.notes, checks: t.checks, shots: t.shots, ms: Date.now() - t0 };
      } catch (e) {
        return { name, failures: [e.message.split('\n')[0]], notes: [], checks: 0, shots: 0, ms: Date.now() - t0 };
      }
    }),
);
await run.browser.close();

let failed = 0;
for (const r of results) {
  failed += r.failures.length;
  console.log(`${r.failures.length ? '✗' : '✓'} ${r.name}: ${r.checks - r.failures.length}/${r.checks} kontroller, ${r.shots} skärmbilder, ${(r.ms / 1000).toFixed(0)} s`);
  for (const f of r.failures) console.log(`    ${f}`);
  for (const n of r.notes) console.log(`    känt: ${n}`);
}
console.log(`${failed ? `${failed} fel` : 'Allt gick igenom'} på ${((Date.now() - started) / 1000).toFixed(0)} s. Skärmbilder: ${run.out}`);
process.exit(failed ? 1 : 0);
