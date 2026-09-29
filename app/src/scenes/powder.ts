// 04 POWDER (20–26 s). The blade's edge becomes a fuse; the formula (75 · 15 · 10) fills in granules
// on the ticks. 22.0: the cannon — a blueprint with its range table, the ball riding THE ARC.
// 24.0: Constantinople's walls: a thousand years of stone, breached in 53 days.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { FSPass, Layer2D, W, H } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { LIN, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import { clamp, ease, frameIdx, hash, lerp, prog, pulse, TAU } from '../engine/util';
import { lockup, ledger, mono, onsets, lc, fmt, heatc, tag, brackets } from './_kit';
import { sparkHead, sparkParticles } from './_motifs';

const FY = 562, FX0 = 381, FX1 = 1431; // the fuse (= the blade's edge)
const CANNON = 22.0, WALL = 24.0;

export default class PowderScene extends Scene {
  bg = new FSPass(/* glsl */ `
    uniform float bp, flash;
    void main() {
      vec2 p = FRAG_PX;
      float v = smoothstep(1.3, 0.1, length((vUv - 0.5) * vec2(1.5, 1.0)));
      vec3 c = C_INK * (0.55 + 0.55 * v);
      // blueprint grid
      vec2 g = abs(mod(p + 0.5, 40.0) - 20.0);
      float minor = 1.0 - smoothstep(0.0, 1.0, min(g.x, g.y) - 19.0 + 19.0 * 0.0 + 18.6);
      vec2 G = abs(mod(p + 0.5, 200.0) - 100.0);
      float major = 1.0 - smoothstep(99.0, 99.8, max(G.x, G.y));
      float l1 = 1.0 - smoothstep(0.4, 1.2, min(abs(mod(p.x, 40.0)), abs(mod(p.y, 40.0))));
      float l2 = 1.0 - smoothstep(0.5, 1.4, min(abs(mod(p.x, 200.0)), abs(mod(p.y, 200.0))));
      c += C_GRAPHITE * (l1 * 0.05 + l2 * 0.11) * bp;
      c += vec3(1.0, 0.85, 0.7) * flash;
      fragColor = vec4(c, 1.0);
    }`, { bp: { value: 0 }, flash: { value: 0 } });
  l2 = new LineBatch(40000);
  text = new Layer2D();
  ticks: number[] = [];
  crack: number[] = [];

  async init() {
    this.ticks = onsets(this.ctx.audio, 'tick', 19.9, 22.0).map((o) => o.t);
    this.crack = onsets(this.ctx.audio, 'crackle', 19.9, 22.0).map((o) => o.t);
  }

  fuseX(t: number) {
    // burns steadily, a little faster at the end
    return lerp(FX0, FX1, ease.inQuad(prog(t, 20.0, 21.95)) * 0.35 + prog(t, 20.0, 21.95) * 0.65);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx;
    const t = f.t;
    const phase = t < CANNON ? 0 : t < WALL ? 1 : 2;
    this.bg.u.bp!.value = phase === 0 ? 0.35 : 1;
    this.bg.u.flash!.value = pulse(t, CANNON, 0.02) * 0.12 + pulse(t, WALL, 0.02) * 0.06;
    this.bg.render(renderer, out);
    this.l2.clear(); this.text.clear();
    const c = this.text.ctx;
    let post: Record<string, any> = {};
    if (phase === 0) post = this.formula(t, c);
    else post = this.cannon(t, c, phase);
    // ruler of ranges (the through-line), bottom
    this.rangeRuler(t, c, phase);
    mono(c, '04', 72, 84, { size: 15, color: rgba('signal', 1), t });
    mono(c, 'GUNPOWDER', 110, 84, { size: 15, color: rgba('bone', 0.85), t });
    this.l2.render(renderer, out);
    comp.draw(renderer, this.text.upload(), out);
    return { bloom: 0.85, grain: 0.06, vignette: 0.4, ...post };
  }

