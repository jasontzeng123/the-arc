// 03 METAL (14–20 s). The crystal: bronze (FCC copper, 12 % tin) → iron (BCC) heated to 1,538 °C,
// rung by the anvils (3-3-2) → the atoms pour into a blade, quenched on the hiss. Its edge becomes
// the line the next plate burns along.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { FSPass, Layer2D, W, H } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { LIN, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import { clamp, ease, frameIdx, hash, lerp, prog, pulse, TAU } from '../engine/util';
import { Cam, lockup, ledger, mono, onsets, lc, fmt, heatc, mixc } from './_kit';

const N = 640;
type P3 = [number, number, number];

function latticeSites(kind: 'fcc' | 'bcc', a: number): P3[] {
  const basis: P3[] = kind === 'fcc' ? [[0, 0, 0], [0.5, 0.5, 0], [0.5, 0, 0.5], [0, 0.5, 0.5]] : [[0, 0, 0], [0.5, 0.5, 0.5]];
  const out: P3[] = [];
  const n = 6;
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) for (let k = -n; k <= n; k++)
    for (const b of basis) out.push([(i + b[0]) * a, (j + b[1]) * a, (k + b[2]) * a]);
  // a cube-ish cluster: sort by Chebyshev distance with a little roundness
  out.sort((p, q) => {
    const dp = Math.max(Math.abs(p[0]), Math.abs(p[1]), Math.abs(p[2])) + 0.15 * Math.hypot(...p);
    const dq = Math.max(Math.abs(q[0]), Math.abs(q[1]), Math.abs(q[2])) + 0.15 * Math.hypot(...q);
    return dp - dq;
  });
  return out.slice(0, N);
}

/** Blade silhouette (x along the blade, y across): half-width at x. */
function bladeHalf(x: number) {
  // x in [-4.6, 4.2]: grip [-4.6,-3.4], guard at -3.3, blade [-3.2, 4.2] tapering to the point
  if (x < -3.4) return 0.16;
  if (x < -3.2) return 0.62;
  const u = (x + 3.2) / 7.4;
  return 0.34 * (1 - Math.pow(u, 3.2)) + 0.02;
}

function bladeSites(): P3[] {
  const out: P3[] = [];
  let i = 0;
  while (out.length < N) {
    const x = -4.6 + 8.8 * hash(i, 1);
    const y = (hash(i, 2) * 2 - 1) * 0.65;
    i++;
    if (Math.abs(y) > bladeHalf(x)) continue;
    out.push([x, y, (hash(i, 3) - 0.5) * 0.08]);
  }
  return out;
}

export default class MetalScene extends Scene {
  bg = new FSPass(/* glsl */ `
    uniform float uHeat;
    void main() {
      vec2 uv = vUv;
      float v = smoothstep(1.2, 0.0, length((uv - 0.5) * vec2(1.5, 1.0)));
      vec3 c = C_INK * (0.5 + 0.6 * v) + C_BLOOD * uHeat * 0.035 * v;
      fragColor = vec4(c, 1.0);
    }`, { uHeat: { value: 0 } });
  l3 = new LineBatch(30000, { screen2D: false });
  l2 = new LineBatch(8000);
  text = new Layer2D();
  cam = new Cam(34, 0.1, 200);
  fcc: P3[] = []; bcc: P3[] = []; blade: P3[] = [];
  tin: boolean[] = [];
  bondsF: [number, number][] = []; bondsB: [number, number][] = [];
  anv: number[] = [];

