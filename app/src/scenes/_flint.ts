// The flint: a cobble (many tangent planes of a noisy ellipsoid) knapped by plane cuts into a Levallois
// point. The solid is an intersection of half-spaces n·x ≤ d; each strike adds one. Drawn as contour rings
// (cross-sections along the long axis y, tip at +y) whose edges know which plane made them, plus the
// ridges between facets.
import * as THREE from 'three';
import { LineBatch } from '../engine/lines';
import { LIN } from '../engine/palette';
import { clamp, ease, hash, lerp, TAU } from '../engine/util';

export interface Plane { n: THREE.Vector3; d: number; t: number; cut: boolean; idx: number }

type V2 = [number, number];
interface Poly { p: V2[]; lab: number[] } // lab[i] = plane that made edge p[i] → p[i+1]

function mkPlane(n: [number, number, number], through: [number, number, number]) {
  const v = new THREE.Vector3(...n).normalize();
  return { n: v, d: v.dot(new THREE.Vector3(...through)) };
}

export class Flint {
  planes: Plane[] = [];
  cuts: Plane[] = [];
  rings = 64;

  constructor(public knapTimes: number[]) {
    // cobble: tangent planes of a noisy ellipsoid
    const a = new THREE.Vector3(0.74, 1.16, 0.52);
    const N = 90;
    for (let i = 0; i < N; i++) {
      const y = 1 - (2 * (i + 0.5)) / N, r = Math.sqrt(1 - y * y), ph = i * 2.39996;
      const u = new THREE.Vector3(Math.cos(ph) * r, y, Math.sin(ph) * r);
      const p = new THREE.Vector3(a.x * u.x, a.y * u.y, a.z * u.z);
      const n = new THREE.Vector3(p.x / (a.x * a.x), p.y / (a.y * a.y), p.z / (a.z * a.z)).normalize();
      const d = n.dot(p) * (1 + (hash(i, 3) - 0.5) * 0.08);
      this.planes.push({ n, d, t: -1e9, cut: false, idx: -1 });
    }
    // the knapping sequence → a Levallois point (tip +y, flat ventral face at z = −0.08). Rough cuts first
    // (the final facets pushed outward), then the final facets, then the central Levallois scar.
    const Z = -0.08;
    const BL = [-0.44, -0.95, Z], ML = [-0.6, -0.28, Z], T = [0, 1.05, Z];
    const BR = [0.44, -0.95, Z], MR = [0.6, -0.28, Z];
    const planeThrough = (p0: number[], p1: number[], p2: number[], outward: [number, number, number], off = 0) => {
      const A = new THREE.Vector3(...(p0 as [number, number, number])), B = new THREE.Vector3(...(p1 as [number, number, number])), C = new THREE.Vector3(...(p2 as [number, number, number]));
      const n = new THREE.Vector3().subVectors(B, A).cross(new THREE.Vector3().subVectors(C, A)).normalize();
      if (n.dot(new THREE.Vector3(...outward)) < 0) n.negate();
      return { n, d: n.dot(A) + off };
    };
    const DUL = (o: number) => planeThrough(ML, T, [0, 0.15, 0.27], [-1, 0.3, 1], o);
    const DUR = (o: number) => planeThrough(MR, T, [0, 0.15, 0.27], [1, 0.3, 1], o);
    const DLL = (o: number) => planeThrough(BL, ML, [0, -0.55, 0.3], [-1, -0.3, 1], o);
    const DLR = (o: number) => planeThrough(BR, MR, [0, -0.55, 0.3], [1, -0.3, 1], o);
    // five strikes, one a second: rough facets only — a natural, angular cobble tool (no final retouch)
    const seq = [
      DUL(0.2), DUR(0.2), DLL(0.2), DLR(0.2),
      mkPlane([0, -1, -0.1], [0, -0.95, 0]), // platform
    ];
    seq.forEach((s, i) => {
      const pl: Plane = { n: s.n, d: s.d, t: knapTimes[i] ?? 1e9, cut: true, idx: i };
      this.planes.push(pl);
      this.cuts.push(pl);
    });
  }

