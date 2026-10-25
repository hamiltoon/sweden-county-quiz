import { el } from './dom';
import { MODE_LABELS, questionLabel, type Mode, type Question, type Summary } from '../game/game';
import { LAKES } from '../data/lakes';
import { OTHER_CITIES } from '../data/cities';
import { getBest } from '../game/storage';
import { CONFIG } from '../game/config';
import { modeIcon } from './icons';
import { COUNTY_BY_CODE } from '../data/counties';

export const ATTRIBUTION_HTML_ID = 'attribution';

/**
 * Startskärmen. `brandMap` är en plats bredvid rubriken där en liten Sverigekarta kan läggas
 * när kartdatan har laddats; den har fast storlek så att inget hoppar.
 */
export function renderStart(onStart: (mode: Mode) => void, leaderboard?: HTMLElement, brandMap?: HTMLElement): HTMLElement {
  const modes: { mode: Mode; desc: string }[] = [
    { mode: 'lan', desc: 'Klicka på rätt län.' },
    { mode: 'stad', desc: `Klicka där staden ligger (inom ${CONFIG.cityRadiusKm} km).` },
    {
      mode: 'ort',
      desc: `${CONFIG.otherCitiesPerRound} av Sveriges ${OTHER_CITIES.length} största städer som inte är residensstäder. Klicka inom ${CONFIG.cityRadiusKm} km.`,
    },
    { mode: 'sjo', desc: `Klicka på rätt sjö bland Sveriges ${LAKES.length} största.` },
    { mode: 'blandat', desc: 'Slumpar mellan län och städer.' },
  ];

  const buttons = modes.map(({ mode, desc }) => {
    const best = getBest(mode);
    const bestText = best ? `Bästa: ${best.score} p · ${best.percent} % rätt` : 'Inget resultat ännu';
    const btn = el(
      'button',
      { class: 'mode-btn', type: 'button', 'data-mode': mode },
      modeIcon(mode),
      el(
        'span',
        { class: 'mode-text' },
        el('span', { class: 'mode-title' }, MODE_LABELS[mode]),
        el('span', { class: 'mode-desc' }, desc),
        el('span', { class: 'mode-best' }, bestText),
      ),
    );
    btn.addEventListener('click', () => onStart(mode));
    return btn;
  });

  return el(
    'section',
    { class: 'start' },
    el(
      'header',
      { class: 'start-header' },
      brandMap ?? null,
      el(
        'div',
        { class: 'start-title' },
        el('h1', {}, 'Sverigespelet'),
        el('p', { class: 'lead' }, 'Hitta Sveriges 21 län, residensstäder och största sjöar på kartan. Välj läge och starta.'),
      ),
    ),
    el('div', { class: 'mode-list' }, ...buttons),
    el(
      'p',
      { class: 'rules' },
      `${CONFIG.pointsByAttempt.join(' / ')} poäng för rätt på första / andra / tredje försöket. Nypa eller scrolla för att zooma på kartan.`,
    ),
    leaderboard,
  );
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
                el('span', { class: 'pts' }, `${r.points} p`),
              ),
            ),
          ),
        )
      : null;

  const again = el('button', { class: 'btn btn-primary', type: 'button' }, 'Spela igen');
  again.addEventListener('click', onAgain);
  const menu = el('button', { class: 'btn', type: 'button' }, 'Byt läge');
  menu.addEventListener('click', onMenu);

  return el(
    'section',
    { class: 'end' },
    el('h2', {}, 'Klart!'),
    el('p', { class: 'mode-tag' }, `Läge: ${MODE_LABELS[summary.mode]}`),
    el(
      'div',
      { class: 'score-card' },
      el('div', { class: 'score-main' }, renderScoreRing(summary.score, summary.maxScore), extras.recap ?? null),
      el('div', { class: 'score-sub' }, `${summary.solved} av ${summary.total} rätt (${summary.percentSolved} %) · ${summary.firstTry} på första försöket`),
      isNewBest ? el('div', { class: 'new-best' }, '🎉 Nytt bästa resultat!') : null,
    ),
    extras.leaderboard,
    list('Missade', missed),
    list('Behövde fler försök', shaky),
    missed.length + shaky.length === 0 ? el('p', { class: 'perfect' }, 'Felfritt – alla rätt på första försöket!') : null,
    el('div', { class: 'btn-row' }, again, menu),
  );
}

/** Namnet i resultatlistan; städer får länet inom parentes. */
function resultLabel(q: Question): string {
  if (q.kind === 'stad') return `${q.county.city} (${q.county.name})`;
  if (q.kind === 'ort') return `${q.city.name} (${COUNTY_BY_CODE.get(q.city.county)?.name ?? q.city.county})`;
  return questionLabel(q);
}

/** Poängen i en ring som fylls upp till andelen av maxpoängen. */
function renderScoreRing(score: number, max: number): HTMLElement {
  const r = 52;
  const circumference = 2 * Math.PI * r;
  const ring = el('div', { class: 'score-ring', role: 'img', 'aria-label': `${score} av ${max} poäng` });
  ring.innerHTML = `<svg viewBox="0 0 120 120" aria-hidden="true">
    <circle class="ring-track" cx="60" cy="60" r="${r}"/>
    <circle class="ring-value" cx="60" cy="60" r="${r}" transform="rotate(-90 60 60)"
      stroke-dasharray="${circumference}" stroke-dashoffset="${circumference}"/>
  </svg>`;
  ring.append(
    el('div', { class: 'ring-text', 'aria-hidden': 'true' }, el('span', { class: 'ring-score' }, `${score}`), el('span', { class: 'ring-max' }, `av ${max} p`)),
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
    item('first', 'Rätt direkt', counts.first),
    item('later', 'Fler försök', counts.later),
    item('missed', 'Missade', counts.missed),
  );
}
