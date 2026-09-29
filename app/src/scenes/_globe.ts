// Wireframe globe (graticule) for 3D LineBatches; back hemisphere dimmed.
import * as THREE from 'three';
import { LineBatch } from '../engine/lines';
import { LIN } from '../engine/palette';
import { clamp, TAU } from '../engine/util';

export function drawGlobe(lb: LineBatch, R: number, rotY: number, camPos: THREE.Vector3, o: { alpha?: number; tilt?: number; lat?: number; lon?: number; intensity?: number } = {}) {
  const A = o.alpha ?? 1, I = o.intensity ?? 1;
  const m = new THREE.Matrix4().makeRotationY(rotY).premultiply(new THREE.Matrix4().makeRotationX(o.tilt ?? 0.35));
  const P = (la: number, lo: number) => new THREE.Vector3(Math.cos(la) * Math.cos(lo) * R, Math.sin(la) * R, Math.cos(la) * Math.sin(lo) * R).applyMatrix4(m);
  const seg = (a: THREE.Vector3, b: THREE.Vector3, w: number, k: number) => {
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const facing = mid.clone().normalize().dot(camPos.clone().sub(mid).normalize());
    const al = (facing > 0 ? 0.9 : 0.14) * A * k;
    lb.seg(a.x, a.y, a.z, b.x, b.y, b.z, w, LIN.bone[0] * I, LIN.bone[1] * I, LIN.bone[2] * I, al);
  };
  const nLat = o.lat ?? 9, nLon = o.lon ?? 18, S = 72;
  for (let i = 1; i < nLat; i++) {
    const la = -Math.PI / 2 + (i * Math.PI) / nLat;
    for (let j = 0; j < S; j++) seg(P(la, (j / S) * TAU), P(la, ((j + 1) / S) * TAU), i === nLat / 2 ? 1.3 : 0.9, i === Math.floor(nLat / 2) ? 1 : 0.6);
  }
  for (let j = 0; j < nLon; j++) {
    const lo = (j / nLon) * TAU;
    for (let i = 0; i < S / 2; i++) seg(P(-Math.PI / 2 + (i / (S / 2)) * Math.PI, lo), P(-Math.PI / 2 + ((i + 1) / (S / 2)) * Math.PI, lo), 0.9, 0.6);
  }
  // limb: a bright circle facing the camera
  const n = camPos.clone().normalize();
  const u = new THREE.Vector3(0, 1, 0).cross(n).normalize(), v = n.clone().cross(u);
  for (let j = 0; j < 128; j++) {
    const a0 = (j / 128) * TAU, a1 = ((j + 1) / 128) * TAU;
    const p = u.clone().multiplyScalar(Math.cos(a0) * R).addScaledVector(v, Math.sin(a0) * R);
    const q = u.clone().multiplyScalar(Math.cos(a1) * R).addScaledVector(v, Math.sin(a1) * R);
    lb.seg(p.x, p.y, p.z, q.x, q.y, q.z, 1.8, LIN.bone[0] * 1.2 * I, LIN.bone[1] * 1.2 * I, LIN.bone[2] * 1.2 * I, A);
  }
  return m;
}

/** Point on the globe surface (lat, lon radians) after the same rotation, at radius r. */
export function globePoint(m: THREE.Matrix4, r: number, la: number, lo: number) {
  return new THREE.Vector3(Math.cos(la) * Math.cos(lo) * r, Math.sin(la) * r, Math.cos(la) * Math.sin(lo) * r).applyMatrix4(m);
}

export { clamp };
