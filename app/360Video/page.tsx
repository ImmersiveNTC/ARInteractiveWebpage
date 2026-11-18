import { get360Assets } from '../../lib/assets';
import { VR360GalleryView } from '../../components/VR360GalleryView';

export const metadata = {
  title: '360 Videos',
  description: 'Watch immersive 360-degree spherical videos directly in your browser.',
};

export default function VR360VideoPage() {
  const items = get360Assets('-360vid');

  return (
    <VR360GalleryView
      activePage="360Video"
      title="360 Videos"
      subtitle="Step inside interactive 360° spherical videos. Drag to look around while playing or use playback controls below."
      baseRoute="/360Video"
      suffixHint="-360vid"
      emptyHeading="No 360 Videos Found"
      items={items}
    />
  );
}
