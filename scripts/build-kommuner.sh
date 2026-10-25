#!/usr/bin/env bash
# Bygger kommunkartan public/data/kommuner.topo.json (TopoJSON, WGS84, objektet "kommuner") och
# kommunlistan src/data/municipalities.ts.
#
# Källor:
#   Kommunerna, koder och namn: scripts/kommuner/kommuner.json, sammanställd från SCB:s regionkoder
#     (de 290 kommunerna) och Wikidata (svenska och engelska namn, OSM-relation).
#   Gränserna: OpenStreetMap, © OpenStreetMap-bidragsgivare, licens ODbL
#     https://www.openstreetmap.org/copyright
#   Små öar: Natural Earth 1:10m "Minor Islands" (public domain), så att skärgårdskommuner som
#     Öckerö får land.
# Allt klipps mot Sveriges kontur i lan.topo.json (bygg den först med scripts/build-geodata.sh).
#
# Användning: ./scripts/build-kommuner.sh
# Kräver: python3 (med venv), npm/npx. Hämtar shapely 2.1.2, osmtogeojson 3.0.0-beta.5 och
# mapshaper 0.7.98 till en tillfällig katalog. Nedladdningen från OSM tar några minuter.

set -euo pipefail
cd "$(dirname "$0")/.."

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
NE_BASE="https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson"

echo "Hämtar kommungränser från OpenStreetMap ..."
python3 scripts/kommuner/fetch_osm.py scripts/kommuner/kommuner.json "$TMP/osm"

echo "Gör om till GeoJSON ..."
npm install --silent --no-save --prefix "$TMP/node" osmtogeojson@3.0.0-beta.5 >/dev/null
mkdir -p "$TMP/geojson"
for f in "$TMP"/osm/*.osm.json; do
  code="$(basename "$f" .osm.json)"
  node scripts/landskap/osm-to-geojson.mjs "$TMP/node" "$f" "$TMP/geojson/$code.geojson" "$code"
done
npx --yes mapshaper@0.7.98 -i public/data/lan.topo.json -dissolve -o "$TMP/geojson/outline.geojson" format=geojson
curl -sSL -o "$TMP/geojson/islands.geojson" "$NE_BASE/ne_10m_minor_islands.geojson"

echo "Sätter ihop kommunerna ..."
python3 -m venv "$TMP/venv"
"$TMP/venv/bin/pip" install --quiet shapely==2.1.2
"$TMP/venv/bin/python" scripts/kommuner/compose.py scripts/kommuner/kommuner.json "$TMP/geojson" "$TMP/kommuner.geojson"

# Förenkla till ~260 kB (90 kB gzippat). Länsbokstaven läggs på varje kommun, så att kartan kan
# rita länsgränserna ur samma topologi.
COUNTY='{"01":"AB","03":"C","04":"D","05":"E","06":"F","07":"G","08":"H","09":"I","10":"K","12":"M","13":"N","14":"O","17":"S","18":"T","19":"U","20":"W","21":"X","22":"Y","23":"Z","24":"AC","25":"BD"}'
npx --yes mapshaper@0.7.98 \
  -i "$TMP/kommuner.geojson" snap \
  -clean \
  -simplify 8% keep-shapes \
  -clean \
  -each "county = $COUNTY[code.slice(0, 2)]" \
  -rename-layers kommuner \
  -o public/data/kommuner.topo.json format=topojson quantization=1e5

python3 scripts/kommuner/write_data.py scripts/kommuner/kommuner.json src/data/municipalities.ts
echo "Klart: public/data/kommuner.topo.json och src/data/municipalities.ts"