  formula(t: number, c: CanvasRenderingContext2D) {
    const fx = this.fuseX(t);
    // unburnt fuse
    this.l2.seg2(fx, FY, FX1, FY, 2.2, lc('bone', 1.1), 1);
    // burnt: dim with embers
    for (let x = FX0; x < fx; x += 6) {
      const age = t - lerp(20.0, 21.95, (x - FX0) / (FX1 - FX0));
      const glow = Math.exp(-age * 3) * (0.6 + 0.4 * hash(Math.floor(x), frameIdx(t)));
      const col = heatc(0.2 + glow * 0.6, 0.6 + glow * 2);
      this.l2.seg2(x, FY, Math.min(fx, x + 6), FY, 2.0, col, 0.35 + glow * 0.65);
    }
    // spark
    sparkParticles(this.l2, t, (tb) => (tb < 20.0 ? null : { x: this.fuseX(tb), y: FY }), { rate: 140, life: 0.4, speed: 300, gravity: 700, intensity: 1.2 });
    sparkHead(this.l2, fx, FY, t, 1.2, 1.3);
    // formula: three bars of granules below
    const parts = [{ k: 'KNO₃', n: 'SALTPETRE', v: 75 }, { k: 'C', n: 'CHARCOAL', v: 15 }, { k: 'S', n: 'SULFUR', v: 10 }];
    const bx = FX0, bw = FX1 - FX0, by = 690;
    let acc = 0;
    const fillP = prog(t, 20.05, 21.6, ease.inOutCubic);
    parts.forEach((p, i) => {
      const x0 = bx + (bw * acc) / 100, w = (bw * p.v) / 100 - 8;
      acc += p.v;
      // granules: a grid of dots appearing column by column with the ticks
      const cols = Math.floor(w / 9), rows = 7;
      const shown = Math.floor(cols * rows * clamp(fillP * 1.15 - i * 0.05));
      for (let q = 0; q < shown; q++) {
        const cx = x0 + (Math.floor(q / rows) + 0.5) * 9, cy = by + (q % rows) * 9 + 4;
        const jit = hash(q, i) * 2;
        const col = i === 0 ? lc('bone', 0.95) : i === 1 ? lc('ash', 0.6) : lc('signal', 1.2);
        this.l2.seg2(cx + jit, cy, cx + jit + 0.01, cy, 4.2, col, 1);
      }
      mono(c, p.k, x0, by - 20, { size: 22, weight: 600, color: rgba(i === 2 ? 'signal' : 'bone', 1), t, p: prog(t, 20.1 + i * 0.12, 20.5 + i * 0.12) });
      mono(c, `${p.v}  ${p.n}`, x0, by + 94, { size: 13, color: rgba('ash', 1), t, p: prog(t, 20.2 + i * 0.12, 20.6 + i * 0.12) });
    });
    lockup(c, { x: FX0, y: 440, big: '1044', bigSize: 190, t, label: 'GUNPOWDER · THE FIRST WRITTEN FORMULA', sub: 'WUJING ZONGYAO · SONG DYNASTY · CHINA', p: prog(t, 20.0, 20.8), seed: 61 });
    ledger(c, W - 120 - 360, 360, { years: '244 YRS', next: 'UNTIL THE CANNON', p: prog(t, 20.8, 21.4), t });
    const kh = this.ctx.audio.hit('tick', t, 0.03);
    return { zoom: 1 + kh * 0.004 + prog(t, 21.5, 22.0, ease.inExpo) * 0.06 };
  }

  // ballistic arc (drag-free), screen px: launch point L, angle a, speed v (px/s), gravity g (px/s²)
  arc(L: { x: number; y: number }, a: number, v: number, g: number, tt: number) {
    return { x: L.x + Math.cos(a) * v * tt, y: L.y - Math.sin(a) * v * tt + 0.5 * g * tt * tt };
  }

