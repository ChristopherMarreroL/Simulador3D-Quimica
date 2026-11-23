import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import * as THREE from 'three';
import { reagentIds, shelfRows, type ReagentId } from '../chemistry/reagents';
import { recipeById } from '../experiments/hoodRecipes';
import { recipeSteps, HOOD_TRAY_SLOTS, useHood } from '../state/hood';
import { useLab } from '../state/lab';
import { HOOD, traySlot } from './FumeHood';
import { FLASK_XZ, TOOLS } from './HoodTools';
import { SHELF, slotX } from './ReagentShelf';
import { Sign } from './Models';
import { materials } from './materials';
import { ContactShadow } from './RoomShell';

/** Protective equipment station by the entrance (front wall, faces into the room). */
export const PPE = { x: -0.75, z: 4.94 };
const ppeWorld = { 'ppe-goggles': [PPE.x + 0.16, 1.48, PPE.z - 0.06], 'ppe-gloves': [PPE.x - 0.16, 1.4, PPE.z - 0.09] } as const;
/** Experiment board on the right wall, beside the fume hood. */
export const BOARD = { x: 5.935, z: -2.12 };

export function PpeStation() {
  const ppe = useLab(s => s.ppe);
  const strap = useMemo(() => new THREE.TorusGeometry(0.075, 0.006, 6, 24, Math.PI), []);
  return <group position={[PPE.x, 0, PPE.z]} rotation={[0, Math.PI, 0]}>
    <mesh position={[0, 1.5, 0.01]} material={materials.laminate}><boxGeometry args={[0.7, 0.62, 0.02]}/></mesh>
    <Sign text="EQUIPO DE PROTECCIÓN" position={[0, 1.76, 0.022]} width={0.62} height={0.07} dark/>
    {/* Safety goggles on a hook. */}
    <group position={[-0.16, 1.48, 0.06]} userData={{ interactive: 'ppe-goggles' }}>
      <mesh position={[0, 0.07, -0.02]} rotation={[Math.PI / 2, 0, 0]} material={materials.steel}><cylinderGeometry args={[0.005, 0.005, 0.05, 6]}/></mesh>
      <mesh position={[0, 0.0, -0.04]} geometry={strap}><meshStandardMaterial color="#2f3640" roughness={0.85}/></mesh>
      <group visible={!ppe.goggles}>
        <mesh position={[0, -0.03, -0.045]}><cylinderGeometry args={[0.085, 0.085, 0.05, 24, 1, true, -0.75, 1.5]}/><meshPhysicalMaterial color="#e4f3f6" transparent opacity={0.45} roughness={0.04} clearcoat={1} side={THREE.DoubleSide}/></mesh>
        {[-0.005, -0.055].map(y => <mesh key={y} position={[0, y, -0.045]} rotation={[Math.PI / 2, 0, Math.PI / 2 - 0.75]}><torusGeometry args={[0.086, 0.005, 6, 20, 1.5]}/><meshStandardMaterial color="#2d6f9e" roughness={0.55}/></mesh>)}
      </group>
    </group>
    {/* Nitrile glove dispenser (three sizes). */}
    <group position={[0.16, 1.4, 0.09]} userData={{ interactive: 'ppe-gloves' }}>
      <mesh material={materials.plasticWhite}><boxGeometry args={[0.24, 0.3, 0.14]}/></mesh>
      {[-0.09, 0, 0.09].map((y, i) => <group key={y} position={[0, y, 0.071]}>
        <mesh><boxGeometry args={[0.2, 0.075, 0.005]}/><meshStandardMaterial color={['#4f7fd8', '#3c6ac6', '#2f58a8'][i]} roughness={0.6}/></mesh>
        <mesh position={[0, 0.005, 0.003]}><boxGeometry args={[0.08, 0.02, 0.004]}/><meshStandardMaterial color="#1b2230"/></mesh>
        {!ppe.gloves && <mesh position={[0.01, 0.018, 0.012]} rotation={[0.3, 0, 0.2]}><boxGeometry args={[0.04, 0.03, 0.01]}/><meshStandardMaterial color="#7aa0e8" roughness={0.5}/></mesh>}
      </group>)}
      <Sign text="S · M · L" position={[0, 0.17, 0.071]} width={0.12} height={0.03}/>
    </group>
    <ContactShadow position={[0, 0.003, -0.2]} size={[0.9, 0.4]} opacity={0.25}/>
  </group>;
}

