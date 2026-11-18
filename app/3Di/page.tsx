import { get3DAssets } from '../../lib/assets';
import { ThreeDGalleryView } from '../../components/ThreeDGalleryView';

export const metadata = {
  title: 'Interactive 3D Gallery',
  description: 'Explore a curated collection of interactive 3D models.',
};

export default function Interactive3DPage() {
  const items = get3DAssets('-3Di');

  return (
    <ThreeDGalleryView
      activePage="3Di"
      title="Interactive 3D Gallery"
      subtitle="3D models that you can rotate, scale, and explore."
      baseRoute="/3Di"
      suffixHint="-3Di"
      items={items}
    />
  );
}
