import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from iconlib import *
def build():
    lx = lambda y: 362 - 1.213 * (y - 450)
    rx = lambda y: 529 + 1.253 * (y - 450)
    heap = quad((40, 677), (95, 677), (lx(645), 645)) + quad((lx(412), 412), (444.5, 388), (rx(412), 412))[0:] + quad((rx(645), 645), (805, 677), (860, 677))
    heap = heap + [(860, 690), (40, 690)]
    bar = rrect(0, 675, 900, 713, 19)
    ops = [('fill', heap), ('fill', bar)]
    for (x, y, r) in [(403, 474, 14), (494, 505, 9.5), (377, 556, 9.5), (552, 577, 18), (297, 617, 22.5), (465, 641, 11.5)]:
        ops.append(('hole', circle(x, y, r)))
    for (x, y) in [(495, 30), (328, 103), (608, 149), (220, 247), (465, 248), (297, 391), (608, 391)]:
        ops.append(('fill', circle(x, y, 31.3)))
    for (x, y, rx_, ry) in [(403, 758, 35.5, 28), (281, 758, 35.5, 27.5), (823, 758, 25.5, 21), (113, 758, 26, 20), (651, 769, 27.5, 21), (518, 820, 21.5, 17), (193, 834, 27.5, 21.5), (782, 834, 27.5, 21.5)]:
        ops.append(('fill', ellipse(x, y, rx_, ry)))
    return ops, (0, 0, 900, 857)
