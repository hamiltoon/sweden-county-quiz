import { geoCentroid, geoPath, geoTransverseMercator, type GeoPermissibleObjects, type GeoProjection } from 'd3-geo';
import { pointer, select, type Selection } from 'd3-selection';
import 'd3-transition';
import { zoom, zoomIdentity, type D3ZoomEvent, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import { feature, merge } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson';

export interface CountyProps {
  code: string;
  name: string;
}

export type CountyFeature = Feature<Geometry, CountyProps>;

export interface LakeProps {
  id: string;
  name: string;
}

export type LakeFeature = Feature<Polygon | MultiPolygon, LakeProps>;

export interface MapOptions {
  /** Namnet på länsobjektet i topologin. */
  objectName?: string;
  /** Topologi med objektet "sjoar". Utan den ritas inga sjöar. */
  lakes?: Topology | null;
  /** Topologi med objektet "grannar" (grannländerna). Utan den ritas bara Sverige. */
  neighbors?: Topology | null;
  /**
   * Sjöläge: sjöarna går att klicka på, och en sjös namn visas först med showLakeLabel().
   * Annars är sjöarna bara riktmärken utan namn, och klicken går igenom till länen.
   */
  lakeMode?: boolean;
}

/** `picked`: spelarens svar i live-läget, innan rätt svar visas. */
export type HighlightState = 'correct' | 'wrong' | 'reveal' | 'picked';
/** Hur det gick för en fråga: rätt direkt, rätt efter fler försök eller missad. */
export type ResultState = 'first' | 'later' | 'missed';
export type MarkerKind = 'correct' | 'wrong' | 'reveal';

export interface MapClick {
  /** Länskod som träffades, eller null om klicket hamnade utanför alla län (eller på en sjö i sjöläget). */
  code: string | null;
  /** Sjö-id som träffades (bara i sjöläget), annars null. */
  lake: string | null;
  lon: number;
  lat: number;
}

interface Marker {
  lon: number;
  lat: number;
  kind: MarkerKind;
  label?: string;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 10;
const PADDING = 8;
/** Län och landskap som är så små på skärmen att de får en extra osynlig träffyta. */
const SMALL_COUNTIES: ReadonlySet<string> = new Set(['K', 'I', 'blekinge', 'oland']);
/** Hur mycket av vyn ett län eller en sjö fyller när rätt svar visas, och hur långt in det zoomas som mest. */
const REVEAL_FILL = 0.35;
const REVEAL_MAX_ZOOM = 4;
const REVEAL_MIN_ZOOM = 1.3;
/** Teckenstorlek och konturbredd (px på skärmen) för sjönamnen. */
const LAKE_LABEL_PX = 11;
const LAKE_LABEL_HALO_PX = 2.5;

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const overlaps = (a: Box, b: Box): boolean => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

/**
 * SVG-karta över Sveriges län med d3-geo-projektion och pinch-zoom/pan via d3-zoom.
 * Kartan är "dum": den rapporterar klick och kan markera län/punkter, men vet inget om spelet.
 */
export class SwedenMap {
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly root: Selection<SVGGElement, unknown, null, undefined>;
  private readonly coastG: Selection<SVGGElement, unknown, null, undefined>;
  private readonly neighborsG: Selection<SVGGElement, unknown, null, undefined>;
  private readonly countiesG: Selection<SVGGElement, unknown, null, undefined>;
  private readonly hitG: Selection<SVGGElement, unknown, null, undefined>;
  private readonly lakeHitG: Selection<SVGGElement, unknown, null, undefined>;
  private readonly lakesG: Selection<SVGGElement, unknown, null, undefined>;
  private readonly lakeLabelsG: Selection<SVGGElement, unknown, null, undefined>;
  private readonly resultDotsG: Selection<SVGGElement, unknown, null, undefined>;
  private readonly markersG: Selection<SVGGElement, unknown, null, undefined>;
  private readonly zoomBehavior: ZoomBehavior<SVGSVGElement, unknown>;
  private readonly projection: GeoProjection;
  private readonly path = geoPath();
  private readonly features: CountyFeature[];
  private readonly collection: FeatureCollection<Geometry, CountyProps>;
  private readonly lakeFeatures: LakeFeature[];
  private readonly neighborFeatures: Feature<Geometry>[];
  /** Sveriges yttre kontur (alla län sammanslagna), för kustglöden. */
  private readonly swedenOutline: Geometry;
  private readonly lakeMode: boolean;
  private markers: Marker[] = [];
  /** Städer som besvarats under omgången, färgade efter hur det gick (ligger kvar hela omgången). */
  private resultDots: { lon: number; lat: number; state: ResultState }[] = [];
  private width = 0;
  private height = 0;
  private k = 1;
  private transform: ZoomTransform = zoomIdentity;
  private interactive = true;
  private readonly resizeObserver: ResizeObserver;

  onClick: ((click: MapClick) => void) | null = null;

  constructor(
    private readonly container: HTMLElement,
    topology: Topology,
    { objectName = 'lan', lakes = null, neighbors = null, lakeMode = false }: MapOptions = {},
  ) {
    const obj = topology.objects[objectName] as GeometryCollection<CountyProps>;
    if (!obj) throw new Error(`TopoJSON saknar objektet "${objectName}"`);
    this.collection = feature(topology, obj) as FeatureCollection<Geometry, CountyProps>;
    this.features = this.collection.features;
    const lakeObj = lakes?.objects.sjoar as GeometryCollection<LakeProps> | undefined;
    if (lakes && !lakeObj) throw new Error('TopoJSON saknar objektet "sjoar"');
    this.lakeFeatures = lakes && lakeObj ? ((feature(lakes, lakeObj) as FeatureCollection).features as LakeFeature[]) : [];
    this.lakeMode = lakeMode;
    // Länen är polygoner; merge() vill ha den typen uttryckligen.
    this.swedenOutline = merge(topology, obj.geometries as Parameters<typeof merge>[1]);
    const neighborObj = neighbors?.objects.grannar as GeometryCollection | undefined;
    this.neighborFeatures = neighbors && neighborObj ? (feature(neighbors, neighborObj) as FeatureCollection).features : [];

    // Transversal Mercator centrerad på lon 15°E passar ett avlångt land som Sverige bra.
    this.projection = geoTransverseMercator().rotate([-15, 0]);
    this.path.projection(this.projection);

    this.svg = select(container)
      .append('svg')
      .attr('class', 'map-svg')
      .classed('is-lake-mode', lakeMode)
      .attr('role', 'img')
      .attr('aria-label', this.lakeFeatures.length ? 'Karta över Sveriges län och största sjöar' : 'Karta över Sveriges län');
    this.root = this.svg.append('g').attr('class', 'map-root');
    // Underst: en ljus glöd längs alla kuster, sedan grannländerna som bakgrund. Ingen av dem tar emot klick.
    this.coastG = this.root.append('g').attr('class', 'coast');
    this.neighborsG = this.root.append('g').attr('class', 'neighbors');
    this.countiesG = this.root.append('g').attr('class', 'counties');
    this.hitG = this.root.append('g').attr('class', 'county-hits');
    // Sjöarnas träffytor ligger under själva sjöarna, så att ett klick inne i en sjö alltid
    // träffar den sjön och aldrig grannsjöns träffyta.
    this.lakeHitG = this.root.append('g').attr('class', 'lake-hits');
    this.lakesG = this.root.append('g').attr('class', 'lakes');
    this.lakeLabelsG = this.root.append('g').attr('class', 'lake-labels');
    this.resultDotsG = this.root.append('g').attr('class', 'result-dots');
    this.markersG = this.root.append('g').attr('class', 'markers');

    this.coastG
      .selectAll('path')
      .data<Feature<Geometry> | Geometry>([this.swedenOutline, ...this.neighborFeatures])
      .join('path')
      .attr('class', 'coast-glow');

    this.neighborsG
      .selectAll('path')
      .data(this.neighborFeatures)
      .join('path')
      .attr('class', 'neighbor');

    this.countiesG
      .selectAll('path')
      .data(this.features)
      .join('path')
      .attr('class', 'county')
      .attr('data-code', (d) => d.properties.code);

    // Osynliga "träffhalos" runt de minsta länen så de går att träffa med fingret utan zoom.
    this.hitG
      .selectAll('path')
      .data(this.features.filter((d) => SMALL_COUNTIES.has(d.properties.code)))
      .join('path')
      .attr('class', 'county-hit')
      .attr('data-code', (d) => d.properties.code);

    this.lakesG
      .selectAll('path')
      .data(this.lakeFeatures)
      .join('path')
      .attr('class', 'lake')
      .attr('data-lake', (d) => d.properties.id);

    // Osynliga träffhalos runt sjöarna i sjöläget: smala sjöar som Hjälmaren är svåra att träffa annars.
    if (lakeMode) {
      this.lakeHitG
        .selectAll('path')
        .data(this.lakeFeatures)
        .join('path')
        .attr('class', 'lake-hit')
        .attr('data-lake', (d) => d.properties.id);
    }

    // Sjönamn finns bara i sjöläget, där de visar svaret. Som riktmärken visas sjöarna utan namn.
    if (lakeMode) {
      this.lakeLabelsG
        .selectAll('text')
        .data(this.lakeFeatures)
        .join('text')
        .attr('class', 'lake-label')
        .attr('data-lake', (d) => d.properties.id)
        .text((d) => d.properties.name);
    }

    this.zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([MIN_ZOOM, MAX_ZOOM])
      .filter((event: Event) => this.interactive && defaultZoomFilter(event))
      .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        this.k = event.transform.k;
        this.transform = event.transform;
        this.root.attr('transform', event.transform.toString());
        this.svg.classed('is-zoomed', this.k > 1.01);
        this.renderMarkers();
        this.renderResultDots();
        this.renderLakeLabels();
      });

    this.svg.call(this.zoomBehavior).on('dblclick.zoom', null);
    this.svg.on('click', (event: MouseEvent) => this.handleClick(event));

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  /** Anpassar projektionen till containerns storlek. */
  resize(): void {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    this.svg.attr('viewBox', `0 0 ${w} ${h}`).attr('width', w).attr('height', h);
    this.projection.fitExtent(
      [
        [PADDING, PADDING],
        [w - PADDING, h - PADDING],
      ],
      this.collection as GeoPermissibleObjects,
    );
    this.coastG.selectAll<SVGPathElement, Feature<Geometry> | Geometry>('path').attr('d', (d) => this.path(d));
    this.neighborsG.selectAll<SVGPathElement, Feature<Geometry>>('path').attr('d', (d) => this.path(d));
    this.countiesG.selectAll<SVGPathElement, CountyFeature>('path').attr('d', (d) => this.path(d));
    this.hitG.selectAll<SVGPathElement, CountyFeature>('path').attr('d', (d) => this.path(d));
    this.lakesG.selectAll<SVGPathElement, LakeFeature>('path').attr('d', (d) => this.path(d));
    this.lakeHitG.selectAll<SVGPathElement, LakeFeature>('path').attr('d', (d) => this.path(d));
    this.zoomBehavior.translateExtent([
      [0, 0],
      [w, h],
    ]);
    this.renderMarkers();
    this.renderResultDots();
    this.renderLakeLabels();
  }

  private handleClick(event: MouseEvent): void {
    if (!this.interactive || !this.onClick) return;
    const [x, y] = pointer(event, this.root.node());
    const lonLat = this.projection.invert?.([x, y]);
    if (!lonLat) return;
    const target = (event.target as Element | null)?.closest?.('path[data-code], path[data-lake]') as SVGPathElement | null;
    const code = target?.dataset.code ?? null;
    const lake = this.lakeMode ? (target?.dataset.lake ?? null) : null;
    this.onClick({ code, lake, lon: lonLat[0], lat: lonLat[1] });
  }

  setInteractive(on: boolean): void {
    this.interactive = on;
    this.svg.classed('is-locked', !on);
  }

  highlight(code: string, state: HighlightState): void {
    this.countiesG
      .selectAll<SVGPathElement, CountyFeature>('path')
      .filter((d) => d.properties.code === code)
      .classed(`is-${state}`, true)
      .raise();
  }

  unhighlight(code: string, state?: HighlightState): void {
    const sel = this.countiesG
      .selectAll<SVGPathElement, CountyFeature>('path')
      .filter((d) => d.properties.code === code);
    if (state) sel.classed(`is-${state}`, false);
    else sel.attr('class', 'county');
  }

  clearHighlights(): void {
    this.countiesG.selectAll('path').attr('class', 'county');
    this.lakesG.selectAll('path').attr('class', 'lake');
    this.lakeLabelsG.selectAll('text').classed('is-shown', false);
    this.renderLakeLabels();
  }

  /**
   * Färgar ett län efter hur frågan gick. Färgen sitter kvar resten av omgången, oberoende av
   * clearHighlights(), som bara tar bort de tillfälliga markeringarna.
   */
  setCountyResult(code: string, state: ResultState): void {
    this.countiesG
      .selectAll<SVGPathElement, CountyFeature>('path')
      .filter((d) => d.properties.code === code)
      .attr('data-result', state);
  }

  setLakeResult(id: string, state: ResultState): void {
    this.lakesG
      .selectAll<SVGPathElement, LakeFeature>('path')
      .filter((d) => d.properties.id === id)
      .attr('data-result', state);
  }

  /** Markerar en besvarad stad med en liten färgad prick som ligger kvar resten av omgången. */
  addResultDot(lon: number, lat: number, state: ResultState): void {
    this.resultDots.push({ lon, lat, state });
    this.renderResultDots();
  }

  private renderResultDots(): void {
    const k = this.k;
    this.resultDotsG
      .selectAll<SVGCircleElement, { lon: number; lat: number; state: ResultState }>('circle')
      .data(this.resultDots)
      .join('circle')
      .attr('class', 'result-dot')
      .attr('data-result', (d) => d.state)
      .attr('r', 4.5 / k)
      .attr('cx', (d) => this.projection([d.lon, d.lat])?.[0] ?? 0)
      .attr('cy', (d) => this.projection([d.lon, d.lat])?.[1] ?? 0);
  }

  highlightLake(id: string, state: HighlightState): void {
    this.lakesG
      .selectAll<SVGPathElement, LakeFeature>('path')
      .filter((d) => d.properties.id === id)
      .classed(`is-${state}`, true)
      .raise();
  }

  unhighlightLake(id: string, state: HighlightState): void {
    this.lakesG
      .selectAll<SVGPathElement, LakeFeature>('path')
      .filter((d) => d.properties.id === id)
      .classed(`is-${state}`, false);
  }

  /** Visar en sjös namn även i sjöläget (där namnen annars är dolda). */
  showLakeLabel(id: string): void {
    this.lakeLabelsG
      .selectAll<SVGTextElement, LakeFeature>('text')
      .filter((d) => d.properties.id === id)
      .classed('is-shown', true);
    this.renderLakeLabels();
  }

  /** Sjöns geometri (WGS84), t.ex. för att räkna avstånd till den. */
  lakeGeometry(id: string): Polygon | MultiPolygon | null {
    return this.lakeFeatures.find((d) => d.properties.id === id)?.geometry ?? null;
  }

  addMarker(lon: number, lat: number, kind: MarkerKind, label?: string): void {
    this.markers.push({ lon, lat, kind, label });
    this.renderMarkers();
  }

  clearMarkers(): void {
    this.markers = [];
    this.renderMarkers();
  }

  /** Ritar en cirkel med given radie i km runt en punkt (t.ex. träffzonen i stadsläget). */
  private renderMarkers(): void {
    const k = this.k;
    const groups = this.markersG
      .selectAll<SVGGElement, Marker>('g.marker')
      .data(this.markers)
      .join((enter) => {
        const g = enter.append('g');
        g.append('circle').attr('class', 'marker-halo');
        g.append('circle').attr('class', 'marker-dot');
        g.append('text').attr('class', 'marker-label');
        return g;
      })
      .attr('class', (d) => `marker marker-${d.kind}`)
      .attr('transform', (d) => {
        const p = this.projection([d.lon, d.lat]) ?? [0, 0];
        return `translate(${p[0]},${p[1]})`;
      });
    groups.select('circle.marker-halo').attr('r', 14 / k);
    groups.select('circle.marker-dot').attr('r', 5 / k);
    groups
      .select('text.marker-label')
      .attr('y', -18 / k)
      .attr('font-size', 14 / k)
      .text((d) => d.label ?? '');
  }

  /**
   * Placerar de sjönamn som slagits på med showLakeLabel(), med konstant skärmstorlek. Namnet hamnar
   * inne i sjön om det får plats där, annars bredvid (höger, vänster, under, över), på första stället
   * som inte täcker en annan sjö, inte krockar med ett annat namn och syns i vyn. Så hamnar inget
   * namn så att det ser ut att höra till grannsjön, och små sjöar döljs inte av sitt eget namn.
   */
  private renderLakeLabels(): void {
    const k = this.k;
    const fontSize = LAKE_LABEL_PX / k;
    const gap = 3 / k;
    const halfH = fontSize * 0.7;
    const t = this.transform;
    const view: Box = { x0: -t.x / k, y0: -t.y / k, x1: (this.width - t.x) / k, y1: (this.height - t.y) / k };
    const lakeBoxes = new Map<string, Box>(
      this.lakeFeatures.map((d) => {
        const [[x0, y0], [x1, y1]] = this.path.bounds(d);
        return [d.properties.id, { x0, y0, x1, y1 }];
      }),
    );
    const placed: Box[] = [];
    const labels = this.lakeLabelsG.selectAll<SVGTextElement, LakeFeature>('text');
    // Konturen sätts här och inte i CSS, så att den håller samma skärmbredd vid zoom.
    labels.attr('font-size', fontSize).style('stroke-width', `${LAKE_LABEL_HALO_PX / k}px`);
    labels.each((d, i, nodes) => {
      const node = nodes[i];
      const id = d.properties.id;
      if (!node.classList.contains('is-shown')) {
        node.classList.add('is-hidden');
        return;
      }
      // Uppskattad textbredd i kartans koordinater (samma enhet som path.bounds).
      const w = d.properties.name.length * fontSize * 0.62 + 4 / k;
      const own = lakeBoxes.get(id)!;
      const [cx, cy] = this.projection(geoCentroid(d)) ?? [(own.x0 + own.x1) / 2, (own.y0 + own.y1) / 2];
      const fitsInside = own.x1 - own.x0 >= w && own.y1 - own.y0 >= 2 * halfH;
      const candidates: { x: number; y: number; anchor: 'start' | 'middle' | 'end'; box: Box; inside?: boolean }[] = [];
      const at = (x: number, y: number, anchor: 'start' | 'middle' | 'end', inside = false) => {
        const x0 = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
        candidates.push({ x, y, anchor, inside, box: { x0, x1: x0 + w, y0: y - halfH, y1: y + halfH } });
      };
      if (fitsInside) at(cx, cy, 'middle', true);
      at(own.x1 + gap, cy, 'start');
      at(own.x0 - gap, cy, 'end');
      at(cx, own.y1 + halfH + gap, 'middle');
      at(cx, own.y0 - halfH - gap, 'middle');

      const free = (c: (typeof candidates)[number]) =>
        c.box.x0 >= view.x0 &&
        c.box.x1 <= view.x1 &&
        c.box.y0 >= view.y0 &&
        c.box.y1 <= view.y1 &&
        !placed.some((b) => overlaps(c.box, b)) &&
        ![...lakeBoxes].some(([other, b]) => other !== id && overlaps(c.box, b)) &&
        (c.inside || !overlaps(c.box, own));
      // Namnet visar ett svar och ska alltid synas, även om det inte finns en helt fri plats.
      const choice = candidates.find(free) ?? candidates.find((c) => c.inside) ?? candidates[0];
      node.classList.remove('is-hidden');
      node.setAttribute('x', String(choice.x));
      node.setAttribute('y', String(choice.y));
      node.style.textAnchor = choice.anchor;
      placed.push(choice.box);
    });
  }

  resetZoom(duration = 350): void {
    this.svg.transition().duration(duration).call(this.zoomBehavior.transform, zoomIdentity);
  }

  zoomBy(factor: number): void {
    this.svg.transition().duration(200).call(this.zoomBehavior.scaleBy, factor);
  }

  /** Zoomar mjukt in på ett län så att man ser var det ligger, med lite omgivning kvar. */
  focusCounty(code: string, duration = 500): void {
    const f = this.features.find((d) => d.properties.code === code);
    if (f) this.focusBounds(this.path.bounds(f), duration);
  }

  /** Zoomar mjukt in på en sjö. */
  focusLake(id: string, duration = 500): void {
    const f = this.lakeFeatures.find((d) => d.properties.id === id);
    if (f) this.focusBounds(this.path.bounds(f), duration);
  }

  /** Zoomar mjukt in kring en punkt, t.ex. en stad. */
  focusPoint(lon: number, lat: number, k = 3, duration = 500): void {
    const p = this.projection([lon, lat]);
    if (p) this.focusOn(p[0], p[1], k, duration);
  }

  private focusBounds([[x0, y0], [x1, y1]]: [[number, number], [number, number]], duration: number): void {
    const w = Math.max(x1 - x0, 1);
    const h = Math.max(y1 - y0, 1);
    const k = Math.min(REVEAL_MAX_ZOOM, REVEAL_FILL / Math.max(w / this.width, h / this.height));
    // Stora län (t.ex. Norrbotten) syns redan tydligt; då behövs ingen zoom alls.
    if (k < REVEAL_MIN_ZOOM) return;
    this.focusOn((x0 + x1) / 2, (y0 + y1) / 2, k, duration);
  }

  /**
   * Zoomar till skala k med (x, y) i mitten. zoom.transform() begränsar inte själv vyn, så
   * transformen hålls här inom kartans kanter, precis som när man nyper och drar.
   */
  private focusOn(x: number, y: number, k: number, duration: number): void {
    const target = zoomIdentity.translate(this.width / 2, this.height / 2).scale(k).translate(-x, -y);
    const viewport: [[number, number], [number, number]] = [
      [0, 0],
      [this.width, this.height],
    ];
    const t = this.zoomBehavior.constrain()(target, viewport, this.zoomBehavior.translateExtent());
    this.svg.transition().duration(duration).call(this.zoomBehavior.transform, t);
  }

  /** Är kartan inzoomad eller förflyttad från utgångsläget? */
  get isTransformed(): boolean {
    const t = this.transform;
    return Math.abs(t.k - 1) > 0.01 || Math.abs(t.x) > 0.5 || Math.abs(t.y) > 0.5;
  }

  destroy(): void {
    this.resizeObserver.disconnect();
    this.svg.remove();
  }
}

/** Samma standardfilter som d3-zoom använder: ignorera ctrl+hjul-konflikter och sekundära musknappar. */
function defaultZoomFilter(event: Event): boolean {
  const e = event as MouseEvent & WheelEvent;
  return (!e.ctrlKey || e.type === 'wheel') && !e.button;
}
