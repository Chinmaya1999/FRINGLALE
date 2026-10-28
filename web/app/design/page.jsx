import { Suspense } from 'react';
import DesignBuilder from '@/components/builder/DesignBuilder';

export const metadata = { title: 'Design Your Jewel', description: 'Build your own ring, pendant, earrings, necklace or bangle in 3D with live gold-rate pricing.' };

export default function Page() {
  return <Suspense fallback={<div className="p-16 text-center text-gray-500">Opening the studio…</div>}><DesignBuilder /></Suspense>;
}