  cannon(t: number, c: CanvasRenderingContext2D, phase: number) {
    const post: Record<string, any> = {};
    const L = { x: 300, y: 820 };
    const ang = (32 * Math.PI) / 180;
    const flight = WALL - 0.25 - CANNON; // 1.75 s
    const target = { x: 1520, y: 820 };
    // solve v for range at this flight time with g
    const vx = (target.x - L.x) / flight;
    const v = vx / Math.cos(ang);
    const g = (2 * Math.sin(ang) * v) / flight;
    const bpA = 1;
    // ground line
    this.l2.seg2(0, L.y + 40, W, L.y + 40, 1.2, lc('bone', 0.5), 1);
    // range table: dashed ghost arcs at 15/30/45°
    const table = [15, 45, 60];
    table.forEach((deg, k) => {
      const a = (deg * Math.PI) / 180;
      const T = (2 * v * Math.sin(a)) / g;
      const n = 60;
      const rev = prog(t, CANNON + 0.1 + k * 0.08, CANNON + 0.5 + k * 0.08);
      for (let i = 0; i < n * rev; i += 2) {
        const p0 = this.arc(L, a, v, g, (T * i) / n), p1 = this.arc(L, a, v, g, (T * (i + 1)) / n);
        this.l2.seg2(p0.x, p0.y, p1.x, p1.y, 1, lc('bone', 0.35), 1);
      }
      const land = this.arc(L, a, v, g, T);
      const top = this.arc(L, a, v, g, T / 2);
      mono(c, `${deg}°`, top.x, top.y - 12, { size: 13, color: rgba('ash', 0.9), t, align: 'center', p: rev });
      if (land.x < W) mono(c, `${deg}°`, land.x, land.y + 60, { size: 12, color: rgba('ash', 0.7), t, align: 'center', p: rev });
    });
    // the cannon, in profile (blueprint line drawing), recoiling
    const rec = pulse(t, CANNON, 0.08) * 22;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const P = (u: number, w: number) => ({ x: L.x + ca * (u - rec) + sa * w, y: L.y - sa * (u - rec) + ca * w });
    const prof: [number, number][] = [[-150, 0], [-150, 26], [-140, 34], [-120, 36], [-110, 42], [-100, 36], [-10, 30], [0, 34], [10, 28], [70, 26], [80, 30], [90, 24], [96, 24], [96, 0]];
    const pts = prof.map(([u, w]) => P(u, w));
    const ptsB = prof.map(([u, w]) => P(u, -w)).reverse();
    const all = [...pts, ...ptsB, pts[0]!];
    for (let i = 1; i < all.length; i++) this.l2.seg2(all[i - 1]!.x, all[i - 1]!.y, all[i]!.x, all[i]!.y, 1.6, lc('bone', 1.2), 1);
    // bore (dashed)
    for (let u = -130; u < 96; u += 10) { const a = P(u, 0), b = P(u + 5, 0); this.l2.seg2(a.x, a.y, b.x, b.y, 1, lc('ash', 0.6), 1); }
    // carriage
    const w0 = { x: L.x - 60 - rec * 0.3, y: L.y + 18 };
    for (let i = 0; i < 40; i++) {
      const a0 = (i / 40) * TAU, a1 = ((i + 1) / 40) * TAU;
      this.l2.seg2(w0.x + Math.cos(a0) * 22, w0.y + Math.sin(a0) * 22, w0.x + Math.cos(a1) * 22, w0.y + Math.sin(a1) * 22, 1.4, lc('bone', 1), 1);
    }
    // dimension callouts
    const muz = P(96, 0);
    mono(c, 'BORE ⌀ 0.15 M', muz.x + 20, muz.y + 60, { size: 12, color: rgba('ash', 0.9), t, p: prog(t, CANNON + 0.3, CANNON + 0.7) });
    // muzzle blast
    const age = t - CANNON;
    if (age >= 0 && age < 1.2) {
      for (let j = 0; j < 36; j++) {
        const a = ang + (hash(j, 1) - 0.5) * 1.3;
        const len = (60 + hash(j, 2) * 220) * ease.outExpo(clamp(age / 0.12));
        const k = clamp(1 - age / 0.35);
        this.l2.seg2(muz.x, muz.y, muz.x + Math.cos(a) * len, muz.y - Math.sin(a) * len, 2 + 3 * k, heatc(0.6 + 0.4 * k, 1 + 4 * k), k);
      }
      for (let r = 0; r < 3; r++) {
        const rr = (age - r * 0.05) * (600 + r * 150);
        if (rr <= 0) continue;
        const al = clamp(1 - age / 0.8) * 0.8;
        for (let i = 0; i < 64; i++) {
          const a0 = (i / 64) * TAU, a1 = ((i + 1) / 64) * TAU;
          this.l2.seg2(muz.x + Math.cos(a0) * rr, muz.y + Math.sin(a0) * rr, muz.x + Math.cos(a1) * rr, muz.y + Math.sin(a1) * rr, 1.2, lc('bone', 0.9), al);
        }
      }
    }
    // the ball on THE ARC
    const tt = clamp(t - CANNON, 0, flight);
    const N = 90;
    for (let i = 1; i <= N; i++) {
      const p0 = this.arc(L, ang, v, g, (tt * (i - 1)) / N), p1 = this.arc(L, ang, v, g, (tt * i) / N);
      this.l2.seg2(p0.x, p0.y, p1.x, p1.y, 2.6, lc('signal', 1.4 + 2 * (i / N)), 1);
    }
    const ball = this.arc(L, ang, v, g, tt);
    if (t < CANNON + flight) {
      this.l2.seg2(ball.x, ball.y, ball.x + 0.01, ball.y, 12, lc('bone', 3), 1);
      mono(c, `${fmt(Math.round(((ball.x - L.x) / (target.x - L.x)) * 1000))} M`, ball.x + 18, ball.y - 18, { size: 14, color: rgba('bone', 1), t });
    }
    // more balls on the wall (phase 2): each rides its own arc, launched 1.2 s before its hit
    for (const h of [WALL + 0.75, WALL + 1.5, WALL + 1.75]) {
      const fl = 1.2, t0 = h - fl;
      if (t < t0) continue;
      const a2 = ang + (hash(h, 1) - 0.5) * 0.25;
      const vx2 = (target.x - L.x) / fl, v2 = vx2 / Math.cos(a2), g2 = (2 * Math.sin(a2) * v2) / fl;
      const aim = { x: L.x, y: L.y };
      const t2 = clamp(t - t0, 0, fl);
      for (let i = 1; i <= 60; i++) {
        const p0 = this.arc(aim, a2, v2, g2, (t2 * (i - 1)) / 60), p1 = this.arc(aim, a2, v2, g2, (t2 * i) / 60);
        this.l2.seg2(p0.x, p0.y, p1.x, p1.y, 1.8, lc('signal', 1.0 + 1.6 * (i / 60)), clamp(1 - (t - h) * 1.5));
      }
      if (t < h) { const b = this.arc(aim, a2, v2, g2, t2); this.l2.seg2(b.x, b.y, b.x + 0.01, b.y, 10, lc('bone', 3), 1); }
    }
    // impact at the wall
    const hit = CANNON + flight;
    const ia = t - hit;
    // the wall: Theodosian profile at right (two tiers + towers) — drawn in phase 1 faintly, then hit
    this.wall(t, c, target, phase);
    if (ia >= 0) {
      for (let j = 0; j < 50; j++) {
        const a = Math.PI + (hash(j, 7) - 0.5) * 2.2;
        const life = 0.4 + hash(j, 8) * 0.6;
        if (ia > life) continue;
        const sp = 200 + hash(j, 9) * 700;
        const x = target.x + Math.cos(a) * sp * ia, y = target.y - 30 + Math.sin(a) * sp * ia * 0.7 + 900 * ia * ia;
        this.l2.seg2(x, y, x + 2, y + 1, 2, lc('bone', 1.3), 1 - ia / life);
      }
    }
    // type
    if (phase === 1) {
      lockup(c, { x: 120, y: 330, big: 'c.1288', bigSize: 170, t, label: 'CANNON · THE OLDEST SURVIVING', sub: 'HEILONGJIANG HAND CANNON · CHINA', p: prog(t, CANNON + 0.05, CANNON + 0.8), out: prog(t, WALL - 0.2, WALL), seed: 71 });
    } else {
      lockup(c, { x: 120, y: 330, big: '1453', bigSize: 170, t, label: 'CONSTANTINOPLE', sub: 'WALLS THAT STOOD 1,000 YEARS · BREACHED IN 53 DAYS', p: prog(t, WALL, WALL + 0.8), seed: 72 });
    }
    mono(c, 'RANGE TABLE', W - 72, 150, { size: 13, color: rgba('ash', 1), t, align: 'right' });
    c.font = font(F.archivo(125, 900), 64); c.fillStyle = rgba('signal', 1); c.textAlign = 'right';
    c.fillText('1 KM+', W - 72, 215); c.textAlign = 'left';
    const b = pulse(t, CANNON, 0.07) + pulse(t, WALL, 0.07) * 0.6 + pulse(t, hit, 0.05) * 0.5;
    post.zoom = 1 + b * 0.05;
    post.shake = [(hash(frameIdx(t), 1) - 0.5) * b * 16, (hash(frameIdx(t), 2) - 0.5) * b * 16];
    post.flash = pulse(t, CANNON, 0.02) * 0.35;
    // exit: whip to the right on 26.0
    post.zoom += prog(t, 24.0, 26.0, ease.inOutCubic) * 0.06 + prog(t, 25.75, 26.0, ease.inExpo) * 0.3;
    return post;
  }

