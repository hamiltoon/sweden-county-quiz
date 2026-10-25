/**
 * Sveriges tio största sjöar, i storleksordning.
 *
 * Rangordningen följer SMHI:s sjöregister ("Sveriges sjöar"), via
 * https://sv.wikipedia.org/wiki/Lista_över_Sveriges_största_sjöar. Hornavan, Akkajaure och
 * Uddjaure är reglerade, så deras yta varierar med vattenståndet.
 *
 * Geometrin ligger i public/data/sjoar.topo.json (objektet "sjoar"), byggd av
 * scripts/build-geodata.sh. `id` matchar egenskapen `id` där.
 */
export interface Lake {
  /** Stabilt id utan å/ä/ö, t.ex. "vattern" */
  id: string;
  /** Sjöns namn, t.ex. "Vättern" */
  name: string;
  /** Plats i storleksordning, 1 = störst */
  rank: number;
}

export const LAKES: readonly Lake[] = [
  { id: 'vanern', name: 'Vänern', rank: 1 },
  { id: 'vattern', name: 'Vättern', rank: 2 },
  { id: 'malaren', name: 'Mälaren', rank: 3 },
  { id: 'hjalmaren', name: 'Hjälmaren', rank: 4 },
  { id: 'storsjon', name: 'Storsjön', rank: 5 },
  { id: 'tornetrask', name: 'Torneträsk', rank: 6 },
  { id: 'siljan', name: 'Siljan', rank: 7 },
  { id: 'hornavan', name: 'Hornavan', rank: 8 },
  { id: 'akkajaure', name: 'Akkajaure', rank: 9 },
  { id: 'uddjaure', name: 'Uddjaure', rank: 10 },
];

export const LAKE_BY_ID: ReadonlyMap<string, Lake> = new Map(LAKES.map((l) => [l.id, l]));

