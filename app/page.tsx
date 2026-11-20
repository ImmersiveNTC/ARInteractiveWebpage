'use client';

import Link from 'next/link';
import { useState } from 'react';

type CategoryRowConfig = {
  id: string;
  title: string;
  kind: '360' | '3d' | 'ar';
  accentColor: string;
  rowTintClass: string;
  buttonHoverClass: string;
  left: { href: string; label: string };
  right: { href: string; label: string };
};

const CATEGORY_ROWS: CategoryRowConfig[] = [
  {
    id: '360',
    title: '360 Gallery',
    kind: '360',
    accentColor: 'rgba(45, 212, 191, 0.85)',
    rowTintClass: 'from-teal-500/10 via-transparent to-teal-500/10 border-teal-500/15',
    buttonHoverClass:
      'hover:bg-teal-500/15 hover:border-teal-400/40 hover:text-teal-100 hover:shadow-[0_0_16px_rgba(20,184,166,0.18)]',
    left: { href: '/360Image', label: 'Tours' },
    right: { href: '/360Video', label: 'Videos' },
  },
  {
    id: '3d',
    title: '3D Gallery',
    kind: '3d',
    accentColor: 'rgba(138, 86, 255, 0.85)',
    rowTintClass: 'from-indigo-500/10 via-transparent to-indigo-500/10 border-indigo-500/15',
    buttonHoverClass:
      'hover:bg-indigo-500/15 hover:border-indigo-400/40 hover:text-indigo-100 hover:shadow-[0_0_16px_rgba(99,102,241,0.18)]',
    left: { href: '/3Ds', label: 'Static' },
    right: { href: '/3Di', label: 'Interactive' },
  },
  {
    id: 'ar',
    title: 'AR Gallery',
    kind: 'ar',
    accentColor: 'rgba(245, 158, 11, 0.9)',
    rowTintClass: 'from-amber-500/10 via-transparent to-amber-500/10 border-amber-500/15',
    buttonHoverClass:
      'hover:bg-amber-500/15 hover:border-amber-400/40 hover:text-amber-100 hover:shadow-[0_0_16px_rgba(245,158,11,0.18)]',
    left: { href: '/ARs', label: 'Static' },
    right: { href: '/ARi', label: 'Interactive' },
  },
];

function CategoryIcon({
  kind,
  accentColor,
}: {
  kind: CategoryRowConfig['kind'];
  accentColor: string;
}) {
  if (kind === '3d') {
    return (
      <div
        className="w-14 h-14 flex items-center justify-center shrink-0"
        style={{ ['--i3d-accent' as string]: accentColor }}
      >
        <div className="i3d-cube-wrap mb-0!" style={{ transform: 'scale(0.95)' }}>
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
    );
  }

  if (kind === 'ar') {
    return (
      <div className="w-14 h-14 flex items-center justify-center relative shrink-0">
        <div className="iosar-target" aria-hidden="true" style={{ transform: 'scale(0.88)' }}>
          <div className="iosar-target__ring iosar-target__ring--outer" style={{ borderColor: accentColor }} />
          <div className="iosar-target__ring iosar-target__ring--inner" style={{ borderColor: accentColor }} />
          <div className="iosar-target__corners">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className={`iosar-target__corner iosar-target__corner--${i}`} style={{ borderColor: accentColor }} />
            ))}
          </div>
          <div className="iosar-target__dot" style={{ backgroundColor: accentColor }} />
        </div>
      </div>
    );
  }

  return (
    <div className="w-14 h-14 flex items-center justify-center relative shrink-0">
      <div className="ar360-sphere-wrap" aria-hidden="true" style={{ transform: 'scale(0.88)' }}>
        <div className="ar360-sphere" style={{ ['--ar360-accent' as string]: accentColor }} />
        <div className="ar360-sphere__orbit" style={{ borderColor: accentColor }} />
        <div className="ar360-sphere__orbit ar360-sphere__orbit--vertical" style={{ borderColor: accentColor }} />
      </div>
    </div>
  );
}