/** Wall board listing the hood experiments; when one is selected it shows the procedure with check marks. */
export function RecipeBoard() {
  const recipe = useHood(s => s.recipe);
  const state = useHood(useShallow(s => ({ places: s.places, cylinder: s.cylinder, balance: s.balance, mixture: s.mixture })));
  const ppe = useLab(s => s.ppe);
  const def = recipeById(recipe?.id);
  const steps = def && recipe ? recipeSteps(def, recipe, state, ppe) : null;
  const signature = steps ? steps.map(s => `${s.key}:${s.done}`).join('|') : 'none';
  const { canvas, texture } = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 640; c.height = 800;
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return { canvas: c, texture: t };
  }, []);
  useEffect(() => {
    const c = canvas.getContext('2d')!; c.fillStyle = '#f7f8f3'; c.fillRect(0, 0, 640, 800);
    c.fillStyle = '#143e49'; c.fillRect(0, 0, 640, 96); c.fillStyle = '#ffffff'; c.font = 'bold 34px Arial'; c.fillText('EXPERIMENTOS · CAMPANA', 30, 50);
    c.font = '22px Arial'; c.fillStyle = '#bfe3e0'; c.fillText('Apunta aquí y pulsa E para elegir', 30, 82);
    if (!def || !steps) {
      c.fillStyle = '#143e49'; c.font = 'bold 28px Arial'; c.fillText('16 prácticas guiadas', 30, 150);
      c.font = '23px Arial'; c.fillStyle = '#3d5a5e';
      ['Neutralización con indicador', 'Vinagre y bicarbonato', 'Lluvia de oro (PbI₂)', 'Prueba de cloruros (AgCl)', 'Hidróxido de cobre azul', 'Descomposición del peróxido', 'El cinc desplaza al cobre', 'Árbol de plata', 'Yodo y almidón', 'Disoluciones que enfrían y calientan', '… y más'].forEach((t, i) => c.fillText(`•  ${t}`, 36, 200 + i * 42));
      c.fillStyle = '#8a6c38'; c.font = '21px Arial'; c.fillText('Las flechas doradas te indican qué recoger.', 30, 700); c.fillText('Mide con la probeta, pesa en la balanza.', 30, 732);
    } else {
      c.fillStyle = '#143e49'; c.font = 'bold 30px Arial'; c.fillText(def.title, 30, 145, 580);
      c.font = '22px Arial'; c.fillStyle = '#3d5a5e'; c.fillText(def.equation, 30, 182, 580);
      const current = steps.findIndex(s => !s.done);
      steps.forEach((st, i) => {
        const y = 230 + i * 50; c.fillStyle = st.done ? '#2fa36b' : i === current ? '#f2c14e' : '#c9d4d1';
        c.beginPath(); c.arc(46, y - 8, 14, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#ffffff'; c.font = 'bold 18px Arial'; c.textAlign = 'center'; c.fillText(st.done ? '✓' : String(i + 1), 46, y - 2); c.textAlign = 'left';
        c.fillStyle = st.done ? '#6d8784' : '#143e49'; c.font = `${i === current ? 'bold ' : ''}21px Arial`; c.fillText(st.title, 72, y, 540);
      });
      if (current < 0) { c.fillStyle = '#2fa36b'; c.font = 'bold 28px Arial'; c.fillText('¡Experimento completado!', 30, 760); }
    }
    texture.needsUpdate = true;
  }, [signature, def, canvas, texture]);
  return <group position={[BOARD.x, 0, BOARD.z]} rotation={[0, -Math.PI / 2, 0]} userData={{ interactive: 'recipe-board' }}>
    <mesh position={[0, 1.68, 0.012]} material={materials.aluminium}><boxGeometry args={[0.84, 1.04, 0.02]}/></mesh>
    <mesh position={[0, 1.68, 0.024]}><planeGeometry args={[0.8, 1.0]}/><meshStandardMaterial map={texture} roughness={0.85}/></mesh>
  </group>;
}

