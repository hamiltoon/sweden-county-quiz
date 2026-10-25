/**
 * Gemensamt för acceptanstesterna: webbläsaren, enheterna, skyddsräcket mot produktionen,
 * skärmbilder och hjälp för att klicka rätt på kartan.
 */
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { geoTransverseMercator } from 'd3-geo';
import { feature } from 'topojson-client';
import { COUNTIES } from '../src/data/counties.ts';
import { PROVINCES } from '../src/data/provinces.ts';
import { MUNICIPALITIES } from '../src/data/municipalities.ts';
import { OTHER_CITIES } from '../src/data/cities.ts';
import { LAKES } from '../src/data/lakes.ts';

// Playwright läses med require, så att en global installation också hittas (NODE_PATH).
const require = createRequire(import.meta.url);
export const { chromium, devices } = require('playwright');

export const STAGING = 'https://sverigespelet-staging.hamiltoon.workers.dev/';
/** Där testerna får skriva fritt. Överallt annars (produktionen, en framtida egen domän) är skyddet på. */
export const UNGUARDED_HOSTS = ['sverigespelet-staging.hamiltoon.workers.dev', 'localhost', '127.0.0.1'];

export const DEVICES = {
  // iPhone 13 (390 × 844); Playwrights mått räknar bort Safaris verktygsfält, så ytan är 390 × 664.
  iphone: devices['iPhone 13'],
  android: { viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices['Pixel 5'].userAgent },
  desktop: { viewport: { width: 1280, height: 800 } },
};

export function isGuarded(base) {
  return !UNGUARDED_HOSTS.includes(new URL(base).hostname);
}

export function isStaging(base) {
  return new URL(base).hostname === new URL(STAGING).hostname;
}

/** Det som aldrig får skickas utanför staging och localhost: resultat till topplistan, passkeys och kontots språk. */
export const GUARDED = [
  { path: '**/api/scores', methods: ['POST'] },
  { path: '**/api/passkey/**', methods: null },
  { path: '**/api/me/language', methods: ['POST'] },
];

/**
 * En webbläsarkontext. Utom mot staging och localhost (eller med guard: true) stoppas alla anrop i
 * GUARDED innan de lämnar webbläsaren, och varje stoppat anrop räknas som ett fel i testet.
 */
export async function context(run, device, { dark = false, lang = 'sv', guard = isGuarded(run.base) } = {}) {
  const ctx = await run.browser.newContext({ ...DEVICES[device], colorScheme: dark ? 'dark' : 'light', locale: lang === 'sv' ? 'sv-SE' : 'en-GB' });
  ctx.blocked = [];
  if (guard) {
    for (const { path, methods } of GUARDED) {
      await ctx.route(path, (route) => {
        const method = route.request().method();
        if (methods && !methods.includes(method)) return route.continue();
        ctx.blocked.push(`${method} ${new URL(route.request().url()).pathname}`);
        return route.abort('blockedbyclient');
      });
    }
  }
  return ctx;
}

/** En sida som samlar fel från sidan och konsolen. */
export async function page(ctx) {
  const p = await ctx.newPage();
  p.errors = [];
  p.on('pageerror', (e) => p.errors.push(e.message));
  p.on('console', (m) => m.type() === 'error' && p.errors.push(m.text()));
  return p;
}

/** Ett test: samlar kontroller och skärmbilder. */
export class Suite {
  constructor(run, name) {
    this.run = run;
    this.name = name;
    this.failures = [];
    this.checks = 0;
    this.shots = 0;
    this.notes = [];
  }
  /** Något att känna till som inte fäller testet, t.ex. ett känt fynd som en backlogpunkt ska rätta. */
  note(message) {
    if (!this.notes.includes(message)) this.notes.push(message);
  }
  check(ok, message) {
    this.checks++;
    if (!ok) this.failures.push(message);
    if (!ok || this.run.verbose) console.log(`${ok ? 'PASS' : 'FAIL'} [${this.name}] ${message}`);
    return ok;
  }
  async shot(p, step) {
    this.shots++;
    const dir = join(this.run.out, this.name);
    mkdirSync(dir, { recursive: true });
    await p.screenshot({ path: join(dir, `${String(this.shots).padStart(2, '0')}-${step}.png`) });
  }
}

// ---------- Frågorna och svaren ----------

/** Frågetext (svenska) → rätt svar, för alla lägen. */
export const ANSWERS = new Map();
const COUNTY_NAME = new Map(COUNTIES.map((c) => [c.code, c.name]));
for (const c of COUNTIES) {
  ANSWERS.set(`Var ligger ${c.name}?`, { code: c.code });
  ANSWERS.set(`Var ligger ${c.city}?`, { point: c });
}
for (const p of PROVINCES) ANSWERS.set(`Var ligger ${p.name}?`, { code: p.code });
for (const m of MUNICIPALITIES) ANSWERS.set(`Var ligger ${m.name} i ${COUNTY_NAME.get(m.county)}?`, { code: m.code });
for (const c of OTHER_CITIES) ANSWERS.set(`Var ligger ${c.name}?`, { point: c });
for (const l of LAKES) ANSWERS.set(`Var ligger ${l.name}?`, { lake: l.id });

