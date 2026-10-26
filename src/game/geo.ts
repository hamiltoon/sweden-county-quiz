/** Storcirkelavstånd (km) mellan två punkter i grader. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Fisher–Yates-blandning (returnerar en ny array). */
export function shuffle<T>(items: readonly T[]): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Ungefärligt avstånd (km) från en punkt till närmaste hörn i en polygons kontur.
 * Hörnen i 1:10m-data ligger tätt, så felet är litet jämfört med avstånden som visas.
 * Ger 0 om geometrin saknar koordinater.
 */
export function distanceToShapeKm(geometry: Shape, lat: number, lon: number): number {
  return nearestOnShape(geometry, lat, lon)?.km ?? 0;
}

type Shape = { type: 'Polygon'; coordinates: number[][][] } | { type: 'MultiPolygon'; coordinates: number[][][][] };

/** Närmaste hörn i konturen och avståndet dit (km), eller null om geometrin saknar koordinater. */
export function nearestOnShape(geometry: Shape, lat: number, lon: number): { lat: number; lon: number; km: number } | null {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  let best: { lat: number; lon: number; km: number } | null = null;
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const [pLon, pLat] of ring) {
        const km = haversineKm(lat, lon, pLat, pLon);
        if (!best || km < best.km) best = { lat: pLat, lon: pLon, km };
      }
    }
  }
  return best;
}