/** World position above each guide target (bottle wherever it is, tools, flask, waste, PPE). */
function targetPosition(id: string, places: Record<ReagentId, string>): [number, number, number] | null {
  const hood = (x: number, z: number, y: number): [number, number, number] => [HOOD.x + x, y, HOOD.z + z];
  if (id in ppeWorld) { const p = ppeWorld[id as keyof typeof ppeWorld]; return [p[0], p[1] + 0.28, p[2]]; }
  if (id === 'hood') return hood(FLASK_XZ[0], FLASK_XZ[1], 1.68);
  if (id === 'hood-cylinder') return hood(TOOLS.cylinder[0], TOOLS.cylinder[1], 1.6);
  if (id === 'hood-balance') return hood(TOOLS.balance[0], TOOLS.balance[1], 1.45);
  if (id === 'hood-waste') return hood(TOOLS.waste[0], TOOLS.waste[1], 1.6);
  if (id === 'hood-washbottle') return hood(TOOLS.washbottle[0], TOOLS.washbottle[1], 1.52);
  if (id.startsWith('reagent:')) {
    const rid = id.slice(8) as ReagentId; const place = places[rid];
    if (place === 'hood') { const i = reagentIds.filter(r => places[r] === 'hood').slice(0, HOOD_TRAY_SLOTS).indexOf(rid); const t = traySlot(Math.max(0, i)); return hood(t[0], t[2], 1.55); }
    if (place !== 'shelf') return null;
    const row = shelfRows.findIndex(r => r.includes(rid)); const col = shelfRows[row].indexOf(rid);
    // In front of the bottle, between its cap and the shelf above, so it never covers a label.
    return [SHELF.x + slotX(col), [1.82, 1.42, 1.02, 0.62][row] + 0.31, SHELF.z + 0.24];
  }
  return null;
}
function Arrow({ position, label, index }: { position: [number, number, number]; label: string; index: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (ref.current) ref.current.position.y = position[1] + Math.sin(clock.elapsedTime * 2.4 + index) * 0.035; });
  return <group ref={ref} position={position} userData={{ ignoreRay: true }}>
    <mesh rotation={[0, 0, Math.PI]}><coneGeometry args={[0.03, 0.07, 4]}/><meshBasicMaterial color="#f2c14e" toneMapped={false}/></mesh>
    {label && <Sign text={label} position={[0, 0.07, 0]} width={Math.min(0.34, 0.06 + label.length * 0.011)} height={0.042} dark/>}
  </group>;
}
/** Targets of the current step of the selected experiment (empty when none is running). */
export function useGuideTargets() {
  const recipe = useHood(s => s.recipe);
  const state = useHood(useShallow(s => ({ places: s.places, cylinder: s.cylinder, balance: s.balance, mixture: s.mixture })));
  const ppe = useLab(s => s.ppe); const mode = useLab(s => s.mode);
  const def = recipeById(recipe?.id);
  if (!def || !recipe || !mode || mode === 'tutorial') return { targets: [] as { id: string; label: string }[], places: state.places };
  return { targets: recipeSteps(def, recipe, state, ppe).find(s => !s.done)?.targets ?? [], places: state.places };
}
/** Golden arrows over everything the current step needs; bottles on the shelf also glow. */
export function RecipeArrows() {
  const { targets, places } = useGuideTargets();
  return <>{targets.map((t, i) => { const p = targetPosition(t.id, places); const onShelf = t.id.startsWith('reagent:') && places[t.id.slice(8) as ReagentId] === 'shelf'; return p && <Arrow key={t.id} position={p} label={onShelf ? '' : t.label} index={i}/>; })}</>;
}
