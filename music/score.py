"""THE ARC — original score. 120 BPM, D phrygian/minor, 68 s. Everything is synthesised here (no samples).
Writes music/out/score.wav and audio/score.wav (the renderer's soundtrack) and data/audio.json (beats, sections,
envelopes, exact onsets the picture syncs to). STEMS=1 also writes the ending's instruments to music/out/stems_ending/."""
import json
import os
import sys

import numpy as np
from scipy import signal

sys.path.insert(0, os.path.dirname(__file__))
from synth import *  # noqa

DUR = 68.0
BPM = 120.0
BEAT = 60.0 / BPM
BAR = BEAT * 4
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True)


def T(bar, beat=0.0):
    return bar * BAR + beat * BEAT


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


D1, D2, D3 = 26, 38, 50  # midi

ONS = {}


def mark(kind, t, s=1.0):
    ONS.setdefault(kind, []).append([round(float(t), 4), round(float(s), 3)])


drums = Bus(DUR)
bass = Bus(DUR)
music = Bus(DUR)
fx = Bus(DUR)
revsend = Bus(DUR)  # long hall
roomsend = Bus(DUR)  # short room

# ---- per-instrument stems of the ending (STEMS=1): every tagged call is mirrored into its own buses
STEM_ON = os.environ.get('STEMS') == '1'
STEMS = {}
_TAG = [None]


class stem_tag:
    def __init__(self, name):
        self.name = name

    def __enter__(self):
        self.prev = _TAG[0]
        _TAG[0] = self.name

    def __exit__(self, *a):
        _TAG[0] = self.prev


def _wrap_bus(bus, name):
    orig = bus.add

    def add(x, at, gain=1.0, p=0.0):
        orig(x, at, gain, p)
        if STEM_ON and _TAG[0]:
            d = STEMS.setdefault(_TAG[0], {})
            if name not in d:
                d[name] = Bus(DUR)
            d[name].add(x, at, gain, p)
    bus.add = add


for _b, _n in [(drums, 'drums'), (bass, 'bass'), (music, 'music'), (fx, 'fx'), (revsend, 'revsend'), (roomsend, 'roomsend')]:
    _wrap_bus(_b, _n)

# ---------------------------------------------------------------- instruments


def knap(t, amp=1.0, seed=0, p=0.0, send=0.5):
    """Stone on stone: bright click + woody tock + small thud."""
    r = np.random.default_rng(100 + seed)
    d = 0.35
    click = sos_filter(noise(d, 200 + seed), 'bp', (1800, 9000), 2) * expdec(d, 0.004)
    tt = tvec(d)
    tock = np.zeros_like(tt)
    for k, (ratio, tau) in enumerate([(1.0, 0.03), (2.31, 0.018), (3.87, 0.01)]):
        f = (900 + 500 * r.random()) * ratio
        tock += np.sin(2 * np.pi * f * tt) * np.exp(-tt / tau) / (k + 1)
    thud = np.sin(2 * np.pi * (140 * np.exp(-tt * 20) + 70) * tt) * np.exp(-tt / 0.05)
    x = click * 1.6 + tock * 0.6 + thud * 0.7
    x *= amp
    fx.add(x, t, 0.8, p)
    roomsend.add(x, t, send, p)
    mark('knap', t, amp)


def kick(t, amp=1.0, f0=160, f1=42, tau=0.32, drive=1.5, click=0.3):
    d = 0.9
    tt = tvec(d)
    body = sweep_sine(d, f0, f1, curve=28) * np.exp(-tt / tau)
    cl = sos_filter(noise(d, 5), 'bp', (1500, 7000)) * expdec(d, 0.003) * click
    x = softclip(body * 1.0 + cl, drive) * amp
    drums.add(x, t, 0.9)
    roomsend.add(x, t, 0.08)
    mark('kick', t, amp)


def snare(t, amp=1.0, verb=0.5, tone=190, seed=0):
    d = 0.6
    tt = tvec(d)
    n = sos_filter(noise(d, 40 + seed), 'bp', (900, 9000)) * expdec(d, 0.12)
    b = np.sin(2 * np.pi * tone * tt) * np.exp(-tt / 0.06)
    x = (n * 0.8 + b * 0.7) * amp
    drums.add(x, t, 0.7, 0.05)
    revsend.add(x, t, verb)
    mark('snare', t, amp)


def clap(t, amp=1.0, verb=0.3):
    d = 0.4
    base = sos_filter(noise(d, 77), 'bp', (800, 4000))
    env = np.zeros(n_of(d))
    for o in [0, 0.008, 0.017, 0.026]:
        env += np.roll(expdec(d, 0.006 if o < 0.02 else 0.08), n_of(o))
    x = base * env * amp
    drums.add(x, t, 0.55)
    revsend.add(x, t, verb)
    mark('snare', t, amp * 0.8)


HAT_CACHE = {}


def hat(t, amp=0.5, open_=False, p=0.2, mark_it=True):
    key = open_
    if key not in HAT_CACHE:
        d = 0.35 if open_ else 0.06
        tt = tvec(d)
        metal = np.zeros_like(tt)
        for f in [205.3, 369.4, 304.4, 522.7, 800.0, 540.0]:
            metal += np.sign(np.sin(2 * np.pi * f * 2 * tt))
        x = sos_filter(metal * 0.3 + noise(d, 9), 'hp', 7000, 4) * expdec(d, 0.12 if open_ else 0.014)
        HAT_CACHE[key] = x
    x = HAT_CACHE[key] * amp
    drums.add(x, t, 0.5, p)
    if mark_it:
        mark('hat', t, amp)


def taiko(t, amp=1.0, f=70, verb=0.6, p=0.0):
    d = 1.6
    tt = tvec(d)
    body = sweep_sine(d, f * 1.6, f, curve=10) * np.exp(-tt / 0.45)
    skin = sos_filter(noise(d, 11), 'lp', 900) * expdec(d, 0.05)
    x = softclip(body + skin * 0.6, 1.3) * amp
    drums.add(x, t, 0.8, p)
    revsend.add(x, t, verb, p)
    mark('taiko', t, amp)


def twang(t, amp=1.0, f=98, p=0.0, seed=0):
    d = 0.9
    x = karplus(f, d, bright=0.35, decay=0.994, seed=seed)
    x = sos_filter(x, 'hp', 60) * adsr(d, 0.001, 0.2, 0.6, 0.4)
    snap = sos_filter(noise(0.05, seed + 300), 'bp', (600, 3000)) * expdec(0.05, 0.006)
    x[: len(snap)] += snap * 0.5
    music.add(x * amp, t, 0.55, p)
    roomsend.add(x * amp, t, 0.3, p)
    mark('twang', t, amp)


