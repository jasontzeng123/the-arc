# THE ARC

**A 68-second film about the history of weapons, from the first stone tool to nuclear war, made entirely in code.**
The picture is rendered with WebGL (three.js), and the score is synthesised in Python. There is no footage, no samples and no stock assets.
Every cut, fill and flash is timed to the score.

[繁體中文說明 → README.zh-TW.md](README.zh-TW.md)

> ▶ **Watch:** see the latest [Release](../../releases) (1080p60 video attached).

By **[jasontzeng123](https://github.com/jasontzeng123)**. The rendering engine is forked from
[mexicat/pdoom-video](https://github.com/mexicat/pdoom-video) (MIT). The film was designed and built together with Claude (Anthropic).

---

## What's in the film

The film is one idea told ten times: **THE ARC**. It is the path of a thrown stone, then an arrow, a cannonball, a bullet and finally a ballistic missile. Each era puts one number on screen. Together they measure how much easier killing has become, and from how far away.

| # | Time (s) | Part | On screen |
|---|---|---|---|
| 01 | 0–8 | STONE | A cobble is knapped strike by strike into a hand-axe, hafted and thrown. The arc begins. |
| 02 | 8–14 | BOW | The camera zooms out ×10, and two volleys of arrows land on the score's impacts. |
| 03 | 14–20 | METAL | Bronze and iron shown as crystal lattices, rung by anvils, then poured into a blade. |
| 04 | 20–26 | POWDER | The first written gunpowder formula, the cannon's range table, and the walls of Constantinople. |
| 05 | 26–32 | GUNS | Rate of fire becomes the rhythm: musket 3/min → Gatling → Maxim → minigun 6,000/min. |
| 06 | 32–40 | WORLD WARS | A ledger in which 1 cell = 1,000 lives. WWI and WWII fill it. Then Hiroshima: one bomb. |
| 07 | 40–48 | PRECISION | 9,000 bombs for one target become one bomb; then the armed drone and the GPS constellation. |
| 08 | 48–54 | ARSENAL | A matrix of 12,187 warheads. One launch, a 30-minute flight compressed into 3.4 s. |
| 09 | 54–58 | DETONATION | The flash, the shock wave arriving 0.55 s later, and the cloud drawn as contour rings. |
| 10 | 58–68 | FINALE | Launches everywhere. The camera pulls back, one bar at a time, until *HUMAN* is gone. |

Each weapon's icon is laid over its part and switches on the beat (`app/src/scenes/_icons.ts`).

## Quick start

You need:

- **[Bun](https://bun.sh) ≥ 1.2**, which builds and runs the renderer.
- **[ffmpeg](https://ffmpeg.org)** on your `PATH`, which encodes the video.
- **Python 3.10+**, only if you want to regenerate the score or the data (`pip install -r requirements.txt`).

```sh
cd app
bun install
bunx playwright install chromium   # the headless browser the offline renderer drives

# live preview → http://localhost:5173
bun run build
bun run serve
```

Preview controls:

- **space**: play / pause
- **← / →**: seek 1 s (**shift**: 5 s)
- **, / .**: step one frame
- **[ / ]**: previous / next part
- **l**: loop the current part
- **h**: hide the UI

After you edit code, run `bun run build` again, or keep `bun run watch` running in a second terminal.

### Render the video

```sh
cd app
bun run render        # → out/the-arc.mp4   1920×1080, 60 fps, 3-sample motion blur
bun run render:4k     # → out/the-arc-4k.mp4 3840×2160 (true 4K: everything is re-rendered, not upscaled)

# stills / contact sheets while you work
bun scripts/render.ts stills --t 11,24.5,39 --out ../out/stills/test
../tools/stills.sh test "11,24.5,39"     # same, plus a grid.jpg contact sheet
```

The renderer opens the app in headless Chrome. It renders every frame deterministically at time *t* and streams the frames to ffmpeg over a WebSocket.

- **GPU:** Chrome uses your GPU when it can. `--swiftshader` forces software WebGL, which is slow but gives the same result on every machine.
- **Render time:** a full 1080p render with motion blur took about 2.5 h on a CPU-only cloud machine (software WebGL). On a desktop GPU it is much faster. 4K takes about 4× longer.
- **Partial renders:** `--from 54 --to 68` renders one section. `--samples 1` turns motion blur off for quick previews.

### Rebuild the score

```sh
python3 music/score.py            # → audio/score.wav + data/audio.json (≈10 s)
STEMS=1 python3 music/score.py    # also: music/out/stems_ending/ (the finale's instruments, one file each)
```

`music/score.py` is the whole soundtrack as code. It uses 120 BPM in D phrygian, so one bar = 2 s and every cut in the film sits on a downbeat. The instruments are small synthesisers in `music/synth.py`: kick, snare, hats, bass, pads, anvils, booms, whooshes, a Shepard tone and the nuclear blast.

The score also writes **`data/audio.json`**. It contains beats, bars, loudness envelopes and the exact time of every musical event (every knap, arrow volley, lock-on beep, launch, …). The picture reads this file, so animations land on the sound sample-accurately (`audio.hit('kick', t)` and similar).

### Rebuild the data (optional; the results are already in `data/`)

```sh
tools/fetch_sources.sh              # Natural Earth + Japanese municipal boundaries → vendor/
python3 tools/globegen.py           # data/globe.json      coastlines + land points for the finale
python3 tools/hirogen.py            # data/hiroshima.json  Hiroshima prefecture & neighbours (borders + coast)
python3 tools/citygen.py            # data/city2a.json + data/cityplana.png  the planned city in part 07
python3 tools/icons/build_all.py    # app/src/scenes/icons.json  the weapon icons (+ out/icons_sheet.png)
```

## How it's built

```
app/                 renderer (TypeScript, three.js)
  src/engine/        engine: timeline, deterministic time, motion-blur accumulation, transitions, post (bloom, grain…)
  src/scenes/        one file per part (stone.ts … finale.ts) + shared kits (_kit.ts, _globe.ts, _city2.ts, _icons.ts …)
  src/timeline.ts    the edit: which part plays when, and the transition between parts
  scripts/           render.ts (headless offline renderer), serve.ts (static server)
music/               the score (Python): synth.py = instruments, score.py = arrangement + mix + analysis
tools/               data generators (city, maps, globe, icons) and contact-sheet helpers
data/                generated data the renderer loads (audio.json, maps, city, globe)
audio/score.wav      the rendered score
```

- **Deterministic:** a frame is a pure function of *t*. Stateful effects are pre-rolled, so any frame can be rendered alone and in any order, and a render is repeatable.
- **Synced to sound, not to guesses:** the score writes the time of every event it plays, and the picture reads those times.
- **One visual system:** a palette of ink, bone and one signal orange (`app/src/engine/palette.ts`). Type is Archivo and IBM Plex Mono, all lines are drawn in one line renderer (`engine/lines.ts`), and grain, bloom and vignette are applied in post.
- **Everything is procedural:** the knapped stone is a set of cut half-spaces, the ledger is a shader, the city is generated street by street and the cloud is a set of contour rings.

## On-screen figures

The numbers are rounded, widely cited estimates, as stated in the film. Check the primary sources before reusing them.

- **Archaeological sites:**
  - First stone tools, ~3.3 million years ago: Lomekwi 3, West Turkana, Kenya.
  - Hafted spear points, ~500,000 years ago: Kathu Pan, South Africa.
  - Bow and arrow, ~64,000 years ago: Sibudu Cave, South Africa.
- **Metals:** bronze (≈88 % Cu / 12 % Sn) from c. 3300 BC; iron from c. 1200 BC (melting point 1,538 °C).
- **Gunpowder and cannon:**
  - Gunpowder formula: *Wujing Zongyao*, 1044.
  - Oldest surviving gun: the Heilongjiang hand cannon, c. 1288.
  - Constantinople, 1453: the walls breached after a 53-day siege.
- **Rates of fire (rounds per minute):**
  - flintlock musket ~3
  - Gatling (1862) ~200
  - Maxim (1884) ~600
  - M134 minigun (1963) up to ~6,000
- **Deaths:**
  - WWI: est. 15–22 million.
  - WWII: est. 70–85 million.
  - Hiroshima, 6 Aug 1945: one 15-kiloton bomb; 90,000–166,000 dead by the end of 1945.
- **Modern weapons:**
  - Laser-guided precision bombing: 1991.
  - The armed MQ-1 drone: 2001.
  - GPS: 31 satellites at 20,200 km.
  - The ICBM: 1957.
- **Nuclear arsenal:** 12,187 nuclear warheads (SIPRI Yearbook), about 2,100 of them on high alert.

## Credits & licenses

- **Code:** [MIT](LICENSE). This covers the renderer, the score generator and the tools. Parts of the engine are © 2026 Giacomo Magnanini ([pdoom-video](https://github.com/mexicat/pdoom-video), MIT).
- **The film and its music** (the rendered video, `audio/score.wav` and anything the score code renders): [CC BY-NC 4.0](LICENSE-MEDIA.md) © 2026 jasontzeng123. You may share and adapt them for non-commercial purposes if you credit the author.
- **Fonts:** Archivo, IBM Plex Mono and Cormorant under the SIL Open Font License (`app/public/fonts/OFL.txt`).
- **Map data:**
  - [Natural Earth](https://www.naturalearthdata.com) (public domain).
  - Japanese prefecture boundaries: 「国土数値情報（行政区域データ）」国土交通省, via [niiyz/JapanCityGeoJson](https://github.com/niiyz/JapanCityGeoJson), processed.

See [CREDITS.md](CREDITS.md) for details.
