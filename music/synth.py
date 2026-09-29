"""Tiny synthesis toolkit (numpy/scipy). Everything mono float64 at SR unless noted; stereo = (2, n)."""
import numpy as np
from scipy import signal

SR = 48000
RNG = np.random.default_rng(7)


def n_of(sec):
    return int(round(sec * SR))


def tvec(dur):
    return np.arange(n_of(dur)) / SR


def noise(dur, seed=None):
    r = np.random.default_rng(seed) if seed is not None else RNG
    return r.standard_normal(n_of(dur))


def expdec(dur, tau, attack=0.0005):
    t = tvec(dur)
    e = np.exp(-t / tau)
    if attack > 0:
        e *= np.clip(t / attack, 0, 1)
    return e


def adsr(dur, a=0.01, d=0.1, s=0.7, r=0.2):
    n = n_of(dur)
    t = np.arange(n) / SR
    env = np.ones(n) * s
    env[t < a] = t[t < a] / max(a, 1e-6)
    m = (t >= a) & (t < a + d)
    env[m] = 1 - (1 - s) * (t[m] - a) / max(d, 1e-6)
    rel = t > dur - r
    env[rel] *= np.clip((dur - t[rel]) / max(r, 1e-6), 0, 1)
    return env


def sweep_sine(dur, f0, f1, curve=8.0, phase=0.0):
    """Sine whose frequency glides exponentially-ish from f0 to f1 (fast at start)."""
    t = tvec(dur)
    f = f1 + (f0 - f1) * np.exp(-t * curve)
    ph = 2 * np.pi * np.cumsum(f) / SR + phase
    return np.sin(ph)


def glide_sine(freqs):
    """Sine following a per-sample frequency array."""
    return np.sin(2 * np.pi * np.cumsum(freqs) / SR)


def saw(freq, dur, detune_cents=0.0, phase=None):
    """Band-limited-ish saw via polyBLEP."""
    n = n_of(dur)
    f = freq * 2 ** (detune_cents / 1200)
    if np.ndim(f) == 0:
        f = np.full(n, f)
    dt = f / SR
    p0 = RNG.random() if phase is None else phase
    ph = (p0 + np.cumsum(dt)) % 1.0
    y = 2 * ph - 1
    # polyBLEP
    m1 = ph < dt
    x = ph[m1] / dt[m1]
    y[m1] -= x + x - x * x - 1
    m2 = ph > 1 - dt
    x = (ph[m2] - 1) / dt[m2]
    y[m2] -= x * x + x + x + 1
    return y


def sq(freq, dur):
    s1 = saw(freq, dur, phase=0.0)
    s2 = saw(freq, dur, phase=0.5)
    return 0.5 * (s1 - s2)


def sos_filter(x, kind, f, order=2, q=None):
    nyq = SR / 2
    if kind == 'lp':
        sos = signal.butter(order, min(f / nyq, 0.99), 'low', output='sos')
    elif kind == 'hp':
        sos = signal.butter(order, max(f / nyq, 1e-4), 'high', output='sos')
    elif kind == 'bp':
        lo, hi = f
        sos = signal.butter(order, [max(lo / nyq, 1e-4), min(hi / nyq, 0.99)], 'band', output='sos')
    else:
        raise ValueError(kind)
    return signal.sosfilt(sos, x, axis=-1)


def tv_bandpass(x, fc_curve, bw_oct=1.0, nper=1024):
    """Time-varying spectral band-pass: fc_curve(t) (Hz) evaluated per STFT frame. Gaussian in log-frequency."""
    f, tt, Z = signal.stft(x, SR, nperseg=nper, noverlap=nper * 3 // 4)
    fc = np.maximum(np.asarray([fc_curve(ti) for ti in tt]), 20.0)
    lf = np.log2(np.maximum(f, 1.0))[:, None]
    g = np.exp(-0.5 * ((lf - np.log2(fc)[None, :]) / (bw_oct / 2)) ** 2)
    _, y = signal.istft(Z * g, SR, nperseg=nper, noverlap=nper * 3 // 4)
    y = y[: len(x)]
    if len(y) < len(x):
        y = np.pad(y, (0, len(x) - len(y)))
    return y


def tv_lowpass(x, fc_curve, nper=1024, slope=4.0):
    f, tt, Z = signal.stft(x, SR, nperseg=nper, noverlap=nper * 3 // 4)
    fc = np.maximum(np.asarray([fc_curve(ti) for ti in tt]), 20.0)
    g = 1.0 / np.sqrt(1 + (f[:, None] / fc[None, :]) ** (2 * slope))
    _, y = signal.istft(Z * g, SR, nperseg=nper, noverlap=nper * 3 // 4)
    y = y[: len(x)]
    if len(y) < len(x):
        y = np.pad(y, (0, len(x) - len(y)))
    return y


def karplus(freq, dur, bright=0.5, decay=0.996, seed=1):
    n = n_of(dur)
    N = max(2, int(SR / freq))
    r = np.random.default_rng(seed)
    buf = r.uniform(-1, 1, N)
    buf = sos_filter(buf, 'lp', 800 + 6000 * bright)
    out = np.zeros(n)
    idx = 0
    prev = 0.0
    for i in range(n):
        v = buf[idx]
        out[i] = v
        nv = decay * 0.5 * (v + prev)
        prev = v
        buf[idx] = nv
        idx = (idx + 1) % N
    return out


def softclip(x, drive=1.0):
    return np.tanh(x * drive) / np.tanh(drive)


def pan(x, p):
    """p in [-1, 1] → stereo (2, n), constant power."""
    a = (p + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)])


def make_ir(dur=2.5, predelay=0.02, damp=6000, seed=3, early=True):
    r = np.random.default_rng(seed)
    n = n_of(dur)
    t = np.arange(n) / SR
    env = np.exp(-t / (dur / 6.9))  # -60 dB at dur
    ir = np.stack([r.standard_normal(n) * env, r.standard_normal(n) * env])
    # darker tail over time
    ir[0] = tv_lowpass(ir[0], lambda tt: max(400.0, damp * np.exp(-tt / (dur * 0.5))))
    ir[1] = tv_lowpass(ir[1], lambda tt: max(400.0, damp * np.exp(-tt / (dur * 0.5))))
    pd = n_of(predelay)
    ir = np.pad(ir, ((0, 0), (pd, 0)))
    if early:
        for k in range(8):
            d = n_of(0.005 + r.random() * 0.06)
            ir[k % 2, pd + d] += (0.5 - k * 0.05) * (1 if r.random() > 0.5 else -1)
    ir /= np.sqrt(np.sum(ir ** 2) / 2)
    return ir


def convolve_st(x_st, ir):
    """x_st (2,n) → wet (2,n) (mono-summed input into stereo IR, plus cross)."""
    m = x_st.mean(axis=0)
    wl = signal.fftconvolve(m, ir[0])[: x_st.shape[1]]
    wr = signal.fftconvolve(m, ir[1])[: x_st.shape[1]]
    return np.stack([wl, wr])


class Bus:
    def __init__(self, dur):
        self.n = n_of(dur)
        self.buf = np.zeros((2, self.n))

    def add(self, x, at, gain=1.0, p=0.0):
        """Add mono (n,) or stereo (2,n) signal at time `at` (s)."""
        if x.ndim == 1:
            x = pan(x, p)
        i = n_of(at)
        if i >= self.n:
            return
        if i < 0:
            x = x[:, -i:]
            i = 0
        m = min(x.shape[1], self.n - i)
        self.buf[:, i: i + m] += x[:, :m] * gain
