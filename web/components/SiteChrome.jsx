'use client';
import { usePathname } from 'next/navigation';
import Header from './Header';
import Footer from './Footer';
import GoldTicker from './GoldTicker';
import MotionProvider from './motion/MotionProvider';

// Full-screen app surfaces (editor, admin, capture route) bring their own chrome.
const BARE = [/^\/admin/, /^\/design/, /^\/preview/];

/** Scrolls away with the page, so the sticky header offsets elsewhere stay valid. Remove after launch. */
const Announcement = () => (
  <div className="bg-gold px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[#260A12] md:text-xs" role="status">
    Fringlale is launching on 10 December 2026 — Make My Jewel, My Choice, My Jewel
  </div>
);

export default function SiteChrome({ children }) {
  const path = usePathname();
  const bare = BARE.some((r) => r.test(path));
  return (<>{!bare && <><Announcement /><GoldTicker /><Header /></>}<main><MotionProvider>{children}</MotionProvider></main>{!bare && <Footer />}</>);
}
