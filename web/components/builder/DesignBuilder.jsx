'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useCatalog, useQuote } from '@/lib/hooks';
import { buildViewerItem } from '@/lib/viewerItem';
import { defaultConfig } from '@/lib/config';
import { CATEGORY_LABELS, SHAPE_LABELS, inr } from '@/lib/format';
import JewelViewer from '@/components/studio/JewelViewer';
import ShapeIcon from '@/components/ShapeIcon';
import PriceBreakdown from '@/components/PriceBreakdown';
import SpecSummary from '@/components/SpecSummary';
import SupportBadges from '@/components/studio/SupportBadges';
import { Monogram } from '@/components/Logo';
import Link from 'next/link';

const STEPS = ['Type', 'Design', 'Metal', 'Stone shape', 'Stone & carat', 'Size', 'Engraving', 'Review'];
const SIZE_TITLE = { ring: 'Ring size', bangle: 'Bangle size (inches)', pendant: 'Chain length (inches)', necklace: 'Chain length (inches)', earring: 'Size', bar: 'Weight (grams)', coin: 'Weight (grams)', 'gold-item': 'Size' };

function Choice({ selected, disabled, onClick, children, className = '' }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} aria-pressed={selected}
      className={`rounded-xl border p-3 text-left transition ${selected ? 'border-gold bg-gold/15 ring-1 ring-gold' : 'border-white/15 bg-white/5 hover:border-gold/60'} ${disabled ? 'cursor-not-allowed opacity-40' : ''} ${className}`}>
      {children}
    </button>
  );
}

const LOOKS = [
  { name: 'Classic gold', metal: 'yellow-18K', stoneType: 'natural-diamond', shape: 'round', quality: 'VS-GH' },
  { name: 'Rose romance', metal: 'rose-18K', stoneType: 'lab-grown-diamond', shape: 'oval', quality: 'VS-GH' },
  { name: 'Icy platinum', metal: 'platinum-950', stoneType: 'natural-diamond', shape: 'princess', quality: 'VVS-EF' },
  { name: 'Royal ruby', metal: 'yellow-22K', stoneType: 'ruby', shape: 'cushion', quality: 'AAA' },
];
const STEP_ICON = ['◇', '❖', '●', '◆', '✦', '◎', '✎', '✓'];

