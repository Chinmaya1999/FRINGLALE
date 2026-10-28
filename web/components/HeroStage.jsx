'use client';
import { useState } from 'react';
import Link from 'next/link';
import HeroHolo from '@/components/HeroHolo';
import { inr } from '@/lib/format';

const METALS = [
  { key: 'yellow-18K', name: 'Yellow gold', dot: 'bg-[#D9AE4F]', wash: 'radial-gradient(ellipse at 50% 55%, #5a1a2c 0%, #2b0b14 55%, #12040a 100%)' },
  { key: 'rose-18K', name: 'Rose gold', dot: 'bg-[#D69A87]', wash: 'radial-gradient(ellipse at 50% 55%, #6d2a33 0%, #33121a 55%, #14060b 100%)' },
  { key: 'platinum-950', name: 'Platinum', dot: 'bg-[#cfd3d8]', wash: 'radial-gradient(ellipse at 50% 55%, #2f3a4d 0%, #151b28 55%, #080a10 100%)' },
];
const PIECES = [
  { slug: 'celestia-halo-ring', name: 'Ring', sub: 'Celestia Halo' },
  { slug: 'lumiere-halo-pendant', name: 'Pendant', sub: 'Lumière Halo' },
  { slug: 'starlight-tennis-bangle', name: 'Bangle', sub: 'Starlight Tennis' },
];

/** Full-bleed stage: a huge draggable jewel, with the metal and the piece switchable right on the hero. */
export default function HeroStage({ rate }) {
  const [mi, setMi] = useState(0);
  const [pi, setPi] = useState(0);
  const metal = METALS[mi];
  const piece = PIECES[pi];
  return (
    <section className="relative isolate overflow-hidden bg-[#12040a] text-[#f3eadb]" style={{ minHeight: 'max(calc(100svh - 104px), 42rem)' }}>
      {METALS.map((m, i) => <div key={m.key} className="absolute inset-0 transition-opacity duration-1000" style={{ background: m.wash, opacity: i === mi ? 1 : 0 }} aria-hidden="true" />)}
      <div className="paper-grain pointer-events-none absolute inset-0 opacity-20 mix-blend-overlay" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 aspect-square w-[min(80vh,90vw)] -translate-x-1/2 -translate-y-[52%] rounded-full border border-white/10" aria-hidden="true" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 aspect-square w-[min(58vh,66vw)] -translate-x-1/2 -translate-y-[52%] rounded-full border border-gold/20" aria-hidden="true" />
      <h1 className="sr-only">Make your design — Fringlale, My Choice, My Jewel</h1>

      {/* the jewel, as big as the stage */}
      <div className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing"><HeroHolo mode="gold" slug={piece.slug} metal={metal.key} /></div>

      <div className="pointer-events-none relative z-20 mx-auto flex max-w-7xl flex-col justify-between px-4 py-8" style={{ minHeight: 'max(calc(100svh - 104px), 42rem)' }}>
        <div className="flex items-start justify-between gap-6">
          {/* metal rail */}
          <div className="pointer-events-auto">
            <p className="mono text-white/70">01 — Metal</p>
            <ul className="mt-3 space-y-2">
              {METALS.map((m, i) => (
                <li key={m.key}>
                  <button onClick={() => setMi(i)} aria-pressed={i === mi} className={`group flex items-center gap-3 py-1 text-left transition ${i === mi ? 'text-white' : 'text-white/55 hover:text-white'}`}>
                    <span className={`h-5 w-5 rounded-full ${m.dot} ring-offset-2 ring-offset-transparent transition ${i === mi ? 'ring-2 ring-white' : 'ring-1 ring-white/30'}`} />
                    <span className="serif text-lg italic">{m.name}</span>
                  </button>
                </li>))}
            </ul>
          </div>
          {/* piece rail */}
          <div className="pointer-events-auto text-right">
            <p className="mono text-white/70">02 — Piece</p>
            <ul className="mt-3 space-y-2">
              {PIECES.map((p, i) => (
                <li key={p.slug}>
                  <button onClick={() => setPi(i)} aria-pressed={i === pi} className={`transition ${i === pi ? 'text-white' : 'text-white/55 hover:text-white'}`}>
                    <span className="serif text-lg italic">{p.name}</span>
                    <span className={`mono ml-3 ${i === pi ? 'text-gold' : 'text-white/40'}`}>{String(i + 1).padStart(2, '0')}</span>
                  </button>
                </li>))}
            </ul>
          </div>
        </div>

        <div className="grid items-end gap-8 md:grid-cols-[1fr_auto]">
          <div>
            <p className="mono flex items-center gap-3 text-gold"><span className="inline-block h-px w-10 bg-gold" />{piece.sub} · {metal.name}</p>
            <p className="serif mt-3 text-[clamp(3rem,7.4vw,7rem)] font-light leading-[0.92] tracking-tight [text-shadow:0_2px_30px_rgba(0,0,0,.55)]">Make <em className="text-gold">your</em><br />own design.</p>
            <p className="mt-4 max-w-md text-white/80">Shape it in 3D, watch the price build line by line, and approve the model before a single gram is cast.</p>
          </div>
          <div className="flex flex-col items-start gap-5 md:items-end">
            {rate && <dl className="flex gap-6">{['24K', '22K', '18K'].map((k) => <div key={k}><dt className="mono text-white/70">{k} / g</dt><dd className="serif text-xl tabular-nums">{inr(rate.rates[k])}</dd></div>)}</dl>}
            <div className="pointer-events-auto flex flex-wrap items-center gap-x-7 gap-y-3">
              <Link href={`/design?design=${piece.slug}`} className="btn btn-gold">Open the Design Studio</Link>
              <Link href="/shop" className="link-u text-sm font-semibold">Browse the catalogue →</Link>
            </div>
            <p className="mono flex items-center gap-2 text-white/60"><span className="inline-block h-px w-8 bg-white/40" />Drag to turn</p>
          </div>
        </div>
      </div>
    </section>
  );
}
