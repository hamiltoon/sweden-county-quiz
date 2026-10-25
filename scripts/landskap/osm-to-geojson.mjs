// Gör om en OSM-relation (relation/full.json) till GeoJSON med bara relationens yta.
// Användning: node osm-to-geojson.mjs <katalog där osmtogeojson är installerat> <in.osm.json> <ut.geojson> <kod>
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const [moduleDir, input, output, code] = process.argv.slice(2);
const osmtogeojson = createRequire(join(moduleDir, 'package.json'))('osmtogeojson');
const osm = JSON.parse(readFileSync(input, 'utf8'));
const relation = osm.elements.find((e) => e.type === 'relation' && e.tags);
const feature = osmtogeojson(osm).features.find((f) => f.id === `relation/${relation.id}`);
if (!feature || !/Polygon/.test(feature.geometry.type)) {
  throw new Error(`${input}: relationen blev ingen yta (${feature?.geometry.type ?? 'saknas'})`);
}
writeFileSync(output, JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { code }, geometry: feature.geometry }] }));
