import { notFound } from 'next/navigation';
import { getARAssets, toStaticSlugParams } from '../../../lib/assets';
import { ARItemView } from '../../../components/ARItemView';

export function generateStaticParams() {
  return toStaticSlugParams(getARAssets('-ARi'));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = getARAssets('-ARi').find(entry => entry.slug === slug);
  return {
    title: item ? `${item.displayName} — Interactive AR Gallery` : 'Interactive AR Asset',
  };
}

export default async function InteractiveARItemPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = getARAssets('-ARi').find(entry => entry.slug === slug);

  if (!item) {
    notFound();
  }

  return (
    <ARItemView
      item={item}
      backHref="/ARi"
      backLabel="Back to Interactive AR"
      galleryTitle="Interactive AR Gallery"
    />
  );
}
