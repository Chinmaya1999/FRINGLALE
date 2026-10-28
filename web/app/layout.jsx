import { Fraunces, Inter, DM_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import SiteChrome from '@/components/SiteChrome';

const display = Fraunces({ subsets: ['latin'], variable: '--font-display', display: 'swap', axes: ['opsz', 'SOFT'] });
const mono = DM_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono', display: 'swap' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export const metadata = {
  metadataBase: new URL(SITE),
  title: { default: 'Fringlale — Make My Jewel', template: '%s | Fringlale' },
  description: 'Design your own hallmarked gold, platinum and diamond jewellery with a live 3D preview and transparent pricing from Rootage Group.',
  openGraph: { siteName: 'Fringlale', type: 'website' },
};
export const viewport = { themeColor: '#3A0F1B' };

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${inter.variable} ${mono.variable}`}>
      <body>
        <AuthProvider>
          <SiteChrome>{children}</SiteChrome>
        </AuthProvider>
      </body>
    </html>
  );
}
