"use client";

import { useState } from "react";
import dynamic from 'next/dynamic';

const I3DViewerModal = dynamic(() => import('./I3DViewerModal').then(mod => mod.I3DViewerModal), { 
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
});

type I3DGalleryCardProps = {
  id: string;
  displayName: string;
  category: string;
  fileName: string;
  fileUrl: string;
  accentColor: string;
  index: number;
};

export function I3DGalleryCard({ id, displayName, category, fileName, fileUrl, accentColor, index }: I3DGalleryCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  const ext = (fileName.split('.').pop() || '').toLowerCase();
  const isGlb = ext === 'glb' || ext === 'gltf';

  return (
    <>
      <div
        id={id}
        className="i3d-card"
        style={{
          animationDelay: `${index * 100 + 80}ms`,
          ['--i3d-accent' as string]: accentColor,
        }}
        onClick={() => setIsOpen(true)}
      >
        {/* Accent gradient overlay */}
        <div className="i3d-card__accent" />

        {/* Card body */}
        <div className="i3d-card__body">
          {/* Rotating wireframe cube */}
          <div className="i3d-cube-wrap">
            <div className="i3d-cube">
              <div className="i3d-cube__face i3d-cube__face--front" />
              <div className="i3d-cube__face i3d-cube__face--back" />
              <div className="i3d-cube__face i3d-cube__face--right" />
              <div className="i3d-cube__face i3d-cube__face--left" />
              <div className="i3d-cube__face i3d-cube__face--top" />
              <div className="i3d-cube__face i3d-cube__face--bottom" />
            </div>
          </div>

          {/* Display name + category */}
          <h3 className="i3d-card__name">{displayName}</h3>
          <p className="i3d-card__category">{category}</p>
        </div>

        {/* Format badge */}
        <div className="i3d-card__badge">
          <span className={`i3d-card__badge-dot ${isGlb ? 'i3d-card__badge-dot--glb' : 'i3d-card__badge-dot--usdz'}`} />
          {ext.toUpperCase()}
        </div>
      </div>

      {isOpen && (
        <I3DViewerModal 
          fileUrl={fileUrl} 
          fileName={fileName} 
          onClose={() => setIsOpen(false)} 
        />
      )}
    </>
  );
}
