#!/usr/bin/env bash
# Bygger public/data/lan.topo.json (Sveriges 21 län som TopoJSON, WGS84).
#
# Källa: Natural Earth 1:10m "Admin 1 – States, Provinces", version 5.x
#   https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_10m_admin_1_states_provinces.geojson
#   (raw: https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson)
# Licens: public domain (ingen attribution krävs; "Made with Natural Earth" uppskattas).
#   https://www.naturalearthdata.com/about/terms-of-use/
#
# Filen filtreras på Sverige (adm0_a3 == "SWE"), länskoden tas från ISO 3166-2
# ("SE-AB" -> "AB") och namnen sätts explicit till SCB:s officiella länsnamn.
# Ingen geometriförenkling behövs: full 10m-upplösning ger ~65 kB TopoJSON.
#
# Användning: ./scripts/build-geodata.sh [sökväg/till/ne_10m_admin_1_states_provinces.geojson]
# Kräver: npx (mapshaper 0.7.98 hämtas med --yes), curl om indatafilen inte anges.

set -euo pipefail
cd "$(dirname "$0")/.."

NE_URL="https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson"
SRC="${1:-}"
if [ -z "$SRC" ]; then
  TMP="$(mktemp -d)"
  SRC="$TMP/ne_10m_admin_1_states_provinces.geojson"
  echo "Laddar ner $NE_URL (ca 40 MB) ..."
  curl -sSL -o "$SRC" "$NE_URL"
fi

mkdir -p public/data

npx --yes mapshaper@0.7.98 \
  -i "$SRC" \
  -filter 'adm0_a3 == "SWE"' \
  -clean \
  -each 'code = iso_3166_2.slice(3); name = {AB:"Stockholms län",C:"Uppsala län",D:"Södermanlands län",E:"Östergötlands län",F:"Jönköpings län",G:"Kronobergs län",H:"Kalmar län",I:"Gotlands län",K:"Blekinge län",M:"Skåne län",N:"Hallands län",O:"Västra Götalands län",S:"Värmlands län",T:"Örebro län",U:"Västmanlands län",W:"Dalarnas län",X:"Gävleborgs län",Y:"Västernorrlands län",Z:"Jämtlands län",AC:"Västerbottens län",BD:"Norrbottens län"}[code]' \
  -filter-fields code,name \
  -rename-layers lan \
  -o public/data/lan.topo.json format=topojson quantization=1e5

ls -la public/data/lan.topo.json
