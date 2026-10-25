/** QR-kod som SVG, ritad i telefonen (ingen tjänst på nätet ser länken). */
import qrcode from 'qrcode-generator';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Tyst zon runt koden, i moduler. Standarden kräver fyra. */
const QUIET = 4;

export function renderQr(text: string, label: string): SVGSVGElement {
  // Felkorrigering M klarar en repa eller ett finger över koden utan att bli onödigt tät.
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  let d = '';
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (qr.isDark(row, col)) d += `M${col + QUIET} ${row + QUIET}h1v1h-1z`;
    }
  }
  const size = n + 2 * QUIET;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('class', 'qr');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', label);
  svg.setAttribute('shape-rendering', 'crispEdges');
  const bg = document.createElementNS(SVG_NS, 'rect');
  bg.setAttribute('width', String(size));
  bg.setAttribute('height', String(size));
  bg.setAttribute('fill', '#fff');
  const modules = document.createElementNS(SVG_NS, 'path');
  modules.setAttribute('d', d);
  modules.setAttribute('fill', '#000');
  svg.append(bg, modules);
  return svg;
}
