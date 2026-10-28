'use client';
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useMotion } from './MotionProvider';

gsap.registerPlugin(ScrollTrigger);

/** Fade/translate children into view. `stagger` animates direct children one after another. */
export function Reveal({ as: Tag = 'div', y = 40, stagger = 0, delay = 0, className = '', children, ...rest }) {
  const ref = useRef(null);
  const { reduced } = useMotion();
  useEffect(() => {
    if (reduced || !ref.current) return;
    const targets = stagger ? ref.current.children : ref.current;
    const ctx = gsap.context(() => {
      gsap.from(targets, { opacity: 0, y, duration: 1, delay, stagger, ease: 'power3.out', scrollTrigger: { trigger: ref.current, start: 'top 85%', once: true } });
    }, ref);
    return () => ctx.revert();
  }, [reduced, y, stagger, delay]);
  return <Tag ref={ref} className={className} {...rest}>{children}</Tag>;
}

/** Headline that rises line-by-line out of a mask. Pass lines as an array of strings / nodes. */
export function Lines({ lines, className = '', as: Tag = 'h2' }) {
  const ref = useRef(null);
  const { reduced } = useMotion();
  useEffect(() => {
    if (reduced || !ref.current) return;
    const ctx = gsap.context(() => {
      gsap.from('.ln > span', { yPercent: 110, duration: 1.1, stagger: 0.12, ease: 'power4.out', scrollTrigger: { trigger: ref.current, start: 'top 88%', once: true } });
    }, ref);
    return () => ctx.revert();
  }, [reduced]);
  return <Tag ref={ref} className={className}>{lines.map((l, i) => <span key={i} className="ln block overflow-hidden pb-[0.08em]"><span className="block">{l}</span></span>)}</Tag>;
}

/** Moves its child vertically at a different speed from the page. */
export function Parallax({ speed = 0.15, className = '', children }) {
  const ref = useRef(null);
  const { reduced } = useMotion();
  useEffect(() => {
    if (reduced || !ref.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(ref.current, { yPercent: -speed * 100 }, { yPercent: speed * 100, ease: 'none', scrollTrigger: { trigger: ref.current, start: 'top bottom', end: 'bottom top', scrub: true } });
    }, ref);
    return () => ctx.revert();
  }, [reduced, speed]);
  return <div ref={ref} className={className}>{children}</div>;
}

/** Counts up to `to` when it enters the viewport. */
export function CountUp({ to, prefix = '', suffix = '', className = '' }) {
  const ref = useRef(null);
  const { reduced } = useMotion();
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (reduced) { el.textContent = `${prefix}${to}${suffix}`; return; }
    const o = { v: 0 };
    const st = ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => gsap.to(o, { v: to, duration: 1.6, ease: 'power2.out', onUpdate: () => { el.textContent = `${prefix}${Math.round(o.v)}${suffix}`; } }) });
    return () => st.kill();
  }, [reduced, to, prefix, suffix]);
  return <span ref={ref} className={className}>{prefix}0{suffix}</span>;
}
