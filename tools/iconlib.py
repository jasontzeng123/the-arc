"""Tiny vector kit for the weapon icons: polygons with filleted corners, circles, ellipses, arcs, capsules.
Shapes are lists of (x, y); an icon is a list of ops ('fill'|'hole', shape) applied in order."""
import math
import numpy as np
from PIL import Image, ImageDraw


def circle(cx, cy, r, n=None):
    n = n or max(24, int(r * 0.8))
    return [(cx + r * math.cos(2 * math.pi * i / n), cy + r * math.sin(2 * math.pi * i / n)) for i in range(n)]


def ellipse(cx, cy, rx, ry, n=64):
    return [(cx + rx * math.cos(2 * math.pi * i / n), cy + ry * math.sin(2 * math.pi * i / n)) for i in range(n)]


def arc_pts(cx, cy, r, a0, a1, n=None):
    n = n or max(8, int(abs(a1 - a0) * r / 6))
    return [(cx + r * math.cos(a0 + (a1 - a0) * i / n), cy + r * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]


def fillet(pts, r):
    """Round every corner of a closed polygon; r = number or list per vertex (0 = sharp)."""
    n = len(pts)
    rs = list(r) + [0] * max(0, n - len(r)) if isinstance(r, (list, tuple)) else [r] * n
    out = []
    for i in range(n):
        p0, p1, p2 = np.array(pts[i - 1], float), np.array(pts[i], float), np.array(pts[(i + 1) % n], float)
        ri = rs[i]
        if ri <= 0:
            out.append(tuple(p1)); continue
        a, b = p0 - p1, p2 - p1
        la, lb = np.linalg.norm(a), np.linalg.norm(b)
        if la < 1e-6 or lb < 1e-6:
            out.append(tuple(p1)); continue
        a, b = a / la, b / lb
        ang = math.acos(max(-1, min(1, float(a @ b))))
        if ang < 1e-3 or abs(ang - math.pi) < 1e-3:
            out.append(tuple(p1)); continue
        d = ri / math.tan(ang / 2)
        d = min(d, la * 0.5, lb * 0.5)
        rr = d * math.tan(ang / 2)
        t0, t1 = p1 + a * d, p1 + b * d
        bis = (a + b) / np.linalg.norm(a + b)
        c = p1 + bis * (rr / math.sin(ang / 2))
        a0 = math.atan2(*(t0 - c)[::-1]); a1 = math.atan2(*(t1 - c)[::-1])
        da = (a1 - a0 + math.pi) % (2 * math.pi) - math.pi
        m = max(3, int(abs(da) * rr / 3))
        for k in range(m + 1):
            aa = a0 + da * k / m
            out.append((c[0] + rr * math.cos(aa), c[1] + rr * math.sin(aa)))
    return out


def rrect(x0, y0, x1, y1, r):
    return fillet([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], r)


def capsule(p, q, w, n=16):
    """a thick segment with round caps"""
    p, q = np.array(p, float), np.array(q, float)
    d = q - p; L = np.linalg.norm(d); d /= L; nrm = np.array([-d[1], d[0]])
    a = math.atan2(nrm[1], nrm[0])
    pts = [tuple(q + w / 2 * np.array([math.cos(a - math.pi * i / n), math.sin(a - math.pi * i / n)])) for i in range(n + 1)]
    pts += [tuple(p + w / 2 * np.array([math.cos(a + math.pi - math.pi * i / n), math.sin(a + math.pi - math.pi * i / n)])) for i in range(n + 1)]
    return pts


def band(p, q, w):
    p, q = np.array(p, float), np.array(q, float)
    d = q - p; d /= np.linalg.norm(d); nrm = np.array([-d[1], d[0]]) * w / 2
    return [tuple(p + nrm), tuple(q + nrm), tuple(q - nrm), tuple(p - nrm)]


def quad(p0, c, p1, n=16):
    return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p1[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p1[1]) for t in np.linspace(0, 1, n)]


def xf(pts, ang=0.0, s=1.0, dx=0.0, dy=0.0, ox=0.0, oy=0.0):
    c, sn = math.cos(ang), math.sin(ang)
    return [(ox + dx + s * ((x - ox) * c - (y - oy) * sn), oy + dy + s * ((x - ox) * sn + (y - oy) * c)) for x, y in pts]


def render(ops, W, H, scale=1.0):
    im = Image.new('L', (int(W * scale), int(H * scale)), 0)
    d = ImageDraw.Draw(im)
    for op in ops:
        k, pts = op[0], op[1]
        if len(op) > 2 and op[2] is not None:
            m = Image.new('L', im.size, 0); ImageDraw.Draw(m).polygon([(x * scale, y * scale) for x, y in pts], fill=255)
            c = Image.new('L', im.size, 0); ImageDraw.Draw(c).polygon([(x * scale, y * scale) for x, y in op[2]], fill=255)
            m = Image.fromarray(np.minimum(np.array(m), np.array(c)))
            src = Image.new('L', im.size, 255 if k == 'fill' else 0)
            im.paste(src, (0, 0), m)
            d = ImageDraw.Draw(im)
            continue
        d.polygon([(x * scale, y * scale) for x, y in pts], fill=255 if k == 'fill' else 0)
    return np.array(im) > 127


def compare(ops, ref, path):
    H, W = ref.shape
    mine = render(ops, W, H)
    img = np.zeros((H, W, 3), np.uint8)
    img[ref & mine] = (200, 200, 200)
    img[ref & ~mine] = (255, 60, 60)
    img[~ref & mine] = (60, 220, 90)
    Image.fromarray(img).save(path)
    inter = (ref & mine).sum(); uni = (ref | mine).sum()
    return inter / uni


def to_d(pts):
    return 'M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in pts) + ' Z'
