"""Hiroshima prefecture and its neighbours: prefecture borders + coastline only, km relative to the hypocenter
(x east, y north). Detailed municipal polygons (JapanCityGeoJson) dissolved per prefecture where available,
Natural Earth 10m admin-1 elsewhere. Output: data/hiroshima.json {rings:[{c, p:[x,y,...]}]} (c=1: Hiroshima)."""
import os, json, glob, math
import numpy as np
import cv2

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

LAT0, LON0 = 34.3955, 132.4536
KX = 111.32 * math.cos(math.radians(LAT0)); KY = 110.9
LON_A, LON_B, LAT_A, LAT_B = 130.4, 135.3, 32.6, 36.2
RES = 0.2  # km per px
W = int((LON_B - LON_A) * KX / RES); H = int((LAT_B - LAT_A) * KY / RES)
x0 = (LON_A - LON0) * KX; y1 = (LAT_B - LAT0) * KY


def px(lon, lat):
    x = (lon - LON0) * KX; y = (lat - LAT0) * KY
    return (x - x0) / RES, (y1 - y) / RES


def rings_of(geom):
    t = geom['type']; cs = geom['coordinates']
    polys = [cs] if t == 'Polygon' else cs if t == 'MultiPolygon' else []
    return polys


lab = np.zeros((H, W), np.uint8)
DETAIL = {32: 'Shimane', 33: 'Okayama', 34: 'Hiroshima', 35: 'Yamaguchi', 37: 'Kagawa', 38: 'Ehime'}


def fill(polys, v):
    for poly in polys:
        ext = np.array([px(*q) for q in poly[0]], np.float64)
        cv2.fillPoly(lab, [np.round(ext * 4).astype(np.int32)], v, shift=2)
        for hole in poly[1:]:
            hh = np.array([px(*q) for q in hole], np.float64)
            cv2.fillPoly(lab, [np.round(hh * 4).astype(np.int32)], 0, shift=2)


ne = json.load(open(os.path.join(ROOT, 'vendor', 'natural-earth-vector', 'geojson', 'ne_10m_admin_1_states_provinces.geojson')))
ids = {}
for f in ne['features']:
    p = f['properties']
    if p.get('iso_a2') != 'JP':
        continue
    nm = p['name']
    if nm in DETAIL.values():
        continue
    polys = rings_of(f['geometry'])
    ok = any(LON_A - 1 < q[0] < LON_B + 1 and LAT_A - 1 < q[1] < LAT_B + 1 for poly in polys for q in poly[0][::20])
    if not ok:
        continue
    ids[nm] = len(ids) + 100
    fill(polys, ids[nm])
for code in DETAIL:
    for fn in glob.glob(os.path.join(ROOT, 'vendor', 'JapanCityGeoJson', 'geojson', str(code), '*.json')):
        g = json.load(open(fn))
        feats = g['features'] if g.get('type') == 'FeatureCollection' else [g]
        for f in feats:
            fill(rings_of(f['geometry']), code)
print('neighbours', list(ids))

rings = []
for v in np.unique(lab):
    if v == 0:
        continue
    m = (lab == v).astype(np.uint8)
    cs, _ = cv2.findContours(m, cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE)
    for c in cs:
        if cv2.contourArea(c) < 4:
            continue
        ap = cv2.approxPolyDP(c, 0.7, True)[:, 0, :].astype(float)
        ap = np.vstack([ap, ap[:1]])
        xs = ap[:, 0] * RES + x0; ys = y1 - ap[:, 1] * RES
        rings.append({'c': int(v == 34), 'p': [round(float(q), 2) for pt in zip(xs, ys) for q in pt]})
print('rings', len(rings), sum(len(r['p']) // 2 for r in rings))
json.dump({'rings': rings}, open(os.path.join(ROOT, 'data', 'hiroshima.json'), 'w'), separators=(',', ':'))
# preview
img = np.zeros((H, W, 3), np.uint8)
for r in rings:
    p = np.array(r['p']).reshape(-1, 2)
    q = np.stack([(p[:, 0] - x0) / RES, (y1 - p[:, 1]) / RES], 1).astype(np.int32)
    cv2.polylines(img, [q], False, (255, 255, 255) if r['c'] else (120, 120, 120), 2 if r['c'] else 1)
cv2.circle(img, tuple(int(v) for v in px(LON0, LAT0)), 5, (0, 80, 255), -1)
os.makedirs(os.path.join(ROOT, 'out'), exist_ok=True)
cv2.imwrite(os.path.join(ROOT, 'out', 'hiroshima_preview.png'), cv2.resize(img, (W // 2, H // 2), interpolation=cv2.INTER_AREA))
