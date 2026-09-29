import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from iconlib import *


def spear():
    cx = 180
    ys = np.linspace(0, 560, 70)
    w = [150 * math.sin(math.pi * y / 640) ** 0.8 for y in ys]
    leaf = [(cx + wi, y) for wi, y in zip(w, ys)] + [(cx - wi, y) for wi, y in zip(w, ys)][::-1][:-1]
    ops = [('fill', fillet(leaf, [8] + [0] * (len(leaf) - 1))),
           ('fill', rrect(cx - 82, 540, cx + 82, 700, 26)),
           ('fill', rrect(cx - 54, 690, cx + 54, 1000, 16)),
           ('hole', capsule((cx, 120), (cx, 450), 14)),
           ('hole', rrect(cx - 82, 588, cx + 82, 600, 0)), ('hole', rrect(cx - 82, 640, cx + 82, 652, 0))]
    return ops, (0, 0, 360, 960)


def bronze_sword():
    cx = 180
    ys = np.linspace(0, 600, 70)
    ws = [0.0] + [22 + 80 * math.sin(math.pi * y / 1000) ** 0.6 - 34 * max(0, (y - 380) / 220) ** 1.6 for y in ys[1:]]
    blade = [(cx + a, y) for a, y in zip(ws, ys)] + [(cx - a, y) for a, y in zip(ws, ys)][::-1][:-1]
    blade = fillet(blade, [10] + [0] * (len(blade) - 1))
    shoulders = fillet([(cx - 60, 570), (cx + 60, 570), (cx + 150, 668), (cx + 50, 690), (cx - 50, 690), (cx - 150, 668)], [14, 14, 30, 10, 10, 30])
    grip = rrect(cx - 48, 680, cx + 48, 850, 14)
    pommel = fillet([(cx - 50, 840), (cx + 50, 840), (cx + 170, 930), (cx + 140, 960), (cx, 915), (cx - 140, 960), (cx - 170, 930)], [12, 12, 28, 24, 40, 24, 28])
    ops = [('fill', blade), ('fill', shoulders), ('fill', grip), ('fill', pommel),
           ('hole', capsule((cx, 110), (cx, 540), 16)), ('hole', circle(cx - 90, 650, 14)), ('hole', circle(cx + 90, 650, 14)),
           ('hole', rrect(cx - 48, 728, cx + 48, 742, 0)), ('hole', rrect(cx - 48, 786, cx + 48, 800, 0))]
    return ops, (0, 0, 360, 960)


def iron_sword():
    cx = 200
    blade = fillet([(cx, 0), (cx + 78, 130), (cx + 78, 620), (cx - 78, 620), (cx - 78, 130)], [14, 22, 0, 0, 22])
    guard = rrect(cx - 200, 606, cx + 200, 690, 42)
    grip = rrect(cx - 48, 676, cx + 48, 850, 12)
    pommel = circle(cx, 900, 78)
    ops = [('fill', blade), ('fill', guard), ('fill', grip), ('fill', pommel), ('hole', capsule((cx, 160), (cx, 570), 34)),
           ('hole', rrect(cx - 48, 730, cx + 48, 744, 0)), ('hole', rrect(cx - 48, 786, cx + 48, 800, 0)), ('hole', circle(cx, 900, 28))]
    return ops, (0, 0, 400, 980)


def flintlock():
    ops = [('fill', rrect(152, 0, 216, 420, 24)),                     # barrel
           ('fill', rrect(128, 170, 240, 540, 44)),                   # forestock
           ('fill', fillet([(128, 500), (246, 500), (252, 650), (250, 690), (380, 890), (362, 912), (108, 912), (122, 690), (116, 640)], [0, 0, 16, 24, 30, 20, 20, 24, 16])),
           ('fill', fillet([(132, 520), (78, 500), (46, 452), (58, 396), (112, 384), (124, 420), (100, 432), (104, 468), (136, 480)], [0, 26, 40, 30, 12, 8, 14, 14, 0])),  # cock
           ('fill', rrect(104, 330, 150, 390, 14)),                   # frizzen
           ('fill', circle(290, 610, 66)), ('hole', circle(290, 610, 36)), ('fill', rrect(240, 570, 270, 640, 12)),
           ('hole', rrect(128, 300, 240, 314, 0)), ('hole', rrect(114, 862, 374, 876, 0))]
    return ops, (40, 0, 400, 912)


