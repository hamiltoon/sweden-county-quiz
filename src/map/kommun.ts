/**
 * Kommunkartan: hur långt man kan zooma in, och att ett tryck på en kommun som är för liten för
 * fingret förstorar kartan i stället för att räknas (PO-16). Spelaren får en kort förklaring de
 * första gångerna det händer.
 */
import type { MapOptions } from './map';

/** Sundbyberg och Öckerö behöver mycket zoom. */
const KOMMUN_MAX_ZOOM = 40;
const HINT_KEY = 'sverigespelet.magnifyHints.v1';
/** Så många gånger per enhet visas förklaringen. */
const HINT_TIMES = 3;

export function kommunMapOptions(): Pick<MapOptions, 'maxZoom' | 'magnifySmall'> {
  return { maxZoom: KOMMUN_MAX_ZOOM, magnifySmall: true };
}

/** Ska förklaringen visas den här gången? Räknar upp; utan lagring visas den varje gång. */
export function takeMagnifyHint(): boolean {
  try {
    const shown = Number(localStorage.getItem(HINT_KEY) ?? '0') || 0;
    if (shown >= HINT_TIMES) return false;
    localStorage.setItem(HINT_KEY, String(shown + 1));
  } catch {
    /* utan lagring */
  }
  return true;
}
