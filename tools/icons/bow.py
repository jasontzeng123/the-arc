import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from iconlib import *
R2 = math.sqrt(2)
def A(s, w): return (450 + (s + w) / R2, 450 + (-s + w) / R2)
def build():
    cx, cy, Ro, Ri = 239.4, 659.6, 593.0, 504.0
    ao0 = math.atan2(-math.sqrt(Ro**2 - (2 - cx)**2), 2 - cx)        # top-left end, outer (x = 2)
    ai0 = math.atan2(-math.sqrt(Ri**2 - (24 - cx)**2), 24 - cx)       # top-left end, inner (x = 24)
    # symmetric about the diagonal: angle a ↦ -π/2 - a
    ao1, ai1 = -math.pi / 2 - ao0, -math.pi / 2 - ai0
    limb = arc_pts(cx, cy, Ro, ao0, ao1, 160) + arc_pts(cx, cy, Ri, ai1, ai0, 140)
    limb = fillet(limb, [6] + [0] * 159 + [6, 6] + [0] * 139 + [6])
    string = band((40, 142 - 0), (757, 859), 47)
    # string: pd = (x - y)/√2 = -62 → y = x + 87.7
    string = band((30, 30 + 87.7), (782, 782 + 87.7), 47)
    arrow = [A(-540, -97), A(-352, -97), A(-292, -34), A(414, -34), A(414, -95), A(636, 0), A(414, 95), A(414, 34), A(-292, 34), A(-352, 97), A(-540, 97), A(-505, 0)]
    arrow = fillet(arrow, [8, 10, 10, 4, 6, 3, 6, 4, 10, 10, 8, 4])
    return [('fill', string), ('fill', limb), ('fill', arrow)], (0, 0, 900, 899)