def bolt_rifle():
    ops = [('fill', fillet([(214, 0), (266, 110), (266, 300), (214, 300)], [6, 20, 0, 0])),   # bayonet blade
           ('fill', rrect(200, 290, 280, 380, 16)),                   # bayonet mount
           ('fill', rrect(148, 110, 212, 420, 18)),                   # barrel
           ('fill', rrect(128, 270, 240, 660, 40)),                   # stock
           ('fill', band((230, 590), (320, 630), 34)), ('fill', circle(326, 636, 40)),   # bolt handle
           ('fill', rrect(232, 640, 306, 720, 18)),                   # magazine
           ('fill', circle(300, 776, 60)), ('hole', circle(300, 776, 32)), ('fill', rrect(248, 740, 276, 800, 10)),
           ('fill', fillet([(128, 640), (240, 640), (262, 790), (286, 820), (400, 1010), (382, 1030), (110, 1030), (124, 790)], [0, 0, 14, 24, 30, 20, 20, 24])),
           ('hole', rrect(128, 470, 240, 484, 0)), ('hole', rrect(116, 986, 392, 1000, 0))]
    return ops, (60, 0, 420, 1030)


def wheel(ops, cx, cy, R, Ri, n, sw, hub, gap=None):
    if gap:
        ops.append(('hole', circle(cx, cy, gap, 200)))
    ops += [('fill', circle(cx, cy, R, 200)), ('hole', circle(cx, cy, Ri, 180))]
    for k in range(n):
        a = k * 2 * math.pi / n + math.pi / n * 0
        ops.append(('fill', band((cx, cy), (cx + math.cos(a) * (Ri + 6), cy + math.sin(a) * (Ri + 6)), sw)))
    ops.append(('fill', circle(cx, cy, hub)))


def gatling():
    ops = [('fill', rrect(320, 140, 900, 270, 26)),                  # barrel cluster
           ('fill', rrect(560, 136, 600, 270, 12)), ('fill', rrect(830, 136, 870, 270, 12)),
           ('fill', rrect(160, 112, 350, 294, 34)),                  # housing
           ('fill', rrect(212, 0, 294, 124, 16)),                    # magazine
           ('fill', capsule((200, 220), (96, 316), 42)), ('fill', circle(90, 322, 36)),   # crank
           ('fill', capsule((330, 300), (50, 610), 66)),             # trail
           ('fill', rrect(380, 250, 560, 440, 20)),                  # carriage cheek
           ('hole', rrect(360, 180, 880, 192, 0)), ('hole', rrect(360, 218, 880, 230, 0)),
           ('hole', rrect(212, 40, 294, 50, 0)), ('hole', rrect(212, 76, 294, 86, 0))]
    wheel(ops, 480, 430, 205, 164, 8, 40, 62, gap=242)
    return ops, (0, 0, 900, 640)


def maxim():
    ops = [('fill', rrect(250, 110, 770, 262, 44)),                  # water jacket
           ('fill', rrect(760, 160, 830, 212, 10)),
           ('fill', fillet([(820, 150), (900, 128), (900, 244), (820, 222)], [8, 14, 14, 8])),   # muzzle booster
           ('fill', rrect(290, 70, 350, 120, 12)),                   # filler cap
           ('fill', rrect(70, 120, 262, 252, 22)),                   # receiver
           ('fill', rrect(10, 104, 84, 268, 26)), ('hole', rrect(10, 164, 60, 208, 10)),   # spade grips
           ('hole', rrect(300, 110, 312, 262, 0)), ('hole', rrect(710, 110, 722, 262, 0)),
           ('fill', rrect(300, 240, 420, 330, 20)),                  # cradle
           ('fill', capsule((360, 300), (100, 690), 58)), ('fill', capsule((360, 300), (630, 690), 58)), ('fill', capsule((360, 300), (372, 706), 52))]
    # the belt: cartridges hanging from the feed block
    pts = quad((170, 262), (150, 520), (330, 560), 12)
    for i in range(len(pts) - 1):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        mx, my = (x0 + x1) / 2, (y0 + y1) / 2
        ang = math.atan2(y1 - y0, x1 - x0)
        box = xf(rrect(-14, -40, 14, 40, 10), ang, 1, mx, my)
        ops.append(('fill', box))
    return ops, (0, 60, 900, 740)


def minigun():
    ops = [('fill', rrect(135, 0, 285, 580, 30)),
           ('fill', rrect(120, 70, 300, 116, 16)), ('fill', rrect(120, 380, 300, 426, 16)),
           ('hole', rrect(178, 30, 190, 560, 0)), ('hole', rrect(230, 30, 242, 560, 0)),
           ('fill', rrect(116, 540, 304, 770, 40)),                  # rotor housing
           ('fill', rrect(56, 590, 126, 720, 22)),                   # motor
           ('hole', rrect(116, 610, 304, 622, 0)), ('hole', rrect(116, 690, 304, 702, 0)),
           ('fill', rrect(150, 760, 270, 850, 20)),
           ('fill', rrect(80, 830, 340, 876, 20)),
           ('fill', rrect(80, 850, 126, 1040, 22)), ('fill', rrect(294, 850, 340, 1040, 22))]
    pts = quad((304, 650), (430, 700), (420, 1000), 11)
    for i in range(len(pts) - 1):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        mx, my = (x0 + x1) / 2, (y0 + y1) / 2
        ang = math.atan2(y1 - y0, x1 - x0)
        ops.append(('fill', xf(rrect(-17, -44, 17, 44, 10), ang, 1, mx, my)))
    return ops, (40, 0, 460, 1040)


