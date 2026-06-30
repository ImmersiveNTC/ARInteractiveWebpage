'use client';

import { useState, useEffect, useRef } from 'react';

/* ─── Types ─────────────────────────────────────────────────────────────── */

type ModelData = {
  id: string;
  displayName: string;
  category: string;
  fileName: string;
  fileUrl: string;
  accentColor: string;
  index: number;
};

type IOSARGalleryProps = {
  models: ModelData[];
};

/* ─── iOS Detection (client-side) ───────────────────────────────────────── */

function useIsIOS() {
  const [isIOS, setIsIOS] = useState(false);
  useEffect(() => {
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream);
  }, []);
  return isIOS;
}

/* ─── AR Scan Target Icon ───────────────────────────────────────────────── */

function ARTargetIcon({ accentColor }: { accentColor: string }) {
  return (
    <div className="iosar-target" aria-hidden="true">
      <div className="iosar-target__ring iosar-target__ring--outer" style={{ borderColor: accentColor }} />
      <div className="iosar-target__ring iosar-target__ring--inner" style={{ borderColor: accentColor }} />
      <div className="iosar-target__corners">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={`iosar-target__corner iosar-target__corner--${i}`} style={{ borderColor: accentColor }} />
        ))}
      </div>
      <div className="iosar-target__dot" style={{ backgroundColor: accentColor }} />
    </div>
  );
}

/* ─── AR Card ───────────────────────────────────────────────────────────── */

