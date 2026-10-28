'use client';
import { usePathname } from 'next/navigation';
import Header from './Header';
import Footer from './Footer';
import MotionProvider from './motion/MotionProvider';

// Full-screen app surfaces (editor, admin, capture route) bring their own chrome.
const BARE = [/^\/admin/, /^\/design/, /^\/preview/];

export default function SiteChrome({ children }) {
  const path = usePathname();
  const bare = BARE.some((r) => r.test(path));
  return (<>{!bare && <Header />}<main><MotionProvider>{children}</MotionProvider></main>{!bare && <Footer />}</>);
}
