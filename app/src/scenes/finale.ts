// 10 FINALE (58–68 s). One framing per bar, cut on each downbeat, each a step further out, the planet turning
// steadily eastward throughout: 58 the Middle East, already hit, launches everywhere → 60 three quarters of the
// planet (Eurasia) → 62 the whole planet → 64 far out, the Sun's glare, other bodies. 66.0: the Earth is simply gone —
// a pop, a spray of small particles. Silence.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { FSPass, Layer2D, W, H } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { LIN, rgba } from '../engine/palette';
import { clamp, ease, frameIdx, hash, lerp, prog, TAU } from '../engine/util';
import { Cam, mono, lc, heatc } from './_kit';

const S1 = 58, S2 = 60, S3 = 62, S4 = 64, POP = 66;
const OMEGA = 0.045; // rad/s: one steady eastward spin through all four framings
// where each framing is centred (earth-fixed lon, lat) at its first frame: the Middle East drifting out to Eurasia
const CENTRES: [number, number][] = [[47, 29], [58, 35], [66, 40]];

interface Missile { a: THREE.Vector3; b: THREE.Vector3; t0: number; t1: number; alt: number }

const sph = (lon: number, lat: number, r = 1) => {
  const la = (lat * Math.PI) / 180, lo = (lon * Math.PI) / 180;
  return new THREE.Vector3(Math.cos(la) * Math.cos(lo) * r, Math.sin(la) * r, -Math.cos(la) * Math.sin(lo) * r);
};

export default class FinaleScene extends Scene {
  bg = new FSPass(/* glsl */ `
    uniform float k, glare;
    void main() {
      float v = smoothstep(1.3, 0.1, length((vUv - 0.5) * vec2(1.5, 1.0)));
      vec3 c = C_INK * (0.3 + 0.5 * v) * k;
      vec2 q = (vUv - vec2(-0.04, 0.72)) * vec2(${W / H}, 1.0);
      float d = length(q);
      c += (vec3(1.0, 0.88, 0.76) * exp(-d * 9.0) * 2.6 + vec3(0.9, 0.4, 0.2) * exp(-d * 3.8) * 0.22 + C_BLOOD * exp(-d * 1.4) * 0.025) * glare;
      fragColor = vec4(c, 1.0);
    }`, { k: { value: 1 }, glare: { value: 0 } });
  l3 = new LineBatch(70000, { screen2D: false });
  text = new Layer2D();
  cam = new Cam(40, 0.001, 5000);
  coast: THREE.Vector3[][] = [];
  missiles: Missile[] = [];
  stars: THREE.Vector3[] = [];
  dust: { p: THREE.Vector3; s: number }[] = [];
  base = new THREE.Matrix4();
  up = new THREE.Vector3(0, 1, 0);
  M = new THREE.Matrix4();
  farDir = new THREE.Vector3(3.5, 9.2, 35).normalize();

  /** earth-fixed → world at time t: the spin about the planet's own axis, then a fixed orientation. */
  rot(t: number) { return new THREE.Matrix4().multiplyMatrices(this.base, new THREE.Matrix4().makeRotationY(OMEGA * (t - S1))); }
  W(p: THREE.Vector3) { return p.clone().applyMatrix4(this.M); }

