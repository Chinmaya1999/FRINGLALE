import Link from 'next/link';
import { sfetch } from '@/lib/server';
import DesignCard, { COLLECTION_LABELS, ProductArt } from '@/components/DesignCard';
import HeroStage from '@/components/HeroStage';
import ScrollStage from '@/components/motion/ScrollStage';
import { Reveal, Lines, Parallax, CountUp } from '@/components/motion/Reveal';
import { inr } from '@/lib/format';

const CHAPTERS = [
  ['I', 'The mine', 'Gold begins as ore in the ground. Rootage sources it directly, so the story of your jewel starts at the source, not at a shelf.'],
  ['II', 'The refinery', 'Ore is refined to 99.99% pure gold. Purity is measured, recorded and carried with the metal all the way to your hallmark.'],
  ['III', 'The gold bar', 'Refined gold is cast into assayed bars and held by Rootage — the reason we can price your jewel from a single, honest gold rate.'],
  ['IV', 'The craftsman', 'Your approved CAD becomes wax, then metal. Casting, setting and polishing are done by hand, and nothing starts before you say yes.'],
  ['V', 'Your jewel', 'BIS hallmark with a HUID, certified stones, insured delivery — and an exchange promise for life.'],
];
const COLLECTIONS = [
  ['bullion', 'For the vault', 'Gold and silver bars and coins, engraved your way.'],
  ['bridal', 'For the vows', 'Halos, three-stones and eternity bands.'],
  ['red-carpet', 'For the spotlight', 'Statement pieces inspired by award-night glamour.'],
  ['heritage', 'For the family', 'Timeless gold, cast the way our craftsmen always have.'],
  ['everyday', 'For every day', 'Light, wearable luxury.'],
  ['signature', 'For the house', 'The solitaires that define Fringlale.'],
];
const PRICE = [['Metal', 'weight × today’s gold rate'], ['Making', 'a stated % or ₹ per gram'], ['Stone', 'carat × price per carat'], ['Extras', 'engraving, box, insurance'], ['GST', '3% on the subtotal']];

