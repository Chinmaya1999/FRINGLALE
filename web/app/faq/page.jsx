import { FAQ } from '@/lib/content';
export const metadata = { title: 'FAQ' };
export default function Page() {
  const ld = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) };
  return (
    <div className="paper-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 lg:grid-cols-[0.8fr_1.2fr]">
        <div><p className="mono text-clay">Questions</p><h1 className="mt-2 text-6xl text-[#3A0F1B]">Asked <em className="text-gold">often.</em></h1><p className="mt-4 max-w-xs text-[#3A0F1B]/70">Can’t find yours? Book a designer call from the Custom page.</p></div>
        <div className="border-t border-[#3A0F1B]/30">{FAQ.map(([q, a], i) => <details key={q} className="group border-b border-[#3A0F1B]/30 py-5"><summary className="flex cursor-pointer list-none items-baseline gap-5"><span className="mono text-clay">{String(i + 1).padStart(2, '0')}</span><span className="serif flex-1 text-2xl text-[#3A0F1B]">{q}</span><span className="text-xl text-gold transition group-open:rotate-45">+</span></summary><p className="ml-11 mt-3 max-w-xl text-[#3A0F1B]/70">{a}</p></details>)}</div>
      </div>
    </div>);
}
