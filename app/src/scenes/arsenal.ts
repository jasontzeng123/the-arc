// 08 ARSENAL (48–54 s). 12,187 warheads as a matrix (SIPRI, Jan 2026); ~2,100 on high alert pulse
// with the heartbeat. Dive into one → launch (50.0): THE ARC at planetary scale, a 30-minute flight
// compressed into 3.4 s. 53.4: vacuum.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { FSPass, Layer2D, W, H } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { LIN, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import { clamp, ease, frameIdx, hash, lerp, prog, pulse, TAU } from '../engine/util';
import { Cam, lockup, ledger, mono, onsets, fmt, tag, lc, heatc } from './_kit';
import { drawGlobe, globePoint } from './_globe';

const TOTAL = 12187, ALERT = 2100, DEPLOYED = 4012, STOCK = 9745;
const COLS = 139, SP = 8;
const LAUNCH = 50.0, VAC = 53.4;

export default class ArsenalScene extends Scene {
  bg = new FSPass(`uniform float k; void main(){ float v = smoothstep(1.2,0.1,length((vUv-0.5)*vec2(1.5,1.0))); fragColor = vec4(C_INK*(0.35+0.6*v)*k,1.0); }`, { k: { value: 1 } });
  l2 = new LineBatch(TOTAL + 4000);
  l3 = new LineBatch(20000, { screen2D: false });
  text = new Layer2D();
  cam = new Cam(36, 0.01, 100);
  pick = 0;
  beats: number[] = [];

  async init() {
    // the one that launches: an alert warhead near the middle
    this.pick = Math.floor(ALERT * 0.37) * 0 + 1180;
    this.beats = onsets(this.ctx.audio, 'kick', 48.0, 50.0).map((o) => o.t);
  }

