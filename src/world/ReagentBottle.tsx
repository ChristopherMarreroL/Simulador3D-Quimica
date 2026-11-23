import { useMemo } from 'react';
import * as THREE from 'three';
import { categoryColors, reagentIds, reagents, type ReagentId } from '../chemistry/reagents';

const COLS = 4, ROWS = 8, CELL_W = 256, CELL_H = 128;
let atlas: THREE.CanvasTexture | null = null;
/** One shared label sheet for every bottle (a single canvas upload instead of 27). */
function labelAtlas() {
  if (atlas) return atlas;
  const canvas = document.createElement('canvas'); canvas.width = COLS * CELL_W; canvas.height = ROWS * CELL_H;
  const c = canvas.getContext('2d')!;
  reagentIds.forEach((id, i) => {
    const r = reagents[id]; const x = (i % COLS) * CELL_W, y = Math.floor(i / COLS) * CELL_H;
    c.fillStyle = '#fbfaf4'; c.fillRect(x, y, CELL_W, CELL_H);
    c.fillStyle = categoryColors[r.category]; c.fillRect(x, y, CELL_W, 24); c.fillRect(x, y + CELL_H - 8, CELL_W, 8);
    c.fillStyle = '#ffffff'; c.font = 'bold 15px Arial'; c.textBaseline = 'middle'; c.fillText(r.category.toUpperCase(), x + 10, y + 13);
    c.fillStyle = '#14323b'; c.font = 'bold 24px Arial'; c.textBaseline = 'alphabetic';
    const words = r.name.split(' '); const lines: string[] = [''];
    for (const w of words) { const next = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${w}` : w; if (c.measureText(next).width > CELL_W - 20 && lines[lines.length - 1]) lines.push(w); else lines[lines.length - 1] = next; }
    lines.slice(0, 2).forEach((line, j) => c.fillText(line, x + 10, y + 52 + j * 26, CELL_W - 20));
    c.fillStyle = '#4b6468'; c.font = '17px Arial'; c.fillText(r.formula.split(' · ')[0], x + 10, y + 108, CELL_W - 20);
    if (['ácido', 'base', 'oxidante'].includes(r.category) || id === 'pbno3' || id === 'bacl2' || id === 'agno3') {
      c.save(); c.translate(x + CELL_W - 26, y + 82); c.rotate(Math.PI / 4); c.fillStyle = '#ffffff'; c.strokeStyle = '#d62f2f'; c.lineWidth = 4; c.fillRect(-13, -13, 26, 26); c.strokeRect(-13, -13, 26, 26); c.restore();
      c.fillStyle = '#14323b'; c.font = 'bold 18px Arial'; c.textAlign = 'center'; c.fillText('!', x + CELL_W - 26, y + 89); c.textAlign = 'left';
    }
  });
  atlas = new THREE.CanvasTexture(canvas); atlas.colorSpace = THREE.SRGBColorSpace; atlas.anisotropy = 4;
  return atlas;
}
const labelCache = new Map<ReagentId, THREE.Texture>();
function labelTexture(id: ReagentId) {
  let t = labelCache.get(id);
  if (!t) {
    const i = reagentIds.indexOf(id); t = labelAtlas().clone();
    t.repeat.set(1 / COLS, 1 / ROWS); t.offset.set((i % COLS) / COLS, 1 - (Math.floor(i / COLS) + 1) / ROWS); t.needsUpdate = true;
    labelCache.set(id, t);
  }
  return t;
}
const glassClear = { color: '#e6f3f5', transparent: true, opacity: 0.32, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05 };
const glassAmber = { color: '#8a4b12', transparent: true, opacity: 0.78, roughness: 0.1, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08 };

/** Procedural reagent container: screw-cap bottle, wide jar for solids, or dropper bottle for indicators. */
export function ReagentBottle({ id, highlighted = false, guide = false, castShadow = true, interactive = true }: { id: ReagentId; highlighted?: boolean; guide?: boolean; castShadow?: boolean; interactive?: boolean }) {
  const r = reagents[id]; const shape = r.look.shape; const cap = categoryColors[r.category];
  const glass = r.look.glass === 'amber' ? glassAmber : glassClear;
  const label = useMemo(() => labelTexture(id), [id]);
  // Aimed bottles glow teal; bottles needed by the current experiment step glow gold.
  const glow = highlighted ? '#3fc1c9' : guide ? '#ffb81c' : '#000000';
  const glowBoost = guide && !highlighted ? 2.2 : 1;
  const radius = shape === 'jar' ? 0.058 : shape === 'dropper' ? 0.036 : 0.05;
  const height = shape === 'jar' ? 0.13 : shape === 'dropper' ? 0.11 : 0.16;
  const solidContents = r.kind === 'solid';
  const fill = solidContents ? 0.07 : shape === 'dropper' ? 0.075 : 0.12;
  return <group userData={interactive ? { interactive: `reagent:${id}` } : undefined} scale={highlighted || guide ? 1.07 : 1}>
    <mesh position={[0, height / 2, 0]} castShadow={castShadow}><cylinderGeometry args={[radius, radius, height, 24, 1, true]}/><meshPhysicalMaterial {...glass} side={THREE.DoubleSide} emissive={glow} emissiveIntensity={0.35 * glowBoost}/></mesh>
    <mesh position={[0, 0.004, 0]}><cylinderGeometry args={[radius, radius, 0.008, 24]}/><meshPhysicalMaterial {...glass}/></mesh>
    <mesh position={[0, fill / 2 + 0.008, 0]}><cylinderGeometry args={[radius * 0.9, radius * 0.9, fill, 20]}/>
      {solidContents ? <meshStandardMaterial color={r.look.contents} roughness={r.category === 'metal' ? 0.35 : 0.95} metalness={r.category === 'metal' ? 0.7 : 0}/> : <meshStandardMaterial color={r.look.contents} transparent opacity={r.kind === 'water' ? 0.35 : 0.82} roughness={0.15}/>}
    </mesh>
    {shape === 'bottle' && <>
      <mesh position={[0, height + 0.015, 0]}><cylinderGeometry args={[0.022, radius, 0.03, 20, 1, true]}/><meshPhysicalMaterial {...glass} side={THREE.DoubleSide}/></mesh>
      <mesh position={[0, height + 0.045, 0]} castShadow={castShadow}><cylinderGeometry args={[0.026, 0.026, 0.04, 16]}/><meshStandardMaterial color={cap} roughness={0.45} emissive={glow} emissiveIntensity={0.5 * glowBoost}/></mesh>
    </>}
    {shape === 'jar' && <mesh position={[0, height + 0.017, 0]} castShadow={castShadow}><cylinderGeometry args={[radius + 0.003, radius + 0.003, 0.034, 24]}/><meshStandardMaterial color={cap} roughness={0.45} emissive={glow} emissiveIntensity={0.5 * glowBoost}/></mesh>}
    {shape === 'dropper' && <>
      <mesh position={[0, height + 0.012, 0]}><cylinderGeometry args={[0.024, 0.024, 0.024, 16]}/><meshStandardMaterial color="#1f2629" roughness={0.5}/></mesh>
      <mesh position={[0, height + 0.045, 0]} scale={[1, 1.45, 1]} castShadow={castShadow}><sphereGeometry args={[0.02, 14, 10]}/><meshStandardMaterial color={cap} roughness={0.6} emissive={glow} emissiveIntensity={0.5 * glowBoost}/></mesh>
    </>}
    <mesh position={[0, shape === 'bottle' ? 0.085 : shape === 'jar' ? 0.065 : 0.055, radius + 0.0015]}><planeGeometry args={[radius * 1.7, radius * 0.9]}/><meshStandardMaterial map={label} roughness={0.7} emissive={glow} emissiveIntensity={0.15}/></mesh>
  </group>;
}
