'use client';
import { useEffect, useState } from 'react';

export const TIER_ORDER = ['high', 'medium', 'low'];

/** Rendering budget per tier. Thin-film 'fire' on stones is high-only. */
export const TIERS = {
  high: { dprMax: 2, fire: true, shadows: true, shadowRes: 1024, antialias: true, envRes: 256, segments: 'full' },
  medium: { dprMax: 1.5, fire: false, shadows: true, shadowRes: 512, antialias: true, envRes: 128, segments: 'full' },
  low: { dprMax: 1, fire: false, shadows: false, shadowRes: 0, antialias: false, envRes: 64, segments: 'low' },
};

export function supportsWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}

/** Heuristic first guess; PerformanceMonitor then downgrades at runtime if frames drop. */
export function detectTier() {
  if (typeof window === 'undefined') return 'medium';
  const nav = navigator;
  const coarse = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|Mobile/i.test(nav.userAgent);
  const mem = nav.deviceMemory ?? (coarse ? 3 : 8);
  const cores = nav.hardwareConcurrency ?? 4;
  let weakGpu = false;
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    const r = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    weakGpu = /SwiftShader|llvmpipe|software|Mali-[T4]\d|PowerVR|Adreno \(TM\) [2-4]\d\d/i.test(r);
  } catch {}
  if (nav.connection?.saveData || weakGpu || mem <= 2 || cores <= 2) return 'low';
  if (coarse || mem <= 4 || cores <= 4) return 'medium';
  return 'high';
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const q = matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(q.matches);
    const on = (e) => setReduced(e.matches);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  return reduced;
}