def whoosh(t, dur, f0, f1, amp=1.0, p0=-0.6, p1=0.6, bw=1.2, seed=0, shape='swell'):
    x = noise(dur, 500 + seed)
    x = tv_bandpass(x, lambda tt: f0 * (f1 / f0) ** min(1.0, tt / dur), bw_oct=bw)
    tt = tvec(dur)
    if shape == 'swell':
        env = np.sin(np.pi * np.clip(tt / dur, 0, 1)) ** 1.5
    elif shape == 'rise':
        env = (tt / dur) ** 2.5
    else:  # fall
        env = np.exp(-tt / (dur * 0.35))
    x = x * env * amp
    # moving pan
    pp = p0 + (p1 - p0) * (tt / dur)
    a = (pp + 1) * np.pi / 4
    st = np.stack([x * np.cos(a), x * np.sin(a)])
    fx.add(st, t, 1.0)
    revsend.add(st, t, 0.25)
    mark('whoosh', t, amp)


def thud(t, amp=1.0, p=0.0, seed=0):
    d = 0.25
    tt = tvec(d)
    x = np.sin(2 * np.pi * (180 * np.exp(-tt * 40) + 60) * tt) * np.exp(-tt / 0.05)
    x += sos_filter(noise(d, 900 + seed), 'bp', (300, 2500)) * expdec(d, 0.01) * 0.8
    fx.add(x * amp, t, 0.7, p)
    roomsend.add(x * amp, t, 0.2, p)
    mark('impact', t, amp)


ANVIL_RATIOS = [(1.0, 1.0, 1.2), (2.76, 0.55, 0.7), (5.40, 0.35, 0.45), (8.93, 0.22, 0.3), (13.34, 0.12, 0.2), (1.5, 0.3, 0.9)]


def anvil(t, f0=880, amp=1.0, p=0.0, verb=0.35):
    d = 1.8
    tt = tvec(d)
    x = np.zeros_like(tt)
    for ratio, a, tau in ANVIL_RATIOS:
        x += a * np.sin(2 * np.pi * f0 * ratio * tt + ratio) * np.exp(-tt / tau)
    hammer = sos_filter(noise(d, 21), 'bp', (2000, 10000)) * expdec(d, 0.003)
    body = np.sin(2 * np.pi * 110 * tt) * np.exp(-tt / 0.04)
    x = x * 0.35 + hammer * 0.9 + body * 0.5
    x *= amp
    music.add(x, t, 0.5, p)
    revsend.add(x, t, verb, p)
    mark('anvil', t, amp)


def hiss(t, dur, amp=0.4):
    x = sos_filter(noise(dur, 33), 'hp', 3000, 2) * np.exp(-tvec(dur) / (dur * 0.4)) * np.clip(tvec(dur) / 0.01, 0, 1)
    fx.add(x * amp, t, 1.0, 0.0)
    revsend.add(x * amp, t, 0.2)
    mark('hiss', t, amp)


def crackle(t, dur, dens0=5, dens1=60, amp=0.5, seed=0):
    r = np.random.default_rng(seed)
    tt = 0.0
    while tt < dur:
        dens = dens0 + (dens1 - dens0) * (tt / dur) ** 1.5
        tt += r.exponential(1.0 / dens)
        if tt >= dur:
            break
        d = 0.02
        c = sos_filter(noise(d, int(r.integers(1e6))), 'bp', (1500, 9000)) * expdec(d, 0.0015 + 0.002 * r.random())
        fx.add(c * amp * (0.4 + 0.6 * r.random()), t + tt, 1.0, r.uniform(-0.5, 0.5))
        mark('crackle', t + tt, 0.5)


def boom(t, amp=1.0, f0=62, f1=28, tail=1.4, verb=0.8, p=0.0, crack=1.0):
    d = tail + 1.5
    tt = tvec(d)
    sub = sweep_sine(d, f0 * 1.8, f1, curve=4) * np.exp(-tt / (tail * 0.45))
    body = sos_filter(noise(d, 60), 'lp', 500, 2) * np.exp(-tt / (tail * 0.3))
    cr = sos_filter(noise(d, 61), 'bp', (800, 8000)) * expdec(d, 0.012) * crack
    x = softclip(sub * 1.2 + body * 1.4 + cr * 1.2, 2.2) * amp
    fx.add(x, t, 0.9, p)
    revsend.add(x, t, verb, p)
    mark('boom', t, amp)


def gunshot(t, amp=1.0, big=False, p=0.0, seed=0, room=0.3, mark_it=True):
    d = 0.8 if big else 0.18
    tt = tvec(d)
    cr = sos_filter(noise(d, 700 + seed % 50), 'bp', (400, 7000)) * expdec(d, 0.03 if big else 0.012)
    body = np.sin(2 * np.pi * (110 * np.exp(-tt * 30) + 55) * tt) * np.exp(-tt / (0.12 if big else 0.04))
    x = softclip(cr * 1.5 + body * 1.0, 2.5) * amp
    fx.add(x, t, 0.8, p)
    (revsend if big else roomsend).add(x, t, room, p)
    if mark_it:
        mark('shot', t, amp)


def tick(t, amp=0.5, f=3200, p=0.0, mark_it=True):
    d = 0.05
    tt = tvec(d)
    x = np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.004) + sos_filter(noise(d, 3), 'hp', 4000) * expdec(d, 0.002) * 0.5
    fx.add(x * amp, t, 0.6, p)
    if mark_it:
        mark('tick', t, amp)


def blip(t, f=2000, amp=0.3, d=0.04, p=0.0, kind='blip'):
    tt = tvec(d)
    x = np.sin(2 * np.pi * f * tt) * adsr(d, 0.001, 0.01, 0.7, d * 0.4)
    music.add(x * amp, t, 0.5, p)
    roomsend.add(x * amp, t, 0.2, p)
    mark(kind, t, amp)


def ping(t, f=1400, amp=0.4):
    d = 0.6
    tt = tvec(d)
    x = np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.15) * np.clip(tt / 0.002, 0, 1)
    music.add(x * amp, t, 0.4, 0.0)
    revsend.add(x * amp, t, 0.9)
    mark('ping', t, amp)


def pad(t, dur, notes, amp=0.2, cutoff=900, voices=5, detune=12, attack=0.8, release=1.2, p_spread=0.6):
    tt = tvec(dur)
    env = adsr(dur, attack, 0.5, 0.85, release)
    out = np.zeros((2, len(tt)))
    for ni, m in enumerate(notes):
        f = mtof(m)
        for v in range(voices):
            c = (v - (voices - 1) / 2) * detune / max(1, (voices - 1) / 2)
            s = saw(f, dur, c)
            pp = ((v / max(1, voices - 1)) * 2 - 1) * p_spread
            out += pan(s, pp)
    out = sos_filter(out, 'lp', cutoff, 2) * env / (len(notes) * voices) * amp * 3
    music.add(out, t, 1.0)
    revsend.add(out, t, 0.35)


