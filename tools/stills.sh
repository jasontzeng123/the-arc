#!/bin/sh
# Render stills at the given times and tile them into a contact sheet.
# usage: tools/stills.sh NAME "t1,t2,..." [COLS]      → out/stills/NAME/f_*.png + grid.jpg
# (extra URL parameters for the app: Q="city=a" tools/stills.sh ...)
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/out/stills/$1"
rm -rf "$OUT"
cd "$ROOT/app" && bun scripts/render.ts stills --t "$2" ${Q:+--q $Q} --out "$OUT" || exit 1
python3 "$ROOT/tools/grid.py" "$OUT" "${3:-3}" 640
