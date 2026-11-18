import { getARAssets } from '../../lib/assets';
import { ARGalleryView } from '../../components/ARGalleryView';

export const metadata = {
  title: 'Interactive AR Gallery',
  description: 'Explore interactive augmented reality models on your iPhone or preview them in 3D on desktop.',
};

export default function InteractiveARPage() {
  const models = getARAssets('-ARi');

  return (
    <ARGalleryView
      activePage="ARi"
      title="Interactive AR Gallery"
      subtitle="Tap any interactive AR model to launch into your real environment on your Apple device."
      baseRoute="/ARi"
      suffixHint="-ARi"
      models={models}
    />
  );
}