def bassnote(t, dur, m, amp=0.5, cutoff=300, env_amt=900, drive=2.0, sub=0.6):
    tt = tvec(dur)
    f = mtof(m)
    s = saw(f, dur) * 0.6 + saw(f, dur, 7) * 0.4
    fc = lambda x: cutoff + env_amt * np.exp(-x / 0.08)
    s = tv_lowpass(s, fc, nper=512, slope=2)
    s += np.sin(2 * np.pi * f / 2 * tt) * sub if m > 30 else np.sin(2 * np.pi * f * tt) * sub
    s = softclip(s * adsr(dur, 0.004, 0.1, 0.8, min(0.08, dur * 0.3)), drive)
    bass.add(s * amp, t, 1.0)
    mark('bass', t, amp)


def drone(t, dur, m, amp=0.2, beat_hz=0.15):
    tt = tvec(dur)
    f = mtof(m)
    x = np.sin(2 * np.pi * f * tt) + 0.6 * np.sin(2 * np.pi * (f + beat_hz) * tt) + 0.25 * np.sin(2 * np.pi * 2 * f * tt + 1)
    env = np.clip(tt / 2.0, 0, 1) * np.clip((dur - tt) / 1.5, 0, 1)
    bass.add(x * env * amp, t, 1.0)


def wind(t, dur, amp=0.15, seed=0):
    x = noise(dur, 800 + seed)
    x = tv_bandpass(x, lambda tt: 300 + 250 * np.sin(tt * 0.9 + seed) + 150 * np.sin(tt * 2.3), bw_oct=1.6)
    tt = tvec(dur)
    env = np.clip(tt / 1.0, 0, 1) * np.clip((dur - tt) / 1.0, 0, 1)
    fx.add(np.stack([x * env, np.roll(x, 700) * env]) * amp, t, 1.0)


def shepard(t, dur, amp=0.2, rate0=0.3, rate1=2.5, base=55.0, n_oct=7):
    """Rising Shepard–Risset glissando that accelerates."""
    tt = tvec(dur)
    rate = rate0 + (rate1 - rate0) * (tt / dur) ** 2  # octaves per second
    pos = np.cumsum(rate) / SR  # octaves travelled
    out = np.zeros_like(tt)
    for k in range(n_oct):
        o = (k + pos) % n_oct  # octave position 0..n
        f = base * 2 ** o
        a = np.exp(-0.5 * ((o - n_oct / 2) / (n_oct / 5)) ** 2)
        out += np.sin(2 * np.pi * np.cumsum(f) / SR) * a
    env = (tt / dur) ** 1.2
    out = out * env * amp / 2
    music.add(out, t, 1.0)
    revsend.add(out, t, 0.2)


def reverse_swell(t_end, dur, amp=0.5, lp=6000):
    x = sos_filter(noise(dur, 99), 'lp', lp)
    tt = tvec(dur)
    x = x * (tt / dur) ** 3
    fx.add(np.stack([x, np.roll(x, 300)]) * amp, t_end - dur, 1.0)
    revsend.add(np.stack([x, x]) * amp, t_end - dur, 0.3)


def whistle(t, dur, f0=2400, f1=500, amp=0.15, p=0.0):
    tt = tvec(dur)
    f = f0 * (f1 / f0) ** (tt / dur)
    x = glide_sine(f) * np.clip(tt / 0.3, 0, 1) * (0.4 + 0.6 * tt / dur)
    x += sos_filter(noise(dur, 5), 'bp', (800, 3000)) * 0.08 * (tt / dur)
    music.add(x * amp, t, 0.8, p)
    revsend.add(x * amp, t, 0.3, p)
    mark('whistle', t, amp)


def siren(t, dur, amp=0.07):
    tt = tvec(dur)
    f = 420 + 380 * (0.5 - 0.5 * np.cos(2 * np.pi * tt / 4.0))
    x = glide_sine(f) + 0.3 * glide_sine(f * 2.01)
    x = sos_filter(x, 'bp', (300, 2000)) * np.clip(tt / 1.0, 0, 1) * np.clip((dur - tt) / 1.0, 0, 1)
    music.add(x * amp, t, 0.6, -0.3)
    revsend.add(x * amp, t, 0.8)


def rocket(t, dur, amp=0.8):
    tt = tvec(dur)
    x = noise(dur, 1234)
    x = tv_lowpass(x, lambda s: 200 + 3000 * (s / dur) ** 1.5, nper=2048, slope=2)
    x = softclip(x * 2, 1.5) * np.clip(tt / 0.4, 0, 1) * (0.5 + 0.5 * tt / dur)
    # rumble AM
    x *= 1 + 0.3 * np.sin(2 * np.pi * 13 * tt)
    fx.add(np.stack([x, np.roll(x, 400)]) * amp, t, 1.0)
    revsend.add(np.stack([x, x]) * amp, t, 0.25)


def nuke(t, amp=1.0):
    # 1) the flash: very bright crack + air pressure thump (silent-ish light, but we give it a sharp 'tick')
    d = 9.0
    tt = tvec(d)
    crack = sos_filter(noise(d, 4242), 'hp', 2000) * expdec(d, 0.02) * 0.9
    fx.add(np.stack([crack, np.roll(crack, 20)]) * amp, t, 1.0)
    # sub drop
    sub = sweep_sine(d, 70, 18, curve=0.7) * np.exp(-tt / 3.2) * np.clip(tt / 0.02, 0, 1)
    bass.add(np.stack([sub, sub]) * amp * 0.9, t, 1.0)
    # 2) the blast arrives 0.55 s later: huge lowpassed noise roar with rolling AM, slow decay
    ta = t + 0.55
    roar = noise(d, 4343)
    roar = tv_lowpass(roar, lambda s: 90 + 2600 * np.exp(-s / 0.35) + 300 * np.exp(-s / 3), nper=2048, slope=2)
    env = np.exp(-tt / 2.4) * np.clip(tt / 0.015, 0, 1)
    roll = 1 + 0.5 * np.maximum(0, np.sin(2 * np.pi * (1.3 * tt + 0.3 * np.sin(tt * 2.1))))
    roar = softclip(roar * 3.0, 2.5) * env * roll
    roar2 = np.roll(roar, 900)
    fx.add(np.stack([roar, roar2]) * amp * 0.9, ta, 1.0)
    revsend.add(np.stack([roar, roar2]) * amp * 0.5, ta, 1.0)
    thump = sweep_sine(2.0, 120, 30, curve=6) * expdec(2.0, 0.4)
    drums.add(softclip(thump * 2, 2) * amp, ta, 1.0)
    mark('flash', t, 1.0)
    mark('blast', ta, 1.0)
    mark('boom', ta, 1.0)


