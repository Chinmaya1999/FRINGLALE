'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, uploadFiles } from '@/lib/api';
import { RequireAuth, useAuth } from '@/lib/auth';
import { STAGES, STAGE_LABELS, inr } from '@/lib/format';
import { Monogram } from '@/components/Logo';


const Err = ({ e }) => (e ? <p role="alert" className="my-2 rounded bg-red-50 p-2 text-sm text-red-800">{e}</p> : null);
const useAsync = () => {
  const [err, setErr] = useState(null);
  const run = async (fn) => { setErr(null); try { return await fn(); } catch (e) { setErr(e.message); } };
  return [err, run];
};

/* ---------- Dashboard ---------- */
const GOLD = '#E4CF98';

/** Single-series area/line chart: 2px line, recessive grid, crosshair + tooltip on hover, end-point direct label, table view. */
function SalesChart({ data }) {
  const [hover, setHover] = useState(null);
  const [table, setTable] = useState(false);
  const W = 720, H = 220, P = { l: 52, r: 18, t: 14, b: 26 };
  const max = Math.max(1, ...data.map((d) => d.sales));
  const x = (i) => P.l + (data.length === 1 ? (W - P.l - P.r) / 2 : (i / (data.length - 1)) * (W - P.l - P.r));
  const y = (v) => H - P.b - (v / max) * (H - P.t - P.b);
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.sales).toFixed(1)}`).join(' ');
  const area = data.length > 1 ? `${line} L${x(data.length - 1)},${H - P.b} L${x(0)},${H - P.b} Z` : '';
  const h = hover != null ? data[hover] : null;
  const total = data.reduce((t, d) => t + d.sales, 0);
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div><h3 className="text-lg text-navy">Sales collected</h3><p className="text-xs text-gray-500">Last 30 days · {inr(total)} across {data.reduce((t, d) => t + d.orders, 0)} orders</p></div>
        <button className="btn btn-ghost !px-3 !py-1 text-xs" aria-pressed={table} onClick={() => setTable(!table)}>{table ? 'Chart' : 'Table'}</button>
      </div>
      {!data.length ? <p className="mt-6 text-sm text-gray-500">No paid orders in the last 30 days.</p> : table ? (
        <div className="mt-3 max-h-56 overflow-auto text-sm"><table className="w-full"><thead className="text-left text-gray-500"><tr><th className="py-1">Date</th><th>Orders</th><th className="text-right">Sales</th></tr></thead><tbody>{[...data].reverse().map((d) => <tr key={d._id} className="border-t"><td className="py-1">{d._id}</td><td>{d.orders}</td><td className="text-right tabular-nums">{inr(d.sales)}</td></tr>)}</tbody></table></div>
      ) : (
        <div className="relative mt-3">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Daily sales over the last 30 days, total ${inr(total)}`}
            onMouseLeave={() => setHover(null)}
            onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const t = ((e.clientX - r.left) / r.width * W - P.l) / (W - P.l - P.r); setHover(Math.max(0, Math.min(data.length - 1, Math.round(t * (data.length - 1))))); }}>
            <defs><linearGradient id="sa" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={GOLD} stopOpacity=".28" /><stop offset="1" stopColor={GOLD} stopOpacity="0" /></linearGradient></defs>
            {[0, 0.5, 1].map((t) => <g key={t}><line x1={P.l} x2={W - P.r} y1={y(max * t)} y2={y(max * t)} stroke="rgba(255,255,255,.1)" /><text x={P.l - 8} y={y(max * t) + 4} fontSize="11" textAnchor="end" fill="rgba(255,255,255,.55)">{max * t >= 1000 ? `${Math.round((max * t) / 1000)}k` : Math.round(max * t)}</text></g>)}
            {area && <path d={area} fill="url(#sa)" />}
            <path d={line} fill="none" stroke={GOLD} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            <text x={P.l} y={H - 6} fontSize="11" fill="rgba(255,255,255,.55)">{data[0]._id.slice(5)}</text>
            <text x={W - P.r} y={H - 6} fontSize="11" textAnchor="end" fill="rgba(255,255,255,.55)">{data.at(-1)._id.slice(5)}</text>
            {hover != null && <g><line x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} stroke="rgba(255,255,255,.3)" /><circle cx={x(hover)} cy={y(h.sales)} r="5" fill={GOLD} stroke="#0c0a07" strokeWidth="2" /></g>}
            {hover == null && <circle cx={x(data.length - 1)} cy={y(data.at(-1).sales)} r="4" fill={GOLD} stroke="#0c0a07" strokeWidth="2" />}
          </svg>
          {h && <div className="pointer-events-none absolute top-0 rounded-lg border border-white/15 bg-black/80 px-3 py-2 text-xs backdrop-blur" style={{ left: `${(x(hover) / W) * 100}%`, transform: `translateX(${hover > data.length / 2 ? '-110%' : '10%'})` }}><div className="text-white/60">{h._id}</div><div className="serif text-base text-gold-soft">{inr(h.sales)}</div><div className="text-white/60">{h.orders} order{h.orders === 1 ? '' : 's'}</div></div>}
        </div>)}
    </div>);
}