  async init() {
    const g = await (await fetch('data/globe.json')).json();
    this.coast = (g.coast as number[][]).map((l) => { const o: THREE.Vector3[] = []; for (let i = 0; i < l.length; i += 2) o.push(sph(l[i]!, l[i + 1]!)); return o; });
    const land: number[][] = g.land;
    // orientation: at S3 the Eurasian centre faces the far camera, north up on screen
    const de = sph(CENTRES[2]![0], CENTRES[2]![1]).applyMatrix4(new THREE.Matrix4().makeRotationY(OMEGA * (S3 - S1)));
    const basis = (d: THREE.Vector3) => {
      const e1 = new THREE.Vector3(0, 1, 0).addScaledVector(d, -d.y).normalize();
      return new THREE.Matrix4().makeBasis(d, e1, d.clone().cross(e1));
    };
    this.base = basis(this.farDir.clone()).multiply(basis(de).transpose());
    this.up = new THREE.Vector3(0, 1, 0).applyMatrix4(this.base).normalize();
    // launches from everywhere, long before the first frame: by 58 some have landed, the rest keep coming.
    // Stratified over the globe so the far views read as covered.
    const NM = 72;
    const pick = (i: number, s: number) => {
      // prefer land sites spread in longitude: stratify by index
      const lo0 = -180 + (360 * ((i * 0.618034 + hash(i, s) * 0.3) % 1));
      let best = land[0]!, bd = 1e9;
      for (let j = 0; j < 12; j++) {
        const c = land[Math.floor(hash(i * 13 + j, s + 1) * land.length)]!;
        const d = Math.abs(((c[0]! - lo0 + 540) % 360) - 180);
        if (d < bd) { bd = d; best = c; }
      }
      return best;
    };
    // a handful aimed into the first framing (the Middle East), landed by or during 58–60, so its impacts spread there
    const me = land.filter(([lo, la]) => lo! > 32 && lo! < 62 && la! > 16 && la! < 42);
    for (let i = 0; i < 8; i++) {
      const A = pick(i + 200, 8), B = me[Math.floor(hash(i, 31) * me.length)]!;
      const a = sph(A[0]!, A[1]!), b = sph(B[0]!, B[1]!);
      const ang = a.angleTo(b);
      const dur = 6 * (1.4 + ang * 0.9);
      const t1 = 53 + (i / 8) * 6.5 + hash(i, 32) * 0.6; // 52.5 … 60
      this.missiles.push({ a, b, t0: t1 - dur, t1, alt: 0.07 + ang * 0.1 });
    }
    // and a few launched from inside it during the first framing
    for (let i = 0; i < 5; i++) {
      const A = me[Math.floor(hash(i, 41) * me.length)]!, B = pick(i + 300, 9);
      const a = sph(A[0]!, A[1]!), b = sph(B[0]!, B[1]!);
      const ang = a.angleTo(b);
      const t0 = 58.2 + i * 0.35;
      this.missiles.push({ a, b, t0, t1: t0 + 6 * (1.4 + ang * 0.9), alt: 0.07 + ang * 0.1 });
    }
    for (let i = 0; i < NM; i++) {
      const A = pick(i, 2), B = pick(i + 37, 4);
      const a = sph(A[0]!, A[1]!), b = sph(B[0]!, B[1]!);
      if (a.angleTo(b) < 0.25) continue;
      const t0 = 44 + (i / NM) * 20 + hash(i, 6) * 1.5;
      const ang = a.angleTo(b);
      this.missiles.push({ a, b, t0, t1: t0 + 6 * (1.4 + ang * 0.9), alt: 0.07 + ang * 0.1 });
    }
    for (let i = 0; i < 1800; i++) {
      this.stars.push(new THREE.Vector3(hash(i, 7) - 0.5, hash(i, 8) - 0.5, hash(i, 9) - 0.5).normalize().multiplyScalar(900 + hash(i, 10) * 900));
    }
    // a dust belt sweeping past the planet (stage 4)
    for (let i = 0; i < 6000; i++) {
      const u = hash(i, 11) * 2 - 1;
      const x = u * 70, off = (hash(i, 12) - 0.5 + hash(i, 13) - 0.5) * 7;
      this.dust.push({ p: new THREE.Vector3(x, -3.5 - 0.004 * x * x + off * 0.3 - x * 0.1, off + 12), s: 0.4 + hash(i, 14) });
    }
  }

  /** world position of the missile at time s (the planet has turned: use the current rotation) */
  missileAt(m: Missile, s: number) {
    const u = clamp((s - m.t0) / (m.t1 - m.t0));
    const p = new THREE.Vector3().copy(m.a).lerp(m.b, u).normalize();
    return this.W(p.multiplyScalar(1 + m.alt * Math.sin(Math.PI * u) + 0.02 * Math.sin(Math.PI * Math.min(1, u * 4))));
  }

  hidden(p: THREE.Vector3, c: THREE.Vector3) {
    const d = new THREE.Vector3().subVectors(p, c);
    const L = d.length(); d.multiplyScalar(1 / L);
    const b = c.dot(d), cc = c.lengthSq() - 1;
    const disc = b * b - cc;
    if (disc < 0) return false;
    const t0 = -b - Math.sqrt(disc);
    return t0 > 0 && t0 < L - 1e-3;
  }

