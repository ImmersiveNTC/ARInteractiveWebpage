'use client';

import { useState, useEffect } from 'react';
import { GalleryNav } from '../../components/GalleryNav';
import { VR360ViewerModal } from '../../components/VR360ViewerModal';

/* ─── Types ─────────────────────────────────────────────────────────────── */

type PanoramaData = {
  id: string;
  displayName: string;
  category: string;
  fileName: string;
  fileUrl: string;
  accentColor: string;
  index: number;
  isVideo?: boolean;
};

type VR360GalleryProps = {
  items: PanoramaData[];
};

/* ─── Mobile Detection (client-side) ────────────────────────────────────── */

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const ua = navigator.userAgent;
    setTimeout(() => {
      setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua));
    }, 0);
  }, []);
  return isMobile;
}

/* ─── Sphere Icon Component ─────────────────────────────────────────────── */

function VR360SphereIcon({ accentColor }: { accentColor: string }) {
  return (
    <div className="ar360-sphere-wrap" aria-hidden="true">
      <div className="ar360-sphere" style={{ ['--ar360-accent' as string]: accentColor }} />
      <div className="ar360-sphere__orbit" style={{ borderColor: accentColor }} />
      <div className="ar360-sphere__orbit ar360-sphere__orbit--vertical" style={{ borderColor: accentColor }} />
    </div>
  );
}

/* ─── Card Component ────────────────────────────────────────────────────── */

function VR360Card({ item, onClick }: { item: PanoramaData; onClick: (item: PanoramaData) => void }) {
  return (
    <div
      id={item.id}
      className="ar360-card group"
      style={{
        animationDelay: `${item.index * 100 + 50}ms`,
        ['--ar360-accent' as string]: item.accentColor,
      }}
      onClick={() => onClick(item)}
      role="button"
      tabIndex={0}
      aria-label={`View ${item.displayName} 360 panorama`}
      onKeyDown={e => e.key === 'Enter' && onClick(item)}
    >
      {/* Accent gradient overlay */}
      <div className="ar360-card__accent" />

      {/* Pulsing glow ring on hover */}
      <div className="ar360-card__glow" style={{ background: item.accentColor }} />

      {/* Card Thumbnail */}
      <div className="ar360-card__thumbnail relative overflow-hidden">
        {item.isVideo ? (
          <>
            <video 
              src={item.fileUrl} 
              muted 
              playsInline 
              loop 
              autoPlay
              className="w-full h-full object-cover transition-transform duration-600 ease-out"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center',
              }}
            />
            {/* Play Button Overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/15 group-hover:bg-black/35 transition-colors duration-300 z-10">
              <div className="w-11 h-11 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-lg transform group-hover:scale-110 transition-transform duration-300">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          </>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img 
            src={item.fileUrl} 
            alt={item.displayName}
            loading="lazy"
          />
        )}
      </div>

      {/* Card body */}
      <div className="ar360-card__body">
        {/* Orbiting Sphere Icon */}
        <VR360SphereIcon accentColor={item.accentColor} />

        <div>
          {/* Panorama name + category */}
          <h3 className="ar360-card__name">{item.displayName}</h3>
          <p className="ar360-card__category">{item.category}</p>
        </div>
      </div>

      {/* Format Badge */}
      <div className="ar360-card__badge" style={{ ['--ar360-accent' as string]: item.accentColor }}>
        <span className="ar360-card__badge-icon">
          {item.isVideo ? (
            <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor">
              <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
              <path d="M2 12h20" />
            </svg>
          )}
        </span>
        {item.isVideo ? '360° VIDEO' : '360°'}
      </div>

      {/* CTA hint */}
      <div className="ar360-card__cta" style={{ ['--ar360-accent' as string]: item.accentColor }}>
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 3h6v6" />
          <path d="M9 21H3v-6" />
          <path d="M21 3l-7 7" />
          <path d="M3 21l7-7" />
        </svg>
        Step Inside
      </div>
    </div>
  );
}

// (DesktopModal removed, desktop users now open the 360 viewer directly)

/* ─── Main Gallery Component ─────────────────────────────────────────────── */

export function VR360Gallery({ items }: VR360GalleryProps) {
  const isMobile = useIsMobile();
  const [activeViewerItem, setActiveViewerItem] = useState<PanoramaData | null>(null);
  const [gyroAllowed, setGyroAllowed] = useState(false);

  const handleCardClick = async (item: PanoramaData) => {
    if (isMobile) {
      // iOS 13+ device orientation permission request handshake on user interaction gesture
      let allowed = false;
      const DeviceOrientation = (window as any).DeviceOrientationEvent;
      if (
        typeof DeviceOrientation !== 'undefined' &&
        typeof DeviceOrientation.requestPermission === 'function'
      ) {
        try {
          const permissionState = await DeviceOrientation.requestPermission();
          allowed = (permissionState === 'granted');
        } catch (error) {
          console.error('Error requesting orientation permission on user gesture:', error);
        }
      } else {
        // Non-iOS mobile device (e.g. Android), where permission is implicitly granted by default
        allowed = true;
      }
      setGyroAllowed(allowed);
      setActiveViewerItem(item);
    } else {
      // On desktop, open the viewer modal directly with gyro disabled (enables mouse drag)
      setGyroAllowed(false);
      setActiveViewerItem(item);
    }
  };

  return (
    <div className="app-page min-h-screen text-white font-sans flex flex-col">
      <GalleryNav activePage="ar360" />
      
      <main className="mx-auto w-full max-w-7xl px-6 pt-8 pb-16 md:pt-12 md:pb-24 flex-1">
        {/* ── Header ── */}
        <header className="mb-8 md:mb-12">
          <div className="ar360-header__eyebrow">
            <span className="ar360-header__eyebrow-dot" />
            Mobile 360 Experience
          </div>
          <h1 className="ar360-header__title">
            360° <span>Gallery</span>
          </h1>
          <p className="ar360-header__sub">
            Explore 360° environments from every angle. <br />
            On a mobile device, simply move your phone to look around. <br />
            On a desktop, click and drag with your mouse to navigate the scene.
          </p>
        </header>

        {/* ── Gallery Grid ── */}
        {items.length > 0 ? (
          <div className="ar360-gallery">
            {items.map(item => (
              <VR360Card
                key={item.id}
                item={item}
                onClick={handleCardClick}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-center rounded-2xl border border-white/10 bg-white/5">
            <div className="text-5xl mb-6">🌐</div>
            <h2 className="text-2xl font-medium text-white/70">No 360 Images Found</h2>
            <p className="mt-4 text-white/40 max-w-md">
              Add 360 equirectangular images (.jpg, .jpeg, .png, .webp) to the <code className="text-teal-400/70">public/AR360Assets</code> directory.
            </p>
          </div>
        )}
      </main>

      {/* (Desktop Fallback Modal removed, desktop opens viewer directly) */}

      {/* ── Immersive VR 360 Viewer Modal ── */}
      {activeViewerItem && (
        <VR360ViewerModal
          imageUrl={activeViewerItem.fileUrl}
          title={activeViewerItem.displayName}
          initialGyroActive={gyroAllowed}
          onClose={() => setActiveViewerItem(null)}
          isVideo={activeViewerItem.isVideo}
        />
      )}
    </div>
  );
}