  wall(t: number, c: CanvasRenderingContext2D, target: { x: number; y: number }, phase: number) {
    const base = target.y + 40;
    const x0 = target.x - 30;
    const al = prog(t, CANNON + 0.3, CANNON + 1.0);
    if (al <= 0) return;
    // blocks: stacked rectangles; blocks near impacts fall after WALL hits
    const hits = [CANNON + 1.75, WALL, WALL + 0.75, WALL + 1.5, WALL + 1.75];
    const bw = 34, bh = 22;
    for (let row = 0; row < 16; row++) {
      for (let col = 0; col < 7; col++) {
        const tower = col >= 4;
        if (!tower && row > 10) continue;
        const bx = x0 + col * bw + (row % 2) * (bw / 2), by = base - (row + 1) * bh;
        // falling
        let fall = 0, dx = 0;
        for (const h of hits) {
          if (t < h) continue;
          const d = Math.hypot(bx - target.x, by - (target.y - 40 - (h - WALL) * 80));
          if (d < 90 + (h >= WALL ? 40 : 0) && hash(row, col, h) > 0.25) {
            const a = t - h;
            fall = Math.max(fall, 0.5 * 1800 * a * a);
            dx += (hash(row, col, h, 2) - 0.3) * 260 * a;
          }
        }
        const y = by + fall;
        if (y > base + 80) continue;
        const X = bx + dx;
        const col3 = lc('bone', 0.75);
        this.l2.seg2(X, y, X + bw - 3, y, 1.1, col3, al);
        this.l2.seg2(X + bw - 3, y, X + bw - 3, y + bh - 3, 1.1, col3, al);
        this.l2.seg2(X + bw - 3, y + bh - 3, X, y + bh - 3, 1.1, col3, al);
        this.l2.seg2(X, y + bh - 3, X, y, 1.1, col3, al);
      }
    }
    if (phase === 2) {
      // extra impacts on the wall (no ball drawn, just the hit flashes)
      for (const h of hits.slice(1)) {
        const a = t - h;
        if (a < 0 || a > 0.4) continue;
        const y = target.y - 40 - (h - WALL) * 80;
        for (let j = 0; j < 20; j++) {
          const an = hash(j, h) * TAU, r = a * (500 + hash(j, h, 2) * 800);
          this.l2.seg2(target.x + Math.cos(an) * r * 0.3, y + Math.sin(an) * r * 0.3, target.x + Math.cos(an) * r, y + Math.sin(an) * r, 2, heatc(0.8, 3), 1 - a / 0.4);
        }
      }
      mono(c, '53 DAYS', target.x + 120, target.y - 400, { size: 18, weight: 600, color: rgba('signal', 1), t, p: prog(t, WALL + 0.6, WALL + 1.0), align: 'center' });
    }
    mono(c, 'THEODOSIAN WALLS · 5TH C.', target.x + 120, base + 30, { size: 12, color: rgba('ash', 0.9), t, align: 'center', p: al });
  }