export default function Home() {
  const [qrEnlarged, setQrEnlarged] = useState(false);
  const [copied, setCopied] = useState(false);
  const pageUrl = 'https://immersiventc.github.io/ARInteractiveWebpage/';

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    navigator.clipboard.writeText(pageUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="app-page min-h-dvh text-white font-sans flex flex-col items-center justify-start md:justify-center px-5 py-7 md:py-6 bg-[#0a0a0a]">
      {/* Header */}
      <header className="mb-5 md:mb-6 text-center">
        <h1 className="text-3xl md:text-4xl font-bold mb-2 tracking-tight">
          Immersive Webpage
        </h1>
        <p className="text-xs md:text-sm text-white/60 max-w-lg mx-auto">
          Explore our collection of interactive 3D models and augmented reality assets. Please note that assets are works in progress, including third-party models used for demonstration.
        </p>
      </header>

      {/* 3 Category Rows: [ Left Button ] — [ Center Icon + Category Title ] — [ Right Button ] */}
      <div className="flex flex-col gap-3 w-full max-w-3xl mb-6 relative z-10">
        {CATEGORY_ROWS.map(row => (
          <section
            key={row.id}
            aria-label={row.title}
            className={`relative overflow-hidden rounded-3xl border bg-gradient-to-r bg-white/[0.04] backdrop-blur-md px-4 py-2.5 sm:px-5 sm:py-3 shadow-xl ${row.rowTintClass}`}
          >
            <div className="grid grid-cols-2 sm:grid-cols-[1fr_minmax(220px,auto)_1fr] items-center gap-2.5 sm:gap-4">
              {/* Center Category Title + Animated Icon (top on mobile, middle on sm+) */}
              <div className="col-span-2 sm:col-span-1 sm:order-2 flex items-center justify-center gap-3">
                <CategoryIcon kind={row.kind} accentColor={row.accentColor} />
                <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight whitespace-nowrap">
                  {row.title}
                </h2>
              </div>

              {/* Left Action Button */}
              <Link
                href={row.left.href}
                className={`sm:order-1 flex items-center justify-center py-3 px-5 rounded-2xl border border-white/10 bg-white/[0.06] text-base font-semibold text-white/90 transition-all duration-200 hover:-translate-y-0.5 ${row.buttonHoverClass}`}
              >
                {row.left.label}
              </Link>

              {/* Right Action Button */}
              <Link
                href={row.right.href}
                className={`sm:order-3 flex items-center justify-center py-3 px-5 rounded-2xl border border-white/10 bg-white/[0.06] text-base font-semibold text-white/90 transition-all duration-200 hover:-translate-y-0.5 ${row.buttonHoverClass}`}
              >
                {row.right.label}
              </Link>
            </div>
          </section>
        ))}
      </div>

      {/* Bottom Row: Compact QR Card + Feedback Button Side-by-Side */}
      <div className={`flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-5 relative ${qrEnlarged ? 'z-50' : 'z-10'}`}>
        {/* Compact QR Code Card (tap to expand) */}
        <div
          onClick={() => setQrEnlarged(!qrEnlarged)}
          className={`cursor-pointer transition-all duration-500 ease-in-out border border-white/10 overflow-hidden shadow-2xl flex items-center justify-center
            ${qrEnlarged
              ? 'fixed inset-4 md:inset-20 z-[60] bg-[#111] backdrop-blur-xl rounded-3xl flex-col'
              : 'rounded-2xl px-3 py-2.5 bg-white/5 hover:scale-[1.03] hover:bg-white/10'
            }
          `}
        >
          {qrEnlarged && (
            <button
              className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors p-2 text-2xl cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setQrEnlarged(false);
              }}
              aria-label="Close enlarged QR code"
            >
              ✕
            </button>
          )}

          <div
            className={
              qrEnlarged
                ? 'flex flex-col items-center w-full h-full justify-center p-6'
                : 'flex items-center gap-3'
            }
          >
            <div
              className={`bg-white flex items-center justify-center overflow-hidden transition-all duration-500 shrink-0 ${
                qrEnlarged ? 'w-[60vmin] h-[60vmin] rounded-2xl' : 'w-14 h-14 rounded-xl'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/ARInteractiveWebpage/immersive-qr-code.png"
                alt="QR Code"
                className={`w-full h-full object-contain ${qrEnlarged ? 'p-2' : 'p-1'}`}
              />
            </div>

            {/* Copy to Clipboard Button */}
            <button
              onClick={handleCopy}
              className={`flex items-center justify-between gap-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors border border-white/10 cursor-pointer ${
                qrEnlarged ? 'scale-125 mt-8 px-4 py-3 w-full max-w-[220px]' : 'px-3 py-2 max-w-[175px]'
              }`}
            >
              <span className="text-[11px] text-white/75 truncate flex-1 text-left">
                {copied ? 'Link copied!' : pageUrl.replace(/^https?:\/\//, '')}
              </span>
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-white/90 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>

            {qrEnlarged && (
              <p className="mt-8 text-white/50 text-lg">Tap outside to close</p>
            )}
          </div>
        </div>

        {/* Backdrop for enlarged QR */}
        {qrEnlarged && (
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[55]"
            onClick={() => setQrEnlarged(false)}
          />
        )}

        {/* Feedback Button */}
        <a
          href="https://forms.cloud.microsoft/Pages/ResponsePage.aspx?id=HcsB-6i7GkyU7979ecWaCSnp0LyYrbNAsuKV9Y5136tUN0tSMTVOVFVaUVVINDdFNk1MSzZZUTlQTiQlQCN0PWcu"
          target="_blank"
          rel="noopener noreferrer"
          className="px-8 py-3.5 rounded-full text-sm font-semibold tracking-widest bg-indigo-500/20 border border-indigo-500/35 text-indigo-200 shadow-[0_0_12px_rgba(99,102,241,0.2)] animate-feedback-pulse hover:bg-indigo-500/35 hover:border-indigo-500/50 hover:text-white hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(99,102,241,0.4)] transition-all duration-300 whitespace-nowrap"
        >
          Tell Us What You Think
        </a>
      </div>
    </div>
  );
}
