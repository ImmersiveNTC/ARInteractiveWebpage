'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { QRCode } from 'react-qrcode-logo';
import { AssetItem, BASE_PATH } from '../lib/assetTypes';
import { useIsMobileEdgeOrFirefox } from '../lib/browserDetect';
import { I3DStandaloneViewer } from './I3DStandaloneViewer';

type BrowserMode = 'loading' | 'ios-safari-chrome' | 'ios-download' | 'desktop';
type DownloadState = 'idle' | 'downloaded';

const AR_RETURN_PENDING_KEY = 'ar_quicklook_return_path';
/** Share of the loading bar used by the download; the rest covers Quick Look opening. */
const DOWNLOAD_SHARE = 60;
const emptySubscribe = () => () => {};

/** Files already fully downloaded in this session (kept across client-side navigation). */
const preloadedUrls = new Set<string>();
const inflightPreloads = new Map<string, Promise<void>>();
/** Byte size of each preloaded file, used to estimate how long Quick Look takes to open. */
const assetSizes = new Map<string, number>();

/**
 * Downloads the AR file once with real progress. The bytes are discarded — the point is to
 * fill the browser's HTTP cache so Quick Look opens from cache instead of downloading again.
 * `force-cache` reuses any copy already cached, even if older than the server's 10-minute max-age.
 */
function preloadAsset(url: string, onProgress: (progress: number | null) => void): Promise<void> {
  if (preloadedUrls.has(url)) {
    onProgress(100);
    return Promise.resolve();
  }
  const existing = inflightPreloads.get(url);
  if (existing) return existing;

  const task = (async () => {
    try {
      const response = await fetch(url, { cache: 'force-cache' });
      const total = Number(response.headers.get('content-length')) || 0;
      if (total) assetSizes.set(url, total);
      if (!response.body) {
        await response.arrayBuffer();
      } else {
        const reader = response.body.getReader();
        let received = 0;
        onProgress(total ? 0 : null);
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          received += value.byteLength;
          if (total) onProgress(Math.min(99, Math.round((received / total) * 100)));
        }
      }
      preloadedUrls.add(url);
    } catch (err) {
      // If preloading fails, fall back to letting Quick Look download the file itself.
      console.warn('AR preload failed, falling back to direct launch:', err);
    } finally {
      inflightPreloads.delete(url);
      onProgress(100);
    }
  })();

  inflightPreloads.set(url, task);
  return task;
}

function getBrowserModeSnapshot(): BrowserMode {
  const ua = navigator.userAgent;
  const isIOS =
    (/iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) &&
    !(window as Window & { MSStream?: unknown }).MSStream;

  if (!isIOS) return 'desktop';
  if (/EdgiOS|FxiOS|OPiOS/.test(ua)) return 'ios-download';
  return 'ios-safari-chrome';
}

function getServerBrowserMode(): BrowserMode {
  return 'loading';
}

function getPageUrlSnapshot(): string {
  return window.location.href;
}

function getServerPageUrl(): string {
  return '';
}

function checkReturnedFromQuickLook(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const navEntry = performance.getEntriesByType('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined;
    const pendingPath = sessionStorage.getItem(AR_RETURN_PENDING_KEY);
    return pendingPath === window.location.pathname || navEntry?.type === 'back_forward';
  } catch {
    return false;
  }
}

/**
 * Converts an https:// URL into Apple's native Safari URL scheme on iOS so Edge/third-party
 * browsers can hand off the AR subpage directly to Safari for native AR Quick Look.
 */