export default function DesignBuilder() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, refreshCart } = useAuth();
  const catalog = useCatalog();

  const [step, setStep] = useState(0);
  const [category, setCategory] = useState(null);
  const [designs, setDesigns] = useState([]);
  const [design, setDesign] = useState(null);
  const [config, setConfig] = useState(null);
  const [pinned, setPinned] = useState(null);       // compare: snapshot {config, quote}
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);
  const [rate, setRate] = useState(null);
  const [hist, setHist] = useState({ past: [], future: [] });
  const [reached, setReached] = useState(0);

  useEffect(() => { api('/gold-rates/today').then(setRate).catch(() => {}); }, []);

  // Deep link from shop/product: /design?design=slug
  useEffect(() => {
    const slug = params.get('design');
    if (!slug || !catalog || design) return;
    api(`/designs/${slug}`).then(({ design: d }) => {
      setCategory(d.category); pick(d); setStep(2); setReached(2);
      const c = params.get('c');
      if (c) { try { setConfig(JSON.parse(decodeURIComponent(escape(atob(c))))); } catch {} }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, params]);

  useEffect(() => {
    if (!category) return;
    api(`/designs?category=${category}&limit=24`).then((r) => setDesigns(r.items)).catch(() => setDesigns([]));
  }, [category]);

  const pick = (d) => { setDesign(d); setConfig(defaultConfig(d, catalog?.matrix || {})); };
  const commit = (next) => { setHist((h) => ({ past: [...h.past.slice(-49), config], future: [] })); setConfig(next); };
  const set = (patch) => commit({ ...config, ...patch });
  const undo = () => { if (!hist.past.length) return; setHist({ past: hist.past.slice(0, -1), future: [config, ...hist.future] }); setConfig(hist.past.at(-1)); };
  const redo = () => { if (!hist.future.length) return; setHist({ past: [...hist.past, config], future: hist.future.slice(1) }); setConfig(hist.future[0]); };
  useEffect(() => {
    const on = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) { e.preventDefault(); e.shiftKey ? redo() : undo(); } };
    window.addEventListener('keydown', on); return () => window.removeEventListener('keydown', on);
  });
  const applyLook = (l) => {
    if (!design || !catalog) return;
    const ok = (arr, v) => (arr || []).includes(v);
    const next = { ...config };
    if (ok(design.allowedMetals, l.metal)) next.metal = l.metal;
    if (ok(design.allowedStoneTypes, l.stoneType) && ok(design.allowedShapes, l.shape) && catalog.matrix[l.stoneType]?.[l.shape]?.includes(l.quality) && ok(design.allowedQualities, l.quality)) Object.assign(next, { stoneType: l.stoneType, shape: l.shape, quality: l.quality });
    commit(next);
  };
  const share = async () => {
    const c = btoa(unescape(encodeURIComponent(JSON.stringify(config))));
    try { await navigator.clipboard.writeText(`${location.origin}/design?design=${design.slug}&c=${c}`); setMsg({ ok: 'Share link copied.' }); } catch { setMsg({ err: 'Could not copy the link.' }); }
  };

  const { quote, loading, error } = useQuote(design?.slug, config, !!design && !!config && !!config.size);

  const hasStoneOptions = !!design?.allowedStoneTypes?.length;
  const metals = useMemo(() => (catalog?.metals || []).filter((m) => design?.allowedMetals.includes(m.key)), [catalog, design]);

  const viewerItems = useMemo(() => {
    if (!design || !config || !catalog) return [];
    const cur = buildViewerItem({ design, config, support: quote?.support, metals: catalog.metals, stones: catalog.stones, label: pinned ? 'B · current' : undefined });
    if (!pinned) return [cur];
    return [buildViewerItem({ design: pinned.design, config: pinned.config, support: pinned.quote.support, metals: catalog.metals, stones: catalog.stones, label: 'A · pinned' }), cur];
  }, [design, config, catalog, quote, pinned]);

  // Skip stone steps for designs that have no stone options.
  const visibleSteps = STEPS.map((s, i) => i).filter((i) => hasStoneOptions || (i !== 3 && i !== 4));
  const pos = visibleSteps.indexOf(step);
  const canNext = (step === 0 && category) || (step === 1 && design) || (step === 5 ? !!config?.size : step > 1 && step < 7);
  const go = (d) => { const n = visibleSteps[pos + d]; if (n != null) { setStep(n); setReached((r) => Math.max(r, n)); } };

  const needLogin = () => { if (!user) { router.push(`/login?next=${encodeURIComponent('/design' + (design ? `?design=${design.slug}` : ''))}`); return true; } return false; };

  async function addToCart() {
    if (needLogin()) return;
    setBusy('cart'); setMsg(null);
    try { await api('/cart/items', { method: 'POST', body: { designSlug: design.slug, config, qty: 1 } }); await refreshCart(); router.push('/cart'); }
    catch (e) { setMsg({ err: e.message }); setBusy(null); }
  }
  async function save() {
    if (needLogin()) return;
    setBusy('save'); setMsg(null);
    try { await api('/saved-designs', { method: 'POST', body: { designSlug: design.slug, config } }); setMsg({ ok: 'Saved to your account.' }); }
    catch (e) { setMsg({ err: e.message }); }
    setBusy(null);
  }

  /* ---------- step bodies ---------- */
  const body = () => {
    if (!catalog) return <p className="text-white/50">Loading options…</p>;
    switch (step) {
      case 0: return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Object.entries(CATEGORY_LABELS).map(([k, l]) => (
            <Choice key={k} selected={category === k} onClick={() => { setCategory(k); setDesign(null); setConfig(null); setPinned(null); }}>
              <div className="serif text-lg text-gold-soft">{l}</div>
            </Choice>
          ))}
        </div>);
      case 1: return (
        <div className="grid gap-3 sm:grid-cols-2">
          {designs.map((d) => (
            <Choice key={d.slug} selected={design?.slug === d.slug} onClick={() => { pick(d); setPinned(null); }}>
              <div className="serif text-gold-soft">{d.name}</div>
              <p className="mt-1 line-clamp-2 text-xs text-white/50">{d.description}</p>
              <div className="mt-2 flex flex-wrap gap-1 text-[10px] font-semibold">
                <span className={`rounded-full px-2 py-0.5 ${d.model3d?.assetVariants?.length ? 'bg-navy text-white' : 'bg-gray-200'}`}>{d.model3d?.assetVariants?.length ? 'Real 3D model' : 'Simulated 3D'}</span>
                <span className={`rounded-full px-2 py-0.5 ${d.manufacturing?.status === 'approved_for_manufacturing' ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'}`}>
                  {d.manufacturing?.status === 'approved_for_manufacturing' ? 'Approved to manufacture' : d.manufacturing?.status === 'cad_ready' ? 'CAD ready' : 'Concept'}
                </span>
              </div>
            </Choice>
          ))}
          {!designs.length && <p className="text-white/50">No designs in this category yet.</p>}
        </div>);
      case 2: return (
        <div className="grid grid-cols-2 gap-3">
          {metals.map((m) => {
            const backed = design.model3d?.assetBackedMetals?.includes(m.key);
            return (
              <Choice key={m.key} selected={config.metal === m.key} onClick={() => set({ metal: m.key })}>
                <div className="flex items-center gap-2"><span className="h-6 w-6 rounded-full border border-black/10" style={{ background: `radial-gradient(circle at 30% 30%, #fff, ${m.hex})` }} />
                  <span className="text-sm font-medium">{m.label}</span></div>
                <div className="mt-1 text-[11px] text-white/50">{rate?.rates?.[m.rateKey] ? `${inr(rate.rates[m.rateKey])}/g · ` : ''}{backed ? 'real material asset' : 'simulated finish'}</div>
              </Choice>);
          })}
        </div>);
      case 3: {
        const real = new Set(design.model3d?.assetVariants?.map((v) => v.stoneShape));
        const avail = (design.allowedShapes || []).filter((s) => !config.stoneType || catalog.matrix[config.stoneType]?.[s]);
        return (
          <div>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {(design.allowedShapes || []).map((s) => (
                <Choice key={s} selected={config.shape === s && !!config.stoneType} disabled={!avail.includes(s)} onClick={() => set({ shape: s, stoneType: config.stoneType || design.allowedStoneTypes[0] })} className="text-center">
                  <ShapeIcon shape={s} className="mx-auto h-10 w-10 text-gold-soft" />
                  <div className="mt-1 text-xs font-medium">{SHAPE_LABELS[s]}</div>
                  <div className="text-[10px] text-white/50">{real.has(s) ? 'real 3D' : 'simulated'}</div>
                </Choice>
              ))}
            </div>
            <button className="mt-3 text-sm text-gold-soft underline" onClick={() => set({ stoneType: undefined, shape: undefined, quality: undefined, carat: undefined })}>No stone</button>
          </div>);
      }
      case 4: {
        if (!config.stoneType) return <p className="text-white/60">You chose no stone. Go back to add one.</p>;
        const quals = (design.allowedQualities || []).filter((q) => catalog.matrix[config.stoneType]?.[config.shape]?.includes(q));
        return (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              {catalog.stones.filter((s) => design.allowedStoneTypes.includes(s.key)).map((s) => (
                <Choice key={s.key} selected={config.stoneType === s.key} onClick={() => {
                  const q = (design.allowedQualities || []).filter((x) => catalog.matrix[s.key]?.[config.shape]?.includes(x));
                  set({ stoneType: s.key, quality: q.includes(config.quality) ? config.quality : q[0] });
                }}>
                  <div className="flex items-center gap-2"><span className="h-4 w-4 rounded-full border" style={{ background: s.hex }} /><span className="text-sm font-medium">{s.label}</span></div>
                  {s.certified && <div className="mt-1 text-[11px] text-white/50">IGI / GIA certificate</div>}
                </Choice>))}
            </div>
            <div>
              <label htmlFor="carat" className="label">Carat weight: <span className="text-gold-soft">{config.carat} ct</span></label>
              <input id="carat" type="range" className="mt-2 w-full accent-[#C9A24A]" min={design.caratRange.min} max={design.caratRange.max} step="0.05"
                value={config.carat} onChange={(e) => set({ carat: Math.round(Number(e.target.value) * 100) / 100 })} />
              <div className="flex justify-between text-xs text-white/50"><span>{design.caratRange.min} ct</span><span>{design.caratRange.max} ct</span></div>
            </div>
            <div>
              <div className="label">Quality</div>
              <div className="mt-2 flex flex-wrap gap-2">{quals.map((q) => <button key={q} aria-pressed={config.quality === q} onClick={() => set({ quality: q })} className={`rounded-full border px-4 py-1.5 text-sm ${config.quality === q ? 'border-gold bg-gold/15 font-semibold' : 'border-white/20 bg-white/5'}`}>{q}</button>)}</div>
            </div>
          </div>);
      }
      case 5: return (
        <div>
          <div className="label mb-2">{SIZE_TITLE[design.category]}</div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {design.allowedSizes.map((s) => <Choice key={s} selected={config.size === s} onClick={() => set({ size: s })} className="text-center text-sm font-medium">{s}</Choice>)}
          </div>
          {design.category === 'ring' && user?.savedRingSize && design.allowedSizes.includes(user.savedRingSize) && (
            <button className="mt-3 text-sm text-gold-soft underline" onClick={() => set({ size: user.savedRingSize })}>Use my saved size ({user.savedRingSize})</button>
          )}
          <details className="mt-4 text-sm text-white/60"><summary className="cursor-pointer text-gold-soft">Size guide</summary>
            <p className="mt-2">Measure the inner diameter of a ring that fits well. Indian size 12 ≈ 17.2 mm inner diameter; each size adds about 0.4 mm. Not sure? We offer one free resize within 30 days.</p></details>
        </div>);
      case 6: return (
        <div className="space-y-4">
          <div>
            <label htmlFor="eng" className="label">Engraving (optional, up to {design.engravingMaxChars} characters)</label>
            <input id="eng" className="input mt-2" maxLength={design.engravingMaxChars} value={config.engraving} placeholder="e.g. A ♥ R" onChange={(e) => set({ engraving: e.target.value })} />
            <p className="mt-1 text-xs text-white/50">The 3D view shows engraving as a label only; the real engraving is laser-cut inside the piece.</p>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.giftBox} onChange={(e) => set({ giftBox: e.target.checked })} /> Premium gift box</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.insurance} onChange={(e) => set({ insurance: e.target.checked })} /> Insured delivery (recommended)</label>
        </div>);
      case 7: return (
        <div className="space-y-4">
          <SpecSummary design={design} config={config} quote={quote} metals={catalog.metals} stones={catalog.stones} />
          <PriceBreakdown quote={quote} loading={loading} />
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-ghost" disabled={!quote || !!pinned} onClick={() => setPinned({ design, config, quote })}>Pin to compare</button>
            {pinned && <button className="btn btn-ghost" onClick={() => setPinned(null)}>Stop comparing</button>}
            <button className="btn btn-ghost" disabled={!!busy || !quote} onClick={save}>{busy === 'save' ? 'Saving…' : 'Save design'}</button>
          </div>
          {pinned && quote && <CompareTable a={pinned} b={{ config, quote }} metals={catalog.metals} />}
          <button className="btn btn-gold w-full" disabled={!!busy || !quote || !!error} onClick={addToCart}>{busy === 'cart' ? 'Adding…' : `Add to cart · ${inr(quote?.price?.total)}`}</button>
        </div>);
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-[#07060a] text-white">
      {/* top bar */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-gold/20 bg-black px-3">
        <Link href="/" className="flex items-center gap-2" aria-label="Fringlale home"><Monogram className="h-9 w-9" /><span className="serif gold-text hidden text-lg tracking-[0.2em] sm:inline">FRINGLALE</span></Link>
        <span className="hidden h-5 w-px bg-white/20 sm:block" />
        <div className="min-w-0 flex-1 truncate text-sm"><span className="text-white/50">Design Studio</span>{design && <span className="text-gold-soft"> · {design.name}</span>}</div>
        <button className="btn btn-ghost !px-3 !py-1.5 text-xs text-white" onClick={undo} disabled={!hist.past.length} aria-label="Undo">↶</button>
        <button className="btn btn-ghost !px-3 !py-1.5 text-xs text-white" onClick={redo} disabled={!hist.future.length} aria-label="Redo">↷</button>
        {design && <button className="btn btn-ghost !hidden !px-3 !py-1.5 text-xs text-white sm:!inline-flex" onClick={share}>Share</button>}
        {design && <div className="hidden text-right sm:block" aria-live="polite"><div className="serif text-lg leading-none text-gold-soft tabular-nums" data-testid="live-price">{quote ? inr(quote.price.total) : '—'}</div></div>}
        <Link href="/cart" className="btn btn-gold !px-4 !py-1.5 text-xs">Cart</Link>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto lg:grid lg:grid-cols-[76px_minmax(0,1fr)_410px] lg:overflow-hidden">
        {/* viewport */}
        <div className="h-[46vh] shrink-0 p-2 lg:col-start-2 lg:row-start-1 lg:h-full lg:p-3">
          {design && config && catalog ? (
            <JewelViewer items={viewerItems} showBadges={false} className="flex h-full flex-col" heightClass="min-h-0 flex-1" />
          ) : (
            <div className="flex h-full items-center justify-center rounded-2xl bg-[radial-gradient(ellipse_at_50%_38%,#4a3510,#050403)] p-8 text-center">
              <div><img src="/brand/logo-full.png" alt="Fringlale" className="blend-screen mx-auto w-80 max-w-full" /><p className="mt-2 text-white/60">Choose a type and a base design to open the 3D editor.</p></div>
            </div>
          )}
        </div>

        {/* tool rail */}
        <nav aria-label="Design steps" className="flex gap-1 overflow-x-auto border-y border-white/10 bg-black/60 px-2 py-2 lg:col-start-1 lg:row-start-1 lg:flex-col lg:overflow-y-auto lg:border-y-0 lg:border-r lg:py-3">
          {STEPS.map((label, i) => {
            if (!visibleSteps.includes(i)) return null;
            const locked = i > reached + 0 && i > step;
            return (
              <button key={label} disabled={locked || (i > 1 && !design)} onClick={() => setStep(i)} aria-current={step === i ? 'step' : undefined}
                className={`flex shrink-0 flex-col items-center gap-1 rounded-xl px-3 py-2 text-[10px] uppercase tracking-wider transition lg:w-full ${step === i ? 'bg-gold text-black' : 'text-white/70 hover:bg-white/10'} disabled:opacity-30`}>
                <span className="text-lg leading-none" aria-hidden="true">{STEP_ICON[i]}</span><span>{label.split(' ')[0]}</span>
              </button>);
          })}
        </nav>

        {/* inspector */}
        <aside className="admin-glass border-l border-white/10 bg-[#0c0a07] p-4 lg:col-start-3 lg:row-start-1 lg:overflow-y-auto">
          <div className="flex items-center justify-between text-xs text-white/50"><span>Step {pos + 1} of {visibleSteps.length}</span><span className="text-gold-soft">{STEPS[step]}</span></div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={pos + 1} aria-valuemin={1} aria-valuemax={visibleSteps.length}>
            <div className="h-full rounded-full bg-gold transition-all duration-500" style={{ width: `${((pos + 1) / visibleSteps.length) * 100}%` }} />
          </div>

          <div className="mt-4 flex items-end justify-between">
            <h2 className="text-2xl text-gold-soft">{STEPS[step]}</h2>
            {design && step < 7 && <div className="text-right sm:hidden" aria-live="polite"><div className="label">Live price</div><div className={`serif text-xl tabular-nums ${loading ? 'opacity-50' : ''}`}>{quote ? inr(quote.price.total) : '—'}</div></div>}
          </div>

          {design && config && hasStoneOptions && step < 7 && step > 1 && (
            <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Quick looks">
              {LOOKS.map((l) => <button key={l.name} onClick={() => applyLook(l)} className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/75 hover:border-gold hover:text-gold-soft">{l.name}</button>)}
            </div>)}

          {error && <div role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm">{error}</div>}
          {msg?.err && <div role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm">{msg.err}</div>}
          {msg?.ok && <div role="status" className="mt-3 rounded-lg bg-emerald-500/15 p-3 text-sm text-emerald-200">{msg.ok}</div>}

          <div key={step} className="fade-up mt-4 min-h-[200px]">{body()}</div>

          {design && quote && <div className="mt-5"><SupportBadges support={quote.support} isProxy={false} parametric={viewerItems[viewerItems.length - 1]?.parametric} /></div>}

          <div className="sticky bottom-0 -mx-4 mt-6 flex items-center justify-between border-t border-white/10 bg-[#0c0a07]/95 px-4 py-3 backdrop-blur">
            <button className="btn btn-ghost text-white" onClick={() => go(-1)} disabled={pos <= 0}>Back</button>
            {step < 7 && <button className="btn btn-gold" onClick={() => go(1)} disabled={!canNext}>Next</button>}
          </div>
        </aside>
      </div>
    </div>
  );
}

function CompareTable({ a, b, metals }) {
  const label = (k) => metals.find((m) => m.key === k)?.label || k;
  const rows = [
    ['Metal', label(a.config.metal), label(b.config.metal)],
    ['Stone', a.config.stoneType ? `${a.config.carat}ct ${a.config.shape}` : 'None', b.config.stoneType ? `${b.config.carat}ct ${b.config.shape}` : 'None'],
    ['Size', a.config.size, b.config.size],
    ['Weight', `${a.quote.price.finalWeight} g`, `${b.quote.price.finalWeight} g`],
    ['Total', inr(a.quote.price.total), inr(b.quote.price.total)],
  ];
  const diff = b.quote.price.total - a.quote.price.total;
  return (
    <div className="card overflow-hidden text-sm">
      <table className="w-full"><thead className="bg-navy text-white"><tr><th className="p-2 text-left" /><th className="p-2 text-left">A (pinned)</th><th className="p-2 text-left">B (current)</th></tr></thead>
        <tbody>{rows.map(([k, x, y]) => <tr key={k} className={`border-t ${x !== y ? 'bg-gold/10' : ''}`}><td className="p-2 text-white/50">{k}</td><td className="p-2">{x}</td><td className="p-2">{y}</td></tr>)}</tbody></table>
      <div className="p-2 text-xs text-white/60">B is {diff === 0 ? 'the same price as' : `${inr(Math.abs(diff))} ${diff > 0 ? 'more' : 'less'} than`} A.</div>
    </div>
  );
}
