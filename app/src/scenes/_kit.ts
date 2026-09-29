// Shared kit for THE ARC: 3D camera helpers, text planes, typographic lockups, counters, scramble reveals.
import * as THREE from 'three';
import { W, H, SCALE, scaleContext2D } from '../engine/gl';
import { LIN, rgba, HEX } from '../engine/palette';
import { F, font } from '../engine/type';
import type { AudioData } from '../engine/audio';
import { clamp, ease, frameIdx, hash, lerp, prog } from '../engine/util';

export type V3 = [number, number, number];

/** Perspective camera with helpers for projecting 3D points to screen px (for Canvas2D labels). */
export class Cam {
  cam: THREE.PerspectiveCamera;
  private v = new THREE.Vector3();
  constructor(fov = 40, near = 0.1, far = 5000) {
    this.cam = new THREE.PerspectiveCamera(fov, W / H, near, far);
  }
  set(pos: V3, target: V3, roll = 0, fov?: number, up?: V3) {
    if (fov !== undefined) this.cam.fov = fov;
    this.cam.position.set(...pos);
    if (up) this.cam.up.set(...up);
    else this.cam.up.set(Math.sin(roll), Math.cos(roll), 0);
    this.cam.lookAt(...target);
    this.cam.updateProjectionMatrix();
    this.cam.updateMatrixWorld(true);
    return this;
  }
  /** Screen px (y down) and view depth; vis=false when behind the camera. */
  project(x: number, y: number, z: number) {
    this.v.set(x, y, z).project(this.cam);
    const d = this.v.z;
    return { x: (this.v.x * 0.5 + 0.5) * W, y: (0.5 - this.v.y * 0.5) * H, z: d, vis: d < 1 && d > -1 };
  }
  /** World units per screen px at distance of point p (for sizing labels). */
  pxPerUnit(x: number, y: number, z: number) {
    const dist = this.cam.position.distanceTo(this.v.set(x, y, z));
    const h = 2 * Math.tan((this.cam.fov * Math.PI) / 360) * dist;
    return H / h;
  }
}

/** A canvas drawn once (or per frame) and shown as a plane in 3D. Canvas in logical px, texture SCALEd. */
export class TextPlane {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  tex: THREE.CanvasTexture;
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  constructor(public w: number, public h: number, worldW: number, scale = SCALE) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.round(w * scale);
    this.canvas.height = Math.round(h * scale);
    this.ctx = scaleContext2D(this.canvas.getContext('2d')!, scale);
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 8;
    this.tex.generateMipmaps = true;
    this.tex.minFilter = THREE.LinearMipmapLinearFilter;
    this.mat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide, toneMapped: false });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(worldW, (worldW * h) / w), this.mat);
    this.mesh.frustumCulled = false;
  }
  clear() {
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.clearRect(0, 0, this.w, this.h);
  }
  update() { this.tex.needsUpdate = true; }
}

// ---------------------------------------------------------------- numbers & text effects

export const fmt = (n: number, dec = 0) => {
  const s = Math.abs(n).toFixed(dec);
  const [i, d] = s.split('.');
  const g = i!.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (n < 0 ? '−' : '') + g + (d ? '.' + d : '');
};

const SCR = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=/<>';
/**
 * Decode reveal: characters left of p*len are final; the next few show scrambled glyphs that change
 * each output frame (frameIdx) — constant across a frame's motion-blur shutter.
 */
export function scramble(text: string, p: number, t: number, seed = 1, spread = 6) {
  const chars = Array.from(text);
  const n = chars.length;
  const k = p * (n + spread);
  let out = '';
  for (let i = 0; i < n; i++) {
    const ch = chars[i]!;
    if (i < k - spread || ch === ' ') out += ch;
    else if (i < k) out += SCR[Math.floor(hash(frameIdx(t), i, seed) * SCR.length)];
    else out += ' ';
  }
  return out;
}

/** Odometer-like count: eased value between a and b over [t0, t1]. */
export function countTo(t: number, t0: number, t1: number, a: number, b: number, fn = ease.outExpo) {
  return lerp(a, b, prog(t, t0, t1, fn));
}

/** Times of onsets of a kind (optionally within [t0, t1)). */
export function onsets(au: AudioData, kind: string, t0 = -1e9, t1 = 1e9) {
  return (au.onsets[kind] ?? []).filter(([t]) => t >= t0 && t < t1).map(([t, s]) => ({ t, s }));
}

/** Decaying pulse of the most recent onset of `kind` at or before t. */
export function hitOf(au: AudioData, kind: string, t: number, hl = 0.1) {
  return au.hit(kind, t, hl);
}

/** Last onset time of a kind at or before t (or -1e9). */
export function lastOnset(au: AudioData, kind: string, t: number) {
  const l = au.onsets[kind] ?? [];
  let r = -1e9;
  for (const [ot] of l) { if (ot <= t) r = ot; else break; }
  return r;
}

