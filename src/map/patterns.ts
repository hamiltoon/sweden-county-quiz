/**
 * Streckmönstret för missade områden och sjöar. Det gör att missat skiljer sig från rätt även för
 * den som inte ser skillnad på rött och grönt. Mönstren läggs en gång i dokumentet och används av
 * alla kartor med fill: url(#…) i CSS; färgerna sätts där, så att de följer ljust och mörkt läge.
 */
const SVG_NS = 'http://www.w3.org/2000/svg';

/** Id:n som CSS refererar till: den stora kartan och minikartan (som är mycket mindre). */
const PATTERNS = [
  { id: 'hatch-missed', size: 6, line: 2.2 },
  { id: 'hatch-missed-mini', size: 3, line: 1.1 },
];

let added = false;

export function ensureResultPatterns(): void {
  if (added || typeof document === 'undefined') return;
  added = true;
  const svg = document.createElementNS(SVG_NS, 'svg');
  // Inte display: none, då ritar vissa webbläsare inte mönstret.
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute';
  const defs = document.createElementNS(SVG_NS, 'defs');
  for (const { id, size, line } of PATTERNS) {
    const pattern = document.createElementNS(SVG_NS, 'pattern');
    pattern.setAttribute('id', id);
    pattern.setAttribute('patternUnits', 'userSpaceOnUse');
    pattern.setAttribute('width', String(size));
    pattern.setAttribute('height', String(size));
    pattern.setAttribute('patternTransform', 'rotate(45)');
    const bg = document.createElementNS(SVG_NS, 'rect');
    bg.setAttribute('class', 'hatch-bg');
    bg.setAttribute('width', String(size));
    bg.setAttribute('height', String(size));
    const stripe = document.createElementNS(SVG_NS, 'rect');
    stripe.setAttribute('class', 'hatch-line');
    stripe.setAttribute('width', String(line));
    stripe.setAttribute('height', String(size));
    pattern.append(bg, stripe);
    defs.append(pattern);
  }
  svg.append(defs);
  document.body.append(svg);
}
