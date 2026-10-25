import { el, clear } from './dom';
import { MODE_LABELS, type Mode } from '../game/game';
import {
  LEADERBOARD_MODES,
  NAME_MAX_LENGTH,
  TOTAL,
  type LeaderboardMode,
  type LeaderboardView,
  type ScoreSubmission,
  type SubmitResponse,
} from '../shared/leaderboard';
import { fetchTop, flushPending, queueResult, setPlayerName } from '../api/leaderboard';
import { getPlayerName } from '../game/storage';

const sameName = (a: string, b: string | null) => b !== null && a.toLocaleLowerCase('sv') === b.toLocaleLowerCase('sv');

const VIEW_LABELS: Record<LeaderboardView, string> = { ...MODE_LABELS, [TOTAL]: 'Totalt' };

/** Topp 10 för ett läge eller totalen. Spelarens egen rad markeras. */
function renderTopList(): { node: HTMLElement; load: (mode: LeaderboardView) => Promise<void> } {
  const node = el('div', { class: 'top-list', 'aria-live': 'polite' });
  let current = 0;
  const load = async (mode: LeaderboardView) => {
    const ticket = ++current;
    clear(node);
    node.append(el('p', { class: 'top-status' }, 'Laddar topplistan…'));
    try {
      const { top } = await fetchTop(mode);
      if (ticket !== current) return;
      clear(node);
      if (!top.length) {
        node.append(el('p', { class: 'top-status' }, 'Ingen har kommit med på topplistan i det här läget än.'));
        return;
      }
      const me = getPlayerName();
      node.append(
        el(
          'ol',
          { class: 'top-rows' },
          ...top.map((entry) => {
            // Delad placering vid lika poäng.
            const rank = 1 + top.filter((other) => other.score > entry.score).length;
            return el(
              'li',
              { class: sameName(entry.name, me) ? 'top-row is-me' : 'top-row' },
              // Guld, silver och brons för de tre bästa placeringarna.
              el('span', { class: rank <= 3 ? `top-rank medal medal-${rank}` : 'top-rank', 'aria-label': `Plats ${rank}` }, `${rank}`),
              el(
                'span',
                { class: 'top-name' },
                entry.name,
                // I totalen syns hur många av lägena summan bygger på.
                entry.modes !== undefined ? el('span', { class: 'top-modes' }, ` · ${entry.modes} av ${LEADERBOARD_MODES.length} lägen`) : null,
              ),
              el('span', { class: 'top-score' }, `${entry.score} p`),
            );
          }),
        ),
      );
    } catch (err) {
      if (ticket !== current) return;
      clear(node);
      node.append(el('p', { class: 'top-status' }, err instanceof Error ? err.message : 'Topplistan kunde inte hämtas.'));
    }
  };
  return { node, load };
}

/** Formulär för att välja eller byta namn. */
function renderNameForm(label: string, buttonText: string, onSaved: (name: string) => void): HTMLFormElement {
  const input = el('input', {
    class: 'name-input',
    type: 'text',
    name: 'name',
    maxlength: String(NAME_MAX_LENGTH),
    autocomplete: 'nickname',
    enterkeyhint: 'done',
    placeholder: 'Ditt namn',
    'aria-label': 'Ditt namn',
    required: true,
  });
  input.value = getPlayerName() ?? '';
  const error = el('p', { class: 'name-error', role: 'alert' });
  const form = el(
    'form',
    { class: 'name-form' },
    el('label', { class: 'name-label' }, label),
    el('div', { class: 'name-row' }, input, el('button', { class: 'btn btn-primary', type: 'submit' }, buttonText)),
    error,
  );
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = setPlayerName(input.value);
    if (!name) {
      error.textContent = 'Skriv ett namn först.';
      return;
    }
    error.textContent = '';
    input.blur();
    onSaved(name);
  });
  return form;
}

function rankText(ranks: SubmitResponse['ranks'], mode: LeaderboardMode): string {
  const parts = [
    ranks[mode] ? `plats ${ranks[mode]} i ${MODE_LABELS[mode]}` : null,
    ranks[TOTAL] ? `plats ${ranks[TOTAL]} totalt` : null,
  ].filter(Boolean);
  return parts.length ? ` Du ligger på ${parts.join(' och ')}.` : '';
}

