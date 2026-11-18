'use client';

import dynamic from 'next/dynamic';
import { useSyncExternalStore } from 'react';
import { VR360_GYRO_ALLOWED_KEY } from './VR360GalleryView';

const VR360ViewerModal = dynamic(
  () => import('./VR360ViewerModal').then(mod => mod.VR360ViewerModal),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-dvh flex flex-col items-center justify-center bg-[#0a041a] text-white">
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

const emptySubscribe = () => () => {};

function getInitialGyroSnapshot(): boolean {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
  if (!isMobile) return false;

  const DeviceOrientation = (
    window as unknown as {
      DeviceOrientationEvent?: { requestPermission?: () => Promise<string> };
    }
  ).DeviceOrientationEvent;

  if (DeviceOrientation && typeof DeviceOrientation.requestPermission === 'function') {
    try {
      return sessionStorage.getItem(VR360_GYRO_ALLOWED_KEY) === '1';
    } catch {
      return false;
    }
  }

  return true;
}

function getServerGyroSnapshot(): boolean {
  return false;
}

/** Client wrapper that renders the Three.js 360 viewer as a standalone full-screen page. */
export function VR360StandaloneViewer(props: VR360StandaloneViewerProps) {
  const initialGyroActive = useSyncExternalStore(
    emptySubscribe,
    getInitialGyroSnapshot,
    getServerGyroSnapshot
  );

  return <VR360ViewerModal {...props} initialGyroActive={initialGyroActive} />;
}
