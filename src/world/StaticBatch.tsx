import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Layer used to park the original meshes: neither rendered by the camera nor hit by the raycaster. */
const PARKED = 31;
type Std = THREE.MeshStandardMaterial & Partial<THREE.MeshPhysicalMaterial>;
/** Visual signature: equal-looking inline materials share one merged mesh. */
function signature(m: THREE.Material) {
  const s = m as Std & { color?: THREE.Color; map?: THREE.Texture | null };
  return [m.type, s.color?.getHexString(), s.roughness, s.metalness, s.opacity, m.transparent, s.map?.uuid, s.emissive?.getHexString(), s.emissiveIntensity, m.side, s.clearcoat, m.depthWrite, s.normalMap?.uuid, s.alphaMap?.uuid, s.envMapIntensity, m.toneMapped].join('|');
}
/**
 * Merges the static, non-interactive meshes of its children into one mesh per look (material + shadow
 * flags) once they mount. Thousands of tiny props otherwise cost one draw call each. Children must not
 * change after mounting and must not carry `userData.interactive`.
 */
export function StaticBatch({ children }: { children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const [merged, setMerged] = useState<THREE.Mesh[]>([]);
  useLayoutEffect(() => {
    const root = group.current; if (!root) return;
    root.updateWorldMatrix(true, true);
    const inverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const buckets = new Map<string, { material: THREE.Material; cast: boolean; receive: boolean; geometries: THREE.BufferGeometry[]; renderOrder: number }>();
    const parked: THREE.Mesh[] = [];
    root.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || Array.isArray(mesh.material) || mesh.userData.batched || !mesh.visible || !mesh.layers.isEnabled(0)) return;
      let geometry = mesh.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld));
      if (geometry.index) geometry = geometry.toNonIndexed();
      for (const name of Object.keys(geometry.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geometry.deleteAttribute(name);
      if (!geometry.attributes.normal) geometry.computeVertexNormals();
      if (!geometry.attributes.uv) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count * 2), 2));
      const key = `${signature(mesh.material)}|${mesh.castShadow}|${mesh.receiveShadow}|${mesh.renderOrder}`;
      const bucket = buckets.get(key) ?? { material: mesh.material, cast: mesh.castShadow, receive: mesh.receiveShadow, geometries: [], renderOrder: mesh.renderOrder };
      bucket.geometries.push(geometry); buckets.set(key, bucket); parked.push(mesh);
    });
    const meshes = [...buckets.values()].map(b => {
      const mesh = new THREE.Mesh(mergeGeometries(b.geometries, false) ?? b.geometries[0], b.material);
      mesh.castShadow = b.cast; mesh.receiveShadow = b.receive; mesh.renderOrder = b.renderOrder; mesh.userData.batched = true;
      b.geometries.forEach(g => g.dispose());
      return mesh;
    });
    for (const mesh of parked) mesh.layers.set(PARKED);
    setMerged(meshes);
    return () => { meshes.forEach(m => m.geometry.dispose()); for (const mesh of parked) mesh.layers.set(0); };
  }, []);
  return <group ref={group}>{children}{merged.map(m => <primitive key={m.uuid} object={m}/>)}</group>;
}
