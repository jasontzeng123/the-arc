"""Tile out/stills/NAME/f_*.png into a labelled contact sheet (grid.jpg). usage: grid.py DIR [COLS] [TILE_WIDTH]"""
import sys, glob, os
from PIL import Image, ImageDraw
d = sys.argv[1]; cols = int(sys.argv[2]) if len(sys.argv) > 2 else 3; w = int(sys.argv[3]) if len(sys.argv) > 3 else 640
fs = sorted(glob.glob(os.path.join(d, 'f_*.png')))
h = w * 9 // 16
rows = (len(fs) + cols - 1) // cols
G = Image.new('RGB', (cols * (w + 4) + 4, rows * (h + 22) + 4), (40, 40, 40))
dr = ImageDraw.Draw(G)
for i, f in enumerate(fs):
    im = Image.open(f).convert('RGB').resize((w, h), Image.LANCZOS)
    x = 4 + (i % cols) * (w + 4); y = 4 + (i // cols) * (h + 22)
    G.paste(im, (x, y + 18)); dr.text((x + 2, y + 2), os.path.basename(f)[2:-4] + 's', fill=(230, 230, 230))
out = os.path.join(d, 'grid.jpg'); G.save(out, quality=88); print(out)
