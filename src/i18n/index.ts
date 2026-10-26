/**
 * Språket i spelet. Valet sparas på enheten (localStorage) och i en cookie som servern läser för
 * att svara på samma språk; är spelaren inloggad sparas det också på kontot (se api/account.ts).
 * Första gången väljs svenska om webbläsaren är inställd på svenska, annars engelska.
 */
import { COUNTY_NAMES_EN, LANG_COOKIE, PROVINCE_NAMES_EN, isLang, type Lang } from '../shared/i18n';
import type { County } from '../data/counties';
import type { Province } from '../data/provinces';
import type { Municipality } from '../data/municipalities';
import { IS_STAGING } from '../environment';
import { en } from './en';
import { sv, type Messages } from './sv';

const STORAGE_KEY = 'sverigespelet.lang.v1';

function stored(): Lang | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isLang(value) ? value : null;
  } catch {
    return null;
  }
}

function fromBrowser(): Lang {
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  return langs.some((l) => /^sv\b/i.test(l ?? '')) ? 'sv' : 'en';
}

let current: Lang = stored() ?? fromBrowser();
const listeners = new Set<(lang: Lang) => void>();

export function lang(): Lang {
  return current;
}

/** Texterna på det valda språket. */
export function t(): Messages {
  return current === 'en' ? en : sv;
}

/** Byter språk, sparar valet och meddelar dem som lyssnar (t.ex. för att rita om skärmen). */
export function setLang(next: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* privat läge – valet gäller tills sidan stängs */
  }
  if (next === current) return;
  current = next;
  applyToDocument();
  for (const fn of listeners) fn(next);
}

export function onLangChange(fn: (lang: Lang) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Sidans språk, titel och beskrivning, samt cookien som servern läser. */
export function applyToDocument(): void {
  document.documentElement.lang = current;
  document.title = IS_STAGING ? `[Staging] ${t().meta.title}` : t().meta.title;
  const banner = document.getElementById('staging-banner');
  if (banner) banner.textContent = t().meta.staging;
  document.querySelector('meta[name="description"]')?.setAttribute('content', t().meta.description);
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${LANG_COOKIE}=${current}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

export function countyName(county: County): string {
  return current === 'en' ? (COUNTY_NAMES_EN[county.code] ?? county.name) : county.name;
}

export function municipalityName(municipality: Municipality): string {
  return current === 'en' ? municipality.nameEn : municipality.name;
}

export function provinceName(province: Province): string {
  return current === 'en' ? (PROVINCE_NAMES_EN[province.code] ?? province.name) : province.name;
}
