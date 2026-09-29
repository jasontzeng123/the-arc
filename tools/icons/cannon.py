import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from iconlib import *
def build():
    cx, cy, R, Ri, Rg = 431.5, 390.0, 225.0, 186.0, 263.0
    top = lambda x: 55 - 0.126 * (x - 430)
    bot = lambda x: 136 + 0.27 * (800 - x)
    body = [(74, 168), (80, 157), (92, 138), (110, 117), (135, 100), (175, top(175)), (858, top(858)), (874, 2), (898, 96), (888, bot(888)), (560, bot(560)),
            (cx, cy), (200, 320), (160, 302), (134, 300), (118, 292), (82, 278), (70, 272)]
    body = fillet(body, [0, 4, 8, 10, 12, 20, 0, 14, 10, 0, 0, 0, 0, 6, 4, 4, 0])
    knob = circle(52, 226, 52)
    trail = fillet([(140, 290), (182, 290), (140, 470), (130, 505), (10, 553), (0, 530), (100, 490)], [0, 0, 0, 10, 18, 18, 0])
    trail = fillet([(153, 280), (191, 280), (141, 474), (122, 515), (16, 557), (2, 520), (99, 482)], [0, 0, 14, 10, 20, 20, 10])
    ops = [('fill', body), ('fill', knob), ('fill', trail), ('hole', circle(cx, cy, Rg, 200)), ('fill', circle(cx, cy, R, 200)), ('hole', circle(cx, cy, Ri, 180))]
    for k in range(8):
        a = k * math.pi / 4
        ops.append(('fill', band((cx, cy), (cx + math.cos(a) * (Ri + 6), cy + math.sin(a) * (Ri + 6)), 37)))
    ops.append(('fill', circle(cx, cy, 72)))
    return ops, (0, 0, 900, 615)
