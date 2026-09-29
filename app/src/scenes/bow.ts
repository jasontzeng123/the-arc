// 02 BOW (8–14 s). The spear lands at 30 m; the view zooms out ×10 and the ruler rescales. Then two
// volleys: THE ARC multiplied into a bundle of parabolas, landing exactly on the score's impacts.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { FSPass, Layer2D, W, H } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { LIN, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import { clamp, ease, frameIdx, hash, lerp, noise1, prog, pulse, TAU } from '../engine/util';
import { Cam, lockup, ledger, mono, onsets, lc, fmt, tag } from './_kit';
import { LAND, sideCam, toScreen, arcPoints, H0 } from './_arc';

interface Arrow { t0: number; t1: number; x0: number; z0: number; x1: number; z1: number; hmax: number; hero: boolean }

export default class BowScene extends Scene {
  bg = new FSPass(/* glsl */ `
    uniform float mode;
    void main() {
      vec2 uv = vUv;
      float v = smoothstep(1.3, 0.2, length((uv - vec2(0.5, 0.45)) * vec2(1.4, 1.0)));
      vec3 c = C_INK * (0.6 + 0.5 * v);
      // horizon glow for the 3D shots
      c += C_BLOOD * 0.02 * mode * smoothstep(0.35, 0.0, abs(uv.y - 0.42));
      fragColor = vec4(c, 1.0);
    }`, { mode: { value: 0 } });
  l3 = new LineBatch(60000, { screen2D: false });
  l2 = new LineBatch(20000);
  text = new Layer2D();
  cam = new Cam(38, 0.5, 4000);
  v1: Arrow[] = [];
  v2: Arrow[] = [];

  async init() {
    const au = this.ctx.audio;
    const vol = onsets(au, 'volley').map((o) => o.t);
    const imp = onsets(au, 'impact', 8.3, 14.6).map((o) => o.t);
    const t1 = vol[0] ?? 10, t2 = vol[1] ?? 12;
    const i1 = imp.filter((x) => x > t1 + 1 && x < t2);
    const i2 = imp.filter((x) => x > t2 + 1);
    const mk = (n: number, t0: number, lands: number[], seed: number, dir: number) => {
      const out: Arrow[] = [];
      for (let i = 0; i < n; i++) {
        const h = (k: number) => hash(i, seed, k);
        const land = lands.length ? lands[i % lands.length]! + (i >= lands.length ? (h(9) - 0.5) * 0.25 : 0) : t0 + 2;
        const x1 = 215 + h(1) * 70;
        const z0 = (h(2) - 0.5) * 60;
        out.push({ t0: t0 + h(3) * 0.12, t1: land, x0: (h(4) - 0.5) * 6, z0, x1, z1: z0 * 1.25 + (h(5) - 0.5) * 20, hmax: x1 * (0.2 + 0.08 * h(6)), hero: i === 7 });
      }
      return out;
    };
    this.v1 = mk(64, t1, i1, 3, 1);
    this.v2 = mk(110, t2, i2, 8, -1);
  }

