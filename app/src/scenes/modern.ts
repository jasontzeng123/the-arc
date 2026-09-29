// 07 PRECISION (40–48 s). A: a city seen straight down, as a plan. 9,000 bombs scatter around one target;
// every lock beep strips the scatter and tightens the circle; 44.0: one bomb, one target.
// B: the same city in 3D — the armed drone, its operator ~12,000 km away. C: the GPS constellation.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { FSPass, Layer2D, W, H } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { LIN, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import { clamp, ease, frameIdx, hash, lerp, prog, pulse, TAU } from '../engine/util';
import { Cam, lockup, ledger, mono, onsets, fmt, tag, lc, brackets } from './_kit';
import { drawGlobe } from './_globe';
import { City2 } from './_city2';

const PREC = 44.0, DRONE = 45.0, GPS = 46.5;
const COUNTS = [9000, 5200, 2800, 1500, 800, 420, 210, 100, 48, 20, 6];

function gauss(i: number, s: number) {
  const u = Math.max(1e-6, hash(i, s)), v = hash(i, s + 1);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
}

export default class ModernScene extends Scene {
  plain = new FSPass(`void main(){ float v = smoothstep(1.2,0.1,length((vUv-0.5)*vec2(1.5,1.0))); fragColor = vec4(C_INK*(0.4+0.6*v),1.0); }`);
  l3 = new LineBatch(30000, { screen2D: false });
  text = new Layer2D();
  cam = new Cam(40, 1, 20000);
  ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 5000);
  city = new City2();
  locks: number[] = [];

  async init() {
    this.locks = onsets(this.ctx.audio, 'lock', 41.9, 44.0).map((o) => o.t);
    await this.city.load();
  }

  count(t: number) {
    if (t >= PREC) return 1;
    let k = 0;
    for (const l of this.locks) if (t >= l) k++;
    return COUNTS[Math.min(k, COUNTS.length - 1)]!;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, audio } = this.ctx;
    const t = f.t;
    this.l3.clear(); this.text.clear();
    const c = this.text.ctx;
    const kick = audio.hit('kick', t, 0.05);
    this.plain.render(renderer, out);
    let post: Record<string, any> = {};
    if (t < GPS) {
      if (t < DRONE) {
        // straight down: the perspective camera (for the bombs) and a matching orthographic one (the plan)
        const u = t - 40;
        const z = lerp(1500, 1100, ease.inOutCubic(u / 4)) - pulse(t, PREC, 0.1) * 60;
        const rot = u * 0.05;
        const up: [number, number, number] = [Math.sin(rot), Math.cos(rot), 0];
        this.cam.cam.near = 1; this.cam.cam.far = 20000;
        this.cam.set([0, 0, z], [0, 0, 0], 0, 40, up);
        const hh = z * Math.tan((20 * Math.PI) / 180);
        const o = this.ortho;
        o.left = -hh * (W / H); o.right = hh * (W / H); o.top = hh; o.bottom = -hh;
        o.position.set(0, 0, 1000); o.up.set(...up); o.lookAt(0, 0, 0); o.near = 1; o.far = 3000;
        o.updateProjectionMatrix(); o.updateMatrixWorld(true);
        const hot = t >= PREC ? Math.max(0.35, Math.exp(-(t - PREC) * 1.2)) : 0;
        this.city.setLook({ plan: true, hot, ground: 1.15 });
        this.city.render(renderer, out, o);
        post = this.precision(t, c);
      } else {
        const u = t - DRONE;
        const a = -2.2 + u * 0.1;
        this.cam.cam.near = 1; this.cam.cam.far = 20000;
        this.cam.set([Math.cos(a) * 620, Math.sin(a) * 620, 260 - u * 20], [40, 20, 60], 0, 38, [0, 0, 1]);
        this.city.setLook({ plan: false, hot: 0.15 });
        this.city.render(renderer, out, this.cam.cam);
        post = this.drone(t, c);
      }
    } else {
      post = this.gps(t, c);
    }
    this.l3.render(renderer, out, this.cam.cam);
    mono(c, '07', 72, 84, { size: 15, color: rgba('signal', 1), t });
    mono(c, 'PRECISION', 110, 84, { size: 15, color: rgba('bone', 0.85), t });
    comp.draw(renderer, this.text.upload(), out);
    const g = pulse(t, 40.0, 0.05);
    return { bloom: 0.85, grain: 0.06, vignette: 0.45, zoom: 1 + kick * 0.008 + g * 0.04, ca: 1.2 + g * 10 + audio.hit('glitch', t, 0.1) * 12, ...post };
  }

  precision(t: number, c: CanvasRenderingContext2D) {
    const n = this.count(t);
    const sig = t >= PREC ? 0 : lerp(26, 260, Math.log10(n) / Math.log10(9000));
    const X = lc('signal', 2);
    this.l3.seg(-900, 0, 150, 900, 0, 150, 1, X[0], X[1], X[2], 0.6);
    this.l3.seg(0, -900, 150, 0, 900, 150, 1, X[0], X[1], X[2], 0.6);
    const R = sig * 1.18;
    if (R > 0) for (let i = 0; i < 96; i++) {
      const a0 = (i / 96) * TAU, a1 = ((i + 1) / 96) * TAU;
      this.l3.seg(Math.cos(a0) * R, Math.sin(a0) * R, 150, Math.cos(a1) * R, Math.sin(a1) * R, 150, 1.4, X[0], X[1], X[2], 0.9);
    }
    // bombs (drawn above the roofs)
    for (let i = 0; i < n; i++) {
      const born = 40.0 + hash(i, 5) * 0.6;
      if (t < born) continue;
      const k = ease.outExpo(clamp((t - born) / 0.15));
      const x = gauss(i, 11) * sig, y = gauss(i, 23) * sig;
      const b = LIN.bone;
      this.l3.seg(x, y, 200, x + 0.1, y, 200, 3.4 * k, b[0] * 1.5, b[1] * 1.5, b[2] * 1.5, 0.95);
    }
    if (t >= PREC - 0.05) {
      const a = t - PREC;
      const I = 3 + 8 * Math.exp(-Math.max(0, a) * 4);
      this.l3.seg(0, 0, 200, 0.1, 0, 200, 14, LIN.signal[0] * I, LIN.signal[1] * I, LIN.signal[2] * I, 1);
      for (let r = 0; r < 3; r++) {
        const rr = Math.max(0, a - r * 0.08) * 500;
        if (rr <= 0) continue;
        for (let i = 0; i < 64; i++) {
          const a0 = (i / 64) * TAU, a1 = ((i + 1) / 64) * TAU;
          this.l3.seg(Math.cos(a0) * rr, Math.sin(a0) * rr, 150, Math.cos(a1) * rr, Math.sin(a1) * rr, 150, 1.6, X[0], X[1], X[2], clamp(1 - a / 1.0));
        }
      }
    }
    const big = t < PREC ? fmt(n) : '1';
    c.font = font(F.archivo(125, 900), 220);
    c.textAlign = 'right';
    c.fillStyle = t < PREC ? rgba('bone', prog(t, 40.05, 40.4)) : rgba('signal', 1);
    c.fillText(big, W - 110, 330);
    c.textAlign = 'left';
    mono(c, t < PREC ? 'BOMBS TO DESTROY ONE TARGET · WWII · 4,500 B-17 SORTIES' : '1991 · ONE STEALTH FIGHTER · ONE LASER-GUIDED BOMB', W - 110, 380, { size: 15, color: rgba(t < PREC ? 'ash' : 'bone', 1), t, align: 'right', p: t < PREC ? prog(t, 40.2, 40.8) : prog(t, PREC, PREC + 0.4) });
    const lk = this.ctx.audio.hit('lock', t, 0.05);
    const tp = this.cam.project(0, 0, 0);
    brackets(c, tp.x - 40 - lk * 10, tp.y - 40 - lk * 10, 80 + lk * 20, 80 + lk * 20, 16, rgba('signal', 0.9), 2);
    if (t >= 42) tag(c, t < PREC ? 'LOCKING' : 'LOCKED', tp.x + 56, tp.y - 50, { size: 15, t, p: 1 });
    const pr = pulse(t, PREC, 0.06);
    return { flash: pr * 0.04, shake: [(hash(frameIdx(t), 1) - 0.5) * pr * 20, (hash(frameIdx(t), 2) - 0.5) * pr * 20] };
  }

  drone(t: number, c: CanvasRenderingContext2D) {
    const u = t - DRONE;
    const tx = 40 + u * 12, ty = 20 - u * 5;
    const D = { x: -90 + u * 30, y: -70, z: 150 };
    const b = lc('bone', 1.4), s = lc('signal', 2.2);
    const wing = 26;
    this.l3.seg(D.x - wing, D.y, D.z, D.x + wing, D.y, D.z, 2, b[0], b[1], b[2], 1);
    this.l3.seg(D.x, D.y - 18, D.z, D.x, D.y + 14, D.z, 2, b[0], b[1], b[2], 1);
    for (let i = 0; i < 30; i += 2) {
      const k0 = i / 30, k1 = (i + 1) / 30;
      this.l3.seg(lerp(D.x, tx, k0), lerp(D.y, ty, k0), lerp(D.z, 0, k0), lerp(D.x, tx, k1), lerp(D.y, ty, k1), lerp(D.z, 0, k1), 1.2, s[0], s[1], s[2], 0.9);
    }
    for (let i = 0; i < 60; i++) {
      const k0 = i / 60, k1 = (i + 1) / 60;
      const P = (k: number) => [lerp(D.x, D.x - 3000, k), lerp(D.y, D.y + 4000, k), D.z + Math.sin(k * Math.PI * 0.5) * 2500];
      const a = P(k0), q = P(k1);
      this.l3.seg(a[0]!, a[1]!, a[2]!, q[0]!, q[1]!, q[2]!, 1.2, b[0] * 0.7, b[1] * 0.7, b[2] * 0.7, 0.8 * (1 - k0));
    }
    this.l3.seg(tx, ty, 2, tx + 0.3, ty, 2, 7, LIN.signal[0] * 4, LIN.signal[1] * 4, LIN.signal[2] * 4, 1);
    const tp = this.cam.project(tx, ty, 0), dp = this.cam.project(D.x, D.y, D.z);
    const lock = prog(t, DRONE + 0.5, DRONE + 0.65);
    const r = lerp(90, 34, ease.outExpo(lock));
    c.strokeStyle = rgba('signal', 1); c.lineWidth = 1.6;
    c.beginPath(); c.arc(tp.x, tp.y, r, 0, TAU); c.stroke();
    for (let i = 0; i < 4; i++) { const a = (i * TAU) / 4 + u * 0.8 * (1 - lock); c.beginPath(); c.moveTo(tp.x + Math.cos(a) * (r + 6), tp.y + Math.sin(a) * (r + 6)); c.lineTo(tp.x + Math.cos(a) * (r + 22), tp.y + Math.sin(a) * (r + 22)); c.stroke(); }
    mono(c, `TGT ${String(Math.round(tx * 10)).padStart(5, '0')} ${String(Math.round(-ty * 10)).padStart(5, '0')}`, tp.x + r + 30, tp.y + 5, { size: 13, color: rgba('signal', 1), t });
    mono(c, 'MQ-1 · ALT 7,600 M', dp.x + 36, dp.y - 10, { size: 13, color: rgba('bone', 0.9), t });
    lockup(c, { x: 120, y: 330, big: '12,000 KM', bigSize: 150, t, label: '2001 · THE ARMED DRONE', sub: 'DISTANCE BETWEEN THE OPERATOR AND THE TARGET', p: prog(t, DRONE, DRONE + 0.7), seed: 101 });
    mono(c, 'KILLER — VICTIM', 124, 420, { size: 14, weight: 600, color: rgba('signal', 1), t, p: prog(t, DRONE + 0.5, DRONE + 0.9) });
    return {};
  }

  gps(t: number, c: CanvasRenderingContext2D) {
    this.cam.cam.near = 0.1; this.cam.cam.far = 500;
    const u = t - GPS;
    const d = lerp(16, 12, ease.outCubic(u / 2));
    const a = 0.6 + u * 0.15;
    this.cam.set([Math.sin(a) * d, 3.2, Math.cos(a) * d], [0, 0, 0], 0, 40);
    drawGlobe(this.l3, 1, u * 0.3, this.cam.cam.position, { alpha: prog(t, GPS, GPS + 0.3) });
    const Ro = 4.17; // (6,371 + 20,200) / 6,371
    const inc = (55 * Math.PI) / 180;
    let sat = 0;
    for (let pl = 0; pl < 6; pl++) {
      const raan = (pl * TAU) / 6;
      const m = new THREE.Matrix4().makeRotationY(raan).multiply(new THREE.Matrix4().makeRotationX(inc));
      const rev = prog(t, GPS + pl * 0.08, GPS + 0.6 + pl * 0.08, ease.outExpo);
      const S = 96;
      for (let i = 0; i < S * rev; i++) {
        const p = new THREE.Vector3(Math.cos((i / S) * TAU) * Ro, 0, Math.sin((i / S) * TAU) * Ro).applyMatrix4(m);
        const q = new THREE.Vector3(Math.cos(((i + 1) / S) * TAU) * Ro, 0, Math.sin(((i + 1) / S) * TAU) * Ro).applyMatrix4(m);
        this.l3.seg(p.x, p.y, p.z, q.x, q.y, q.z, 0.9, LIN.bone[0] * 0.6, LIN.bone[1] * 0.6, LIN.bone[2] * 0.6, 0.6);
      }
      const nS = pl === 0 ? 6 : 5;
      for (let k = 0; k < nS; k++) {
        const th = (k * TAU) / nS + pl * 0.5 + u * 0.35;
        const p = new THREE.Vector3(Math.cos(th) * Ro, 0, Math.sin(th) * Ro).applyMatrix4(m);
        const I = 3;
        if (rev > 0.5) this.l3.seg(p.x, p.y, p.z, p.x + 0.001, p.y, p.z, 6, LIN.signal[0] * I, LIN.signal[1] * I, LIN.signal[2] * I, 1);
        sat++;
      }
    }
    lockup(c, { x: 120, y: 330, big: `${sat}`, bigSize: 190, t, label: 'GPS SATELLITES · 20,200 KM UP', sub: 'EVERY POINT ON EARTH IS NOW A COORDINATE', p: prog(t, GPS, GPS + 0.7), seed: 102 });
    ledger(c, 120, 900, { years: '1957 → NOW', next: 'THE ICBM · ANY CITY IN ~30 MINUTES', p: prog(t, GPS + 0.6, GPS + 1.2), t });
    return {};
  }
}
