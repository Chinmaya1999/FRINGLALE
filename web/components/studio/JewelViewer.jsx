'use client';
import dynamic from 'next/dynamic';
import { Component, useCallback, useEffect, useRef, useState } from 'react';
import { detectTier, supportsWebGL, TIER_ORDER, useReducedMotion } from './quality';
import SupportBadges from './SupportBadges';

// The scene (three.js, drei) is only fetched in the browser, and only when a viewer is actually mounted.
const JewelScene = dynamic(() => import('./JewelScene'), { ssr: false });
const Loader = dynamic(() => import('./Loader'), { ssr: false });

class Boundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e) { console.error('3D viewer error', e); this.props.onFail?.(); }
  render() { return this.state.failed ? null : this.props.children; }
}

/** Static fallback when WebGL is unavailable or the GPU context is lost. Never a blank box. */
function Fallback({ items, reason }) {
  const it = items[0];
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-b from-navy-deep to-black p-6 text-center text-white" data-testid="webgl-fallback">
      <svg viewBox="0 0 120 120" className="h-28 w-28" aria-hidden="true">
        <circle cx="60" cy="78" r="30" fill="none" stroke={it?.metal?.hex || '#C9A24A'} strokeWidth="7" />
        <path d="M60 28 74 46 60 60 46 46Z" fill={it?.stone?.hex || '#fff'} stroke="#C9A24A" strokeWidth="2" />
      </svg>
      <p className="serif text-lg">{reason === 'lost' ? '3D view paused' : '3D preview unavailable on this device'}</p>
      <p className="max-w-sm text-sm text-white/70">
        {reason === 'lost' ? 'Your browser released the graphics context.' : 'Your browser or device does not support WebGL.'} Your selections, specification and live price below are unaffected.
      </p>
      {reason === 'lost' && <button className="btn btn-gold" onClick={() => location.reload()}>Reload preview</button>}
    </div>
  );
}

function Ctl({ pressed, children, ...p }) {
  return (
    <button {...p} aria-pressed={pressed} className={`rounded-full border px-3 py-1.5 text-xs backdrop-blur transition ${pressed ? 'border-gold bg-gold text-navy-deep' : 'border-white/25 bg-black/40 text-white hover:border-gold'}`}>
      {children}
    </button>
  );
}

