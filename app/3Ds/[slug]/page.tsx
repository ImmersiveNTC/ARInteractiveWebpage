import { notFound } from 'next/navigation';
import { get3DAssets, toStaticSlugParams } from '../../../lib/assets';
import { I3DStandaloneViewer } from '../../../components/I3DStandaloneViewer';

export function generateStaticParams() {
  return toStaticSlugParams(get3DAssets('-3Ds'));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = get3DAssets('-3Ds').find(entry => entry.slug === slug);
  return {
    title: item ? `${item.displayName} — Static 3D Gallery` : 'Static 3D Asset',
  };
}

export default async function Static3DItemPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = get3DAssets('-3Ds').find(entry => entry.slug === slug);

  if (!item) {
    notFound();
  }

  return (
    <I3DStandaloneViewer
      fileUrl={item.fileUrl}
      fileName={item.fileName}
      displayName={item.displayName}
      showInteractiveControls={false}
      backHref="/3Ds"
      backLabel="Back to Static 3D"
    />
  );
}
