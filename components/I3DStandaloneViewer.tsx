"use client";

import dynamic from 'next/dynamic';
import { ReactNode } from 'react';

const I3DViewerModal = dynamic(
  () => import('./I3DViewerModal').then(mod => mod.I3DViewerModal),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[260px] flex items-center justify-center bg-[#666666]">
        <div className="i3d-cube-wrap" style={{ transform: 'scale(2.6)' }}>
          <div className="i3d-cube">
            <div className="i3d-cube__face i3d-cube__face--front" />
            <div className="i3d-cube__face i3d-cube__face--back" />
            <div className="i3d-cube__face i3d-cube__face--right" />
            <div className="i3d-cube__face i3d-cube__face--left" />
            <div className="i3d-cube__face i3d-cube__face--top" />
            <div className="i3d-cube__face i3d-cube__face--bottom" />
          </div>
        </div>
      </div>
    ),
  }
);

type I3DStandaloneViewerProps = {
  fileUrl: string;
  fileName: string;
  displayName: string;
  showInteractiveControls: boolean;
  embedded?: boolean;
  fullBleed?: boolean;
  headerRight?: ReactNode;
  backHref?: string;
  backLabel?: string;
};

/** Client wrapper that renders the Three.js 3D viewer as a standalone full-screen page. */
export function I3DStandaloneViewer(props: I3DStandaloneViewerProps) {
  return <I3DViewerModal {...props} />;
}