/** Horizontal bars: one hue, 4px rounded data ends on a shared baseline, labels in text ink, value at the end of the bar. */
function Bars({ title, rows, fmt = (v) => v, empty }) {
  const max = Math.max(1, ...rows.map((r) => r.v));
  return (
    <div className="card p-5"><h3 className="text-lg text-navy">{title}</h3>
      {!rows.length ? <p className="mt-4 text-sm text-gray-500">{empty}</p> : (
        <ul className="mt-4 space-y-3" role="list">{rows.map((r) => (
          <li key={r.k} title={`${r.k}: ${fmt(r.v)}`}><div className="flex justify-between text-xs"><span className="text-white/80">{r.k}</span><span className="tabular-nums text-gray-500">{fmt(r.v)}</span></div>
            <div className="mt-1 h-2 rounded-full bg-white/10"><div className="h-2 rounded-full" style={{ width: `${Math.max(3, (r.v / max) * 100)}%`, background: 'linear-gradient(90deg,#8f6a1f,#E4CF98)' }} /></div></li>))}</ul>)}
    </div>);
}

function Stat({ label, value, hint }) {
  return <div className="card relative overflow-hidden p-5"><div className="label">{label}</div><div className="serif mt-2 text-3xl text-white tabular-nums">{value}</div>{hint && <div className="mt-1 text-xs text-gray-500">{hint}</div>}<div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gold/10 blur-2xl" /></div>;
}

function Dashboard() {
  const [d, setD] = useState(null);
  useEffect(() => { api('/admin/dashboard').then(setD); }, []);
  if (!d) return <p className="text-gray-500">Loading…</p>;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Revenue collected" value={inr(d.revenue)} hint="payments captured, all time" />
        <Stat label="Orders" value={d.orderCount} hint={`${d.ordersByStage.filter((s) => s._id !== 'delivered').reduce((t, s) => t + s.n, 0)} in progress`} />
        <Stat label="Customers" value={d.customers} />
        <Stat label="Needs attention" value={d.newRequests + d.pendingConsultations} hint={`${d.newRequests} requests · ${d.pendingConsultations} consultations`} />
      </div>
      <SalesChart data={d.daily} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Bars title="Orders by stage" empty="No orders yet." rows={d.ordersByStage.map((s) => ({ k: STAGE_LABELS[s._id], v: s.n })).sort((a, b) => STAGES.findIndex((x) => STAGE_LABELS[x] === a.k) - STAGES.findIndex((x) => STAGE_LABELS[x] === b.k))} />
        <Bars title="Top designs (units)" empty="No sales yet." rows={d.topDesigns.map((s) => ({ k: s._id, v: s.units }))} />
      </div>
    </div>);
}

