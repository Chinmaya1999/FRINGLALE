'use client';
import { useState } from 'react';
import { inr } from '@/lib/format';

const KEYS = ['24K', '22K', '18K'];

export default function RateChart({ items }) {
  const [k, setK] = useState('22K');
  const [hover, setHover] = useState(null);
  if (items.length < 2) return <p className="mt-4 text-gray-500">Not enough history yet.</p>;
  const W = 800, H = 280, P = 40;
  const vals = items.map((i) => i.rates[k]);
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const x = (i) => P + (i / (items.length - 1)) * (W - 2 * P);
  const y = (v) => H - P - ((v - min) / span) * (H - 2 * P);
  const path = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const h = hover ?? items.length - 1;
  return (
    <div className="mt-4 border-y border-[#3A0F1B]/30 py-4">
      <div className="mb-2 flex gap-2">{KEYS.map((x2) => <button key={x2} onClick={() => setK(x2)} aria-pressed={k === x2} className={`btn !py-1 text-xs ${k === x2 ? 'btn-navy' : 'btn-ghost text-[#3A0F1B]'}`}>{x2}</button>)}</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${k} gold rate, last ${items.length} days, from ${inr(vals[0])} to ${inr(vals.at(-1))} per gram`}
        onMouseLeave={() => setHover(null)} onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const t = ((e.clientX - r.left) / r.width * W - P) / (W - 2 * P); setHover(Math.max(0, Math.min(items.length - 1, Math.round(t * (items.length - 1))))); }}>
        {[0, 0.5, 1].map((t) => <g key={t}><line x1={P} x2={W - P} y1={y(min + span * t)} y2={y(min + span * t)} stroke="rgba(58,15,27,.15)" /><text x={4} y={y(min + span * t) + 4} fontSize="11" fill="rgba(58,15,27,.6)">{Math.round(min + span * t).toLocaleString('en-IN')}</text></g>)}
        <path d={path} fill="none" stroke="#3A0F1B" strokeWidth="2" strokeLinejoin="round" />
        <circle cx={x(h)} cy={y(vals[h])} r="5" fill="#B4532A" stroke="#F3EADB" strokeWidth="2" />
      </svg>
      <div className="mt-1 text-sm text-[#3A0F1B]/70" aria-live="polite">{items[h].date}: <strong>{inr(vals[h])}</strong> / g</div>
    </div>
  );
}
