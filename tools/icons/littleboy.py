import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from iconlib import *
def build():
    body = [(22, 0), (310, 0), (310, 152), (251, 250), (251, 305), (254, 320), (277, 400), (298, 470), (301, 492), (301, 886), (30, 886), (30, 492),
            (35, 470), (54, 400), (77, 320), (80, 305), (80, 250), (22, 152)]
    body = fillet(body, [2, 2, 6, 6, 6, 0, 0, 0, 6, 86, 86, 6, 0, 0, 0, 6, 6, 6])
    c = (166, 657)
    ops = [('fill', body), ('fill', rrect(157, 870, 175, 900, 4)),
           ('fill', rrect(17, 637, 34, 686, 7)), ('fill', rrect(0, 655, 30, 669, 6)),
           ('hole', circle(*c, 97, 140)), ('fill', circle(*c, 18, 40))]
    for k in range(3):
        a = k * 2 * math.pi / 3
        blade = arc_pts(*c, 74, a - math.pi / 6, a + math.pi / 6, 30) + arc_pts(*c, 23, a + math.pi / 6, a - math.pi / 6, 12)
        ops.append(('fill', fillet(blade, [4] + [0] * 29 + [4, 2] + [0] * 11 + [2])))
    return ops, (0, 0, 310, 900)