def tinnitus(t, dur, f=6800, amp=0.03):
    tt = tvec(dur)
    x = np.sin(2 * np.pi * f * tt) * np.sin(np.pi * np.clip(tt / dur, 0, 1)) ** 2
    music.add(np.stack([x, x * 0.9]) * amp, t, 1.0)


def stutter(t, dur, slice_len, bus):
    """Retrigger the bus content at t for `dur` with slices of slice_len (glitch)."""
    i0 = n_of(t)
    L = n_of(slice_len)
    seg = bus.buf[:, i0: i0 + L].copy()
    fade = np.minimum(1, np.minimum(np.arange(L), L - 1 - np.arange(L)) / 48.0)
    seg *= fade
    k = 0
    while k * slice_len < dur:
        j = i0 + k * L
        m = min(L, bus.n - j)
        bus.buf[:, j: j + m] = seg[:, :m]
        k += 1
    mark('glitch', t, 1.0)


# ================================================================ ARRANGEMENT
SECTIONS = [
    ('stone', 0.0, T(4)), ('bow', T(4), T(7)), ('metal', T(7), T(10)), ('powder', T(10), T(13)),
    ('guns', T(13), T(16)), ('wars', T(16), T(20)), ('modern', T(20), T(24)), ('arsenal', T(24), 54.0),
    ('blast', 54.0, 58.0), ('finale', 58.0, 66.0), ('end', 66.0, DUR),
]

# ---- STONE (bars 0–3, 0–8 s): drone, wind, knapping (one strike a second), the first throw
drone(0.0, 10.0, D1 + 12, 0.10)
drone(0.0, 9.0, D1, 0.16)
wind(0.0, 9.5, 0.10, seed=1)
knap_times = [1.0, 2.0, 3.0, 4.0, 5.0]
for i, kt in enumerate(knap_times):
    knap(kt, 0.8 + 0.2 * (i % 3 == 0), seed=i, p=np.sin(i * 1.7) * 0.3)
taiko(T(2, 0), 0.7, 58, 0.7)
taiko(T(3, 0), 0.9, 52, 0.8)  # the throw
whoosh(T(2, 3.3), 0.45, 300, 2500, 0.5, -0.3, 0.1, seed=1, shape='rise')  # wind-up
whoosh(T(3, 0), 1.9, 2600, 500, 0.9, -0.8, 0.8, bw=1.0, seed=2)  # the flight of the spear
mark('throw', T(3, 0), 1.0)
pad(T(1, 0), 7.5, [D2, D2 + 7], amp=0.10, cutoff=500, attack=3.0, release=2.0)
reverse_swell(T(4), 1.2, 0.35)

# ---- BOW (bars 4–6, 8–14 s)
thud(T(4), 1.0)  # the spear lands
taiko(T(4), 1.0, 55, 0.6)
kick(T(4), 0.9, 140, 40, 0.4, 1.2, 0.1)
for b in range(4, 7):
    for bt in range(4):
        if (b, bt) != (4, 0):
            kick(T(b, bt), 0.55 + 0.15 * (bt == 0), 140, 42, 0.25, 1.2, 0.1)
        if bt in (1, 3):
            taiko(T(b, bt + 0.5), 0.35, 90, 0.4, p=0.4 * (1 if bt == 1 else -1))
    bassnote(T(b), BAR * 0.95, D2 - 12 + 12, 0.35, cutoff=160, env_amt=300, drive=1.5, sub=0.8)
# volley 1: nocking twangs then release swarm
for i in range(6):
    twang(T(5, 0) + i * 0.035, 0.45, 82 + i * 7, p=-0.7 + i * 0.28, seed=10 + i)
whoosh(T(5, 0), 1.7, 900, 3800, 0.8, -0.9, 0.9, bw=1.4, seed=5)
mark('volley', T(5, 0), 1.0)
rr = np.random.default_rng(11)
imp1 = sorted(T(5, 3) + rr.uniform(0, 1.0, 26))
for i, it in enumerate(imp1):
    thud(it, 0.25 + 0.3 * rr.random(), p=rr.uniform(-0.8, 0.8), seed=i)
for i in range(8):
    twang(T(6, 0) + i * 0.025, 0.5, 78 + i * 9, p=0.7 - i * 0.2, seed=30 + i)
whoosh(T(6, 0), 1.5, 1000, 4200, 0.9, 0.9, -0.9, bw=1.4, seed=6)
mark('volley', T(6, 0), 1.0)
imp2 = sorted(T(6, 2.8) + rr.uniform(0, 1.1, 40))
for i, it in enumerate(imp2):
    thud(it, 0.25 + 0.35 * rr.random(), p=rr.uniform(-0.9, 0.9), seed=50 + i)
pad(T(4), 6.0, [D2, D2 + 3, D2 + 7, D2 + 12], amp=0.12, cutoff=700, attack=1.0, release=1.0)
reverse_swell(T(7), 1.0, 0.4)

# ---- METAL (bars 7–9, 14–20 s): anvils in 3-3-2, forge
anvil_notes = [74, 77, 69, 74, 72, 77, 81, 74]  # D5 F5 A4 ...
pattern = [0, 1.5, 3.0]  # 3-3-2 in 8ths within a bar (beats)
k = 0
for b in range(7, 10):
    kick(T(b, 0), 1.0, 170, 40, 0.3, 2.0)
    kick(T(b, 2), 0.8, 170, 40, 0.3, 2.0)
    snare(T(b, 1), 0.5, 0.3, 210, seed=b)
    snare(T(b, 3), 0.6, 0.4, 210, seed=b + 1)
    for pp in pattern:
        anvil(T(b, pp), mtof(anvil_notes[k % len(anvil_notes)]), 0.55 + 0.25 * (pp == 0), p=0.3 * np.sin(k))
        k += 1
    for s in range(8):
        hat(T(b, s * 0.5 + 0.25), 0.18, p=0.3)
    riff = [D2, D2, D2 + 1, D2, D2 + 3, D2, D2 + 1, D2 - 2]
    for s, m in enumerate(riff):
        bassnote(T(b, s * 0.5), BEAT * 0.45, m, 0.42, cutoff=220, env_amt=1400, drive=2.5)
