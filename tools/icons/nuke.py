import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from iconlib import *
def build():
    L = [(20, 500), (22, 452), (27, 420), (31, 400), (49, 300), (60, 230)]  # left taper (bottom → top)
    body = [(20, 778)] + L + [(60, 222), (0, 194), (0, 0), (138, 65), (276, 0), (276, 194), (216, 222)] + [(276 - x - 1, y) for x, y in L[::-1]] + [(256, 778)]
    rad = [0, 0, 0, 0, 0, 0, 0, 6, 8, 6, 10, 6, 8, 6] + [0] * 6 + [0]
    body = fillet(body, rad)
    # replace the flat bottom with the half ellipse
    bottom = [(137.5 + 118 * math.cos(a), 778 + 122 * math.sin(a)) for a in np.linspace(0, math.pi, 60)]
    body = body[:-1] + bottom[:-1] if False else body
    shape = body + bottom
    # (points go around: left bottom → up → top → right → down to (256,778) → ellipse back to (20,778))
    shape = body + [(137.5 + 118 * math.cos(a), 778 + 122 * math.sin(a)) for a in np.linspace(0, math.pi, 60)]
    c = (137.5, 552)
    ops = [('fill', shape), ('hole', circle(*c, 83, 120)), ('fill', circle(*c, 15.5, 40))]
    for k in range(3):
        a = math.pi / 2 + k * 2 * math.pi / 3
        blade = arc_pts(*c, 67, a - math.pi / 6, a + math.pi / 6, 30) + arc_pts(*c, 21, a + math.pi / 6, a - math.pi / 6, 12)
        ops.append(('fill', fillet(blade, [3] + [0] * 29 + [3, 2] + [0] * 11 + [2])))
    return ops, (0, 0, 276, 900)
