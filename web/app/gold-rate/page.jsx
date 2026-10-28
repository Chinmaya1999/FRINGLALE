import { sfetch } from '@/lib/server';
import { inr } from '@/lib/format';
import RateChart from './RateChart';

export const metadata = { title: 'Live Gold Rate', description: 'Today’s 24K, 22K and 18K gold rate per gram in India, with a 30-day chart.' };

export default async function Page() {
  const [today, hist] = await Promise.all([sfetch('/gold-rates/today', 120), sfetch('/gold-rates/history?days=30', 120)]);
  const items = hist?.items || [];
  const prev = items.length > 1 ? items[items.length - 2] : null;
  const delta = (k) => (prev && today ? today.rates[k] - prev.rates[k] : null);
  return (
    <div className="paper-page">
      <header className="border-b border-[#3A0F1B]/30"><div className="mx-auto max-w-7xl px-4 pb-8 pt-14">
        <p className="mono text-clay">The rate card</p><h1 className="mt-2 text-6xl text-[#3A0F1B] md:text-8xl">Today’s <em className="text-gold">gold</em></h1>
        {today && <p className="mono mt-4 text-[#3A0F1B]/60">Updated {new Date(today.updatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST · {today.source === 'manual' ? 'set by Fringlale' : today.source === 'seed' ? 'sample data' : 'market feed'}</p>}</div></header>
      <div className="mx-auto max-w-7xl px-4 py-14">
        {!today ? <p className="text-[#3A0F1B]/70">The rate is temporarily unavailable. Please check back shortly.</p> : (<>
          <table className="w-full border-collapse text-[#3A0F1B]" aria-label="Rates per gram">
            <thead><tr className="mono border-b-2 border-[#3A0F1B] text-left text-[#3A0F1B]/60"><th className="py-3 font-normal">Metal</th><th className="font-normal">Per gram</th><th className="text-right font-normal">vs previous day</th></tr></thead>
            <tbody>{[['24K', '24 carat · pure'], ['22K', '22 carat · 91.6%'], ['18K', '18 carat · 75%'], ['14K', '14 carat · 58.5%'], ['platinum', 'Platinum 950'], ['silver', 'Silver 925']].map(([k, l]) => { const d = delta(k); return (
              <tr key={k} className="border-b border-[#3A0F1B]/20"><td className="py-5"><span className="serif text-3xl">{k === 'platinum' || k === 'silver' ? l : k}</span><span className="mono ml-3 text-[#3A0F1B]/50">{k === 'platinum' || k === 'silver' ? '' : l}</span></td>
                <td className="serif text-3xl tabular-nums">{inr(today.rates[k])}</td>
                <td className={`mono text-right ${d > 0 ? 'text-emerald-800' : d < 0 ? 'text-clay' : 'text-[#3A0F1B]/50'}`}>{d == null ? '—' : d === 0 ? '— 0' : `${d > 0 ? '▲' : '▼'} ${inr(Math.abs(d))}`}</td></tr>); })}</tbody>
          </table>
          <h2 className="mt-16 text-4xl text-[#3A0F1B]">The last 30 days</h2>
          <RateChart items={items} />
          <p className="mt-6 max-w-xl text-sm text-[#3A0F1B]/60">Your jewellery price uses the rate at the moment you start checkout, locked for 15 minutes.</p></>)}
      </div>
    </div>
  );
}
