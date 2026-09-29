"""Shared: rasterised city (1 px = 1 m, ±EXT) → plan texture + lot polygons."""
import json, math
import numpy as np
import cv2
from PIL import Image
from scipy import ndimage

EXT = 1800
N = EXT * 2


def P(x, y):
    return (int(round(x + EXT)), int(round(EXT - y)))


def lots_from_labels(L, heights, min_px=30, eps=1.2):
    """L: int label image (0 = none). Returns [{'p': [...], 'h': h}] polygons in metres."""
    out = []
    objs = ndimage.find_objects(L)
    for k, sl in enumerate(objs):
        if sl is None:
            continue
        m = (L[sl] == k + 1).astype(np.uint8)
        if m.sum() < min_px:
            continue
        cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not cs:
            continue
        cnt = max(cs, key=cv2.contourArea)
        ap = cv2.approxPolyDP(cnt, eps, True)[:, 0, :]
        if len(ap) < 3:
            continue
        y0, x0 = sl[0].start, sl[1].start
        pts = [[round(float(px + x0 - EXT), 1), round(float(EXT - (py + y0)), 1)] for px, py in ap]
        out.append({'p': [v for p in pts for v in p], 'h': round(float(heights(k + 1, sl)), 1)})
    return out


def save_plan(path, plan, water_mask):
    """plan codes: 0 street, 1 water, 2 block, 3 park/open, 4 lot line."""
    yy, xx = np.mgrid[0:N, 0:N]
    img = np.zeros((N, N, 3), np.uint8)
    img[:] = (10, 10, 11)
    img[plan == 2] = (62, 61, 59)
    img[plan == 4] = (24, 24, 25)
    park = plan == 3
    img[park] = (30, 30, 30)
    img[park & ((xx + yy) % 9 < 1)] = (58, 58, 56)
    wat = plan == 1
    img[wat] = (6, 6, 7)
    img[wat & ((xx - yy) % 14 < 1)] = (24, 24, 25)
    blk = (plan == 2) | (plan == 4)
    er = ndimage.binary_erosion(blk)
    img[blk & ~er] = (120, 118, 114)
    wb = water_mask.astype(bool)
    img[wb & ~ndimage.binary_erosion(wb, iterations=2)] = (190, 186, 178)
    Image.fromarray(img).resize((4096, 4096), Image.LANCZOS).save(path, optimize=True)


def save_json(path, lots, target):
    json.dump({'ext': EXT, 'lots': lots, 'target': target}, open(path, 'w'), separators=(',', ':'))
