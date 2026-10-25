/** Kartfilerna och vilken karta varje läge ritar. */
import type { Mode } from '../game/game';

export const COUNTIES_URL = '/data/lan.topo.json';
export const PROVINCES_URL = '/data/landskap.topo.json';
export const MUNICIPALITIES_URL = '/data/kommuner.topo.json';
export const LAKES_URL = '/data/sjoar.topo.json';
export const NEIGHBORS_URL = '/data/grannar.topo.json';

export interface RegionSource {
  url: string;
  /** Objektet i topologin. */
  objectName: string;
  /** Egenskap att rita tjockare gränser mellan (länsgränserna på kommunkartan). */
  groupBy?: string;
}

/**
 * Landskaps- och kommunläget ritar landskapen eller kommunerna i stället för länen; resten av
 * kartan är densamma. På kommunkartan ritas länsgränserna tjockare, som stöd.
 */
export function regionsFor(mode: Mode): RegionSource {
  if (mode === 'landskap') return { url: PROVINCES_URL, objectName: 'landskap' };
  if (mode === 'kommun') return { url: MUNICIPALITIES_URL, objectName: 'kommuner', groupBy: 'county' };
  return { url: COUNTIES_URL, objectName: 'lan' };
}
