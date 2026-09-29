"""Build app/src/scenes/icons.json (the weapon icons) from the geometry in tools/icons/*.py, plus a preview sheet in out/."""
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(HERE, "..")); sys.path.insert(0, HERE)
from iconlib import *
import bow, cannon, tank, nuke, powder, others, littleboy
reg = {'bow': bow.build, 'cannon': cannon.build, 'tank': tank.build, 'nuke': nuke.build, 'powder': powder.build, 'littleBoy': littleboy.build}
reg.update(others.ALL)
out = {}
tiles = []
for k, f in reg.items():
    ops, b = f()
    out[k] = {'b': list(b), 'ops': [{'k': op[0], 'd': to_d(op[1]), **({'clip': to_d(op[2])} if len(op) > 2 and op[2] is not None else {})} for op in ops]}
    x0, y0, x1, y1 = b
    s = 300 / max(x1 - x0, y1 - y0)
    shifted = [(op[0], [((x - x0) * s, (y - y0) * s) for x, y in op[1]]) + ((([((x - x0) * s, (y - y0) * s) for x, y in op[2]]),) if len(op) > 2 and op[2] is not None else ()) for op in ops]
    m = render(shifted, 320, 320)
    tiles.append((k, m))
json.dump(out, open(os.path.join(ROOT, 'app', 'src', 'scenes', 'icons.json'), 'w'), separators=(',', ':'))
from PIL import ImageDraw as D
cols = 6; rows = (len(tiles) + cols - 1) // cols
sheet = Image.new('RGB', (cols * 340, rows * 350), (20, 20, 20))
dr = D.Draw(sheet)
for i, (k, m) in enumerate(tiles):
    x, y = (i % cols) * 340 + 10, (i // cols) * 350 + 25
    sheet.paste(Image.fromarray((m * 225).astype(np.uint8)).convert('RGB'), (x, y), Image.fromarray((m * 255).astype(np.uint8)))
    dr.text((x, y - 18), k, fill=(255, 110, 40))
os.makedirs(os.path.join(ROOT, 'out'), exist_ok=True)
sheet.save(os.path.join(ROOT, 'out', 'icons_sheet.png'))
print('ok', len(out))
