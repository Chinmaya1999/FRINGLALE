import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="maroon-band relative mt-0">
      <div className="mx-auto max-w-7xl px-4 pt-20">
        <p className="serif max-w-4xl text-4xl leading-tight md:text-6xl">Every piece begins as <em className="text-gold">gold in the ground</em>. We just make sure you know the whole way home.</p>
        <div className="mt-16 grid gap-10 border-t border-white/15 py-12 md:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <div><img src="/brand/logo-full.png" alt="Fringlale — Jewellery Beyond Imagination" className="blend-screen -ml-4 w-60 max-w-full" loading="lazy" /><p className="mt-2 text-sm text-white/60">Make My Jewel — My Choice, My Jewel.<br />A Rootage Group company, Dubai, UAE.</p></div>
          {[['Explore', [['/shop', 'Collections'], ['/design', 'Design Studio'], ['/gold-rate', 'Live gold rate'], ['/custom-request', 'Custom request']]],
            ['House', [['/about', 'Our story'], ['/contact', 'Contact'], ['/faq', 'FAQ']]],
            ['Policies', [['/policies/return', 'Returns'], ['/policies/exchange', 'Exchange'], ['/policies/buyback', 'Old gold buyback'], ['/policies/shipping', 'Shipping'], ['/policies/privacy', 'Privacy'], ['/policies/terms', 'Terms']]]].map(([h, ls]) => (
            <div key={h}><h4 className="mono !text-gold">{h}</h4><ul className="mt-4 space-y-2 text-sm text-white/75">{ls.map(([href, l]) => <li key={href}><Link href={href} className="link-u">{l}</Link></li>)}</ul></div>))}
        </div>
        <div className="flex flex-wrap justify-between gap-2 border-t border-white/10 py-5 mono !text-[10px] text-white/40"><span>© {new Date().getFullYear()} Rootage Group</span><span>Mine → Refinery → Gold bar → Craftsman → You</span></div>
      </div>
    </footer>
  );
}