export function countOnsets(au: AudioData, kind: string, t0: number, t: number) {
  let n = 0;
  for (const [ot] of au.onsets[kind] ?? []) if (ot >= t0 && ot <= t) n++;
  return n;
}

// ---------------------------------------------------------------- typographic lockups (Canvas2D)

export interface LockupOpts {
  x: number; y: number; // baseline-left of the big line
  big: string; bigSize?: number; bigFamily?: string; bigColor?: string;
  label?: string; // mono line above
  sub?: string; // mono line below
  p?: number; // reveal 0..1
  t: number;
  align?: 'left' | 'right' | 'center';
  tracking?: number;
  labelColor?: string;
  seed?: number;
  out?: number; // 0..1 exit
}

/**
 * The house lockup: small mono label, a heavy wide number/word, a mono sub-line.
 * Big glyphs slam in from below with a stagger; labels decode-scramble.
 */
export function lockup(c: CanvasRenderingContext2D, o: LockupOpts) {
  const p = o.p ?? 1, out = o.out ?? 0;
  if (p <= 0 || out >= 1) return;
  const size = o.bigSize ?? 180;
  const fam = o.bigFamily ?? F.archivo(125, 900);
  c.save();
  c.textBaseline = 'alphabetic';
  c.font = font(fam, size);
  const trk = o.tracking ?? -0.02 * size;
  const chars = Array.from(o.big);
  // width with tracking
  let wsum = 0;
  const adv: number[] = [];
  for (let i = 0; i < chars.length; i++) {
    const pre = c.measureText(chars.slice(0, i + 1).join('')).width;
    const w = c.measureText(chars[i]!).width;
    adv.push(pre - w + i * trk);
    wsum = pre + i * trk;
  }
  const al = o.align ?? 'left';
  const x0 = al === 'left' ? o.x : al === 'right' ? o.x - wsum : o.x - wsum / 2;
  // clip: glyphs rise from under a baseline mask
  const n = chars.length;
  for (let i = 0; i < n; i++) {
    const gi = al === 'right' ? n - 1 - i : i;
    const k = clamp(p * (1 + n * 0.06) - i * 0.06);
    const e = ease.outExpo(k);
    const ko = clamp(out * (1 + n * 0.04) - i * 0.04);
    const eo = ease.inExpo(ko);
    if (e <= 0 || eo >= 1) continue;
    c.save();
    c.beginPath();
    c.rect(x0 - 40, o.y - size * 1.05, wsum + 80, size * 1.05 + size * 0.28);
    c.clip();
    c.fillStyle = o.bigColor ?? rgba('bone', 1);
    c.fillText(chars[gi]!, x0 + adv[gi]!, o.y + (1 - e) * size * 1.1 - eo * size * 1.1);
    c.restore();
  }
  const pl = clamp((p - 0.1) * 1.6) * (1 - clamp(out * 2));
  if (o.label && pl > 0) {
    c.font = font(F.mono(500), Math.max(15, size * 0.12));
    c.fillStyle = o.labelColor ?? rgba('signal', 1);
    c.letterSpacing = `${Math.max(2, size * 0.02)}px`;
    const lx = al === 'left' ? x0 + 4 : al === 'right' ? o.x : o.x;
    c.textAlign = al;
    c.fillText(scramble(o.label, pl, o.t, o.seed ?? 3), lx, o.y - size * 0.86);
  }
  if (o.sub && pl > 0) {
    c.font = font(F.mono(400), Math.max(14, size * 0.1));
    c.fillStyle = rgba('ash', 1);
    c.letterSpacing = `${Math.max(1.5, size * 0.012)}px`;
    const lx = al === 'left' ? x0 + 4 : o.x;
    c.textAlign = al;
    c.fillText(scramble(o.sub, clamp((p - 0.25) * 1.5) * (1 - clamp(out * 2)), o.t, (o.seed ?? 3) + 5), lx, o.y + size * 0.3);
  }
  c.letterSpacing = '0px';
  c.restore();
}

/** Mono text with decode reveal. */
export function mono(c: CanvasRenderingContext2D, text: string, x: number, y: number, o: { size?: number; weight?: number; color?: string; p?: number; t: number; align?: CanvasTextAlign; tracking?: number; seed?: number }) {
  const p = o.p ?? 1;
  if (p <= 0) return;
  c.save();
  c.font = font(F.mono(o.weight ?? 500), o.size ?? 16);
  c.fillStyle = o.color ?? rgba('bone', 0.9);
  c.textAlign = o.align ?? 'left';
  c.textBaseline = 'alphabetic';
  c.letterSpacing = `${o.tracking ?? 2}px`;
  c.fillText(p >= 1 ? text : scramble(text, p, o.t, o.seed ?? 1), x, y);
  c.restore();
}

