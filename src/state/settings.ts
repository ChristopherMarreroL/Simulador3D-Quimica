import { create } from 'zustand';

/**
 * Per-browser preferences (`experimenta.settings.v1`): graphics quality, mouse sensitivity and FPS readout.
 * Ultra adds ambient occlusion, bloom, refractive glass, 4K shadows and up to 2× resolution; it is the
 * default in the desktop app. While `auto` is true the app may step quality down if the frame rate is low.
 */
export type Quality = 'media' | 'alta' | 'ultra';
interface Prefs { quality: Quality; sensitivity: number; showFps: boolean; auto: boolean }
interface SettingsState extends Prefs {
  setQuality: (q: Quality, manual?: boolean) => void; setSensitivity: (v: number) => void; setShowFps: (v: boolean) => void;
}
const KEY = 'experimenta.settings.v1';
export const isDesktopApp = typeof navigator !== 'undefined' && /Electron/i.test(navigator.userAgent);
function load(): Prefs {
  const fallback: Prefs = { quality: isDesktopApp ? 'ultra' : 'alta', sensitivity: 1, showFps: false, auto: true };
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      quality: ['media', 'alta', 'ultra'].includes(d.quality) ? d.quality : fallback.quality,
      sensitivity: Number.isFinite(d.sensitivity) ? Math.min(2, Math.max(0.4, d.sensitivity)) : 1,
      showFps: d.showFps === true, auto: d.auto !== false,
    };
  } catch { return fallback; }
}
export const useSettings = create<SettingsState>((set, get) => {
  const save = () => { const { quality, sensitivity, showFps, auto } = get(); try { localStorage.setItem(KEY, JSON.stringify({ quality, sensitivity, showFps, auto })); } catch { /* Session only. */ } };
  return {
    ...load(),
    setQuality: (quality, manual = true) => { set({ quality, ...(manual ? { auto: false } : {}) }); save(); },
    setSensitivity: v => { set({ sensitivity: Math.min(2, Math.max(0.4, v)) }); save(); },
    setShowFps: showFps => { set({ showFps }); save(); },
  };
});
