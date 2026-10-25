"""Sätter ihop Sveriges 290 kommuner till en GeoJSON-fil.

Användning: python3 compose.py <kommuner.json> <geojson-katalog> <ut.geojson>

Katalogen ska innehålla en fil per kommun (<kod>.geojson, från OSM), outline.geojson (Sveriges
kontur från länskartan) och islands.geojson (Natural Earths mindre öar). Allt klipps mot konturen,
så att kommunkartan får samma kust som länskartan, plus de mindre öar som ligger inom någon
kommungräns; utan dem skulle skärgårdskommuner som Öckerö inte få någon yta alls.

Kommunerna läggs i kodordning, och en kommun får bara det som ingen tidigare kommun redan tagit,
så att det inte blir några överlapp. Det som inte täcks av någon kommun (öar utanför
OSM-gränserna, små glipor mellan gränserna) går till den kommun som delar längst gräns med biten,
annars den närmaste.
"""
import json
import math
import sys

from shapely import STRtree
from shapely.geometry import mapping, shape
from shapely.ops import unary_union
from shapely.validation import make_valid

LIST, SRC, OUT = sys.argv[1], sys.argv[2], sys.argv[3]


def load(name):
    data = json.load(open(f'{SRC}/{name}.geojson'))
    if 'features' in data:
        geom = data['features'][0]['geometry']
    elif 'geometries' in data:
        geom = data['geometries'][0]
    else:
        geom = data
    return make_valid(shape(geom))


def polys(g):
    """Bara ytorna; make_valid och klippning kan lämna linjer och punkter efter sig."""
    g = make_valid(g)
    if g.geom_type == 'GeometryCollection':
        g = unary_union([p for p in g.geoms if p.geom_type in ('Polygon', 'MultiPolygon')])
    return g


def km2(g):
    lat = g.centroid.y if not g.is_empty else 60
    return g.area * 111.32 ** 2 * math.cos(math.radians(lat))


kommuner = json.load(open(LIST))
raw = {k['code']: load(k['code']) for k in kommuner}
swedish_waters = unary_union(list(raw.values()))
islands = unary_union([make_valid(shape(f['geometry'])) for f in json.load(open(f'{SRC}/islands.geojson'))['features']])
outline = polys(unary_union([load('outline'), polys(islands.intersection(swedish_waters))]))
regions = {}
for kommun in kommuner:
    code = kommun['code']
    geom = polys(raw[code].intersection(outline))
    # Dra bara bort de tidigare kommuner som kan överlappa (samma område på kartan).
    near = [g for g in regions.values() if g.bounds[0] <= geom.bounds[2] and g.bounds[2] >= geom.bounds[0] and g.bounds[1] <= geom.bounds[3] and g.bounds[3] >= geom.bounds[1]]
    if near:
        geom = polys(geom.difference(unary_union(near)))
    regions[code] = geom

codes = list(regions)
rest = polys(outline.difference(unary_union(list(regions.values()))))
tree = STRtree([regions[c] for c in codes])
moved = {}
for part in (list(getattr(rest, 'geoms', [rest])) if not rest.is_empty else []):
    if part.area <= 0:
        continue
    edge = part.boundary
    candidates = [codes[i] for i in tree.query(part.buffer(1e-4))]
    shared = {c: edge.intersection(regions[c].buffer(1e-6)).length for c in candidates}
    best = max(shared, key=shared.get) if shared and max(shared.values()) > 0 else None
    if best is None:
        best = codes[int(tree.nearest(part))]
    regions[best] = unary_union([regions[best], part])
    moved[best] = moved.get(best, 0) + km2(part)

names = {k['code']: k['name'] for k in kommuner}
for code in sorted(moved, key=lambda c: -moved[c])[:8]:
    if moved[code] > 5:
        print(f'  glipor och öar till {names[code]}: {moved[code]:.0f} km²')
smallest = sorted(regions, key=lambda c: km2(regions[c]))[:6]
print('  minst: ' + ', '.join(f'{names[c]} {km2(regions[c]):.0f} km²' for c in smallest))
empty = [names[c] for c, g in regions.items() if g.is_empty]
if empty:
    raise SystemExit(f'Kommuner utan yta: {empty}')
print(f'  {len(regions)} kommuner, summa {sum(km2(g) for g in regions.values()):.0f} km² (Sverige {km2(outline):.0f} km²)')

features = [{'type': 'Feature', 'properties': {'code': code}, 'geometry': mapping(geom)} for code, geom in regions.items()]
json.dump({'type': 'FeatureCollection', 'features': features}, open(OUT, 'w'))
