// 09 DETONATION + END (54–64 s). The flash; the fireball on the contour terrain; the shock arrives
// 0.55 s later (as in the score); the cloud rises as contour rings. Then ash, and on the ground the
// stone from the opening. 62.0: one more strike. The cursor blinks, as in the first frame.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { FSPass, Layer2D, W, H } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { LIN, rgba } from '../engine/palette';
import { clamp, ease, frameIdx, hash, lerp, noise3, prog, pulse, TAU } from '../engine/util';
import { Cam, mono, onsets, heatc, mixc, lc } from './_kit';
import { Stone } from './_stone';

const T0 = 54.0, SHOCK = 54.55, LAST = 62.0, END = 62.7;
const STONE = new THREE.Vector3(260, -1450, 0);

export default class BlastScene extends Scene {
  terrain = new FSPass(/* glsl */ `
    uniform vec3 camPos; uniform mat3 camRot; uniform float tanHalf, aspect, tb, fire, burn, calm;
    void main() {
      vec2 ndc = vUv * 2.0 - 1.0;
      vec3 dir = normalize(camRot * vec3(ndc.x * tanHalf * aspect, ndc.y * tanHalf, -1.0));
      vec3 col = C_INK * 0.5;
      if (dir.z < -1e-4) {
        float tt = -camPos.z / dir.z;
        vec2 p = camPos.xy + dir.xy * tt;
        float r = length(p);
        float amp = mix(1.0, 0.25, calm);
        float h = fbm(p * 0.0009 + 7.0, 3) * amp;
        // shock ring: a travelling bump, and the land behind it flattened
        float ringR = tb * 4700.0;
        float ring = exp(-pow((r - ringR) / 120.0, 2.0)) * step(0.0, tb);
        h += ring * 0.25;
        float s = h / 0.05;
        float fw = fwidth(s);
        float d = abs(fract(s + 0.5) - 0.5) / max(fw, 1e-4);
        float line = pxLine(d, 0.4, 1.4);
        float thick = 1.0 - step(0.2, abs(mod(floor(s + 0.5), 5.0)));
        float fog = exp(-tt * 0.00025);
        // light from the fireball: falls off with distance, burns the lines orange near ground zero
        float glow = fire * 9.0e5 / (r * r + 4.0e4);
        vec3 lc = mix(C_BONE, C_SIGNAL * 1.5, sat(burn * 1.5 * exp(-r / 2500.0)));
        col += lc * line * (0.12 + 0.3 * thick) * fog * (1.0 + glow + ring * 4.0 * exp(-tb * 1.5));
        col += C_EMBER * glow * 0.02 * fog;
      }
      // sky glow above the horizon
      col += C_SIGNAL * fire * 0.05 * sat(1.0 - abs(ndc.x) * 0.5) * sat(dir.z + 0.2);
      fragColor = vec4(col, 1.0);
    }`, {
    camPos: { value: new THREE.Vector3() }, camRot: { value: new THREE.Matrix3() }, tanHalf: { value: 0.3 }, aspect: { value: W / H },
    tb: { value: -1 }, fire: { value: 0 }, burn: { value: 0 }, calm: { value: 0 },
  });
  black = new FSPass(`void main(){ fragColor = vec4(0.0,0.0,0.0,1.0); }`);
  l3 = new LineBatch(40000, { screen2D: false });
  l2 = new LineBatch(4000);
  text = new Layer2D();
  cam = new Cam(40, 1, 40000);
  stone!: Stone;
  sm = new THREE.Matrix4();

