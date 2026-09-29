// THE ARC: the thrown spear's flight (world metres), shared by `stone` (launch) and `bow` (landing),
// so the cut at 8.0 s is seamless. Side view: screen = (960 + (x - cx) * s, GY - y * s).
import { clamp, ease, lerp, prog } from '../engine/util';

export const THROW = 6.0; // s
export const LAND = 8.0; // s
export const G = 9.81;
export const H0 = 1.8; // release height (m)
export const VX = 15.0; // m/s → 30 m in 2 s
export const VY = (0 - H0 + 0.5 * G * (LAND - THROW) ** 2) / (LAND - THROW); // lands at y = 0
export const GY = 770; // ground line (px)

export function spearAt(t: number) {
  const tau = clamp(t - THROW, 0, LAND - THROW);
  const x = VX * tau, y = H0 + VY * tau - 0.5 * G * tau * tau;
  const ang = Math.atan2(VY - G * tau, VX); // up is +
  return { x, y, ang, tau };
}

/** Side-view camera during the flight: px per metre and world x at screen centre. */
export function sideCam(t: number) {
  const k = prog(t, THROW, LAND, ease.inOutCubic);
  const s = lerp(72, 46, k);
  const sp = spearAt(t);
  const cx = lerp(Math.max(3, sp.x + 4), 15.5, ease.inOutCubic(prog(t, THROW + 0.2, LAND)));
  return { s, cx };
}

export const toScreen = (x: number, y: number, cam: { s: number; cx: number }) => ({ x: 960 + (x - cam.cx) * cam.s, y: GY - y * cam.s });

/** Polyline of the arc from the throw up to time t (world metres). */
export function arcPoints(t: number, n = 80) {
  const pts: { x: number; y: number }[] = [];
  const tau = clamp(t - THROW, 0, LAND - THROW);
  for (let i = 0; i <= n; i++) {
    const tt = (tau * i) / n;
    pts.push({ x: VX * tt, y: H0 + VY * tt - 0.5 * G * tt * tt });
  }
  return pts;
}
