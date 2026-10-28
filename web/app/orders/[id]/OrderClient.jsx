'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, download } from '@/lib/api';
import { RequireAuth } from '@/lib/auth';
import { STAGES, STAGE_LABELS, inr } from '@/lib/format';

function Inner({ id }) {
  const [o, setO] = useState(null);
  const [comment, setComment] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api(`/orders/${id}`).then((r) => setO(r.order)).catch((e) => setErr(e.message)), [id]);
  useEffect(() => { load(); }, [load]);

  if (!o) return <div className="p-16 text-center text-gray-500">{err || 'Loading…'}</div>;
  const cur = STAGES.indexOf(o.stage);
  const hist = Object.fromEntries(o.stageHistory.map((h) => [h.stage, h]));
  const awaiting = o.stage === 'customer_approval' && o.approval.status === 'pending';

  const decide = async (decision) => {
    setErr(null); setBusy(true);
    try { await api(`/orders/${id}/approval`, { method: 'POST', body: { decision, comment: comment || undefined } }); setComment(''); await load(); } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const payBalance = async () => {
    setBusy(true);
    try {
      const { gateway } = await api(`/orders/${id}/pay-balance`, { method: 'POST' });
      if (gateway.mode === 'dev') { await api('/payments/verify', { method: 'POST', body: { razorpayOrderId: gateway.orderId, razorpayPaymentId: `pay_dev_${Date.now()}`, signature: 'dev' } }); await load(); }
      else {
        if (!window.Razorpay) await new Promise((r) => document.body.appendChild(Object.assign(document.createElement('script'), { src: 'https://checkout.razorpay.com/v1/checkout.js', onload: r })));
        new window.Razorpay({ key: gateway.keyId, amount: gateway.amount, currency: 'INR', order_id: gateway.orderId, name: 'Fringlale',
          handler: (r) => api('/payments/verify', { method: 'POST', body: { razorpayOrderId: gateway.orderId, razorpayPaymentId: r.razorpay_payment_id, signature: r.razorpay_signature } }).then(load) }).open();
      }
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl text-navy">Order {o.orderNo}</h1>
      <p className="text-sm text-gray-600">Placed {new Date(o.createdAt).toLocaleDateString('en-IN')} · Total {inr(o.priceBreakdown.total, 2)} · Paid {inr(o.payment.paid, 2)}{o.payment.due > 0 && ` · Due ${inr(o.payment.due, 2)}`}</p>
      {o.lockedGoldRate?.date && <p className="text-xs text-gray-500">Priced at gold rate locked on {o.lockedGoldRate.date}.</p>}
      {err && <p role="alert" className="mt-3 rounded bg-red-50 p-3 text-sm">{err}</p>}

      {o.payment.due > 0 && <div className="mt-4 flex items-center justify-between rounded-xl bg-gold/15 p-4 text-sm"><span>Balance of {inr(o.payment.due, 2)} is due before shipping.</span><button className="btn btn-navy" disabled={busy} onClick={payBalance}>Pay balance</button></div>}

      {(awaiting || o.approval.media.length > 0) && o.stage !== 'order_placed' && (
        <section className="card mt-6 p-5" aria-label="Design approval">
          <h2 className="text-xl text-navy">Your approval</h2>
          <p className="text-sm text-gray-600">{awaiting ? 'Please review the CAD render / wax model. Production will not start until you approve.' : o.approval.status === 'approved' ? 'You approved this design.' : o.approval.status === 'changes_requested' ? 'Changes requested — our designers are updating the model.' : ''}</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">{o.approval.media.map((m) => (/\.pdf$/i.test(m) ? <a key={m} href={m} className="underline" target="_blank" rel="noreferrer">View PDF</a> : <a key={m} href={m} target="_blank" rel="noreferrer"><img src={m} alt="CAD or wax model" loading="lazy" className="aspect-square w-full rounded-lg border object-cover" /></a>))}</div>
          {awaiting && (
            <div className="mt-4 space-y-2">
              <textarea className="input" rows={3} maxLength={1000} placeholder="Comments (required if you request changes)" value={comment} onChange={(e) => setComment(e.target.value)} />
              <div className="flex gap-2"><button className="btn btn-navy" disabled={busy} onClick={() => decide('approve')}>Approve</button><button className="btn btn-ghost" disabled={busy || !comment.trim()} onClick={() => decide('changes')}>Request changes</button></div>
            </div>)}
          {o.approval.comment && <p className="mt-3 text-sm text-gray-600">Your note: “{o.approval.comment}”</p>}
        </section>)}

      <ol className="mt-8 space-y-0" aria-label="Order timeline">
        {STAGES.map((s, i) => {
          const done = i < cur, now = i === cur;
          return (
            <li key={s} className="relative flex gap-4 pb-6" aria-current={now ? 'step' : undefined}>
              {i < STAGES.length - 1 && <span className={`absolute left-[11px] top-6 h-full w-0.5 ${done ? 'bg-gold' : 'bg-gray-200'}`} />}
              <span className={`z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${done ? 'bg-gold text-navy-deep' : now ? 'bg-navy text-white ring-4 ring-gold/40' : 'bg-gray-200 text-gray-500'}`}>{done ? '✓' : i + 1}</span>
              <div><div className={`font-medium ${now ? 'text-navy' : done ? '' : 'text-gray-400'}`}>{STAGE_LABELS[s]}</div>
                {hist[s] && <div className="text-xs text-gray-500">{new Date(hist[s].at).toLocaleString('en-IN')}{hist[s].note ? ` · ${hist[s].note}` : ''}</div>}
                {s === 'hallmarking' && o.huid && <div className="text-xs">HUID: <strong>{o.huid}</strong></div>}
                {s === 'shipped' && o.trackingNumber && <div className="text-xs">{o.courier} tracking: <strong>{o.trackingNumber}</strong></div>}</div>
            </li>);
        })}
      </ol>

      {o.certificates?.length > 0 && <section className="card p-5"><h2 className="text-xl text-navy">Certificates</h2><ul className="mt-2 list-disc pl-5 text-sm">{o.certificates.map((c) => <li key={c.url}><a className="underline" href={c.url} target="_blank" rel="noreferrer">{c.name}</a></li>)}</ul></section>}
      {o.payment.paid > 0 && <button className="btn btn-ghost mt-6" onClick={() => download(`/orders/${id}/invoice`, `${o.orderNo}.pdf`).catch((e) => setErr(e.message))}>Download invoice (PDF)</button>}
    </div>
  );
}
export default function OrderClient({ id }) { return <RequireAuth><div className="paper-page min-h-[80vh]"><Inner id={id} /></div></RequireAuth>; }