anvil(T(9, 3.5), mtof(86), 0.5)
hiss(T(9, 2.0), 2.0, 0.35)  # quench
pad(T(7), 6.0, [D2, D2 + 1, D2 + 5, D2 + 8], amp=0.10, cutoff=1100)

# ---- POWDER (bars 10–12, 20–26 s): fuse, formula, CANNON
kick(T(10), 1.0, 150, 38, 0.5, 2.0)
boom(T(10), 0.35, 80, 35, 0.8, 0.4)  # a lower thump for the downbeat
crackle(T(10), 3.8, 6, 90, 0.35, seed=3)  # the fuse
for s in range(16):  # clock ticks in 8ths → 16ths
    tick(T(10, s * 0.25), 0.25 + 0.2 * (s % 4 == 0), 2600)
for s in range(8):
    tick(T(10.5) + s * BEAT / 2, 0.3, 3000)
for s in range(8):
    tick(T(11) - BEAT * 1.5 + s * BEAT / 8 * 1.5, 0.2 + s * 0.04, 3400) if s < 8 else None
pad(T(10), 4.0, [D2, D2 + 1, D2 + 6], amp=0.12, cutoff=800, attack=0.5, release=0.3)
bassnote(T(10), BAR * 1.9, D1 + 12, 0.5, cutoff=120, env_amt=200, drive=1.3, sub=1.0)
reverse_swell(T(11), 1.3, 0.5, lp=8000)
# CANNON at bar 11
boom(T(11), 1.25, 70, 26, 1.8, 0.9)
kick(T(11), 1.1, 180, 36, 0.5, 2.5)
mark('cannon', T(11), 1.0)
whoosh(T(11, 0.2), 1.6, 3000, 700, 0.35, -0.2, 0.9, bw=0.8, seed=8, shape='fall')  # the ball in flight
thud(T(11, 3.5), 0.6)
for b in (11, 12):
    kick(T(b, 2.5) if b == 11 else T(b, 0), 0.9, 160, 38, 0.35, 2.2)
    snare(T(b, 2), 1.0, 0.8, 180, seed=20 + b)
    for s in range(8):
        hat(T(b, s * 0.5), 0.12 + 0.1 * (s % 2), p=-0.2)
    bassnote(T(b), BAR * 0.9, D2, 0.5, cutoff=180, env_amt=600, drive=2.5)
boom(T(12), 0.8, 65, 30, 1.2, 0.7, p=0.3)
mark('cannon', T(12), 0.8)
kick(T(12, 3), 0.7, 160, 38, 0.3, 2)
kick(T(12, 3.5), 0.8, 160, 38, 0.3, 2)
pad(T(11), 5.0, [D2 - 12 + 12, D2 + 1, D2 + 5], amp=0.14, cutoff=900, attack=0.3)

# ---- GUNS (bars 13–15, 26–32 s): rate of fire becomes rhythm
gunshot(T(13), 1.0, big=True, room=0.9)
mark('musket', T(13), 1.0)
kick(T(13), 0.9, 160, 40, 0.3, 2)
gunshot(T(13, 2), 0.9, big=True, room=0.9, p=0.3)
mark('musket', T(13, 2), 0.9)
kick(T(13, 2), 0.7)
for s in range(3):
    tick(T(13, 1) + s * 0.12, 0.25, 1800 + s * 300)  # ramrod / reload clicks
    tick(T(13, 3) + s * 0.12, 0.25, 1800 + s * 300)
# Gatling (bar 14 first half): 8ths; Maxim (bar 14 second half → 15.0): 16ths; Minigun (bar 15): 32nds → buzz
gat = [T(14, s * 0.5) for s in range(4)]
maxim = [T(14, 2 + s * 0.25) for s in range(8)]
mini1 = [T(15, s * 0.125) for s in range(16)]  # 32nds for 2 beats
buzz = list(np.arange(T(15, 2), T(15, 3.5), 0.01))  # 100 rounds/s = 6000/min
for i, st in enumerate(gat):
    gunshot(st, 0.75, p=-0.3, seed=i, room=0.4)
mark('gatling', T(14), 1.0)
for i, st in enumerate(maxim):
    gunshot(st, 0.65, p=0.0, seed=10 + i, room=0.3)
mark('maxim', T(14, 2), 1.0)
for i, st in enumerate(mini1):
    gunshot(st, 0.5, p=0.25, seed=30 + i, room=0.2)
mark('minigun', T(15), 1.0)
for i, st in enumerate(buzz):
    gunshot(st, 0.32 + 0.1 * (i % 2), p=0.25, seed=60 + i, room=0.1, mark_it=(i % 4 == 0))
mark('buzz', T(15, 2), 1.0)
for b in (14, 15):
    for bt in range(4):
        if not (b == 15 and bt == 3):
            kick(T(b, bt), 0.85, 170, 40, 0.28, 2.2)
    for s, m in enumerate([D2, D2, D2 + 12, D2, D2 + 1, D2, D2 + 10, D2 + 1]):
        if not (b == 15 and s >= 7):
            bassnote(T(b, s * 0.5), BEAT * 0.4, m, 0.4, cutoff=250, env_amt=1500, drive=3.0)
snare(T(14, 1), 0.6, 0.4)
snare(T(14, 3), 0.7, 0.4)
snare(T(15, 1), 0.8, 0.5)
shepard(T(14), 3.75, 0.12, 0.4, 1.8)
reverse_swell(T(15, 3.5), 0.9, 0.3)

# ---- WARS (bars 16–19, 32–40 s): industrial march, bombs, the ledger. Hiroshima at bar 19.
boom(T(16), 1.0, 60, 28, 1.2, 0.8)
mark('slam', T(16), 1.0)
chords = [[D2, D2 + 3, D2 + 7], [D2 - 2, D2 + 2, D2 + 5], [D2 - 5, D2 - 2, D2 + 3]]
for i, b in enumerate(range(16, 19)):
    pad(T(b), BAR, [n + 12 for n in chords[i]], amp=0.16, cutoff=1300, attack=0.05, release=0.3, voices=4)
    for bt in range(4):
        kick(T(b, bt), 1.0, 180, 38, 0.3, 3.0)
        for s in range(4):
            hat(T(b, bt + s * 0.25), 0.1 + 0.12 * (s == 2), p=0.25)
    snare(T(b, 1), 1.0, 0.7, 180, seed=b)
    snare(T(b, 3), 1.1, 0.8, 180, seed=b + 7)
    riff = [D2, D2 + 12, D2, D2 + 10, D2, D2 + 8, D2 + 7, D2 + 3]
    for s, m in enumerate(riff):
        bassnote(T(b, s * 0.5), BEAT * 0.42, chords[i][0] - D2 + m, 0.45, cutoff=280, env_amt=1800, drive=3.5)
