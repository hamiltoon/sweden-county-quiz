/**
 * Rätt och fel syns för alla: rätt/fel-rutan har kontrast minst 4,5:1 och en ikon, och kartan och
 * minikartan skiljer rätt direkt, fler försök och missat åt även med simulerad deuteranopi och
 * protanopi. axe-core (WCAG 2.2 AA och best practice) får inte hitta något av nivån serious eller
 * critical på start-, spel-, slut- eller lobbyskärmen; fynd på lägre nivå skrivs ut som kända.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { ANSWERS, COUNTY_BY_CODE, Suite, clickAnswer, context, page, url } from './lib.mjs';

const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

// Färgblindhet enligt Machado m.fl. (2009), och avståndet mellan färger som ΔE (CIE76) i Lab.
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const delin = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const CVD = {
  deuteranopi: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  protanopi: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
};
const simulate = (rgb, m) => {
  const l = rgb.map((c) => lin(c / 255));
  return m.map((row) => Math.round(delin(Math.min(1, Math.max(0, row[0] * l[0] + row[1] * l[1] + row[2] * l[2]))) * 255));
};
const lab = (rgb) => {
  const [r, g, b] = rgb.map((c) => lin(c / 255));
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const X = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
  const Y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const Z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
};
const deltaE = (a, b) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]));
const luminance = (rgb) => { const [r, g, b] = rgb.map((c) => lin(c / 255)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
/** Minsta tillåtna avstånd mellan två resultatfärger, med och utan färgblindhet. */
const MIN_DELTA_E = 15;

/** En färg som rgb, via canvas (color-mix() kommer annars som color(srgb …)). */
const rgbOf = (p, selector, prop) =>
  p.evaluate(([selector, prop]) => {
    const el = document.querySelector(selector);
    if (!el) return null;
    const c = document.createElement('canvas').getContext('2d');
    c.fillStyle = getComputedStyle(el)[prop].replace(/^url\([^)]*\)\s*/, '');
    c.fillRect(0, 0, 1, 1);
    return [...c.getImageData(0, 0, 1, 1).data.slice(0, 3)];
  }, [selector, prop]);

function checkDistinct(t, label, colors) {
  for (const [name, matrix] of [['vanlig syn', null], ...Object.entries(CVD)]) {
    const s = Object.fromEntries(Object.entries(colors).map(([k, c]) => [k, matrix ? simulate(c, matrix) : c]));
    const d = [deltaE(s.first, s.later), deltaE(s.first, s.missed), deltaE(s.later, s.missed)].map(Math.round);
    t.check(Math.min(...d) >= MIN_DELTA_E, `${label}, ${name}: rätt direkt/fler försök ${d[0]}, rätt direkt/missat ${d[1]}, fler försök/missat ${d[2]} (minst ${MIN_DELTA_E})`);
  }
}

/** Fynd av lägre nivå som backloggen redan har, med punkten som ska rätta dem. */
const KNOWN = { 'page-has-heading-one': 'PO-25 (UX-30): skärmarna saknar h1' };

async function axe(t, p, label) {
  await p.addScriptTag({ content: AXE });
  const violations = await p.evaluate(async () =>
    (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] })).violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
    })),
  );
  const severe = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  t.check(severe.length === 0, `${label}: axe hittar inget allvarligt ${severe.map((v) => `${v.impact} ${v.id}: ${v.nodes.join(', ')}`).join(' | ')}`);
  for (const v of violations.filter((v) => !severe.includes(v))) t.note(`${v.impact} ${v.id}${KNOWN[v.id] ? ` – ${KNOWN[v.id]}` : ''}`);
}

