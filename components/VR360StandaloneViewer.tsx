'use client';

import dynamic from 'next/dynamic';

const VR360ViewerModal = dynamic(
  () => import('./VR360ViewerModal').then(mod => mod.VR360ViewerModal),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-[#0a041a] text-white">
        <div className="w-12 h-12 rounded-full border-4 border-white/5 border-t-teal-500 animate-spin mb-4" />
        <p className="text-sm font-semibold tracking-wide text-white/80">Loading 360° Viewer...</p>
      </div>
    ),
  }
);

type VR360StandaloneViewerProps = {
  imageUrl: string;
  title: string;
  backHref: string;
  backLabel: string;
  isVideo?: boolean;
};

/** Client wrapper that renders the Three.js 360 viewer as a standalone full-screen page. */
export function VR360StandaloneViewer(props: VR360StandaloneViewerProps) {
  return <VR360ViewerModal {...props} initialGyroActive={false} />;
}
