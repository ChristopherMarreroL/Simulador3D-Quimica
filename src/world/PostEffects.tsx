import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

/**
 * Ultra quality: ground-truth ambient occlusion (soft contact darkening in corners and under objects),
 * a subtle bloom on windows and lamps, and 4× multisampled HDR rendering before tone mapping.
 * Taking over the frame with priority 1 replaces R3F's default render.
 */
export function PostEffects() {
  const { gl, scene, camera, size, viewport } = useThree();
  const composer = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    const c = new EffectComposer(gl, target);
    c.addPass(new RenderPass(scene, camera));
    const ao = new GTAOPass(scene, camera, 1, 1);
    ao.output = GTAOPass.OUTPUT.Default;
    ao.blendIntensity = 0.9;
    ao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: 8 });
    ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 8 });
    // Ambient occlusion is computed at half resolution and blended at full resolution.
    const setAoSize = ao.setSize.bind(ao); ao.setSize = (w: number, h: number) => setAoSize(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2)));
    c.addPass(ao);
    // The scene is linear HDR here: only emitters brighter than any lit wall (lamps ≈ 3) cross the threshold.
    c.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.22, 0.45, 1.8));
    c.addPass(new OutputPass());
    return c;
  }, [gl, scene, camera]);
  useEffect(() => { composer.setPixelRatio(viewport.dpr); composer.setSize(size.width, size.height); }, [composer, size.width, size.height, viewport.dpr]);
  // The composed image is tone-mapped once at the end: a slightly lower exposure keeps the white walls from washing out.
  useEffect(() => { const prev = gl.toneMappingExposure; gl.toneMappingExposure = 0.93; return () => { gl.toneMappingExposure = prev; }; }, [gl]);
  // Refractive glass samples a half-resolution copy of the scene.
  useEffect(() => { const r = gl as THREE.WebGLRenderer & { transmissionResolutionScale?: number }; const prev = r.transmissionResolutionScale ?? 1; r.transmissionResolutionScale = 0.5; return () => { r.transmissionResolutionScale = prev; }; }, [gl]);
  useEffect(() => () => { composer.passes.forEach(p => (p as { dispose?: () => void }).dispose?.()); composer.dispose(); }, [composer]);
  useFrame((_, delta) => { composer.render(delta); }, 1);
  return null;
}
