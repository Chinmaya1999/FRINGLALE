'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { api } from '@/lib/api';
import { useCatalog } from '@/lib/hooks';
import { defaultConfig } from '@/lib/config';
import { buildViewerItem } from '@/lib/viewerItem';
import { detectTier, supportsWebGL } from '@/components/studio/quality';
import { useMotion } from './MotionProvider';

gsap.registerPlugin(ScrollTrigger);
const JewelScene = dynamic(() => import('@/components/studio/JewelScene'), { ssr: false });

const RING_CHAPTERS = [
  ['01', 'Shape it', 'Every curve starts as your choice — halo, solitaire, eternity.'],
  ['02', 'Choose the metal', 'Yellow, rose, white gold or platinum — the ring changes as you scroll.'],
  ['03', 'Take it apart', 'See the band, the head and the stone as separate parts.'],
  ['04', 'Make it yours', 'Open the studio and the same ring is yours to edit, priced live.'],
];
const METALS = [[0, 'yellow-18K', '18K yellow gold'], [0.33, 'rose-18K', '18K rose gold'], [0.62, 'platinum-950', 'Platinum 950']];

/** Pinned, scroll-scrubbed 3D showcase: the ring spins, the camera flies in, metal changes, then it explodes into parts. */
export default function ScrollStage({ slug = 'celestia-halo-ring', label = 'Celestia Halo Ring', chapters = RING_CHAPTERS, tone = 'bg-[#260A12]' }) {
  const CHAPTERS = chapters;
  const wrap = useRef(null);
  const progress = useRef(0);
  const catalog = useCatalog();
  const { reduced } = useMotion();
  const [design, setDesign] = useState(null);
  const [gl, setGl] = useState(null);
  const [tier, setTier] = useState('medium');
  const [metalIdx, setMetalIdx] = useState(0);
  const [exploded, setExploded] = useState(false);
  const [chapter, setChapter] = useState(0);

  useEffect(() => { setGl(supportsWebGL()); setTier(detectTier()); api(`/designs/${slug}`).then((r) => setDesign(r.design)).catch(() => {}); }, [slug]);

  useEffect(() => {
    const el = wrap.current;
    if (!el || reduced) return;
    const st = ScrollTrigger.create({
      trigger: el, start: 'top top', end: 'bottom bottom',
      onUpdate: (self) => {
        const p = self.progress; progress.current = p;
        const mi = METALS.reduce((a, m, i) => (p >= m[0] ? i : a), 0);
        setMetalIdx((x) => (x === mi ? x : mi));
        setExploded((x) => { const v = p > 0.5 && p < 0.76; return x === v ? x : v; });
        setChapter((x) => { const c = Math.min(3, Math.floor(p * 4)); return x === c ? x : c; });
      },
    });
    return () => st.kill();
  }, [reduced, design]);

  const items = useMemo(() => {
    if (!design || !catalog) return [];
    const c = { ...defaultConfig(design, catalog.matrix), metal: METALS[metalIdx][1], stoneType: 'natural-diamond', shape: 'round' };
    return [buildViewerItem({ design, config: c, support: null, metals: catalog.metals, stones: catalog.stones })];
  }, [design, catalog, metalIdx]);

  // No WebGL / reduced motion: a calm static version with the same content.
  const staticMode = reduced || gl === false;

  return (
    <section ref={wrap} className={`relative ${tone} text-[#f3eadb]`} style={{ height: staticMode ? 'auto' : '460vh' }} aria-label={`Scroll through the ${label}`}>
      <div className={staticMode ? 'mx-auto grid max-w-6xl gap-10 px-4 py-24 md:grid-cols-2' : 'sticky top-[104px] h-[calc(100vh-104px)] overflow-hidden'}>
        <div className={staticMode ? 'h-[60vh]' : 'absolute inset-0'}>
          {items.length > 0 && gl !== null && <JewelScene items={items} tier={tier === 'high' ? 'medium' : tier} exploded={exploded} highlight={null} showMeasure={false} autoRotate={false} hologram={false} reduced={reduced} preset="angle" scrollRef={staticMode ? undefined : progress} />}
        </div>
        <div className={staticMode ? 'space-y-8' : 'pointer-events-none relative mx-auto flex h-full max-w-7xl items-end px-4 pb-16 md:items-center md:pb-0'}>
          {staticMode ? CHAPTERS.map(([n, t, d]) => <div key={n}><span className="mono text-gold">{n}</span><h3 className="serif text-4xl">{t}</h3><p className="mt-2 text-white/70">{d}</p></div>) : (
            <div className="relative h-52 w-full md:w-[26rem]">
              {CHAPTERS.map(([n, t, d], i) => (
                <div key={n} className="absolute inset-x-0 bottom-0 transition-all duration-700 md:top-1/2 md:-translate-y-1/2" style={{ opacity: chapter === i ? 1 : 0, transform: `translateY(${chapter === i ? 0 : 24}px)` }} aria-hidden={chapter !== i}>
                  <span className="mono text-gold">{n} / 04</span>
                  <h3 className="serif mt-2 text-5xl leading-none md:text-6xl">{t}</h3>
                  <p className="mt-3 text-white/70">{i === 1 ? `${d} Now: ${METALS[metalIdx][2]}.` : d}</p>
                  {i === 3 && <a href={`/design?design=${slug}`} className="btn btn-gold pointer-events-auto mt-5">Open the studio</a>}
                </div>))}
            </div>)}
        </div>
        {!staticMode && (
          <div className="pointer-events-none absolute bottom-6 right-6 hidden items-center gap-3 md:flex" aria-hidden="true">
            <span className="mono text-white/50">Scroll</span>
            <div className="h-24 w-px bg-white/20"><div className="w-px bg-gold" style={{ height: `${(chapter + 1) * 25}%`, transition: 'height .6s' }} /></div>
          </div>)}
      </div>
    </section>
  );
}
