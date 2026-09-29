// 01 STONE (0–8 s). Darkness; the first strike lights a cobble drawn as contour rings; every knap
// carves a flake scar until it is a hand-axe. It is hafted and thrown: THE ARC begins (6.0 s).
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { FSPass, Layer2D, W, H } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { LIN, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import { clamp, ease, frameIdx, hash, lerp, noise1, prog, pulse, TAU } from '../engine/util';
import { Cam, lockup, ledger, mono, onsets, fmt, lc, tag } from './_kit';
import { Flint } from './_flint';
import { THROW, LAND, spearAt, sideCam, toScreen, arcPoints, GY, VX, VY, H0, G } from './_arc';

export default class StoneScene extends Scene {
  bg = new FSPass(/* glsl */ `
    uniform float t, side, flash;
    void main() {
      vec2 p = FRAG_PX;
      vec2 uv = vUv;
      float v = smoothstep(1.25, 0.1, length((uv - vec2(0.62, 0.5)) * vec2(1.6, 1.0)));
      vec3 c = C_INK * (0.55 + 0.6 * v);
      // faint dot lattice
      vec2 g = mod(p, 32.0) - 16.0;
      float d = 1.0 - smoothstep(0.6, 1.4, length(g));
      c += C_BONE * d * 0.018 * (1.0 - side);
      c += C_SIGNAL * flash * 0.04 * v;
      fragColor = vec4(c, 1.0);
    }`, { t: { value: 0 }, side: { value: 0 }, flash: { value: 0 } });
  l3 = new LineBatch(16000, { screen2D: false });
  l2 = new LineBatch(12000);
  text = new Layer2D();
  cam = new Cam(30);
  flint!: Flint;
  knaps: number[] = [];
  m = new THREE.Matrix4();

  async init() {
    this.knaps = onsets(this.ctx.audio, 'knap', 0, 6).map((o) => o.t);
    this.flint = new Flint(this.knaps);
  }

  /** Object transform: slow turn, jolts on each knap; spear pose at the end. */
  pose(t: number) {
    let jolt = 0;
    for (const k of this.knaps) jolt += pulse(t, k, 0.07) * (hash(k * 10, 1) - 0.5) * 0.12;
    const yaw = -0.35 + t * 0.1 + jolt;
    const pitch = 0.22 + 0.05 * Math.sin(t * 0.7) + jolt * 0.5;
    const toSpear = prog(t, 5.6, 5.98, ease.inOutCubic);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch * (1 - toSpear), yaw * (1 - toSpear) + toSpear * Math.PI * 0.5, -toSpear * Math.PI * 0.5 * 0.92));
    this.m.compose(new THREE.Vector3(0, 0, 0), q, new THREE.Vector3(1, 1, 1));
    return this.m;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, audio } = this.ctx;
    const t = f.t;
    const side = t >= THROW ? 1 : 0;
    const kH = audio.hit('knap', t, 0.06);
    this.bg.u.t!.value = t;
    this.bg.u.side!.value = side;
    this.bg.u.flash!.value = kH;
    this.bg.render(renderer, out);
    const c = this.text.ctx;
    this.text.clear();
    this.l2.clear();
    let post: Record<string, any> = {};
    if (!side) {
      post = this.closeup(f, c);
      this.l3.render(renderer, out, this.cam.cam);
    } else post = this.flight(f, c);
    this.l2.render(renderer, out);
    comp.draw(renderer, this.text.upload(), out);
    return { bloom: 0.8, grain: 0.06, vignette: 0.45, ...post };
  }

  // ---------------------------------------------------------------- 0–6 s: the stone
  closeup(f: Frame, c: CanvasRenderingContext2D) {
    const t = f.t;
    const { renderer } = this.ctx;
    const first = this.knaps[0] ?? 1.0;
    const shot2 = t >= 4.0; // second framing on the taiko
    // camera
    let jolt = 0;
    for (const k of this.knaps) jolt += pulse(t, k, 0.05);
    const push = t * 0.05;
    const toSpear = prog(t, 5.6, 6.0, ease.inCubic);
    if (!shot2) {
      const d = 6.2 - push;
      this.cam.set([Math.sin(0.1) * d, 0.35, Math.cos(0.1) * d], [-0.95, 0.05, 0], 0.02 * noise1(t, 3), 30);
    } else {
      const u = t - 4.0;
      const d = lerp(4.3, 4.0, u / 2) + toSpear * 3.5;
      this.cam.set([Math.sin(-0.35) * d, 1.4 - toSpear * 1.2, Math.cos(-0.35) * d], [-0.5 + toSpear * 1.8, 0.1 - toSpear * 0.3, 0], -0.06, 30 + toSpear * 8);
    }
    // stone
    const m = this.pose(t);
    this.l3.clear();
    const rev = (y: number, x: number, z: number) => {
      if (t < first) return 0;
      const d = Math.hypot(y - 0.2, x - 0.5, z);
      return clamp(((t - first) * 4.5 - d) * 5);
    };
    const heat = (i: number) => {
      const kt = this.knaps[i];
      if (kt === undefined || t < kt) return 0;
      return Math.exp(-(t - kt) / 0.3);
    };
    this.flint.draw(this.l3, t, m, this.cam.cam.position, { reveal: rev, heat, intensity: 1.0 + 0.5 * this.ctx.audio.hit('knap', t, 0.05) });
    // haft (spear shaft) grows from the base as it turns into a spear
    const sh = prog(t, 5.62, 5.95, ease.outExpo);
    if (sh > 0) {
      const a = new THREE.Vector3(0, -0.95, 0.05).applyMatrix4(m), b = new THREE.Vector3(0, -0.95 - 14 * sh, 0.05).applyMatrix4(m);
      this.l3.seg(a.x, a.y, a.z, b.x, b.y, b.z, 3.0, LIN.bone[0], LIN.bone[1], LIN.bone[2], 1);
      for (let i = 0; i < 6; i++) {
        const y = -0.8 - i * 0.05;
        const p = new THREE.Vector3(-0.12, y, 0.05).applyMatrix4(m), q = new THREE.Vector3(0.12, y - 0.04, 0.05).applyMatrix4(m);
        this.l3.seg(p.x, p.y, p.z, q.x, q.y, q.z, 1.5, LIN.signal[0] * 2, LIN.signal[1] * 2, LIN.signal[2] * 2, sh);
      }
    }
    // flakes: the removed piece (the new facet's outline) flies off along the plane normal, spinning
    this.knaps.forEach((kt, i) => {
      const age = t - kt;
      if (age < 0 || age > 0.8 || i >= this.flint.cuts.length) return;
      const info = this.flint.cutInfo(i, kt);
      const mk = this.pose(kt).clone();
      const nm = new THREE.Matrix3().getNormalMatrix(mk);
      const cW = info.center.clone().applyMatrix4(mk);
      const nW = info.n.clone().applyMatrix3(nm).normalize();
      const vel = nW.clone().multiplyScalar(3.2 + hash(i, 3) * 1.5).add(new THREE.Vector3((hash(i, 4) - 0.5) * 1.2, 1.2, 0));
      const pos = cW.clone().addScaledVector(vel, age);
      pos.y -= 0.5 * 7 * age * age;
      const ax = new THREE.Vector3(hash(i, 5) - 0.5, hash(i, 6) - 0.5, hash(i, 7) - 0.5).normalize();
      const rot = new THREE.Quaternion().setFromAxisAngle(ax, age * (6 + hash(i, 8) * 8));
      const al = clamp(1 - age / 0.8) ** 1.5;
      const pts = info.outline.map((p) => p.clone().applyMatrix4(mk).sub(cW).multiplyScalar(0.5).applyQuaternion(rot).add(pos));
      for (let q = 0; q < pts.length; q++) {
        const A = pts[q]!, B = pts[(q + 1) % pts.length]!;
        const hh = Math.exp(-age / 0.25);
        this.l3.seg(A.x, A.y, A.z, B.x, B.y, B.z, 1.6, LIN.bone[0] * 1.3 + LIN.signal[0] * 3 * hh, LIN.bone[1] * 1.3 + LIN.signal[1] * 3 * hh, LIN.bone[2] * 1.3 + LIN.signal[2] * 3 * hh, al);
      }
      // small chips
      for (let j = 0; j < 8; j++) {
        const h = (x: number) => hash(i, j, x);
        const dir = nW.clone().multiplyScalar(1.2).add(new THREE.Vector3(h(1) - 0.5, h(2) * 1.2, h(3) - 0.5)).normalize();
        const p = cW.clone().addScaledVector(dir, (2.5 + h(4) * 3) * age);
        p.y -= 0.5 * 7 * age * age;
        const sz = 0.015 + h(5) * 0.02, r0 = h(6) * TAU + age * 12;
        const tri = [0, 1, 2].map((k) => new THREE.Vector3(p.x + Math.cos(r0 + k * 2.1) * sz, p.y + Math.sin(r0 + k * 2.1) * sz, p.z));
        for (let k = 0; k < 3; k++) { const A = tri[k]!, B = tri[(k + 1) % 3]!; this.l3.seg(A.x, A.y, A.z, B.x, B.y, B.z, 1.1, LIN.bone[0], LIN.bone[1], LIN.bone[2], clamp(1 - age / 0.7)); }
      }
      const pos2 = cW;
      // spark burst (2D)
      const sp = this.cam.project(pos2.x, pos2.y, pos2.z);
      for (let j = 0; j < 26; j++) {
        const life = 0.18 + hash(i, j, 9) * 0.35;
        if (age > life) continue;
        const a = hash(i, j, 10) * TAU, v = 300 + hash(i, j, 11) ** 2 * 1400;
        const k = age / life;
        const x = sp.x + Math.cos(a) * v * age, y = sp.y + Math.sin(a) * v * age + 900 * age * age;
        const x0 = sp.x + Math.cos(a) * v * Math.max(0, age - 0.02), y0 = sp.y + Math.sin(a) * v * Math.max(0, age - 0.02) + 900 * Math.max(0, age - 0.02) ** 2;
        const heat = (1 - k) ** 2;
        this.l2.seg2(x0, y0, x, y, 1.4, [LIN.signal[0] * 2 + heat * 3, LIN.signal[1] * 2 + heat * 2, LIN.signal[2] * 2 + heat], 1 - k);
      }
    });
    return this.closeupText(f, c, shot2);
  }

  closeupText(f: Frame, c: CanvasRenderingContext2D, shot2: boolean) {
    const t = f.t;
    // chapter HUD
    const hudA = prog(t, 0.2, 0.6);
    mono(c, '01', 72, 84, { size: 15, color: rgba('signal', 1), p: hudA, t });
    mono(c, 'STONE', 110, 84, { size: 15, color: rgba('bone', 0.85), p: hudA, t, seed: 2 });
    mono(c, 'THE ARC — A HISTORY OF KILLING AT A DISTANCE', W - 72, 84, { size: 13, color: rgba('ash', 0.8), p: prog(t, 0.3, 1.0), t, align: 'right', seed: 4 });
    // pre-strike: a blinking cursor in the dark
    if (t < 1.0) {
      const on = frameIdx(t) % 30 < 18 ? 1 : 0;
      c.fillStyle = rgba('signal', on * prog(t, 0.1, 0.3));
      c.fillRect(W * 0.62 - 6, H / 2 - 10, 12, 20);
    }
    // big lockup
    const lx = 120, ly = shot2 ? 640 : 610;
    lockup(c, {
      x: lx, y: ly, big: '3,300,000', bigSize: shot2 ? 132 : 150, t,
      label: 'YEARS AGO · THE FIRST STONE TOOLS', sub: 'LOMEKWI 3 · WEST TURKANA · KENYA',
      p: prog(t, 2.0, 2.9), seed: 11,
    });
    // kills per strike
    const kp = prog(t, 2.5, 3.2);
    if (kp > 0) {
      mono(c, 'KILLS / STRIKE', W - 72, 150, { size: 13, color: rgba('ash', 1), p: kp, t, align: 'right' });
      c.font = font(F.archivo(125, 900), 64); c.fillStyle = rgba('bone', kp); c.textAlign = 'right';
      c.fillText('1', W - 72, 215); c.textAlign = 'left';
    }
    // scar callouts
    this.knaps.forEach((kt, i) => {
      const a = prog(t, kt, kt + 0.12) * (1 - prog(t, kt + 0.9, kt + 1.3));
      if (a <= 0) return;
      if (i >= this.flint.cuts.length) return;
      const pos = this.flint.cutInfo(i, t).center.applyMatrix4(this.pose(t));
      const s = this.cam.project(pos.x, pos.y, pos.z);
      const dx = s.x > W * 0.62 ? 90 : -90;
      c.save();
      c.globalAlpha = a;
      c.strokeStyle = rgba('signal', 0.9); c.lineWidth = 1.2;
      c.beginPath(); c.arc(s.x, s.y, 6 + 10 * (1 - a), 0, TAU); c.stroke();
      c.beginPath(); c.moveTo(s.x + Math.sign(dx) * 10, s.y); c.lineTo(s.x + dx, s.y - 40); c.lineTo(s.x + dx * 1.5, s.y - 40); c.stroke();
      c.restore();
      mono(c, `STRIKE ${String(i + 1).padStart(2, '0')}`, s.x + dx * 1.5 + (dx > 0 ? 8 : -8), s.y - 36, { size: 13, color: rgba('bone', 0.9 * a), p: prog(t, kt, kt + 0.25), t, align: dx > 0 ? 'left' : 'right', seed: i });
    });
    // Δt ledger
    ledger(c, 120, 900, { years: '3,236,000 YRS', next: 'UNTIL THE BOW', p: prog(t, 4.1, 4.8) * (1 - prog(t, 5.7, 5.95)), t });
    const post: Record<string, any> = {};
    const kH = this.ctx.audio.hit('knap', t, 0.05);
    post.zoom = 1 + kH * 0.012 + (t >= 4 ? 0.0 : 0);
    post.shake = [(hash(frameIdx(t), 1) - 0.5) * kH * 6, (hash(frameIdx(t), 2) - 0.5) * kH * 6];
    post.flash = pulse(t, this.knaps[0] ?? 1, 0.02) * 0.025;
    post.exposure = t < (this.knaps[0] ?? 1) ? 0.9 : 1;
    return post;
  }

  // ---------------------------------------------------------------- 6–8 s: the flight
  flight(f: Frame, c: CanvasRenderingContext2D) {
    const t = f.t;
    const cam = sideCam(t);
    const sp = spearAt(t);
    const S = (x: number, y: number) => toScreen(x, y, cam);
    // ground + ruler
    const g0 = S(-40, 0), g1 = S(80, 0);
    this.l2.seg2(g0.x, g0.y, g1.x, g1.y, 1.2, lc('bone', 0.55), 1);
    for (let m = -10; m <= 60; m++) {
      const p = S(m, 0);
      if (p.x < -20 || p.x > W + 20) continue;
      const big = m % 5 === 0;
      this.l2.seg2(p.x, p.y + 2, p.x, p.y + (big ? 22 : 9), 1.1, lc('bone', big ? 0.7 : 0.35), 1);
      if (big && m >= 0) mono(c, `${m} M`, p.x + 6, p.y + 42, { size: 14, color: rgba('ash', 0.9), t });
    }
    // ghost trajectory (dashed) — the computed path ahead
    const n = 60;
    for (let i = 0; i < n; i += 2) {
      const ta = ((LAND - THROW) * i) / n, tb = ((LAND - THROW) * (i + 1)) / n;
      const a = S(VX * ta, H0 + VY * ta - 0.5 * G * ta * ta), b = S(VX * tb, H0 + VY * tb - 0.5 * G * tb * tb);
      this.l2.seg2(a.x, a.y, b.x, b.y, 1, lc('bone', 0.28), prog(t, THROW, THROW + 0.25));
    }
    // the arc (trail)
    const pts = arcPoints(t, 90).map((p) => S(p.x, p.y));
    for (let i = 1; i < pts.length; i++) {
      const k = i / pts.length;
      this.l2.seg2(pts[i - 1]!.x, pts[i - 1]!.y, pts[i]!.x, pts[i]!.y, 2.6, lc('signal', 1.6 + 1.6 * k), 1);
    }
    // the spear
    const head = S(sp.x, sp.y);
    const len = 2.6 * cam.s;
    const dx = Math.cos(sp.ang), dy = -Math.sin(sp.ang);
    this.l2.seg2(head.x - dx * len, head.y - dy * len, head.x, head.y, 3, lc('bone', 1.3), 1);
    // stone tip (lens)
    const tipL = 0.32 * cam.s, tipW = 0.11 * cam.s;
    const nx = -dy, ny = dx;
    const tip = [
      [head.x + dx * tipL, head.y + dy * tipL], [head.x + nx * tipW, head.y + ny * tipW], [head.x - dx * tipL * 0.3, head.y - dy * tipL * 0.3], [head.x - nx * tipW, head.y - ny * tipW],
    ];
    for (let i = 0; i < 4; i++) {
      const a = tip[i]!, b = tip[(i + 1) % 4]!;
      this.l2.seg2(a[0]!, a[1]!, b[0]!, b[1]!, 1.6, lc('bone', 1.6), 1);
    }
    // thrower marker
    const o = S(0, 0);
    this.l2.seg2(o.x, o.y, o.x, o.y - H0 * cam.s, 1.2, lc('signal', 1.2), 1);
    mono(c, 'ORIGIN', o.x - 8, o.y - H0 * cam.s - 14, { size: 13, color: rgba('signal', 1), t, align: 'right' });
    // head readout
    mono(c, `X ${sp.x.toFixed(1)} M   Y ${sp.y.toFixed(1)} M`, head.x + 26, head.y - 26, { size: 14, color: rgba('bone', 0.85), t });
    // lockups
    lockup(c, { x: 120, y: 330, big: '500,000', bigSize: 118, t, label: 'YEARS AGO · THE HAFTED SPEAR', sub: 'KATHU PAN · SOUTH AFRICA', p: prog(t, THROW + 0.05, THROW + 0.8), seed: 21 });
    mono(c, 'RANGE', 120, 470, { size: 14, color: rgba('ash', 1), p: prog(t, THROW + 0.4, THROW + 0.8), t });
    c.font = font(F.archivo(125, 900), 72); c.fillStyle = rgba('signal', prog(t, THROW + 0.4, THROW + 0.6));
    c.fillText(`${Math.round(sp.x)} M`, 120, 545);
    // chapter HUD persists
    mono(c, '01', 72, 84, { size: 15, color: rgba('signal', 1), t });
    mono(c, 'STONE', 110, 84, { size: 15, color: rgba('bone', 0.85), t });
    mono(c, 'KILLS / STRIKE', W - 72, 150, { size: 13, color: rgba('ash', 1), t, align: 'right' });
    c.font = font(F.archivo(125, 900), 64); c.fillStyle = rgba('bone', 1); c.textAlign = 'right';
    c.fillText('1', W - 72, 215); c.textAlign = 'left';
    const th = pulse(t, THROW, 0.08);
    return { zoom: 1 + th * 0.03, flash: th * 0.12 };
  }
}
