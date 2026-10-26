/**
 * Live: en match med 2 spelare (två webbläsare) och en med 12 (en webbläsare och 11 bottar). Vid
 * varje avslöjande ska rätt svar och allas prickar synas i vyn och inte ligga under rätt/fel-rutan,
 * och den egna raden i ställningen ska synas helt.
 */
import { ALL_CODES, ANSWERS, CITY_BY_NAME, COUNTY_BY_CODE, COUNTY_SEATS, Suite, answerAccepted, clickAnswer, context, countyFill, mapSettled, measureReveal, page, questionText, url } from './lib.mjs';

const BOT_NAMES = ['Erika', 'Maximilian', 'Åsa', 'Bo', 'Charlotte', 'Didrik', 'Elsa-Maj', 'Frans', 'Gun', 'Hjalmar', 'Ingrid'];

async function createRoom(p, run, name) {
  await p.goto(url(run));
  await p.click('.mode-btn-live');
  await p.fill('.live-entry input[name=live-name]', name);
  await p.click('.live-entry button:has-text("Skapa ett rum")');
  await p.waitForSelector('.live-lobby');
  return (await p.textContent('.live-code')).trim();
}

/** En bot som svarar på varje fråga, varannan rätt och varannan fel, med lite olika fördröjning. */
function bot(base, code, name, i) {
  const ws = new WebSocket(`${base.replace(/\/$/, '').replace(/^http/, 'ws')}/api/live/${code}/ws?player=e2e-bot-${i}-${Math.random().toString(36).slice(2, 10)}&name=${encodeURIComponent(name)}`);
  const state = { last: null };
  let answered = -1;
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type !== 'state') return;
    state.last = msg.state;
    const q = msg.state.question;
    if (msg.state.phase !== 'question' || !q || answered === q.index) return;
    answered = q.index;
    const right = i % 2 === 0;
    const seat = COUNTY_SEATS[(i * 5 + q.index) % COUNTY_SEATS.length];
    let answer;
    if (q.kind === 'stad' || q.kind === 'ort') {
      const target = q.kind === 'stad' ? COUNTY_BY_CODE.get(q.target) : CITY_BY_NAME.get(q.target);
      answer = right ? { lat: target.lat + 0.05, lon: target.lon } : { lat: seat.lat, lon: seat.lon };
    } else {
      const codes = ALL_CODES[q.kind];
      answer = { code: right ? q.target : codes.find((c) => c !== q.target), lat: seat.lat, lon: seat.lon };
    }
    setTimeout(() => ws.readyState === 1 && ws.send(JSON.stringify({ type: 'answer', question: q.index, ...answer })), 300 + i * 120);
  };
  ws.state = state;
  return ws;
}

async function checkReveal(t, label, p, players) {
  await p.waitForTimeout(400);
  const r = await measureReveal(p);
  t.check(r.pins === players, `${label}: ${r.pins} av ${players} prickar`);
  t.check(r.targetInView && r.pinsOutside === 0 && r.pinsUnderToast === 0, `${label}: rätt svar och alla prickar i vyn, ingen under rutan ${JSON.stringify({ target: r.targetInView, utanför: r.pinsOutside, underRutan: r.pinsUnderToast })}`);
  t.check(r.ownRowVisible && r.standingsShare <= 0.34, `${label}: egna raden syns, ställningen tar ${Math.round(r.standingsShare * 100)} % av höjden`);
}

/** Med tangentbordet hamnar inget fokuserat chip eller knapp under knappfältet i lobbyn (PO-31). */
async function checkFocusNotObscured(t, label, p) {
  await p.focus('.live-mode-chip');
  const hidden = [];
  for (let i = 0; i < 12; i++) {
    const r = await p.evaluate(() => {
      const el = document.activeElement;
      const bar = document.querySelector('.live-lobby-action');
      if (!el || bar.contains(el) || el.contains(bar)) return null;
      const box = el.getBoundingClientRect();
      return { name: el.textContent.trim(), bottom: box.bottom, barTop: bar.getBoundingClientRect().top };
    });
    if (r && r.bottom > r.barTop + 1) hidden.push(`${r.name} (${Math.round(r.bottom - r.barTop)} px)`);
    await p.keyboard.press('Tab');
  }
  t.check(hidden.length === 0, `${label}: fokus hamnar aldrig under knappfältet ${hidden.join(', ')}`);
  await p.evaluate(() => { document.querySelector('.screen-end').scrollTop = 0; });
}

/** Värden når Starta matchen utan att scrolla (PO-22). */
async function checkStartVisible(t, label, p) {
  const r = await p.evaluate(() => {
    const btn = document.querySelector('.live-lobby-action .btn-primary');
    const box = btn.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return { top: box.top, bottom: box.bottom, vh: innerHeight, onTop: btn === hit || btn.contains(hit), scroll: document.querySelector('.screen-end').scrollTop };
  });
  t.check(r.scroll === 0 && r.top >= 0 && r.bottom <= r.vh && r.onTop, `${label}: Starta matchen syns utan scroll i lobbyn (${Math.round(r.top)}–${Math.round(r.bottom)} av ${r.vh} px, scroll ${r.scroll}, överst ${r.onTop})`);
}

/** Väntar på fråga n (1-baserad) och på att kartan är klar. */
async function waitQuestion(p, n) {
  await p.waitForFunction((n) => document.querySelector('.hud-progress')?.textContent === `${n}/10` && !document.querySelector('.live-standings') && document.querySelector('.map path'), n, { timeout: 30000 });
  await p.waitForTimeout(500);
}

