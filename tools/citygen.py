"""City A — a planned city: a gently warped orthogonal grid (wider avenues every 5th street), two diagonal
boulevards meeting at a circus, a river with bridges, a coast with piers. Rectangular blocks split into
two rows of rectangular lots; some perimeter blocks with courtyards; parks. The target is a slightly larger
building (a main mass + two annexes) on the block at the origin.
Outputs data/city2a.json + data/cityplana.png (the renderer's default city, ?city=a)."""
import math, os, sys
import numpy as np
import cv2
from scipy import ndimage
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from city_common import EXT, N, P, lots_from_labels, save_plan, save_json

rng = np.random.default_rng(5)
yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)
X = xx - EXT
Y = EXT - yy
del xx, yy

TH = 0.30
Su, Sv = 118.0, 74.0  # street spacing along u (long blocks) and v
a = X * math.cos(TH) + Y * math.sin(TH)
b = -X * math.sin(TH) + Y * math.cos(TH)
U = a + 55 * np.sin(b / 720) + 18 * np.sin(b / 330 + 1.3) + Su / 2 - 18 * math.sin(1.3)
V = b + 48 * np.sin(a / 860 + 2.0) + 16 * np.sin(a / 290) + Sv / 2 - 48 * math.sin(2.0)
del a, b
gu = np.hypot(*np.gradient(U)); gv = np.hypot(*np.gradient(V))

iu = np.floor(U / Su); iv = np.floor(V / Sv)
du = np.abs(U - np.round(U / Su) * Su) / gu
dv = np.abs(V - np.round(V / Sv) * Sv) / gv
maj_u = (np.round(U / Su) % 5 == 0)
maj_v = (np.round(V / Sv) % 6 == 0)
street = (du < np.where(maj_u, 12, 5.5)) | (dv < np.where(maj_v, 11, 5.0))
del du, dv

# diagonal boulevards meeting at a circus
def seg_dist(p0, ang):
    c, s = math.cos(ang), math.sin(ang)
    return np.abs(-(X - p0[0]) * s + (Y - p0[1]) * c)

d1 = seg_dist((-260, 470), math.radians(24))
d2 = seg_dist((420, -260), math.radians(-58))
street |= (d1 < 14) | (d2 < 13)
# circus at their intersection
A = np.array([[math.cos(math.radians(24)), -math.cos(math.radians(-58))], [math.sin(math.radians(24)), -math.sin(math.radians(-58))]])
tt = np.linalg.solve(A, np.array([420 + 260, -260 - 470]))
cx0, cy0 = -260 + tt[0] * math.cos(math.radians(24)), 470 + tt[0] * math.sin(math.radians(24))
rc = np.hypot(X - cx0, Y - cy0)
street |= (rc < 70) & (rc > 44)
circus_park = rc <= 44
print('circus', round(cx0), round(cy0))

# ---- water: sea to the south-east, a river from the north
water = np.zeros((N, N), bool)
coast_y = -600 + 0.42 * X + 40 * np.sin(X / 300 + 0.5)
sea = Y < coast_y
water |= sea
ys = np.linspace(EXT + 50, -1500, 900)
rx = -390 - 0.22 * ys + 85 * np.sin(ys / 250) + 30 * np.sin(ys / 97)
riv = np.zeros((N, N), np.uint8)
cv2.polylines(riv, [np.array([P(x, y) for x, y in zip(rx, ys)], np.int32)], False, 1, 66)
water |= riv.astype(bool)
# piers (land into the sea)
for k in range(5):
    x0 = 260 + k * 150
    y0 = -600 + 0.42 * x0 + 40 * math.sin(x0 / 300 + 0.5)
    ang = math.atan(0.42) - math.pi / 2
    c, s = math.cos(ang), math.sin(ang)
    pts = [(x0 + c * l - s * w, y0 + s * l + c * w) for l, w in ((-5, -14), (190, -14), (190, 14), (-5, 14))]
    cv2.fillPoly(riv, [np.array([P(*p) for p in pts], np.int32)], 2)
water &= ~(riv == 2)
# embankment / coast roads
bank = ndimage.distance_transform_edt(~water)
street |= (bank > 0) & (bank < 12)
# bridges: avenues continue across the river (not the sea)
bridge = water & ~sea & ((np.abs(U - np.round(U / Su) * Su) / gu < 10) & maj_u | (np.abs(V - np.round(V / Sv) * Sv) / gv < 9) & maj_v)
water &= ~bridge
street |= bridge

# keep the target block whole
free = ~street & ~water
lab, nb = ndimage.label(free)
print('blocks', nb)
idx = np.arange(1, nb + 1)
area = ndimage.sum(free, lab, idx)
cX = ndimage.mean(X, lab, idx); cY = ndimage.mean(Y, lab, idx)
vmid = ndimage.mean(V, lab, idx)
umin = ndimage.minimum(U, lab, idx)
vmin = ndimage.minimum(V, lab, idx); vmax = ndimage.maximum(V, lab, idx)
tb = lab[P(0, 0)[1], P(0, 0)[0]]
print('target block', tb, area[tb - 1])

