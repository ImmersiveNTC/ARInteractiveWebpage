'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AssetItem } from '../lib/assetTypes';
import { GalleryNav, GalleryPageKey } from './GalleryNav';

type ARGalleryViewProps = {
  activePage: GalleryPageKey;
  title: string;
  subtitle: string;
  baseRoute: '/ARs' | '/ARi';
  suffixHint: '-ARs' | '-ARi';
  models: AssetItem[];
};

function useIsIOS() {
  const [isIOS, setIsIOS] = useState(false);
  useEffect(() => {
    const ua = navigator.userAgent;
    const appleMobile =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setTimeout(() => {
      setIsIOS(appleMobile && !(window as Window & { MSStream?: unknown }).MSStream);
    }, 0);
  }, []);
  return isIOS;
}

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

/** Shared gallery view for Static AR (/ARs) and Interactive AR (/ARi). */
export function ARGalleryView({
  activePage,
  title,
  subtitle,
  baseRoute,
  suffixHint,
  models,
}: ARGalleryViewProps) {
  const isIOS = useIsIOS();

  useEffect(() => {
    try {
      sessionStorage.removeItem('ar_quicklook_return_path');
    } catch {
      // Ignore storage access errors.
    }
  }, []);

  return (
    <div className="app-page min-h-dvh text-white font-sans flex flex-col">
      <GalleryNav activePage={activePage} />
      <main className="mx-auto w-full max-w-7xl px-6 pt-8 pb-16 md:pt-12 md:pb-24 flex-1">
        <header className="mb-8 md:mb-12">
          <div className="iosar-header__eyebrow">
            <span className="iosar-header__eyebrow-dot" />
            iPhone AR Experience
          </div>
          <h1 className="iosar-header__title">{title}</h1>
          <p className="iosar-header__sub">{subtitle}</p>

          <div className="flex flex-wrap items-center gap-3">
            <div className={`iosar-device-banner ${isIOS ? 'iosar-device-banner--ios' : 'iosar-device-banner--desktop'}`}>
              {isIOS ? (
                <>
                  <span className="iosar-device-banner__dot" />
                  <span>iPhone detected — tap any model card to open its AR page</span>
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                    <line x1="12" y1="18" x2="12.01" y2="18" />
                  </svg>
                  <span>Click any model to inspect it in 3D or scan its QR code on iPhone</span>
                </>
              )}
            </div>

            <Link
              href="/MRTest"
              onClick={() => {
                const DeviceOrientation = (
                  window as unknown as {
                    DeviceOrientationEvent?: { requestPermission?: () => Promise<string> };
                  }
                ).DeviceOrientationEvent;
                if (DeviceOrientation && typeof DeviceOrientation.requestPermission === 'function') {
                  DeviceOrientation.requestPermission().catch(() => {});
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 text-xs font-semibold transition-colors"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              Open Edge MR Test (GLB)
            </Link>
          </div>
        </header>

        {models.length > 0 ? (
          <div className="iosar-gallery">
            {models.map(model => (
              <Link
                key={model.id}
                id={model.id}
                href={`${baseRoute}/${model.slug}`}
                className="iosar-card"
                style={{
                  animationDelay: `${model.index * 110 + 60}ms`,
                  ['--iosar-accent' as string]: model.accentColor,
                }}
              >
                <div className="iosar-card__accent" />
                <div className="iosar-card__glow" style={{ background: model.accentColor }} />

                <div className="iosar-card__body">
                  <ARTargetIcon accentColor={model.accentColor} />
                  <h3 className="iosar-card__name">{model.displayName}</h3>
                  <p className="iosar-card__category">{model.category}</p>
                </div>

                <div className="iosar-card__badge" style={{ ['--iosar-accent' as string]: model.accentColor }}>
                  <span className="iosar-card__badge-icon">
                    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2L2 7l10 5 10-5-10-5z" />
                      <path d="M2 17l10 5 10-5" />
                      <path d="M2 12l10 5 10-5" />
                    </svg>
                  </span>
                  {model.fileName.toLowerCase().endsWith('.reality') ? 'REALITY' : 'AR'}
                </div>

                <div className="iosar-card__cta">
                  {isIOS ? (
                    <>
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                        <circle cx="12" cy="13" r="4" />
                      </svg>
                      View in AR
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                        <line x1="12" y1="18" x2="12.01" y2="18" />
                      </svg>
                      Preview 3D &amp; QR
                    </>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-center rounded-2xl border border-white/10 bg-white/5">
            <div className="text-5xl mb-6">📦</div>
            <h2 className="text-2xl font-medium text-white/70">No AR Models Found</h2>
            <p className="mt-4 text-white/40 max-w-md">
              Add <code className="text-amber-400/70">{suffixHint}</code> .usdz or .reality files to the{' '}
              <code className="text-amber-400/70">public/ARassets</code> directory.
            </p>
          </div>
        )}

        <div className="iosar-footer-note">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          AR Quick Look requires iOS 12+ with Safari or Chrome (supports .usdz and .reality). On Edge iOS, the file downloads directly for Quick Look.
        </div>
      </main>
    </div>
  );
}