export default function JewelViewer({ items, className = '', heightClass = 'h-[52vh] lg:h-[calc(100vh-8rem)]', showBadges = true }) {
  const wrap = useRef(null);
  const reduced = useReducedMotion();
  const [webgl, setWebgl] = useState(null);       // null until checked on the client
  const [failed, setFailed] = useState(null);
  const [tierPref, setTierPref] = useState('auto');
  const [autoTier, setAutoTier] = useState('medium');
  const [exploded, setExploded] = useState(false);
  const [highlight, setHighlight] = useState(null);
  const [measure, setMeasure] = useState(false);
  const [spin, setSpin] = useState(false);
  const [preset, setPreset] = useState('angle');
  const [holo, setHolo] = useState(false);
  const [full, setFull] = useState(false);

  useEffect(() => { setWebgl(supportsWebGL()); setAutoTier(detectTier()); }, []);
  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);

  const tier = tierPref === 'auto' ? autoTier : tierPref;
  const downgrade = useCallback(() => setAutoTier((t) => TIER_ORDER[Math.min(TIER_ORDER.indexOf(t) + 1, 2)]), []);

  const main = items[0];
  const canExplode = items.length === 1 && main?.explodedView && main.components.length > 0;   // only when the model supports it
  const canMeasure = items.some((i) => i.annotations.length > 0);
  const lead = items[0];

  const toggleFull = async () => {
    const el = wrap.current;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (el.requestFullscreen) await el.requestFullscreen();
      else setFull((f) => !f);   // iOS Safari: CSS fullscreen
    } catch { setFull((f) => !f); }
  };

  return (
    <section className={className} aria-label="3D jewellery viewer">
      <div
        ref={wrap}
        tabIndex={0}
        className={`relative overflow-hidden rounded-2xl ${holo ? 'bg-[radial-gradient(ellipse_at_50%_60%,#0b3a4a_0%,#06141f_55%,#02060a_100%)]' : 'bg-[radial-gradient(ellipse_at_50%_38%,#4a3510_0%,#17110a_52%,#050403_100%)]'} transition-colors duration-700 ${full ? 'fixed inset-0 z-50 !h-screen rounded-none' : heightClass}`}
      >
        {webgl === null ? null : !webgl || failed ? <Fallback items={items} reason={failed} /> : (
          <Boundary onFail={() => setFailed('error')}>
            <JewelScene
              items={items} tier={tier} exploded={exploded} highlight={highlight} showMeasure={measure}
              autoRotate={spin} hologram={holo} reduced={reduced} preset={preset} onDowngrade={downgrade} onFail={() => setFailed('lost')}
            />
            <Loader />
          </Boundary>
        )}

        {webgl && !failed && (
          <>
            <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-1.5 text-[11px]">
              <span className={`rounded-full px-2.5 py-1 font-semibold ${lead?.support?.assetBacked ? 'bg-gold text-navy-deep' : 'bg-white/15 text-white'}`}>
                {lead?.support?.assetBacked ? 'Real 3D asset' : 'Simulated preview'}
              </span>
              {lead?.support?.approvedForManufacturing && <span className="rounded-full bg-emerald-400 px-2.5 py-1 font-semibold text-emerald-950">Approved for manufacturing</span>}
              {items.length === 1 && lead?.engraving && <span className="serif rounded-full bg-black/50 px-2.5 py-1 italic text-gold-soft">Engraving (simulated): “{lead.engraving}”</span>}
            </div>

            <div className="absolute right-3 top-3 flex max-w-[70%] flex-wrap justify-end gap-1.5">
              {!reduced && <Ctl pressed={spin} onClick={() => setSpin(!spin)}>Auto-rotate</Ctl>}
              <Ctl pressed={holo} onClick={() => setHolo(!holo)}>Hologram</Ctl>
              {canMeasure && <Ctl pressed={measure} onClick={() => setMeasure(!measure)}>Measure</Ctl>}
              {canExplode && <Ctl pressed={exploded} onClick={() => { setExploded(!exploded); setHighlight(null); }}>Exploded</Ctl>}
              <Ctl onClick={toggleFull}>{full ? 'Exit full screen' : 'Full screen'}</Ctl>
            </div>

            <div className="absolute bottom-3 left-3 flex gap-1.5">
              {['angle', 'front', 'side', 'top'].map((p) => <Ctl key={p} pressed={preset === p} onClick={() => setPreset(p)}>{p[0].toUpperCase() + p.slice(1)}</Ctl>)}
            </div>
            <div className="absolute bottom-3 right-3 flex items-center gap-1.5 text-[11px] text-white/70">
              <label htmlFor="q" className="sr-only">Rendering quality</label>
              <select id="q" value={tierPref} onChange={(e) => setTierPref(e.target.value)} className="rounded-full border border-white/25 bg-black/40 px-2 py-1 text-white">
                <option value="auto">Quality: Auto ({autoTier})</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
              </select>
            </div>

            {canExplode && exploded && (
              <div className="absolute inset-x-0 bottom-12 flex flex-wrap justify-center gap-1.5 px-3" role="group" aria-label="Highlight component">
                {main.components.map((c) => <Ctl key={c.id} pressed={highlight === c.meshName} onClick={() => setHighlight(highlight === c.meshName ? null : c.meshName)}>{c.label}</Ctl>)}
              </div>
            )}

            {items.length > 1 && (
              <div className="pointer-events-none absolute inset-x-0 top-12 flex justify-around text-xs text-gold-soft">
                {items.map((i) => <span key={i.key} className="rounded bg-black/50 px-2 py-0.5">{i.label}</span>)}
              </div>
            )}
          </>
        )}
        {full && <button className="btn btn-gold absolute left-1/2 top-3 -translate-x-1/2 md:hidden" onClick={toggleFull}>Close</button>}
      </div>
      {showBadges && <div className="mt-3"><SupportBadges support={lead?.support} isProxy={lead?.isProxy} parametric={lead?.parametric} /></div>}
      <p className="sr-only" aria-live="polite">{canExplode && exploded ? 'Exploded view on' : ''}</p>
    </section>
  );
}