function getSafariSchemeUrl(httpsUrl: string): string {
  const match = navigator.userAgent.match(/OS (\d+)_/);
  const iosMajor = match ? parseInt(match[1], 10) : 17;
  if (iosMajor > 0 && iosMajor < 17) {
    return `com-apple-mobilesafari-tab:${httpsUrl}`;
  }
  return httpsUrl.replace(/^https?:\/\//i, 'x-safari-https://');
}

type ARItemViewProps = {
  item: AssetItem;
  backHref: '/ARs' | '/ARi';
  backLabel: string;
  galleryTitle: string;
};

/** Standalone shareable page for an individual AR asset. */
export function ARItemView({ item, backHref, backLabel, galleryTitle }: ARItemViewProps) {
  const router = useRouter();
  const useGlbAR = useIsMobileEdgeOrFirefox();
  const fileExtLabel = (item.fileName.split('.').pop() || 'USDZ').toUpperCase();
  const browserMode = useSyncExternalStore(emptySubscribe, getBrowserModeSnapshot, getServerBrowserMode);
  const pageUrl = useSyncExternalStore(emptySubscribe, getPageUrlSnapshot, getServerPageUrl);
  const [downloadState, setDownloadState] = useState<DownloadState>('idle');
  const [loadState, setLoadState] = useState<'loading' | 'ready'>(() =>
    preloadedUrls.has(item.fileUrl) || checkReturnedFromQuickLook() ? 'ready' : 'loading'
  );
  // 0–100 when the size is known, null while the size is unknown.
  const [loadProgress, setLoadProgress] = useState<number | null>(() =>
    preloadedUrls.has(item.fileUrl) || checkReturnedFromQuickLook() ? 100 : 0
  );
  // Progress of the "Quick Look is opening" phase; null when not opening.
  const [openProgress, setOpenProgress] = useState<number | null>(null);
  const arLinkRef = useRef<HTMLAnchorElement>(null);
  const autoTriggeredRef = useRef(false);
  const pendingLaunchRef = useRef(false);
  const openCleanupRef = useRef<(() => void) | null>(null);

  const stopOpening = useCallback(() => {
    openCleanupRef.current?.();
    openCleanupRef.current = null;
    setOpenProgress(null);
  }, []);

  /**
   * Keeps the bar moving while iOS prepares Quick Look (we can't measure that directly).
   * The bar eases toward 95% over an estimate based on file size, and resets to empty as soon
   * as Quick Look covers the page so it is empty when the user closes Quick Look and returns.
   */
  const startOpening = useCallback(
    (startAt: number) => {
      openCleanupRef.current?.();

      const sizeMb = (assetSizes.get(item.fileUrl) ?? 0) / (1024 * 1024);
      const estimateMs = Math.min(12000, Math.max(2500, 2000 + sizeMb * 400));
      const startedAt = performance.now();
      setOpenProgress(startAt);

      const interval = window.setInterval(() => {
        const t = (performance.now() - startedAt) / estimateMs;
        setOpenProgress(Math.round(startAt + (95 - startAt) * (1 - Math.exp(-3 * t))));
      }, 100);

      const handlePageHidden = () => {
        // Quick Look is now covering the screen — reset the bar to empty so when the user
        // closes Quick Look, the button is already in its idle empty state.
        stopOpening();
      };
      const handleVisibility = () => {
        if (document.visibilityState === 'hidden') {
          handlePageHidden();
        }
      };

      window.addEventListener('pagehide', handlePageHidden);
      document.addEventListener('visibilitychange', handleVisibility);

      // Safety net: if Quick Look never signals, return to the ready button eventually.
      const giveUp = window.setTimeout(() => stopOpening(), Math.min(25000, estimateMs * 2 + 5000));

      openCleanupRef.current = () => {
        window.clearInterval(interval);
        window.clearTimeout(giveUp);
        window.removeEventListener('pagehide', handlePageHidden);
        document.removeEventListener('visibilitychange', handleVisibility);
      };
    },
    [item.fileUrl, stopOpening]
  );

  useEffect(() => () => openCleanupRef.current?.(), []);

  /** Opens Quick Look by navigating to the (now cached) file — works without a fresh tap. */
  const launchQuickLook = useCallback(
    (startAt: number) => {
      startOpening(startAt);
      try {
        sessionStorage.setItem(AR_RETURN_PENDING_KEY, window.location.pathname);
      } catch {
        // Ignore storage errors.
      }
      window.location.href = item.fileUrl;
    },
    [item.fileUrl, startOpening]
  );

  const triggerFileDownload = useCallback(() => {
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = item.fileUrl;
    downloadAnchor.download = item.fileName;
    downloadAnchor.style.display = 'none';
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setDownloadState('downloaded');
  }, [item.fileName, item.fileUrl]);

  /**
   * Launches the current AR subpage inside Safari via Apple's URL scheme (`x-safari-https://`),
   * with a timeout fallback to file download if the scheme is blocked or cancelled.
   */
  const launchInSafariOrFallback = useCallback(
    (withDownloadFallback: boolean) => {
      const targetUrl = window.location.href;
      const appScheme = getSafariSchemeUrl(targetUrl);
      const start = Date.now();
      window.location.href = appScheme;

      if (withDownloadFallback) {
        window.setTimeout(() => {
          if (document.visibilityState === 'visible' && Date.now() - start < 2200) {
            triggerFileDownload();
          }
        }, 1600);
      }
    },
    [triggerFileDownload]
  );

  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        try {
          sessionStorage.removeItem(AR_RETURN_PENDING_KEY);
        } catch {
          // Ignore storage access errors in private browsing.
        }
        stopOpening();
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, [stopOpening]);

  useEffect(() => {
    if (useGlbAR) {
      router.replace('/ARglb');
    }
  }, [router, useGlbAR]);

  useEffect(() => {
    if (useGlbAR || autoTriggeredRef.current) return;

    if (browserMode === 'ios-safari-chrome') {
      autoTriggeredRef.current = true;

      const returnedFromQuickLook = checkReturnedFromQuickLook();
      if (returnedFromQuickLook) {
        try {
          sessionStorage.removeItem(AR_RETURN_PENDING_KEY);
        } catch {
          // Ignore storage errors.
        }
        preloadedUrls.add(item.fileUrl);
        return;
      }

      // Auto-open Quick Look once the file has finished preloading.
      pendingLaunchRef.current = true;

      let cancelled = false;
      preloadAsset(item.fileUrl, progress => {
        if (!cancelled) setLoadProgress(progress);
      }).then(() => {
        if (cancelled) return;
        setLoadState('ready');
        if (pendingLaunchRef.current) {
          pendingLaunchRef.current = false;
          // Continue the same bar: download fills 0–60%, opening fills 60–100%.
          launchQuickLook(DOWNLOAD_SHARE);
        }
      });

      return () => {
        cancelled = true;
      };
    }

    if (browserMode === 'ios-download') {
      autoTriggeredRef.current = true;
      const timer = setTimeout(() => {
        // Attempt to hand off directly to Safari via iOS URL scheme so Quick Look opens natively.
        launchInSafariOrFallback(false);
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [browserMode, item.fileUrl, launchInSafariOrFallback, launchQuickLook, useGlbAR]);

  // One continuous bar: download fills 0–DOWNLOAD_SHARE%, Quick Look opening fills the rest.
  const showBar = openProgress !== null || loadState === 'loading';
  const barProgress: number | null =
    openProgress !== null
      ? openProgress
      : loadProgress === null
        ? null
        : Math.round((loadProgress * DOWNLOAD_SHARE) / 100);

  const clearReturnFlag = () => {
    try {
      sessionStorage.removeItem(AR_RETURN_PENDING_KEY);
    } catch {
      // Ignore storage errors.
    }
  };

  if (useGlbAR) {
    return (
      <div className="app-page min-h-dvh text-white font-sans flex flex-col">
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="w-10 h-10 rounded-full border-4 border-white/10 border-t-amber-400 animate-spin" />
        </main>
      </div>
    );
  }

  return (
    <div className="app-page min-h-dvh text-white font-sans flex flex-col">
      {/* Top Bar */}
      <header className="w-full max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4 border-b border-white/10">
        <div className="flex items-center gap-4 min-w-0">
          <Link
            href={backHref}
            onClick={clearReturnFlag}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-white/85 hover:text-white text-xs font-medium transition-colors shrink-0"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            {backLabel}
          </Link>
          {browserMode === 'desktop' && (
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-widest text-amber-400/80 font-semibold">{galleryTitle}</p>
              <h1 className="text-lg md:text-xl font-bold text-white truncate">{item.displayName}</h1>
            </div>
          )}
        </div>
        {browserMode === 'desktop' ? (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-300 shrink-0">
            {item.category}
          </span>
        ) : (
          <span className="text-xs font-semibold uppercase tracking-widest text-amber-400/80 truncate">
            {galleryTitle}
          </span>
        )}
      </header>

      {/* Main Content */}
      {browserMode === 'loading' && (
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="w-10 h-10 rounded-full border-4 border-white/10 border-t-amber-400 animate-spin" />
        </main>
      )}

      {browserMode === 'ios-safari-chrome' && (
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl">
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-300">
              <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-white mb-6">{item.displayName}</h1>

            <a
              ref={arLinkRef}
              href={item.fileUrl}
              rel="ar"
              aria-busy={showBar}
              className="relative overflow-hidden inline-flex items-center justify-center gap-2.5 w-full py-3.5 px-6 rounded-2xl font-semibold text-sm shadow-lg transition-colors duration-300 bg-amber-950/60 hover:bg-amber-900/50 border border-amber-500/35 text-white"
              onClick={e => {
                if (openProgress !== null) {
                  // Already opening — ignore extra taps.
                  e.preventDefault();
                  return;
                }
                if (loadState !== 'ready') {
                  // Still downloading: don't start a second download — open as soon as it finishes.
                  e.preventDefault();
                  pendingLaunchRef.current = true;
                  return;
                }
                // Let the native rel="ar" tap open Quick Look; fill the orange bar while it opens.
                try {
                  sessionStorage.setItem(AR_RETURN_PENDING_KEY, window.location.pathname);
                } catch {
                  // Ignore storage errors.
                }
                startOpening(0);
              }}
            >
              {/* Must stay the first child: iOS requires an <img> inside rel="ar" links. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${BASE_PATH}/immersive-qr-code.png`}
                alt=""
                width={1}
                height={1}
                style={{ position: 'absolute', width: 1, height: 1, opacity: 0.01, pointerEvents: 'none' }}
              />
              {showBar && (
                <span
                  aria-hidden="true"
                  className={`absolute inset-y-0 left-0 bg-amber-500 transition-[width] duration-300 ease-out ${
                    barProgress === null ? 'w-full animate-pulse opacity-60' : ''
                  }`}
                  style={barProgress === null ? undefined : { width: `${barProgress}%` }}
                />
              )}
              <span className="relative z-10 drop-shadow-sm">
                {showBar
                  ? `Loading AR Experience${barProgress ? ` ${barProgress}%` : '...'}`
                  : 'View AR Experience'}
              </span>
            </a>
          </div>
        </main>
      )}

      {browserMode === 'ios-download' && (
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl">
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-300">
              <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-white mb-2">{item.displayName}</h1>
            <p className="text-sm text-white/60 mb-6">
              {downloadState === 'downloaded'
                ? 'AR file downloaded. Tap Share \u2192 Save to Files, then open it from the iPhone Files app to view in AR.'
                : 'Edge on iPhone requires Safari Quick Look to render 3D AR models. Tap below to launch in AR Quick Look.'}
            </p>

            <button
              type="button"
              onClick={() => launchInSafariOrFallback(true)}
              className="inline-flex items-center justify-center gap-2.5 w-full py-3.5 px-6 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition-colors shadow-lg cursor-pointer"
            >
              View AR Experience
            </button>

            <button
              type="button"
              onClick={triggerFileDownload}
              className="mt-4 inline-block text-xs text-amber-300/80 hover:text-amber-300 underline underline-offset-4 transition-colors cursor-pointer"
            >
              {downloadState === 'downloaded'
                ? 'Downloaded — Tap to download again'
                : 'Or download AR file for iPhone Files app'}
            </button>
          </div>
        </main>
      )}

      {browserMode === 'desktop' && (
        <main className="flex-1 w-full max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 min-h-0">
          {/* Left: Live 3D USDZ Preview */}
          <div className="min-h-[480px] lg:min-h-[calc(100vh-140px)]">
            <I3DStandaloneViewer
              fileUrl={item.fileUrl}
              fileName={item.fileName}
              displayName={item.displayName}
              showInteractiveControls={false}
              embedded={true}
            />
          </div>

          {/* Right: Open on iPhone QR + Download */}
          <aside className="rounded-3xl border border-white/10 bg-white/5 p-6 flex flex-col items-center justify-center text-center h-fit lg:sticky lg:top-6">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-300 mb-4">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                <line x1="12" y1="18" x2="12.01" y2="18" />
              </svg>
            </div>

            <h2 className="text-xl font-bold text-white mb-1">Open on iPhone</h2>
            <p className="text-xs text-white/55 mb-5">
              Scan this QR code with your iPhone to launch <strong className="text-white/80">{item.displayName}</strong> in AR Quick Look.
            </p>

            {pageUrl && (
              <div className="bg-white p-3 rounded-2xl shadow-lg mb-4">
                <QRCode value={pageUrl} size={180} quietZone={4} bgColor="#ffffff" fgColor="#111111" />
              </div>
            )}

            <p className="text-[11px] text-white/40 break-all mb-5 px-2">{pageUrl}</p>

            <a
              href={item.fileUrl}
              download={item.fileName}
              className="inline-flex items-center justify-center gap-2 w-full py-3 px-5 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-semibold text-sm transition-colors"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download {fileExtLabel}
            </a>
          </aside>
        </main>
      )}
    </div>
  );
}
