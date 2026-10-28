'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useCatalog, useQuote } from '@/lib/hooks';
import { defaultConfig } from '@/lib/config';
import { buildViewerItem } from '@/lib/viewerItem';
import { CATEGORY_LABELS, SHAPE_LABELS, inr } from '@/lib/format';
import JewelViewer from '@/components/studio/JewelViewer';
import PriceBreakdown from '@/components/PriceBreakdown';
import SpecSummary from '@/components/SpecSummary';
import { ProductArt } from '@/components/DesignCard';

export default function ProductClient({ design }) {
  const catalog = useCatalog();
  const router = useRouter();
  const { user, refreshCart } = useAuth();
  const [config, setConfig] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [tab, setTab] = useState('3d');
  const cfg = config || (catalog ? defaultConfig(design, catalog.matrix) : null);
  const set = (p) => setConfig({ ...cfg, ...p });
  const { quote, loading, error } = useQuote(design.slug, cfg, !!cfg);

  const items = useMemo(() => (cfg && catalog ? [buildViewerItem({ design, config: cfg, support: quote?.support, metals: catalog.metals, stones: catalog.stones })] : []), [cfg, catalog, quote, design]);

  async function add() {
    if (!user) return router.push(`/login?next=/product/${design.slug}`);
    setBusy(true); setErr(null);
    try { await api('/cart/items', { method: 'POST', body: { designSlug: design.slug, config: cfg, qty: 1 } }); await refreshCart(); router.push('/cart'); }
    catch (e) { setErr(e.message); setBusy(false); }
  }

  return (
    <div className="paper-page"><div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 lg:grid-cols-[1.2fr_1fr]">
      <div>
        <div className="mb-3 flex gap-2" role="tablist">
          {[['3d', '3D view'], ['photos', 'Photos']].map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`btn !py-1.5 ${tab === k ? 'btn-navy' : 'btn-ghost text-[#3A0F1B]'}`}>{l}</button>)}
        </div>
        {tab === '3d' ? (items.length ? <JewelViewer items={items} heightClass="h-[62vh]" /> : <div className="h-[55vh] animate-pulse rounded-2xl bg-navy/20" />)
          : <div className="grid gap-3 sm:grid-cols-2">{(design.images?.length ? design.images : [null, null]).map((src, i) => <ProductArt key={i} design={{ ...design, images: src ? [src] : [] }} className="aspect-square w-full rounded-xl" />)}</div>}
      </div>

      <div>
        <div className="label !text-gold">{CATEGORY_LABELS[design.category]}</div>
        <h1 className="mt-1 text-4xl text-navy">{design.name}</h1>
        <p className="mt-3 text-gray-600">{design.description}</p>
        <div className="serif mt-4 text-3xl text-navy tabular-nums" aria-live="polite">{quote ? inr(quote.price.total) : '—'}<span className="ml-2 text-sm text-gray-500">incl. GST</span></div>

        {cfg && catalog && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label><span className="label">Metal</span><select className="input mt-1" value={cfg.metal} onChange={(e) => set({ metal: e.target.value })}>{catalog.metals.filter((m) => design.allowedMetals.includes(m.key)).map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}</select></label>
            <label><span className="label">{['bar', 'coin'].includes(design.category) ? 'Weight (g)' : 'Size'}</span><select className="input mt-1" value={cfg.size} onChange={(e) => set({ size: e.target.value })}>{design.allowedSizes.map((s) => <option key={s}>{s}</option>)}</select></label>
            {design.allowedStoneTypes.length > 0 && <>
              <label><span className="label">Stone</span><select className="input mt-1" value={cfg.stoneType || ''} onChange={(e) => { const t = e.target.value; if (!t) return set({ stoneType: undefined, shape: undefined, quality: undefined, carat: undefined }); const d = defaultConfig({ ...design, allowedStoneTypes: [t] }, catalog.matrix); set({ stoneType: t, shape: d.shape, quality: d.quality, carat: cfg.carat || d.carat }); }}>
                <option value="">No stone</option>{catalog.stones.filter((s) => design.allowedStoneTypes.includes(s.key)).map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></label>
              {cfg.stoneType && <label><span className="label">Shape</span><select className="input mt-1" value={cfg.shape} onChange={(e) => set({ shape: e.target.value })}>{design.allowedShapes.filter((s) => catalog.matrix[cfg.stoneType]?.[s]).map((s) => <option key={s} value={s}>{SHAPE_LABELS[s]}</option>)}</select></label>}
              {cfg.stoneType && <label><span className="label">Carat: {cfg.carat}</span><input type="range" className="mt-3 w-full accent-[#C9A24A]" min={design.caratRange.min} max={design.caratRange.max} step="0.05" value={cfg.carat} onChange={(e) => set({ carat: Math.round(Number(e.target.value) * 100) / 100 })} /></label>}
              {cfg.stoneType && <label><span className="label">Quality</span><select className="input mt-1" value={cfg.quality} onChange={(e) => set({ quality: e.target.value })}>{design.allowedQualities.filter((q) => catalog.matrix[cfg.stoneType]?.[cfg.shape]?.includes(q)).map((q) => <option key={q}>{q}</option>)}</select></label>}
            </>}
          </div>)}

        {(error || err) && <div role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error || err}</div>}
        <div className="mt-5 flex flex-wrap gap-3">
          <button className="btn btn-navy" disabled={busy || !quote} onClick={add}>{busy ? 'Adding…' : 'Add to cart'}</button>
          <Link href={`/design?design=${design.slug}`} className="btn btn-ghost">Full design studio</Link>
        </div>

        <div className="mt-6 space-y-4">
          <PriceBreakdown quote={quote} loading={loading} />
          {cfg && catalog && <SpecSummary design={design} config={cfg} quote={quote} metals={catalog.metals} stones={catalog.stones} />}
          <details className="card p-4 text-sm"><summary className="cursor-pointer font-semibold text-navy">Size guide</summary><p className="mt-2 text-gray-600">Ring: Indian size 12 ≈ 17.2 mm inner diameter; each size ≈ 0.4 mm. Chains: 16" choker, 18" princess, 20" matinee. Bangles: 2.4" small, 2.6" medium, 2.8" large.</p></details>
          <details className="card p-4 text-sm"><summary className="cursor-pointer font-semibold text-navy">Certificates &amp; hallmark</summary><p className="mt-2 text-gray-600">Gold jewellery carries a BIS hallmark and a 6-character HUID. Diamonds above 0.30 ct ship with an IGI or GIA report. Certificates are uploaded to your order for download.</p></details>
        </div>
      </div>
    </div>
    </div>
  );
}
