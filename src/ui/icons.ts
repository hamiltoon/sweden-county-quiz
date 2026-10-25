import type { Mode } from '../game/game';

/** Enkla linjeikoner (24×24, ritade för spelet) som ärver textfärgen. */
const PATHS: Record<Mode, string> = {
  // Län: en vikt karta.
  lan: '<path d="M3 6.5l6-2.5 6 2.5 6-2.5v13.5l-6 2.5-6-2.5-6 2.5z"/><path d="M9 4v13.5"/><path d="M15 6.5V20"/>',
  // Landskap: ett landskap med berg och sol.
  landskap: '<path d="M2.5 19.5l6.5-10 4 6 2.5-3.5 6 7.5z"/><circle cx="17" cy="6.5" r="2"/>',
  // Kommuner: en karta indelad i många små områden.
  kommun: '<path d="M4 4h7v6H4z"/><path d="M13 4h7v4h-7z"/><path d="M13 10h7v10h-7z"/><path d="M4 12h7v8H4z"/>',
  // Fler städer: hus i olika höjd.
  ort: '<path d="M3 21h18"/><path d="M4.5 21V11l4-2.5V21"/><path d="M8.5 21V5l7 3v13"/><path d="M15.5 21v-8l4 2v6"/><path d="M11 10.5h2M11 14h2M11 17.5h2"/>',
  // En kartnål för residensstaden.
  stad: '<path d="M12 21.5s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10.5" r="2.3"/>',
  // Vågor för sjöarna.
  sjo: '<path d="M3 8.5c1.5 0 1.5-1.5 3-1.5s1.5 1.5 3 1.5 1.5-1.5 3-1.5 1.5 1.5 3 1.5 1.5-1.5 3-1.5 1.5 1.5 3 1.5"/><path d="M3 13.5c1.5 0 1.5-1.5 3-1.5s1.5 1.5 3 1.5 1.5-1.5 3-1.5 1.5 1.5 3 1.5 1.5-1.5 3-1.5 1.5 1.5 3 1.5"/><path d="M3 18.5c1.5 0 1.5-1.5 3-1.5s1.5 1.5 3 1.5 1.5-1.5 3-1.5 1.5 1.5 3 1.5 1.5-1.5 3-1.5 1.5 1.5 3 1.5"/>',
  // Två korsade pilar för blandat.
  blandat: '<path d="M3.5 7h3c2 0 3 1.2 4.5 3.6S14 17 17 17h3.5"/><path d="M17.5 14l3 3-3 3"/><path d="M3.5 17h3c1.3 0 2.2-.5 3-1.3"/><path d="M14 8.3c.8-.8 1.7-1.3 3-1.3h3.5"/><path d="M17.5 4l3 3-3 3"/>',
};

// Live: två spelare och en blixt.
const LIVE_PATH =
  '<circle cx="7.5" cy="8" r="2.6"/><path d="M3 18.5c.4-2.8 2.2-4.5 4.5-4.5s4.1 1.7 4.5 4.5"/><circle cx="16.5" cy="8" r="2.6"/><path d="M14.6 14.4c.6-.3 1.2-.4 1.9-.4 2.3 0 4.1 1.7 4.5 4.5"/>';

export function modeIcon(mode: Mode | 'live'): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = 'mode-icon';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${mode === 'live' ? LIVE_PATH : PATHS[mode]}</svg>`;
  return span;
}