  /** Effective d of a plane at time t (a cut sweeps in from outside over 60 ms). */
  dAt(pl: Plane, t: number) {
    if (!pl.cut) return pl.d;
    const a = ease.outExpo(clamp((t - pl.t) / 0.06));
    return lerp(pl.d + 2.5, pl.d, a);
  }

  active(t: number) { return this.planes.filter((p) => !p.cut || t >= p.t); }

  /** Cross-section at height y: convex polygon in (x, z), edges labelled by plane index. */
  section(y: number, t: number, planes: Plane[]): Poly | null {
    let poly: Poly = { p: [[-3, -3], [3, -3], [3, 3], [-3, 3]], lab: [-2, -2, -2, -2] };
    for (let k = 0; k < planes.length; k++) {
      const pl = planes[k]!;
      const a = pl.n.x, b = pl.n.z, c = this.dAt(pl, t) - pl.n.y * y;
      if (a * a + b * b < 1e-8) { if (c < 0) return null; continue; }
      const P = poly.p, Lb = poly.lab, n = P.length;
      const outP: V2[] = [], outL: number[] = [];
      const lab = this.planes.indexOf(pl);
      for (let i = 0; i < n; i++) {
        const cur = P[i]!, nxt = P[(i + 1) % n]!;
        const fc = a * cur[0] + b * cur[1] - c, fn = a * nxt[0] + b * nxt[1] - c;
        if (fc <= 0) {
          outP.push(cur); outL.push(fn <= 0 ? Lb[i]! : Lb[i]!);
          if (fn > 0) {
            const s = fc / (fc - fn);
            outP.push([cur[0] + (nxt[0] - cur[0]) * s, cur[1] + (nxt[1] - cur[1]) * s]); outL.push(lab);
          }
        } else if (fn <= 0) {
          const s = fc / (fc - fn);
          outP.push([cur[0] + (nxt[0] - cur[0]) * s, cur[1] + (nxt[1] - cur[1]) * s]); outL.push(Lb[i]!);
        }
      }
      if (outP.length < 3) return null;
      poly = { p: outP, lab: outL };
    }
    return poly;
  }

  /** Polygon of a plane's facet (in world coords after m), or null. */
  facet(pi: number, t: number, planes: Plane[]) {
    const pl = this.planes[pi]!;
    const n = pl.n;
    const e1 = new THREE.Vector3(0, 1, 0).cross(n);
    if (e1.lengthSq() < 1e-6) e1.set(1, 0, 0).cross(n);
    e1.normalize();
    const e2 = n.clone().cross(e1).normalize();
    const o = n.clone().multiplyScalar(this.dAt(pl, t));
    let P: V2[] = [[-3, -3], [3, -3], [3, 3], [-3, 3]];
    for (const q of planes) {
      if (q === pl) continue;
      // q.n·(o + u e1 + v e2) ≤ d → a u + b v ≤ c
      const a = q.n.dot(e1), b = q.n.dot(e2), c = this.dAt(q, t) - q.n.dot(o);
      if (a * a + b * b < 1e-10) { if (c < 0) return null; continue; }
      const out: V2[] = [];
      for (let i = 0; i < P.length; i++) {
        const cur = P[i]!, nxt = P[(i + 1) % P.length]!;
        const fc = a * cur[0] + b * cur[1] - c, fn = a * nxt[0] + b * nxt[1] - c;
        if (fc <= 0) out.push(cur);
        if ((fc <= 0) !== (fn <= 0)) { const s = fc / (fc - fn); out.push([cur[0] + (nxt[0] - cur[0]) * s, cur[1] + (nxt[1] - cur[1]) * s]); }
      }
      if (out.length < 3) return null;
      P = out;
    }
    return P.map(([u, v]) => o.clone().addScaledVector(e1, u).addScaledVector(e2, v));
  }

