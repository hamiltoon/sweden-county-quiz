"""Hämtar kommungränserna från OpenStreetMaps API (relation/full), en fil per kommun.

Användning: python3 fetch_osm.py <kommuner.json> <utkatalog>
Filer som redan finns i utkatalogen hämtas inte igen. Varje relation kontrolleras mot
kommunkoden (taggen ref:scb, annars ref), så att ett fel id i listan upptäcks.
"""
import json
import os
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

USER_AGENT = 'sverigespelet-build/1.0 (github.com/hamiltoon/sweden-county-quiz)'


def fetch(kommun):
    path = os.path.join(OUT, f"{kommun['code']}.osm.json")
    if not os.path.exists(path):
        err = None
        for attempt in range(5):
            try:
                req = urllib.request.Request(
                    f"https://www.openstreetmap.org/api/0.6/relation/{kommun['osm']}/full.json",
                    headers={'User-Agent': USER_AGENT},
                )
                with urllib.request.urlopen(req, timeout=180) as res:
                    data = res.read()
                with open(path, 'wb') as f:
                    f.write(data)
                break
            except Exception as e:  # nätverksfel: vänta och försök igen
                err = e
                time.sleep(3 * 2 ** attempt)
        else:
            raise SystemExit(f"Kunde inte hämta {kommun['name']} (relation {kommun['osm']}): {err}")
    rel = next(e for e in json.load(open(path))['elements'] if e['type'] == 'relation' and e['id'] == kommun['osm'])
    ref = rel['tags'].get('ref:scb') or rel['tags'].get('ref')
    return kommun, ref


kommuner = json.load(open(sys.argv[1]))
OUT = sys.argv[2]
os.makedirs(OUT, exist_ok=True)
wrong = []
# Några få samtidiga anrop; OSM:s API är en delad resurs.
for n, (kommun, ref) in enumerate(ThreadPoolExecutor(4).map(fetch, kommuner), 1):
    if ref != kommun['code']:
        wrong.append(f"{kommun['name']} ({kommun['code']}): relationen har kod {ref}")
    if n % 50 == 0:
        print(f'  {n} av {len(kommuner)}', flush=True)
if wrong:
    raise SystemExit('Fel relation för:\n  ' + '\n  '.join(wrong))
print(f'  alla {len(kommuner)} hämtade och kontrollerade')
