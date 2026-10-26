import { el } from './dom';
import { t } from '../i18n';

/**
 * PO-15: hur solospelet går vidare efter en missad fråga. Varianterna jämförs på staging med ?v=a,
 * ?v=b eller ?v=c; utan den går spelet vidare som förut.
 * - a: knappen "Nästa", ingen automatik.
 * - b: knappen med nedräkning; ett tryck på kartan går också vidare, och att hålla fingret på
 *   kartan pausar nedräkningen.
 * - c: som b, och en linje från felklicket till rätt svar med avståndet.
 */
export type MissVariant = 'a' | 'b' | 'c';

const VARIANT_KEY = 'sverigespelet.missVariant';

/** Varianten från adressen (?v=), som sparas för fliken så att den följer med mellan omgångarna. */
export function missVariant(): MissVariant | null {
  const isVariant = (v: string | null): v is MissVariant => v === 'a' || v === 'b' || v === 'c';
  const fromUrl = new URLSearchParams(location.search).get('v');
  try {
    if (isVariant(fromUrl)) sessionStorage.setItem(VARIANT_KEY, fromUrl);
    const saved = sessionStorage.getItem(VARIANT_KEY);
    return isVariant(saved) ? saved : null;
  } catch {
    return isVariant(fromUrl) ? fromUrl : null;
  }
}

/** Ett tryck (inte ett håll eller en dragning) är kortare och rör sig mindre än så här. */
const TAP_MS = 350;
const TAP_PX = 10;
/** Ett tryck på kartan strax efter missen är ett dubbeltryck på svaret, inte "gå vidare". */
const TAP_GRACE_MS = 700;
const TICK_MS = 100;

export interface Advance {
  /** Knappen, att lägga i rätt/fel-rutan. */
  readonly button: HTMLButtonElement;
  /** Avbryter utan att gå vidare (t.ex. när man avslutar omgången). */
  cancel(): void;
}

/**
 * Knappen "Nästa" och, med `autoMs`, en nedräkning som går vidare av sig själv. Med nedräkning går
 * också ett tryck på `surface` (kartan) vidare, och nedräkningen står still så länge man håller
 * kvar fingret där eller fliken är dold.
 */
export function createAdvance(surface: HTMLElement, autoMs: number | null, onDone: () => void): Advance {
  const count = el('span', { class: 'advance-count', 'aria-hidden': 'true' });
  const bar = el('span', { class: 'advance-bar', 'aria-hidden': 'true' });
  const button = el('button', { class: 'toast-action', type: 'button' }, el('span', {}, t().game.next), ...(autoMs ? [count, bar] : []));
  let remaining = autoMs ?? 0;
  let since = performance.now();
  let held = 0;
  // Nedräkningen börjar först när rutan syns (se nedan); till dess står den still.
  let paused = true;
  let shown = false;
  let interval: number | undefined;
  let down: { x: number; y: number; at: number } | null = null;
  let shownAt = performance.now();

  const left = () => (paused ? remaining : remaining - (performance.now() - since));
  const render = () => {
    const ms = Math.max(0, left());
    count.textContent = String(Math.ceil(ms / 1000));
    bar.style.transform = `scaleX(${autoMs ? ms / autoMs : 0})`;
    button.classList.toggle('is-paused', paused);
  };
  const pause = () => {
    if (paused) return;
    remaining = left();
    paused = true;
    render();
  };
  const resume = () => {
    if (!paused || !shown || held > 0 || document.hidden) return;
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
  if (autoMs) {
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
      render();
      if (left() <= 0) finish();
    }, TICK_MS);
  }
  return { button, cancel };
}
