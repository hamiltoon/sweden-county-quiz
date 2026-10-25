#!/usr/bin/env bash
# Bygger kartdatan i public/data/ (TopoJSON, WGS84):
#   lan.topo.json   – Sveriges 21 län (objektet "lan")
#   sjoar.topo.json – Sveriges tio största sjöar (objektet "sjoar")
#
# Källa: Natural Earth 1:10m, version 5.x
#   Län:   "Admin 1 – States, Provinces"
#          https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_10m_admin_1_states_provinces.geojson
#   Sjöar: "Lakes + Reservoirs"
#          https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_10m_lakes.geojson
# Licens: public domain (ingen attribution krävs; "Made with Natural Earth" uppskattas).
#   https://www.naturalearthdata.com/about/terms-of-use/
#
# Län: filtreras på Sverige (adm0_a3 == "SWE"), länskoden tas från ISO 3166-2
# ("SE-AB" -> "AB") och namnen sätts explicit till SCB:s officiella länsnamn.
# Ingen geometriförenkling behövs: full 10m-upplösning ger ~65 kB TopoJSON.
#
# Sjöar: vilka sjöar som är störst avgörs av SMHI:s sjöregister (se src/data/lakes.ts),
# inte av Natural Earths generaliserade geometri. Sjöarna väljs ut på Natural Earths
# stabila ne_id, och id och svenskt namn sätts explicit.
#
# Användning: ./scripts/build-geodata.sh [admin1.geojson] [lakes.geojson]
# Kräver: npx (mapshaper 0.7.98 hämtas med --yes), curl om indatafilerna inte anges.

set -euo pipefail
cd "$(dirname "$0")/.."

NE_BASE="https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson"
ADMIN1_SRC="${1:-}"
LAKES_SRC="${2:-}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if [ -z "$ADMIN1_SRC" ]; then
  ADMIN1_SRC="$TMP/ne_10m_admin_1_states_provinces.geojson"
  echo "Laddar ner $NE_BASE/ne_10m_admin_1_states_provinces.geojson (ca 40 MB) ..."
  curl -sSL -o "$ADMIN1_SRC" "$NE_BASE/ne_10m_admin_1_states_provinces.geojson"
fi
if [ -z "$LAKES_SRC" ]; then
  LAKES_SRC="$TMP/ne_10m_lakes.geojson"
  echo "Laddar ner $NE_BASE/ne_10m_lakes.geojson (ca 5 MB) ..."
  curl -sSL -o "$LAKES_SRC" "$NE_BASE/ne_10m_lakes.geojson"
fi

mkdir -p public/data

npx --yes mapshaper@0.7.98 \
  -i "$ADMIN1_SRC" \
  -filter 'adm0_a3 == "SWE"' \
  -clean \
  -each 'code = iso_3166_2.slice(3); name = {AB:"Stockholms län",C:"Uppsala län",D:"Södermanlands län",E:"Östergötlands län",F:"Jönköpings län",G:"Kronobergs län",H:"Kalmar län",I:"Gotlands län",K:"Blekinge län",M:"Skåne län",N:"Hallands län",O:"Västra Götalands län",S:"Värmlands län",T:"Örebro län",U:"Västmanlands län",W:"Dalarnas län",X:"Gävleborgs län",Y:"Västernorrlands län",Z:"Jämtlands län",AC:"Västerbottens län",BD:"Norrbottens län"}[code]' \
  -filter-fields code,name \
  -rename-layers lan \
  -o public/data/lan.topo.json format=topojson quantization=1e5

# ne_id -> [id, namn]. Id:na matchar src/data/lakes.ts.
LAKES='{
  "1159113235": ["vanern", "Vänern"],
  "1159114173": ["vattern", "Vättern"],
  "1159122891": ["malaren", "Mälaren"],
  "1159114391": ["hjalmaren", "Hjälmaren"],
  "1159114237": ["storsjon", "Storsjön"],
  "1159116271": ["tornetrask", "Torneträsk"],
  "1159116249": ["siljan", "Siljan"],
  "1159116845": ["hornavan", "Hornavan"],
  "1159123397": ["akkajaure", "Akkajaure"],
  "1159115361": ["uddjaure", "Uddjaure"]
}'
LAKES_JS="$(echo "$LAKES" | tr -d '\n')"

npx --yes mapshaper@0.7.98 \
  -i "$LAKES_SRC" \
  -filter "String(ne_id) in $LAKES_JS" \
  -clean \
  -each "var m = $LAKES_JS[String(ne_id)]; id = m[0]; name = m[1]" \
  -filter-fields id,name \
  -rename-layers sjoar \
  -o public/data/sjoar.topo.json format=topojson quantization=1e5

node -e '
const t = JSON.parse(require("fs").readFileSync("public/data/sjoar.topo.json", "utf8"));
const n = t.objects.sjoar.geometries.length;
if (n !== 10) { console.error(`Förväntade 10 sjöar, fick ${n}`); process.exit(1); }
'

ls -la public/data/lan.topo.json public/data/sjoar.topo.json
