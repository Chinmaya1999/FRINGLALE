import Link from 'next/link';

/** The brand mark. The artwork has a transparent background; `screen` blending lets its glow melt into any dark surface. */
export function Monogram({ className = 'h-10 w-10' }) {
  return <img src="/brand/monogram.png" alt="" aria-hidden="true" className={`${className} object-contain blend-screen`} />;
}

export default function Logo({ className = '' }) {
  return (
    <Link href="/" className={`flex items-center gap-2.5 ${className}`} aria-label="Fringlale home">
      <Monogram className="h-12 w-12" />
      <span className="serif gold-text hidden text-[1.7rem] font-medium tracking-[0.16em] sm:inline">FRINGLALE</span>
    </Link>
  );
}
