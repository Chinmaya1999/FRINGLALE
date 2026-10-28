import { Suspense } from 'react';
import ShopClient from './ShopClient';
export const metadata = { title: 'Shop designs', description: 'Browse rings, pendants, earrings, necklaces and bangles. Filter by metal, stone and occasion.' };
export default function Page() { return <Suspense><ShopClient /></Suspense>; }
