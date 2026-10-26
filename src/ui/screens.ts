import { el } from './dom';
import { modeLabel, questionLabel, type Mode, type Question, type Summary } from '../game/game';
import { LAKES } from '../data/lakes';
import { OTHER_CITIES } from '../data/cities';
import { PROVINCES } from '../data/provinces';
import { MUNICIPALITIES } from '../data/municipalities';
import { getBest } from '../game/storage';
import { CONFIG } from '../game/config';
import { modeIcon } from './icons';
import { COUNTY_BY_CODE } from '../data/counties';
import { countyName, lang, setLang, t } from '../i18n';
import { LANGS, LANG_NAMES } from '../shared/i18n';
import { saveAccountLanguage } from '../api/account';
import { tipFor } from '../mnemonics';

export const ATTRIBUTION_HTML_ID = 'attribution';

/**
 * Startskärmen. `brandMap` är en plats bredvid rubriken där en liten Sverigekarta kan läggas
 * när kartdatan har laddats; den har fast storlek så att inget hoppar.
 */
export function renderStart(
  onStart: (mode: Mode) => void,
  leaderboard?: HTMLElement,
  brandMap?: HTMLElement,
  onLive?: () => void,
  onMnemonics?: () => void,
): HTMLElement {
  const desc = t().start.desc;
  const modes: { mode: Mode; desc: string }[] = [
    { mode: 'lan', desc: desc.lan },
    { mode: 'landskap', desc: desc.landskap(PROVINCES.length) },
    { mode: 'kommun', desc: desc.kommun(CONFIG.municipalitiesPerRound, MUNICIPALITIES.length) },
    { mode: 'stad', desc: desc.stad(CONFIG.cityRadiusKm) },
    { mode: 'ort', desc: desc.ort(CONFIG.otherCitiesPerRound, OTHER_CITIES.length, CONFIG.cityRadiusKm) },
    { mode: 'sjo', desc: desc.sjo(LAKES.length) },
    { mode: 'blandat', desc: desc.blandat },
  ];

  const buttons = modes.map(({ mode, desc }) => {
    const best = getBest(mode);
    const bestText = best ? t().start.best(best.score, best.percent) : t().start.noBest;
    // PO-33: en tankeregel för läget som en kort tipsrad.
    const tip = tipFor(mode);
    const btn = el(
      'button',
      { class: 'mode-btn', type: 'button', 'data-mode': mode },
      modeIcon(mode),
      el(
        'span',
        { class: 'mode-text' },
        el('span', { class: 'mode-title' }, modeLabel(mode)),
        el('span', { class: 'mode-desc' }, desc),
        el('span', { class: 'mode-best' }, bestText),
        tip ? el('span', { class: 'mode-tip' }, t().mnemonic.tip(tip)) : null,
      ),
    );
    btn.addEventListener('click', () => onStart(mode));
    return btn;
  });

  return el(
    'section',
    { class: 'start' },
    renderLangSwitch(),
    el(
      'header',
      { class: 'start-header' },
      brandMap ?? null,
      el(
        'div',
        { class: 'start-title' },
        el('h1', {}, 'Sverigespelet'),
        el('p', { class: 'lead' }, t().start.lead),
      ),
    ),
    // Live är det man spelar när man ses, så det ligger först och syns utan att man scrollar.
    onLive ? renderLiveButton(onLive) : null,
    el('div', { class: 'mode-list' }, ...buttons),
    el(
      'p',
      { class: 'rules' },
      t().start.rules(CONFIG.pointsByAttempt.join(' / ')),
    ),
    onMnemonics ? renderMnemonicsLink(onMnemonics) : null,
    leaderboard,
  );
}

/**
 * Språkväljaren överst på startskärmen. Valet sparas på enheten och, om spelaren är inloggad, på
 * kontot; skärmen ritas sedan om (se onLangChange i main.ts).
 */
function renderLangSwitch(): HTMLElement {
  const buttons = LANGS.map((code) => {
    const btn = el('button', { class: 'lang-btn', type: 'button', lang: code, 'aria-pressed': String(code === lang()) }, LANG_NAMES[code]);
    btn.addEventListener('click', () => {
      if (code === lang()) return;
      setLang(code);
      void saveAccountLanguage(code);
    });
    return btn;
  });
  return el('div', { class: 'lang-switch', role: 'group', 'aria-label': t().lang.label }, ...buttons);
}

/** Länken till /minnesregler (PO-33). Öppnas i spelet, utan att sidan laddas om. */
function renderMnemonicsLink(onOpen: () => void): HTMLElement {
  const link = el('a', { class: 'mnemonic-link', href: '/minnesregler' }, el('span', { 'aria-hidden': 'true' }, `${t().mnemonic.bulb} `), t().mnemonic.link);
  link.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    onOpen();
  });
  return el('p', { class: 'mnemonic-link-row' }, link);
}

function renderLiveButton(onLive: () => void): HTMLElement {
  const btn = el(
    'button',
    { class: 'mode-btn mode-btn-live', type: 'button', 'data-mode': 'live' },
    modeIcon('live'),
    el(
      'span',
      { class: 'mode-text' },
      el('span', { class: 'mode-title' }, t().start.liveTitle),
      el('span', { class: 'mode-desc' }, t().start.liveDesc),
    ),
  );
  btn.addEventListener('click', onLive);
  return btn;
}