  async init() {
    const kn = onsets(this.ctx.audio, 'knap', 0, 6).map((o) => o.t);
    this.stone = new Stone(kn, 5);
    // lying on its side on the ground, pointing across the view
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.1, 0.05, 1.25));
    this.sm.compose(STONE.clone().add(new THREE.Vector3(0, 0, 5)), q, new THREE.Vector3(26, 26, 26));
  }

  camera(t: number) {
    // wide on the blast, slow push; 58–61.5 descend through the ash to the stone
    const u = t - T0;
    const shake = pulse(t, SHOCK, 0.35) * 40;
    const jx = (hash(frameIdx(t), 1) - 0.5) * shake, jz = (hash(frameIdx(t), 2) - 0.5) * shake;
    const A = new THREE.Vector3(-300 + jx, -3600 + u * 60, 380 + jz);
    const At = new THREE.Vector3(0, 0, 500 + Math.min(u, 4) * 140);
    const B = STONE.clone().add(new THREE.Vector3(-70, -125, 36));
    const Bt = STONE.clone().add(new THREE.Vector3(8, 0, 4));
    const k = 0;
    const pos = A.clone().lerp(B, k);
    const tgt = At.clone().lerp(Bt, ease.inOutCubic(prog(t, 57.6, 61.0)));
    this.cam.set([pos.x, pos.y, pos.z], [tgt.x, tgt.y, tgt.z], 0, lerp(40, 30, k), [0, 0, 1]);
    return k;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, audio } = this.ctx;
    const t = f.t;
    this.l3.clear(); this.l2.clear(); this.text.clear();
    const c = this.text.ctx;
    if (t >= END) {
      // black; the cursor, blinking
      this.black.render(renderer, out);
      const on = frameIdx(t) % 30 < 18 ? 1 : 0;
      c.fillStyle = rgba('signal', on);
      c.fillRect(W * 0.62 - 6, H / 2 - 10, 12, 20);
      comp.draw(renderer, this.text.upload(), out);
      return { bloom: 0.8, grain: 0.05, vignette: 0.5, fade: prog(t, 63.6, 64.0) };
    }
    const k = this.camera(t);
    const u = t - T0;
    const c3 = this.cam.cam;
    const tu = this.terrain.u;
    (tu.camPos!.value as THREE.Vector3).copy(c3.position);
    (tu.camRot!.value as THREE.Matrix3).setFromMatrix4(c3.matrixWorld);
    tu.tanHalf!.value = Math.tan((c3.fov * Math.PI) / 360);
    tu.tb!.value = t - T0;
    const fire = Math.exp(-u * 0.9) * 1.0 + 0.15 * Math.exp(-u * 0.2);
    tu.fire!.value = fire * (1 - k * 0.9);
    tu.burn!.value = clamp(u * 2);
    tu.calm!.value = prog(t, SHOCK, SHOCK + 1.2);
    this.terrain.render(renderer, out);
    this.cloud(t, 1);
    this.ash(t);
    this.launches(t);
    // the stone
    const sa = prog(t, 59.2, 60.4);
    if (sa > 0) {
      const heat = (uu: number, th: number) => {
        const sc = this.stone.scars[3]!;
        let dth = th - sc.th; dth = Math.atan2(Math.sin(dth), Math.cos(dth));
        const g = Math.exp(-((uu - sc.u) ** 2) / 0.05 - (dth * dth) / 0.3);
        return t >= LAST ? g * Math.exp(-(t - LAST) / 0.3) : 0;
      };
      const fadeOut = 1 - prog(t, LAST + 0.25, END);
      this.stone.draw(this.l3, 7, this.sm, c3.position, { alpha: sa * fadeOut, intensity: 0.75 + audio.hit('knap', t, 0.05) * 1.5, heatAt: heat, width: 1.1 });
    }
    this.l3.render(renderer, out, c3);
    // the last strike: sparks
    if (t >= LAST) {
      const age = t - LAST;
      const sw = this.stone.scarPos(3, 7, this.sm);
      const sp = this.cam.project(sw.x, sw.y, sw.z);
      for (let j = 0; j < 30; j++) {
        const life = 0.2 + hash(j, 9) * 0.45;
        if (age > life) continue;
        const a = -Math.PI * hash(j, 10), v = 200 + hash(j, 11) ** 2 * 1300;
        const q = age / life;
        const x = sp.x + Math.cos(a) * v * age, y = sp.y + Math.sin(a) * v * age + 1300 * age * age;
        const ta = Math.max(0, age - 0.02);
        const x0 = sp.x + Math.cos(a) * v * ta, y0 = sp.y + Math.sin(a) * v * ta + 1300 * ta * ta;
        const hh = (1 - q) ** 2;
        this.l2.seg2(x0, y0, x, y, 1.5, [LIN.signal[0] * 2 + hh * 4, LIN.signal[1] * 2 + hh * 3, LIN.signal[2] * 2 + hh], 1 - q);
      }
      // the cursor appears where the eye was left in the first frame
      const on = frameIdx(t) % 30 < 18 ? 1 : 0;
      c.fillStyle = rgba('signal', on * prog(t, LAST + 0.3, END));
      c.fillRect(W * 0.62 - 6, H / 2 - 10, 12, 20);
    }
    this.l2.render(renderer, out);
    // a single clock
    if (t < 58.0) {
      const tt = Math.max(0, t - T0);
      mono(c, `T + ${tt.toFixed(3)} S`, W - 72, 84, { size: 15, color: rgba('bone', 0.8 * (1 - prog(t, 57.5, 58.0))), t, align: 'right' });
      mono(c, '09', 72, 84, { size: 15, color: rgba('signal', 1 - prog(t, 57.5, 58.0)), t });
    }
    comp.draw(renderer, this.text.upload(), out);
    const sh = pulse(t, SHOCK, 0.12);
    const white = t < T0 + 0.1 ? 1 : 0;
    return {
      bloom: 1.1, bloomThreshold: 0.8, grain: 0.07 + sh * 0.1, vignette: 0.5,
      flash: (white ? 6 : 0) + pulse(t, T0 + 0.1, 0.05) * 1.5 + sh * 0.2,
      invert: t >= T0 + 0.1 && t < T0 + 0.2 ? 1 : 0,
      exposure: 1 + pulse(t, T0, 0.2) * 1.5,
      zoom: 1 + sh * 0.06, ca: 1.2 + sh * 14 + pulse(t, T0, 0.2) * 8,
      shake: [(hash(frameIdx(t), 5) - 0.5) * sh * 40, (hash(frameIdx(t), 6) - 0.5) * sh * 40],
    };
  }

  /** The cloud as horizontal contour rings: fireball → stem + rolling toroidal cap. */
  cloud(t: number, alpha: number) {
    if (alpha <= 0) return;
    const u = t - T0;
    if (u < 0) return;
    const e = 1 - Math.exp(-u * 0.55);
    const Hc = 150 + 1500 * e; // cap height
    const Rc = 120 + 520 * e; // torus major radius
    const rc = 90 + 330 * e; // torus minor radius
    const fb = u < 0.9 ? 60 + 380 * ease.outExpo(clamp(u / 0.9)) : 0; // early fireball radius
    const top = Hc + rc * 1.4;
    const nz = 64, S = 96;
    for (let i = 0; i < nz; i++) {
      const z = (i + 0.5) * (top / nz);
      const radii: number[] = [];
      // stem: narrow, flaring at the base and into the cap
      const stem = 60 + 90 * e + 260 * Math.exp(-z / 120) * e + 200 * Math.exp(-Math.abs(z - (Hc - rc)) / 160) * e;
      if (z < Hc) radii.push(stem);
      // cap: torus section (outer and inner walls) + a dome on top
      const dz = z - Hc;
      if (Math.abs(dz) < rc) {
        const w = Math.sqrt(rc * rc - dz * dz);
        radii.push(Rc + w);
        if (Rc - w > stem) radii.push(Rc - w);
      }
      const dome = (Rc + rc * 0.2) * Math.sqrt(Math.max(0, 1 - ((z - Hc - rc * 0.1) / (rc * 1.3)) ** 2));
      if (z > Hc && dome > 0) radii.push(dome);
      // early fireball: a sphere sitting on the ground
      if (fb > 0 && z < fb * 2) radii.push(Math.sqrt(Math.max(0, fb * fb - (z - fb) ** 2)));
      const zc = z;
      for (const R0 of radii) {
        if (R0 < 5) continue;
        const heat = clamp(1.05 - u * 0.28 - z / (top * 3)) ;
        const col = mixc(heatc(0.35 + heat * 0.65, 1 + heat * 5), lc('bone', 0.55), clamp(u * 0.2 - 0.1));
        const al = alpha * (0.35 + 0.65 * clamp(z / 300));
        let prev: THREE.Vector3 | null = null;
        for (let j = 0; j <= S; j++) {
          const a = (j / S) * TAU;
          const roll = noise3(Math.cos(a) * 1.6, Math.sin(a) * 1.6, z * 0.006 - u * 0.8, 3);
          const R = R0 * (1 + 0.1 * roll + 0.04 * Math.sin(a * 7 + z * 0.02 + u));
          const p = new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, zc);
          if (prev) this.l3.seg(prev.x, prev.y, prev.z, p.x, p.y, p.z, 1.1, col[0], col[1], col[2], al);
          prev = p;
        }
      }
    }
    // ground skirt: the dust ring
    const rr = u * 4700;
    if (rr < 9000) {
      const col = lc('bone', 1.2 * Math.exp(-u * 0.8));
      for (let j = 0; j < 180; j++) {
        const a0 = (j / 180) * TAU, a1 = ((j + 1) / 180) * TAU;
        const h = 20 + 60 * hash(j, 3);
        this.l3.seg(Math.cos(a0) * rr, Math.sin(a0) * rr, h, Math.cos(a1) * rr, Math.sin(a1) * rr, h, 1.4, col[0], col[1], col[2], alpha);
      }
    }
  }

  /** Far away, more launches: orange trails climbing from the horizon (the score's 'farlaunch' booms). */
  launches(t: number) {
    const ls = onsets(this.ctx.audio, 'farlaunch', 55, 58).map((o) => o.t);
    ls.forEach((lt, i) => {
      if (t < lt) return;
      const age = t - lt;
      const side = i % 2 ? 1 : -1;
      const x0 = side * (2500 + hash(i, 1) * 6000), y0 = 4000 + hash(i, 2) * 9000;
      const P = (a: number) => [x0 + side * a * a * 900, y0 + a * 600, a * 2400 - a * a * 200] as const;
      const N = 30;
      for (let k = 0; k < N; k++) {
        const a0 = (age * k) / N, a1 = (age * (k + 1)) / N;
        const p = P(a0), q = P(a1);
        const r = (k + 1) / N;
        const col = heatc(0.6 + 0.4 * r, 1.5 + 3 * r);
        this.l3.seg(p[0], p[1], p[2], q[0], q[1], q[2], 1.6 + 1.2 * r, col[0], col[1], col[2], 1);
      }
      if (age < 0.4) {
        const I = 6 * (1 - age / 0.4);
        this.l3.seg(x0, y0, 5, x0 + 1, y0, 5, 30 * (1 - age / 0.4) + 6, LIN.signal[0] * I, LIN.signal[1] * I, LIN.signal[2] * I, 1);
      }
    });
  }

  /** Ash: slow falling specks, thicker as the cloud fades. */
  ash(t: number) {
    const a = prog(t, 56.5, 58.5);
    if (a <= 0) return;
    const cp = this.cam.cam.position;
    const n = 1400;
    for (let i = 0; i < n; i++) {
      const h = (k: number) => hash(i, k);
      // a box of ash around the camera's path
      const bx = lerp(-900, 900, h(1)) + STONE.x * prog(t, 57.6, 61.4), by = lerp(-3000, 600, h(2)) + STONE.y * 0.3 * prog(t, 57.6, 61.4);
      const fall = 40 + 60 * h(3);
      const z = ((h(4) * 1400 - (t - 56) * fall) % 1400 + 1400) % 1400;
      const x = bx + Math.sin(t * 0.7 + i) * 20, y = by + Math.cos(t * 0.5 + i * 1.3) * 20;
      const d = Math.hypot(x - cp.x, y - cp.y, z - cp.z);
      const s = clamp(600 / d, 0.5, 4);
      this.l3.seg(x, y, z, x, y, z - 2, s * 1.4, LIN.bone[0], LIN.bone[1], LIN.bone[2], a * 0.55);
    }
  }
}
