'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { QRCode } from 'react-qrcode-logo';
import { AssetItem, BASE_PATH } from '../lib/assetTypes';
import { I3DStandaloneViewer } from './I3DStandaloneViewer';

type BrowserMode = 'loading' | 'ios-safari-chrome' | 'ios-edge' | 'ios-firefox' | 'desktop';

type ARItemViewProps = {
  item: AssetItem;
  backHref: '/ARs' | '/ARi';
  backLabel: string;
  galleryTitle: string;
};

/** Standalone shareable page for an individual AR USDZ model. */
export function ARItemView({ item, backHref, backLabel, galleryTitle }: ARItemViewProps) {
  const fileExtLabel = (item.fileName.split('.').pop() || 'USDZ').toUpperCase();
  const [browserMode, setBrowserMode] = useState<BrowserMode>('loading');
  const [pageUrl, setPageUrl] = useState('');
  const [isLaunching, setIsLaunching] = useState(false);
  const arLinkRef = useRef<HTMLAnchorElement>(null);
  const autoTriggeredRef = useRef(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const isIOS =
      (/iPad|iPhone|iPod/.test(ua) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) &&
      !(window as Window & { MSStream?: unknown }).MSStream;

    setPageUrl(window.location.href);

    if (!isIOS) {
      setBrowserMode('desktop');
      return;
    }

    if (ua.includes('EdgiOS')) {
      setBrowserMode('ios-edge');
    } else if (ua.includes('FxiOS')) {
      setBrowserMode('ios-firefox');
    } else {
      setBrowserMode('ios-safari-chrome');
    }
  }, []);

  useEffect(() => {
    if (autoTriggeredRef.current) return;

    if (browserMode === 'ios-safari-chrome') {
      autoTriggeredRef.current = true;
      const timer = setTimeout(() => {
        setIsLaunching(true);
        arLinkRef.current?.click();
        setTimeout(() => setIsLaunching(false), 3000);
      }, 120);
      return () => clearTimeout(timer);
    }

    if (browserMode === 'ios-edge') {
      autoTriggeredRef.current = true;
      const timer = setTimeout(() => {
        setIsLaunching(true);
        const downloadAnchor = document.createElement('a');
        downloadAnchor.href = item.fileUrl;
        downloadAnchor.download = item.fileName;
        downloadAnchor.style.display = 'none';
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        setTimeout(() => setIsLaunching(false), 3500);
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [browserMode, item.fileName, item.fileUrl]);

  return (
    <div className="app-page min-h-screen text-white font-sans flex flex-col">
      {/* Top Bar */}
      <header className="w-full max-w-7xl mx-auto px-6 py-5 flex items-center justify-between gap-4 border-b border-white/10">
        <div className="flex items-center gap-4 min-w-0">
          <Link
            href={backHref}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/85 hover:text-white text-xs font-medium transition-colors shrink-0"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            {backLabel}
          </Link>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-widest text-amber-400/80 font-semibold">{galleryTitle}</p>
            <h1 className="text-lg md:text-xl font-bold text-white truncate">{item.displayName}</h1>
          </div>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-300 shrink-0">
          {item.category}
        </span>
      </header>

      {/* Main Content */}
      {browserMode === 'loading' && (
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="w-10 h-10 rounded-full border-4 border-white/10 border-t-amber-400 animate-spin" />
        </main>
      )}

      {(browserMode === 'ios-safari-chrome' || browserMode === 'ios-edge' || browserMode === 'ios-firefox') && (
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl">
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-300">
              <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">{item.displayName}</h2>
            <p className="text-sm text-white/60 mb-6">
              {browserMode === 'ios-firefox'
                ? `AR Quick Look is not supported in Firefox on iOS. Open this link in Safari, Chrome, or Edge, or download the ${fileExtLabel} model below.`
                : browserMode === 'ios-edge'
                  ? `Microsoft Edge detected — downloading the ${fileExtLabel} model so you can open it in AR Quick Look.`
                  : 'Opening AR Quick Look on your iPhone. If it does not open automatically, tap the button below.'}
            </p>

            {browserMode === 'ios-safari-chrome' && (
              <a
                ref={arLinkRef}
                href={item.fileUrl}
                rel="ar"
                className="relative inline-flex items-center justify-center gap-2.5 w-full py-3.5 px-6 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition-colors shadow-lg"
                onClick={() => {
                  setIsLaunching(true);
                  setTimeout(() => setIsLaunching(false), 3000);
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${BASE_PATH}/immersive-qr-code.png`}
                  alt=""
                  width={1}
                  height={1}
                  style={{ position: 'absolute', width: 1, height: 1, opacity: 0.01, pointerEvents: 'none' }}
                />
                {isLaunching ? 'Launching AR Quick Look...' : 'View in AR Quick Look'}
              </a>
            )}

            {browserMode === 'ios-edge' && (
              <a
                href={item.fileUrl}
                rel="ar"
                target="_blank"
                download={item.fileName}
                className="relative inline-flex items-center justify-center gap-2.5 w-full py-3.5 px-6 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition-colors shadow-lg"
                onClick={() => {
                  setIsLaunching(true);
                  setTimeout(() => setIsLaunching(false), 3500);
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${BASE_PATH}/immersive-qr-code.png`}
                  alt=""
                  width={1}
                  height={1}
                  style={{ position: 'absolute', width: 1, height: 1, opacity: 0.01, pointerEvents: 'none' }}
                />
                {isLaunching ? 'Starting USDZ Download...' : 'Open / Download AR Model'}
              </a>
            )}

            <a
              href={item.fileUrl}
              download={item.fileName}
              className="mt-3 inline-flex items-center justify-center gap-2 w-full py-3 px-5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 text-white/85 text-sm font-medium transition-colors"
            >
              Download {fileExtLabel}
            </a>
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