export function renderEnd(
  summary: Summary,
  isNewBest: boolean,
  onAgain: () => void,
  onMenu: () => void,
  extras: {
    /** Topplistan för läget. */
    leaderboard?: HTMLElement;
    /** Kartsammanfattning: en minikarta färgad efter hur varje fråga gick. */
    recap?: HTMLElement;
    /** Minnesreglerna för de missade sakerna, under listan med dem (PO-33). */
    rules?: HTMLElement | null;
    /** "Hjälpte minnesregeln?" (PO-33). */
    helped?: HTMLElement | null;
  } = {},
): HTMLElement {
  const missed = summary.results.filter((r) => !r.solved);
  const shaky = summary.results.filter((r) => r.solved && r.attempts > 1);

  const list = (title: string, items: typeof missed) =>
    items.length
      ? el(
          'div',
          { class: 'result-group' },
          el('h3', {}, title),
          el(
            'ul',
            { class: 'result-list' },
            ...items.map((r) =>
              el(
                'li',
                {},
                el('span', {}, resultLabel(r.question)),
                el('span', { class: 'pts' }, t().common.points(r.points)),
              ),
            ),
          ),
        )
      : null;

  const again = el('button', { class: 'btn btn-primary', type: 'button' }, t().end.again);
  again.addEventListener('click', onAgain);
  const menu = el('button', { class: 'btn', type: 'button' }, t().end.menu);
  menu.addEventListener('click', onMenu);

  return el(
    'section',
    { class: 'end' },
    el('h2', {}, t().end.done),
    el('p', { class: 'mode-tag' }, t().end.mode(modeLabel(summary.mode))),
    el(
      'div',
      { class: 'score-card' },
      el('div', { class: 'score-main' }, renderScoreRing(summary.score, summary.maxScore), extras.recap ?? null),
      el('div', { class: 'score-sub' }, t().end.summary(summary.solved, summary.total, summary.percentSolved, summary.firstTry)),
      isNewBest ? el('div', { class: 'new-best' }, t().end.newBest) : null,
    ),
    extras.leaderboard,
    list(t().end.missed, missed),
    extras.rules ?? null,
    extras.helped ?? null,
    list(t().end.shaky, shaky),
    missed.length + shaky.length === 0 ? el('p', { class: 'perfect' }, t().end.perfect) : null,
    // Knapparna ligger kvar nederst medan slutskärmen scrollar (PO-17).
    el('div', { class: 'btn-row end-actions' }, again, menu),
  );
}

/** Namnet i resultatlistan; städer får länet inom parentes. */
function resultLabel(q: Question): string {
  if (q.kind === 'stad') return `${q.county.city} (${countyName(q.county)})`;
  if (q.kind === 'ort') {
    const county = COUNTY_BY_CODE.get(q.city.county);
    return `${q.city.name} (${county ? countyName(county) : q.city.county})`;
  }
  return questionLabel(q);
}

/** Poängen i en ring som fylls upp till andelen av maxpoängen. */
function renderScoreRing(score: number, max: number): HTMLElement {
  const r = 52;
  const circumference = 2 * Math.PI * r;
  const ring = el('div', { class: 'score-ring', role: 'img', 'aria-label': t().end.ringLabel(score, max) });
  ring.innerHTML = `<svg viewBox="0 0 120 120" aria-hidden="true">
    <circle class="ring-track" cx="60" cy="60" r="${r}"/>
    <circle class="ring-value" cx="60" cy="60" r="${r}" transform="rotate(-90 60 60)"
      stroke-dasharray="${circumference}" stroke-dashoffset="${circumference}"/>
  </svg>`;
  ring.append(
    el('div', { class: 'ring-text', 'aria-hidden': 'true' }, el('span', { class: 'ring-score' }, `${score}`), el('span', { class: 'ring-max' }, t().end.ringMax(max))),
  );
  const value = ring.querySelector<SVGCircleElement>('.ring-value');
  const target = circumference * (1 - (max > 0 ? Math.min(score / max, 1) : 0));
  // Två bildrutor in, så att ringen hinner ritas tom och sedan fylls med en övergång.
  requestAnimationFrame(() => requestAnimationFrame(() => value?.style.setProperty('stroke-dashoffset', String(target))));
  return ring;
}

/** Förklaringen till kartsammanfattningens färger, med antal i varje grupp. */
export function renderRecapLegend(counts: { first: number; later: number; missed: number }): HTMLElement {
  const item = (state: string, text: string, n: number) =>
    el('li', { class: 'legend-item' }, el('span', { class: `legend-swatch swatch-${state}` }), `${text} `, el('strong', {}, `${n}`));
  return el(
    'ul',
    { class: 'recap-legend' },
    item('first', t().end.legendFirst, counts.first),
    item('later', t().end.legendLater, counts.later),
    item('missed', t().end.legendMissed, counts.missed),
  );
}