  async init() {
    this.fcc = latticeSites('fcc', 0.62);
    this.bcc = latticeSites('bcc', 0.5);
    this.blade = bladeSites();
    // map atoms between states in a coherent order (by x then y)
    const ord = (arr: P3[]) => arr.map((p, i) => ({ p, i })).sort((a, b) => a.p[0] - b.p[0] || a.p[1] - b.p[1]).map((o) => o.p);
    this.fcc = ord(this.fcc); this.bcc = ord(this.bcc); this.blade = ord(this.blade);
    this.tin = this.fcc.map((_, i) => hash(i, 77) < 0.12);
    const bonds = (arr: P3[], d: number) => {
      const b: [number, number][] = [];
      for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
        const q = Math.hypot(arr[i]![0] - arr[j]![0], arr[i]![1] - arr[j]![1], arr[i]![2] - arr[j]![2]);
        if (q < d) b.push([i, j]);
      }
      return b;
    };
    this.bondsF = bonds(this.fcc, 0.62 * 0.72);
    this.bondsB = bonds(this.bcc, 0.5 * 0.9);
    this.anv = onsets(this.ctx.audio, 'anvil', 13.9, 20.1).map((o) => o.t);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, audio } = this.ctx;
    const t = f.t;
    const toB = prog(t, 15.85, 16.25, ease.inOutCubic); // fcc → bcc
    const toS = prog(t, 17.85, 18.35, ease.inOutExpo); // → blade
    const quench = prog(t, 19.0, 19.6, ease.outCubic);
    // heat: rises with each anvil during iron, then quenched
    let heat = 0.15;
    for (const a of this.anv) if (t >= a) heat += a >= 16 ? 0.17 : 0.06;
    heat = clamp(heat) * (1 - quench * 0.92);
    this.bg.u.uHeat!.value = heat;
    this.bg.render(renderer, out);
    this.l3.clear(); this.l2.clear(); this.text.clear();
    const c = this.text.ctx;
    // camera: orbit the crystal; then face the blade
    const orbit = 0.4 + t * 0.35;
    const d = 11.5 - (t - 14) * 0.35;
    const lat = [Math.sin(orbit) * d, 2.8 + Math.sin(t * 0.8) * 0.6, Math.cos(orbit) * d] as P3;
    const face = [0.25, 0.0, 13.2] as P3;
    const pos = [lerp(lat[0], face[0], toS), lerp(lat[1], face[1], toS), lerp(lat[2], face[2], toS)] as P3;
    const tgt = [lerp(-0.9, 0.25, toS), lerp(0, 0.18, toS), 0] as P3;
    this.cam.set(pos, tgt, 0, lerp(34, 38, toS));
    // anvil shock
    const shocks = this.anv.filter((a) => t >= a && t - a < 0.8);
    const P = new Array<THREE.Vector3>(N);
    for (let i = 0; i < N; i++) {
      const a = this.fcc[i]!, b = this.bcc[i]!, s = this.blade[i]!;
      // staggered pour into the blade (left to right)
      const st = clamp(toS * 1.6 - (s[0] + 4.6) / 8.8 * 0.6);
      const e = ease.inOutCubic(st);
      let x = lerp(lerp(a[0], b[0], toB), s[0], e);
      let y = lerp(lerp(a[1], b[1], toB), s[1], e);
      let z = lerp(lerp(a[2], b[2], toB), s[2], e);
      // the lattice sits right of centre
      x += 1.6 * (1 - e);
      for (const sa of shocks) {
        const age = t - sa;
        const hp = this.fcc[Math.floor(hash(sa * 7, 1) * N)]!;
        const dx = x - hp[0] - 1.6, dy = y - hp[1], dz = z - hp[2];
        const r = Math.hypot(dx, dy, dz) + 1e-3;
        const w = Math.exp(-((r - age * 9) ** 2) / 0.35) * Math.exp(-age / 0.25) * 0.28 * (1 - e * 0.7);
        x += (dx / r) * w; y += (dy / r) * w; z += (dz / r) * w;
      }
      P[i] = new THREE.Vector3(x, y, z);
    }
    // bonds
    const bondA = (1 - toS) * 0.55;
    const drawBonds = (list: [number, number][], al: number, col: [number, number, number]) => {
      if (al <= 0.01) return;
      for (const [i, j] of list) {
        const a = P[i]!, b = P[j]!;
        this.l3.seg(a.x, a.y, a.z, b.x, b.y, b.z, 0.9, col[0], col[1], col[2], al);
      }
    };
    const bondCol = mixc(lc('bone', 0.55), heatc(0.35 + heat * 0.5, 1.4), clamp(heat * 1.2 - 0.2));
    drawBonds(this.bondsF, bondA * (1 - toB), bondCol);
    drawBonds(this.bondsB, bondA * toB, bondCol);
    // atoms
    const hot = heatc(0.4 + heat * 0.55, 1.5 + heat * 2.5);
    const steel: [number, number, number] = [LIN.bone[0] * 1.3, LIN.bone[1] * 1.35, LIN.bone[2] * 1.45];
    for (let i = 0; i < N; i++) {
      const p = P[i]!;
      const isTin = this.tin[i]! && toB < 0.5;
      let col: [number, number, number] = isTin ? lc('signal', 2.4) : mixc(lc('bone', 1.1), hot, clamp(heat * 1.3 - 0.15));
      if (toS > 0) col = mixc(col, steel, quench);
      const sz = (isTin ? 6.5 : 5) * (1 - toS * 0.45);
      this.l3.seg(p.x, p.y, p.z, p.x + 0.001, p.y, p.z, sz, col[0], col[1], col[2], 1);
    }
    // blade outline + edge gleam
    if (toS > 0.5) {
      const al = prog(toS, 0.6, 1);
      const col = mixc(heatc(0.7, 2.2), lc('bone', 1.4), quench);
      const outline: [number, number][] = [];
      for (let x = -4.6; x <= 4.2; x += 0.05) outline.push([x, bladeHalf(x)]);
      for (let x = 4.2; x >= -4.6; x -= 0.05) outline.push([x, -bladeHalf(x)]);
      for (let i = 1; i < outline.length; i++) {
        const a = outline[i - 1]!, b = outline[i]!;
        this.l3.seg(a[0], a[1], 0, b[0], b[1], 0, 1.6, col[0], col[1], col[2], al);
      }
      // fuller (central groove) and hatch
      for (let x = -3.0; x < 3.2; x += 0.12) {
        const hh = bladeHalf(x);
        const k = 0.35 + 0.65 * Math.abs(Math.sin(x * 3.1));
        this.l3.seg(x, -hh * 0.9, 0, x + 0.18, -hh * 0.2, 0, 0.8, col[0] * 0.6, col[1] * 0.6, col[2] * 0.6, al * 0.5 * k);
      }
      this.l3.seg(-3.1, 0, 0, 2.4, 0, 0, 1.1, col[0] * 0.8, col[1] * 0.8, col[2] * 0.8, al * 0.8);
      // gleam: a white-hot highlight running along the lower edge on the last anvils
      const g0 = this.anv.find((a) => a >= 19.4) ?? 19.5;
      const gp = prog(t, g0, g0 + 0.45, ease.inOutCubic);
      if (gp > 0 && gp < 1) {
        const gx = lerp(-3.2, 4.4, gp);
        for (let k = -8; k <= 8; k++) {
          const x = gx + k * 0.06, x2 = x + 0.06;
          if (x < -3.2 || x2 > 4.2) continue;
          const I = Math.exp(-(k * k) / 18) * 6;
          this.l3.seg(x, -bladeHalf(x), 0, x2, -bladeHalf(x2), 0, 2.4, I, I * 0.95, I * 0.9, 1);
        }
      }
    }
    // steam on the quench
    if (t > 19.0) {
      const age = t - 19.0;
      for (let j = 0; j < 90; j++) {
        const x0 = -3.2 + 7.4 * hash(j, 3);
        const life = 0.5 + hash(j, 4) * 0.9;
        const a0 = hash(j, 5) * 0.4;
        const q = (age - a0) / life;
        if (q < 0 || q > 1) continue;
        const y = bladeHalf(x0) + q * (1.2 + hash(j, 6) * 1.8);
        const x = x0 + Math.sin(q * 6 + j) * 0.2 * q;
        this.l3.seg(x, y, 0.1, x + 0.05, y + 0.18, 0.1, 1.2, LIN.bone[0], LIN.bone[1], LIN.bone[2], (1 - q) * 0.5);
      }
    }
    this.l3.render(renderer, out, this.cam.cam);
    // sparks from the anvil hit points (2D)
    for (const sa of this.anv) {
      const age = t - sa;
      if (age < 0 || age > 0.7) continue;
      const hp = sa >= 17.9 ? [lerp(-3, 3.5, hash(sa, 3)), -0.2, 0] : this.fcc[Math.floor(hash(sa * 7, 1) * N)]!;
      const sp = this.cam.project(hp[0]! + (sa >= 17.9 ? 0 : 1.6), hp[1]!, hp[2]!);
      for (let j = 0; j < 40; j++) {
        const life = 0.2 + hash(sa, j, 9) * 0.5;
        if (age > life) continue;
        const a = -Math.PI * hash(sa, j, 10) - 0.1, v = 250 + hash(sa, j, 11) ** 2 * 1500;
        const k = age / life;
        const x = sp.x + Math.cos(a) * v * age, y = sp.y + Math.sin(a) * v * age + 1400 * age * age;
        const ta = Math.max(0, age - 0.022);
        const x0 = sp.x + Math.cos(a) * v * ta, y0 = sp.y + Math.sin(a) * v * ta + 1400 * ta * ta;
        const hh = (1 - k) ** 2;
        this.l2.seg2(x0, y0, x, y, 1.5, [LIN.signal[0] * 2 + hh * 4, LIN.signal[1] * 2 + hh * 3, LIN.signal[2] * 2 + hh * 1.5], 1 - k);
      }
    }
    this.l2.render(renderer, out);
    // ---- type
    mono(c, '03', 72, 84, { size: 15, color: rgba('signal', 1), t });
    mono(c, t < 16 ? 'BRONZE' : 'IRON', 110, 84, { size: 15, color: rgba('bone', 0.85), t });
    lockup(c, { x: 120, y: 330, big: '3300 BC', bigSize: 150, t, label: 'BRONZE · COPPER + TIN', sub: 'CU 88 %  ·  SN 12 %', p: prog(t, 14.0, 14.7), out: prog(t, 15.7, 15.95), seed: 51 });
    // composition bar
    const cb = prog(t, 14.3, 14.9, ease.outExpo) * (1 - prog(t, 15.7, 15.9));
    if (cb > 0) {
      c.fillStyle = rgba('bone', 0.9); c.fillRect(124, 400, 480 * 0.88 * cb, 6);
      c.fillStyle = rgba('signal', 1); c.fillRect(124 + 480 * 0.88 * cb + 4, 400, 480 * 0.12 * cb, 6);
    }
    lockup(c, { x: 120, y: 330, big: '1200 BC', bigSize: 150, t, label: 'IRON', sub: 'FE  ·  MELTING POINT 1,538 °C', p: prog(t, 16.0, 16.7), out: prog(t, 17.7, 17.95), seed: 52 });
    // temperature
    const tp = prog(t, 16.0, 16.4) * (1 - prog(t, 17.8, 18.0));
    if (tp > 0) {
      const temp = Math.round(lerp(20, 1538, clamp((heat - 0.25) / 0.7)));
      mono(c, 'TEMPERATURE', W - 120, 250, { size: 14, color: rgba('ash', 1), t, align: 'right', p: tp });
      c.font = font(F.archivo(125, 900), 96); c.textAlign = 'right';
      c.fillStyle = heat > 0.7 ? rgba('ember', tp) : rgba('bone', tp);
      c.fillText(`${fmt(temp)} °C`, W - 120, 345); c.textAlign = 'left';
    }
    // the blade
    lockup(c, { x: W / 2, y: 250, big: 'STILL 1', bigSize: 130, t, label: 'KILLS / STRIKE', sub: 'THE SWORD · 2,100 YEARS FROM BRONZE TO IRON', p: prog(t, 18.2, 18.9), align: 'center', seed: 53 });
    ledger(c, 120, 900, { years: '2,244 YRS', next: 'UNTIL GUNPOWDER', p: prog(t, 18.6, 19.2), t });
    comp.draw(renderer, this.text.upload(), out);
    const ah = audio.hit('anvil', t, 0.05);
    return { bloom: 0.9, grain: 0.06, vignette: 0.45, zoom: 1 + ah * 0.02, shake: [(hash(frameIdx(t), 1) - 0.5) * ah * 7, (hash(frameIdx(t), 2) - 0.5) * ah * 7], flash: pulse(t, 14.0, 0.02) * 0.06 };
  }
}