  /** Log-scale range ruler: 1 m … 10 km, with the ranges so far. */
  rangeRuler(t: number, c: CanvasRenderingContext2D, phase: number) {
    const A = phase === 0 ? 0 : prog(t, CANNON + 0.4, CANNON + 1.0);
    if (A <= 0) return;
    const x0 = 120, x1 = W - 120, y = 1000;
    const X = (m: number) => x0 + ((Math.log10(m) - 0) / 4) * (x1 - x0);
    this.l2.seg2(x0, y, x0 + (x1 - x0) * ease.outExpo(A), y, 1, lc('bone', 0.5), 1);
    for (let e = 0; e <= 4; e++) {
      for (let k = 1; k < 10; k++) {
        const m = k * 10 ** e;
        if (m > 10000) break;
        const x = X(m);
        this.l2.seg2(x, y, x, y - (k === 1 ? 12 : 5), 1, lc('bone', k === 1 ? 0.7 : 0.3), A);
      }
      mono(c, ['1 M', '10 M', '100 M', '1 KM', '10 KM'][e]!, X(10 ** e), y + 22, { size: 11, color: rgba('ash', 0.8), t, align: 'center', p: A });
    }
    const marks = [{ m: 30, n: 'SPEAR' }, { m: 250, n: 'BOW' }, { m: 1000, n: 'CANNON' }];
    marks.forEach((mk, i) => {
      const x = X(mk.m);
      const last = i === marks.length - 1;
      this.l2.seg2(x, y - 26, x, y, last ? 2 : 1.4, last ? lc('signal', 2) : lc('bone', 0.9), A);
      mono(c, mk.n, x, y - 34, { size: 12, color: rgba(last ? 'signal' : 'bone', 0.9), t, align: 'center', p: A });
    });
  }
}