def bomber():
    cx = 450
    ops = [('fill', capsule((cx, 40), (cx, 720), 80)),
           ('fill', fillet([(cx, 240), (22, 300), (0, 322), (22, 346), (cx, 372)], [0, 20, 16, 20, 0])),
           ('fill', fillet([(cx, 240), (878, 300), (900, 322), (878, 346), (cx, 372)], [0, 20, 16, 20, 0])),
           ('fill', fillet([(cx, 630), (262, 684), (254, 718), (cx, 724)], [0, 16, 12, 0])),
           ('fill', fillet([(cx, 630), (638, 684), (646, 718), (cx, 724)], [0, 16, 12, 0]))]
    for x in (245, 345, 555, 655):
        ops.append(('fill', rrect(x - 24, 190, x + 24, 340, 22)))
    ops.append(('hole', rrect(cx - 16, 70, cx + 16, 110, 10)))
    return ops, (0, 0, 900, 760)


def ww2_bomb():
    cx = 140
    ys = np.linspace(300, 900, 60)
    def hw(y):
        if y < 330: return 70 + 48 * math.sin(math.pi / 2 * (y - 300) / 30)
        if y < 660: return 118
        t = (y - 660) / 240
        return 118 * math.sqrt(max(0, 1 - t ** 2.2))
    right = [(cx + hw(y), y) for y in ys]
    left = [(cx - hw(y), y) for y in ys][::-1]
    body = fillet([(cx - 44, 160), (cx + 44, 160), (cx + 70, 300)] + right + left + [(cx - 70, 300)], 10)
    ops = [('fill', body),
           ('fill', fillet([(cx - 24, 220), (0, 60), (0, 0), (60, 0), (cx - 10, 150)], [0, 14, 14, 14, 0])),
           ('fill', fillet([(cx + 24, 220), (280, 60), (280, 0), (220, 0), (cx + 10, 150)], [0, 14, 14, 14, 0])),
           ('fill', rrect(0, 0, 280, 44, 16)), ('fill', rrect(cx - 16, 0, cx + 16, 200, 8)),
           ('hole', rrect(cx - 118, 400, cx + 118, 412, 0)), ('hole', rrect(cx - 118, 620, cx + 118, 632, 0))]
    return ops, (0, 0, 280, 900)


def drone():
    cx = 450
    ops = [('fill', fillet([(0, 196), (cx, 180), (900, 196), (900, 262), (cx, 280), (0, 262)], [30, 0, 30, 30, 0, 30])),
           ('fill', circle(cx, 72, 70)), ('fill', fillet([(cx - 70, 72), (cx + 70, 72), (cx + 44, 470), (cx - 44, 470)], [0, 0, 18, 18])),
           ('fill', capsule((cx, 430), (318, 548), 54)), ('fill', capsule((cx, 430), (582, 548), 54)),
           ('fill', capsule((cx - 80, 510), (cx + 80, 510), 24)),
           ('fill', capsule((262, 160), (262, 310), 30)), ('fill', capsule((638, 160), (638, 310), 30)),
           ('hole', rrect(cx - 36, 124, cx + 36, 136, 0))]
    return ops, (0, 0, 900, 580)


def gps():
    ops = [('fill', rrect(360, 90, 540, 430, 24)),
           ('fill', rrect(0, 150, 300, 370, 18)), ('fill', rrect(600, 150, 900, 370, 18)),
           ('fill', rrect(290, 244, 370, 276, 8)), ('fill', rrect(530, 244, 610, 276, 8)),
           ('fill', rrect(398, 420, 502, 476, 12)), ('fill', rrect(430, 40, 470, 100, 8)), ('fill', circle(450, 40, 30)),
           ('hole', circle(450, 260, 42)), ('fill', circle(450, 260, 18))]
    for x0 in (0, 600):
        for x in (x0 + 100, x0 + 200):
            ops.append(('hole', rrect(x - 6, 150, x + 6, 370, 0)))
        ops.append(('hole', rrect(x0, 254, x0 + 300, 266, 0)))
    return ops, (0, 0, 900, 480)


ALL = {'spear': spear, 'bronzeSword': bronze_sword, 'ironSword': iron_sword, 'flintlock': flintlock, 'boltRifle': bolt_rifle,
       'gatling': gatling, 'maxim': maxim, 'minigun': minigun, 'bomber': bomber, 'ww2bomb': ww2_bomb, 'drone': drone, 'gps': gps}
