/**
 * Startskärmen: Spela live syns utan att man scrollar, på iPhone 13 och en liten Android. På
 * staging finns banderollen och "[Staging]" i titeln, på produktionen inte.
 */
import { Suite, context, isStaging, page } from './lib.mjs';

const PRODUCTION = 'sverigespelet.hamiltoon.workers.dev';

export default async function start(run) {
  const t = new Suite(run, 'start');
  for (const [device, dark, lang] of [['iphone', false, 'sv'], ['android', true, 'en']]) {
    const ctx = await context(run, device, { dark, lang });
    const p = await page(ctx);
    await p.goto(run.base);
    await p.waitForSelector('.mode-btn-live');
    const r = await p.locator('.mode-btn-live').boundingBox();
    const vh = p.viewportSize().height;
    t.check(r.y >= 0 && r.y + r.height <= vh, `${device}: Spela live syns utan scroll (${Math.round(r.y)}–${Math.round(r.y + r.height)} av ${vh} px)`);
    t.check((await p.locator('.mode-list .mode-btn').count()) === 7, `${device}: alla sju lägen finns`);
    const banner = (await p.locator('#staging-banner').count()) ? (await p.textContent('#staging-banner')).trim() : null;
    const title = await p.title();
    const expected = lang === 'sv' ? 'STAGING – testmiljö, inte den riktiga topplistan' : 'STAGING – test environment, not the real leaderboard';
    if (isStaging(run.base)) {
      t.check(banner === expected, `${device}: staging visar banderollen "${banner}"`);
      t.check(title.startsWith('[Staging] '), `${device}: titeln börjar med [Staging] ("${title}")`);
      const top = await p.locator('#staging-banner').boundingBox();
      t.check(!!top && top.y === 0, `${device}: banderollen ligger överst`);
    } else if (new URL(run.base).hostname === PRODUCTION) {
      t.check(banner === null && !title.includes('Staging'), `${device}: produktionen har ingen banderoll ("${title}")`);
    }
    await t.shot(p, `${device}-${dark ? 'dark' : 'light'}-${lang}`);
    t.check(p.errors.length === 0, `${device}: inga fel i sidan ${p.errors.join(' | ')}`);
    await ctx.close();
  }
  return t;
}
