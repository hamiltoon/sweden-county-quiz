"""Hämtar gränserna som landskapskartan byggs av från OpenStreetMaps API (relation/full).

Användning: python3 fetch_osm.py <utkatalog>
Filer som redan finns i utkatalogen hämtas inte igen.
"""
import os
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

# Landskap som finns som egna gränser i OSM (boundary=historic), och de län och kommuner som
# resten räknas fram ur (se compose.py). Relations-id:n kommer från Wikidata (P402) och från
# grannarnas gemensamma gränslinjer.
RELATIONS = {
    'uppland': 4108474, 'gastrikland': 296316, 'angermanland': 5828439, 'sodermanland': 3985130,
    'medelpad': 5825057, 'halsingland': 296317, 'norrbotten': 6202721, 'vasterbotten': 6202854,
    'vastergotland': 11881748, 'ostergotland': 3711945, 'narke': 4205693, 'vastmanland': 11086931,
    'dalsland': 13738911, 'bohuslan': 8812092, 'smaland': 9691220,
    'lan-skane': 54409, 'lan-blekinge': 54413, 'lan-halland': 54403, 'lan-gotland': 941530,
    'lan-varmland': 54223, 'lan-dalarna': 52834, 'lan-jamtland': 52826, 'lan-norrbotten': 52824,
    'lan-vasterbotten': 52825,
    'kommun-harjedalen': 935534, 'kommun-borgholm': 935406, 'kommun-morbylanga': 935518,
}
USER_AGENT = 'sverigespelet-build/1.0 (github.com/hamiltoon/sweden-county-quiz)'


def fetch(item):
    name, rid = item
    path = os.path.join(OUT, f'{name}.osm.json')
    if os.path.exists(path):
        return name, 'finns redan'
    err = None
    for attempt in range(5):
        try:
            req = urllib.request.Request(
                f'https://www.openstreetmap.org/api/0.6/relation/{rid}/full.json',
                headers={'User-Agent': USER_AGENT},
            )
            with urllib.request.urlopen(req, timeout=180) as res:
                data = res.read()
            with open(path, 'wb') as f:
                f.write(data)
            return name, f'{len(data) // 1024} kB'
        except Exception as e:  # nätverksfel: vänta och försök igen
            err = e
            time.sleep(3 * 2 ** attempt)
    raise SystemExit(f'Kunde inte hämta {name} (relation {rid}): {err}')


OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
# Några få samtidiga anrop; OSM:s API är en delad resurs.
for name, result in ThreadPoolExecutor(4).map(fetch, RELATIONS.items()):
    print(f'  {name}: {result}', flush=True)
