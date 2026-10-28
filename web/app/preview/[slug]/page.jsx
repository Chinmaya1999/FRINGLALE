import PreviewClient from './PreviewClient';
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({ params }) { const { slug } = await params; return <PreviewClient slug={slug} />; }