/* ---------- Orders ---------- */
function Orders() {
  const [items, setItems] = useState([]);
  const [sel, setSel] = useState(null);
  const [err, run] = useAsync();
  const [f, setF] = useState({ huid: '', trackingNumber: '', courier: '', note: '' });
  const load = useCallback(() => api('/admin/orders').then((r) => setItems(r.items)), []);
  useEffect(() => { load(); }, [load]);
  const open = async (id) => { const { order } = await api(`/admin/orders/${id}`); setSel(order); setF({ huid: order.huid || '', trackingNumber: order.trackingNumber || '', courier: order.courier || '', note: '' }); };
  const next = sel && STAGES[STAGES.indexOf(sel.stage) + 1];
  const upload = (key) => async (e) => run(async () => {
    const files = await uploadFiles(e.target.files);
    const body = key === 'approvalMedia' ? { approvalMedia: files.map((x) => x.url) } : { certificates: files.map((x) => ({ name: x.name.slice(0, 80), url: x.url })) };
    await api(`/admin/orders/${sel._id}`, { method: 'PATCH', body }); await open(sel._id);
  });
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <div className="card divide-y">{items.map((o) => <button key={o._id} onClick={() => open(o._id)} className={`flex w-full justify-between p-3 text-left text-sm hover:bg-ivory ${sel?._id === o._id ? 'bg-ivory' : ''}`}><span><strong>{o.orderNo}</strong><br /><span className="text-gray-500">{o.user?.name || o.user?.email || o.user?.mobile}</span></span><span className="text-right">{STAGE_LABELS[o.stage]}<br /><span className="text-gray-500">{o.payment.status}</span></span></button>)}{!items.length && <p className="p-4 text-sm text-gray-500">No orders.</p>}</div>
      {sel && (
        <div className="card space-y-3 p-4 text-sm">
          <h3 className="serif text-xl text-navy">{sel.orderNo} · {STAGE_LABELS[sel.stage]}</h3>
          <Err e={err} />
          <p>Paid {inr(sel.payment.paid, 2)} of {inr(sel.priceBreakdown.total, 2)} · approval: <strong>{sel.approval.status}</strong></p>
          <div className="flex flex-wrap gap-2">
            {next && <button className="btn btn-navy !py-1.5" onClick={() => run(async () => { await api(`/admin/orders/${sel._id}/stage`, { method: 'POST', body: { stage: next, note: f.note || undefined } }); await open(sel._id); load(); })}>Advance to {STAGE_LABELS[next]}</button>}
            <input className="input flex-1" placeholder="Note for timeline (optional)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <input className="input" placeholder="HUID (6 chars)" value={f.huid} onChange={(e) => setF({ ...f, huid: e.target.value.toUpperCase() })} />
            <input className="input" placeholder="Courier" value={f.courier} onChange={(e) => setF({ ...f, courier: e.target.value })} />
            <input className="input" placeholder="Tracking no." value={f.trackingNumber} onChange={(e) => setF({ ...f, trackingNumber: e.target.value })} />
          </div>
          <button className="btn btn-ghost !py-1.5" onClick={() => run(async () => { await api(`/admin/orders/${sel._id}`, { method: 'PATCH', body: Object.fromEntries(Object.entries({ huid: f.huid, courier: f.courier, trackingNumber: f.trackingNumber }).filter(([, v]) => v)) }); await open(sel._id); })}>Save HUID / shipping</button>
          <label className="block"><span className="label">CAD render / wax photos (shown to customer for approval)</span><input type="file" multiple accept="image/*,application/pdf" onChange={upload('approvalMedia')} className="mt-1 block" /></label>
          {sel.approval.media.length > 0 && <p className="text-xs text-gray-500">{sel.approval.media.length} file(s) attached.</p>}
          {sel.approval.comment && <p className="rounded bg-amber-50 p-2">Customer comment: {sel.approval.comment}</p>}
          <label className="block"><span className="label">Certificates (IGI/GIA, hallmark)</span><input type="file" multiple accept="image/*,application/pdf" onChange={upload('certificates')} className="mt-1 block" /></label>
          <details><summary className="cursor-pointer">Items &amp; address</summary><pre className="mt-2 overflow-auto text-xs">{JSON.stringify({ address: sel.address, items: sel.items.map((i) => ({ name: i.designName, config: i.config, qty: i.qty })) }, null, 2)}</pre></details>
        </div>)}
    </div>);
}

