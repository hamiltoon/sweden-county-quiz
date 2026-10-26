/** Minnesreglerna på skärmen: röstknapparna, raden på slutskärmen och "Hjälpte minnesregeln?". */
import type { Mnemonic } from '../data/mnemonics';
import { t } from '../i18n';
import { el } from '../ui/dom';
import { answerHelped, myVotes, textOf, vote } from './index';

/**
 * 👍 och 👎 för en regel. Ett tryck till på samma knapp tar tillbaka rösten. Ett 👎 döljer regeln på
 * enheten från nästa gång; här står den kvar, så att man kan ångra.
 */
export function renderVoteButtons(rule: Mnemonic, onChange?: (value: 1 | -1 | 0) => void): HTMLElement {
  const note = el('span', { class: 'mnemonic-note', 'aria-live': 'polite' });
  const make = (value: 1 | -1, icon: string, label: string) => {
    const btn = el('button', { class: 'vote-btn', type: 'button', 'aria-label': label, title: label, 'data-vote': String(value) }, icon);
    btn.addEventListener('click', () => {
      const next = myVotes()[rule.id] === value ? 0 : value;
      render(next);
      onChange?.(next);
      // Rösten gäller på enheten även om den inte når servern; ett nytt tryck försöker igen.
      vote(rule.id, next).catch(() => undefined);
    });
    return btn;
  };
  const up = make(1, '👍', t().mnemonic.good);
  const down = make(-1, '👎', t().mnemonic.bad);
  const render = (current: number) => {
    up.setAttribute('aria-pressed', String(current === 1));
    down.setAttribute('aria-pressed', String(current === -1));
    note.textContent = current === -1 ? t().mnemonic.hiddenHere : '';
  };
  render(myVotes()[rule.id] ?? 0);
  return el('div', { class: 'vote-row' }, up, down, note);
}

/** Så många regler syns på slutskärmen innan "Visa alla". */
const END_RULES_VISIBLE = 3;

/**
 * En regel på slutskärmen: de missade sakerna den gäller som rubrik, den korta texten med 💡, "Mer"
 * som fäller ut hela texten och varför den fungerar, och röstknapparna. Rösten gäller regeln.
 */
function renderRuleRow(rule: Mnemonic, things: string[]): HTMLElement | null {
  const text = textOf(rule);
  if (!text) return null;
  const more = [text.short && text.short !== text.text ? el('p', {}, text.text) : null, text.why ? el('p', { class: 'mnemonic-why' }, text.why) : null].filter(
    (n): n is HTMLParagraphElement => !!n,
  );
  return el(
    'li',
    { class: 'mnemonic', 'data-rule': rule.id },
    el('p', { class: 'mnemonic-about' }, things.join(', ')),
    el('p', { class: 'mnemonic-text' }, el('span', { 'aria-hidden': 'true' }, `${t().mnemonic.bulb} `), text.short ?? text.text),
    // "Mer" och röstknapparna på samma rad, så att raden blir låg.
    el(
      'div',
      { class: 'mnemonic-foot' },
      more.length ? el('details', { class: 'mnemonic-more' }, el('summary', {}, t().mnemonic.more), ...more) : el('span', { class: 'mnemonic-more' }),
      renderVoteButtons(rule),
    ),
  );
}

/**
 * Minnesreglerna för de missade sakerna på slutskärmen (PO-33): en rad per regel, högst
 * END_RULES_VISIBLE innan "Visa alla (N)", och en länk till alla regler. `onShown` får varje regel
 * när den syns.
 */
export function renderEndRules(entries: { rule: Mnemonic; things: string[] }[], onShown: (rule: Mnemonic) => void, onAllRules: () => void): HTMLElement | null {
  const rows = entries.map(({ rule, things }) => ({ rule, row: renderRuleRow(rule, things) })).filter((e): e is { rule: Mnemonic; row: HTMLLIElement } => !!e.row);
  if (!rows.length) return null;
  rows.forEach(({ rule, row }, i) => {
    if (i < END_RULES_VISIBLE) onShown(rule);
    else row.hidden = true;
  });
  const list = el('ul', { class: 'mnemonic-list' }, ...rows.map((e) => e.row));
  let showAll: HTMLButtonElement | null = null;
  if (rows.length > END_RULES_VISIBLE) {
    showAll = el('button', { class: 'btn btn-link mnemonic-show-all', type: 'button' }, t().mnemonic.showAll(rows.length));
    showAll.addEventListener('click', () => {
      rows.slice(END_RULES_VISIBLE).forEach(({ rule, row }) => {
        row.hidden = false;
        onShown(rule);
      });
      // Fokus till den första regeln som kom fram, så att tangentbordet inte hamnar på en borttagen knapp.
      const first = rows[END_RULES_VISIBLE].row;
      first.tabIndex = -1;
      first.focus();
      showAll?.remove();
    });
  }
  const link = el('a', { class: 'mnemonic-link', href: '/minnesregler' }, t().mnemonic.allRules);
  link.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    onAllRules();
  });
  return el('div', { class: 'result-group mnemonic-rules' }, el('h3', {}, t().mnemonic.endTitle), list, el('div', { class: 'mnemonic-rules-foot' }, showAll, link));
}

/** "Hjälpte minnesregeln?" efter ett rätt svar på något vars regel man sett förut (krav 5). */
export function renderHelped(rule: Mnemonic, place: string): HTMLElement | null {
  const text = textOf(rule);
  if (!text) return null;
  const box = el('section', { class: 'mnemonic-helped', 'data-rule': rule.id, 'aria-labelledby': 'helped-title' });
  const answer = (helped: boolean) => {
    answerHelped(rule.id, helped).catch(() => undefined);
    box.replaceChildren(el('p', { class: 'mnemonic-thanks', role: 'status' }, t().mnemonic.thanks));
  };
  const yes = el('button', { class: 'btn', type: 'button', 'data-helped': 'yes' }, `👍 ${t().mnemonic.yes}`);
  const no = el('button', { class: 'btn', type: 'button', 'data-helped': 'no' }, `👎 ${t().mnemonic.no}`);
  yes.addEventListener('click', () => answer(true));
  no.addEventListener('click', () => answer(false));
  box.append(
    el('h3', { id: 'helped-title' }, t().mnemonic.helpedTitle),
    el('p', {}, t().mnemonic.helpedAbout(place)),
    el('p', { class: 'mnemonic-text' }, el('span', { 'aria-hidden': 'true' }, `${t().mnemonic.bulb} `), text.short ?? text.text),
    el('div', { class: 'btn-row' }, yes, no),
  );
  return box;
}
