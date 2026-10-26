/**
 * PO-16: tre sätt att göra de små kommunerna träffbara, som prövas på staging innan ett väljs.
 * Varianten väljs med ?v=a, ?v=b eller ?v=c i adressen och sparas på enheten, så att den gäller
 * också i live-länkar och efter en omladdning. Standard är A.
 *
 *   A  Kartan zoomar in på länet vid varje kommunfråga, och man kan zooma längre in själv.
 *   B  A, plus större osynliga träffytor runt de kommuner som är för små på skärmen.
 *   C  A, men ett tryck på en för liten kommun förstorar runt trycket i stället för att räknas som svar.
 */
import type { MapOptions } from '../map/map';

export type KommunVariant = 'a' | 'b' | 'c';

const STORAGE_KEY = 'sverigespelet.variant.v1';
const isVariant = (v: unknown): v is KommunVariant => v === 'a' || v === 'b' || v === 'c';

function read(): KommunVariant {
  const fromUrl = new URLSearchParams(location.search).get('v');
  try {
    if (isVariant(fromUrl)) localStorage.setItem(STORAGE_KEY, fromUrl);
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isVariant(stored)) return stored;
  } catch {
    /* utan lagring gäller adressen */
  }
  return isVariant(fromUrl) ? fromUrl : 'a';
}

export const KOMMUN_VARIANT = read();

/** Hur långt man kan zooma in på kommunkartan: Sundbyberg och Öckerö behöver mycket. */
const KOMMUN_MAX_ZOOM = 40;

/** Kartinställningarna för kommunkartan i den valda varianten. */
export function kommunMapOptions(): Pick<MapOptions, 'maxZoom' | 'smallTargets' | 'magnifySmall'> {
  return {
    maxZoom: KOMMUN_MAX_ZOOM,
    smallTargets: KOMMUN_VARIANT === 'b',
    magnifySmall: KOMMUN_VARIANT === 'c',
  };
}
