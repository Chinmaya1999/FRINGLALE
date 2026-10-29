import Link from 'next/link';
import { CATEGORY_LABELS } from '@/lib/format';
import PHOTOS from '@/lib/designPhotos.json';

/** Real photograph of this kind of piece (openly licensed, credited), when we have one. */
export const designPhoto = (design) => PHOTOS[design?.slug];

export const COLLECTION_LABELS = { bullion: 'Bullion & Coins', bridal: 'Bridal', 'red-carpet': 'Red Carpet', heritage: 'Heritage', everyday: 'Everyday Luxe', signature: 'Signature' };

export function ProductArt({ design, src, className = '' }) {
  const img = src ?? designPhoto(design)?.src ?? design.images?.[0];
  if (img) return <img src={img} alt={design.name} loading="lazy" className={`object-cover ${className}`} />;
  return <div className={`flex items-center justify-center bg-[#260A12] ${className}`} role="img" aria-label={design.name}><img src="/brand/monogram.png" alt="" className="h-1/2 opacity-70 blend-screen" /></div>;
}

/** A catalogue "specimen": arch-framed plate with a museum-style caption. No hover overlays; everything is readable at rest. */
export default function DesignCard({ design, index, onQuick }) {
  const real = design.model3d?.assetVariants?.length > 0;
  const approved = design.manufacturing?.status === 'approved_for_manufacturing';
  return (
    <article className="group">
      <Link href={`/product/${design.slug}`} aria-label={design.name} className="block">
        <div className="arch aspect-[4/5] w-full bg-[#260A12] ring-1 ring-[#3A0F1B]/30"><ProductArt design={design} className="h-full w-full transition duration-700 group-hover:scale-105" /></div>
      </Link>
      <div className="mt-4 border-t border-[#3A0F1B]/25 pt-3">
        <div className="flex items-center justify-between mono text-[#3A0F1B]/60"><span>No. {String(index ?? 0).padStart(3, '0')}</span><span>{COLLECTION_LABELS[design.series] || CATEGORY_LABELS[design.category]}</span></div>
        <Link href={`/product/${design.slug}`} className="serif mt-1 block text-2xl leading-tight text-[#3A0F1B]">{design.name}</Link>
        <p className="mt-1 text-xs text-[#3A0F1B]/65">{CATEGORY_LABELS[design.category]} · {real ? 'real 3D model' : '3D preview'}{approved ? ' · ready to manufacture' : ''}</p>
        {designPhoto(design) && !designPhoto(design).own && <p className="mt-1 text-[10px] leading-tight text-[#3A0F1B]/45">Photo: {designPhoto(design).artist} · <a className="underline" href={designPhoto(design).page} target="_blank" rel="noreferrer">{designPhoto(design).license}</a></p>}
        <div className="mt-3 flex gap-5 text-sm font-semibold text-[#3A0F1B]">
          <Link href={`/design?design=${design.slug}`} className="link-u">Design it</Link>
          {onQuick && <button onClick={() => onQuick(design)} className="link-u">Quick view</button>}
        </div>
      </div>
    </article>
  );
}