/* ---------- Designs ---------- */
const csv = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);
function Designs() {
  const [items, setItems] = useState([]);
  const [f, setF] = useState(null);
  const [err, run] = useAsync();
  const load = useCallback(() => api('/admin/designs').then((r) => setItems(r.items)), []);
  useEffect(() => { load(); }, [load]);
  const edit = (d) => setF(d ? { ...d, _allowedMetals: d.allowedMetals.join(', '), _stoneTypes: d.allowedStoneTypes.join(', '), _shapes: d.allowedShapes.join(', '), _qualities: d.allowedQualities.join(', '), _sizes: d.allowedSizes.join(', '), _occ: (d.occasions || []).join(', '), _model: JSON.stringify(d.model3d || {}, null, 2), _sim: (d.simulated || []).join(', ') }
    : { slug: '', name: '', category: 'ring', description: '', baseWeight: 3, makingType: 'percent', makingValue: 12, caratRange: { min: 0.2, max: 3 }, engravingMaxChars: 15, isActive: true, featured: false, _allowedMetals: 'yellow-18K, white-18K', _stoneTypes: '', _shapes: '', _qualities: '', _sizes: '12', _occ: '', _model: '{}', _sim: 'model-proxy', images: [] });
  const save = () => run(async () => {
    const body = { slug: f.slug, name: f.name, category: f.category, description: f.description, baseWeight: Number(f.baseWeight), makingType: f.makingType, makingValue: Number(f.makingValue),
      caratRange: { min: Number(f.caratRange.min), max: Number(f.caratRange.max) }, engravingMaxChars: Number(f.engravingMaxChars), isActive: f.isActive, featured: f.featured, images: f.images,
      allowedMetals: csv(f._allowedMetals), allowedStoneTypes: csv(f._stoneTypes), allowedShapes: csv(f._shapes), allowedQualities: csv(f._qualities), allowedSizes: csv(f._sizes), occasions: csv(f._occ), simulated: csv(f._sim), model3d: JSON.parse(f._model || '{}') };
    await (f._id ? api(`/admin/designs/${f._id}`, { method: 'PUT', body }) : api('/admin/designs', { method: 'POST', body }));
    setF(null); load();
  });
  const upl = (target) => async (e) => run(async () => {
    const [file] = await uploadFiles(e.target.files);
    if (target === 'images') setF({ ...f, images: [...f.images, file.url] });
    else { const m = JSON.parse(f._model || '{}'); m.primaryGlbUrl = file.url; setF({ ...f, _model: JSON.stringify(m, null, 2) }); }
  });
  const F = (k, label, props = {}) => <label className="block"><span className="label">{label}</span><input className="input mt-1" value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...props} /></label>;
  if (f) return (
    <div className="card space-y-3 p-5 text-sm">
      <Err e={err} />
      <div className="grid gap-3 sm:grid-cols-2">{F('name', 'Name')}{F('slug', 'Slug')}
        <label><span className="label">Category</span><select className="input mt-1" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{['ring', 'pendant', 'earring', 'necklace', 'bangle'].map((c) => <option key={c}>{c}</option>)}</select></label>
        {F('baseWeight', 'Base weight (g, 18K, default size)', { type: 'number', step: '0.01' })}
        <label><span className="label">Making type</span><select className="input mt-1" value={f.makingType} onChange={(e) => setF({ ...f, makingType: e.target.value })}><option value="percent">% of metal price</option><option value="perGram">₹ per gram</option></select></label>
        {F('makingValue', 'Making value', { type: 'number' })}
        {F('_allowedMetals', 'Allowed metals (comma-separated keys)')}{F('_sizes', 'Allowed sizes')}
        {F('_stoneTypes', 'Allowed stone types (blank = no stone)')}{F('_shapes', 'Allowed shapes')}{F('_qualities', 'Allowed qualities')}{F('_occ', 'Occasions')}
        {F('_sim', 'Simulated features (comma-separated)')}
      </div>
      <label className="block"><span className="label">Description</span><textarea className="input mt-1" rows={2} value={f.description || ''} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
      <label className="block"><span className="label">3D model JSON (assetVariants, assetBackedMetals, explodedView, components, annotations, dimensionsMm) — see docs/MODEL_ASSET_SPEC.md</span><textarea className="input mt-1 font-mono text-xs" rows={9} value={f._model} onChange={(e) => setF({ ...f, _model: e.target.value })} /></label>
      <div className="flex flex-wrap gap-4"><label>Upload GLB: <input type="file" accept=".glb" onChange={upl('glb')} /></label><label>Add image: <input type="file" accept="image/*" onChange={upl('images')} /></label></div>
      <p className="text-xs text-gray-500">{f.images?.length || 0} image(s). {f.manufacturing && `Manufacturing: ${f.manufacturing.status} (change below).`}</p>
      <label className="flex gap-2"><input type="checkbox" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} /> Active</label>
      <label className="flex gap-2"><input type="checkbox" checked={f.featured} onChange={(e) => setF({ ...f, featured: e.target.checked })} /> Featured on home</label>
      <div className="flex gap-2"><button className="btn btn-navy" onClick={save}>Save design</button><button className="btn btn-ghost" onClick={() => setF(null)}>Cancel</button></div>
    </div>);
  return (
    <div className="space-y-3"><button className="btn btn-gold" onClick={() => edit(null)}>New design</button><Err e={err} />
      <div className="card divide-y">{items.map((d) => (
        <div key={d._id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
          <div><strong>{d.name}</strong> <span className="text-gray-500">({d.category}{d.isActive ? '' : ', inactive'})</span></div>
          <div className="flex items-center gap-2">
            <select aria-label="Manufacturing status" className="input !w-auto !py-1" value={d.manufacturing?.status || 'concept'} onChange={(e) => run(async () => { await api(`/admin/designs/${d._id}/manufacturing`, { method: 'POST', body: { status: e.target.value } }); load(); })}>
              <option value="concept">Concept</option><option value="cad_ready">CAD ready</option><option value="approved_for_manufacturing">Approved for manufacturing</option></select>
            <button className="btn btn-ghost !py-1" onClick={() => edit(d)}>Edit</button></div>
        </div>))}</div></div>);
}