  arrowAt(a: Arrow, t: number) {
    const u = clamp((t - a.t0) / (a.t1 - a.t0));
    const x = lerp(a.x0, a.x1, u), z = lerp(a.z0, a.z1, u);
    const y = 1.5 * (1 - u) + 4 * a.hmax * u * (1 - u);
    return { x, y, z, u };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, audio } = this.ctx;
    const t = f.t;
    const vol = onsets(audio, 'volley').map((o) => o.t);
    const V1 = vol[0] ?? 10, V2 = vol[1] ?? 12;
    const mode = t >= V1 ? 1 : 0;
    this.bg.u.mode!.value = mode;
    this.bg.render(renderer, out);
    this.text.clear();
    this.l2.clear();
    this.l3.clear();
    const c = this.text.ctx;
    let post: Record<string, any> = {};
    if (!mode) post = this.zoomOut(f, c);
    else {
      post = this.volleys(f, c, V1, V2);
      this.l3.render(renderer, out, this.cam.cam);
    }
    mono(c, '02', 72, 84, { size: 15, color: rgba('signal', 1), t });
    this.l2.render(renderer, out);
    comp.draw(renderer, this.text.upload(), out);
    return { bloom: 0.8, grain: 0.06, vignette: 0.45, ...post };
  }

  // 8–10 s: landing, log zoom-out, 64,000
  zoomOut(f: Frame, c: CanvasRenderingContext2D) {
    const t = f.t;
    const c0 = sideCam(LAND);
    const k = prog(t, 8.05, 9.2, ease.inOutExpo);
    // interpolate in log scale
    const s = Math.exp(lerp(Math.log(c0.s), Math.log(4.4), k));
    const cx = lerp(c0.cx, 150, ease.inOutCubic(k));
    const cam = { s, cx };
    const S = (x: number, y: number) => toScreen(x, y, cam);
    const g0 = S(-400, 0), g1 = S(800, 0);
    this.l2.seg2(g0.x, g0.y, g1.x, g1.y, 1.2, lc('bone', 0.55), 1);
    // ruler: pick tick spacing by scale
    const step = s > 20 ? 1 : 10, lab = s > 20 ? 5 : 50;
    for (let m = -50; m <= 400; m += step) {
      const p = S(m, 0);
      if (p.x < -20 || p.x > W + 20) continue;
      const big = m % lab === 0;
      this.l2.seg2(p.x, p.y + 2, p.x, p.y + (big ? 22 : 9), 1.1, lc('bone', big ? 0.7 : 0.3), 1);
      if (big && m >= 0) mono(c, `${m} M`, p.x + 6, p.y + 42, { size: 14, color: rgba('ash', 0.9), t });
    }
    // the spear's arc, now frozen, and the spear stuck in the ground
    const pts = arcPoints(LAND, 90).map((p) => S(p.x, p.y));
    for (let i = 1; i < pts.length; i++) this.l2.seg2(pts[i - 1]!.x, pts[i - 1]!.y, pts[i]!.x, pts[i]!.y, 2.4, lc('signal', 2.2), 1);
    const tip = S(30, 0);
    const ang = 0.72;
    const len = 2.6 * s;
    this.l2.seg2(tip.x - Math.cos(ang) * len, tip.y - Math.sin(ang) * len, tip.x + 2, tip.y + 2, 3, lc('bone', 1.3), 1);
    // impact dust
    const age = t - LAND;
    for (let j = 0; j < 30; j++) {
      const a = Math.PI + hash(j, 4) * Math.PI, v = 40 + hash(j, 5) * 260;
      const life = 0.3 + hash(j, 6) * 0.5;
      if (age > life) continue;
      const q = age / life;
      const x = tip.x + Math.cos(a) * v * age, y = tip.y + Math.sin(a) * v * age * 0.6 + 300 * age * age;
      this.l2.seg2(x, y, x + 1.5, y + 0.5, 1.6, lc('bone', 0.9), 1 - q);
    }
    // ring
    const rr = age * 260;
    for (let i = 0; i < 48; i++) {
      const a0 = (i / 48) * TAU, a1 = ((i + 1) / 48) * TAU;
      this.l2.seg2(tip.x + Math.cos(a0) * rr, tip.y + Math.sin(a0) * rr * 0.18, tip.x + Math.cos(a1) * rr, tip.y + Math.sin(a1) * rr * 0.18, 1.2, lc('signal', 1.5), clamp(1 - age * 1.6));
    }
    // labels
    const lb = S(15, 6.5);
    mono(c, 'SPEAR · 30 M', lb.x, lb.y - 14, { size: 13, color: rgba('signal', 1), t, align: 'center', p: prog(t, 8.6, 9.1) });
    // ghost of the next range: a 250 m bracket
    const gp = prog(t, 9.0, 9.6, ease.outExpo);
    if (gp > 0) {
      const a = S(0, 0), b = S(250, 0);
      const y = a.y - 120;
      this.l2.seg2(a.x, y, lerp(a.x, b.x, gp), y, 1.2, lc('bone', 0.8), 1);
      this.l2.seg2(a.x, y - 8, a.x, y + 8, 1.2, lc('bone', 0.8), 1);
      if (gp > 0.98) this.l2.seg2(b.x, y - 8, b.x, y + 8, 1.2, lc('bone', 0.8), 1);
      mono(c, 'BOW · ~250 M', lerp(a.x, b.x, gp) - 6, y - 16, { size: 14, color: rgba('bone', 1), t, align: 'right', p: gp });
    }
    lockup(c, { x: 120, y: 330, big: '64,000', bigSize: 150, t, label: 'YEARS AGO · BOW AND ARROW', sub: 'SIBUDU CAVE · KWAZULU-NATAL · SOUTH AFRICA', p: prog(t, 8.45, 9.3), seed: 31 });
    mono(c, 'BOW', 110, 84, { size: 15, color: rgba('bone', 0.85), t, p: prog(t, 8.3, 8.6) });
    ledger(c, 120, 900, { years: '58,700 YRS', next: 'UNTIL BRONZE', p: prog(t, 9.0, 9.6), t });
    const th = pulse(t, LAND, 0.06);
    return { zoom: 1 + th * 0.035, shake: [(hash(frameIdx(t), 1) - 0.5) * th * 10, (hash(frameIdx(t), 2) - 0.5) * th * 10] };
  }

  // 10–14 s: two volleys in 3D
  volleys(f: Frame, c: CanvasRenderingContext2D, V1: number, V2: number) {
    const t = f.t;
    const second = t >= V2;
    const arrows = second ? [...this.v1, ...this.v2] : this.v1;
    // camera
    if (!second) {
      const u = t - V1;
      const fx = lerp(-40, 40, ease.inOutCubic(clamp(u / 2)));
      this.cam.set([fx, 5 + u * 3, 22 - u * 2], [fx + 140, 22 + u * 4, -4], 0.03 * Math.sin(u), 40);
    } else {
      const u = t - V2;
      const a = -1.05 + u * 0.12;
      this.cam.set([150 + Math.cos(a) * 190, 120 - u * 14, Math.sin(a) * 190], [175, 18, 0], 0, 42);
    }
    // ground grid
    const G = lc('bone', 0.2);
    for (let x = -60; x <= 400; x += 10) {
      const major = x % 50 === 0;
      this.l3.seg(x, 0, -120, x, 0, 120, major ? 1.1 : 0.8, G[0], G[1], G[2], major ? 0.7 : 0.35);
    }
    for (let z = -120; z <= 120; z += 10) this.l3.seg(-60, 0, z, 400, 0, z, 0.8, G[0], G[1], G[2], 0.35);
    // range labels on the ground
    for (let x = 0; x <= 300; x += 50) {
      const p = this.cam.project(x, 0, second ? 36 : -38);
      if (p.vis) mono(c, `${x} M`, p.x, p.y, { size: 13, color: rgba('ash', 0.8), t, align: 'center' });
    }
    // arrows
    let inFlight = 0;
    for (const a of arrows) {
      if (t < a.t0) continue;
      const cur = this.arrowAt(a, t);
      const flying = cur.u < 1;
      if (flying) inFlight++;
      // trail: full traversed path faint, recent part bright
      const N = 36;
      let prev = this.arrowAt(a, a.t0);
      for (let i = 1; i <= N; i++) {
        const tt = lerp(a.t0, Math.min(t, a.t1), i / N);
        const p = this.arrowAt(a, tt);
        const rec = clamp(1 - (t - tt) / 0.5);
        const col = a.hero ? lc('signal', 1.2 + 2.2 * rec) : lc('bone', 0.35 + 1.1 * rec * rec);
        const al = a.hero ? 1 : (0.25 + 0.75 * rec) * (flying ? 1 : clamp(1 - (t - a.t1) * 0.6));
        this.l3.seg(prev.x, prev.y, prev.z, p.x, p.y, p.z, a.hero ? 2.2 : 1.0, col[0], col[1], col[2], al);
        prev = p;
      }
      // the arrow body
      const back = this.arrowAt(a, Math.min(t, a.t1) - 0.03);
      const dx = cur.x - back.x, dy = cur.y - back.y, dz = cur.z - back.z;
      const L = Math.hypot(dx, dy, dz) || 1;
      const bl = 3.2;
      const hx = flying ? cur.x : a.x1 + (dx / L) * 0.6, hy = flying ? cur.y : -0.4, hz = flying ? cur.z : a.z1 + (dz / L) * 0.6;
      const col = a.hero ? lc('ember', 3) : lc('bone', 1.6);
      this.l3.seg(hx - (dx / L) * bl, hy - (dy / L) * bl, hz - (dz / L) * bl, hx, hy, hz, a.hero ? 2.6 : 1.8, col[0], col[1], col[2], 1);
      // impact ring
      if (!flying) {
        const age = t - a.t1;
        if (age < 0.6) {
          const r = 0.5 + age * 9;
          const rc = lc('signal', 2.2);
          for (let i = 0; i < 16; i++) {
            const a0 = (i / 16) * TAU, a1 = ((i + 1) / 16) * TAU;
            this.l3.seg(a.x1 + Math.cos(a0) * r, 0.05, a.z1 + Math.sin(a0) * r, a.x1 + Math.cos(a1) * r, 0.05, a.z1 + Math.sin(a1) * r, 1.2, rc[0], rc[1], rc[2], 1 - age / 0.6);
          }
        }
        // a lasting orange mark where it fell
        const mk = lc('signal', 1.4);
        this.l3.seg(a.x1 - 0.6, 0.02, a.z1, a.x1 + 0.6, 0.02, a.z1, 1.4, mk[0], mk[1], mk[2], 0.8);
      }
    }
    // HUD & type
    const u1 = prog(t, V1, V1 + 0.8);
    lockup(c, { x: 120, y: 300, big: '250 M', bigSize: 150, t, label: 'RANGE · ×8 THE SPEAR', sub: 'BOW AND ARROW · 64,000 YEARS AGO', p: u1, out: prog(t, V2 - 0.25, V2), seed: 41 });
    if (second) {
      lockup(c, { x: W - 120, y: 300, big: fmt(this.v1.length + this.v2.length), bigSize: 150, t, label: 'ARROWS · TWO VOLLEYS', sub: 'KILLS / STRIKE · STILL 1', p: prog(t, V2, V2 + 0.7), align: 'right', seed: 42 });
    }
    mono(c, 'BOW', 110, 84, { size: 15, color: rgba('bone', 0.85), t });
    mono(c, `IN FLIGHT ${String(inFlight).padStart(3, '0')}`, W - 72, 84, { size: 14, color: rgba('ash', 1), t, align: 'right' });
    const ih = this.ctx.audio.hit('impact', t, 0.05);
    const vh = pulse(t, second ? V2 : V1, 0.08);
    const end = prog(t, 13.9, 14.0);
    return { zoom: 1 + vh * 0.04 + ih * 0.004, shake: [(hash(frameIdx(t), 1) - 0.5) * ih * 5, (hash(frameIdx(t), 2) - 0.5) * ih * 5], flash: end * 0.0 };
  }
}
