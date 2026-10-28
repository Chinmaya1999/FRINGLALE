'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);
const Ctx = createContext({ reduced: false, ready: false });
export const useMotion = () => useContext(Ctx);

/** Smooth scrolling (Lenis) driving GSAP ScrollTrigger, plus a scroll-progress bar and a once-per-session loader.
 *  Everything is switched off for prefers-reduced-motion and on touch devices keeps native scroll. */
export default function MotionProvider({ children }) {
  const path = usePathname();
  const [reduced, setReduced] = useState(false);
  const [ready, setReady] = useState(false);
  const [loader, setLoader] = useState(false);

  useEffect(() => {
    const r = matchMedia('(prefers-reduced-motion: reduce)').matches;
    setReduced(r);
    let seen = false; try { seen = sessionStorage.getItem('frg_loaded') === '1'; } catch {}
    if (!r && !seen && location.pathname === '/') setLoader(true); else setReady(true);
  }, []);

  useEffect(() => {
    if (reduced) return;
    const lenis = new Lenis({ lerp: 0.085, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    const tick = (t) => lenis.raf(t * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    window.__lenis = lenis;
    return () => { gsap.ticker.remove(tick); lenis.destroy(); window.__lenis = null; };
  }, [reduced]);

  // New route: top of page, recalc triggers after content paints.
  useEffect(() => { window.__lenis?.scrollTo(0, { immediate: true }); const t = setTimeout(() => ScrollTrigger.refresh(), 400); return () => clearTimeout(t); }, [path]);

  return (
    <Ctx.Provider value={{ reduced, ready }}>
      {loader && <Loader onDone={() => { try { sessionStorage.setItem('frg_loaded', '1'); } catch {} setLoader(false); setReady(true); }} />}
      <ProgressBar />
      <div key={path} className={reduced ? '' : 'page-in'}>{children}</div>
    </Ctx.Provider>
  );
}

function ProgressBar() {
  useEffect(() => {
    const bar = document.getElementById('scroll-progress');
    const on = () => { const h = document.documentElement.scrollHeight - innerHeight; bar.style.transform = `scaleX(${h > 0 ? scrollY / h : 0})`; };
    on(); addEventListener('scroll', on, { passive: true }); return () => removeEventListener('scroll', on);
  }, []);
  return <div id="scroll-progress" className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[2px] origin-left bg-gold" style={{ transform: 'scaleX(0)' }} />;
}

function Loader({ onDone }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const tl = gsap.timeline({ onComplete: () => { document.body.style.overflow = ''; onDone(); } });
    const o = { v: 0 };
    tl.to(o, { v: 100, duration: 1.6, ease: 'power2.inOut', onUpdate: () => setN(Math.round(o.v)) })
      .to('#loader-mark', { scale: 1.15, duration: 0.4, ease: 'power2.out' }, '-=0.3')
      .to('#loader', { yPercent: -100, duration: 0.9, ease: 'power4.inOut' });
    return () => { tl.kill(); document.body.style.overflow = ''; };
  }, [onDone]);
  return (
    <div id="loader" className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#260A12] text-[#f3eadb]" role="status" aria-label="Loading">
      <img id="loader-mark" src="/brand/monogram.png" alt="" className="blend-screen h-32 w-32 object-contain" />
      <p className="serif mt-4 text-2xl tracking-[0.3em] text-gold">FRINGLALE</p>
      <div className="mt-8 h-px w-56 bg-white/15"><div className="h-px bg-gold" style={{ width: `${n}%` }} /></div>
      <p className="mono mt-3 text-white/50">{n}%</p>
    </div>
  );
}
