import { sfetch } from '@/lib/server';
import { POLICIES } from '@/lib/content';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export default async function sitemap() {
  const designs = (await sfetch('/designs?limit=48', 600))?.items || [];
  const statics = ['', '/shop', '/design', '/custom-request', '/gold-rate', '/about', '/contact', '/faq', ...Object.keys(POLICIES).map((p) => `/policies/${p}`)];
  return [
    ...statics.map((p) => ({ url: `${SITE}${p}`, changeFrequency: p === '/gold-rate' ? 'daily' : 'weekly' })),
    ...designs.map((d) => ({ url: `${SITE}/product/${d.slug}`, lastModified: d.updatedAt, changeFrequency: 'weekly' })),
  ];
}