export default async function Home() {
  const [feat, rate, testi, all, bull] = await Promise.all([sfetch('/designs?featured=true&limit=8'), sfetch('/gold-rates/today', 300), sfetch('/cms/testimonials', 300), sfetch('/designs?limit=48'), sfetch('/designs?collection=bullion&limit=12')]);
  const byCol = Object.fromEntries(COLLECTIONS.map(([k]) => [k, all?.items?.find((d) => d.series === k)]));
  return (
    <div className="paper-page">
      {/* ── Opening: full-bleed stage, live metal and piece switcher ───── */}
      <HeroStage rate={rate} />

      {/* ── Hallmark strip ────────────────────────────────────── */}
      <div className="border-y border-[#3A0F1B]/30">
        <ul className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-[#3A0F1B]/20 md:grid-cols-5">
          {['BIS Hallmark', 'HUID on every piece', 'IGI / GIA stones', 'Insured delivery', 'Lifetime exchange'].map((t) => <li key={t} className="mono px-4 py-4 text-center text-[#3A0F1B]">{t}</li>)}
        </ul>
      </div>

      <ScrollStage slug="lumiere-halo-pendant" label="Lumière Halo Pendant" chapters={[
        ['01', 'Hang it', 'A halo pendant that sits just below the collarbone, on a chain made for it.'],
        ['02', 'Choose the metal', 'Yellow, rose, white gold or platinum — the pendant changes as you scroll.'],
        ['03', 'Take it apart', 'See the chain, the bail, the halo and the centre stone as separate parts.'],
        ['04', 'Make it yours', 'Open the studio and the same pendant is yours to edit, priced live.'],
      ]} />

      {/* ── Chapters: sticky title, scrolling story ────────────── */}
      <section className="mx-auto grid max-w-7xl gap-12 px-4 py-24 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="lg:sticky lg:top-40 lg:self-start">
          <p className="mono text-clay">Our story in five chapters</p>
          <Lines className="mt-3 text-5xl leading-tight text-[#3A0F1B] md:text-6xl" lines={['Mine to', <em key="m" className="text-gold">Masterpiece</em>]} />
          <p className="mt-5 max-w-sm text-[#3A0F1B]/70">Most jewellers start at the shop. We start at the source — and show you every step.</p>
          <Link href="/about" className="link-u mt-6 inline-block text-sm font-semibold text-[#3A0F1B]">Read the whole story →</Link>
        </div>
        <Reveal as="ol" stagger={0.15} className="divide-y divide-[#3A0F1B]/20 border-t border-[#3A0F1B]/20">
          {CHAPTERS.map(([n, t, d]) => (
            <li key={n} className="grid grid-cols-[4.5rem_1fr] gap-4 py-9 md:grid-cols-[6rem_1fr]">
              <span className="serif text-5xl font-light text-gold md:text-6xl">{n}</span>
              <div><h3 className="text-3xl text-[#3A0F1B]">{t}</h3><p className="mt-2 max-w-xl text-[#3A0F1B]/70">{d}</p></div>
            </li>))}
        </Reveal>
      </section>

      {/* ── Collections as an index ───────────────────────────── */}
      <section className="maroon-band">
        <div className="mx-auto max-w-7xl px-4 py-24">
          <div className="flex items-end justify-between"><h2 className="text-5xl md:text-6xl">The <em className="text-gold">collections</em></h2><span className="mono hidden md:block">Index · 6</span></div>
          <ul className="mt-12 border-t border-white/20">
            {COLLECTIONS.map(([k, tag, blurb], i) => (
              <li key={k} className="border-b border-white/20">
                <Link href={`/shop?collection=${k}`} className="group grid items-center gap-4 py-7 md:grid-cols-[4rem_1.2fr_1.4fr_7rem]">
                  <span className="mono text-gold">{String(i + 1).padStart(2, '0')}</span>
                  <span className="serif text-4xl transition group-hover:translate-x-2 group-hover:text-gold md:text-5xl">{COLLECTION_LABELS[k]}</span>
                  <span className="text-white/65"><span className="mono block text-gold/80">{tag}</span>{blurb}</span>
                  <span className="arch-sm hidden h-24 w-20 justify-self-end bg-[#260A12] md:block">{byCol[k] && <ProductArt design={byCol[k]} className="h-full w-full" />}</span>
                </Link>
              </li>))}
          </ul>
        </div>
      </section>

      {/* ── Featured specimens ────────────────────────────────── */}
      {feat?.items?.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-24">
          <div className="flex items-end justify-between"><div><p className="mono text-clay">From the catalogue</p><h2 className="mt-2 text-5xl text-[#3A0F1B] md:text-6xl">Featured <em className="text-gold">pieces</em></h2></div><Link href="/shop" className="link-u hidden text-sm font-semibold text-[#3A0F1B] md:block">All designs →</Link></div>
          <Reveal stagger={0.1} className="mt-12 grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">{feat.items.slice(0, 8).map((d, i) => <DesignCard key={d.slug} design={d} index={i + 1} />)}</Reveal>
        </section>)}

      {/* ── Beyond jewellery: bullion and custom pieces ───────── */}
      {bull?.items?.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-24">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="lg:sticky lg:top-40 lg:self-start">
              <p className="mono text-clay">Bars · coins · gold items</p>
              <h2 className="mt-3 text-5xl leading-tight text-[#3A0F1B] md:text-6xl">Not only <em className="text-gold">jewellery.</em></h2>
              <p className="mt-5 max-w-md text-[#3A0F1B]/75">We also make gold and silver bars and coins — and anything else you’d like cast in gold. Choose the weight, add your own engraving, and see the same itemised price at today’s rate.</p>
              <ul className="mt-6 space-y-2 text-[#3A0F1B]/80">{['Bars from 1 g to 100 g', 'Coins from 1 g, in 22K or 24K', 'Your name, date or logo engraved', 'Any design you send us — we’ll make it'].map((t) => <li key={t} className="flex gap-3"><span className="text-gold">◆</span>{t}</li>)}</ul>
              <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3"><Link href="/shop?collection=bullion" className="btn btn-navy">Shop bars &amp; coins</Link><Link href="/custom-request" className="link-u text-sm font-semibold text-[#3A0F1B]">Request a custom piece →</Link></div>
            </div>
            <Reveal stagger={0.1} className="grid gap-x-6 gap-y-12 sm:grid-cols-2">{bull.items.slice(0, 4).map((d, i) => <DesignCard key={d.slug} design={d} index={i + 1} />)}</Reveal>
          </div>
        </section>)}

      {/* ── The price, explained ──────────────────────────────── */}
      <section className="border-y border-[#3A0F1B]/30 bg-[#e9dcc5]">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-24 lg:grid-cols-2">
          <div>
            <p className="mono text-clay">No mystery pricing</p>
            <h2 className="mt-3 text-5xl leading-tight text-[#3A0F1B] md:text-6xl">Every price, <em className="text-gold">itemised.</em></h2>
            <p className="mt-5 max-w-md text-[#3A0F1B]/75">The Design Studio updates a full breakdown on every choice, and locks today’s gold rate for 15 minutes when you start checkout.</p>
            <Link href="/design" className="btn btn-navy mt-8">Try it in the studio</Link>
          </div>
          <div className="relative border border-[#3A0F1B]/50 bg-[#fbf6ec] p-8 shadow-[8px_8px_0_#3A0F1B]">
            <div className="mono flex justify-between text-[#3A0F1B]/60"><span>Assay of a price</span><span>Form F-01</span></div>
            <dl className="mt-5 divide-y divide-dashed divide-[#3A0F1B]/30">{PRICE.map(([k, v]) => <div key={k} className="flex items-baseline justify-between gap-4 py-3"><dt className="serif text-2xl text-[#3A0F1B]">{k}</dt><dd className="text-right text-sm text-[#3A0F1B]/65">{v}</dd></div>)}</dl>
            <div className="mt-4 flex justify-between border-t-2 border-[#3A0F1B] pt-3"><span className="serif text-2xl text-[#3A0F1B]">Total</span><span className="mono text-[#3A0F1B]">= the number you pay</span></div>
            <span className="stamp absolute -right-5 -top-8 rotate-12 bg-[#fbf6ec] text-clay">Rate<br />locked<br />15 min</span>
          </div>
        </div>
      </section>

      {/* ── Occasions ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-24">
        <h2 className="text-5xl text-[#3A0F1B]">Find a piece for <em className="text-gold">the day</em></h2>
        <div className="mt-10 grid border-l border-t border-[#3A0F1B]/30 sm:grid-cols-2 lg:grid-cols-4">
          {[['Wedding', 'wedding'], ['Engagement', 'engagement'], ['Gifting', 'gifting'], ['Daily wear', 'daily']].map(([l, k], i) => (
            <Link key={k} href={`/shop?occasion=${k}`} className="group flex h-44 flex-col justify-between border-b border-r border-[#3A0F1B]/30 p-5 transition hover:bg-[#3A0F1B] hover:text-[#f3eadb]"><span className="mono text-clay group-hover:text-gold">{String(i + 1).padStart(2, '0')}</span><span className="serif text-3xl">{l} <span className="inline-block transition group-hover:translate-x-1">→</span></span></Link>))}
        </div>
      </section>

      {testi?.items?.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 pb-24">{testi.items.slice(0, 3).map((t, i) => <figure key={i} className="border-t border-[#3A0F1B]/30 py-8"><blockquote className="serif text-3xl leading-snug text-[#3A0F1B]">“{t.text}”</blockquote><figcaption className="mono mt-3 text-[#3A0F1B]/60">— {t.name}</figcaption></figure>)}</section>)}
    </div>
  );
}
