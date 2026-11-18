import { notFound } from 'next/navigation';
import { get360Assets, toStaticSlugParams } from '../../../lib/assets';
import { VR360StandaloneViewer } from '../../../components/VR360StandaloneViewer';

export function generateStaticParams() {
  return toStaticSlugParams(get360Assets('-360vid'));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = get360Assets('-360vid').find(entry => entry.slug === slug);
  return {
    title: item ? `${item.displayName} — 360 Videos` : '360 Video',
  };
}

export default async function VR360VideoItemPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = get360Assets('-360vid').find(entry => entry.slug === slug);

  if (!item) {
    notFound();
  }

  return (
    <VR360StandaloneViewer
      imageUrl={item.fileUrl}
      title={item.displayName}
      backHref="/360Video"
      backLabel="Back to 360 Videos"
      isVideo={true}
    />
  );
}