/* ---------- Generic JSON-backed resource manager (metals, stones, prices, coupons) ---------- */
function Resource({ path, title, blank, cols }) {
  const [items, setItems] = useState([]);
  const [json, setJson] = useState(null);
  const [id, setId] = useState(null);
  const [err, run] = useAsync();
  const load = useCallback(() => api(`/admin/${path}`).then((r) => setItems(r.items)), [path]);
  useEffect(() => { load(); }, [load]);
  const strip = ({ _id, __v, createdAt, updatedAt, ...rest }) => rest;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between"><h3 className="text-lg text-navy">{title}</h3><button className="btn btn-gold !py-1.5" onClick={() => { setId(null); setJson(JSON.stringify(blank, null, 2)); }}>Add</button></div>
      <Err e={err} />
      {json !== null && <div className="card space-y-2 p-3"><textarea className="input font-mono text-xs" rows={12} value={json} onChange={(e) => setJson(e.target.value)} />
        <div className="flex gap-2"><button className="btn btn-navy !py-1.5" onClick={() => run(async () => { const body = JSON.parse(json); await (id ? api(`/admin/${path}/${id}`, { method: 'PUT', body }) : api(`/admin/${path}`, { method: 'POST', body })); setJson(null); load(); })}>Save</button><button className="btn btn-ghost !py-1.5" onClick={() => setJson(null)}>Cancel</button></div></div>}
      <div className="card max-h-[60vh] divide-y overflow-auto text-sm">{items.map((it) => <div key={it._id} className="flex items-center justify-between gap-2 p-2.5"><span>{cols(it)}</span><span className="flex gap-2"><button className="underline" onClick={() => { setId(it._id); setJson(JSON.stringify(strip(it), null, 2)); }}>Edit</button><button className="text-red-700 underline" onClick={() => confirm('Delete?') && run(async () => { await api(`/admin/${path}/${it._id}`, { method: 'DELETE' }); load(); })}>Delete</button></span></div>)}</div>
    </div>);
}

function PricingData() {
  return (
    <div className="space-y-10">
      <Settings />
      <Resource path="metals" title="Metals & karats" blank={{ key: 'yellow-20K', family: 'yellow', karat: '20K', label: '20K Yellow Gold', rateKey: '22K', densityFactor: 1.05, hex: '#DDB04A' }} cols={(m) => `${m.label} — rate ${m.rateKey}, density ×${m.densityFactor}`} />
      <Resource path="stones" title="Stones" blank={{ key: 'tanzanite', label: 'Tanzanite', kind: 'gem', ior: 1.69, hex: '#4B3F9E' }} cols={(s) => `${s.label} (${s.kind})`} />
      <Resource path="stone-prices" title="Stone price matrix (₹ per carat)" blank={{ stoneType: 'ruby', shape: 'round', quality: 'AAA', pricePerCarat: 65000 }} cols={(p) => `${p.stoneType} · ${p.shape} · ${p.quality} — ${inr(p.pricePerCarat)}/ct`} />
    </div>);
}

function Settings() {
  const [s, setS] = useState({});
  const [err, run] = useAsync();
  const [ok, setOk] = useState(null);
  useEffect(() => { api('/admin/settings').then((r) => setS(Object.fromEntries(r.items.map((x) => [x.key, x.value])))); }, []);
  const put = (key, value) => run(async () => { await api(`/admin/settings/${key}`, { method: 'PUT', body: { value } }); setOk(`${key} saved`); });
  const J = (key) => <label className="block"><span className="label">{key} (JSON)</span><textarea className="input mt-1 font-mono text-xs" rows={key === 'sizeFactors' ? 8 : 3} value={typeof s[key] === 'string' ? s[key] : JSON.stringify(s[key] ?? {}, null, 2)} onChange={(e) => setS({ ...s, [key]: e.target.value })} />
    <button className="btn btn-ghost mt-1 !py-1" onClick={() => { try { put(key, typeof s[key] === 'string' ? JSON.parse(s[key]) : s[key]); } catch { run(async () => { throw new Error('Invalid JSON'); }); } }}>Save {key}</button></label>;
  return (
    <div className="card space-y-3 p-4 text-sm"><h3 className="text-lg text-navy">Pricing settings</h3><Err e={err} />{ok && <p className="text-emerald-800">{ok}</p>}
      <label className="block max-w-xs"><span className="label">GST %</span><input type="number" className="input mt-1" value={s.gstPercent ?? 3} onChange={(e) => setS({ ...s, gstPercent: Number(e.target.value) })} /><button className="btn btn-ghost mt-1 !py-1" onClick={() => put('gstPercent', s.gstPercent ?? 3)}>Save GST</button></label>
      <div className="grid gap-4 md:grid-cols-2">{J('extras')}{J('shipping')}{J('sizeFactors')}</div></div>);
}

