'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, download } from '@/lib/api';
import { RequireAuth } from '@/lib/auth';
import { STAGE_LABELS, inr } from '@/lib/format';

const TABS = [['orders', 'Orders'], ['saved', 'Saved designs'], ['wishlist', 'Wishlist'], ['profile', 'Profile & addresses'], ['requests', 'Custom requests']];

function Inner() {
  const [tab, setTab] = useState('orders');
  const [d, setD] = useState({});
  const [msg, setMsg] = useState(null);
  const [addr, setAddr] = useState({ name: '', phone: '', line1: '', city: '', state: '', pincode: '' });

  const load = useCallback(async () => {
    const [acc, orders, saved, reqs, cons] = await Promise.all([api('/account'), api('/orders'), api('/saved-designs'), api('/custom-requests'), api('/consultations')]);
    setD({ user: acc.user, orders: orders.items, saved: saved.items, reqs: reqs.items, cons: cons.items });
  }, []);
  useEffect(() => { load().catch((e) => setMsg(e.message)); }, [load]);

  if (!d.user) return <div className="p-16 text-center text-gray-500">{msg || 'Loading…'}</div>;
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(null), 3000); };

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-[220px_1fr]">
      <aside className="md:sticky md:top-24 md:self-start">
        <div className="card p-5"><div className="label">Welcome back</div><h1 className="serif mt-1 text-2xl text-navy">{d.user.name || 'there'}</h1><p className="text-xs text-[#3A0F1B]/50">{d.user.email || d.user.mobile}</p></div>
        <div className="mt-4 flex gap-2 overflow-x-auto md:flex-col" role="tablist" aria-orientation="vertical">{TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`shrink-0 px-4 py-2.5 text-left text-sm transition ${tab === k ? 'bg-navy text-white' : 'text-[#3A0F1B]/75 hover:bg-[#3A0F1B]/10'}`}>{l}</button>)}</div>
      </aside>
      <div>
      {msg && <p role="status" className="mb-3 text-sm text-emerald-700">{msg}</p>}
      <div className="space-y-3">
        {tab === 'orders' && (d.orders.length ? d.orders.map((o) => (
          <div key={o._id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <div><Link href={`/orders/${o._id}`} className="serif text-lg text-navy underline">{o.orderNo}</Link>
              <div className="text-sm text-gray-600">{STAGE_LABELS[o.stage]} · {new Date(o.createdAt).toLocaleDateString('en-IN')} · payment {o.payment.status}</div></div>
            <div className="flex items-center gap-3"><span className="tabular-nums">{inr(o.priceBreakdown.total)}</span>
              {o.payment.paid > 0 && <button className="btn btn-ghost !py-1.5 text-xs" onClick={() => download(`/orders/${o._id}/invoice`, `${o.orderNo}.pdf`).catch((e) => flash(e.message))}>Invoice PDF</button>}</div>
          </div>)) : <p className="text-gray-600">No orders yet. <Link className="underline" href="/design">Design your first jewel</Link>.</p>)}

        {tab === 'saved' && (d.saved.length ? d.saved.map((s) => (
          <div key={s._id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <div><div className="serif text-lg text-navy">{s.name}</div><div className="text-sm text-gray-600">{s.config.metal} · size {s.config.size}{s.config.stoneType ? ` · ${s.config.carat} ct ${s.config.shape}` : ''}</div>
              <div className="text-xs text-gray-500">Last quoted {inr(s.lastQuote?.total)} on {s.lastQuote?.goldRateDate} — current price shown when you reopen it.</div></div>
            <div className="flex gap-2"><Link className="btn btn-navy !py-1.5 text-xs" href={`/design?design=${s.design?.slug}`}>Open</Link>
              <button className="btn btn-ghost !py-1.5 text-xs" onClick={async () => { await api(`/saved-designs/${s._id}`, { method: 'DELETE' }); load(); }}>Delete</button></div>
          </div>)) : <p className="text-gray-600">No saved designs yet.</p>)}

        {tab === 'wishlist' && (d.user.wishlist.length ? d.user.wishlist.map((w) => (
          <div key={w._id} className="card flex items-center justify-between p-4"><Link href={`/product/${w.slug}`} className="serif text-lg text-navy underline">{w.name}</Link>
            <button className="btn btn-ghost !py-1.5 text-xs" onClick={async () => { await api(`/wishlist/${w._id}`, { method: 'DELETE' }); load(); }}>Remove</button></div>)) : <p className="text-gray-600">Your wishlist is empty.</p>)}

        {tab === 'profile' && (
          <div className="grid gap-6 md:grid-cols-2">
            <form className="card space-y-3 p-5" onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.target); try { await api('/account', { method: 'PATCH', body: { name: f.get('name'), savedRingSize: f.get('size') || undefined } }); flash('Profile saved'); load(); } catch (er) { flash(er.message); } }}>
              <h2 className="text-xl text-navy">Profile</h2>
              <label className="block"><span className="label">Name</span><input name="name" className="input mt-1" defaultValue={d.user.name} /></label>
              <label className="block"><span className="label">Saved ring size</span><input name="size" className="input mt-1" defaultValue={d.user.savedRingSize} /></label>
              <p className="text-xs text-gray-500">{d.user.email || d.user.mobile}</p>
              <button className="btn btn-navy">Save</button>
            </form>
            <div className="card space-y-2 p-5">
              <h2 className="text-xl text-navy">Addresses</h2>
              {d.user.addresses.map((a) => <div key={a._id} className="flex justify-between text-sm"><span>{a.name}, {a.line1}, {a.city} {a.pincode}</span><button className="text-red-700 underline" onClick={async () => { await api(`/account/addresses/${a._id}`, { method: 'DELETE' }); load(); }}>Remove</button></div>)}
              <form className="grid grid-cols-2 gap-2 pt-2" onSubmit={async (e) => { e.preventDefault(); try { await api('/account/addresses', { method: 'POST', body: addr }); setAddr({ name: '', phone: '', line1: '', city: '', state: '', pincode: '' }); load(); } catch (er) { flash(er.message); } }}>
                {Object.keys(addr).map((k) => <input key={k} className={`input ${k === 'line1' ? 'col-span-2' : ''}`} placeholder={k} aria-label={k} value={addr[k]} onChange={(e) => setAddr({ ...addr, [k]: e.target.value })} />)}
                <button className="btn btn-ghost col-span-2">Add address</button></form>
            </div>
          </div>)}

        {tab === 'requests' && <>
          <Link href="/custom-request" className="btn btn-navy">New custom request</Link>
          {d.reqs.map((r) => <div key={r._id} className="card p-4 text-sm"><div className="font-semibold text-navy">{r.category} · {r.status.replace('_', ' ')}</div><p className="text-gray-600">{r.description}</p>
            {r.cadFiles?.length > 0 && <div className="mt-2 flex gap-2">{r.cadFiles.map((f) => <a key={f} href={f} target="_blank" rel="noreferrer" className="underline">CAD file</a>)}</div>}</div>)}
          {d.cons.map((c) => <div key={c._id} className="card p-4 text-sm">Consultation ({c.mode}) · {c.date} {c.slot} · {c.status}{c.meetingLink && <> · <a className="underline" href={c.meetingLink}>Join</a></>}</div>)}
        </>}
      </div>
      </div>
    </div>
  );
}
export default function AccountClient() { return <RequireAuth><div className="paper-page min-h-[80vh]"><Inner /></div></RequireAuth>; }
