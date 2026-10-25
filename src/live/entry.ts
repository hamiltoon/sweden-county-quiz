/** Första live-skärmen: skriv namn och skapa ett rum, eller gå med i ett med kod eller länk. */
import { normalizeName } from '../shared/leaderboard';
import { LIVE_CODE_LENGTH, LIVE_CODE_PATTERN } from '../shared/live';
import { el } from '../ui/dom';
import { t } from '../i18n';

export interface LiveEntryOptions {
  /** Koden från en delad länk; då visas bara "Gå med". */
  code?: string;
  name: string | null;
  onCreate: (name: string) => Promise<void>;
  onJoin: (code: string, name: string) => void;
  onBack: () => void;
}

export function renderLiveEntry(opts: LiveEntryOptions): HTMLElement {
  const nameInput = el('input', {
    class: 'name-input',
    type: 'text',
    name: 'live-name',
    autocomplete: 'nickname',
    maxlength: '20',
    placeholder: t().common.yourName,
    'aria-label': t().common.yourName,
  });
  nameInput.value = opts.name ?? '';
  const error = el('p', { class: 'name-error', role: 'alert' });

  const readName = (): string | null => {
    const name = normalizeName(nameInput.value);
    if (!name) {
      error.textContent = t().common.writeName;
      nameInput.focus();
    }
    return name;
  };

  const codeInput = el('input', {
    class: 'name-input live-code-input',
    type: 'text',
    name: 'live-code',
    autocomplete: 'off',
    autocapitalize: 'characters',
    spellcheck: 'false',
    maxlength: String(LIVE_CODE_LENGTH),
    placeholder: t().live.codePlaceholder,
    'aria-label': t().live.codeLabel,
  });
  if (opts.code) codeInput.value = opts.code;
  const join = el('button', { class: 'btn btn-primary', type: 'submit' }, opts.code ? t().live.joinCode(opts.code) : t().live.join);
  const joinForm = el('form', { class: 'live-join' }, opts.code ? null : el('div', { class: 'name-row' }, codeInput, join), opts.code ? join : null);
  joinForm.addEventListener('submit', (event) => {
    event.preventDefault();
    error.textContent = '';
    const code = codeInput.value.trim().toUpperCase();
    if (!LIVE_CODE_PATTERN.test(code)) {
      error.textContent = t().live.codeInvalid(LIVE_CODE_LENGTH);
      codeInput.focus();
      return;
    }
    const name = readName();
    if (name) opts.onJoin(code, name);
  });

  const create = el('button', { class: 'btn btn-primary', type: 'button' }, t().live.create);
  create.addEventListener('click', () => {
    error.textContent = '';
    const name = readName();
    if (!name) return;
    create.disabled = true;
    create.textContent = t().live.creating;
    opts.onCreate(name).catch((err: unknown) => {
      error.textContent = err instanceof Error ? err.message : t().live.createFailed;
      create.disabled = false;
      create.textContent = t().live.create;
    });
  });

  const back = el('button', { class: 'btn', type: 'button' }, t().common.back);
  back.addEventListener('click', opts.onBack);

  return el(
    'section',
    { class: 'end live-entry' },
    el('h2', {}, t().live.title),
    el(
      'p',
      { class: 'lead' },
      opts.code ? t().live.invited(opts.code) : t().live.intro,
    ),
    el('label', { class: 'name-label', for: 'live-name' }, t().live.name),
    nameInput,
    error,
    opts.code ? null : el('div', { class: 'btn-row' }, create),
    opts.code ? null : el('p', { class: 'live-or' }, t().live.or),
    joinForm,
    el('div', { class: 'btn-row' }, back),
  );
}
