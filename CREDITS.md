# Credits

**THE ARC** by [jasontzeng123](https://github.com/jasontzeng123), designed and built together with Claude (Anthropic).

## Code
- **Rendering engine** — forked from [pdoom-video](https://github.com/mexicat/pdoom-video) by Giacomo Magnanini (MIT):
  deterministic timeline, motion-blur accumulation, transitions, post-processing, offline renderer.
  Everything under `app/src/scenes/`, `music/` and `tools/` was written for THE ARC.
- [three.js](https://threejs.org) (MIT), [opentype.js](https://opentype.js.org) (MIT),
  [Playwright](https://playwright.dev) (Apache-2.0), [Bun](https://bun.sh), [FFmpeg](https://ffmpeg.org).
- Python: NumPy, SciPy, Pillow, OpenCV, Matplotlib.

## Fonts (SIL Open Font License 1.1 — `app/public/fonts/OFL.txt`)
- [Archivo](https://github.com/Omnibus-Type/Archivo) — Omnibus-Type (static instances generated from the variable font)
- [IBM Plex Mono](https://github.com/IBM/plex) — IBM
- [Cormorant](https://github.com/CatharsisFonts/Cormorant) — Christian Thalmann

## Map data
- [Natural Earth](https://www.naturalearthdata.com) — public domain. Coastlines 1:110m, land 1:50m
  (`data/globe.json`), admin-1 boundaries 1:10m (`data/hiroshima.json`).
- Japanese prefecture boundaries in `data/hiroshima.json`:
  source: National Land Numerical Information (Administrative Boundaries), Ministry of Land, Infrastructure,
  Transport and Tourism of Japan (MLIT) (https://nlftp.mlit.go.jp/ksj/), processed — converted to GeoJSON by
  [niiyz/JapanCityGeoJson](https://github.com/niiyz/JapanCityGeoJson); dissolved to prefecture outlines here.

## Generated / original
- The planned city in part 07 (`data/city2a.json`, `data/cityplana.png`) is procedural — no real city.
- The weapon icons (`app/src/scenes/icons.json`) are original vector drawings (`tools/icons/`); the bow, cannon, tank,
  gunpowder and both atomic-bomb icons follow designs by jasontzeng123.
- The score and every sound in it are synthesised by `music/` — no samples.
