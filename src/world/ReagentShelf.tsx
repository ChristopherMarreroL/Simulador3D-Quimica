import { useMemo } from 'react';
import * as THREE from 'three';
import { shelfRows } from '../chemistry/reagents';
import { indicatorColor } from '../chemistry/sandbox';
import { useHood } from '../state/hood';
import { useLab } from '../state/lab';
import { Box, Sign } from './Models';
import { ReagentBottle } from './ReagentBottle';
import { useGuideTargets } from './GuideProps';

/** Designed position (not measured): back wall, between the periodic table and the fume hood. */
export const SHELF = { x: 3.3, z: -4.72, w: 1.12, d: 0.44 };
const rowHeights = [1.82, 1.42, 1.02, 0.62];
const rowTitles = ['INDICADORES · OXIDANTES', 'ÁCIDOS · BASES · CARBONATOS', 'SALES EN DISOLUCIÓN', 'SÓLIDOS Y METALES'];
const rowColors = ['#e0559d', '#e0483a', '#2fa36b', '#7f8c99'];
export const slotX = (j: number) => -0.435 + j * 0.145;

function PhPoster() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 512;
    const c = canvas.getContext('2d')!;
    c.fillStyle = '#f7f8f2'; c.fillRect(0, 0, 1024, 512);
    c.fillStyle = '#143e49'; c.font = 'bold 54px Arial'; c.fillText('ESCALA DE pH', 48, 86);
    c.font = '28px Arial'; c.fillStyle = '#4b6468'; c.fillText('Colores del indicador universal (aproximados)', 48, 130);
    for (let p = 0; p <= 14; p++) {
      const x = 48 + p * 62.5; c.fillStyle = indicatorColor('universal', p)!.color; c.fillRect(x, 175, 58, 190);
      c.fillStyle = p < 3 || p > 9 ? '#ffffff' : '#143e49'; c.font = 'bold 34px Arial'; c.textAlign = 'center'; c.fillText(String(p), x + 29, 285); c.textAlign = 'left';
    }
    c.fillStyle = '#143e49'; c.font = 'bold 30px Arial'; c.fillText('ÁCIDO', 48, 420); c.textAlign = 'center'; c.fillText('NEUTRO', 512, 420); c.textAlign = 'right'; c.fillText('BÁSICO', 976, 420);
    c.textAlign = 'left'; c.font = '24px Arial'; c.fillStyle = '#4b6468'; c.fillText('Fenolftaleína: rosa a partir de pH ≈ 8,2 · Azul de bromotimol: amarillo < 6,0 < azul 7,6', 48, 470);
    const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, []);
  return <mesh position={[0, 2.78, -0.205]}><planeGeometry args={[1.1, 0.55]}/><meshStandardMaterial map={texture} roughness={0.8}/></mesh>;
}

/** Decorative rack of test tubes coloured with the same indicator scale used by the model. */
function PhRack() {
  return <group position={[0, 2.235, 0.02]}>
    <Box position={[0, 0.02, 0]} size={[1.02, 0.04, 0.08]} color="#d9e2df"/>
    <Box position={[0, 0.085, 0]} size={[1.02, 0.012, 0.08]} color="#d9e2df"/>
    {Array.from({ length: 14 }, (_, i) => <group key={i} position={[-0.47 + i * 0.0723, 0.02, 0]}>
      <mesh position={[0, 0.06, 0]}><cylinderGeometry args={[0.012, 0.012, 0.12, 12, 1, true]}/><meshPhysicalMaterial color="#eef7f8" transparent opacity={0.3} roughness={0.05} side={THREE.DoubleSide}/></mesh>
      <mesh position={[0, 0.04, 0]}><cylinderGeometry args={[0.0105, 0.0105, 0.075, 10]}/><meshStandardMaterial color={indicatorColor('universal', i + 1)!.color} roughness={0.2} emissive={indicatorColor('universal', i + 1)!.color} emissiveIntensity={0.12}/></mesh>
    </group>)}
  </group>;
}

export function ReagentShelf() {
  const places = useHood(s => s.places); const target = useLab(s => s.target);
  const guided = new Set(useGuideTargets().targets.map(t => t.id));
  const frame = 'reagent-shelf';
  return <group position={[SHELF.x, 0, SHELF.z]}>
    <Box position={[0, 1.2, -0.2]} size={[SHELF.w, 2.3, 0.02]} color="#e7ece9" interactive={frame}/>
    {[-1, 1].map(side => <Box key={side} position={[side * (SHELF.w / 2 - 0.02), 1.17, 0]} size={[0.04, 2.34, SHELF.d]} color="#46606a" interactive={frame}/>)}
    {[0.22, ...rowHeights, 2.22].map(y => <Box key={y} position={[0, y, 0]} size={[SHELF.w - 0.06, 0.025, SHELF.d - 0.02]} color="#f2f4f0" interactive={frame}/>)}
    <Box position={[0, 0.1, 0.19]} size={[SHELF.w - 0.06, 0.2, 0.02]} color="#46606a"/>
    {rowHeights.map((y, i) => <group key={y}>
      <Box position={[0, y - 0.02, SHELF.d / 2 - 0.005]} size={[SHELF.w - 0.06, 0.035, 0.012]} color={rowColors[i]}/>
      <Sign text={rowTitles[i]} position={[0, y - 0.02, SHELF.d / 2 + 0.002]} width={0.62} height={0.032} dark/>
    </group>)}
    {shelfRows.map((row, i) => row.map((id, j) => places[id] === 'shelf' && <group key={id} position={[slotX(j), rowHeights[i] + 0.0125, 0.04]}>
      <ReagentBottle id={id} highlighted={target === `reagent:${id}`} guide={guided.has(`reagent:${id}`)}/>
    </group>))}
    <PhRack/>
    <Sign text="REACTIVOS · E RECOGER / Q DEVOLVER" position={[0, 2.43, 0.05]} width={1.06} height={0.1} dark/>
    <PhPoster/>
  </group>;
}
