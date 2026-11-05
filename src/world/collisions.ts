import { islands, stools } from './layout';
type Point = { x: number; z: number };
const radius = 0.22;
const cabinets = [
  { x: -3.15, z: -4.1, w: 4.3, d: 1 }, { x: 4.8, z: -3.6, w: 1.8, d: 2 },
  { x: -5.1, z: 0.5, w: 1, d: 2.5 }, { x: 5.25, z: 0.8, w: 0.95, d: 4.8 },
  { x: -5.74, z: 3.3, w: 0.45, d: 0.45 },
];
function polygon(o: { x: number; z: number; w: number; d: number }, cut = 0): Point[] {
  const x = o.w / 2, z = o.d / 2;
  return [[-x + cut, -z], [x - cut, -z], [x, -z + cut], [x, z - cut], [x - cut, z], [-x + cut, z], [-x, z - cut], [-x, -z + cut]].map(([px, pz]) => ({ x: o.x + px, z: o.z + pz }));
}
// The collision silhouette follows the visible cut corners, rather than a hidden box.
const polygons = [...islands.map(o => polygon(o, Math.min(o.w, o.d) * 0.22)), ...cabinets.map(o => polygon(o))];
function circleHitsPolygon(x: number, z: number, vertices: Point[]) {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const a = vertices[j], b = vertices[i];
    if ((a.z > z) !== (b.z > z) && x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x) inside = !inside;
    const dx = b.x - a.x, dz = b.z - a.z, length = dx * dx + dz * dz;
    const t = length ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / length)) : 0;
    if ((x - a.x - t * dx) ** 2 + (z - a.z - t * dz) ** 2 < radius ** 2) return true;
  }
  return inside;
}
export function canStand(x: number, z: number) {
  return Number.isFinite(x) && Number.isFinite(z) && Math.abs(x) <= 5.7 && Math.abs(z) <= 4.7
    && !polygons.some(p => circleHitsPolygon(x, z, p))
    && !stools.some(s => Math.hypot(x - s.x, z - s.z) < 0.31 + radius);
}
/** Sweep small steps and consume only requested motion; never push the player back. */
export function movePlayer(x: number, z: number, dx: number, dz: number): Point {
  if (![x, z, dx, dz].every(Number.isFinite)) return { x, z };
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.025));
  const sx = dx / steps, sz = dz / steps;
  for (let i = 0; i < steps; i++) {
    if (canStand(x + sx, z + sz)) { x += sx; z += sz; continue; }
    for (const axis of ['x', 'z'] as const) {
      const delta = axis === 'x' ? sx : sz;
      let lo = 0, hi = 1;
      if (canStand(x + (axis === 'x' ? delta : 0), z + (axis === 'z' ? delta : 0))) lo = 1;
      else for (let j = 0; j < 8; j++) {
        const mid = (lo + hi) / 2;
        if (canStand(x + (axis === 'x' ? delta * mid : 0), z + (axis === 'z' ? delta * mid : 0))) lo = mid; else hi = mid;
      }
      if (axis === 'x') x += delta * lo; else z += delta * lo;
    }
  }
  return { x, z };
}
