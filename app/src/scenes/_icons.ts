// Weapon icons over the film: flat, rounded, emblematic silhouettes (structure knocked out of them),
// one per weapon, switched on the beat, always upright and large on the left (gunpowder centred).
// Geometry: tools/icons/*.py → icons.json (ops applied in order: fill / hole, optionally clipped).
import DATA from './icons.json';

type Op = { k: 'fill' | 'hole'; d: string; clip?: string };
const ICONS = DATA as unknown as Record<string, { b: [number, number, number, number]; ops: Op[] }>;
const cache = new Map<string, Path2D>();
const P = (d: string) => { let p = cache.get(d); if (!p) { p = new Path2D(d); cache.set(d, p); } return p; };

export interface Cue { id: string; t0: number; t1: number; x: number; y: number; w: number; a?: number; rot?: number }

/** x, y: centre of the icon's box in layout px; w: the box's width in px; rot: degrees (negative = counter-clockwise). */
export const CUES: Cue[] = [
  { id: 'spear', t0: 6.0, t1: 8.0, x: 330, y: 600, w: 432 },
  { id: 'bow', t0: 8.0, t1: 14.0, x: 331, y: 524, w: 650 },
  { id: 'bronzeSword', t0: 14.0, t1: 16.0, x: 320, y: 560, w: 412 },
  { id: 'ironSword', t0: 16.0, t1: 20.0, x: 320, y: 560, w: 449 },
  { id: 'powder', t0: 20.0, t1: 22.0, x: 892, y: 543, w: 776 },
  { id: 'cannon', t0: 22.0, t1: 26.0, x: 480, y: 708, w: 1000 },
  { id: 'flintlock', t0: 26.0, t1: 28.0, x: 330, y: 590, w: 379 },
  { id: 'gatling', t0: 28.0, t1: 29.0, x: 460, y: 620, w: 900 },
  { id: 'maxim', t0: 29.0, t1: 30.0, x: 460, y: 600, w: 880 },
  { id: 'minigun', t0: 30.0, t1: 32.0, x: 330, y: 580, w: 420 },
  { id: 'boltRifle', t0: 32.0, t1: 34.0, x: 330, y: 560, w: 370 },
  { id: 'tank', t0: 34.0, t1: 36.0, x: 320, y: 612, w: 760 },
  { id: 'bomber', t0: 36.0, t1: 38.0, x: 420, y: 560, w: 820 },
  { id: 'littleBoy', t0: 38.0, t1: 40.0, x: 313, y: 540, w: 325, a: 0.045 },
  { id: 'ww2bomb', t0: 40.0, t1: 44.0, x: 320, y: 560, w: 311, a: 0.085 },
  { id: 'drone', t0: 44.0, t1: 46.5, x: 460, y: 640, w: 989, a: 0.085 },
  { id: 'gps', t0: 46.5, t1: 48.0, x: 430, y: 580, w: 849, rot: -45 },
  { id: 'nuke', t0: 48.0, t1: 50.0, x: 313, y: 645, w: 340 },
];

const cueAt = (t: number) => CUES.find((k) => t >= k.t0 && t < k.t1);

/** Draw the icon active at t into a 2D context (layout px). */
export function drawIcons(c: CanvasRenderingContext2D, t: number, color: string): boolean {
  const q = cueAt(t);
  if (!q) return false;
  const ic = ICONS[q.id]!;
  const [x0, y0, x1, y1] = ic.b;
  const pop = 1 + 0.05 * Math.exp(-(t - q.t0) * 22); // lands on the beat: a small overshoot, settled in ~0.15 s
  const s = (q.w / (x1 - x0)) * pop;
  c.save();
  c.translate(q.x, q.y);
  if (q.rot) c.rotate((q.rot * Math.PI) / 180); // (negative = counter-clockwise)
  c.scale(s, s);
  c.translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
  c.fillStyle = color;
  for (const o of ic.ops) {
    c.globalCompositeOperation = o.k === 'fill' ? 'source-over' : 'destination-out';
    if (o.clip) { c.save(); c.clip(P(o.clip)); c.fill(P(o.d)); c.restore(); }
    else c.fill(P(o.d));
  }
  c.restore();
  return true;
}

export function iconAlpha(t: number): number {
  const q = cueAt(t);
  if (!q) return 0;
  return (q.a ?? 0.027) * (1 + 0.8 * Math.exp(-(t - q.t0) * 12)); // (linear light; brighter scenes get a little more)
}
