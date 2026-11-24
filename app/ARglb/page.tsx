import { getARGlbAssets } from '../../lib/assets';
import { ARGalleryView } from '../../components/ARGalleryView';

export const metadata = {
  title: 'AR Gallery',
  description: 'Launch 3D models into your real environment using in-browser 6DoF WebAR.',
};

export default function ARGlbGalleryPage() {
  const models = getARGlbAssets();

  return (
    <ARGalleryView
      activePage="ARglb"
      title="AR Gallery"
      subtitle="Tap any model to launch into the real world directly in your browser. Aim the orange circle at a flat surface and tap to place."
      baseRoute="/ARglb"
      models={models}
    />
  );
}