export const COUNTY_SEATS = COUNTIES.map((c) => ({ code: c.code, lat: c.lat, lon: c.lon }));
export const CITY_BY_NAME = new Map(OTHER_CITIES.map((c) => [c.name, c]));
export const COUNTY_BY_CODE = new Map(COUNTIES.map((c) => [c.code, c]));
export const ALL_CODES = { lan: COUNTIES.map((c) => c.code), landskap: PROVINCES.map((p) => p.code), kommun: MUNICIPALITIES.map((m) => m.code), sjo: LAKES.map((l) => l.id) };

const lan = JSON.parse(readFileSync(new URL('../public/data/lan.topo.json', import.meta.url), 'utf8'));
const lanFeatures = feature(lan, lan.objects.lan);

/** Var en ort hamnar på länskartan (som i SwedenMap, ingen zoom). */
export async function pointOnMap(p, { lat, lon }) {
  const box = await p.locator('.map').boundingBox();
  const proj = geoTransverseMercator()
    .rotate([-15, 0])
    .fitExtent([[8, 8], [box.width - 8, box.height - 8]], lanFeatures);
  const [x, y] = proj([lon, lat]);
  return { x: box.x + x, y: box.y + y };
}

/** En punkt inne i området eller sjön; zoomar in med hjulet om den är för liten för att träffa. */
export async function pointIn(p, selector) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const pt = await p.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const m = document.querySelector('.map').getBoundingClientRect();
      const key = el.dataset.code ? 'code' : 'lake';
      for (let n = 4; n <= 64; n *= 2)
        for (let i = 1; i < n; i++)
          for (let j = 1; j < n; j++) {
            const x = r.left + (r.width * i) / n;
            const y = r.top + (r.height * j) / n;
            if (x < m.left + 4 || x > m.right - 4 || y < m.top + 4 || y > m.bottom - 4) continue;
            const hit = document.elementFromPoint(x, y);
            if (hit?.dataset?.[key] === el.dataset[key]) return { x, y };
          }
      return { zoomAt: { x: r.left + r.width / 2, y: r.top + r.height / 2 } };
    }, selector);
    if (!pt) return null;
    if (!pt.zoomAt) return pt;
    await p.mouse.move(pt.zoomAt.x, pt.zoomAt.y);
    await p.mouse.wheel(0, -500);
    await p.waitForTimeout(400);
  }
  return null;
}

/** Klickar på svaret, eller (wrong) på något annat. */
export async function clickAnswer(p, answer) {
  if (answer.point) {
    const pt = await pointOnMap(p, answer.point);
    return p.mouse.click(pt.x, pt.y);
  }
  const sel = answer.lake ? `path.lake[data-lake="${answer.lake}"]` : `path.county[data-code="${answer.code}"]`;
  const pt = await pointIn(p, sel);
  if (!pt) throw new Error(`hittar ingen punkt i ${sel}`);
  return p.mouse.click(pt.x, pt.y);
}

export async function questionText(p) {
  return ((await p.textContent('.question')) ?? '').trim();
}

/** Mått på avslöjandet i live: rätt svar och prickar i vyn och fria från rutan, ställningen och den egna raden. */
export function measureReveal(p) {
  return p.evaluate(() => {
    const m = document.querySelector('.map').getBoundingClientRect();
    const inside = (r) => r.left >= m.left - 1 && r.right <= m.right + 1 && r.top >= m.top - 1 && r.bottom <= m.bottom + 1;
    const toast = document.querySelector('.toast.is-visible')?.getBoundingClientRect();
    const under = (r) => !!toast && r.left < toast.right && r.right > toast.left && r.top < toast.bottom && r.bottom > toast.top;
    const dots = [...document.querySelectorAll('circle.pin-dot')].map((c) => c.getBoundingClientRect());
    const target = document.querySelector('path.county.is-correct, path.county.is-reveal, path.lake.is-correct, path.lake.is-reveal, .marker-reveal .marker-dot');
    const status = document.querySelector('.live-status').getBoundingClientRect();
    const me = document.querySelector('.live-standings .is-me')?.getBoundingClientRect();
    return {
      pins: dots.length,
      pinsOutside: dots.filter((d) => !inside(d)).length,
      pinsUnderToast: dots.filter(under).length,
      targetInView: !!target && inside(target.getBoundingClientRect()),
      standingsShare: status.height / innerHeight,
      ownRowVisible: !!me && me.top >= status.top - 1 && me.bottom <= status.bottom + 1 && me.bottom <= innerHeight + 1,
    };
  });
}
