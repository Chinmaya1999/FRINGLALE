'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import Logo from './Logo';

const LEFT = [['Collections', '/shop'], ['Design Studio', '/design'], ['Custom', '/custom-request']];
const RIGHT = [['Gold Rate', '/gold-rate'], ['Our Story', '/about'], ['FAQ', '/faq']];

/** Atelier masthead: utility strip, centred logo between two link groups. */
export default function Header({ rate }) {
  const { user, cartCount, signOut } = useAuth();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => { document.body.style.overflow = open ? 'hidden' : ''; return () => { document.body.style.overflow = ''; }; }, [open]);
  const staff = user && user.role !== 'customer';
  const on = (h) => path === h || path.startsWith(h + '/');
  const L = ({ h, l }) => <Link href={h} className={`link-u py-1 ${on(h) ? 'text-gold' : ''}`}>{l}</Link>;

  return (
    <header className="sticky top-0 z-40 maroon-band">
      <div className="hidden border-b border-white/10 md:block">
        <div className="mx-auto flex h-8 max-w-7xl items-center justify-between px-4 mono !text-[10px] text-white/60">
          <span>BIS hallmarked · HUID on every piece · insured delivery</span>
          <span className="flex gap-5">{user ? <>
            {staff && <Link href="/admin" className="text-gold">Dashboard →</Link>}
            <Link href="/account" className="hover:text-white">Account</Link><button onClick={signOut} className="hover:text-white">Sign out</button></>
            : <Link href="/login" className="hover:text-white">Sign in</Link>}</span>
        </div>
      </div>
      <div className="mx-auto grid h-[72px] max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4">
        <nav className="hidden gap-7 mono !text-[11px] lg:flex" aria-label="Main">{LEFT.map(([l, h]) => <L key={h} h={h} l={l} />)}</nav>
        <button className="justify-self-start lg:hidden mono !text-[11px]" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="mobile-nav">{open ? 'Close ✕' : 'Menu ☰'}</button>
        <Logo className="justify-self-center" />
        <div className="flex items-center justify-self-end gap-7 mono !text-[11px]">
          <nav className="hidden gap-7 lg:flex" aria-label="Secondary">{RIGHT.map(([l, h]) => <L key={h} h={h} l={l} />)}</nav>
          <Link href="/cart" aria-label={`Cart, ${cartCount} items`} className="link-u">Bag{cartCount > 0 && <span className="ml-1 text-gold">({cartCount})</span>}</Link>
        </div>
      </div>

      {open && (
        <div id="mobile-nav" className="fixed inset-x-0 bottom-0 top-[72px] z-40 overflow-y-auto bg-[#260A12] px-6 pb-10 pt-6 md:top-[104px] lg:hidden">
          <nav aria-label="Mobile" className="mx-auto max-w-md">
            <ol className="divide-y divide-white/10">{[...LEFT, ...RIGHT].map(([l, h], i) => (
              <li key={h}><Link href={h} className="flex items-baseline gap-4 py-4"><span className="mono text-gold">{String(i + 1).padStart(2, '0')}</span><span className="serif text-3xl">{l}</span></Link></li>))}</ol>
            <Link href="/design" className="btn btn-gold mt-8 w-full">Design your jewel</Link>
            <div className="mt-4 flex gap-3">{user ? <>
              {staff && <Link href="/admin" className="btn btn-ghost flex-1 text-white">Dashboard</Link>}
              <Link href="/account" className="btn btn-ghost flex-1 text-white">Account</Link>
              <button onClick={signOut} className="btn btn-ghost flex-1 text-white/70">Sign out</button></>
              : <Link href="/login" className="btn btn-ghost w-full text-white">Sign in</Link>}</div>
          </nav>
        </div>)}
    </header>
  );
}
