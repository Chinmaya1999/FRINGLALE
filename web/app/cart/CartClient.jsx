'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { RequireAuth, useAuth } from '@/lib/auth';
import { inr } from '@/lib/format';

function loadRazorpay() {
  return new Promise((res, rej) => {
    if (window.Razorpay) return res();
    const s = Object.assign(document.createElement('script'), { src: 'https://checkout.razorpay.com/v1/checkout.js', onload: res, onerror: () => rej(new Error('Could not load Razorpay')) });
    document.body.appendChild(s);
  });
}

function Timer({ expiresAt, onExpire }) {
  const [left, setLeft] = useState(() => new Date(expiresAt) - Date.now());
  useEffect(() => {
    const t = setInterval(() => { const l = new Date(expiresAt) - Date.now(); setLeft(l); if (l <= 0) { clearInterval(t); onExpire(); } }, 1000);
    return () => clearInterval(t);
  }, [expiresAt, onExpire]);
  const s = Math.max(0, Math.floor(left / 1000));
  return <span className="tabular-nums" role="timer">{String(Math.floor(s / 60)).padStart(2, '0')}:{String(s % 60).padStart(2, '0')}</span>;
}

function Inner() {
  const router = useRouter();
  const { refreshCart } = useAuth();
  const [cart, setCart] = useState(null);
  const [account, setAccount] = useState(null);
  const [coupon, setCoupon] = useState('');
  const [addr, setAddr] = useState({ name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '' });
  const [mode, setMode] = useState('full');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dev, setDev] = useState(null);

  const load = useCallback(async () => { setCart(await api('/cart')); await refreshCart(); }, [refreshCart]);
  useEffect(() => { load().catch((e) => setErr(e.message)); api('/account').then((r) => setAccount(r.user)).catch(() => {}); }, [load]);

  const act = async (fn) => { setErr(null); setBusy(true); try { await fn(); } catch (e) { setErr(e.message); } setBusy(false); };

  const verify = (gw, paymentId, signature, orderId) =>
    api('/payments/verify', { method: 'POST', body: { razorpayOrderId: gw.orderId, razorpayPaymentId: paymentId, signature } }).then(() => { refreshCart(); router.push(`/orders/${orderId}`); });

  const pay = () => act(async () => {
    const { order, gateway } = await api('/orders', { method: 'POST', body: { address: Object.fromEntries(Object.entries(addr).filter(([, v]) => v)), paymentMode: mode } });
    if (gateway.mode === 'dev') return setDev({ gateway, orderId: order._id });
    await loadRazorpay();
    new window.Razorpay({
      key: gateway.keyId, amount: gateway.amount, currency: 'INR', order_id: gateway.orderId, name: 'Fringlale', description: `Order ${order.orderNo}`,
      handler: (r) => verify(gateway, r.razorpay_payment_id, r.razorpay_signature, order._id).catch((e) => setErr(e.message)),
      theme: { color: '#0B1F4B' },
    }).open();
  });

  if (!cart) return <div className="p-16 text-center text-gray-500">{err || 'Loading cart…'}</div>;
  if (!cart.items.length) return <div className="p-16 text-center"><h1 className="text-3xl text-navy">Your cart is empty</h1><Link href="/design" className="btn btn-navy mt-6">Design Your Jewel</Link></div>;

  const t = cart.totals;
  const locked = !!cart.lock;
  const payNow = mode === 'advance' ? Math.round((t.total * cart.advancePercent) / 100 * 100) / 100 : t.total;

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-4">
        <h1 className="text-4xl text-navy">Cart</h1>
        {cart.items.map((it) => (
          <div key={it.id} className="card flex flex-wrap items-start justify-between gap-3 p-4">
            <div><div className="serif text-lg text-navy">{it.designName}</div>
              <div className="text-sm text-gray-600">{it.config.metal} · size {it.config.size}{it.config.stoneType ? ` · ${it.config.carat} ct ${it.config.shape} ${it.config.stoneType}` : ''}{it.config.engraving ? ` · “${it.config.engraving}”` : ''}</div>
              <div className="mt-1 text-xs text-gray-500">{it.quote.support.approvedForManufacturing ? 'Approved for manufacturing' : 'CAD for your approval before production'}</div></div>
            <div className="text-right"><div className="tabular-nums">{inr(it.quote.price.subtotal)}</div><button className="mt-1 text-xs text-red-700 underline" onClick={() => act(async () => setCart(await api(`/cart/items/${it.id}`, { method: 'DELETE' })))}>Remove</button></div>
          </div>))}

        {locked && (
          <section className="card space-y-3 p-5">
            <h2 className="text-xl text-navy">Delivery address</h2>
            {account?.addresses?.length > 0 && <select className="input" defaultValue="" onChange={(e) => { const a = account.addresses.find((x) => x._id === e.target.value); if (a) setAddr({ name: a.name, phone: a.phone, line1: a.line1, line2: a.line2 || '', city: a.city, state: a.state, pincode: a.pincode }); }}><option value="">Use a saved address…</option>{account.addresses.map((a) => <option key={a._id} value={a._id}>{a.label || a.line1}</option>)}</select>}
            <div className="grid gap-3 sm:grid-cols-2">
              {[['name', 'Full name'], ['phone', 'Mobile (10 digits)'], ['line1', 'Address line 1'], ['line2', 'Address line 2 (optional)'], ['city', 'City'], ['state', 'State'], ['pincode', 'PIN code']].map(([k, l]) => (
                <label key={k} className={k === 'line1' || k === 'line2' ? 'sm:col-span-2' : ''}><span className="label">{l}</span><input className="input mt-1" value={addr[k]} onChange={(e) => setAddr({ ...addr, [k]: e.target.value })} /></label>))}
            </div>
            <fieldset className="space-y-2 pt-2"><legend className="label">Payment</legend>
              <label className="flex items-center gap-2 text-sm"><input type="radio" checked={mode === 'full'} onChange={() => setMode('full')} /> Pay in full ({inr(t.total, 2)})</label>
              <label className="flex items-center gap-2 text-sm"><input type="radio" checked={mode === 'advance'} onChange={() => setMode('advance')} /> Pay {cart.advancePercent}% advance now ({inr(Math.round(t.total * cart.advancePercent) / 100, 2)}), balance before shipping</label>
            </fieldset>
          </section>)}
      </div>

      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="card space-y-1 p-5 text-sm">
          <h2 className="mb-2 text-xl text-navy">Summary</h2>
          <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{inr(t.subtotal)}</span></div>
          {t.discount > 0 && <div className="flex justify-between text-emerald-700"><span>Coupon {cart.coupon?.code}</span><span>− {inr(t.discount)}</span></div>}
          <div className="flex justify-between"><span>GST ({t.gstPercent}%)</span><span className="tabular-nums">{inr(t.gst)}</span></div>
          <div className="flex justify-between"><span>Insured shipping</span><span>{t.shipping ? inr(t.shipping) : 'Free'}</span></div>
          <div className="gold-rule my-2" />
          <div className="flex justify-between text-lg font-semibold text-navy"><span>Total</span><span className="tabular-nums">{inr(t.total, 2)}</span></div>

          <div className="flex gap-2 pt-3"><input className="input" placeholder="Coupon code" value={coupon} onChange={(e) => setCoupon(e.target.value)} /><button className="btn btn-ghost" disabled={busy || !coupon} onClick={() => act(async () => { setCart(await api('/cart/coupon', { method: 'POST', body: { code: coupon } })); setCoupon(''); })}>Apply</button></div>
          {cart.coupon && <button className="text-xs underline" onClick={() => act(async () => setCart(await api('/cart/coupon', { method: 'POST', body: { code: null } })))}>Remove coupon</button>}

          {err && <p role="alert" className="pt-2 text-sm text-red-700">{err}</p>}

          {!locked ? (
            <button className="btn btn-navy mt-4 w-full" disabled={busy} onClick={() => act(async () => setCart(await api('/cart/lock', { method: 'POST' })))}>Start checkout &amp; lock price</button>
          ) : (
            <>
              <div className="mt-3 rounded-lg bg-gold/15 p-3 text-center text-sm">Gold rate locked for <strong><Timer expiresAt={cart.lock.expiresAt} onExpire={() => { setErr('Your price lock expired. Lock again to see the latest price.'); load(); }} /></strong></div>
              <button className="btn btn-navy mt-3 w-full" disabled={busy || !!dev} onClick={pay}>{busy ? 'Please wait…' : `Pay ${inr(payNow, 2)}`}</button>
            </>)}
          {dev && (
            <div className="mt-3 rounded-lg border border-dashed border-amber-500 bg-amber-50 p-3 text-xs">
              <strong>Development payment mode.</strong> Razorpay keys are not configured, so no real money moves.
              <button className="btn btn-navy mt-2 w-full" onClick={() => act(() => verify(dev.gateway, `pay_dev_${Date.now()}`, 'dev', dev.orderId))}>Simulate successful payment</button>
            </div>)}
        </div>
      </aside>
    </div>
  );
}

export default function CartClient() { return <RequireAuth><div className="paper-page min-h-[80vh]"><Inner /></div></RequireAuth>; }
