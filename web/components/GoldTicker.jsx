'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { inr } from '@/lib/format';

/** Today's gold price strip. The server refreshes the rate from the internet every day; this just displays the latest and re-checks hourly. */
export default function GoldTicker() {
  const [rate, setRate] = useState(null);
  useEffect(() => {
    let alive = true;
    const load = () => api('/gold-rates/today').then((r) => alive && setRate(r)).catch(() => {});
    load();
    const t = setInterval(load, 3_600_000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  if (!rate) return null;
  const day = new Date(rate.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
  return (
    <Link href="/gold-rate" className="mono block bg-[#12040a] px-4 py-1.5 text-center !text-[10px] text-white/75 hover:text-white" aria-label="Today’s gold rate">
      <span className="text-gold">Today’s gold · {day}</span>
      {['24K', '22K', '18K'].map((k) => <span key={k} className="ml-3 whitespace-nowrap">{k} <b className="font-semibold text-white">{inr(rate.rates[k])}</b>/g</span>)}
    </Link>
  );
}
