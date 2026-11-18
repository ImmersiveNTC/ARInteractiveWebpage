import { getARAssets } from '../../lib/assets';
import { ARGalleryView } from '../../components/ARGalleryView';

export const metadata = {
  title: 'Static AR Gallery',
  description: 'View real 3D models in augmented reality on your iPhone or preview them in 3D on desktop.',
};

export default function StaticARPage() {
  const models = getARAssets('-ARs');

  return (
    <ARGalleryView
      activePage="ARs"
      title="Static AR Gallery"
      subtitle="Tap any model to launch into the real world using augmented reality on your Apple device. Make sure to scan the floor evenly, rather than too high or too low."
      baseRoute="/ARs"
      suffixHint="-ARs"
      models={models}
    />
  );
}
