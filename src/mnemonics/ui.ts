/** Minnesreglerna på skärmen: röstknapparna, raden på slutskärmen och "Hjälpte minnesregeln?". */
import type { Mnemonic } from '../data/mnemonics';
import { lang, t } from '../i18n';
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

/**
 * Regeln med 💡, "Varför?" att fälla ut och röstknapparna (slutskärmen, krav 2). Gäller den flera
 * av de missade sakerna står de först, eftersom regeln bara visas en gång.
 */
export function renderRule(rule: Mnemonic, things: string[] = []): HTMLElement | null {
  const text = textOf(rule);
  if (!text) return null;
  return el(
    'div',
    { class: 'mnemonic', 'data-rule': rule.id },
    things.length > 1 ? el('p', { class: 'mnemonic-about' }, t().mnemonic.about(new Intl.ListFormat(lang(), { type: 'conjunction' }).format(things))) : null,
    el('p', { class: 'mnemonic-text' }, el('span', { 'aria-hidden': 'true' }, `${t().mnemonic.bulb} `), text.text),
    text.why ? el('details', { class: 'mnemonic-why' }, el('summary', {}, t().mnemonic.why), el('p', {}, text.why)) : null,
    renderVoteButtons(rule),
  );
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
