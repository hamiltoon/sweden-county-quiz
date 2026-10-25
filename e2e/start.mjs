/** Startskärmen: Spela live syns utan att man scrollar, på iPhone 13 och en liten Android. */
import { Suite, context, page } from './lib.mjs';

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
    await t.shot(p, `${device}-${dark ? 'dark' : 'light'}-${lang}`);
    t.check(p.errors.length === 0, `${device}: inga fel i sidan ${p.errors.join(' | ')}`);
    await ctx.close();
  }
  return t;
}
