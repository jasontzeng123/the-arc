// 06 WORLD WARS (32–40 s). The ledger: a plane of cells, 1 cell = 1,000 lives. WWI fills outward
// from a jagged front line on the kicks (≈17,000 cells); the camera pulls back to WWII's block
// (75,000 cells) filling from several fronts. 37.75: silence. 38.0: Hiroshima — one bomb.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { FSPass, Layer2D, W, H } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { LIN, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import { clamp, ease, frameIdx, hash, lerp, prog, pulse, TAU } from '../engine/util';
import { Cam, lockup, ledger, mono, onsets, fmt, tag, scramble } from './_kit';

const R1 = { x0: 0, y0: 0, w: 170, h: 100 }; // WWI: 17,000 cells
const R2 = { x0: 0, y0: -212, w: 375, h: 200 }; // WWII: 75,000 cells
const HIRO = { x: 262, y: -96 };
const HT = 38.0; // Hiroshima
const MAP_SCALE = 0.22; // cells per km (prefecture scale)
const PREF = [28, 34]; // km: Hiroshima prefecture's centre relative to the hypocenter (E, N)
const MAP_OFF = [0, 0]; // km offset so the city sits under the burst
const W2 = 36.0; // WWII

export default class WarsScene extends Scene {
  plane = new FSPass(/* glsl */ `
    uniform vec3 camPos; uniform mat3 camRot; uniform float tanHalf, aspect;
    uniform float lvl1, lvl2, hiroT, dim, t;
    uniform vec2 hiro;
    const vec4 R1 = vec4(${R1.x0}.0, ${R1.y0}.0, ${R1.w}.0, ${R1.h}.0);
    const vec4 R2 = vec4(${R2.x0}.0, ${R2.y0}.0, ${R2.w}.0, ${R2.h}.0);
    bool inR(vec2 c, vec4 r) { return c.x >= r.x && c.y >= r.y && c.x < r.x + r.z && c.y < r.y + r.w; }
    float front1(float y) { return 85.0 + 14.0 * sin(y * 0.11) + 6.0 * sin(y * 0.37 + 1.0) + 3.0 * snoise(vec2(y * 0.2, 3.0)); }
    float rank1(vec2 c) { return clamp(abs(c.x - front1(c.y)) / 92.0 * 0.82 + hash12(c) * 0.18, 0.0, 1.0); }
    float rank2(vec2 c) {
      vec2 q = c - R2.xy;
      float d = min(min(length((q - vec2(110.0, 120.0)) * vec2(1.0, 1.3)), length((q - vec2(250.0, 60.0)) * vec2(1.2, 1.0))), length((q - vec2(330.0, 150.0)) * vec2(1.0, 0.9)));
      d += 18.0 * snoise(q * 0.03);
      return clamp(d / 210.0 * 0.85 + hash12(c + 7.0) * 0.15, 0.0, 1.0);
    }
    void main() {
      vec2 ndc = vUv * 2.0 - 1.0;
      vec3 dir = normalize(camRot * vec3(ndc.x * tanHalf * aspect, ndc.y * tanHalf, -1.0));
      vec3 col = C_INK * 0.7;
      if (dir.z < -1e-4) {
        float tt = -camPos.z / dir.z;
        vec2 p = camPos.xy + dir.xy * tt;
        vec2 cell = floor(p);
        vec2 f = fract(p) - 0.5;
        vec2 fw = fwidth(p);
        float px = max(fw.x, fw.y);
        float box = max(abs(f.x), abs(f.y)) - 0.36;
        float fill = 1.0 - smoothstep(-px * 0.5, px * 0.5, box);
        fill = mix(fill, 0.52, smoothstep(0.35, 0.9, px));
        float edge = (1.0 - smoothstep(0.0, px * 1.2, abs(box))) ;
        edge = mix(edge, 0.12, smoothstep(0.35, 0.9, px));
        float fog = exp(-tt * 0.0018);
        bool a = inR(cell, R1), b = inR(cell, R2);
        vec3 c = vec3(0.0);
        if (a || b) {
          float rk = a ? rank1(cell) : rank2(cell);
          float lv = a ? lvl1 : lvl2;
          float since = lv - rk; // >0 = lit
          c += C_GRAPHITE * edge * 0.3;
          if (since > 0.0) {
            float hot = exp(-since * 14.0);
            vec3 lit = mix(C_BONE * 0.26, C_SIGNAL * 2.4, hot);
            lit = mix(lit, vec3(3.0, 2.6, 2.2), exp(-since * 90.0));
            c = mix(c, lit, fill);
          }
        }
        // Hiroshima: one burst, all at once
        float hd = length(cell + 0.5 - hiro);
        if (hiroT > 0.0) {
          float R = 6.7 * (1.0 - exp(-hiroT * 60.0));
          if (hd < R) {
            float k = exp(-hiroT * 1.6);
            vec3 hc = mix(C_SIGNAL * 2.5, vec3(9.0, 8.0, 7.0), k);
            c = mix(c, hc, fill);
          }
          // shock ring across the field
          float ring = hiroT * 140.0;
          float rr = exp(-pow((hd - ring) / 3.5, 2.0)) * exp(-hiroT * 1.2);
          c += C_BONE * rr * fill * 1.4 * (a || b ? 1.0 : 0.25);
        } else {
          // the target: one dark cell outlined in orange, pulsing, while all else dims
          float tgt = (1.0 - smoothstep(0.5, 0.7, hd)) * dim;
          c = mix(c, C_SIGNAL * (1.5 + 1.5 * sin(t * 40.0)) * edge, tgt);
        }
        c *= 1.0 - dim * 0.75 * (1.0 - step(hd, (hiroT > 0.0 ? 7.0 : 0.8)));
        col += c * fog;
      }
      fragColor = vec4(col, 1.0);
    }`, {
    camPos: { value: new THREE.Vector3() }, camRot: { value: new THREE.Matrix3() }, tanHalf: { value: 0.3 }, aspect: { value: W / H },
    lvl1: { value: 0 }, lvl2: { value: 0 }, hiroT: { value: -1 }, dim: { value: 0 }, t: { value: 0 }, hiro: { value: new THREE.Vector2(HIRO.x, HIRO.y) },
  });
  text = new Layer2D();
  cam = new Cam(38, 0.1, 5000);
  kicks: number[] = [];
  lb = new LineBatch(60000, { screen2D: false });
  hiro: { c: number; p: number[] }[] = [];
  snares: number[] = [];