  cell(i: number) {
    // alert first (a block), then deployed, stockpile, retired — row-major
    const x = i % COLS, y = Math.floor(i / COLS);
    const rows = Math.ceil(TOTAL / COLS);
    return { x: 1270 + (x - (COLS - 1) / 2) * SP, y: 560 + (y - (rows - 1) / 2) * SP };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, audio } = this.ctx;
    const t = f.t;
    this.bg.u.k!.value = t < VAC ? 1 : 0;
    this.bg.render(renderer, out);
    this.l2.clear(); this.l3.clear(); this.text.clear();
    const c = this.text.ctx;
    let post: Record<string, any> = {};
    if (t < LAUNCH) post = this.matrix(t, c);
    else if (t < VAC) post = this.flight(t, c);
    else post = this.vacuum(t, c);
    this.l3.render(renderer, out, this.cam.cam);
    this.l2.render(renderer, out);
    if (t < VAC) {
      mono(c, '08', 72, 84, { size: 15, color: rgba('signal', 1), t });
      mono(c, 'THE ARSENAL', 110, 84, { size: 15, color: rgba('bone', 0.85), t });
    }
    comp.draw(renderer, this.text.upload(), out);
    return { bloom: 0.9, grain: 0.06, vignette: 0.5, ...post };
  }

  matrix(t: number, c: CanvasRenderingContext2D) {
    const hb = this.ctx.audio.hit('kick', t, 0.08);
    const focus = this.cell(this.pick);
    const z = 1 + prog(t, 48.0, 49.6) * 0.12 + Math.pow(prog(t, 49.55, 50.0), 3) * 60;
    const fx = lerp(1270, focus.x, prog(t, 49.3, 49.9, ease.inOutCubic)), fy = lerp(560, focus.y, prog(t, 49.3, 49.9, ease.inOutCubic));
    const S = (p: { x: number; y: number }) => ({ x: lerp(1270, W / 2, prog(t, 49.3, 49.9, ease.inOutCubic)) + (p.x - fx) * z, y: 560 + (p.y - fy) * z });
    const fill = prog(t, 48.0, 48.6, ease.outCubic);
    const shown = Math.floor(TOTAL * fill);
    for (let i = 0; i < shown; i++) {
      const p = S(this.cell(i));
      if (p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20) continue;
      let col: [number, number, number], w = 4.2;
      if (i < ALERT) {
        const I = 1.6 + 2.2 * hb * (0.6 + 0.4 * hash(i, 3));
        col = [LIN.signal[0] * I, LIN.signal[1] * I, LIN.signal[2] * I];
      } else if (i < DEPLOYED) col = lc('bone', 1.15);
      else if (i < STOCK) col = lc('bone', 0.6);
      else { col = lc('graphite', 0.9); w = 3.2; }
      if (i === this.pick) { col = [6, 5, 4]; w = 5.5; }
      this.l2.seg2(p.x, p.y, p.x + 0.01, p.y, w * Math.min(z, 3), col, 1);
    }
    const tp = prog(t, 48.05, 48.7) * (1 - prog(t, 49.55, 49.75));
    lockup(c, { x: 120, y: 240, big: fmt(Math.round(TOTAL * fill)), bigSize: 140, t, label: 'NUCLEAR WARHEADS · JANUARY 2026', sub: 'SIPRI YEARBOOK 2026', p: tp, seed: 111 });
    const L = [
      { k: 'signal', n: '~2,100', d: 'ON HIGH ALERT' },
      { k: 'bone', n: '4,012', d: 'DEPLOYED' },
      { k: 'ash', n: '9,745', d: 'IN MILITARY STOCKPILES' },
      { k: 'graphite', n: '2,442', d: 'RETIRED, AWAITING DISMANTLEMENT' },
    ];
    L.forEach((l, i) => {
      const a = prog(t, 48.4 + i * 0.12, 48.7 + i * 0.12) * (1 - prog(t, 49.55, 49.75));
      if (a <= 0) return;
      c.fillStyle = rgba(l.k, a); c.fillRect(120, 420 + i * 34 - 11, 12, 12);
      mono(c, `${l.n}  ${l.d}`, 144, 420 + i * 34, { size: 14, color: rgba('bone', a), t, p: a });
    });
    mono(c, 'TYPICAL YIELD 100–800 KT · 7–50× HIROSHIMA', 120, 600, { size: 14, weight: 600, color: rgba('signal', tp), t, p: tp });
    return { zoom: 1 + hb * 0.01 };
  }

  flight(t: number, c: CanvasRenderingContext2D) {
    const u = t - LAUNCH;
    const dur = VAC - LAUNCH;
    const k = clamp(u / dur);
    // missile progress along the path: slow boost, fast midcourse, plunge
    const s = ease.inOutCubic(k) * 0.85 + k * 0.15;
    const R = 1;
    const rot = 0.4 + u * 0.05;
    // launch and target (lat, lon)
    const A = { la: 0.95, lo: -1.2 }, B = { la: 0.62, lo: 0.35 };
    const m0 = new THREE.Matrix4().makeRotationY(rot).premultiply(new THREE.Matrix4().makeRotationX(0.35));
    const pA = globePoint(m0, 1, A.la, A.lo), pB = globePoint(m0, 1, B.la, B.lo);
    const path = (q: number) => {
      const v = new THREE.Vector3().copy(pA).lerp(pB, q).normalize();
      const alt = 1 + 0.26 * Math.sin(Math.PI * q);
      return v.multiplyScalar(alt);
    };
    const head = path(s);
    // camera: from a wide view that frames the whole arc to chasing the warhead down
    const mid = path(0.5);
    const nrm = new THREE.Vector3().crossVectors(pA, pB).normalize();
    const camPos0 = nrm.clone().multiplyScalar(2.3).addScaledVector(mid.clone().normalize(), 1.2);
    const camPos1 = pB.clone().multiplyScalar(1.55).add(new THREE.Vector3(0.15, 0.2, 0));
    const ck = ease.inCubic(prog(t, 52.0, VAC));
    const cp = camPos0.clone().lerp(camPos1, ck);
    const tg = mid.clone().multiplyScalar(0.85).lerp(pB, ck);
    this.cam.set([cp.x, cp.y, cp.z], [tg.x, tg.y, tg.z], 0, 36);
    drawGlobe(this.l3, R, rot, this.cam.cam.position, { alpha: 0.9, lat: 12, lon: 24 });
    // the arc: ghost (dashed, full) + trail
    const N = 120;
    for (let i = 0; i < N; i += 2) {
      const a = path(i / N), b = path((i + 1) / N);
      this.l3.seg(a.x, a.y, a.z, b.x, b.y, b.z, 1, LIN.bone[0] * 0.5, LIN.bone[1] * 0.5, LIN.bone[2] * 0.5, 0.6);
    }
    for (let i = 0; i < N * s; i++) {
      const a = path(i / N), b = path(Math.min(s, (i + 1) / N));
      const r = (i / N) / Math.max(s, 1e-3);
      const I = 1.2 + 3 * r * r;
      this.l3.seg(a.x, a.y, a.z, b.x, b.y, b.z, 2.8, LIN.signal[0] * I, LIN.signal[1] * I, LIN.signal[2] * I, 1);
    }
    this.l3.seg(head.x, head.y, head.z, head.x + 0.0001, head.y, head.z, 9, 8, 7, 6, 1);
    // launch site & target markers
    for (const [p, col] of [[pA, lc('bone', 2)], [pB, lc('signal', 3)]] as const) {
      for (let i = 0; i < 32; i++) {
        const n = p.clone().normalize();
        const e1 = new THREE.Vector3(0, 1, 0).cross(n).normalize(), e2 = n.clone().cross(e1);
        const a0 = (i / 32) * TAU, a1 = ((i + 1) / 32) * TAU, r = 0.03;
        const q0 = p.clone().addScaledVector(e1, Math.cos(a0) * r).addScaledVector(e2, Math.sin(a0) * r);
        const q1 = p.clone().addScaledVector(e1, Math.cos(a1) * r).addScaledVector(e2, Math.sin(a1) * r);
        this.l3.seg(q0.x, q0.y, q0.z, q1.x, q1.y, q1.z, 1.4, col[0], col[1], col[2], 1);
      }
    }
    // exhaust sparks near the head during boost
    const hp = this.cam.project(head.x, head.y, head.z);
    // type
    lockup(c, { x: 120, y: 260, big: 'ICBM', bigSize: 170, t, label: '1957 · INTERCONTINENTAL BALLISTIC MISSILE', sub: 'MACH 20+ · RANGE 10,000+ KM', p: prog(t, LAUNCH, LAUNCH + 0.6), out: prog(t, 52.9, 53.2), seed: 121 });
    // flight clock 30:00 → 00:00
    const rem = (1 - k) * 30 * 60;
    const mm = Math.floor(rem / 60), ss = Math.floor(rem % 60);
    mono(c, 'TIME TO TARGET', W - 120, 150, { size: 14, color: rgba('ash', 1), t, align: 'right', p: prog(t, LAUNCH + 0.1, LAUNCH + 0.4) });
    c.font = font(F.mono(600), 96); c.textAlign = 'right'; c.fillStyle = rgba(k > 0.8 ? 'signal' : 'bone', prog(t, LAUNCH + 0.1, LAUNCH + 0.3));
    c.fillText(`${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`, W - 120, 240); c.textAlign = 'left';
    mono(c, `ALT ${fmt(Math.round((head.length() - 1) * 6371))} KM`, hp.x + 24, hp.y - 20, { size: 13, color: rgba('bone', 1), t });
    // range ruler: the whole film in one line
    this.ruler(t, c, prog(t, LAUNCH + 0.3, LAUNCH + 0.9) * (1 - prog(t, 52.8, 53.2)));
    const lp = pulse(t, LAUNCH, 0.08);
    const rumble = 0.3 + 0.7 * (1 - k);
    return { zoom: 1 + lp * 0.05 + ck * 0.02, shake: [(hash(frameIdx(t), 1) - 0.5) * (lp * 14 + rumble * 3), (hash(frameIdx(t), 2) - 0.5) * (lp * 14 + rumble * 3)], flash: pulse(t, LAUNCH, 0.02) * 0.1 };
  }

  ruler(t: number, c: CanvasRenderingContext2D, A: number) {
    if (A <= 0) return;
    const x0 = 120, x1 = W - 120, y = 1000;
    const X = (m: number) => x0 + (Math.log10(m) / 7) * (x1 - x0);
    this.l2.seg2(x0, y, x0 + (x1 - x0) * ease.outExpo(A), y, 1, lc('bone', 0.5), 1);
    for (let e = 0; e <= 7; e++) {
      this.l2.seg2(X(10 ** e), y, X(10 ** e), y - 10, 1, lc('bone', 0.6), A);
      mono(c, ['1 M', '10 M', '100 M', '1 KM', '10 KM', '100 KM', '1,000 KM', '10,000 KM'][e]!, X(10 ** e), y + 22, { size: 11, color: rgba('ash', 0.8), t, align: 'center', p: A });
    }
    const marks = [{ m: 30, n: 'SPEAR' }, { m: 250, n: 'BOW' }, { m: 1000, n: 'CANNON' }, { m: 10_000_000, n: 'ICBM' }];
    marks.forEach((mk, i) => {
      const x = X(mk.m), last = i === marks.length - 1;
      this.l2.seg2(x, y - 26, x, y, last ? 2 : 1.4, last ? lc('signal', 2) : lc('bone', 0.9), A);
      mono(c, mk.n, x, y - 34, { size: 12, color: rgba(last ? 'signal' : 'bone', 0.9), t, align: last ? 'right' : 'center', p: A });
    });
    mono(c, '×330,000 THE SPEAR', X(1e7) - 70, y - 60, { size: 14, weight: 600, color: rgba('signal', 1), t, align: 'right', p: A });
  }

  vacuum(t: number, c: CanvasRenderingContext2D) {
    // black; a single white point falls onto a thin reticle
    const k = prog(t, VAC, 54.0, ease.inQuad);
    const x = W / 2, y = lerp(380, 560, k);
    this.l2.seg2(x, y, x + 0.01, y, 4, [3, 3, 3], 1);
    const r = lerp(60, 8, k);
    for (let i = 0; i < 64; i++) {
      const a0 = (i / 64) * TAU, a1 = ((i + 1) / 64) * TAU;
      this.l2.seg2(x + Math.cos(a0) * r, 560 + Math.sin(a0) * r, x + Math.cos(a1) * r, 560 + Math.sin(a1) * r, 1, lc('signal', 1.2), 0.8);
    }
    return { grain: 0.03, vignette: 0.6, bloom: 0.6 };
  }
}