  /** Draw contour rings + ridges. heat(planeIdx) → 0..1 glow. */
  draw(lb: LineBatch, t: number, m: THREE.Matrix4, camPos: THREE.Vector3, o: { reveal?: (y: number, x: number, z: number) => number; heat?: (pi: number) => number; intensity?: number; alpha?: number; width?: number } = {}) {
    const planes = this.active(t);
    const nm = new THREE.Matrix3().getNormalMatrix(m);
    const I = o.intensity ?? 1, A = o.alpha ?? 1, wd = o.width ?? 1.2;
    const wn = this.planes.map((p) => p.n.clone().applyMatrix3(nm).normalize());
    const a = new THREE.Vector3(), b = new THREE.Vector3(), v = new THREE.Vector3();
    for (let r = 0; r < this.rings; r++) {
      const y = -1.1 + (2.25 * (r + 0.5)) / this.rings;
      const poly = this.section(y, t, planes);
      if (!poly) continue;
      const n = poly.p.length;
      for (let i = 0; i < n; i++) {
        const p = poly.p[i]!, q = poly.p[(i + 1) % n]!;
        const lab = poly.lab[i]!;
        if (lab < 0) continue;
        a.set(p[0], y, p[1]).applyMatrix4(m);
        b.set(q[0], y, q[1]).applyMatrix4(m);
        v.copy(camPos).sub(a).normalize();
        const facing = wn[lab]!.dot(v);
        const front = clamp(facing * 2.0 + 0.3);
        let al = (0.12 + 0.88 * front) * A;
        if (o.reveal) al *= o.reveal(y, p[0], p[1]);
        if (al < 0.004) continue;
        const pl = this.planes[lab]!;
        const h = o.heat && pl.cut ? o.heat(pl.idx) : 0;
        const base = (pl.cut ? 0.75 + 0.45 * front : 0.5 + 0.4 * front) * I;
        const col = [lerp(LIN.bone[0] * base, LIN.signal[0] * 3.4, h), lerp(LIN.bone[1] * base, LIN.signal[1] * 3.4, h), lerp(LIN.bone[2] * base, LIN.signal[2] * 3.4, h)];
        lb.seg(a.x, a.y, a.z, b.x, b.y, b.z, wd * (0.7 + 0.3 * front), col[0]!, col[1]!, col[2]!, al);
      }
    }
    // ridges: edges of the cut facets
    for (const pc of planes) {
      if (!pc.cut) continue;
      const pi = this.planes.indexOf(pc);
      const f = this.facet(pi, t, planes);
      if (!f) continue;
      const h = o.heat ? o.heat(pc.idx) : 0;
      for (let i = 0; i < f.length; i++) {
        a.copy(f[i]!).applyMatrix4(m); b.copy(f[(i + 1) % f.length]!).applyMatrix4(m);
        let al = A;
        if (o.reveal) al *= o.reveal(f[i]!.y, f[i]!.x, f[i]!.z);
        const k = (1.6 + 2.5 * h) * I;
        lb.seg(a.x, a.y, a.z, b.x, b.y, b.z, 1.8 * wd, lerp(LIN.bone[0] * k, LIN.signal[0] * 4, h), lerp(LIN.bone[1] * k, LIN.signal[1] * 4, h), lerp(LIN.bone[2] * k, LIN.signal[2] * 4, h), al);
      }
    }
  }

  /** Centre of cut i's facet (object space) at time t, and its outline (for the flake). */
  cutInfo(i: number, t: number) {
    const pl = this.cuts[i]!;
    const pi = this.planes.indexOf(pl);
    const f = this.facet(pi, Math.max(t, pl.t + 0.07), this.active(Math.max(t, pl.t + 0.07)));
    const c = new THREE.Vector3();
    if (f) { for (const p of f) c.add(p); c.multiplyScalar(1 / f.length); }
    return { center: c, outline: f ?? [], n: pl.n.clone() };
  }
}

export { TAU };
