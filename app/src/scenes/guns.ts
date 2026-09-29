// 05 GUNS (26–32 s). Rate of fire becomes the rhythm: every shot in the score is a bar on a scrolling
// tape (musket 3/min → Gatling 200 → Maxim 600 → minigun 6,000 = the last 0.75 s at 100 rounds/s).
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { FSPass, Layer2D, W, H } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { LIN, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import { clamp, ease, frameIdx, hash, lerp, prog, pulse, TAU } from '../engine/util';
import { Cam, lockup, ledger, mono, onsets, lc, fmt, heatc, tag, scramble } from './_kit';

const STAGES = [
  { t: 26.0, year: '1700s', name: 'FLINTLOCK MUSKET', rate: 3 },
  { t: 28.0, year: '1862', name: 'GATLING GUN', rate: 200 },
  { t: 29.0, year: '1884', name: 'MAXIM GUN', rate: 600 },
  { t: 30.0, year: '1963', name: 'M134 MINIGUN', rate: 6000 },
];
const SPEED = 7.5; // world units per second along the tape
const PLAY = 2.5; // playhead x

export default class GunsScene extends Scene {
  bg = new FSPass(/* glsl */ `
    uniform float wall, dark;
    void main() {
      float v = smoothstep(1.3, 0.1, length((vUv - vec2(0.55, 0.5)) * vec2(1.5, 1.0)));
      vec3 c = C_INK * (0.5 + 0.6 * v);
      c = mix(c, C_BONE * 0.9, wall);
      c *= 1.0 - dark;
      fragColor = vec4(c, 1.0);
    }`, { wall: { value: 0 }, dark: { value: 0 } });
  l3 = new LineBatch(30000, { screen2D: false });
  text = new Layer2D();
  cam = new Cam(36, 0.1, 500);
  shots: number[] = [];

  async init() {
    const au = this.ctx.audio;
    this.shots = onsets(au, 'shot', 25.9, 31.0).map((o) => o.t);
    for (let x = 31.0; x < 31.75 - 1e-6; x += 0.01) this.shots.push(x);
    this.shots.sort((a, b) => a - b);
  }

  stage(t: number) {
    let s = 0;
    for (let i = 0; i < STAGES.length; i++) if (t >= STAGES[i]!.t) s = i;
    return s;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, audio } = this.ctx;
    const t = f.t;
    const buzz = prog(t, 31.0, 31.7, ease.inQuad);
    const cut = t >= 31.75 ? 1 : 0;
    this.bg.u.wall!.value = buzz * 0.0;
    this.bg.u.dark!.value = cut;
    this.bg.render(renderer, out);
    this.l3.clear(); this.text.clear();
    const c = this.text.ctx;
    const si = this.stage(t);
    // camera: oblique on the tape, pushing in; shakes with every shot
    const sh = audio.hit('shot', t, 0.04) + buzz * 0.6;
    const jx = (hash(frameIdx(t), 1) - 0.5) * sh * 0.06, jy = (hash(frameIdx(t), 2) - 0.5) * sh * 0.06;
    const u = (t - 26) / 6;
    const yaw = lerp(0.62, 0.35, ease.inOutCubic(u));
    const d = lerp(6.6, 4.6, ease.inOutCubic(u));
    this.cam.set([PLAY + Math.sin(yaw) * d + jx, 2.2 + jy + u * 0.6, Math.cos(yaw) * d], [PLAY - 2.6, 1.25, 0], 0, 36);
    // tape baseline + second ticks
    const bc = lc('bone', 0.6);
    this.l3.seg(-30, 0, 0, PLAY + 40, 0, 0, 1.2, bc[0], bc[1], bc[2], 1);
    for (let k = Math.floor((t - 5) * 10); k <= Math.ceil(t * 10); k++) {
      const x = PLAY + (k / 10 - t) * SPEED;
      const big = k % 10 === 0;
      this.l3.seg(x, 0, 0, x, -(big ? 0.35 : 0.14), 0, 1, bc[0], bc[1], bc[2], big ? 0.9 : 0.5);
      if (big) {
        const p = this.cam.project(x, -0.6, 0);
        if (!cut && p.vis && p.x > -50 && p.x < W + 50) mono(c, `${(k / 10 - 26).toFixed(0)} S`, p.x, p.y, { size: 13, color: rgba('ash', 0.9), t, align: 'center' });
      }
    }
    // playhead
    const pc = lc('signal', 2.2);
    this.l3.seg(PLAY, -0.5, 0, PLAY, 3.2, 0, 1.5, pc[0], pc[1], pc[2], 1);
    const ph = this.cam.project(PLAY, 3.35, 0);
    if (!cut) mono(c, 'NOW', ph.x, ph.y, { size: 13, color: rgba('signal', 1), t, align: 'center' });
    // shots: bars on the tape, tracers into the distance
    let fired = 0;
    for (const s of this.shots) {
      if (s > t) break;
      fired++;
      const age = t - s;
      const x = PLAY - age * SPEED;
      if (x < -30) continue;
      const hot = Math.exp(-age / 0.12);
      const h = 2.4 * (0.75 + 0.25 * hash(s * 100, 3)) * (1 + 0.25 * hot) * (1 + buzz * 0.8);
      const col = hot > 0.02 ? [LIN.bone[0] + LIN.signal[0] * 3 * hot, LIN.bone[1] + LIN.signal[1] * 3 * hot, LIN.bone[2] + LIN.signal[2] * 3 * hot] : [LIN.bone[0], LIN.bone[1], LIN.bone[2]];
      this.l3.seg(x, 0, 0, x, h, 0, s >= 31 ? 1.6 : 2.4, col[0]! * 1.1, col[1]! * 1.1, col[2]! * 1.1, 1);
      // echo bars behind the tape (a faint mirror receding in z)
      this.l3.seg(x, 0, -0.6, x, h * 0.6, -0.6, 1, LIN.bone[0] * 0.4, LIN.bone[1] * 0.4, LIN.bone[2] * 0.4, 0.5);
      // tracer: flies out along +x, above the tape
      if (age < 0.5) {
        const tx = PLAY + age * 90, ty = 1.4 + (hash(s * 10, 5) - 0.5) * 0.5 + age * 1.5, tz = (hash(s * 10, 6) - 0.5) * 1.2 - age * 6;
        const tc = heatc(0.8, 3.5 * (1 - age * 2));
        this.l3.seg(tx - 4, ty, tz, tx, ty, tz, 1.6, tc[0], tc[1], tc[2], 1 - age * 2);
      }
    }
    // muzzle flash at the playhead
    const mf = audio.hit('shot', t, 0.03) + buzz * 0.7;
    if (mf > 0.05) {
      for (let j = 0; j < 14; j++) {
        const a = hash(j, frameIdx(t)) * TAU;
        const r = (0.25 + hash(j, frameIdx(t), 2) * 0.6) * mf;
        const mc = heatc(0.85, 4 * mf);
        this.l3.seg(PLAY, 1.4, 0, PLAY + Math.cos(a) * r * 1.6, 1.4 + Math.sin(a) * r, 0, 2.2, mc[0], mc[1], mc[2], 1);
      }
    }
    if (!cut) this.l3.render(renderer, out, this.cam.cam);
    // ---- type
    const st = STAGES[si]!;
    const sp = prog(t, st.t, st.t + 0.45);
    if (!cut) {
      lockup(c, { x: 120, y: 300, big: `${fmt(st.rate)}`, bigSize: 190, t, label: `ROUNDS / MINUTE · ${st.name}`, sub: `${st.year}`, p: sp, seed: 80 + si });
      // rate chart (log): bars for each stage reached
      const bx = W - 520, by = 880, bw = 90;
      mono(c, 'RATE OF FIRE · LOG', bx, by - 330, { size: 13, color: rgba('ash', 1), t, p: prog(t, 26.2, 26.6) });
      STAGES.forEach((s2, i) => {
        const a = prog(t, s2.t, s2.t + 0.35, ease.outExpo);
        if (a <= 0) return;
        const hgt = (Math.log10(s2.rate) / Math.log10(6000)) * 280 * a + 4;
        const x = bx + i * (bw + 16);
        c.fillStyle = i === si ? rgba('signal', 1) : rgba('bone', 0.85);
        c.fillRect(x, by - hgt, bw, hgt);
        mono(c, fmt(s2.rate), x, by - hgt - 10, { size: 13, weight: 600, color: rgba(i === si ? 'signal' : 'bone', 1), t, p: a });
        mono(c, s2.year, x, by + 22, { size: 12, color: rgba('ash', 1), t, p: a });
      });
      mono(c, '05', 72, 84, { size: 15, color: rgba('signal', 1), t });
      mono(c, 'GUNS', 110, 84, { size: 15, color: rgba('bone', 0.85), t });
      mono(c, `ROUNDS FIRED ${String(fired).padStart(4, '0')}`, W - 72, 84, { size: 14, color: rgba('ash', 1), t, align: 'right' });
      ledger(c, 120, 900, { years: '32 YRS', next: 'MAXIM → THE TANK', p: prog(t, 29.2, 29.8) * (1 - prog(t, 30.9, 31.1)), t });
      if (t >= 31.0) {
        const k = prog(t, 31.0, 31.2);
        tag(c, '100 ROUNDS / SECOND', 120, 440, { size: 20, t, p: k });
      }
    } else {
      // black: only the number remains, then gone
      c.font = font(F.archivo(125, 900), 190);
      c.fillStyle = rgba('bone', 1 - prog(t, 31.85, 31.98));
      c.fillText('6,000', 120, 300);
    }
    comp.draw(renderer, this.text.upload(), out);
    const ms = pulse(t, 26.0, 0.06) + pulse(t, 27.0, 0.06);
    return { bloom: 0.9, grain: 0.06, vignette: 0.45, zoom: 1 + ms * 0.04 + buzz * 0.08, shake: [(hash(frameIdx(t), 7) - 0.5) * (sh * 6 + buzz * 10), (hash(frameIdx(t), 8) - 0.5) * (sh * 6 + buzz * 10)], flash: pulse(t, 26.0, 0.015) * 0.12, ca: 1.2 + buzz * 6 };
  }
}
