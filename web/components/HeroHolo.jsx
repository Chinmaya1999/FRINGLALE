'use client';
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { api } from '@/lib/api';
import { useCatalog } from '@/lib/hooks';
import { defaultConfig } from '@/lib/config';
import { buildViewerItem } from '@/lib/viewerItem';
import { detectTier, supportsWebGL, useReducedMotion } from './studio/quality';

const JewelScene = dynamic(() => import('./studio/JewelScene'), { ssr: false });

/** Auto-rotating hologram of a featured design for the home hero. Falls back to the product photo without WebGL. */
export default function HeroHolo({ slug = 'celestia-halo-ring', mode = 'holo' }) {
  const catalog = useCatalog();
  const reduced = useReducedMotion();
  const [design, setDesign] = useState(null);
  const [gl, setGl] = useState(null);
  const [tier, setTier] = useState('medium');
  useEffect(() => { setGl(supportsWebGL()); setTier(detectTier()); api(`/designs/${slug}`).then((r) => setDesign(r.design)).catch(() => {}); }, [slug]);
  const items = useMemo(() => {
    if (!design || !catalog) return [];
    const c = defaultConfig(design, catalog.matrix);
    const it = buildViewerItem({ design, config: { ...c, metal: mode === 'gold' ? 'yellow-18K' : c.metal, stoneType: 'natural-diamond', shape: 'round' }, support: null, metals: catalog.metals, stones: catalog.stones });
    if (mode === 'gold' && typeof window !== 'undefined' && innerWidth < 700) it.fit = 1.3;   // phones: pull back so the ring fits its narrow stage
    return [it];
  }, [design, catalog, mode]);
  if (gl === false || (design && !items.length && catalog?.error)) return design?.images?.[0] ? <img src={design.images[0]} alt={design.name} className="h-full w-full object-cover" /> : null;
  if (!items.length) return <div className="h-full w-full animate-pulse" aria-hidden="true" />;
  return <JewelScene items={items} tier={tier === 'high' ? 'medium' : tier} exploded={false} highlight={null} showMeasure={false} autoRotate hologram={mode === 'holo'} reduced={reduced} preset="angle" />;
}
