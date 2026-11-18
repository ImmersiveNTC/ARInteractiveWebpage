import { notFound } from 'next/navigation';
import { get3DAssets, toStaticSlugParams } from '../../../lib/assets';
import { I3DStandaloneViewer } from '../../../components/I3DStandaloneViewer';

export function generateStaticParams() {
  return toStaticSlugParams(get3DAssets('-3Di'));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = get3DAssets('-3Di').find(entry => entry.slug === slug);
  return {
    title: item ? `${item.displayName} — Interactive 3D Gallery` : 'Interactive 3D Asset',
  };
}

export default async function Interactive3DItemPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = get3DAssets('-3Di').find(entry => entry.slug === slug);

  if (!item) {
    notFound();
  }

  return (
    <I3DStandaloneViewer
      fileUrl={item.fileUrl}
      fileName={item.fileName}
      displayName={item.displayName}
      showInteractiveControls={true}
      backHref="/3Di"
      backLabel="Back to Interactive 3D"
    />
  );
}