/* ---------- Gold rate ---------- */
function GoldRate() {
  const [cur, setCur] = useState(null);
  const [hist, setHist] = useState([]);
  const [r, setR] = useState({});
  const [err, run] = useAsync();
  const load = useCallback(() => { api('/gold-rates/today').then((t) => { setCur(t); setR(t.rates); }); api('/gold-rates/history?days=30').then((h) => setHist(h.items)); }, []);
  useEffect(() => { load(); }, [load]);
  const keys = ['24K', '22K', '18K', '14K', 'platinum', 'silver'];
  return (
    <div className="space-y-4"><div className="card space-y-3 p-4 text-sm"><h3 className="text-lg text-navy">Manual override</h3>
      <p className="text-gray-600">Current: {cur ? `${cur.date} (${cur.source})` : '…'}. A manual entry becomes the live rate immediately and is added to history. The daily 09:30 IST job will replace it only if a rate feed is configured.</p><Err e={err} />
      <div className="grid gap-3 sm:grid-cols-3">{keys.map((k) => <label key={k}><span className="label">{k} ₹/g</span><input type="number" className="input mt-1" value={r[k] ?? ''} onChange={(e) => setR({ ...r, [k]: Number(e.target.value) })} /></label>)}</div>
      <button className="btn btn-navy" onClick={() => run(async () => { await api('/gold-rates', { method: 'POST', body: { rates: Object.fromEntries(keys.map((k) => [k, Number(r[k])])) } }); load(); })}>Publish rate</button></div>
      <div className="card max-h-80 overflow-auto text-sm"><table className="w-full"><thead><tr className="text-left text-gray-500"><th className="p-2">Date</th><th>24K</th><th>22K</th><th>18K</th><th>Source</th></tr></thead><tbody>{[...hist].reverse().map((h) => <tr key={h.date} className="border-t"><td className="p-2">{h.date}</td><td>{h.rates['24K']}</td><td>{h.rates['22K']}</td><td>{h.rates['18K']}</td><td>{h.source}</td></tr>)}</tbody></table></div></div>);
}

/* ---------- Requests / consultations ---------- */
function Requests() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [designers, setDesigners] = useState([]);
  const [err, run] = useAsync();
  const load = useCallback(() => { api('/admin/requests').then((r) => setItems(r.items)); if (user.role === 'admin') api('/admin/designers').then((r) => setDesigners(r.items)); }, [user.role]);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="space-y-3"><Err e={err} />{user.role === 'designer' && <p className="text-sm text-gray-600">You see only requests assigned to you.</p>}
      {items.map((q) => (
        <div key={q._id} className="card space-y-2 p-4 text-sm">
          <div className="flex justify-between"><strong>{q.category} · {q.user?.name || q.user?.email || q.user?.mobile}</strong><span>{q.status}</span></div>
          <p>{q.description}</p>{q.budgetMax && <p className="text-gray-500">Budget {inr(q.budgetMin)}–{inr(q.budgetMax)}</p>}
          <div className="flex flex-wrap gap-2">{q.files.map((f) => <a key={f} href={f} target="_blank" rel="noreferrer" className="underline">Reference</a>)}</div>
          {user.role === 'admin' && <select className="input !w-auto" value={q.assignedDesigner?._id || ''} onChange={(e) => e.target.value && run(async () => { await api(`/admin/requests/${q._id}/assign`, { method: 'POST', body: { designerId: e.target.value } }); load(); })}><option value="">Assign designer…</option>{designers.map((d) => <option key={d._id} value={d._id}>{d.name || d.email}</option>)}</select>}
          <label>Upload CAD: <input type="file" multiple onChange={(e) => run(async () => { const fs = await uploadFiles(e.target.files); await api(`/admin/requests/${q._id}/cad`, { method: 'POST', body: { files: fs.map((x) => x.url) } }); load(); })} /></label>
        </div>))}{!items.length && <p className="text-gray-500">Nothing here.</p>}</div>);
}

