/**
 * Sveriges 21 län med länsbokstav och residensstad.
 * Koordinaterna (WGS84) pekar på stadens centrum.
 */
export interface County {
  /** Länsbokstav, t.ex. "AB" */
  code: string;
  /** Länets namn, t.ex. "Stockholms län" */
  name: string;
  /** Residensstad */
  city: string;
  /** Latitud för residensstaden (grader) */
  lat: number;
  /** Longitud för residensstaden (grader) */
  lon: number;
}

export const COUNTIES: readonly County[] = [
  { code: 'AB', name: 'Stockholms län', city: 'Stockholm', lat: 59.3293, lon: 18.0686 },
  { code: 'C', name: 'Uppsala län', city: 'Uppsala', lat: 59.8586, lon: 17.6389 },
  { code: 'D', name: 'Södermanlands län', city: 'Nyköping', lat: 58.753, lon: 17.0079 },
  { code: 'E', name: 'Östergötlands län', city: 'Linköping', lat: 58.4108, lon: 15.6214 },
  { code: 'F', name: 'Jönköpings län', city: 'Jönköping', lat: 57.7826, lon: 14.1618 },
  { code: 'G', name: 'Kronobergs län', city: 'Växjö', lat: 56.8777, lon: 14.8091 },
  { code: 'H', name: 'Kalmar län', city: 'Kalmar', lat: 56.6634, lon: 16.3566 },
  { code: 'I', name: 'Gotlands län', city: 'Visby', lat: 57.6348, lon: 18.2948 },
  { code: 'K', name: 'Blekinge län', city: 'Karlskrona', lat: 56.1612, lon: 15.5869 },
  { code: 'M', name: 'Skåne län', city: 'Malmö', lat: 55.605, lon: 13.0038 },
  { code: 'N', name: 'Hallands län', city: 'Halmstad', lat: 56.6745, lon: 12.8568 },
  { code: 'O', name: 'Västra Götalands län', city: 'Göteborg', lat: 57.7089, lon: 11.9746 },
  { code: 'S', name: 'Värmlands län', city: 'Karlstad', lat: 59.3793, lon: 13.5036 },
  { code: 'T', name: 'Örebro län', city: 'Örebro', lat: 59.2753, lon: 15.2134 },
  { code: 'U', name: 'Västmanlands län', city: 'Västerås', lat: 59.6099, lon: 16.5448 },
  { code: 'W', name: 'Dalarnas län', city: 'Falun', lat: 60.6065, lon: 15.6355 },
  { code: 'X', name: 'Gävleborgs län', city: 'Gävle', lat: 60.6749, lon: 17.1413 },
  { code: 'Y', name: 'Västernorrlands län', city: 'Härnösand', lat: 62.6323, lon: 17.9379 },
  { code: 'Z', name: 'Jämtlands län', city: 'Östersund', lat: 63.1792, lon: 14.6357 },
  { code: 'AC', name: 'Västerbottens län', city: 'Umeå', lat: 63.8258, lon: 20.263 },
  { code: 'BD', name: 'Norrbottens län', city: 'Luleå', lat: 65.5848, lon: 22.1547 },
];

export const COUNTY_BY_CODE: ReadonlyMap<string, County> = new Map(COUNTIES.map((c) => [c.code, c]));
