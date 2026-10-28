import { inr } from '@/lib/format';

const Row = ({ k, v, sub, strong }) => (
  <div className={`flex items-baseline justify-between gap-3 py-1.5 ${strong ? 'text-base font-semibold text-navy' : 'text-sm'}`}>
    <div><div>{k}</div>{sub && <div className="text-xs text-gray-500">{sub}</div>}</div>
    <div className="tabular-nums">{v}</div>
  </div>
);

/** Full transparent breakdown, straight from the backend quote — nothing is computed in the browser. */
export default function PriceBreakdown({ quote, loading, locked }) {
  const p = quote?.price;
  if (!p) return <div className="card p-4 text-sm text-gray-500">Calculating price…</div>;
  const i = p.inputs;
  return (
    <div className={`card p-4 transition-opacity ${loading ? 'opacity-60' : ''}`} aria-busy={loading} data-testid="price-breakdown">
      <Row k="Gold / metal" sub={`${p.finalWeight} g × ${inr(i.ratePerGram)}/g (${i.rateKey})`} v={inr(p.metalPrice)} />
      <Row k="Making charge" sub={p.makingBasis} v={inr(p.makingCharge)} />
      {p.stonePrice > 0 && <Row k="Stone" v={inr(p.stonePrice)} />}
      {p.extras.engraving > 0 && <Row k="Engraving" v={inr(p.extras.engraving)} />}
      {p.extras.giftBox > 0 && <Row k="Gift box" v={inr(p.extras.giftBox)} />}
      {p.extras.insurance > 0 && <Row k="Insurance" v={inr(p.extras.insurance)} />}
      <div className="gold-rule my-2" />
      <Row k="Subtotal" v={inr(p.subtotal)} />
      <Row k={`GST (${p.gstPercent}%)`} v={inr(p.gst)} />
      <Row k="Shipping (insured)" v={p.shipping ? inr(p.shipping) : 'Free'} />
      <div className="gold-rule my-2" />
      <Row strong k="Total" v={inr(p.total, 2)} />
      <p className="mt-2 text-xs text-gray-500">
        {locked ? 'Priced at your locked gold rate.' : `Gold rate of ${quote.goldRate?.date}${quote.goldRate?.source === 'seed' ? ' (sample data)' : ''}. Price is locked for 15 minutes when you start checkout.`}
      </p>
    </div>
  );
}
