import { get360Assets } from '../../lib/assets';
import { VR360GalleryView } from '../../components/VR360GalleryView';

export const metadata = {
  title: '360 Tours Gallery',
  description: 'Experience immersive 360-degree spherical tours. Tap any panorama to step inside directly from your device.',
};

export default function VR360ImagePage() {
  const items = get360Assets('-360pic');

  return (
    <VR360GalleryView
      activePage="360Image"
      title="360 Tours Gallery"
      subtitle="Explore 360° environments from every angle. On a mobile device, enable motion to look around; on desktop, click and drag to navigate."
      baseRoute="/360Image"
      suffixHint="-360pic"
      emptyHeading="No 360 Images Found"
      items={items}
    />
  );
}
