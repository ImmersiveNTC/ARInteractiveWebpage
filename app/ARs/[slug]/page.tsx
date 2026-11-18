import { notFound } from 'next/navigation';
import { getARAssets, toStaticSlugParams } from '../../../lib/assets';
import { ARItemView } from '../../../components/ARItemView';

export function generateStaticParams() {
  return toStaticSlugParams(getARAssets('-ARs'));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = getARAssets('-ARs').find(entry => entry.slug === slug);
  return {
    title: item ? `${item.displayName} — Static AR Gallery` : 'Static AR Asset',
  };
}

export default async function StaticARItemPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = getARAssets('-ARs').find(entry => entry.slug === slug);

  if (!item) {
    notFound();
  }

  return (
    <ARItemView
      item={item}
      backHref="/ARs"
      backLabel="Back to Static AR"
      galleryTitle="Static AR Gallery"
    />
  );
}
