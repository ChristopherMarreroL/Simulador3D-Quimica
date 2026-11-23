import { useMemo } from 'react';
import * as THREE from 'three';
import { glass } from './materials';
import { items, type ItemId } from '../experiments/definitions';
import { periodicRows, symbols } from '../experiments/periodic';
export function PeriodicPoster() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1440; canvas.height = 720;
    const c = canvas.getContext('2d')!; c.fillStyle = '#f1f6ee'; c.fillRect(0, 0, 1440, 720);
    periodicRows.forEach((row, y) => row.forEach((n, x) => {
      if (!n) return;
      c.fillStyle = [1, 6, 8, 11].includes(n) ? '#cfac63' : '#74a3a5'; c.fillRect(x * 80 + 3, y * 80 + 3, 74, 74);
      c.fillStyle = '#143e49'; c.font = '16px Arial'; c.fillText(String(n), x * 80 + 8, y * 80 + 22);
      c.font = 'bold 31px Arial'; c.fillText(symbols[n - 1], x * 80 + 10, y * 80 + 58);
    }));
    const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, []);
  return <mesh position={[1.6, 1.94, -4.855]} userData={{ interactive: 'periodic' }}><planeGeometry args={[2.1, 0.82]}/><meshBasicMaterial map={texture}/></mesh>;
}
export function Sign({ text, position, width = 1.5, height = 0.35, dark = false, rotation = [0, 0, 0] }: { text: string; position: [number, number, number]; width?: number; height?: number; dark?: boolean; rotation?: [number, number, number] }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
    const c = canvas.getContext('2d')!; c.fillStyle = dark ? '#143e49' : '#edf4f3'; c.fillRect(0, 0, 1024, 256);
    c.fillStyle = dark ? '#f4fbf7' : '#143e49'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '600 68px Arial'; c.fillText(text, 512, 134, 960);
    const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, [text, dark]);
  return <mesh position={position} rotation={rotation}><planeGeometry args={[width, height]}/><meshBasicMaterial map={texture} side={THREE.DoubleSide}/></mesh>;
}
export function Box({ position, size, color = '#e1e8e5', interactive }: { position: [number, number, number]; size: [number, number, number]; color?: string; interactive?: string }) {
  return <mesh position={position} castShadow receiveShadow userData={{ interactive }}><boxGeometry args={size}/><meshStandardMaterial color={color} roughness={0.65}/></mesh>;
}
const amberGlass = new THREE.MeshPhysicalMaterial({ color: '#7a4314', transparent: true, opacity: 0.82, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05 });
const hdpeWhite = new THREE.MeshStandardMaterial({ color: '#f4f3ee', roughness: 0.55 });
const beakerGlass = glass.lab;
/** Practice-01 containers: a 250 mL beaker (drawn at the scene's demonstration scale), an amber vinegar jug and a baking-soda jar. */
export function Instrument({ id, highlighted = false, liquid = 0, castShadow = true }: { id: ItemId; highlighted?: boolean; liquid?: number; castShadow?: boolean }) {
  const glow = highlighted ? '#3fc1c9' : '#000000';
  if (id === 'beaker') return <group userData={{ interactive: id }}>
    <mesh position={[0, 0.19, 0]} castShadow={castShadow} material={beakerGlass}><cylinderGeometry args={[0.145, 0.135, 0.38, 40, 1, true]}/></mesh>
    <mesh position={[0, 0.006, 0]} material={beakerGlass}><cylinderGeometry args={[0.135, 0.135, 0.012, 40]}/></mesh>
    <mesh position={[0, 0.38, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.145, 0.006, 8, 40]}/><meshPhysicalMaterial color="#eaf6f8" roughness={0.05} clearcoat={1} emissive={glow} emissiveIntensity={0.6}/></mesh>
    <mesh position={[0.145, 0.375, 0]} rotation={[0, 0, -0.5]}><boxGeometry args={[0.02, 0.012, 0.035]}/><meshPhysicalMaterial color="#eaf6f8" transparent opacity={0.5}/></mesh>
    {[0.09, 0.15, 0.21, 0.27, 0.33].map((y, i) => <mesh key={y} position={[0.03, y, 0.1405]}><planeGeometry args={[i % 2 ? 0.035 : 0.06, 0.004]}/><meshBasicMaterial color="#ffffff" transparent opacity={0.85}/></mesh>)}
    {liquid > 0 && <mesh position={[0, liquid / 2 + 0.013, 0]}><cylinderGeometry args={[0.132, 0.131, liquid, 36]}/><meshPhysicalMaterial color="#e9c46f" transparent opacity={0.62} roughness={0.05} clearcoat={0.6}/></mesh>}
  </group>;
  const vinegar = id === 'vinegar';
  return <group userData={{ interactive: id }}>
    <mesh position={[0, 0.15, 0]} castShadow={castShadow} material={vinegar ? amberGlass : hdpeWhite}><cylinderGeometry args={[0.115, 0.118, 0.3, 32]}/></mesh>
    {vinegar ? <>
      <mesh position={[0, 0.13, 0]}><cylinderGeometry args={[0.105, 0.105, 0.24, 24]}/><meshStandardMaterial color="#d9a54e" transparent opacity={0.55}/></mesh>
      <mesh position={[0, 0.33, 0]} material={amberGlass}><cylinderGeometry args={[0.05, 0.115, 0.06, 32]}/></mesh>
      <mesh position={[0, 0.38, 0]} material={amberGlass}><cylinderGeometry args={[0.042, 0.048, 0.05, 24]}/></mesh>
      <mesh position={[0, 0.42, 0]}><cylinderGeometry args={[0.05, 0.05, 0.04, 24]}/><meshStandardMaterial color="#1f2326" roughness={0.45} emissive={glow} emissiveIntensity={0.6}/></mesh>
      <mesh position={[0.1, 0.3, 0]} rotation={[0, 0, 0.3]} material={amberGlass}><torusGeometry args={[0.05, 0.013, 8, 20, Math.PI * 1.2]}/></mesh>
    </> : <>
      <mesh position={[0, 0.33, 0]}><cylinderGeometry args={[0.121, 0.121, 0.06, 32]}/><meshStandardMaterial color={items[id].color} roughness={0.45} emissive={glow} emissiveIntensity={0.6}/></mesh>
      {Array.from({ length: 24 }, (_, i) => <mesh key={i} position={[Math.cos(i / 24 * Math.PI * 2) * 0.122, 0.33, Math.sin(i / 24 * Math.PI * 2) * 0.122]} rotation={[0, -i / 24 * Math.PI * 2, 0]}><boxGeometry args={[0.004, 0.05, 0.01]}/><meshStandardMaterial color={items[id].color}/></mesh>)}
    </>}
    <mesh position={[0, 0.16, 0.1175]}><planeGeometry args={[0.17, 0.13]}/><meshStandardMaterial color="#fbfaf3" roughness={0.8} emissive={glow} emissiveIntensity={0.2}/></mesh>
    <Sign text={vinegar ? 'CH₃COOH 0,83 M' : 'NaHCO₃ (s)'} position={[0, 0.18, 0.1185]} width={0.16} height={0.045}/>
    <mesh position={[0, 0.115, 0.1185]}><planeGeometry args={[0.16, 0.018]}/><meshBasicMaterial color={vinegar ? '#e0483a' : '#2f6fe0'}/></mesh>
  </group>;
}
