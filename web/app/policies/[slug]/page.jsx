import { notFound } from 'next/navigation';
import { POLICIES } from '@/lib/content';

export function generateStaticParams() { return Object.keys(POLICIES).map((slug) => ({ slug })); }
export async function generateMetadata({ params }) { const { slug } = await params; return { title: POLICIES[slug]?.title || 'Policy' }; }

export default async function Page({ params }) {
  const { slug } = await params;
  const p = POLICIES[slug];
  if (!p) notFound();
  return <div className="paper-page"><article className="mx-auto max-w-3xl px-4 py-20"><p className="mono text-clay">Policy</p><h1 className="mt-2 text-6xl text-[#3A0F1B]">{p.title}</h1><div className="mt-10 space-y-6 border-t border-[#3A0F1B]/30 pt-8 text-lg leading-relaxed text-[#3A0F1B]/75">{p.body.map((t, i) => <p key={i}>{t}</p>)}</div></article></div>;
}