siren(T(16), 6.0, 0.06)
whistle(T(16, 1), 1.5, 2600, 420, 0.13, p=-0.4)
boom(T(17), 0.8, 70, 30, 1.0, 0.6, p=-0.4)
mark('bomb', T(17), 0.8)
whistle(T(17, 2), 2.0, 2800, 380, 0.14, p=0.4)
boom(T(18), 1.0, 60, 26, 1.2, 0.7, p=0.3)
mark('bomb', T(18), 1.0)
mark('ww2', T(18), 1.0)
for s in range(24):  # teletype / morse
    if np.random.default_rng(s).random() > 0.35:
        blip(T(17) + s * 0.125, 1100 + 400 * (s % 3), 0.08, 0.05, p=0.5, kind='morse')
# Hiroshima (bar 19 = 38 s): the band drops out on 37.75; a single high tone, then the flash
tinnitus(T(18, 3.0), 0.5, 5200, 0.05)
mark('hiro_pre', T(18, 3.5), 1.0)
boom(T(19), 1.3, 55, 22, 2.2, 1.0, crack=1.5)
mark('hiroshima', T(19), 1.0)
drone(T(19), 3.0, D1, 0.18)
reverse_swell(T(20), 1.2, 0.45)

# ---- MODERN (bars 20–23, 40–48 s): precision, drones, satellites. Cold electronic.
arp = [D3 + 12, D3 + 13, D3 + 17, D3 + 12, D3 + 20, D3 + 17, D3 + 13, D3 + 24]
for b in range(20, 24):
    for bt in range(4):
        kick(T(b, bt), 0.95, 130, 45, 0.18, 1.5, 0.5)
        if bt in (1, 3):
            clap(T(b, bt), 0.8, 0.35)
    for s in range(16):
        hat(T(b, s * 0.25), 0.07 + 0.08 * (s % 4 == 2) + 0.04 * (s % 2), p=0.35 * np.sin(s))
        m = arp[(s + b) % len(arp)]
        blip(T(b, s * 0.25), mtof(m), 0.07, 0.07, p=0.4 * np.sin(s * 1.3), kind='arp')
    for s, m in enumerate([D1 + 12, D1 + 12, D1 + 13, D1 + 12]):
        bassnote(T(b, s), BEAT * 0.8, m, 0.5, cutoff=90, env_amt=500, drive=1.3, sub=1.0)
pad(T(20), 8.0, [D2 + 12, D2 + 13, D2 + 17, D2 + 22], amp=0.08, cutoff=2000, attack=1.5)
# 9,000 → 1: lock-on beeps accelerating into bar 22
lock = [T(21, 0), T(21, 1), T(21, 2), T(21, 2.5), T(21, 3), T(21, 3.25), T(21, 3.5), T(21, 3.625), T(21, 3.75), T(21, 3.875)]
for lt in lock:
    blip(lt, 2400, 0.12, 0.05, kind='lock')
blip(T(22) - 0.01, 2400, 0.12, 0.45, kind='locked')
kick(T(22), 1.1, 200, 40, 0.4, 3)
boom(T(22), 0.6, 90, 40, 0.6, 0.5)
mark('precision', T(22), 1.0)
for i in range(4):
    ping(T(20) + i * BAR, 1500, 0.2)
stutter(T(21, 3.5), BEAT * 0.5, BEAT / 8, drums)
stutter(T(23, 3.0), BEAT, BEAT / 4, drums)
ping(T(22, 2), 1200, 0.3)
ping(T(23), 1800, 0.25)
reverse_swell(T(24), 1.5, 0.5)

# ---- ARSENAL + LAUNCH (bars 24–26.7, 48–54 s)
boom(T(24), 1.1, 50, 24, 1.8, 0.9)
kick(T(24), 1.1, 150, 32, 0.6, 2)
mark('arsenal', T(24), 1.0)
drone(T(24), 6.0, D1, 0.2, 0.4)
pad(T(24), 5.4, [D2, D2 + 1, D2 + 6, D2 + 11], amp=0.14, cutoff=900, attack=0.1, release=0.1)
for bt in range(1, 4):
    kick(T(24, bt), 0.6, 110, 36, 0.4, 1.4)  # heartbeat-like
    kick(T(24, bt) + 0.18, 0.4, 100, 34, 0.35, 1.2)
kick(T(25), 0.9, 150, 34, 0.5, 2)
rocket(T(25), 3.4, 0.55)
mark('launch', T(25), 1.0)
shepard(T(25), 3.4, 0.22, 0.6, 4.5)
# accelerating clock: interval shrinks from a quarter to ~30 ms
tt_ = T(25)
iv = BEAT
while tt_ < 53.35:
    tick(tt_, 0.2 + 0.3 * (tt_ - T(25)) / 3.4, 2800 + 1500 * (tt_ - T(25)) / 3.4)
    iv = max(0.028, iv * 0.9)
    tt_ += iv
for s in range(8):
    snare(T(26) + s * BEAT / 2 * (1 - s * 0.05), 0.3 + 0.08 * s, 0.3, 200, seed=s)
# vacuum 53.4 → 54.0 (nothing)

# ---- BLAST (54 s)
with stem_tag('Nuke_Blast'): nuke(54.0, 1.0)
with stem_tag('Drone'): drone(55.0, 8.0, D1, 0.12, 0.08)

# ---- HOLD (54–58 s): the roar dies; far away, more launches; the drums creep back in
with stem_tag('Tinnitus'): tinnitus(55.5, 3.0, 6800, 0.03)
for lt in [56.3, 56.9, 57.35, 57.7]:
    with stem_tag('Far_Launch_Booms'): boom(lt, 0.25, 90, 40, 0.8, 0.9, p=np.sin(lt * 3) * 0.6, crack=0.3)
    mark('farlaunch', lt, 1.0)
with stem_tag('Reverse_Swell'): reverse_swell(T(29), 2.0, 0.6, lp=9000)
with stem_tag('Shepard_Riser'): shepard(T(28), 2.0, 0.08, 0.3, 1.2)

# ---- FINALE (58–66 s): the part-6 march, bigger every bar; each downbeat pulls the camera back
fin_chords = [[D2, D2 + 3, D2 + 7], [D2 - 2, D2 + 2, D2 + 5], [D2 - 5, D2 - 2, D2 + 3], [D2 + 1, D2 + 5, D2 + 8]]
# pre-roll (56–58 s): only the finale's kick comes in a bar early — four beats, rising from weak to full over
# 56–57 s (then full at 57 and 57.5), leading into the march at 58
for bt, amp_k in zip(range(4), [0.15, 0.55, 1.0, 1.0]):
    with stem_tag('Kick'): kick(T(28, bt), amp_k, 180, 38, 0.3, 3.0)

