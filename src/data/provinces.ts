/**
 * Sveriges 25 landskap, grupperade efter landsdel (Götaland, Svealand, Norrland).
 *
 * Geometrin ligger i public/data/landskap.topo.json (objektet "landskap"), byggd av
 * scripts/build-landskap.sh från OpenStreetMap. `code` matchar egenskapen `code` där.
 */
export interface Province {
  /** Stabilt id utan å/ä/ö, t.ex. "halsingland" */
  code: string;
  /** Landskapets namn, t.ex. "Hälsingland" */
  name: string;
}

export const PROVINCES: readonly Province[] = [
  { code: 'skane', name: 'Skåne' },
  { code: 'blekinge', name: 'Blekinge' },
  { code: 'halland', name: 'Halland' },
  { code: 'smaland', name: 'Småland' },
  { code: 'oland', name: 'Öland' },
  { code: 'gotland', name: 'Gotland' },
  { code: 'ostergotland', name: 'Östergötland' },
  { code: 'vastergotland', name: 'Västergötland' },
  { code: 'bohuslan', name: 'Bohuslän' },
  { code: 'dalsland', name: 'Dalsland' },
  { code: 'sodermanland', name: 'Södermanland' },
  { code: 'uppland', name: 'Uppland' },
  { code: 'vastmanland', name: 'Västmanland' },
  { code: 'narke', name: 'Närke' },
  { code: 'varmland', name: 'Värmland' },
  { code: 'dalarna', name: 'Dalarna' },
  { code: 'gastrikland', name: 'Gästrikland' },
  { code: 'halsingland', name: 'Hälsingland' },
  { code: 'harjedalen', name: 'Härjedalen' },
  { code: 'medelpad', name: 'Medelpad' },
  { code: 'jamtland', name: 'Jämtland' },
  { code: 'angermanland', name: 'Ångermanland' },
  { code: 'vasterbotten', name: 'Västerbotten' },
  { code: 'norrbotten', name: 'Norrbotten' },
  { code: 'lappland', name: 'Lappland' },
];

export const PROVINCE_BY_CODE: ReadonlyMap<string, Province> = new Map(PROVINCES.map((p) => [p.code, p]));
