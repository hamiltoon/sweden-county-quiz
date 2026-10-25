/**
 * Språken spelet finns på, delat mellan spelet och Worker-scriptet. Spelet sparar valet i en
 * cookie så att servern kan svara med felmeddelanden på samma språk.
 */
export type Lang = 'sv' | 'en';
export const LANGS: readonly Lang[] = ['sv', 'en'];
export const LANG_NAMES: Record<Lang, string> = { sv: 'Svenska', en: 'English' };
export const LANG_COOKIE = 'lang';

export function isLang(value: unknown): value is Lang {
  return value === 'sv' || value === 'en';
}

/** Länens officiella engelska namn. */
export const COUNTY_NAMES_EN: Readonly<Record<string, string>> = {
  AB: 'Stockholm County',
  C: 'Uppsala County',
  D: 'Södermanland County',
  E: 'Östergötland County',
  F: 'Jönköping County',
  G: 'Kronoberg County',
  H: 'Kalmar County',
  I: 'Gotland County',
  K: 'Blekinge County',
  M: 'Skåne County',
  N: 'Halland County',
  O: 'Västra Götaland County',
  S: 'Värmland County',
  T: 'Örebro County',
  U: 'Västmanland County',
  W: 'Dalarna County',
  X: 'Gävleborg County',
  Y: 'Västernorrland County',
  Z: 'Jämtland County',
  AC: 'Västerbotten County',
  BD: 'Norrbotten County',
};

/** Landskapen heter som på svenska på engelska, utom Lappland. */
export const PROVINCE_NAMES_EN: Readonly<Record<string, string>> = {
  lappland: 'Lapland',
};
