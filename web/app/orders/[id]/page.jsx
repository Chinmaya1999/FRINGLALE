import OrderClient from './OrderClient';
export const metadata = { title: 'Order tracking', robots: { index: false } };
export default async function Page({ params }) { const { id } = await params; return <OrderClient id={id} />; }