function Consultations() {
  const [items, setItems] = useState([]);
  const [err, run] = useAsync();
  const load = useCallback(() => api('/admin/consultations').then((r) => setItems(r.items)), []);
  useEffect(() => { load(); }, [load]);
  return <div className="card divide-y text-sm"><Err e={err} />{items.map((c) => <div key={c._id} className="flex flex-wrap items-center justify-between gap-2 p-3"><span>{c.date} {c.slot} · {c.mode} · {c.user?.name || c.user?.email || c.user?.mobile}</span>
    <span className="flex gap-2"><select className="input !w-auto !py-1" value={c.status} onChange={(e) => run(async () => { await api(`/admin/consultations/${c._id}`, { method: 'PUT', body: { status: e.target.value } }); load(); })}>{['booked', 'confirmed', 'completed', 'cancelled'].map((s) => <option key={s}>{s}</option>)}</select>
      <button className="underline" onClick={() => { const u = prompt('Meeting link (https://…)', c.meetingLink || ''); if (u) run(async () => { await api(`/admin/consultations/${c._id}`, { method: 'PUT', body: { meetingLink: u } }); load(); }); }}>Link</button></span></div>)}{!items.length && <p className="p-3 text-gray-500">No bookings.</p>}</div>;
}

function Reviews() {
  const [items, setItems] = useState([]);
  const [err, run] = useAsync();
  const load = useCallback(() => api('/admin/reviews').then((r) => setItems(r.items)), []);
  useEffect(() => { load(); }, [load]);
  return <div className="card divide-y text-sm"><Err e={err} />{items.map((r) => <div key={r._id} className="flex justify-between gap-3 p-3"><div>{'★'.repeat(r.rating)} <strong>{r.title}</strong><p className="text-gray-600">{r.body}</p></div>
    <button className="btn btn-ghost !py-1" onClick={() => run(async () => { await api(`/admin/reviews/${r._id}`, { method: 'PUT', body: { approved: !r.approved } }); load(); })}>{r.approved ? 'Unpublish' : 'Publish'}</button></div>)}{!items.length && <p className="p-3 text-gray-500">No reviews.</p>}</div>;
}

function CMS() {
  return <div className="space-y-6"><CmsKey k="cms:testimonials" title="Testimonials" sample={[{ name: 'Customer name', text: 'Real feedback, with permission.' }]} /><CmsKey k="cms:banners" title="Banners" sample={[{ title: 'Festive offer', image: '/uploads/…', href: '/shop' }]} /></div>;
}
function CmsKey({ k, title, sample }) {
  const [v, setV] = useState(null);
  const [err, run] = useAsync();
  const [ok, setOk] = useState(false);
  useEffect(() => { api('/admin/settings').then((r) => setV(JSON.stringify(r.items.find((x) => x.key === k)?.value ?? sample, null, 2))); }, [k, sample]);
  return <div className="card space-y-2 p-4"><h3 className="text-lg text-navy">{title}</h3><Err e={err} /><textarea className="input font-mono text-xs" rows={8} value={v ?? ''} onChange={(e) => { setV(e.target.value); setOk(false); }} />
    <button className="btn btn-navy !py-1.5" onClick={() => run(async () => { await api(`/admin/settings/${k}`, { method: 'PUT', body: { value: JSON.parse(v) } }); setOk(true); })}>Save</button>{ok && <span className="ml-2 text-sm text-emerald-800">Saved</span>}</div>;
}

function Customers() {
  const [items, setItems] = useState([]);
  const [err, run] = useAsync();
  const load = useCallback(() => api('/admin/customers').then((r) => setItems(r.items)), []);
  useEffect(() => { load(); }, [load]);
  return <div className="card divide-y text-sm"><Err e={err} />{items.map((c) => <div key={c._id} className="flex items-center justify-between p-3"><span>{c.name || '—'} · {c.email || c.mobile}</span>
    <select aria-label="Role" className="input !w-auto !py-1" value="customer" onChange={(e) => run(async () => { await api(`/admin/users/${c._id}/role`, { method: 'POST', body: { role: e.target.value } }); load(); })}><option value="customer">customer</option><option value="designer">designer</option><option value="admin">admin</option></select></div>)}</div>;
}

const NAV = [
  ['Overview', [['Dashboard', '◧'], ['Orders', '▤'], ['Requests', '✎'], ['Consultations', '☎']]],
  ['Catalogue', [['Designs', '◇'], ['Pricing data', '₹'], ['Gold rate', '◉'], ['Coupons', '%']]],
  ['Community', [['Reviews', '★'], ['CMS', '▦'], ['Customers', '☺']]],
];

