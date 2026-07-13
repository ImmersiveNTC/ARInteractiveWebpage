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
      className="ar360-card"
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
      <div className="ar360-card__thumbnail">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img 
          src={item.fileUrl} 
          alt={item.displayName}
          loading="lazy"
        />
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
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
            <path d="M2 12h20" />
          </svg>
        </span>
        360°
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

/* ─── Desktop Fallback Modal ─────────────────────────────────────────────── */

function DesktopModal({ 
  item, 
  pageUrl, 
  onClose, 
  onLaunchPreview 
}: { 
  item: PanoramaData; 
  pageUrl: string; 
  onClose: () => void;
  onLaunchPreview: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div className="ar360-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Open in 360°">
      <div className="ar360-modal" onClick={e => e.stopPropagation()}>
        {/* Close */}
        <button className="ar360-modal__close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Panorama icon */}
        <div className="ar360-modal__icon">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            <path d="M2 12h20" />
          </svg>
        </div>

        <h2 className="ar360-modal__title">Step Inside</h2>
        <p className="ar360-modal__model">{item.displayName}</p>
        <p className="ar360-modal__sub">
          Scan the QR code with your iPhone to explore this environment in immersive VR using motion controls.
        </p>

        {/* QR Code */}
        <div className="ar360-modal__qr">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pageUrl)}&bgcolor=ffffff&color=111111&qzone=2`}
            alt="QR Code to open on mobile"
            width="200"
            height="200"
          />
        </div>

        <p className="ar360-modal__url">{pageUrl}</p>

        {/* Preview Button */}
        <button className="ar360-modal__preview-btn" onClick={onLaunchPreview}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          Preview in Browser
        </button>
      </div>
    </div>
  );
}

/* ─── Main Gallery Component ─────────────────────────────────────────────── */

export function VR360Gallery({ items }: VR360GalleryProps) {
  const isMobile = useIsMobile();
  const [selectedItem, setSelectedItem] = useState<PanoramaData | null>(null);
  const [activeViewerItem, setActiveViewerItem] = useState<PanoramaData | null>(null);
  const [gyroAllowed, setGyroAllowed] = useState(false);
  const [pageUrl, setPageUrl] = useState('');

  useEffect(() => {
    setTimeout(() => {
      setPageUrl(window.location.href);
    }, 0);
  }, []);

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
      setSelectedItem(item);
    }
  };

  return (
    <div className="app-page min-h-screen text-white font-sans flex flex-col">
      <GalleryNav activePage="ar360" />
      
      <main className="mx-auto w-full max-w-7xl px-6 pt-12 pb-24 md:pt-16 md:pb-32 flex-1">
        {/* ── Header ── */}
        <header className="mb-16">
          <div className="ar360-header__eyebrow">
            <span className="ar360-header__eyebrow-dot" />
            Mobile 360 Experience
          </div>
          <h1 className="ar360-header__title">
            AR 360 <span>Gallery</span>
          </h1>
          <p className="ar360-header__sub">
            Step inside detailed 360° environments. Look around using your phone&apos;s 
            gyroscope sensors, or drag to explore on desktop.
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
              Add 360 equirectangular images (.jpg, .jpeg, .png, .webp) to the <code className="text-teal-400/70">public/VR360Assets</code> directory.
            </p>
          </div>
        )}
      </main>

      {/* ── Desktop Fallback Modal ── */}
      {selectedItem && (
        <DesktopModal
          item={selectedItem}
          pageUrl={pageUrl}
          onClose={() => setSelectedItem(null)}
          onLaunchPreview={() => {
            setGyroAllowed(false); // Disable gyro tracking for desktop environment previews
            setActiveViewerItem(selectedItem);
            setSelectedItem(null);
          }}
        />
      )}

      {/* ── Immersive VR 360 Viewer Modal ── */}
      {activeViewerItem && (
        <VR360ViewerModal
          imageUrl={activeViewerItem.fileUrl}
          title={activeViewerItem.displayName}
          initialGyroActive={gyroAllowed}
          onClose={() => setActiveViewerItem(null)}
        />
      )}
    </div>
  );
}
