/**
 * Hur många områden bort ett område ligger från ett annat, räknat i gränser man måste korsa:
 * en grannkommun är 1 bort, grannens granne 2 osv.
 *
 * Grannarna tas ur topologin (områden som delar en gräns). Öar utan landgräns, som Gotland,
 * Öland och Öckerö, kopplas till det närmaste området på fastlandet (räknat mellan mittpunkterna),
 * så att avståndet alltid går att räkna ut.
 */
import { geoCentroid, geoDistance } from 'd3-geo';
import { feature, neighbors } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import type { FeatureCollection, Geometry } from 'geojson';

export type RegionSteps = (from: string, to: string) => number | null;

export function regionSteps(topology: Topology, objectName: string): RegionSteps {
  const obj = topology.objects[objectName] as GeometryCollection<{ code: string }>;
  const codes = obj.geometries.map((g) => (g.properties as { code?: string } | undefined)?.code ?? '');
  const index = new Map(codes.map((code, i) => [code, i]));
  const adj = neighbors(obj.geometries).map((list) => new Set(list));

  // Sammanhängande delar; de små (öar) kopplas till den största.
  const component = new Array<number>(codes.length).fill(-1);
  const parts: number[][] = [];
  for (let start = 0; start < codes.length; start++) {
    if (component[start] !== -1) continue;
    const part = [start];
    component[start] = parts.length;
    for (let i = 0; i < part.length; i++) {
      for (const next of adj[part[i]]) {
        if (component[next] === -1) {
          component[next] = parts.length;
          part.push(next);
        }
      }
    }
    parts.push(part);
  }
  if (parts.length > 1) {
    const centroids = (feature(topology, obj) as FeatureCollection<Geometry>).features.map((f) => geoCentroid(f));
    const main = parts.reduce((a, b) => (b.length > a.length ? b : a));
    for (const part of parts) {
      if (part === main) continue;
      let best: [number, number, number] = [part[0], main[0], Infinity];
      for (const a of part) {
        for (const b of main) {
          const d = geoDistance(centroids[a], centroids[b]);
          if (d < best[2]) best = [a, b, d];
        }
      }
      adj[best[0]].add(best[1]);
      adj[best[1]].add(best[0]);
    }
  }

  const cache = new Map<number, Int16Array>();
  const stepsFrom = (start: number): Int16Array => {
    let dist = cache.get(start);
    if (dist) return dist;
    dist = new Int16Array(codes.length).fill(-1);
    dist[start] = 0;
    const queue = [start];
    for (let i = 0; i < queue.length; i++) {
      for (const next of adj[queue[i]]) {
        if (dist[next] === -1) {
          dist[next] = dist[queue[i]] + 1;
          queue.push(next);
        }
      }
    }
    cache.set(start, dist);
    return dist;
  };

  return (from, to) => {
    const a = index.get(from);
    const b = index.get(to);
    if (a === undefined || b === undefined) return null;
    const steps = stepsFrom(b)[a];
    return steps >= 0 ? steps : null;
  };
}