async function twoPlayers(run, t) {
  const hc = await context(run, 'iphone');
  const gc = await context(run, 'android', { dark: true, lang: 'en' });
  const h = await page(hc);
  const g = await page(gc);
  const code = await createRoom(h, run, 'Anna');
  await g.goto(url(run, `live/${code}`));
  await g.fill('.live-entry input[name=live-name]', 'Bo');
  await g.click('.live-entry .btn-primary');
  await h.waitForFunction(() => document.querySelectorAll('.live-players li').length === 2);
  await checkStartVisible(t, 'iPhone', h);
  await checkFocusNotObscured(t, 'iPhone', h);
  await t.shot(h, 'lobby-2');
  await h.click('.live-lobby-action .btn-primary');
  for (let n = 1; n <= 10; n++) {
    await waitQuestion(h, n);
    await waitQuestion(g, n);
    // Värden svarar rätt, gästen fel (en annan plats på kartan).
    const answer = ANSWERS.get(await questionText(h));
    await clickAnswer(h, answer);
    const box = await g.locator('.map').boundingBox();
    await g.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.35);
    await h.waitForSelector('.live-standings', { timeout: 15000 });
    await g.waitForSelector('.live-standings', { timeout: 15000 });
    await checkReveal(t, `2 spelare, fråga ${n}, iPhone`, h, 2);
    await checkReveal(t, `2 spelare, fråga ${n}, Android`, g, 2);
    if (n === 1) {
      await t.shot(h, 'avslojande-2-iphone');
      await t.shot(g, 'avslojande-2-android');
    }
  }
  await h.waitForSelector('.live-done', { timeout: 15000 });
  t.check(/Du vann/.test(await h.textContent('.live-done h2')), `2 spelare: värden som svarade rätt vann ("${(await h.textContent('.live-done h2')).trim()}")`);
  await t.shot(h, 'pall-2');
  t.check(h.errors.length + g.errors.length === 0, `2 spelare: inga fel i sidan ${[...h.errors, ...g.errors].slice(0, 3).join(' | ')}`);
  await hc.close();
  await gc.close();
}

async function twelvePlayers(run, t) {
  const hc = await context(run, 'android');
  const h = await page(hc);
  const code = await createRoom(h, run, 'John');
  const bots = BOT_NAMES.map((name, i) => bot(run.base, code, name, i));
  await h.waitForFunction(() => document.querySelectorAll('.live-players li').length === 12, null, { timeout: 20000 });
  // Före valet av läge: Playwright scrollar fram chippen när den klickar på dem.
  await checkStartVisible(t, 'Android 360, 12 spelare', h);
  // Blandat med alla sorter, så att kartan byts mellan frågorna.
  await h.click('.live-mode-chip[data-mode="blandat"]');
  await h.waitForSelector('.live-mix-chip');
  for (const kind of ['landskap', 'kommun', 'ort', 'sjo']) {
    await h.click(`.live-mix-chip[data-kind="${kind}"]`);
    await h.waitForFunction((k) => document.querySelector(`.live-mix-chip[data-kind="${k}"]`)?.getAttribute('aria-pressed') === 'true', kind);
  }
  // PO-16: kommunkartan hämtas redan i lobbyn när blandningen innehåller kommuner.
  const preloaded = await h.waitForFunction(() => performance.getEntriesByType('resource').some((e) => e.name.includes('/data/kommuner.topo.json')), null, { timeout: 5000 }).then(() => true, () => false);
  t.check(preloaded, '12 spelare: kommunkartan hämtas redan i lobbyn');
  await t.shot(h, 'lobby-12');
  await h.click('.live-lobby-action .btn-primary');
  for (let n = 1; n <= 10; n++) {
    await waitQuestion(h, n);
    const answer = ANSWERS.get(await questionText(h));
    if (answer?.code && / i .+ län\?$/.test(await questionText(h))) {
      // Kommunfråga: kartan zoomar in på länet (PO-16).
      await mapSettled(h);
      const fill = await countyFill(h, answer.code);
      t.check(fill.inside && fill.share >= 0.6, `12 spelare, fråga ${n} (kommun): länet fyller kartan (${Math.round(fill.share * 100)} %)`);
    }
    await answerAccepted(h, answer);
    await h.waitForSelector('.live-standings', { timeout: 15000 });
    await checkReveal(t, `12 spelare, fråga ${n}`, h, 12);
    if (n === 1) {
      // Boten kan få avslöjandet en stund efter värden.
      for (let i = 0; i < 20 && bots[0].state.last?.phase !== 'reveal'; i++) await h.waitForTimeout(100);
      const s = bots[0].state.last;
      const left = s.question.endsAt - s.serverNow;
      t.check(left > 6000 && left <= 7000, `12 spelare: avslöjandet visas i 7 s (${left} ms kvar när det börjar)`);
    }
    if (n <= 2) await t.shot(h, `avslojande-12-${n}`);
  }
  await h.waitForSelector('.live-done', { timeout: 20000 });
  t.check((await h.locator('.live-podium li').count()) === 12, 'pallen visar alla 12');
  await t.shot(h, 'pall-12');
  t.check(h.errors.length === 0, `12 spelare: inga fel i sidan ${h.errors.slice(0, 3).join(' | ')}`);
  bots.forEach((ws) => ws.close());
  await hc.close();
}

export default async function live(run) {
  const t = new Suite(run, 'live');
  await Promise.all([
    twoPlayers(run, t).catch((e) => t.check(false, `2 spelare: ${e.message.split('\n')[0]}`)),
    twelvePlayers(run, t).catch((e) => t.check(false, `12 spelare: ${e.message.split('\n')[0]}`)),
  ]);
  return t;
}
