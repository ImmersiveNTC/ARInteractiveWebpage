'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MouseEvent, useEffect, useState } from 'react';
import { AssetItem } from '../lib/assetTypes';
import { GalleryNav, GalleryPageKey } from './GalleryNav';

export const VR360_GYRO_ALLOWED_KEY = 'vr360_gyro_allowed';

type VR360GalleryViewProps = {
  activePage: GalleryPageKey;
  title: string;
  subtitle: string;
  baseRoute: '/360Image' | '/360Video';
  suffixHint: '-360pic' | '-360vid';
  emptyHeading: string;
  items: AssetItem[];
};

function VR360SphereIcon({ accentColor }: { accentColor: string }) {
  return (
    <div className="ar360-sphere-wrap" aria-hidden="true">
      <div className="ar360-sphere" style={{ ['--ar360-accent' as string]: accentColor }} />
      <div className="ar360-sphere__orbit" style={{ borderColor: accentColor }} />
      <div className="ar360-sphere__orbit ar360-sphere__orbit--vertical" style={{ borderColor: accentColor }} />
    </div>
  );
}

/** Shared gallery layout for 360 Tours Gallery (/360Image) and 360 Videos (/360Video). */
export function VR360GalleryView({
  activePage,
  title,
  subtitle,
  baseRoute,
  suffixHint,
  emptyHeading,
  items,
}: VR360GalleryViewProps) {
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    setTimeout(() => {
      setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua));
    }, 0);
  }, []);

  const handleCardClick = async (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!isMobile) {
      try {
        sessionStorage.setItem(VR360_GYRO_ALLOWED_KEY, '0');
      } catch {
        // Ignore storage errors.
      }
      return;
    }

    const DeviceOrientation = (
      window as unknown as {
        DeviceOrientationEvent?: { requestPermission?: () => Promise<string> };
      }
    ).DeviceOrientationEvent;

    if (DeviceOrientation && typeof DeviceOrientation.requestPermission === 'function') {
      // Request iOS 13+ orientation permission on the user tap gesture before navigating.
      e.preventDefault();
      let allowed = false;
      try {
        const permissionState = await DeviceOrientation.requestPermission();
        allowed = permissionState === 'granted';
      } catch (error) {
        console.error('Error requesting orientation permission on user gesture:', error);
      }
      try {
        sessionStorage.setItem(VR360_GYRO_ALLOWED_KEY, allowed ? '1' : '0');
      } catch {
        // Ignore storage errors.
      }
      router.push(href);
      return;
    }

    try {
      sessionStorage.setItem(VR360_GYRO_ALLOWED_KEY, '1');
    } catch {
      // Ignore storage errors.
    }
  };

  return (
    <div className="app-page min-h-screen text-white font-sans flex flex-col">
      <GalleryNav activePage={activePage} />

      <main className="mx-auto w-full max-w-7xl px-6 pt-8 pb-16 md:pt-12 md:pb-24 flex-1">
        <header className="mb-8 md:mb-12">
          <div className="ar360-header__eyebrow">
            <span className="ar360-header__eyebrow-dot" />
            Mobile 360 Experience
          </div>
          <h1 className="ar360-header__title">{title}</h1>
          <p className="ar360-header__sub">{subtitle}</p>
        </header>

        {items.length > 0 ? (
          <div className="ar360-gallery">
            {items.map(item => {
              const itemHref = `${baseRoute}/${item.slug}`;
              return (
                <Link
                  key={item.id}
                  id={item.id}
                  href={itemHref}
                  onClick={e => handleCardClick(e, itemHref)}
                  className="ar360-card group"
                  style={{
                    animationDelay: `${item.index * 100 + 50}ms`,
                    ['--ar360-accent' as string]: item.accentColor,
                  }}
                  aria-label={`View ${item.displayName} 360 experience`}
                >
                  <div className="ar360-card__accent" />
                  <div className="ar360-card__glow" style={{ background: item.accentColor }} />

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
                      <img src={item.fileUrl} alt={item.displayName} loading="lazy" />
                    )}
                  </div>

                  <div className="ar360-card__body">
                    <VR360SphereIcon accentColor={item.accentColor} />
                    <div>
                      <h3 className="ar360-card__name">{item.displayName}</h3>
                      <p className="ar360-card__category">{item.category}</p>
                    </div>
                  </div>

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

                  <div className="ar360-card__cta" style={{ ['--ar360-accent' as string]: item.accentColor }}>
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 3h6v6" />
                      <path d="M9 21H3v-6" />
                      <path d="M21 3l-7 7" />
                      <path d="M3 21l7-7" />
                    </svg>
                    Step Inside
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-center rounded-2xl border border-white/10 bg-white/5">
            <div className="text-5xl mb-6">🌐</div>
            <h2 className="text-2xl font-medium text-white/70">{emptyHeading}</h2>
            <p className="mt-4 text-white/40 max-w-md">
              Add files ending with <code className="text-teal-400/70">{suffixHint}</code> to the{' '}
              <code className="text-teal-400/70">public/360assets</code> directory.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
