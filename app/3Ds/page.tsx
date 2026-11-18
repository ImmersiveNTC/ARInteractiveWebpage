import { get3DAssets } from '../../lib/assets';
import { ThreeDGalleryView } from '../../components/ThreeDGalleryView';

export const metadata = {
  title: 'Static 3D Gallery',
  description: 'Explore a curated collection of static 3D models.',
};

export default function Static3DPage() {
  const items = get3DAssets('-3Ds');

  return (
    <ThreeDGalleryView
      activePage="3Ds"
      title="Static 3D Gallery"
      subtitle="3D models that you can rotate, zoom, and inspect."
      baseRoute="/3Ds"
      suffixHint="-3Ds"
      items={items}
    />
  );
}