async function scheme(run, t, dark) {
  const name = dark ? 'mörkt' : 'ljust';
  const ctx = await context(run, 'iphone', { dark });
  const p = await page(ctx);
  await p.goto(url(run));
  await p.waitForSelector('.mode-btn-live');
  await p.waitForTimeout(500);
  await axe(t, p, `${name}, startskärmen`);
  await p.click('.mode-btn[data-mode="lan"]');
  await p.waitForSelector('.screen-game .map path');
  const others = (code) => [...COUNTY_BY_CODE.keys()].filter((c) => c !== code && c !== 'AB').slice(0, 3);
  let n = 0;
  let last = '';
  while (await p.locator('.screen-game').count()) {
    const q = await p
      .waitForFunction((last) => {
        const text = document.querySelector('.question')?.textContent?.trim();
        return !document.querySelector('.screen-game') ? '__end__' : text && text !== last && !text.endsWith('…') ? text : false;
      }, last, { timeout: 15000 })
      .then((h) => h.jsonValue());
    if (q === '__end__') break;
    await p.waitForTimeout(700);
    const answer = ANSWERS.get(q);
    n++;
    // Var tredje rätt direkt, var tredje efter ett fel och var tredje missad (tre olika fel län).
    // Mellan klicken väntar testet ut spelets skydd mot dubbeltryck.
    if (n % 3 === 2) {
      for (const code of others(answer.code)) {
        await clickAnswer(p, { code });
        await p.waitForTimeout(600);
      }
    } else if (n % 3 === 0) {
      await clickAnswer(p, { code: others(answer.code)[0] });
      await p.waitForTimeout(600);
      if (n === 3) {
        await checkToast(t, p, `${name}, fel`, '✗');
        await axe(t, p, `${name}, spelskärmen med fel-rutan`);
      }
      await clickAnswer(p, answer);
    } else {
      await clickAnswer(p, answer);
      await p.waitForTimeout(200);
      if (n === 1) {
        await checkToast(t, p, `${name}, rätt`, '✓');
        await axe(t, p, `${name}, spelskärmen med rätt-rutan`);
      }
    }
    if (n === 6) {
      await p.waitForTimeout(500);
      const fill = await p.$eval('path.county[data-result="missed"]', (el) => getComputedStyle(el).fill);
      t.check(/hatch-missed/.test(fill), `${name}: missade län har streck`);
      checkDistinct(t, `${name}, kartan`, {
        first: await rgbOf(p, 'path.county[data-result="first"]', 'fill'),
        later: await rgbOf(p, 'path.county[data-result="later"]', 'fill'),
        missed: await rgbOf(p, '#hatch-missed .hatch-bg', 'fill'),
      });
      await t.shot(p, `${name}-kartan`);
    }
    last = q;
  }
  await p.waitForSelector('.recap-map', { timeout: 15000 });
  await p.waitForTimeout(1300);
  await axe(t, p, `${name}, slutskärmen`);
  const fill = await p.$eval('.recap-map .mini-county[data-result="missed"]', (el) => getComputedStyle(el).fill);
  t.check(/hatch-missed-mini/.test(fill), `${name}: missade län har streck på minikartan`);
  const swatch = await p.$eval('.swatch-missed', (el) => getComputedStyle(el).backgroundImage);
  t.check(swatch !== 'none', `${name}: förklaringen visar streck för missade`);
  checkDistinct(t, `${name}, minikartan`, {
    first: await rgbOf(p, '.recap-map .mini-county[data-result="first"]', 'fill'),
    later: await rgbOf(p, '.recap-map .mini-county[data-result="later"]', 'fill'),
    missed: await rgbOf(p, '#hatch-missed-mini .hatch-bg', 'fill'),
  });
  await t.shot(p, `${name}-slut`);
  // Lobbyn i live.
  await p.goto(url(run));
  await p.click('.mode-btn-live');
  await p.fill('.live-entry input[name=live-name]', 'Axe');
  await p.click('.live-entry button:has-text("Skapa ett rum")');
  await p.waitForSelector('.live-lobby');
  // Längst ned: där ligger knappfältet med Starta på sin plats. Högre upp täcker det de chip som
  // råkar ligga under det tills man scrollar, vilket axe räknar som för små tryckytor.
  await p.evaluate(() => { const s = document.querySelector('.screen-end'); s.scrollTop = s.scrollHeight; });
  await axe(t, p, `${name}, lobbyn`);
  t.check(p.errors.length === 0, `${name}: inga fel i sidan ${p.errors.slice(0, 3).join(' | ')}`);
  await ctx.close();
}

async function checkToast(t, p, label, icon) {
  await p.waitForSelector('.toast.is-visible');
  const bg = await rgbOf(p, '.toast.is-visible', 'backgroundColor');
  const fg = await rgbOf(p, '.toast.is-visible', 'color');
  const ratio = contrast(bg, fg);
  t.check(ratio >= 4.5, `${label}: rutans kontrast ${ratio.toFixed(2)}:1`);
  const shown = await p.$eval('.toast.is-visible', (el) => getComputedStyle(el, '::before').content);
  t.check(shown.includes(icon), `${label}: rutan har ikonen ${icon}`);
}

export default async function a11y(run) {
  const t = new Suite(run, 'a11y');
  await Promise.all([false, true].map((dark) => scheme(run, t, dark).catch((e) => t.check(false, `${dark ? 'mörkt' : 'ljust'}: ${e.message.split('\n')[0]}`))));
  return t;
}
