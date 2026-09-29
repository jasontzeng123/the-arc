// The city, v2 (tools/citygen.py): a figure-ground plan texture (streets, river, coast, blocks, lots) and
// the same lots extruded for 3D; the target is three big overlapping blocks. Metres, x east, y north, z up.
import * as THREE from 'three';
import { LIN } from '../engine/palette';

interface Lot { p: number[]; h: number }
interface Tgt { x: number; y: number; w: number; d: number; h: number; a: number }

const lin = (k: keyof typeof LIN, s = 1) => new THREE.Color().setRGB(LIN[k][0] * s, LIN[k][1] * s, LIN[k][2] * s, THREE.LinearSRGBColorSpace);

export class City2 {
  scene = new THREE.Scene();
  ext = 1800;
  ground!: THREE.Mesh;
  groundMat = new THREE.MeshBasicMaterial({ toneMapped: false, depthWrite: true, polygonOffset: true, polygonOffsetFactor: 4, polygonOffsetUnits: 4 });
  faceMat = new THREE.MeshBasicMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, toneMapped: false });
  edgeMat = new THREE.LineBasicMaterial({ color: lin('bone', 0.85), toneMapped: false, transparent: true });
  lots!: THREE.Mesh; lotEdges!: THREE.LineSegments;
  target = new THREE.Group();
  tMat = new THREE.MeshBasicMaterial({ color: lin('ink2', 1.2), polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, toneMapped: false });
  tEdge = new THREE.LineBasicMaterial({ color: lin('bone', 1.6), toneMapped: false });

  async load() {
    const v = new URLSearchParams(location.search).get('city') ?? 'a';
    const d = await (await fetch(`data/city2${v}.json`)).json();
    this.ext = d.ext;
    const img = new Image();
    img.src = `data/cityplan${v}.png`;
    await img.decode();
    const tex = new THREE.Texture(img);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.needsUpdate = true;
    this.groundMat.map = tex;
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(this.ext * 2, this.ext * 2), this.groundMat);
    this.ground.frustumCulled = false;
    this.scene.add(this.ground);
    this.buildLots(d.lots as Lot[]);
    this.buildTarget(d.target as Tgt[]);
  }

  private buildLots(lots: Lot[]) {
    const pos: number[] = [], col: number[] = [], idx: number[] = [], ep: number[] = [];
    const light = new THREE.Vector2(0.55, -0.35).normalize();
    for (const L of lots) {
      const n = L.p.length / 2;
      if (n < 3) continue;
      const pts: THREE.Vector2[] = [];
      for (let i = 0; i < n; i++) pts.push(new THREE.Vector2(L.p[i * 2]!, L.p[i * 2 + 1]!));
      if (THREE.ShapeUtils.isClockWise(pts)) pts.reverse();
      // shrink a little so neighbouring lots read as separate buildings
      const cx = pts.reduce((s, p) => s + p.x, 0) / n, cy = pts.reduce((s, p) => s + p.y, 0) / n;
      for (const p of pts) { p.x = cx + (p.x - cx) * 0.94; p.y = cy + (p.y - cy) * 0.94; }
      const h = L.h;
      const base = pos.length / 3;
      const g = 0.03;
      for (const p of pts) { pos.push(p.x, p.y, h); col.push(g, g * 0.98, g * 0.95); }
      const tris = THREE.ShapeUtils.triangulateShape(pts, []);
      for (const t of tris) idx.push(base + t[0]!, base + t[1]!, base + t[2]!);
      for (let i = 0; i < n; i++) {
        const a = pts[i]!, b = pts[(i + 1) % n]!;
        const nx = b.y - a.y, ny = -(b.x - a.x);
        const len = Math.hypot(nx, ny) || 1;
        const br = Math.max(0, (nx / len) * light.x + (ny / len) * light.y) * 0.9 + 0.1;
        const w0 = pos.length / 3;
        const top = 0.012 + 0.06 * br, bot = top * 0.5;
        pos.push(a.x, a.y, 0, b.x, b.y, 0, b.x, b.y, h, a.x, a.y, h);
        col.push(bot, bot, bot, bot, bot, bot, top, top * 0.98, top * 0.95, top, top * 0.98, top * 0.95);
        idx.push(w0, w0 + 1, w0 + 2, w0, w0 + 2, w0 + 3);
        ep.push(a.x, a.y, h, b.x, b.y, h);
        if (i % 2 === 0 || n <= 4) ep.push(a.x, a.y, 0, a.x, a.y, h);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    this.lots = new THREE.Mesh(g, this.faceMat);
    this.lots.frustumCulled = false;
    const ge = new THREE.BufferGeometry();
    ge.setAttribute('position', new THREE.Float32BufferAttribute(ep, 3));
    this.lotEdges = new THREE.LineSegments(ge, this.edgeMat);
    this.lotEdges.frustumCulled = false;
    this.scene.add(this.lots, this.lotEdges);
  }

  private buildTarget(ts: Tgt[]) {
    for (const t of ts) {
      const geo = new THREE.BoxGeometry(t.w, t.d, t.h).translate(0, 0, t.h / 2).rotateZ(t.a).translate(t.x, t.y, 0.5);
      this.target.add(new THREE.Mesh(geo, this.tMat));
      this.target.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), this.tEdge));
    }
    this.scene.add(this.target);
  }

  /** plan: the flat figure-ground map (no extrusion); 3D: dimmer ground + buildings. hot: target glow 0..1. */
  setLook(o: { plan: boolean; hot: number; ground?: number }) {
    const gb = o.ground ?? (o.plan ? 1.0 : 0.55);
    this.groundMat.color.setRGB(gb, gb, gb, THREE.LinearSRGBColorSpace);
    this.lots.visible = this.lotEdges.visible = !o.plan;
    const h = o.hot;
    this.target.visible = !(o.plan && h < 0.01); // in plan the target is just another footprint in the texture
    this.tEdge.color.setRGB(LIN.bone[0] * 0.85 * (1 - h) + LIN.signal[0] * 5 * h, LIN.bone[1] * 0.85 * (1 - h) + LIN.signal[1] * 5 * h, LIN.bone[2] * 0.85 * (1 - h) + LIN.signal[2] * 5 * h, THREE.LinearSRGBColorSpace);
    this.tMat.color.setRGB(0.02 + LIN.signal[0] * 0.6 * h, 0.02 + LIN.signal[1] * 0.6 * h, 0.02 + LIN.signal[2] * 0.6 * h, THREE.LinearSRGBColorSpace);
  }

  render(renderer: THREE.WebGLRenderer, out: THREE.WebGLRenderTarget, cam: THREE.Camera) {
    renderer.setRenderTarget(out);
    renderer.clearDepth();
    renderer.render(this.scene, cam);
  }
}