/** Orange tag with ink text (the "TODAY" chip). */
export function tag(c: CanvasRenderingContext2D, text: string, x: number, y: number, o: { size?: number; p?: number; t: number; bg?: string; fg?: string; align?: 'left' | 'right' | 'center' }) {
  const p = o.p ?? 1;
  if (p <= 0) return;
  const s = o.size ?? 18;
  c.save();
  c.font = font(F.mono(600), s);
  c.letterSpacing = `${s * 0.08}px`;
  const w = c.measureText(text).width + s * 1.1;
  const h = s * 1.7;
  const al = o.align ?? 'left';
  const x0 = al === 'left' ? x : al === 'right' ? x - w : x - w / 2;
  const ww = w * ease.outExpo(clamp(p * 1.4));
  c.fillStyle = o.bg ?? rgba('signal', 1);
  c.fillRect(x0, y - h * 0.72, ww, h);
  c.beginPath(); c.rect(x0, y - h, ww, h * 2); c.clip();
  c.fillStyle = o.fg ?? HEX.ink;
  c.fillText(scramble(text, clamp(p * 1.3 - 0.2), o.t, 9), x0 + s * 0.55, y + s * 0.18);
  c.restore();
}

/** Thin corner brackets around a box. */
export function brackets(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, len = 14, color = rgba('bone', 0.7), lw = 1.5) {
  c.save();
  c.strokeStyle = color; c.lineWidth = lw;
  c.beginPath();
  c.moveTo(x, y + len); c.lineTo(x, y); c.lineTo(x + len, y);
  c.moveTo(x + w - len, y); c.lineTo(x + w, y); c.lineTo(x + w, y + len);
  c.moveTo(x + w, y + h - len); c.lineTo(x + w, y + h); c.lineTo(x + w - len, y + h);
  c.moveTo(x + len, y + h); c.lineTo(x, y + h); c.lineTo(x, y + h - len);
  c.stroke();
  c.restore();
}

/** Linear colour scaled (for LineBatch). */
export const lc = (k: keyof typeof LIN, s = 1): [number, number, number] => [LIN[k][0] * s, LIN[k][1] * s, LIN[k][2] * s];
export const mixc = (a: [number, number, number], b: [number, number, number], k: number): [number, number, number] => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
/** Heat ramp in linear rgb (0 ink … 0.5 signal … 1 white-hot) × intensity. */
export function heatc(x: number, s = 1): [number, number, number] {
  x = clamp(x);
  const stops: [number, [number, number, number]][] = [
    [0, LIN.ink], [0.3, LIN.blood], [0.55, LIN.signal], [0.8, LIN.ember], [1, [1, 0.9, 0.78]],
  ];
  for (let i = 1; i < stops.length; i++) {
    if (x <= stops[i]![0]) {
      const [a0, c0] = stops[i - 1]!, [a1, c1] = stops[i]!;
      const k = (x - a0) / (a1 - a0);
      return [lerp(c0[0], c1[0], k) * s, lerp(c0[1], c1[1], k) * s, lerp(c0[2], c1[2], k) * s];
    }
  }
  return [s, s * 0.9, s * 0.78];
}

/** The through-line readout: Δt to the next leap. Drawn as a compact instrument. */
export function ledger(c: CanvasRenderingContext2D, x: number, y: number, o: { years: string; next: string; p: number; t: number; scale?: number; align?: 'left' | 'right' }) {
  if (o.p <= 0) return;
  const k = o.scale ?? 1;
  const al = o.align ?? 'left';
  c.save();
  c.globalAlpha *= clamp(o.p * 3);
  const w = 360 * k;
  const x0 = al === 'left' ? x : x - w;
  c.strokeStyle = rgba('bone', 0.5); c.lineWidth = 1;
  const lw = w * ease.outExpo(clamp(o.p * 1.5));
  c.beginPath(); c.moveTo(x0, y); c.lineTo(x0 + lw, y); c.stroke();
  // ticks
  for (let i = 0; i <= 12; i++) {
    const tx = x0 + (w * i) / 12;
    if (tx > x0 + lw) break;
    c.beginPath(); c.moveTo(tx, y); c.lineTo(tx, y - (i % 6 === 0 ? 10 : 5) * k); c.stroke();
  }
  mono(c, 'Δt  NEXT LEAP →', x0, y - 18 * k, { size: 13 * k, color: rgba('ash', 1), p: clamp(o.p * 2), t: o.t, tracking: 2.5 * k });
  c.font = font(F.archivo(112, 700), 40 * k);
  c.fillStyle = rgba('bone', 1);
  c.textBaseline = 'alphabetic';
  c.fillText(scramble(o.years, clamp(o.p * 1.6 - 0.2), o.t, 4), x0, y + 46 * k);
  mono(c, o.next, x0, y + 72 * k, { size: 13 * k, color: rgba('signal', 1), p: clamp(o.p * 1.5 - 0.4), t: o.t, tracking: 2 * k });
  c.restore();
}

/** Deterministic PRNG sequence helper. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export { W, H };
