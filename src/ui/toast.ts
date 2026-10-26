import { el } from './dom';

export type ToastKind = 'ok' | 'bad' | 'info';
/** Överst täcker toasten Norrland, nederst Skåne. Välj den sida där svaren inte ligger. */
export type ToastPlacement = 'top' | 'bottom';

/**
 * En liten icke-blockerande feedback-ruta över kartan. Den kan ha en knapp (t.ex. "Nästa"), som
 * ligger utanför den del som läses upp.
 */
export class Toast {
  private readonly node: HTMLDivElement;
  private readonly text: HTMLSpanElement;
  private timer: number | undefined;

  constructor(
    parent: HTMLElement,
    private placement: ToastPlacement = 'top',
  ) {
    this.text = el('span', { class: 'toast-text', role: 'status', 'aria-live': 'polite' });
    this.node = el('div', { class: `toast toast-${placement}` }, this.text);
    parent.append(this.node);
  }

  show(message: string, kind: ToastKind, durationMs: number, action?: HTMLElement): void {
    window.clearTimeout(this.timer);
    this.text.textContent = message;
    this.node.replaceChildren(this.text, ...(action ? [action] : []));
    this.node.className = `toast toast-${this.placement} toast-${kind} is-visible${action ? ' has-action' : ''}`;
    if (durationMs > 0) this.timer = window.setTimeout(() => this.hide(), durationMs);
  }

  /** Flyttar toasten, t.ex. nedåt när svaret ligger långt norrut. Gäller från nästa show(). */
  setPlacement(placement: ToastPlacement): void {
    this.placement = placement;
  }

  /** Var rutan ligger på skärmen, eller null om den är dold. */
  bounds(): DOMRect | null {
    return this.node.classList.contains('is-visible') ? this.node.getBoundingClientRect() : null;
  }

  hide(): void {
    window.clearTimeout(this.timer);
    this.node.classList.remove('is-visible');
    // Knappen ska inte gå att nå när rutan är dold.
    this.node.replaceChildren(this.text);
  }
}
