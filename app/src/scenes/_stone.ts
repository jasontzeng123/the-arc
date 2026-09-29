// The stone: a hand-axe knapped from a cobble, drawn as contour rings (topographic slices along its
// long axis). Shared by the opening (knapping) and the ending (the stone in the ash).
import * as THREE from 'three';
import { LineBatch } from '../engine/lines';
import { clamp, ease, hash, lerp, noise2, TAU } from '../engine/util';
import { LIN } from '../engine/palette';

export interface Scar { u: number; th: number; depth: number; su: number; sth: number; t: number }

export class Stone {
  rings = 72;
  seg = 144;
  scars: Scar[] = [];
  private tmp = new THREE.Vector3();
  constructor(public knapTimes: number[], seed = 5) {
    // flake scars alternate faces and walk around the edge; later scars are smaller/finer
    this.scars = knapTimes.map((t, i) => {
      const side = i % 2 === 0 ? 1 : -1;
      const u = -0.7 + 1.35 * hash(i, seed) ;
      const along = hash(i, seed + 1) > 0.5 ? 0 : Math.PI; // left or right edge
      const th = along + side * (0.35 + 0.35 * hash(i, seed + 2));
      return { u, th, depth: 0.16 - 0.008 * i, su: 0.22 + 0.1 * hash(i, seed + 3), sth: 0.55, t };
    });
  }

  /** Knapping progress 0..1 at time t (steps at each knap with a fast ease). */
  progress(t: number) {
    let k = 0;
    const n = this.knapTimes.length;
    for (const kt of this.knapTimes) k += ease.outExpo(clamp((t - kt) / 0.09));
    return n ? k / n : 1;
  }

  /** Surface point for ring parameter u∈[-1,1] (long axis) and angle θ, knapping progress k, time t. */
  point(u: number, th: number, k: number, t: number, out: THREE.Vector3) {
    // outline: cobble (rounded, fat) → biface (pointed tip up, widest low)
    const cob = 0.78 * Math.pow(Math.max(0, 1 - u * u), 0.5) * (1 - 0.08 * u);
    const bif = 0.58 * Math.pow(Math.max(0, 1 + u), 0.5) * Math.pow(Math.max(0, 1 - u), 0.85);
    const w = lerp(cob, bif, ease.inOutCubic(k));
    const thick = w * lerp(0.62, 0.3, k);
    const c = Math.cos(th), s = Math.sin(th);
    // lens cross-section: sharper edge as k grows
    const q = lerp(0.5, 0.85, k);
    let x = w * c;
    let z = thick * Math.sign(s) * Math.pow(Math.abs(s), 2 * q);
    // rough cortex noise fades as knapping removes it
    const rough = (1 - k) * 0.07 + 0.012;
    const n = noise2(u * 3.1 + 11, th * 1.7 + 3, 7) * rough + noise2(u * 9.3, th * 5.1, 9) * rough * 0.35;
    let r = 1 + n;
    // flake scars (each appears at its knap time)
    for (const sc of this.scars) {
      const a = ease.outExpo(clamp((t - sc.t) / 0.07));
      if (a <= 0) continue;
      let dth = th - sc.th;
      dth = Math.atan2(Math.sin(dth), Math.cos(dth));
      const g = Math.exp(-((u - sc.u) ** 2) / (sc.su * sc.su) - (dth * dth) / (sc.sth * sc.sth));
      r -= sc.depth * a * g * (1 + 0.6 * Math.cos((u - sc.u) * 18) * 0.15);
    }
    x *= r; z *= r;
    out.set(x, u * 1.0, z);
    return out;
  }

  /**
   * Draw contour rings into a 3D LineBatch. `rot` = object rotation (applied via matrix), `reveal`
   * fn(u,θ)→0..1 multiplies alpha (for the draw-on at the first strike). Back-facing parts dim.
   */
  draw(lb: LineBatch, t: number, m: THREE.Matrix4, camPos: THREE.Vector3, o: { k?: number; width?: number; intensity?: number; reveal?: (u: number, th: number) => number; heatAt?: (u: number, th: number) => number; alpha?: number } = {}) {
    const k = o.k ?? this.progress(t);
    const R = this.rings, S = this.seg;
    const p = new THREE.Vector3(), q = new THREE.Vector3(), nrm = new THREE.Vector3(), v = new THREE.Vector3();
    const nm = new THREE.Matrix3().getNormalMatrix(m);
    const I = o.intensity ?? 1;
    const A = o.alpha ?? 1;
    const wd = o.width ?? 1.25;
    const pts: THREE.Vector3[] = new Array(S + 1);
    for (let i = 0; i < R; i++) {
      const u = -0.985 + (1.97 * (i + 0.5)) / R;
      for (let j = 0; j <= S; j++) {
        const th = (j / S) * TAU;
        pts[j] = this.point(u, th, k, t, new THREE.Vector3()).applyMatrix4(m);
      }
      for (let j = 0; j < S; j++) {
        const a = pts[j]!, b = pts[j + 1]!;
        const th = ((j + 0.5) / S) * TAU;
        // approximate outward normal in object space from cross-section, then to world
        this.point(u, th, k, t, p);
        nrm.set(p.x, 0, p.z * 3.0).normalize().applyMatrix3(nm).normalize();
        v.copy(camPos).sub(q.copy(a).add(b).multiplyScalar(0.5)).normalize();
        const facing = nrm.dot(v);
        const front = clamp(facing * 2.2 + 0.35);
        let al = (0.13 + 0.87 * front) * A;
        if (o.reveal) al *= o.reveal(u, th);
        if (al <= 0.003) continue;
        // rim light: silhouette lines slightly brighter
        const rim = Math.exp(-facing * facing * 30) * 0.6;
        const hot = o.heatAt ? o.heatAt(u, th) : 0;
        const base = (0.62 + 0.38 * front + rim) * I;
        const r = lerp(LIN.bone[0] * base, LIN.signal[0] * 3.2, hot);
        const g = lerp(LIN.bone[1] * base, LIN.signal[1] * 3.2, hot);
        const bl = lerp(LIN.bone[2] * base, LIN.signal[2] * 3.2, hot);
        lb.seg(a.x, a.y, a.z, b.x, b.y, b.z, wd * (0.7 + 0.3 * front), r, g, bl, al);
      }
    }
  }

  /** World-space centre of a scar (for flake/spark emission). */
  scarPos(i: number, t: number, m: THREE.Matrix4) {
    const sc = this.scars[i]!;
    return this.point(sc.u, sc.th, this.progress(t), t, new THREE.Vector3()).applyMatrix4(m);
  }
}