/** Topplistan på startskärmen: namn, flikar per läge och listan. */
export function renderStartLeaderboard(): HTMLElement {
  // Totalen först: summan av spelarens bästa resultat i varje läge.
  const views: LeaderboardView[] = [TOTAL, ...LEADERBOARD_MODES];
  let selected: LeaderboardView = TOTAL;
  const list = renderTopList();
  const playerRow = el('div', { class: 'player-row' });
  const status = el('p', { class: 'top-note', 'aria-live': 'polite' });

  const tabs = views.map((mode) => {
    const tab = el(
      'button',
      { class: 'top-tab', type: 'button', role: 'tab', 'data-mode': mode, 'aria-selected': String(mode === selected) },
      VIEW_LABELS[mode],
    );
    tab.addEventListener('click', () => {
      selected = mode;
      for (const t of tabs) t.setAttribute('aria-selected', String(t === tab));
      void list.load(mode);
    });
    return tab;
  });

  const showPlayer = () => {
    clear(playerRow);
    const name = getPlayerName();
    if (!name) {
      playerRow.append(renderNameForm('Skriv ditt namn för att komma med på topplistan.', 'Spara', onNameSaved));
      return;
    }
    const change = el('button', { class: 'link-btn', type: 'button' }, 'Byt namn');
    change.addEventListener('click', () => {
      clear(playerRow);
      playerRow.append(renderNameForm('Nytt namn för kommande omgångar:', 'Spara', onNameSaved));
      playerRow.querySelector('input')?.focus();
    });
    playerRow.append(el('p', { class: 'player-name' }, 'Du spelar som ', el('strong', {}, name), ' · ', change));
  };

  const sync = async (announce: boolean) => {
    try {
      const res = await flushPending();
      if (announce && res && res.saved > 0) {
        status.textContent =
          res.saved === 1 ? 'Ditt tidigare resultat har lagts till på topplistan.' : `Dina ${res.saved} tidigare resultat har lagts till på topplistan.`;
      }
    } catch (err) {
      if (announce) status.textContent = `${err instanceof Error ? err.message : 'Kunde inte spara.'} Resultaten skickas nästa gång.`;
    }
    await list.load(selected);
  };

  function onNameSaved(): void {
    showPlayer();
    void sync(true);
  }

  showPlayer();
  void sync(false);

  return el(
    'section',
    { class: 'leaderboard', 'aria-labelledby': 'top-heading' },
    el('h2', { id: 'top-heading' }, 'Topplista'),
    playerRow,
    status,
    el('div', { class: 'top-tabs', role: 'tablist', 'aria-label': 'Läge' }, ...tabs),
    list.node,
  );
}

/**
 * Topplistan på slutskärmen: sparar omgången (eller frågar efter namn först) och visar listan
 * för läget som just spelades.
 */
export function renderEndLeaderboard(mode: Mode, result: ScoreSubmission): HTMLElement {
  const list = renderTopList();
  const status = el('p', { class: 'top-note', 'aria-live': 'polite' });
  const formSlot = el('div', {});

  const save = async () => {
    status.textContent = 'Sparar på topplistan…';
    try {
      const res = await flushPending();
      const name = getPlayerName() ?? '';
      status.textContent = `Sparat som ${name}.${res ? rankText(res.ranks, mode) : ''}`;
    } catch (err) {
      status.textContent = `${err instanceof Error ? err.message : 'Kunde inte spara.'} Resultatet skickas nästa gång.`;
    }
    await list.load(mode);
  };

  if (queueResult(result)) {
    void save();
  } else {
    formSlot.append(
      renderNameForm('Vill du komma med på topplistan? Skriv ditt namn.', 'Spara', () => {
        clear(formSlot);
        queueResult(result);
        void save();
      }),
    );
    void list.load(mode);
  }

  return el(
    'section',
    { class: 'leaderboard', 'aria-labelledby': 'end-top-heading' },
    el('h3', { id: 'end-top-heading' }, `Topplista · ${MODE_LABELS[mode]}`),
    formSlot,
    status,
    list.node,
  );
}
