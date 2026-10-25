/** Första live-skärmen: skriv namn och skapa ett rum, eller gå med i ett med kod eller länk. */
import { normalizeName } from '../shared/leaderboard';
import { LIVE_CODE_LENGTH, LIVE_CODE_PATTERN } from '../shared/live';
import { el } from '../ui/dom';

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
    placeholder: 'Ditt namn',
    'aria-label': 'Ditt namn',
  });
  nameInput.value = opts.name ?? '';
  const error = el('p', { class: 'name-error', role: 'alert' });

  const readName = (): string | null => {
    const name = normalizeName(nameInput.value);
    if (!name) {
      error.textContent = 'Skriv ett namn först.';
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
    placeholder: 'KOD',
    'aria-label': 'Rumskod',
  });
  if (opts.code) codeInput.value = opts.code;
  const join = el('button', { class: 'btn btn-primary', type: 'submit' }, opts.code ? `Gå med i ${opts.code}` : 'Gå med');
  const joinForm = el('form', { class: 'live-join' }, opts.code ? null : el('div', { class: 'name-row' }, codeInput, join), opts.code ? join : null);
  joinForm.addEventListener('submit', (event) => {
    event.preventDefault();
    error.textContent = '';
    const code = codeInput.value.trim().toUpperCase();
    if (!LIVE_CODE_PATTERN.test(code)) {
      error.textContent = `Rumskoden är ${LIVE_CODE_LENGTH} tecken, t.ex. KXR4.`;
      codeInput.focus();
      return;
    }
    const name = readName();
    if (name) opts.onJoin(code, name);
  });

  const create = el('button', { class: 'btn btn-primary', type: 'button' }, 'Skapa ett rum');
  create.addEventListener('click', () => {
    error.textContent = '';
    const name = readName();
    if (!name) return;
    create.disabled = true;
    create.textContent = 'Skapar rum …';
    opts.onCreate(name).catch((err: unknown) => {
      error.textContent = err instanceof Error ? err.message : 'Kunde inte skapa ett rum.';
      create.disabled = false;
      create.textContent = 'Skapa ett rum';
    });
  });

  const back = el('button', { class: 'btn', type: 'button' }, 'Tillbaka');
  back.addEventListener('click', opts.onBack);

  return el(
    'section',
    { class: 'end live-entry' },
    el('h2', {}, 'Spela live'),
    el(
      'p',
      { class: 'lead' },
      opts.code
        ? `Du är inbjuden till rum ${opts.code}. Skriv ditt namn och gå med.`
        : 'Tävla mot kompisar i realtid: alla får samma län samtidigt, och snabbast rätt svar ger mest poäng.',
    ),
    el('label', { class: 'name-label', for: 'live-name' }, 'Namn'),
    nameInput,
    error,
    opts.code ? null : el('div', { class: 'btn-row' }, create),
    opts.code ? null : el('p', { class: 'live-or' }, 'eller gå med i ett rum'),
    joinForm,
    el('div', { class: 'btn-row' }, back),
  );
}
