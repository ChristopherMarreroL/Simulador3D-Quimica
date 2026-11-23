import * as THREE from 'three';
import { useSettings } from '../state/settings';

/**
 * Procedural, deterministic materials inspired by the reference photos (polished blue-pearl-like granite,
 * glossy light porcelain floor, white walls, brushed steel). No photo is used as a texture.
 */
function rng(seed: number) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
function canvas(size: number) { const c = document.createElement('canvas'); c.width = c.height = size; return [c, c.getContext('2d')!] as const; }
function texture(c: HTMLCanvasElement, repeat: [number, number] = [1, 1], color = true) {
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat);
  t.anisotropy = 8; if (color) t.colorSpace = THREE.SRGBColorSpace; return t;
}
/** Tangent-space normal map from a greyscale height canvas (Sobel, wraps at the edges). */
function normalFrom(height: HTMLCanvasElement, strength: number) {
  const size = height.width; const src = height.getContext('2d')!.getImageData(0, 0, size, size).data;
  const [c, ctx] = canvas(size); const out = ctx.createImageData(size, size);
  const h = (x: number, y: number) => src[(((y + size) % size) * size + ((x + size) % size)) * 4] / 255;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (h(x + 1, y) - h(x - 1, y)) * strength, dy = (h(x, y + 1) - h(x, y - 1)) * strength;
    const len = Math.hypot(dx, dy, 1); const i = (y * size + x) * 4;
    out.data[i] = (-dx / len * 0.5 + 0.5) * 255; out.data[i + 1] = (dy / len * 0.5 + 0.5) * 255; out.data[i + 2] = (1 / len * 0.5 + 0.5) * 255; out.data[i + 3] = 255;
  }
  ctx.putImageData(out, 0, 0); return c;
}
/** Draw a shape at every wrapped copy so the texture tiles without seams. */
function wrapped(size: number, x: number, y: number, r: number, draw: (x: number, y: number) => void) {
  for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) if (x + ox > -r && x + ox < size + r && y + oy > -r && y + oy < size + r) draw(x + ox, y + oy);
}

function graniteCanvas() {
  const S = 1024; const [c, ctx] = canvas(S); const r = rng(714);
  ctx.fillStyle = '#2b3037'; ctx.fillRect(0, 0, S, S);
  const palette = ['#181b20', '#22262c', '#343a42', '#454c55', '#5e6670', '#7f8790', '#3f4e66', '#55688a', '#101215'];
  for (let i = 0; i < 16000; i++) {
    const x = r() * S, y = r() * S, size = 1.5 + r() ** 2.6 * 13;
    const p = r(); const color = palette[p < 0.3 ? 0 : p < 0.52 ? 1 : p < 0.68 ? 2 : p < 0.78 ? 3 : p < 0.85 ? 4 : p < 0.88 ? 5 : p < 0.95 ? 6 : p < 0.975 ? 7 : 8];
    const sides = 4 + Math.floor(r() * 4), rot = r() * Math.PI; ctx.fillStyle = color;
    wrapped(S, x, y, size, (cx, cy) => {
      ctx.beginPath();
      for (let k = 0; k < sides; k++) { const a = rot + k / sides * Math.PI * 2, rr = size * (0.55 + r() * 0.45); ctx[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * (0.6 + r() * 0.4)); }
      ctx.closePath(); ctx.fill();
    });
  }
  // Iridescent feldspar flecks that catch the light in the photos.
  for (let i = 0; i < 1400; i++) { const x = r() * S, y = r() * S; ctx.fillStyle = r() < 0.6 ? '#7d95bd' : '#a9b8cf'; ctx.globalAlpha = 0.35 + r() * 0.45; ctx.fillRect(x, y, 1 + r() * 2.5, 1 + r() * 1.5); }
  ctx.globalAlpha = 1; return c;
}
function porcelainCanvas() {
  const S = 1024, tile = S / 2; const [c, ctx] = canvas(S); const [hc, hx] = canvas(S); const r = rng(91);
  hx.fillStyle = '#ffffff'; hx.fillRect(0, 0, S, S);
  for (let i = 0; i < 4; i++) {
    const x = (i % 2) * tile, y = Math.floor(i / 2) * tile; const shade = 214 - Math.floor(r() * 8);
    ctx.fillStyle = `rgb(${shade},${shade - 4},${shade - 12})`; ctx.fillRect(x, y, tile, tile);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, tile, tile); ctx.clip();
    for (let k = 0; k < 7; k++) { // soft, low-contrast veining
      ctx.strokeStyle = `rgba(150,140,125,${0.05 + r() * 0.06})`; ctx.lineWidth = 1 + r() * 5; ctx.beginPath();
      let px = x + r() * tile, py = y + r() * tile; ctx.moveTo(px, py);
      for (let s = 0; s < 6; s++) { px += (r() - 0.3) * 120; py += (r() - 0.5) * 120; ctx.lineTo(px, py); }
      ctx.stroke();
    }
    for (let k = 0; k < 1400; k++) { ctx.fillStyle = `rgba(120,110,95,${r() * 0.06})`; ctx.fillRect(x + r() * tile, y + r() * tile, 2, 2); }
    ctx.restore();
  }
  ctx.fillStyle = '#a9a294'; hx.fillStyle = '#000000';
  for (const p of [0, tile]) { ctx.fillRect(p, 0, 4, S); ctx.fillRect(0, p, S, 4); hx.fillRect(p, 0, 4, S); hx.fillRect(0, p, S, 4); }
  return { color: c, normal: normalFrom(hc, 2.5) };
}
function paintCanvas() {
  const S = 256; const [c, ctx] = canvas(S); const r = rng(33);
  ctx.fillStyle = '#f2f3ef'; ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) { const v = 228 + Math.floor(r() * 22); ctx.fillStyle = `rgba(${v},${v},${v - 4},0.35)`; ctx.fillRect(r() * S, r() * S, 2, 2); }
  return c;
}
function brushedCanvas() {
  const S = 256; const [c, ctx] = canvas(S); const r = rng(5);
  ctx.fillStyle = '#9da7ab'; ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 900; i++) { const v = 130 + Math.floor(r() * 90); ctx.fillStyle = `rgba(${v},${v + 6},${v + 9},0.35)`; ctx.fillRect(0, r() * S, S, 1); }
  return c;
}
function radialCanvas() {
  const [c, ctx] = canvas(128); const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(0,0,0,0.75)'); g.addColorStop(0.45, 'rgba(0,0,0,0.38)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128); return c;
}
function gradientCanvas() {
  const c = document.createElement('canvas'); c.width = 4; c.height = 128; const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(0,0,0,0.42)'); g.addColorStop(0.35, 'rgba(0,0,0,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 128); return c;
}
function ceilingCanvas() {
  const S = 512; const [c, ctx] = canvas(S); const r = rng(12);
  ctx.fillStyle = '#f0f0ec'; ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 5000; i++) { ctx.fillStyle = `rgba(140,140,130,${r() * 0.18})`; ctx.fillRect(r() * S, r() * S, 1.5, 1.5); }
  ctx.fillStyle = '#d6d7d2'; ctx.fillRect(0, 0, S, 5); ctx.fillRect(0, 0, 5, S); ctx.fillRect(0, S / 2, S, 3); ctx.fillRect(S / 2, 0, 3, S);
  return c;
}

