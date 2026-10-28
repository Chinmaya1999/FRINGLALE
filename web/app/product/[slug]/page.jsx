import { notFound } from 'next/navigation';
import { sfetch } from '@/lib/server';
import { defaultConfig } from '@/lib/config';
import ProductClient from './ProductClient';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const d = (await sfetch(`/designs/${slug}`))?.design;
  if (!d) return { title: 'Design not found' };
  return { title: d.name, description: d.description, alternates: { canonical: `/product/${slug}` }, openGraph: { title: d.name, description: d.description, images: d.images?.slice(0, 1) } };
}

export default async function Page({ params }) {
  const { slug } = await params;
  const d = (await sfetch(`/designs/${slug}`))?.design;
  if (!d) notFound();
  const stones = await sfetch('/stones');
  // A real starting price for structured data; omitted entirely if the quote is unavailable.
  let offer = null;
  if (stones) {
    try {
      const res = await fetch(`${process.env.API_URL || 'http://localhost:4000'}/api/pricing/quote`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, next: { revalidate: 300 },
        body: JSON.stringify({ designSlug: slug, config: Object.fromEntries(Object.entries(defaultConfig(d, stones.matrix)).filter(([, v]) => v !== undefined)) }),
      });
      if (res.ok) offer = (await res.json()).price.total;
    } catch {}
  }
  const ld = {
    '@context': 'https://schema.org', '@type': 'Product', name: d.name, description: d.description,
    image: d.images?.length ? d.images : undefined, category: d.category, brand: { '@type': 'Brand', name: 'Fringlale' },
    ...(offer ? { offers: { '@type': 'Offer', priceCurrency: 'INR', price: offer, availability: 'https://schema.org/MadeToOrder', url: `${SITE}/product/${slug}` } } : {}),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
      <ProductClient design={d} />
    </>
  );
}