function ARCard({ model, onDesktopClick }: { model: ModelData; onDesktopClick: (model: ModelData) => void }) {
  const isIOS = useIsIOS();
  const isEdgeIOS = typeof window !== 'undefined' && window.navigator.userAgent.includes('EdgiOS');
  const linkRef = useRef<HTMLAnchorElement>(null);
  const [isLaunching, setIsLaunching] = useState(false);

  const handleCardClick = () => {
    if (isIOS) {
      // If it's Edge, the tap is handled natively by the absolute overlay anchor.
      if (isEdgeIOS) return;

      const ua = window.navigator.userAgent;
      if (ua.includes('FxiOS')) {
        alert("AR Quick Look is not supported in Firefox. Please open this page in Safari, Chrome, or Edge to launch the AR experience.");
        return;
      }
      
      setIsLaunching(true);
      setTimeout(() => setIsLaunching(false), 3000);
      linkRef.current?.click();
    } else {
      onDesktopClick(model);
    }
  };

  return (
    <div
      id={model.id}
      className="iosar-card"
      style={{
        animationDelay: `${model.index * 110 + 60}ms`,
        ['--iosar-accent' as string]: model.accentColor,
      }}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      aria-label={`View ${model.displayName} in AR`}
      onKeyDown={e => e.key === 'Enter' && handleCardClick()}
    >
      {/* Accent gradient overlay */}
      <div className="iosar-card__accent" />

      {/* Pulsing glow ring on hover */}
      <div className="iosar-card__glow" style={{ background: model.accentColor }} />

      {/* iOS rel="ar" anchors for AR Quick Look */}
      
      {/* 1. Safari/Chrome Strategy: Hidden programmatic anchor */}
      {isIOS && !isEdgeIOS && (
        <a
          ref={linkRef}
          href={model.fileUrl}
          rel="ar"
          aria-hidden="true"
          tabIndex={-1}
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0.01, pointerEvents: 'none' }}
          onClick={e => e.stopPropagation()}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={`${process.env.NODE_ENV === 'production' ? '/ARInteractiveWebpage' : ''}/immersive-qr-code.png`} 
            alt="" 
            width={1} 
            height={1} 
          />
        </a>
      )}

      {/* 2. Edge iOS Strategy: Absolute overlay anchor */}
      {/* Edge blocks programmatic clicks, so the user must tap the anchor directly. */}
      {/* We use target="_blank" and download so Edge doesn't permanently hijack the main page navigation. */}
      {isIOS && isEdgeIOS && (
        <a
          href={model.fileUrl}
          rel="ar"
          target="_blank"
          download={model.fileName}
          aria-hidden="true"
          tabIndex={-1}
          style={{ position: 'absolute', inset: 0, zIndex: 20, display: 'block' }}
          onClick={() => {
            setIsLaunching(true);
            setTimeout(() => setIsLaunching(false), 3500);
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={`${process.env.NODE_ENV === 'production' ? '/ARInteractiveWebpage' : ''}/immersive-qr-code.png`} 
            alt="" 
            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.01 }} 
          />
        </a>
      )}

      {/* Card body */}
      <div className="iosar-card__body">
        {/* AR Scan Target Icon */}
        <ARTargetIcon accentColor={model.accentColor} />

        {/* Model name + category */}
        <h3 className="iosar-card__name">{model.displayName}</h3>
        <p className="iosar-card__category">{model.category}</p>
      </div>

      {/* AR Badge */}
      <div className="iosar-card__badge" style={{ ['--iosar-accent' as string]: model.accentColor }}>
        <span className="iosar-card__badge-icon">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </span>
        AR
      </div>

      {/* CTA hint */}
      <div className="iosar-card__cta">
        {isIOS ? (
          <>
            {isLaunching ? (
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            )}
            {isLaunching ? 'Launching AR...' : 'View in AR'}
          </>
        ) : (
          <>
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
              <line x1="12" y1="18" x2="12.01" y2="18" />
            </svg>
            Open on iPhone
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Desktop Fallback Modal ─────────────────────────────────────────────── */

function DesktopModal({ model, pageUrl, onClose }: { model: ModelData; pageUrl: string; onClose: () => void }) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div className="iosar-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Open in AR">
      <div className="iosar-modal" onClick={e => e.stopPropagation()}>
        {/* Close */}
        <button className="iosar-modal__close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* iPhone icon */}
        <div className="iosar-modal__icon">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
            <line x1="12" y1="18" x2="12.01" y2="18" />
          </svg>
        </div>

        <h2 className="iosar-modal__title">Open on iPhone</h2>
        <p className="iosar-modal__model">{model.displayName}</p>
        <p className="iosar-modal__sub">
          AR Quick Look requires iOS Safari. Scan the QR code with your iPhone to open this page, then tap the model card.
        </p>

        {/* QR Code using a public API */}
        <div className="iosar-modal__qr">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pageUrl)}&bgcolor=ffffff&color=111111&qzone=2`}
            alt="QR Code to open on iPhone"
            width="200"
            height="200"
          />
        </div>

        <p className="iosar-modal__url">{pageUrl}</p>

        {/* Download link */}
        <a
          href={model.fileUrl}
          download={model.fileName}
          className="iosar-modal__download"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download USDZ
        </a>
      </div>
    </div>
  );
}

/* ─── Main Gallery Component ─────────────────────────────────────────────── */

import Link from 'next/link';

export function IOSARGallery({ models }: IOSARGalleryProps) {
  const isIOS = useIsIOS();
  const [selectedModel, setSelectedModel] = useState<ModelData | null>(null);
  const [pageUrl, setPageUrl] = useState('');

  useEffect(() => {
    setPageUrl(window.location.href);
  }, []);

  return (
    <div className="app-page min-h-screen text-white font-sans">
      <main className="mx-auto w-full max-w-7xl px-6 py-24 md:py-32">
        {/* ── Switch to 3D Gallery Button ── */}
        <Link 
          href="/i3d" 
          className="inline-flex items-center gap-3 px-4 py-2 mb-10 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-sm text-white/70 hover:text-white group w-fit"
        >
          <div className="w-5 h-5 flex items-center justify-center relative" style={{ ['--i3d-accent' as string]: 'rgba(138, 86, 255, 0.8)' }}>
            <div className="i3d-cube-wrap" style={{ transform: 'scale(0.25)', transformOrigin: 'center' }}>
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
          Switch to 3D Gallery
        </Link>

        {/* ── Header ── */}
        <header className="mb-16">
          <div className="iosar-header__eyebrow">
            <span className="iosar-header__eyebrow-dot" />
            iPhone AR Experience
          </div>
          <h1 className="iosar-header__title">
            AR Gallery
          </h1>
          <p className="iosar-header__sub">
            Tap any model to launch it in{' '}
            <strong>Augmented Reality</strong> through your iPhone camera.
            Powered by Apple AR Quick Look.
          </p>

          {/* Device indicator banner */}
          <div className={`iosar-device-banner ${isIOS ? 'iosar-device-banner--ios' : 'iosar-device-banner--desktop'}`}>
            {isIOS ? (
              <>
                <span className="iosar-device-banner__dot" />
                <span>iPhone detected — tap any model card to launch AR</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                  <line x1="12" y1="18" x2="12.01" y2="18" />
                </svg>
                <span>Open on iPhone for the full AR experience — or click a card to get the QR code</span>
              </>
            )}
          </div>
        </header>

        {/* ── Gallery Grid ── */}
        {models.length > 0 ? (
          <div className="iosar-gallery">
            {models.map(model => (
              <ARCard
                key={model.id}
                model={model}
                onDesktopClick={setSelectedModel}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-center rounded-2xl border border-white/10 bg-white/5">
            <div className="text-5xl mb-6">📦</div>
            <h2 className="text-2xl font-medium text-white/70">No AR Models Found</h2>
            <p className="mt-4 text-white/40 max-w-md">
              Add .usdz files to the <code className="text-amber-400/70">public/iOSARAssets</code> directory.
            </p>
          </div>
        )}

        {/* ── Footer note ── */}
        <div className="iosar-footer-note">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          AR Quick Look requires iOS 12+ with Safari. All models are in USDZ format — the standard for iOS AR.
        </div>
      </main>

      {/* ── Desktop modal ── */}
      {selectedModel && !isIOS && (
        <DesktopModal
          model={selectedModel}
          pageUrl={pageUrl}
          onClose={() => setSelectedModel(null)}
        />
      )}
    </div>
  );
}