for i, b in enumerate(range(29, 33)):
    with stem_tag('Downbeat_Boom'): boom(T(b), 0.55 + 0.12 * i, 62, 28, 1.0, 0.7)
    mark('zoom', T(b), 1.0)
    with stem_tag('Synth_Pad'): pad(T(b), BAR, [n + 12 for n in fin_chords[i]], amp=0.15 + 0.03 * i, cutoff=1300 + 500 * i, attack=0.05, release=0.2, voices=4)
    for bt in range(4):
        with stem_tag('Kick'): kick(T(b, bt), 1.0, 180, 38, 0.3, 3.0)
        if i >= 2:
            with stem_tag('Kick'): kick(T(b, bt + 0.5), 0.55, 180, 38, 0.2, 3.0)
        sub = 4 if i < 2 else 8
        for sx in range(sub):
            with stem_tag('HiHat'): hat(T(b, bt + sx / sub), 0.08 + 0.1 * (sx == sub // 2) + 0.03 * i, p=0.3)
    with stem_tag('Snare'): snare(T(b, 1), 1.0, 0.7, 180, seed=40 + b)
    with stem_tag('Snare'): snare(T(b, 3), 1.1, 0.8, 180, seed=47 + b)
    riff = [D2, D2 + 12, D2, D2 + 10, D2, D2 + 8, D2 + 7, D2 + 3]
    for sx, m in enumerate(riff):
        with stem_tag('Bass_Riff'): bassnote(T(b, sx * 0.5), BEAT * 0.42, fin_chords[i][0] - D2 + m, 0.47, cutoff=300, env_amt=1900, drive=3.5)
    for k in range(3 + 2 * i):  # launches: rising whooshes
        with stem_tag('Launch_Whoosh'): whoosh(T(b) + 0.15 + k * (1.7 / (3 + 2 * i)), 0.6, 500, 3500, 0.12, -0.8 + 0.4 * k % 1.6, 0.8, bw=1.0, seed=600 + b * 10 + k, shape='rise')
    for k in range(2 + 3 * i):  # impacts
        with stem_tag('Impacts'): boom(T(b) + 0.9 + k * (1.0 / (2 + 3 * i)), 0.12 + 0.03 * i, 100, 45, 0.4, 0.4, p=np.sin(k * 2.3), crack=0.5)
with stem_tag('Siren'): siren(T(29), 8.0, 0.07)
with stem_tag('Anvil'): anvil(T(31), mtof(74), 0.5)
with stem_tag('Anvil'): anvil(T(31, 2), mtof(77), 0.5)
with stem_tag('Shepard_Riser'): shepard(T(31), 4.0, 0.2, 0.8, 5.0)
for sx in range(16):  # snare roll into the pop
    with stem_tag('Snare_Roll'): snare(T(32, 2) + sx * BEAT / 8, 0.3 + 0.045 * sx, 0.3, 200, seed=sx)
riser_t = T(32)
with stem_tag('Riser_Whoosh'): whoosh(riser_t, BAR, 400, 9000, 0.5, -0.2, 0.2, bw=1.5, seed=77, shape='rise')


def pop(t, amp=0.6):
    """A soap bubble: a tiny upward chirp and a wet click."""
    d = 0.08
    tt = tvec(d)
    f = 500 + 2600 * (tt / d) ** 0.5
    x = glide_sine(f) * np.exp(-tt / 0.012) * np.clip(tt / 0.0008, 0, 1)
    x += sos_filter(noise(d, 4040), 'bp', (2000, 9000)) * expdec(d, 0.0025) * 0.6
    music.add(x * amp, t, 1.0, 0.0)
    mark('pop', t, 1.0)


POP = T(33)  # 66.0
with stem_tag('Pop'): pop(POP, 1.0)

# ================================================================ MIX
print('reverbs...')
hall = make_ir(3.2, 0.03, 5000, seed=4)
room = make_ir(0.9, 0.008, 7000, seed=5)
wet_h = convolve_st(revsend.buf, hall) * 0.32
wet_r = convolve_st(roomsend.buf, room) * 0.35

stems = {
    'drums': drums.buf,
    'bass': bass.buf,
    'music': music.buf,
    'fx': fx.buf,
    'verb': wet_h + wet_r,
}


def duck(bufs, t0, t1, fade_out=0.03, fade_in=0.003, floor=0.0):
    i0, i1 = n_of(t0), n_of(t1)
    n = drums.n
    g = np.ones(n)
    fo, fi = n_of(fade_out), n_of(fade_in)
    g[i0:i0 + fo] = np.linspace(1, floor, fo)
    g[i0 + fo:i1 - fi] = floor
    g[i1 - fi:i1] = np.linspace(floor, 1, fi)
    for b in bufs:
        b *= g


duck([drums.buf, bass.buf, wet_h, wet_r], T(15, 3.6), T(16), 0.02, 0.002, 0.05)
duck([drums.buf, bass.buf], T(18, 3.5), T(19), 0.02, 0.002, 0.0)
duck([drums.buf, bass.buf, music.buf, fx.buf, wet_h, wet_r], 53.4, 54.0, 0.05, 0.001, 0.0)
_popbuf = music.buf[:, n_of(POP):n_of(POP + 0.1)].copy()
for _b in [drums.buf, bass.buf, music.buf, fx.buf, wet_h, wet_r]:
    _b[:, n_of(POP) - n_of(0.004):] *= 0.0
music.buf[:, n_of(POP):n_of(POP + 0.1)] = _popbuf
mix = drums.buf * 1.0 + bass.buf * 0.9 + music.buf * 0.9 + fx.buf * 1.0 + wet_h + wet_r
# gentle master: HP at 20 Hz, glue compressor, soft clip
mix = sos_filter(mix, 'hp', 22, 2)
_mix_hp = mix.copy()


def compress(x, thr_db=-14, ratio=2.5, att=0.005, rel=0.12, makeup_db=3):
    lvl = np.max(np.abs(x), axis=0)
    a_a = np.exp(-1 / (att * SR))
    a_r = np.exp(-1 / (rel * SR))
    # envelope follower (vectorised approx: peak hold via lfilter on release + attack)
    env = signal.lfilter([1 - a_r], [1, -a_r], lvl)
    env = np.maximum(env, signal.lfilter([1 - a_a], [1, -a_a], lvl))
    db = 20 * np.log10(np.maximum(env, 1e-6))
    over = np.maximum(0, db - thr_db)
    gain_db = -over * (1 - 1 / ratio) + makeup_db
    globals()['_GC'] = 10 ** (gain_db / 20)
    return x * 10 ** (gain_db / 20)


mix = compress(mix)
peak = np.max(np.abs(mix))
mix = mix / peak * 1.25
_pre_sc = mix.copy()
mix = softclip(mix, 1.2) * 0.93
# fade the very end
mix[:, -n_of(0.3):] *= np.linspace(1, 0, n_of(0.3))
# true-peak safety: oversampled peak envelope → smooth gain reduction to -1 dBTP
from scipy.ndimage import maximum_filter1d, uniform_filter1d
ceil = 10 ** (-1.2 / 20)
env = np.zeros(mix.shape[1])
for ch in range(2):
    u = signal.resample_poly(mix[ch], 4, 1)
    env = np.maximum(env, np.abs(u).reshape(-1, 4).max(axis=1)[: mix.shape[1]])
g = np.minimum(1.0, ceil / np.maximum(env, 1e-9))
g = maximum_filter1d(1 - g, n_of(0.004))
g = 1 - uniform_filter1d(g, n_of(0.003))
mix *= g
print('TP gain min', g.min())

if STEM_ON:
    # the ending's instruments, each with its own reverb, through the same master gains (compressor, level,
    # limiter) as the full mix; what is left (tails from before 54 s, soft-clip) goes to 00_Other
    from scipy.io import wavfile
    W0, W1 = n_of(54.0), n_of(DUR)
    fade = np.ones(mix.shape[1]); fade[-n_of(0.3):] = np.linspace(1, 0, n_of(0.3))
    _safe = np.where(np.abs(_pre_sc) < 1e-9, 1e-9, _pre_sc)
    R = softclip(_safe, 1.2) / _safe  # the soft clipper as a per-sample gain (exact for the sum of the stems)
    G = (_GC * (1.25 / peak) * fade * g)[None, :] * R * 0.93
    order = ['Nuke_Blast', 'Drone', 'Tinnitus', 'Far_Launch_Booms', 'Reverse_Swell', 'Shepard_Riser', 'Kick', 'Snare', 'HiHat', 'Snare_Roll',
             'Downbeat_Boom', 'Impacts', 'Launch_Whoosh', 'Riser_Whoosh', 'Bass_Riff', 'Synth_Pad', 'Siren', 'Anvil', 'Pop']
    sdir = os.path.join(OUT, 'stems_ending')
    os.makedirs(sdir, exist_ok=True)
    total = np.zeros((2, W1 - W0))
    for k, name in enumerate(order):
        d = STEMS.get(name, {})
        z = np.zeros((2, n_of(DUR)))
        x = sum((d[b].buf * gn for b, gn in [('drums', 1.0), ('bass', 0.9), ('music', 0.9), ('fx', 1.0)] if b in d), z.copy())
        if 'revsend' in d:
            x = x + convolve_st(d['revsend'].buf, hall)[:, :x.shape[1]] * 0.32
        if 'roomsend' in d:
            x = x + convolve_st(d['roomsend'].buf, room)[:, :x.shape[1]] * 0.35
        if name != 'Pop':
            x[:, n_of(POP) - n_of(0.004):] = 0.0
        x = sos_filter(x, 'hp', 22, 2) * G
        seg = x[:, W0:W1]
        total += seg
        wavfile.write(os.path.join(sdir, f'{k + 1:02d}_{name}.wav'), SR, (np.clip(seg.T, -1, 1) * 32767).astype(np.int16))
        print('stem', name, 'peak %.3f' % np.max(np.abs(seg)))
    STEM_TOTAL, STEM_W = total, (W0, W1)


def write_wav(path, x):
    from scipy.io import wavfile
    y = np.clip(x.T, -1, 1)
    wavfile.write(path, SR, (y * 32767).astype(np.int16))


write_wav(os.path.join(OUT, 'score.wav'), mix)
os.makedirs(os.path.join(HERE, '..', 'audio'), exist_ok=True)
write_wav(os.path.join(HERE, '..', 'audio', 'score.wav'), mix)
if STEM_ON:
    W0, W1 = STEM_W
    other = mix[:, W0:W1] - STEM_TOTAL
    write_wav(os.path.join(OUT, 'stems_ending', '00_Other_tails_and_master.wav'), other)
    write_wav(os.path.join(OUT, 'stems_ending', 'FULL_MIX_ending_54-68s.wav'), mix[:, W0:W1])
    print('other peak %.3f rms dB %.1f' % (np.max(np.abs(other)), 20 * np.log10(np.sqrt(np.mean(other ** 2)) + 1e-9)))
rms = np.sqrt(np.mean(mix ** 2))
print('peak', np.max(np.abs(mix)), 'rms dBFS', 20 * np.log10(rms))

# ================================================================ ANALYSIS → data/audio.json
FPS = 100
hop = SR // FPS


def env_of(x, lo=None, hi=None):
    m = x.mean(axis=0)
    if lo or hi:
        if lo and hi:
            m = sos_filter(m, 'bp', (lo, hi), 2)
        elif lo:
            m = sos_filter(m, 'hp', lo, 2)
        else:
            m = sos_filter(m, 'lp', hi, 2)
    n = len(m) // hop
    r = np.sqrt(np.mean(m[: n * hop].reshape(n, hop) ** 2, axis=1))
    # smooth a little and normalise to the 99th percentile
    r = signal.lfilter([0.5], [1, -0.5], r)
    p = np.percentile(r, 99.5) + 1e-9
    return np.clip(r / p, 0, 1)


feat = {
    'rms': env_of(mix), 'low': env_of(mix, hi=150), 'mid': env_of(mix, 150, 2500), 'high': env_of(mix, lo=2500),
    'drums': env_of(drums.buf), 'bass': env_of(bass.buf), 'other': env_of(music.buf + fx.buf), 'vocal': env_of(music.buf),
}
beats = [round(i * BEAT, 4) for i in range(int(DUR / BEAT) + 1)]
downbeats = [round(i * BAR, 4) for i in range(int(DUR / BAR) + 1)]
for k in ONS:
    ONS[k].sort()
aj = {
    'duration': DUR, 'bpm': BPM, 'fps': FPS, 'beats': beats, 'downbeats': downbeats,
    'sections': [{'name': n, 'start': s, 'end': e} for n, s, e in SECTIONS],
    'features': {k: [round(float(v), 3) for v in a] for k, a in feat.items()},
    'onsets': ONS,
}
os.makedirs(os.path.join(HERE, '..', 'data'), exist_ok=True)
with open(os.path.join(HERE, '..', 'data', 'audio.json'), 'w') as f:
    json.dump(aj, f)
print('onset kinds:', {k: len(v) for k, v in ONS.items()})
