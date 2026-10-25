#!/usr/bin/env bash
# Bygger landskapskartan public/data/landskap.topo.json (TopoJSON, WGS84, objektet "landskap").
#
# Källa: OpenStreetMap, © OpenStreetMap-bidragsgivare, licens ODbL
#   https://www.openstreetmap.org/copyright
# 15 av landskapen finns som egna gränser i OSM; resten räknas fram ur län och kommuner, se
# scripts/landskap/compose.py. Allt klipps mot Sveriges kontur i lan.topo.json (bygg den först
# med scripts/build-geodata.sh), så att kusten blir densamma som på länskartan.
#
# Användning: ./scripts/build-landskap.sh
# Kräver: python3 (med venv), npm/npx. Hämtar shapely 2.1.2, osmtogeojson 3.0.0-beta.5 och
# mapshaper 0.7.98 till en tillfällig katalog.

set -euo pipefail
cd "$(dirname "$0")/.."

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Hämtar gränser från OpenStreetMap ..."
python3 scripts/landskap/fetch_osm.py "$TMP/osm"

echo "Gör om till GeoJSON ..."
npm install --silent --no-save --prefix "$TMP/node" osmtogeojson@3.0.0-beta.5 >/dev/null
mkdir -p "$TMP/geojson"
for f in "$TMP"/osm/*.osm.json; do
  name="$(basename "$f" .osm.json)"
  node scripts/landskap/osm-to-geojson.mjs "$TMP/node" "$f" "$TMP/geojson/$name.geojson" "$name"
done
npx --yes mapshaper@0.7.98 -i public/data/lan.topo.json -dissolve -o "$TMP/geojson/outline.geojson" format=geojson

echo "Sätter ihop landskapen ..."
python3 -m venv "$TMP/venv"
"$TMP/venv/bin/pip" install --quiet shapely==2.1.2
"$TMP/venv/bin/python" scripts/landskap/compose.py "$TMP/geojson" "$TMP/landskap.geojson"

# Förenkla till ungefär samma storlek och detaljnivå som länskartan (~70 kB).
NAMES='{skane:"Skåne",blekinge:"Blekinge",halland:"Halland",smaland:"Småland",oland:"Öland",gotland:"Gotland",ostergotland:"Östergötland",vastergotland:"Västergötland",bohuslan:"Bohuslän",dalsland:"Dalsland",sodermanland:"Södermanland",uppland:"Uppland",vastmanland:"Västmanland",narke:"Närke",varmland:"Värmland",dalarna:"Dalarna",gastrikland:"Gästrikland",halsingland:"Hälsingland",harjedalen:"Härjedalen",medelpad:"Medelpad",jamtland:"Jämtland",angermanland:"Ångermanland",vasterbotten:"Västerbotten",norrbotten:"Norrbotten",lappland:"Lappland"}'
npx --yes mapshaper@0.7.98 \
  -i "$TMP/landskap.geojson" snap \
  -clean \
  -simplify 15% keep-shapes \
  -clean \
  -each "name = $NAMES[code]" \
  -rename-layers landskap \
  -o public/data/landskap.topo.json format=topojson quantization=1e5

echo "Klart: public/data/landskap.topo.json"
