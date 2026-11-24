import { notFound } from 'next/navigation';
import { getARGlbAssets, toStaticSlugParams } from '../../../lib/assets';
import { WebARSlamViewer } from '../../../components/WebARSlamViewer';

export function generateStaticParams() {
  return toStaticSlugParams(getARGlbAssets());
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = getARGlbAssets().find(entry => entry.slug === slug);
  return {
    title: item ? `${item.displayName} — AR Gallery` : 'AR Asset',
  };
}

export default async function ARGlbItemPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = getARGlbAssets().find(entry => entry.slug === slug);

  if (!item) {
    notFound();
  }

  return (
    <WebARSlamViewer
      glbUrl={item.fileUrl}
      displayName={item.displayName}
      backHref="/ARglb"
      backLabel="Back to AR Gallery"
    />
  );
}