const graniteMap = texture(graniteCanvas(), [1.3, 1.3]);
const floor = porcelainCanvas();
const floorMap = texture(floor.color, [10, 8.333]);
const floorNormal = texture(floor.normal, [10, 8.333], false);
const paintMap = texture(paintCanvas(), [6, 3]);
const brushed = texture(brushedCanvas(), [1, 1]);
export const radialShadow = texture(radialCanvas(), [1, 1], false);
export const aoGradient = texture(gradientCanvas(), [1, 1], false);
const ceilingMap = texture(ceilingCanvas(), [10, 8.333]);

export const materials = {
  granite: new THREE.MeshPhysicalMaterial({ map: graniteMap, roughness: 0.2, metalness: 0.02, clearcoat: 0.55, clearcoatRoughness: 0.12, envMapIntensity: 1.1 }),
  floor: new THREE.MeshPhysicalMaterial({ map: floorMap, normalMap: floorNormal, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.16, clearcoat: 0.4, clearcoatRoughness: 0.1 }),
  wall: new THREE.MeshStandardMaterial({ map: paintMap, roughness: 0.92 }),
  ceiling: new THREE.MeshStandardMaterial({ map: ceilingMap, roughness: 0.95 }),
  laminate: new THREE.MeshPhysicalMaterial({ color: '#f4f5f1', roughness: 0.32, clearcoat: 0.25 }),
  laminateEdge: new THREE.MeshStandardMaterial({ color: '#e3e6e1', roughness: 0.5 }),
  steel: new THREE.MeshStandardMaterial({ map: brushed, color: '#c3cbcf', metalness: 0.85, roughness: 0.38, envMapIntensity: 0.8 }),
  chrome: new THREE.MeshStandardMaterial({ color: '#f2f5f7', metalness: 1, roughness: 0.08 }),
  aluminium: new THREE.MeshStandardMaterial({ color: '#eef0ee', metalness: 0.35, roughness: 0.35 }),
  plasticWhite: new THREE.MeshStandardMaterial({ color: '#f1f0ea', roughness: 0.55 }),
  plasticBlack: new THREE.MeshStandardMaterial({ color: '#2a2d31', roughness: 0.4 }),
  rubber: new THREE.MeshStandardMaterial({ color: '#1d2024', roughness: 0.85 }),
};
export const glass = {
  /** Main glassware (practice beaker and hood flask): refractive transmission in Ultra quality. */
  lab: new THREE.MeshPhysicalMaterial({ color: '#eef8fa', transparent: true, opacity: 0.3, roughness: 0.02, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02, ior: 1.47, thickness: 0.006, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 2.2 }),
  /** Laboratory borosilicate glass: thin, clear, reflective. */
  clear: new THREE.MeshPhysicalMaterial({ color: '#e3f1f4', transparent: true, opacity: 0.34, roughness: 0.02, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.02, specularIntensity: 1, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 2.2 }),
};

/** Ultra swaps the main glassware to physically based transmission (refraction of what is behind it). */
function applyGlassQuality(ultra: boolean) {
  const m = glass.lab; m.transmission = ultra ? 1 : 0; m.transparent = !ultra; m.opacity = ultra ? 1 : 0.3; m.depthWrite = ultra; m.needsUpdate = true;
}
applyGlassQuality(useSettings.getState().quality === 'ultra');
useSettings.subscribe((s, prev) => { if (s.quality !== prev.quality) applyGlassQuality(s.quality === 'ultra'); });
