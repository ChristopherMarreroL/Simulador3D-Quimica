import { items, type ItemId } from './definitions';
export type SurfaceId = 'shelf' | 'bench' | 'support-1' | 'support-2';
export type Place = SurfaceId | 'left' | 'right';
export const surfaceNames: Record<SurfaceId, string> = {
  shelf: 'Reactivos y material', bench: 'Mesa de reacción', 'support-1': 'Mesa 02 · Conductividad', 'support-2': 'Mesa 03 · Cristalización',
};
export function isSurface(id: string | null): id is SurfaceId { return !!id && Object.hasOwn(surfaceNames, id); }
export function placementSurface(target: string | null, locations: Record<ItemId, Place>): SurfaceId | null {
  if (isSurface(target)) return target;
  if (target && Object.hasOwn(items, target)) {
    const place = locations[target as ItemId];
    return isSurface(place) ? place : null;
  }
  return null;
}
export function itemPosition(id: ItemId, place: SurfaceId): [number, number, number] {
  if (place === 'shelf') return items[id].position;
  const slot = { beaker: -0.6, vinegar: 0, bicarbonate: 0.6 }[id];
  if (place === 'bench') return [0.8 + slot, 1.16, -0.5];
  return [place === 'support-1' ? -2.8 + slot : 2.7 + slot, 1.16, place === 'support-1' ? 0.8 : 2.7];
}