h1 = lambda i, s: ((i * 2654435761 + s * 40503) % 1000003) / 1000003.0
kind = np.zeros(nb + 1, np.int8)  # 0 lots, 1 park, 2 courtyard
for i in range(nb):
    k = i + 1
    if area[i] < 200:
        kind[k] = 1
        continue
    r = h1(k, 3)
    dcen = math.hypot(cX[i], cY[i])
    if k == tb:
        continue
    if r < 0.045:
        kind[k] = 1
    elif r < 0.20 and area[i] > 3500 and dcen > 250:
        kind[k] = 2
# a large park: a rectangle of the grid north-east
parkrect = (U > Su * 4) & (U < Su * 6) & (V > Sv * 3) & (V < Sv * 6)
pk = np.unique(lab[parkrect & free])
kind[pk[pk > 0]] = 1

K = kind[lab]
blockm = free & (K != 1)
plan = np.zeros((N, N), np.uint8)
plan[water] = 1
plan[free & (K == 1)] = 3
plan[circus_park & free] = 3
plan[blockm] = 2

# courtyards
edt = ndimage.distance_transform_edt(free)
court = blockm & (K == 2) & (edt > 16)
plan[court] = 3
lotm = blockm & ~court & ~(circus_park)

# lots: two rows along v, columns along u
lotw = np.array([18 + 16 * h1(k, 7) for k in range(nb + 1)], np.float32)
depth = (vmax - vmin)
tworow = np.concatenate([[False], depth > 42])
B = lab
row = np.where(tworow[B], V > np.concatenate([[0], vmid])[B], 0).astype(np.int64)
col = np.floor((U - np.concatenate([[0], umin])[B]) / lotw[B]).astype(np.int64)
key = np.where(lotm, B.astype(np.int64) * 4000 + row * 2000 + col, 0)

# ---- target: main mass + two annexes, aligned to the local grid
gy, gx = np.gradient(U)
ang = math.atan2(-gy[P(0, 0)[1], P(0, 0)[0]], gx[P(0, 0)[1], P(0, 0)[0]])
del gx, gy
tgt_local = [(0, 0, 58, 36, 36), (-22, 20, 26, 22, 50), (30, -14, 22, 22, 26)]  # (du, dv, w, d, h)
tgt = []
foot = np.zeros((N, N), np.uint8)
edge_t = np.zeros((N, N), np.uint8)
ca, sa = math.cos(ang), math.sin(ang)
for (lu, lv, w, d, h) in tgt_local:
    x = lu * ca - lv * sa; y = lu * sa + lv * ca
    tgt.append({'x': round(x, 1), 'y': round(y, 1), 'w': w, 'd': d, 'h': h, 'a': round(ang, 4)})
    pts = [(x + ca * pu - sa * pv, y + sa * pu + ca * pv) for pu, pv in ((-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2))]
    pp = np.array([P(*p) for p in pts], np.int32)
    cv2.fillPoly(foot, [pp], 1)
    cv2.polylines(edge_t, [pp], True, 1, 1)
footb = foot.astype(bool)
# whole lots that the target covers by > 25 % are removed; others are clipped
ov_k, ov_n = np.unique(key[footb], return_counts=True)
all_k, all_n = np.unique(key[ndimage.binary_dilation(footb, iterations=40)], return_counts=True)
tot = dict(zip(all_k, all_n))
for kk, nn in zip(ov_k, ov_n):
    if kk and nn > 0.25 * tot[kk]:
        key[key == kk] = 0
clear = ndimage.binary_dilation(footb, iterations=3)
key[clear] = 0

uk, L = np.unique(key, return_inverse=True)
L = L.reshape(N, N).astype(np.int32)  # 0 == key 0
del key
# lot lines
ln = np.zeros((N, N), bool)
ln[:-1, :] |= (L[:-1, :] != L[1:, :]) & lotm[:-1, :] & lotm[1:, :]
ln[:, :-1] |= (L[:, :-1] != L[:, 1:]) & lotm[:, :-1] & lotm[:, 1:]
plan[ln] = 4
plan[(edge_t > 0)] = 4
plan[blockm & (L == 0) & ~court] = 2
plan[(edge_t > 0)] = 4

# heights
lcX = ndimage.mean(X, L, np.arange(1, len(uk)))
lcY = ndimage.mean(Y, L, np.arange(1, len(uk)))
blk_of = (uk[1:] // 4000).astype(np.int64)
HT = {}
for j in range(len(uk) - 1):
    x, y = lcX[j], lcY[j]
    d = math.hypot(x, y)
    base = 10 + 16 * math.exp(-d / 1100)
    h = base * math.exp(0.28 * (h1(j, 11) - 0.5) * 2)
    if kind[blk_of[j]] == 2:
        h = 18 + 6 * h1(int(blk_of[j]), 13)
    if math.hypot(x - 760, y - 520) < 330 and h1(j, 17) < 0.35:
        h = 45 + 90 * h1(j, 19)
    HT[j + 1] = min(h, 32) if d < 140 else h  # the target stays only a little taller than its neighbours
lots = lots_from_labels(L, lambda k, sl: HT.get(k, 12), min_px=60, eps=1.0)
print('lots', len(lots))

save_plan(os.path.join(ROOT, 'data', 'cityplana.png'), plan, water)
save_json(os.path.join(ROOT, 'data', 'city2a.json'), lots, tgt)
