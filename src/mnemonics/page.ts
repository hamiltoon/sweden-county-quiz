/**
 * Sidan /minnesregler (PO-33): alla regler per kategori med röster, hur ofta de hjälpt och
 * kommentarer. Där kan man rösta, kommentera och föreslå en egen regel eller önska en.
 */
import { MNEMONICS, type Mnemonic, type MnemonicCategory } from '../data/mnemonics';
import { t } from '../i18n';
import { COMMENT_MAX_LENGTH, type MnemonicsResponse, type RuleComment, type RuleStats } from '../shared/mnemonics';
import { el } from '../ui/dom';
import { comment, fetchMnemonics, myVotes, suggest, textOf } from './index';
import { renderVoteButtons } from './ui';

const CATEGORIES: MnemonicCategory[] = ['princip', 'lan', 'stad', 'landskap', 'sjo', 'kommun'];

export function renderMnemonicsPage(onBack: () => void): HTMLElement {
  const m = t().mnemonic;
  const back = el('button', { class: 'btn', type: 'button' }, m.back);
  back.addEventListener('click', onBack);
  const status = el('p', { class: 'mnemonics-status', role: 'status' }, m.loading);
  const rules = MNEMONICS.filter((r) => textOf(r));
  const cards = new Map(rules.map((r) => [r.id, renderCard(r)]));

  const page = el(
    'section',
    { class: 'end mnemonics-page' },
    el('h1', {}, m.pageTitle),
    el('p', { class: 'lead' }, m.pageIntro),
    rules.length ? status : el('p', {}, m.onlySwedish),
    ...CATEGORIES.map((category) => {
      const inCategory = rules.filter((r) => r.category === category);
      return inCategory.length
        ? el('section', { class: 'mnemonic-category' }, el('h2', {}, m.categories[category]), ...inCategory.map((r) => cards.get(r.id)!.node))
        : null;
    }),
    renderSuggest(),
    el('div', { class: 'btn-row' }, back),
  );

  if (rules.length) {
    fetchMnemonics()
      .then((data: MnemonicsResponse) => {
        status.textContent = '';
        for (const stats of data.rules) cards.get(stats.id)?.setStats(stats);
        for (const c of data.comments) cards.get(c.ruleId)?.addComment(c, false);
      })
      .catch(() => {
        status.textContent = m.failed;
      });
  }
  return page;
}

/** Ett kort per regel: text, varför, röster, "hjälpte"-andel, kommentarer och ett kommentarsfält. */
function renderCard(rule: Mnemonic): { node: HTMLElement; setStats: (s: RuleStats) => void; addComment: (c: RuleComment, mine: boolean) => void } {
  const m = t().mnemonic;
  const text = textOf(rule)!;
  let stats: RuleStats = { id: rule.id, up: 0, down: 0, helpedYes: 0, helpedNo: 0, questioned: false };
  let shownVote: number = myVotes()[rule.id] ?? 0;
  const statsLine = el('p', { class: 'mnemonic-stats' });
  const renderStats = () => {
    const helpedTotal = stats.helpedYes + stats.helpedNo;
    statsLine.replaceChildren(
      m.votes(stats.up, stats.down),
      helpedTotal ? ` · ${m.helped(stats.helpedYes, helpedTotal)}` : '',
      stats.questioned ? el('span', { class: 'mnemonic-questioned' }, m.questioned) : '',
    );
  };
  const votes = renderVoteButtons(rule, (next) => {
    // Räkna om direkt på sidan; servern har samma regel (en röst per enhet).
    if (shownVote === 1) stats.up--;
    if (shownVote === -1) stats.down--;
    if (next === 1) stats.up++;
    if (next === -1) stats.down++;
    shownVote = next;
    renderStats();
  });

  const comments = el('ul', { class: 'mnemonic-comments' });
  const commentsTitle = el('summary', {}, m.comments(0));
  let count = 0;
  const addComment = (c: RuleComment, mine: boolean) => {
    const item = el('li', {}, c.name ? el('strong', {}, `${c.name}: `) : null, c.text);
    if (mine) comments.prepend(item);
    else comments.append(item);
    commentsTitle.textContent = m.comments(++count);
  };

  const form = el('form', { class: 'mnemonic-form' });
  const textId = `comment-${rule.id}`;
  const textarea = el('textarea', { id: textId, name: 'text', rows: '2', maxlength: String(COMMENT_MAX_LENGTH), required: true });
  const name = el('input', { type: 'text', name: 'name', maxlength: '30', autocomplete: 'nickname', placeholder: m.namePlaceholder, 'aria-label': m.namePlaceholder });
  const formStatus = el('span', { class: 'mnemonic-note', role: 'status' });
  form.append(el('label', { for: textId }, m.commentLabel), textarea, name, el('button', { class: 'btn', type: 'submit' }, m.send), formStatus);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = textarea.value.trim();
    if (!value) return;
    const who = name.value.trim() || undefined;
    comment(rule.id, value, who)
      .then(() => {
        addComment({ id: 0, ruleId: rule.id, name: who ?? null, text: value, createdAt: new Date().toISOString() }, true);
        textarea.value = '';
        formStatus.textContent = m.thanks;
      })
      .catch(() => {
        formStatus.textContent = m.sendFailed;
      });
  });

  renderStats();
  const node = el(
    'article',
    { class: 'mnemonic-card', 'data-rule': rule.id },
    el('h3', {}, rule.entity),
    el('p', { class: 'mnemonic-text' }, text.text),
    text.why ? el('details', { class: 'mnemonic-why' }, el('summary', {}, m.why), el('p', {}, text.why)) : null,
    statsLine,
    votes,
    el('details', { class: 'mnemonic-discuss' }, commentsTitle, comments, form),
  );
  return {
    node,
    setStats: (s) => {
      stats = s;
      renderStats();
    },
    addComment,
  };
}

/** Föreslå en egen regel eller önska en regel för något. */
function renderSuggest(): HTMLElement {
  const m = t().mnemonic;
  const form = el('form', { class: 'mnemonic-form mnemonic-suggest' });
  const kind = (value: 'rule' | 'wish', label: string, checked: boolean) =>
    el('label', { class: 'radio' }, el('input', { type: 'radio', name: 'kind', value, checked }), ` ${label}`);
  const textarea = el('textarea', { id: 'suggest-text', name: 'text', rows: '3', maxlength: String(COMMENT_MAX_LENGTH), required: true });
  const name = el('input', { type: 'text', name: 'name', maxlength: '30', autocomplete: 'nickname', placeholder: m.namePlaceholder, 'aria-label': m.namePlaceholder });
  const formStatus = el('p', { class: 'mnemonic-note', role: 'status' });
  form.append(
    el('fieldset', {}, el('legend', {}, m.suggestTitle), kind('rule', m.suggestRule, true), kind('wish', m.suggestWish, false)),
    el('label', { for: 'suggest-text' }, m.suggestLabel),
    textarea,
    name,
    el('button', { class: 'btn btn-primary', type: 'submit' }, m.send),
    formStatus,
  );
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = textarea.value.trim();
    if (!value) return;
    const chosen = (form.querySelector('input[name="kind"]:checked') as HTMLInputElement | null)?.value === 'wish' ? 'wish' : 'rule';
    suggest(chosen, value, name.value.trim() || undefined)
      .then(() => {
        textarea.value = '';
        formStatus.textContent = m.suggestThanks;
      })
      .catch(() => {
        formStatus.textContent = m.sendFailed;
      });
  });
  return el('section', { class: 'mnemonic-category' }, form);
}
