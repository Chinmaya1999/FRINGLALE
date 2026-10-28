'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import items from '@/lib/gallery.json';

const CATS = [['all', 'All'], ['ring', 'Rings'], ['necklace', 'Necklaces'], ['earring', 'Earrings'], ['bangle', 'Bracelets'], ['pendant', 'Pendants'], ['bridal', 'Gold markets']];

/** Real photographs of jewellery from around the world, all openly licensed (Wikimedia Commons). Credit and licence shown with every image. */
export default function WorldGallery() {
  const [cat, setCat] = useState('all');
  const [open, setOpen] = useState(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(null);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open]);
  const list = items.filter((i) => cat === 'all' || i.cat === cat);
  return (
    <section className="maroon-band py-20" aria-label="Jewellery from around the world">
      <div className="mx-auto max-w-7xl px-4">
        <p className="mono">Inspiration</p>
        <h2 className="mt-2 text-4xl md:text-5xl">Jewellery from <span className="gold-text">around the world</span></h2>
        <p className="mt-3 max-w-2xl text-white/70">Real photographs — from Indian kundan and Victorian enamel to Dubai’s gold souk and modern diamond work. They are here for inspiration: these are not Fringlale products. Bring any of them to a designer and we’ll make your own version.</p>
        <div className="scroll-x mt-8 flex gap-2 overflow-x-auto">{CATS.map(([k, l]) => <button key={k} onClick={() => setCat(k)} aria-pressed={cat === k} className={`shrink-0 border px-4 py-2 mono ${cat === k ? 'border-gold bg-gold text-[#260A12]' : 'border-white/25 text-white/75 hover:border-gold'}`}>{l}</button>)}</div>
        <div className="mt-8 gap-4 [column-fill:_balance] sm:columns-2 lg:columns-3">
          {list.map((i) => (
            <figure key={i.src} className="mb-4 break-inside-avoid overflow-hidden ring-1 ring-white/15 transition hover:ring-gold">
              <button className="block w-full" onClick={() => setOpen(i)} aria-label={`Enlarge: ${i.title}`}><img src={i.src} alt={i.title} loading="lazy" className="w-full" /></button>
              <figcaption className="bg-[#260A12] px-3 py-2 text-[11px] leading-snug text-white/50"><span className="text-white/75">{i.title}</span><br />{i.artist ? `${i.artist} · ` : ''}<a className="underline" href={i.page} target="_blank" rel="noreferrer">{i.license}</a></figcaption>
            </figure>))}
        </div>
      </div>
      {open && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/90 p-4" role="dialog" aria-modal="true" aria-label={open.title} onClick={() => setOpen(null)}>
          <figure className="mx-auto flex max-h-full w-fit max-w-4xl flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <img src={open.src} alt={open.title} className="max-h-[75vh] w-auto max-w-full rounded-xl object-contain" />
            <figcaption className="mt-3 flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm text-white/70">
              <span className="min-w-0">{open.title}{open.artist ? ` — ${open.artist}` : ''} · <a className="underline" href={open.page} target="_blank" rel="noreferrer">{open.license}, Wikimedia Commons</a></span>
              <button className="btn btn-ghost shrink-0 !py-1 text-xs text-white" onClick={() => setOpen(null)}>Close</button>
            </figcaption>
          </figure>
        </div>, document.body)}
    </section>
  );
}
