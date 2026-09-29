"""data/globe.json: coastlines (Natural Earth 1:110m) + 700 random points on land (1:50m) for the missile sites.
Needs vendor/natural-earth-vector (see tools/fetch_sources.sh)."""
import os, json, numpy as np
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from matplotlib.path import Path
NE = os.path.join(ROOT, 'vendor', 'natural-earth-vector', 'geojson') + os.sep
c=json.load(open(NE+'ne_110m_coastline.geojson'))
lines=[]
for f in c['features']:
    g=f['geometry']; parts=g['coordinates'] if g['type']=='MultiLineString' else [g['coordinates']]
    for p in parts:
        lines.append([round(v,2) for xy in p for v in xy])
land=json.load(open(NE+'ne_50m_land.geojson'))
paths=[]
for f in land['features']:
    g=f['geometry']; polys=g['coordinates'] if g['type']=='MultiPolygon' else [g['coordinates']]
    for poly in polys: paths.append(Path(np.asarray(poly[0])))
rng=np.random.default_rng(3); pts=[]
while len(pts)<700:
    lon=rng.uniform(-180,180); lat=np.degrees(np.arcsin(rng.uniform(-0.85,0.95)))
    if any(p.contains_point((lon,lat)) for p in paths): pts.append([round(lon,2),round(lat,2)])
json.dump({'coast':lines,'land':pts},open(os.path.join(ROOT, 'data', 'globe.json'), 'w'),separators=(',',':'))
print(len(lines),sum(len(l) for l in lines)//2,len(pts))