  camera(t: number) {
    const cam = this.cam;
    const up: [number, number, number] = [this.up.x, this.up.y, this.up.z];
    // each framing looks along a world direction fixed at its first frame; the planet turns under it
    const dirAt = (k: number, ts: number) => sph(CENTRES[k]![0], CENTRES[k]![1]).applyMatrix4(this.rot(ts)).normalize();
    if (t < S2) {
      // continental: the Middle East (10 % further out than v4)
      const u = prog(t, S1, S2);
      const n = dirAt(0, S1);
      const pos = n.clone().multiplyScalar(lerp(1.62, 1.69, u));
      const tgt = n.clone().multiplyScalar(0.8);
      cam.set([pos.x, pos.y, pos.z], [tgt.x, tgt.y, tgt.z], 0, 42, up);
    } else if (t < S3) {
      // three quarters of the planet: its top and sides in frame, the bottom cut off
      const u = prog(t, S2, S3);
      const n = dirAt(1, S2);
      const pos = n.clone().multiplyScalar(lerp(2.12, 2.22, u));
      const tgt = this.up.clone().multiplyScalar(0.34);
      cam.set([pos.x, pos.y, pos.z], [tgt.x, tgt.y, tgt.z], 0, 40, up);
    } else if (t < S4) {
      // the far view, closer in
      const u = prog(t, S3, S4);
      const pos = this.farDir.clone().multiplyScalar(lerp(8.0, 8.6, u));
      cam.set([pos.x, pos.y, pos.z], [0, 0, 0], 0, 38, up);
    } else {
      const u = prog(t, S4, 68);
      const pos = new THREE.Vector3(lerp(3, 4.5, u), lerp(9, 9.6, u), lerp(34, 36.5, u));
      cam.set([pos.x, pos.y, pos.z], [0, 0, 0], 0, 38, up);
    }
    cam.cam.near = 0.001; cam.cam.far = 5000; cam.cam.updateProjectionMatrix();
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, audio } = this.ctx;
    const t = f.t;
    this.l3.clear(); this.text.clear();
    const c = this.text.ctx;
    this.M = this.rot(t);
    this.camera(t);
    const far = t >= S3;
    this.bg.u.k!.value = 1;
    this.bg.u.glare!.value = t >= S4 ? 1 : far ? 0.5 : 0;
    this.bg.render(renderer, out);
    const cp = this.cam.cam.position;
    for (const s of this.stars) this.l3.seg(s.x, s.y, s.z, s.x + 0.01, s.y, s.z, 1.3, 0.55, 0.55, 0.55, 0.55);
    const alive = t < POP;
    if (alive) this.earth(t, cp, far);
    if (far) this.space(t, cp, c);
    this.l3.render(renderer, out, this.cam.cam);
    // keep the 2D layer 'dirty' so an otherwise empty frame (after the pop) still replaces the last upload
    c.fillStyle = 'rgba(0,0,0,0.004)'; c.fillRect(0, 0, 1, 1);
    comp.draw(renderer, this.text.upload(), out);
    const z = audio.hit('zoom', t, 0.12);
    const kick = audio.hit('kick', t, 0.05);
    return {
      bloom: 0.95, grain: 0.06, vignette: 0.5, zoom: 1 + kick * 0.006 + z * 0.02, ca: 1.2 + z * 4,
      fade: prog(t, 67.2, 67.95),
    };
  }

  earth(t: number, cp: THREE.Vector3, far: boolean) {
    const face = (p: THREE.Vector3) => p.clone().normalize().dot(new THREE.Vector3().subVectors(cp, p).normalize());
    const seg = (a0: THREE.Vector3, b0: THREE.Vector3, w: number, col: [number, number, number], al: number) => {
      const a = this.W(a0), b = this.W(b0);
      const f = face(a);
      if (f < -0.05) return;
      this.l3.seg(a.x, a.y, a.z, b.x, b.y, b.z, w, col[0], col[1], col[2], al * clamp(f * 4 + 0.2));
    };
    const G = lc('graphite', 1.2);
    const step = far ? 8 : 4;
    for (let la = -80; la <= 80; la += 10) for (let lo = 0; lo < 360; lo += step) seg(sph(lo, la), sph(lo + step, la), 0.8, G, 0.5);
    for (let lo = 0; lo < 360; lo += 15) for (let la = -88; la < 88; la += step) seg(sph(lo, la), sph(lo, la + step), 0.8, G, 0.5);
    if (false) {
      const G2 = lc('graphite', 1.6);
      for (let la = 40; la <= 68; la += 1) for (let lo = 80; lo < 112; lo += 1) {
        seg(sph(lo, la), sph(lo + 1, la), 0.8, G2, 0.55);
        seg(sph(lo, la), sph(lo, la + 1), 0.8, G2, 0.55);
      }
    }
    const B = lc('bone', 1.15);
    for (const l of this.coast) for (let i = 1; i < l.length; i++) seg(l[i - 1]!, l[i]!, far ? 1 : 1.3, B, far ? 0.6 : 1);
    // limb
    const nv = cp.clone().normalize();
    const e1 = new THREE.Vector3(0, 1, 0).cross(nv).normalize(), e2 = nv.clone().cross(e1);
    const dist = cp.length();
    const rl = Math.sqrt(Math.max(0, 1 - 1 / (dist * dist))), cz = 1 / dist;
    for (let j = 0; j < 180; j++) {
      const a0 = (j / 180) * TAU, a1 = ((j + 1) / 180) * TAU;
      for (const [rs, I, w] of (far ? [[1.0, 0.8, 1.4], [1.02, 0.25, 3]] : [[1.0, 1.6, 2], [1.02, 0.5, 5]]) as [number, number, number][]) {
        const p = nv.clone().multiplyScalar(cz * rs).addScaledVector(e1, Math.cos(a0) * rl * rs).addScaledVector(e2, Math.sin(a0) * rl * rs);
        const q = nv.clone().multiplyScalar(cz * rs).addScaledVector(e1, Math.cos(a1) * rl * rs).addScaledVector(e2, Math.sin(a1) * rl * rs);
        this.l3.seg(p.x, p.y, p.z, q.x, q.y, q.z, w, LIN.bone[0] * I, LIN.bone[1] * I, LIN.bone[2] * I, 0.9);
      }
    }
    // missiles
    for (const m of this.missiles) {
      if (t < m.t0) continue;
      const flying = t < m.t1;
      const N = 36;
      const tt = Math.min(t, m.t1);
      for (let k = 0; k < N; k++) {
        const p = this.missileAt(m, lerp(m.t0, tt, k / N)), q = this.missileAt(m, lerp(m.t0, tt, (k + 1) / N));
        const r = (k + 1) / N;
        const hid = this.hidden(q, cp);
        const old = flying ? 1 : Math.max(0.3, clamp(1 - (t - m.t1) * 0.35));
        const col = heatc(0.55 + 0.35 * r, (1.2 + 3 * r * r) * (flying ? 1 : 0.6) * (far ? 0.45 : 1));
        this.l3.seg(p.x, p.y, p.z, q.x, q.y, q.z, far ? 1.2 : 2, col[0], col[1], col[2], (hid ? 0.1 : 0.95) * old);
      }
      // launch flash
      const la = t - m.t0;
      const ma = this.W(m.a), mb = this.W(m.b);
      if (la < 0.5 && !this.hidden(ma.clone().multiplyScalar(1.001), cp) && face(ma) > 0) {
        const I = 6 * (1 - la / 0.5);
        this.l3.seg(ma.x, ma.y, ma.z, ma.x + 1e-4, ma.y, ma.z, 6 + 16 * (1 - la / 0.5), LIN.signal[0] * I, LIN.signal[1] * I, LIN.signal[2] * I, 1);
      }
      if (flying) {
        const h = this.missileAt(m, t);
        if (!this.hidden(h, cp)) this.l3.seg(h.x, h.y, h.z, h.x + 1e-4, h.y, h.z, far ? 3 : 5, 5, 4.5, 4, 1);
      } else if (face(mb) > -0.1) {
        // impact: a flash, then a slow spreading ring (and a fainter second front) that stays
        const age = t - m.t1, b = mb;
        const vis = face(b) > 0 && !this.hidden(b.clone().multiplyScalar(1.001), cp);
        const I = 5 * Math.exp(-age * 3) + 0.9;
        if (vis) this.l3.seg(b.x, b.y, b.z, b.x + 1e-4, b.y, b.z, (far ? 2 : 3) + 16 * Math.exp(-age * 4), LIN.signal[0] * I, LIN.signal[1] * I, LIN.signal[2] * I, 1);
        const e1b = new THREE.Vector3().crossVectors(this.up, b).normalize(), e2b = b.clone().cross(e1b).normalize();
        for (const [lag, amp, Ir] of [[0, 1, 2.2], [0.5, 0.6, 1.2]] as [number, number, number][]) {
          const ag = age - lag;
          if (ag <= 0) continue;
          const rr = amp * 0.09 * (1 - Math.exp(-ag * 0.55)); // ~ 800 km, reached over several seconds
          const al = 0.35 + 0.65 * Math.exp(-ag * 0.4);
          for (let j = 0; j < 32; j++) {
            const a0 = (j / 32) * TAU, a1 = ((j + 1) / 32) * TAU;
            const p = b.clone().addScaledVector(e1b, Math.cos(a0) * rr).addScaledVector(e2b, Math.sin(a0) * rr).normalize().multiplyScalar(1.002);
            const q = b.clone().addScaledVector(e1b, Math.cos(a1) * rr).addScaledVector(e2b, Math.sin(a1) * rr).normalize().multiplyScalar(1.002);
            const f = face(p);
            if (f < 0) continue;
            this.l3.seg(p.x, p.y, p.z, q.x, q.y, q.z, far ? 1 : 1.4, LIN.signal[0] * Ir, LIN.signal[1] * Ir, LIN.signal[2] * Ir, al * clamp(f * 4 + 0.2));
          }
        }
      }
    }
  }

  space(t: number, cp: THREE.Vector3, c: CanvasRenderingContext2D) {
    // a moon nearby, a far planet, the dust belt, and (after the pop) the spray
    const moon = new THREE.Vector3(-7.5, 2.2, 3);
    const circle = (ctr: THREE.Vector3, R: number, I: number, w: number) => {
      const nv = cp.clone().sub(ctr).normalize();
      const e1 = new THREE.Vector3(0, 1, 0).cross(nv).normalize(), e2 = nv.clone().cross(e1);
      for (let j = 0; j < 64; j++) {
        const a0 = (j / 64) * TAU, a1 = ((j + 1) / 64) * TAU;
        const p = ctr.clone().addScaledVector(e1, Math.cos(a0) * R).addScaledVector(e2, Math.sin(a0) * R);
        const q = ctr.clone().addScaledVector(e1, Math.cos(a1) * R).addScaledVector(e2, Math.sin(a1) * R);
        // lit from the upper left (the Sun)
        const lit = clamp(0.25 + 0.75 * (-Math.cos(a0 + 0.9)));
        this.l3.seg(p.x, p.y, p.z, q.x, q.y, q.z, w, LIN.bone[0] * I * lit, LIN.bone[1] * I * lit, LIN.bone[2] * I * lit, 0.9);
      }
    };
    circle(moon, 0.27, 1.6, 1.5);
    const planet = new THREE.Vector3(16, -4, -6);
    this.l3.seg(planet.x, planet.y, planet.z, planet.x + 0.001, planet.y, planet.z, 5, LIN.ember[0] * 1.6, LIN.ember[1] * 1.2, LIN.ember[2], 1);
    for (const d of this.dust) {
      const p = d.p;
      const dd = p.distanceTo(cp);
      const w = clamp(60 / dd, 1, 7) * d.s;
      const I = 0.35 * d.s;
      this.l3.seg(p.x, p.y, p.z, p.x + 0.001, p.y, p.z, w, (LIN.bone[0] + 0.1) * I, LIN.bone[1] * I, LIN.bone[2] * I * 1.05, 0.35);
    }
    if (t < POP) {
      const ep = this.cam.project(0, 0, 0);
      const rpx = (1 / cp.length()) / Math.tan((this.cam.cam.fov * Math.PI) / 360) * (H / 2);
      const x0 = ep.x + rpx * 0.72 + 6, y0 = ep.y - rpx * 0.72 - 4;
      c.save();
      c.strokeStyle = rgba('bone', 0.9); c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + 60, y0 - 58); c.lineTo(x0 + 120, y0 - 58); c.stroke();
      c.restore();
      mono(c, 'HUMAN', x0 + 126, y0 - 53, { size: 15, weight: 600, color: rgba('bone', 1), t, p: prog(t, S3 + 0.3, S3 + 0.6) });
    } else {
      // gone: a spray of small particles from where it was
      const a = t - POP;
      for (let i = 0; i < 420; i++) {
        const dir = new THREE.Vector3(hash(i, 21) - 0.5, hash(i, 22) - 0.5, hash(i, 23) - 0.5).normalize();
        const sp = 0.6 + hash(i, 24) * 2.2;
        const r = sp * (1 - Math.exp(-a * 2.2)) / 2.2 * 2.2 + 0.9 * hash(i, 25);
        const p = dir.clone().multiplyScalar(r);
        const life = 0.8 + hash(i, 26) * 1.4;
        if (a > life) continue;
        const k = 1 - a / life;
        const hot = hash(i, 27) < 0.35;
        const I = (hot ? 2.4 : 1.4) * k;
        const col = hot ? [LIN.signal[0] * I, LIN.signal[1] * I, LIN.signal[2] * I] : [LIN.bone[0] * I, LIN.bone[1] * I, LIN.bone[2] * I];
        this.l3.seg(p.x, p.y, p.z, p.x + 0.001, p.y, p.z, 1.6 + hash(i, 28) * 1.4, col[0]!, col[1]!, col[2]!, k);
      }
    }
    void frameIdx;
  }
}
