import { el } from './dom';
import { t } from '../i18n';

/**
 * PO-15 (variant C): hur solospelet går vidare efter en missad fråga. Knappen "Nästa" räknar ned,
 * och spelet går vidare när tiden är ute, när man trycker på knappen eller när man trycker på kartan.
 * Nedräkningen står still medan man håller fingret på kartan, medan fliken är dold och, för den som
 * använder tangentbordet, medan fokus är i rutan (WCAG 2.2.1).
 */

/** Ett tryck (inte ett håll eller en dragning) är kortare och rör sig mindre än så här. */
const TAP_MS = 350;
const TAP_PX = 10;
/** Ett tryck på kartan strax efter missen är ett dubbeltryck på svaret, inte "gå vidare". */
const TAP_GRACE_MS = 700;
const TICK_MS = 100;

const HINT_KEY = 'sverigespelet.holdHints.v1';
/** Så många gånger per enhet visas hinten om att hålla på kartan. */
const HINT_TIMES = 3;

/** Ska hinten om att hålla på kartan visas den här gången? Räknar upp; utan lagring visas den varje gång. */
export function takeHoldHint(): boolean {
  try {
    const shown = Number(localStorage.getItem(HINT_KEY) ?? '0') || 0;
    if (shown >= HINT_TIMES) return false;
    localStorage.setItem(HINT_KEY, String(shown + 1));
  } catch {
    /* utan lagring */
  }
  return true;
}

export interface Advance {
  /** Knappen, att lägga i rätt/fel-rutan. */
  readonly button: HTMLButtonElement;
  /** Avbryter utan att gå vidare (t.ex. när man avslutar omgången). */
  cancel(): void;
}

export interface AdvanceOptions {
  /** Ytan där ett tryck går vidare och ett håll pausar (kartan). */
  surface: HTMLElement;
  /** Nedräkningens längd. */
  ms: number;
  /** Har tangentbordet använts i omgången? Då står nedräkningen still medan fokus är i rutan. */
  keyboard: () => boolean;
  onDone: () => void;
}

export function createAdvance({ surface, ms: total, keyboard, onDone }: AdvanceOptions): Advance {
  const count = el('span', { class: 'advance-count', 'aria-hidden': 'true' });
  const bar = el('span', { class: 'advance-bar', 'aria-hidden': 'true' });
  const button = el('button', { class: 'toast-action', type: 'button' }, el('span', {}, t().game.next), count, bar);
  let remaining = total;
  let since = performance.now();
  let held = 0;
  // Nedräkningen börjar först när rutan syns (se nedan); till dess står den still.
  let paused = true;
  let shown = false;
  let interval: number | undefined;
  let down: { x: number; y: number; at: number } | null = null;
  let shownAt = performance.now();

  /** Fokus i rutan efter att tangentbordet använts: man läser eller ska trycka Enter. */
  const keyboardHold = () => keyboard() && !!button.closest('.toast')?.contains(document.activeElement);
  const left = () => (paused ? remaining : remaining - (performance.now() - since));
  const render = () => {
    const ms = Math.max(0, left());
    count.textContent = String(Math.ceil(ms / 1000));
    bar.style.transform = `scaleX(${ms / total})`;
    button.classList.toggle('is-paused', paused);
  };
  const pause = () => {
    if (paused) return;
    remaining = left();
    paused = true;
    render();
  };
  const resume = () => {
    if (!paused || !shown || held > 0 || document.hidden || keyboardHold()) return;
    since = performance.now();
    paused = false;
    render();
  };

  const onDown = (e: PointerEvent) => {
    held++;
    const now = performance.now();
    down = now - shownAt < TAP_GRACE_MS ? null : { x: e.clientX, y: e.clientY, at: now };
    pause();
  };
  const onUp = () => {
    held = Math.max(0, held - 1);
    resume();
  };
  // Klicket fångas innan kartan får det, så att det inte räknas som svar på nästa fråga.
  const onClick = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const tap = !!down && performance.now() - down.at < TAP_MS && Math.hypot(e.clientX - down.x, e.clientY - down.y) < TAP_PX;
    down = null;
    if (tap) finish();
  };
  const onVisibility = () => (document.hidden ? pause() : resume());

  const cancel = () => {
    window.clearInterval(interval);
    surface.removeEventListener('pointerdown', onDown, true);
    window.removeEventListener('pointerup', onUp, true);
    window.removeEventListener('pointercancel', onUp, true);
    surface.removeEventListener('click', onClick, true);
    document.removeEventListener('visibilitychange', onVisibility);
  };
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    cancel();
    onDone();
  };

  button.addEventListener('click', finish);
  surface.addEventListener('pointerdown', onDown, true);
  window.addEventListener('pointerup', onUp, true);
  window.addEventListener('pointercancel', onUp, true);
  surface.addEventListener('click', onClick, true);
  document.addEventListener('visibilitychange', onVisibility);
  render();
  // Efter nästa bildruta har rutan ritats; först då börjar de 4 sekunderna, också när kartan har
  // mycket att rita och sidan är seg.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      if (done) return;
      shown = true;
      shownAt = performance.now();
      resume();
    }),
  );
  interval = window.setInterval(() => {
    // Fokus kan ha flyttats in i eller ut ur rutan med tangentbordet.
    if (keyboardHold()) pause();
    else resume();
    render();
    if (left() <= 0) finish();
  }, TICK_MS);
  return { button, cancel };
}
