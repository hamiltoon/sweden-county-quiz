"""Skriver src/data/municipalities.ts från scripts/kommuner/kommuner.json.

Användning: python3 write_data.py <kommuner.json> <ut.ts>
"""
import json
import sys

kommuner = json.load(open(sys.argv[1]))
def quote(text):
    assert "'" not in text and '\\' not in text, text
    return f"'{text}'"


rows = '\n'.join(
    f"  {{ code: {quote(k['code'])}, name: {quote(k['name'])}, nameEn: {quote(k['nameEn'])}, county: {quote(k['county'])} }},"
    for k in kommuner
)
open(sys.argv[2], 'w').write(f"""/**
 * Sveriges {len(kommuner)} kommuner med kommunkod (SCB), namn på svenska och engelska och län.
 *
 * Genererad av scripts/build-kommuner.sh från scripts/kommuner/kommuner.json – ändra där, inte här.
 * Geometrin ligger i public/data/kommuner.topo.json (objektet "kommuner"); `code` matchar
 * egenskapen `code` där.
 */
export interface Municipality {{
  /** Kommunkod, t.ex. "0180" */
  code: string;
  /** Kommunens namn, t.ex. "Stockholms kommun" */
  name: string;
  /** Engelskt namn, t.ex. "Stockholm Municipality" */
  nameEn: string;
  /** Länsbokstav, t.ex. "AB" */
  county: string;
}}

export const MUNICIPALITIES: readonly Municipality[] = [
{rows}
];

export const MUNICIPALITY_BY_CODE: ReadonlyMap<string, Municipality> = new Map(MUNICIPALITIES.map((m) => [m.code, m]));
""")
