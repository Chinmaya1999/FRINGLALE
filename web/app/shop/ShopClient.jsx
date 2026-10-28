'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { CATEGORY_LABELS } from '@/lib/format';
import WorldGallery from '@/components/WorldGallery';
import DesignCard, { COLLECTION_LABELS, ProductArt } from '@/components/DesignCard';

const METALS = [['yellow', 'Yellow gold'], ['white', 'White gold'], ['rose', 'Rose gold'], ['platinum', 'Platinum'], ['silver', 'Silver']];
const STONES = [['natural-diamond', 'Natural diamond'], ['lab-grown-diamond', 'Lab-grown diamond'], ['ruby', 'Ruby'], ['emerald', 'Emerald'], ['sapphire', 'Sapphire']];
const OCC = [['wedding', 'Wedding'], ['engagement', 'Engagement'], ['gifting', 'Gifting'], ['daily', 'Daily wear']];
const BLURB = { bridal: 'For the vows.', 'red-carpet': 'For the spotlight — inspired by award-night glamour.', heritage: 'For the family — timeless gold.', everyday: 'For every day — light luxury.', signature: 'For the house — our solitaires.' };

export default function ShopClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [quick, setQuick] = useState(null);
  const [refine, setRefine] = useState(false);
  const qs = sp.toString();
  const col = sp.get('collection');

  useEffect(() => { setData(null); api(`/designs?${qs}&limit=12`).then(setData).catch(() => setData({ items: [], total: 0, pages: 0 })); }, [qs]);
  const set = (k, v) => { const p = new URLSearchParams(qs); v && sp.get(k) !== v ? p.set(k, v) : p.delete(k); p.delete('page'); router.push(`/shop?${p}`); };

  const Group = ({ title, k, opts }) => (
    <fieldset className="border-t border-[#3A0F1B]/30 py-5">
      <legend className="mono -mt-2 bg-[#F3EADB] pr-3 text-clay">{title}</legend>
      <ul className="space-y-1.5">{opts.map(([v, l]) => (
        <li key={v}><button onClick={() => set(k, v)} aria-pressed={sp.get(k) === v} className={`flex w-full items-center gap-3 text-left text-sm transition ${sp.get(k) === v ? 'font-semibold text-[#3A0F1B]' : 'text-[#3A0F1B]/65 hover:text-[#3A0F1B]'}`}>
          <span className={`h-3 w-3 shrink-0 border border-[#3A0F1B] ${sp.get(k) === v ? 'bg-[#3A0F1B]' : ''}`} aria-hidden="true" />{l}</button></li>))}</ul>
    </fieldset>);

  const active = ['collection', 'category', 'metal', 'stone', 'occasion'].filter((k) => sp.get(k));

  return (
    <div className="paper-page">
      <header className="border-b border-[#3A0F1B]/30">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-4 px-4 pb-8 pt-14">
          <div><p className="mono text-clay">{col ? 'Collection' : 'The catalogue'}</p>
            <h1 className="mt-2 text-6xl text-[#3A0F1B] md:text-8xl">{col ? <em className="text-gold">{COLLECTION_LABELS[col]}</em> : <>All <em className="text-gold">designs</em></>}</h1></div>
          <p className="max-w-sm text-[#3A0F1B]/70">{col ? BLURB[col] : 'Every piece can be customised in 3D — choose a design, then make it yours.'}</p>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 lg:grid-cols-[230px_1fr]">
        <aside aria-label="Refine">
          <div className="lg:hidden"><button className="btn btn-ghost w-full text-[#3A0F1B]" onClick={() => setRefine(!refine)} aria-expanded={refine}>Refine {active.length ? `(${active.length})` : ''} {refine ? '–' : '+'}</button></div>
          <div className={`${refine ? 'mt-6 block' : 'hidden'} lg:block lg:sticky lg:top-36`}>
            <Group title="Collection" k="collection" opts={Object.entries(COLLECTION_LABELS)} />
            <Group title="Type" k="category" opts={Object.entries(CATEGORY_LABELS)} />
            <Group title="Metal" k="metal" opts={METALS} />
            <Group title="Stone" k="stone" opts={STONES} />
            <Group title="Occasion" k="occasion" opts={OCC} />
            {active.length > 0 && <button className="link-u text-sm font-semibold text-clay" onClick={() => router.push('/shop')}>Clear all filters</button>}
          </div>
        </aside>

        <div>
          <div className="mono mb-6 flex justify-between text-[#3A0F1B]/60"><span>{data ? `${data.total} design${data.total === 1 ? '' : 's'}` : 'Loading…'}</span>
            <label className="flex items-center gap-2">Sort <select className="bg-transparent text-[#3A0F1B]" value={sp.get('sort') || 'newest'} onChange={(e) => set('sort', e.target.value === 'newest' ? '' : e.target.value)}><option value="newest">Newest</option><option value="weight_asc">Weight ↑</option><option value="weight_desc">Weight ↓</option></select></label></div>
          {!data ? <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="arch aspect-[4/5] animate-pulse bg-[#3A0F1B]/10" />)}</div>
            : data.items.length === 0 ? <p className="text-[#3A0F1B]/70">No designs match these filters.</p> : (
            <div className="grid gap-x-6 gap-y-14 sm:grid-cols-2 xl:grid-cols-3">{data.items.map((d, i) => <DesignCard key={d.slug} design={d} index={(data.page - 1) * 12 + i + 1} onQuick={setQuick} />)}</div>)}
          {data?.pages > 1 && <div className="mono mt-12 flex justify-center gap-4">{Array.from({ length: data.pages }, (_, i) => <button key={i} onClick={() => { const p = new URLSearchParams(qs); p.set('page', i + 1); router.push(`/shop?${p}`); }} className={data.page === i + 1 ? 'border-b border-[#3A0F1B] text-[#3A0F1B]' : 'text-[#3A0F1B]/55'}>{i + 1}</button>)}</div>}
          <p className="mt-12 text-xs text-[#3A0F1B]/50">Prices depend on your metal, stone and size — open a design for a live quote.</p>
        </div>
      </div>

      <WorldGallery />

      {quick && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#260A12]/85 p-4" role="dialog" aria-modal="true" aria-label={quick.name} onClick={() => setQuick(null)}>
          <div className="paper-page max-h-[90vh] w-full max-w-3xl overflow-auto border border-[#3A0F1B]" onClick={(e) => e.stopPropagation()}>
            <div className="grid md:grid-cols-2"><div className="p-6"><div className="arch aspect-[4/5] bg-[#260A12]"><ProductArt design={quick} className="h-full w-full" /></div></div>
              <div className="flex flex-col justify-center p-6"><p className="mono text-clay">{COLLECTION_LABELS[quick.collection]}</p><h2 className="mt-1 text-4xl text-[#3A0F1B]">{quick.name}</h2><p className="mt-3 text-[#3A0F1B]/70">{quick.description}</p>
                <p className="mono mt-4 text-[#3A0F1B]/55">{quick.baseWeight} g (18K, std size) · {quick.allowedMetals.length} metals</p>
                <div className="mt-6 flex flex-wrap items-center gap-4"><Link href={`/design?design=${quick.slug}`} className="btn btn-navy">Design it</Link><Link href={`/product/${quick.slug}`} className="link-u text-sm font-semibold text-[#3A0F1B]">Full details</Link><button className="link-u text-sm text-[#3A0F1B]/60" onClick={() => setQuick(null)}>Close</button></div></div></div>
          </div>
        </div>)}
    </div>
  );
}