  async init() {
    this.hiro = (await (await fetch('data/hiroshima.json')).json()).rings;
    this.kicks = onsets(this.ctx.audio, 'kick', 31.9, 37.8).map((o) => o.t);
    this.snares = onsets(this.ctx.audio, 'snare', 31.9, 37.8).map((o) => o.t);
  }

  /** Fill level stepping on the kicks between a and b. */
  stepLevel(t: number, a: number, b: number) {
    const ks = this.kicks.filter((k) => k >= a && k < b);
    if (!ks.length) return prog(t, a, b);
    let n = 0;
    for (const k of ks) n += ease.outExpo(clamp((t - k) / 0.18));
    return clamp(n / ks.length);
  }

  camFor(t: number) {
    // shot A (WWI close), B (pull back to both blocks), C (Hiroshima dive)
    const A = { pos: [60, 150, 95], tgt: [95, 50, 0] };
    const B = { pos: [150, 170, 330], tgt: [190, -70, 0] };
    const pcx = HIRO.x - PREF[0]! * MAP_SCALE, pcy = HIRO.y - PREF[1]! * MAP_SCALE;
    const C = { pos: [pcx - 20, pcy + 45, 38], tgt: [pcx + 2, pcy + 2, 0] };
    const u = t - 32;
    let pos: number[], tgt: number[];
    const drift = [Math.sin(t * 0.3) * 4, u * 3, 0];
    // 34.0: a snap back — WWI a little wider, the WWII block just visible beyond it
    const A2 = { pos: [78, 178, 150], tgt: [118, 10, 0] };
    const snap = ease.outExpo(prog(t, 34.0, 34.22));
    const aPos = A.pos.map((v, i) => lerp(v + drift[i]! - (i === 2 ? u * 4 : 0), A2.pos[i]! + drift[i]! * 0.5, snap));
    const aTgt = A.tgt.map((v, i) => lerp(v + drift[i]! * 0.5, A2.tgt[i]! + drift[i]! * 0.3, snap));
    if (t < W2) {
      pos = aPos;
      tgt = aTgt;
    } else {
      // 36.0: the same kind of snap as 34.0 — on the downbeat, out to both blocks
      const k = ease.outExpo(prog(t, W2, W2 + 0.22));
      const ub = Math.max(0, t - W2);
      B.pos = [B.pos[0]! + ub * 3, B.pos[1]! + ub * 6, B.pos[2]! - ub * 10];
      const k2 = ease.inOutExpo(prog(t, 37.75, HT + 0.02));
      const k3 = ease.outCubic(prog(t, HT, 40));
      pos = aPos.map((v, i) => lerp(lerp(v, B.pos[i]!, k), C.pos[i]!, k2));
      tgt = aTgt.map((v, i) => lerp(lerp(v, B.tgt[i]!, k), C.tgt[i]!, k2));
      pos[2] = pos[2]! * (1 - 0.35 * k3);
      pos[0] = pos[0]! + k3 * 8;
    }
    return { pos: pos as [number, number, number], tgt: tgt as [number, number, number] };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, audio } = this.ctx;
    const t = f.t;
    const cp = this.camFor(t);
    const kick = audio.hit('kick', t, 0.06);
    this.cam.set([cp.pos[0], cp.pos[1], cp.pos[2]], [cp.tgt[0], cp.tgt[1], cp.tgt[2]], 0, 38, [0, 0, 1]);
    // plane: z up (camera above z = 0)
    const c3 = this.cam.cam;
    const u = this.plane.u;
    (u.camPos!.value as THREE.Vector3).copy(c3.position);
    (u.camRot!.value as THREE.Matrix3).setFromMatrix4(c3.matrixWorld);
    u.tanHalf!.value = Math.tan((c3.fov * Math.PI) / 360);
    const lvl1 = this.stepLevel(t, 32.0, W2) * 1.0;
    const lvl2 = this.stepLevel(t, 34.0, 37.75);
    u.lvl1!.value = lvl1;
    u.lvl2!.value = lvl2 * 1.02;
    u.hiroT!.value = t >= HT ? t - HT : -1;
    u.dim!.value = prog(t, 37.72, 37.8);
    u.t!.value = t;
    this.plane.render(renderer, out);
    // Hiroshima: the city's wards and the towns around it, in white lines on the ledger (north up on screen)
    const ma = prog(t, 37.8, 38.05);
    if (ma > 0) {
      this.lb.clear();
      const S = MAP_SCALE;
      for (const r of this.hiro) {
        const I = r.c ? 1.9 : 0.9, al = ma * (r.c ? 1 : 0.8);
        const p = r.p;
        for (let i = 2; i < p.length; i += 2) {
          const ax = HIRO.x - (p[i - 2]! + MAP_OFF[0]) * S, ay = HIRO.y - (p[i - 1]! + MAP_OFF[1]) * S;
          const bx = HIRO.x - (p[i]! + MAP_OFF[0]) * S, by = HIRO.y - (p[i + 1]! + MAP_OFF[1]) * S;
          this.lb.seg(ax, ay, 0.05, bx, by, 0.05, r.c ? 2.0 : 1.2, LIN.bone[0] * I, LIN.bone[1] * I, LIN.bone[2] * I, al);
        }
      }
      this.lb.render(renderer, out, c3);
    }
    this.text.clear();
    const c = this.text.ctx;
    const quiet = t >= 37.75;
    // ---- WWI
    const dead1 = Math.round(17000 * clamp(lvl1)) * 1000;
    const dead2 = Math.round(75000 * clamp(lvl2)) * 1000;
    if (!quiet) {
      lockup(c, { x: 120, y: 300, big: '1914–1918', bigSize: 150, t, label: 'WORLD WAR I', sub: 'EST. 15–22 MILLION DEAD', p: prog(t, 32.0, 32.7), out: prog(t, W2 - 0.2, W2), seed: 91 });
      lockup(c, { x: 120, y: 300, big: '1939–1945', bigSize: 150, t, label: 'WORLD WAR II', sub: 'EST. 70–85 MILLION DEAD · ≈34,000 A DAY FOR 6 YEARS', p: prog(t, W2, W2 + 0.7), seed: 92 });
      // counter
      mono(c, t < W2 ? 'DEAD · WWI' : 'DEAD · WWII', 120, 930, { size: 14, color: rgba('ash', 1), t });
      c.font = font(F.archivo(125, 900), 84);
      c.fillStyle = rgba('bone', 1);
      c.fillText(fmt(t < W2 ? dead1 : dead2), 120, 1010);
    }
    // legend
    mono(c, '■ = 1,000 LIVES', W - 72, 150, { size: 16, weight: 600, color: rgba('bone', 1), t, align: 'right', p: prog(t, 32.1, 32.6) });
    mono(c, '06', 72, 84, { size: 15, color: rgba('signal', 1), t });
    mono(c, 'WORLD WARS', 110, 84, { size: 15, color: rgba('bone', 0.85), t });
    // weapon chips on the snares
    const chips = ['1914 · MACHINE GUNS', '1915 · CHLORINE GAS', '1916 · TANKS', '1916 · ARTILLERY', '1939 · BLITZKRIEG', '1944 · V-2 ROCKET'];
    if (!quiet) this.snares.forEach((s, i) => {
      const ww1 = s < W2;
      const endT = Math.min(s + 1.3, ww1 ? W2 - 0.05 : 37.72);
      if (t < s || t > endT || i >= chips.length) return;
      const wy = [16, 90, 8, 94][i % 4]!;
      const pos = ww1 ? [front(wy) - 20, wy] : [120 + (i % 2) * 140, -120 - (i % 2) * 50];
      const p = this.cam.project(pos[0]!, pos[1]!, 0);
      const cx = 1480, cy = 800 + (i % 3) * 58;
      const a = prog(t, s, s + 0.2) * (1 - prog(t, endT - 0.25, endT));
      c.strokeStyle = rgba('signal', 0.9 * a); c.lineWidth = 1.2;
      c.beginPath(); c.arc(p.x, p.y, 7, 0, TAU); c.moveTo(p.x + 7, p.y); c.lineTo(cx - 8, cy - 6); c.stroke();
      tag(c, chips[i]!, cx, cy, { size: 16, t, p: a });
    });
    // Somme callout on the bomb at 34.0
    const sm = prog(t, 34.0, 34.25) * (1 - prog(t, 35.6, 35.9));
    if (sm > 0 && !quiet) {
      const p = this.cam.project(front(60) + 2, 60, 0);
      c.strokeStyle = rgba('signal', sm); c.lineWidth = 1.5;
      c.beginPath(); c.arc(p.x, p.y, 16 + 30 * (1 - sm), 0, TAU); c.stroke();
      c.beginPath(); c.moveTo(p.x + 16, p.y - 10); c.lineTo(p.x + 120, p.y - 110); c.lineTo(p.x + 180, p.y - 110); c.stroke();
      mono(c, '01.07.1916 · THE SOMME', p.x + 190, p.y - 128, { size: 15, color: rgba('signal', sm), t, p: sm });
      c.font = font(F.archivo(125, 900), 44); c.fillStyle = rgba('bone', sm);
      c.fillText('19,240', p.x + 190, p.y - 80);
      mono(c, 'BRITISH SOLDIERS KILLED IN ONE DAY', p.x + 190, p.y - 56, { size: 13, color: rgba('ash', sm), t, p: sm });
    }
    // block labels in the wide view
    const wl = prog(t, W2 + 0.6, W2 + 1.0) * (1 - prog(t, 37.7, 37.8));
    if (wl > 0) {
      const a = this.cam.project(R1.x0, R1.y0 + R1.h + 6, 0), b = this.cam.project(R2.x0 + R2.w, R2.y0 + R2.h + 6, 0);
      mono(c, 'WWI · 17,000 ■', a.x, a.y, { size: 14, weight: 600, color: rgba('bone', wl), t, p: wl });
      mono(c, 'WWII · 75,000 ■', b.x, b.y, { size: 14, weight: 600, color: rgba('bone', wl), t, p: wl, align: 'right' });
    }
    // ---- Hiroshima
    if (t >= 37.75) {
      const hp = prog(t, HT, HT + 0.6);
      lockup(c, { x: 120, y: 330, big: '1 BOMB', bigSize: 190, t, label: 'HIROSHIMA · 06.08.1945 · 08:15', sub: '15 KILOTONS · 90,000–166,000 DEAD BY THE END OF 1945', p: hp, seed: 93 });
      mono(c, 'ONE BOMB · LESS THAN A SECOND', 120, 440, { size: 16, weight: 600, color: rgba('signal', 1), t, p: prog(t, HT + 0.5, HT + 0.9) });
      ledger(c, 120, 900, { years: '12 YRS', next: 'UNTIL THE ICBM (1957)', p: prog(t, HT + 0.9, HT + 1.4), t });
    }
    comp.draw(renderer, this.text.upload(), out);
    const hh = t >= HT ? pulse(t, HT, 0.08) : 0;
    const bomb = pulse(t, 34.0, 0.08) + pulse(t, W2, 0.08);
    return {
      bloom: 0.9, grain: 0.07, vignette: 0.5,
      zoom: 1 + kick * 0.01 + bomb * 0.03 + hh * 0.08,
      shake: [(hash(frameIdx(t), 1) - 0.5) * (bomb * 12 + hh * 30), (hash(frameIdx(t), 2) - 0.5) * (bomb * 12 + hh * 30)],
      flash: t >= HT ? pulse(t, HT, 0.025) * 1.0 : 0,
      ca: 1.2 + hh * 8,
    };
  }
}

function front(y: number) { return 85 + 14 * Math.sin(y * 0.11) + 6 * Math.sin(y * 0.37 + 1.0); }
