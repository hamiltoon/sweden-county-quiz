"""Sätter ihop Sveriges 25 landskap till en GeoJSON-fil.

Användning: python3 compose.py <geojson-katalog> <ut.geojson>

Katalogen ska innehålla en fil per OSM-relation (se fetch_osm.py) plus outline.geojson, Sveriges
kontur från länskartan. Allt klipps mot den konturen, så att landskapskartan får samma kust som
länskartan.

Landskapen byggs i tur och ordning, och varje landskap får bara det som inget tidigare landskap
redan tagit. Så blir det inga överlapp:
  1. Öland (Borgholms och Mörbylånga kommuner) och Härjedalen (Härjedalens kommun).
  2. De 15 landskap som finns som egna gränser i OSM.
  3. Landskap som i stort sett är ett län: Skåne, Blekinge, Halland, Gotland, Värmland, Dalarna och
     Jämtland, samt Lappland, som är det som blir kvar av Norrbottens och Västerbottens län.
Det som inte täcks (öar utanför OSM-gränserna, glipor mellan källorna, t.ex. Karlskoga som ligger i
Örebro län men hör till Värmland) går till det landskap som delar längst gräns med biten.
"""
import json
import math
import sys

from shapely.geometry import mapping, shape
from shapely.ops import unary_union
from shapely.validation import make_valid

SRC, OUT = sys.argv[1], sys.argv[2]


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
    """Ungefärlig yta i km² (grader² omräknat vid ytans breddgrad), för utskriften."""
    lat = g.centroid.y if not g.is_empty else 60
    return g.area * 111.32 ** 2 * math.cos(math.radians(lat))


OSM_PROVINCES = [
    'uppland', 'gastrikland', 'angermanland', 'sodermanland', 'medelpad', 'halsingland', 'norrbotten',
    'vasterbotten', 'vastergotland', 'ostergotland', 'narke', 'vastmanland', 'dalsland', 'bohuslan', 'smaland',
]
ORDER = (
    [
        ('oland', unary_union([load('kommun-borgholm'), load('kommun-morbylanga')])),
        ('harjedalen', load('kommun-harjedalen')),
    ]
    + [(code, load(code)) for code in OSM_PROVINCES]
    + [
        ('skane', load('lan-skane')),
        ('blekinge', load('lan-blekinge')),
        ('halland', load('lan-halland')),
        ('gotland', load('lan-gotland')),
        ('varmland', load('lan-varmland')),
        ('dalarna', load('lan-dalarna')),
        ('jamtland', load('lan-jamtland')),
        ('lappland', unary_union([load('lan-norrbotten'), load('lan-vasterbotten')])),
    ]
)

outline = polys(load('outline'))
regions = {}
taken = None
for code, geom in ORDER:
    geom = polys(geom.intersection(outline))
    if taken is not None:
        geom = polys(geom.difference(taken))
    regions[code] = geom
    taken = geom if taken is None else unary_union([taken, geom])

rest = polys(outline.difference(taken))
moved = {}
for part in (list(getattr(rest, 'geoms', [rest])) if not rest.is_empty else []):
    if part.area <= 0:
        continue
    shared = {code: part.boundary.intersection(g.buffer(1e-6)).length for code, g in regions.items()}
    best = max(shared, key=shared.get)
    if shared[best] == 0:
        best = min(regions, key=lambda code: regions[code].distance(part))
    regions[best] = unary_union([regions[best], part])
    moved[best] = moved.get(best, 0) + km2(part)

for code in sorted(moved, key=lambda c: -moved[c]):
    if moved[code] > 20:
        print(f'  glipor och öar till {code}: {moved[code]:.0f} km²')
for code, geom in regions.items():
    print(f'  {code:14s} {km2(geom):8.0f} km²')
print(f'  summa {sum(km2(g) for g in regions.values()):.0f} km² (Sverige {km2(outline):.0f} km²)')

features = [{'type': 'Feature', 'properties': {'code': code}, 'geometry': mapping(geom)} for code, geom in regions.items()]
json.dump({'type': 'FeatureCollection', 'features': features}, open(OUT, 'w'))
