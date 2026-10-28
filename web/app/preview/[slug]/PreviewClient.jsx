'use client';
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { api } from '@/lib/api';
import { useCatalog, useQuote } from '@/lib/hooks';
import { defaultConfig } from '@/lib/config';
import { buildViewerItem } from '@/lib/viewerItem';

const JewelScene = dynamic(() => import('@/components/studio/JewelScene'), { ssr: false });

/** Bare 3D render of one design, used to capture catalogue thumbnails (scripts/capture-thumbnails.mjs). */
export default function PreviewClient({ slug }) {
  const catalog = useCatalog();
  const [design, setDesign] = useState(null);
  useEffect(() => { api(`/designs/${slug}`).then((r) => setDesign(r.design)); }, [slug]);
  const config = useMemo(() => (design && catalog ? { ...defaultConfig(design, catalog.matrix), metal: design.allowedMetals.includes('yellow-18K') ? 'yellow-18K' : design.allowedMetals[0], stoneType: design.allowedStoneTypes.length ? 'natural-diamond' : undefined, shape: design.allowedShapes?.[0] ? (design.allowedShapes.includes('round') ? 'round' : design.allowedShapes[0]) : undefined } : null), [design, catalog]);
  const { quote } = useQuote(slug, config, !!config);
  const items = useMemo(() => (design && config && quote ? [{ ...buildViewerItem({ design, config, support: quote.support, metals: catalog.metals, stones: catalog.stones }), capture: true }] : []), [design, config, quote, catalog]);
  const [ready, setReady] = useState(false);
  useEffect(() => { if (items.length) { const t = setTimeout(() => setReady(true), 3500); return () => clearTimeout(t); } }, [items.length]);
  return (
    <div id="shot" data-ready={ready} style={{ width: 800, height: 800, background: 'radial-gradient(ellipse at 50% 40%, #4a3510 0%, #17110a 52%, #050403 100%)' }}>
      {items.length > 0 && <JewelScene items={items} tier="high" exploded={false} highlight={null} showMeasure={false} autoRotate={false} reduced hologram={false} preset="angle" />}
    </div>
  );
}
