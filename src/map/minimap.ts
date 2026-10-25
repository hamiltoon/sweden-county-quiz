import { geoPath, geoTransverseMercator, type GeoPermissibleObjects } from 'd3-geo';
import { create } from 'd3-selection';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { CountyProps, LakeProps, ResultState } from './map';
import { ensureResultPatterns } from './patterns';

export interface MiniMapOptions {
  /** Topologin med länen (eller landskapen, se objectName). */
  counties: Topology;
  /** Namnet på objektet i topologin: "lan" (standard) eller "landskap". */
  objectName?: string;
  lakes?: Topology | null;
  width: number;
  height: number;
  /** Färg per län efter hur frågan gick. Län som saknas visas neutrala. */
  countyResults?: ReadonlyMap<string, ResultState>;
  /** Färg per sjö efter hur frågan gick. */
  lakeResults?: ReadonlyMap<string, ResultState>;
  /** Städer som prickar, färgade efter hur frågan gick. */
  points?: readonly { lon: number; lat: number; state: ResultState }[];
  className?: string;
  /** Beskrivning för skärmläsare. Utan den döljs kartan för skärmläsare (ren dekoration). */
  label?: string;
}

/** En liten, statisk Sverigekarta (ingen zoom, inga klick), t.ex. som dekoration eller sammanfattning. */
export function renderMiniMap(opts: MiniMapOptions): SVGSVGElement {
  ensureResultPatterns();
  const { counties, lakes, width, height } = opts;
  const countyFeatures = (feature(counties, counties.objects[opts.objectName ?? 'lan'] as GeometryCollection<CountyProps>) as FeatureCollection<Geometry, CountyProps>)
    .features;
  const lakeFeatures = lakes
    ? ((feature(lakes, lakes.objects.sjoar as GeometryCollection<LakeProps>) as FeatureCollection<Geometry, LakeProps>).features)
    : [];

  const projection = geoTransverseMercator()
    .rotate([-15, 0])
    .fitSize([width, height], { type: 'FeatureCollection', features: countyFeatures } as GeoPermissibleObjects);
  const path = geoPath(projection);

  const svg = create('svg')
    .attr('class', `mini-map ${opts.className ?? ''}`.trim())
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('width', width)
    .attr('height', height);
  if (opts.label) svg.attr('role', 'img').attr('aria-label', opts.label);
  else svg.attr('aria-hidden', 'true');

  svg
    .append('g')
    .selectAll('path')
    .data(countyFeatures)
    .join('path')
    .attr('class', 'mini-county')
    .attr('data-result', (d: Feature<Geometry, CountyProps>) => opts.countyResults?.get(d.properties.code) ?? null)
    .attr('d', (d) => path(d));

  svg
    .append('g')
    .selectAll('path')
    .data(lakeFeatures)
    .join('path')
    .attr('class', 'mini-lake')
    .attr('data-result', (d: Feature<Geometry, LakeProps>) => opts.lakeResults?.get(d.properties.id) ?? null)
    .attr('d', (d) => path(d));

  svg
    .append('g')
    .selectAll('circle')
    .data(opts.points ?? [])
    .join('circle')
    .attr('class', 'mini-point')
    .attr('data-result', (d) => d.state)
    .attr('r', 3.2)
    .attr('cx', (d) => projection([d.lon, d.lat])?.[0] ?? 0)
    .attr('cy', (d) => projection([d.lon, d.lat])?.[1] ?? 0);

  return svg.node()!;
}
