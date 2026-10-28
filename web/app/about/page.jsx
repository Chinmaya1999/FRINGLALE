export const metadata = { title: 'Our Story — Rootage Group', description: 'Rootage Group sources gold directly — mine to refinery to gold bar to your jewel.' };
const NUMS = [['99.99%', 'pure gold from our refining partners'], ['6-digit', 'HUID on every hallmarked piece'], ['15 min', 'price lock at checkout'], ['0', 'pieces made before you approve the model']];
export default function Page() {
  return (
    <div className="paper-page">
      <section className="maroon-band px-4 py-24 text-center">
        <p className="mono">Our story</p>
        <h1 className="mx-auto mt-4 max-w-3xl text-5xl leading-tight md:text-7xl">From the <span className="gold-text">mine</span> to your hand.</h1>
        <p className="mx-auto mt-6 max-w-xl text-white/70">Rootage Group sources gold directly — mine, refinery, gold bar. Fringlale brings that supply chain to the person who wears it.</p>
      </section>
      <section className="mx-auto grid max-w-6xl gap-px bg-gold/25 md:grid-cols-4">
        {NUMS.map(([n, l]) => <div key={n} className="bg-[#F3EADB] p-8"><div className="serif text-4xl text-[#3A0F1B]">{n}</div><p className="mt-2 text-sm text-[#3A0F1B]/65">{l}</p></div>)}
      </section>
      <article className="mx-auto max-w-3xl px-4 py-20 text-lg leading-relaxed text-[#3A0F1B]/75">
        <h2 className="text-3xl text-[#3A0F1B]">Why we built Fringlale</h2>
        <p className="mt-4">Buying jewellery shouldn’t mean guessing. Here you design the piece yourself, see exactly how the price is built from today’s gold rate, and approve the CAD and wax model before production begins.</p>
        <h2 className="mt-14 text-3xl text-[#3A0F1B]">Mine to Masterpiece</h2>
        <ol className="mt-4 list-decimal space-y-1 pl-6"><li>Responsibly sourced gold from the mine</li><li>Refined to 99.99% purity</li><li>Assayed and stored as gold bars</li><li>Crafted by skilled artisans</li><li>Hallmarked, certified, insured and delivered</li></ol>
        <figure className="mt-16 border-l-2 border-gold pl-6">
          <figcaption className="text-sm uppercase tracking-widest text-[#3A0F1B]/55">Message from the Managing Director · Mr. Ashok Kalash, Rootage Group</figcaption>
          {/* Replace with the MD's approved words; placeholder intentionally does not put words in his mouth. */}
          <p className="mt-3 rounded bg-amber-100 p-3 text-sm text-amber-900">Message to be provided by Rootage Group.</p>
        </figure>
      </article>
    </div>);
}