function Inner() {
  const { user, signOut } = useAuth();
  const designer = user.role === 'designer';
  const [tab, setTab] = useState(designer ? 'Requests' : 'Dashboard');
  const [open, setOpen] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const groups = designer ? [['Workspace', [['Requests', '✎']]]] : NAV;
  const View = { Dashboard, Orders, Designs, 'Pricing data': PricingData, 'Gold rate': GoldRate, Requests, Consultations, Coupons: () => <Resource path="coupons" title="Coupons" blank={{ code: 'FESTIVE10', type: 'percent', value: 10, maxDiscount: 5000, minOrder: 10000, isActive: true }} cols={(c) => `${c.code} — ${c.type === 'percent' ? c.value + '%' : inr(c.value)} (used ${c.used})`} />, Reviews, CMS, Customers }[tab];

  const Nav = ({ collapsed }) => (
    <nav aria-label="Admin" className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {groups.map(([g, items]) => (
        <div key={g}>
          {!collapsed && <div className="label mb-2 px-3 !text-[10px]">{g}</div>}
          <ul className="space-y-1">{items.map(([t, icon]) => (
            <li key={t}><button onClick={() => { setTab(t); setDrawer(false); }} aria-current={tab === t ? 'page' : undefined} title={t}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${tab === t ? 'bg-gold/20 text-gold-soft shadow-[inset_0_0_0_1px_rgba(201,162,74,.45)]' : 'text-white/70 hover:bg-white/10'}`}>
              <span className="w-5 text-center text-base" aria-hidden="true">{icon}</span>{!collapsed && <span>{t}</span>}</button></li>))}</ul>
        </div>))}
    </nav>
  );

  return (
    <div className="admin-glass fixed inset-0 z-30 flex bg-[#07060a] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_15%_0%,rgba(201,162,74,.28),transparent_45%),radial-gradient(ellipse_at_90%_100%,rgba(56,189,248,.12),transparent_40%),radial-gradient(ellipse_at_70%_20%,rgba(120,60,200,.12),transparent_40%)]" />
      {/* desktop sidebar */}
      <aside className={`glass relative z-10 m-3 hidden shrink-0 flex-col transition-[width] duration-300 lg:flex ${open ? 'w-64' : 'w-[76px]'}`}>
        <div className="flex h-16 items-center gap-2 border-b border-white/10 px-4"><Monogram className="h-9 w-9 shrink-0" />{open && <span className="serif gold-text text-lg tracking-[0.18em]">FRINGLALE</span>}</div>
        <Nav collapsed={!open} />
        <div className="space-y-2 border-t border-white/10 p-3">
          <button onClick={() => setOpen(!open)} className="w-full rounded-xl px-3 py-2 text-left text-xs text-white/60 hover:bg-white/10" aria-label="Toggle sidebar">{open ? '« Collapse' : '»'}</button>
          {open && <div className="px-3 text-xs text-white/50"><div className="truncate text-white/80">{user.name || user.email}</div><div className="capitalize">{user.role}</div></div>}
        </div>
      </aside>
      {/* mobile drawer */}
      {drawer && <div className="fixed inset-0 z-40 bg-black/70 lg:hidden" onClick={() => setDrawer(false)}><aside className="glass absolute inset-y-0 left-0 flex w-64 flex-col bg-[#0c0a07]" onClick={(e) => e.stopPropagation()}><div className="flex h-16 items-center gap-2 border-b border-white/10 px-4"><Monogram className="h-9 w-9" /><span className="serif gold-text text-lg tracking-[0.18em]">FRINGLALE</span></div><Nav /></aside></div>}

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="m-3 mb-0 flex h-14 shrink-0 items-center gap-3 px-1">
          <button className="btn btn-ghost !px-3 !py-1.5 text-xs lg:!hidden" onClick={() => setDrawer(true)} aria-label="Open menu">☰</button>
          <h1 className="serif text-2xl text-gold-soft">{tab}</h1>
          <div className="ml-auto flex items-center gap-2 text-xs">
            <a href="/" className="btn btn-ghost !px-3 !py-1.5 text-xs">View site ↗</a>
            <button className="btn btn-ghost !px-3 !py-1.5 text-xs" onClick={signOut}>Sign out</button>
          </div>
        </header>
        <main data-lenis-prevent className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pt-3"><View /></main>
      </div>
    </div>
  );
}
export default function AdminClient() { return <RequireAuth roles={['admin', 'designer']}><Inner /></RequireAuth>; }
