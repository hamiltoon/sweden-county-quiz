import { geoPath, geoTransverseMercator, type GeoPermissibleObjects, type GeoProjection } from 'd3-geo';
import { pointer, select, type Selection } from 'd3-selection';
import 'd3-transition';
import { zoom, zoomIdentity, type D3ZoomEvent, type ZoomBehavior } from 'd3-zoom';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Feature, FeatureCollection, Geometry } from 'geojson';

export interface CountyProps {
  code: string;
  name: string;
}

export type CountyFeature = Feature<Geometry, CountyProps>;

export type HighlightState = 'correct' | 'wrong' | 'reveal';
export type MarkerKind = 'correct' | 'wrong' | 'reveal';

export interface MapClick {
  /** Länskod som träffades, eller null om klicket hamnade utanför alla län. */
  code: string | null;
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
/** Län som är så små på skärmen att de får en extra osynlig träffyta. */
const SMALL_COUNTIES: ReadonlySet<string> = new Set(['K', 'I']);

/**
 * SVG-karta över Sveriges län med d3-geo-projektion och pinch-zoom/pan via d3-zoom.
 * Kartan är "dum": den rapporterar klick och kan markera län/punkter, men vet inget om spelet.
 */
export class SwedenMap {
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly root: Selection<SVGGElement, unknown, null, undefined>;
  private readonly countiesG: Selection<SVGGElement, unknown, null, undefined>;
  private readonly hitG: Selection<SVGGElement, unknown, null, undefined>;
  private readonly markersG: Selection<SVGGElement, unknown, null, undefined>;
  private readonly zoomBehavior: ZoomBehavior<SVGSVGElement, unknown>;
  private readonly projection: GeoProjection;
  private readonly path = geoPath();
  private readonly features: CountyFeature[];
  private readonly collection: FeatureCollection<Geometry, CountyProps>;
  private markers: Marker[] = [];
  private width = 0;
  private height = 0;
  private k = 1;
  private interactive = true;
  private readonly resizeObserver: ResizeObserver;

  onClick: ((click: MapClick) => void) | null = null;

  constructor(
    private readonly container: HTMLElement,
    topology: Topology,
    objectName = 'lan',
  ) {
    const obj = topology.objects[objectName] as GeometryCollection<CountyProps>;
    if (!obj) throw new Error(`TopoJSON saknar objektet "${objectName}"`);
    this.collection = feature(topology, obj) as FeatureCollection<Geometry, CountyProps>;
    this.features = this.collection.features;

    // Transversal Mercator centrerad på lon 15°E passar ett avlångt land som Sverige bra.
    this.projection = geoTransverseMercator().rotate([-15, 0]);
    this.path.projection(this.projection);

    this.svg = select(container)
      .append('svg')
      .attr('class', 'map-svg')
      .attr('role', 'img')
      .attr('aria-label', 'Karta över Sveriges län');
    this.root = this.svg.append('g').attr('class', 'map-root');
    this.countiesG = this.root.append('g').attr('class', 'counties');
    this.hitG = this.root.append('g').attr('class', 'county-hits');
    this.markersG = this.root.append('g').attr('class', 'markers');

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

    this.zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([MIN_ZOOM, MAX_ZOOM])
      .filter((event: Event) => this.interactive && defaultZoomFilter(event))
      .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        this.k = event.transform.k;
        this.root.attr('transform', event.transform.toString());
        this.svg.classed('is-zoomed', this.k > 1.01);
        this.renderMarkers();
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
    this.countiesG.selectAll<SVGPathElement, CountyFeature>('path').attr('d', (d) => this.path(d));
    this.hitG.selectAll<SVGPathElement, CountyFeature>('path').attr('d', (d) => this.path(d));
    this.zoomBehavior.translateExtent([
      [0, 0],
      [w, h],
    ]);
    this.renderMarkers();
  }

  private handleClick(event: MouseEvent): void {
    if (!this.interactive || !this.onClick) return;
    const [x, y] = pointer(event, this.root.node());
    const lonLat = this.projection.invert?.([x, y]);
    if (!lonLat) return;
    const target = (event.target as Element | null)?.closest?.('path[data-code]') as SVGPathElement | null;
    const code = target?.dataset.code ?? null;
    this.onClick({ code, lon: lonLat[0], lat: lonLat[1] });
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

  resetZoom(duration = 350): void {
    this.svg.transition().duration(duration).call(this.zoomBehavior.transform, zoomIdentity);
  }

  zoomBy(factor: number): void {
    this.svg.transition().duration(200).call(this.zoomBehavior.scaleBy, factor);
  }

  /** Zoomar in så att ett län fyller vyn (används för att visa rätt svar). */
  focusCounty(code: string, duration = 400): void {
    const f = this.features.find((d) => d.properties.code === code);
    if (!f) return;
    const [[x0, y0], [x1, y1]] = this.path.bounds(f);
    const w = x1 - x0;
    const h = y1 - y0;
    const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, 0.5 / Math.max(w / this.width, h / this.height)));
    const t = zoomIdentity
      .translate(this.width / 2, this.height / 2)
      .scale(k)
      .translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
    this.svg.transition().duration(duration).call(this.zoomBehavior.transform, t);
  }

  get zoomLevel(): number {
    return this.k;
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
