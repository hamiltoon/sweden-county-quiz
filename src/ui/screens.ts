import { el } from './dom';
import { MODE_LABELS, type Mode, type Summary } from '../game/game';
import { getBest } from '../game/storage';
import { CONFIG } from '../game/config';

export const ATTRIBUTION_HTML_ID = 'attribution';

export function renderStart(onStart: (mode: Mode) => void): HTMLElement {
  const modes: { mode: Mode; desc: string }[] = [
    { mode: 'lan', desc: 'Klicka på rätt län.' },
    { mode: 'stad', desc: `Klicka där staden ligger (inom ${CONFIG.cityRadiusKm} km).` },
    { mode: 'blandat', desc: 'Slumpar mellan län och städer.' },
  ];

  const buttons = modes.map(({ mode, desc }) => {
    const best = getBest(mode);
    const bestText = best ? `Bästa: ${best.score} p · ${best.percent} % rätt` : 'Inget resultat ännu';
    const btn = el(
      'button',
      { class: 'mode-btn', type: 'button', 'data-mode': mode },
      el('span', { class: 'mode-title' }, MODE_LABELS[mode]),
      el('span', { class: 'mode-desc' }, desc),
      el('span', { class: 'mode-best' }, bestText),
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
      el('h1', {}, 'Sverigespelet'),
      el('p', { class: 'lead' }, 'Hitta Sveriges 21 län och residensstäder på kartan. Välj läge och starta.'),
    ),
    el('div', { class: 'mode-list' }, ...buttons),
    el(
      'p',
      { class: 'rules' },
      `${CONFIG.pointsByAttempt.join(' / ')} poäng för rätt på första / andra / tredje försöket. Nypa eller scrolla för att zooma på kartan.`,
    ),
  );
}

export function renderEnd(summary: Summary, isNewBest: boolean, onAgain: () => void, onMenu: () => void): HTMLElement {
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
                el(
                  'span',
                  {},
                  r.question.kind === 'lan' ? r.question.county.name : `${r.question.county.city} (${r.question.county.name})`,
                ),
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
      el('div', { class: 'big-score' }, `${summary.score}`, el('small', {}, ` / ${summary.maxScore} p`)),
      el('div', { class: 'score-sub' }, `${summary.solved} av ${summary.total} rätt (${summary.percentSolved} %) · ${summary.firstTry} på första försöket`),
      isNewBest ? el('div', { class: 'new-best' }, '🎉 Nytt bästa resultat!') : null,
    ),
    list('Missade', missed),
    list('Behövde fler försök', shaky),
    missed.length + shaky.length === 0 ? el('p', { class: 'perfect' }, 'Felfritt – alla rätt på första försöket!') : null,
    el('div', { class: 'btn-row' }, again, menu),
  );
}
