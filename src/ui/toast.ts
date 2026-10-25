import { el } from './dom';

export type ToastKind = 'ok' | 'bad' | 'info';
/** Överst täcker toasten Norrland, nederst Skåne. Välj den sida där svaren inte ligger. */
export type ToastPlacement = 'top' | 'bottom';

/** En liten icke-blockerande feedback-ruta över kartan. */
export class Toast {
  private readonly node: HTMLDivElement;
  private timer: number | undefined;

  constructor(
    parent: HTMLElement,
    private readonly placement: ToastPlacement = 'top',
  ) {
    this.node = el('div', { class: `toast toast-${placement}`, role: 'status', 'aria-live': 'polite' });
    parent.append(this.node);
  }

  show(message: string, kind: ToastKind, durationMs: number): void {
    window.clearTimeout(this.timer);
    this.node.textContent = message;
    this.node.className = `toast toast-${this.placement} toast-${kind} is-visible`;
    if (durationMs > 0) this.timer = window.setTimeout(() => this.hide(), durationMs);
  }

  hide(): void {
    window.clearTimeout(this.timer);
    this.node.classList.remove('is-visible');
  }
}
