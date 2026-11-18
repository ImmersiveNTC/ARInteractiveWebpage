'use client';

import Link from 'next/link';
import { useState } from 'react';

type GalleryCardConfig = {
  href: string;
  title: string;
  description: string;
  kind: '3d' | 'ar' | '360';
  badge: string;
  gradientClass: string;
  accentColor: string;
};

const GALLERY_CARDS: GalleryCardConfig[] = [
  {
    href: '/360Image',
    title: '360 Tours Gallery',
    description: 'Immerse yourself in 360° panoramic environments.',
    kind: '360',
    badge: 'Images',
    gradientClass: 'from-teal-500/10',
    accentColor: 'rgba(45, 212, 191, 0.85)',
  },
  {
    href: '/360Video',
    title: '360 Videos',
    description: 'Watch immersive 360° spherical videos in your browser.',
    kind: '360',
    badge: 'Videos',
    gradientClass: 'from-teal-500/15',
    accentColor: 'rgba(20, 184, 166, 0.9)',
  },
  {
    href: '/3Ds',
    title: 'Static 3D Gallery',
    description: 'Inspect static 3D models with rotate and zoom.',
    kind: '3d',
    badge: 'Static',
    gradientClass: 'from-indigo-500/10',
    accentColor: 'rgba(138, 86, 255, 0.8)',
  },
  {
    href: '/3Di',
    title: 'Interactive 3D Gallery',
    description: 'Explore and interact with animated 3D models.',
    kind: '3d',
    badge: 'Interactive',
    gradientClass: 'from-indigo-500/15',
    accentColor: 'rgba(99, 102, 241, 0.9)',
  },
  {
    href: '/ARs',
    title: 'Static AR Gallery',
    description: 'Launch static models into the real environment using AR.',
    kind: 'ar',
    badge: 'Static',
    gradientClass: 'from-amber-500/10',
    accentColor: 'rgba(251, 146, 60, 0.85)',
  },
  {
    href: '/ARi',
    title: 'Interactive AR Gallery',
    description: 'Experience interactive models in augmented reality.',
    kind: 'ar',
    badge: 'Interactive',
    gradientClass: 'from-amber-500/15',
    accentColor: 'rgba(245, 158, 11, 0.9)',
  },
];

function GalleryCardIcon({ kind, accentColor }: { kind: GalleryCardConfig['kind']; accentColor: string }) {
  if (kind === '3d') {
    return (
      <div className="w-16 h-16 mb-3 flex items-center justify-center" style={{ ['--i3d-accent' as string]: accentColor }}>
        <div className="i3d-cube-wrap" style={{ transform: 'scale(0.9)' }}>
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
      <div className="w-16 h-16 mb-3 flex items-center justify-center relative">
        <div className="iosar-target" aria-hidden="true" style={{ transform: 'scale(0.9)' }}>
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
    <div className="w-16 h-16 mb-3 flex items-center justify-center relative">
      <div className="ar360-sphere-wrap" aria-hidden="true" style={{ transform: 'scale(0.9)' }}>
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
    <div className="app-page min-h-screen text-white font-sans flex flex-col items-center justify-center p-6 bg-[#0a0a0a]">
      {/* Header */}
      <header className="mb-8 md:mb-10 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
          Immersive Webpage
        </h1>
        <p className="text-white/60 max-w-lg mx-auto">
          Explore our collection of interactive 3D models and augmented reality assets. Please note that assets are works in progress, including third-party models used for demonstration.
        </p>
      </header>

      {/* 2-Column × 3-Row Gallery Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full max-w-5xl mb-8 relative z-10">
        {GALLERY_CARDS.map(card => (
          <Link
            key={card.href}
            href={card.href}
            className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 transition-all hover:bg-white/10 hover:border-white/20 hover:-translate-y-1"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${card.gradientClass} to-transparent opacity-0 group-hover:opacity-100 transition-opacity`} />
            <span className="absolute top-4 right-4 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-white/10 border border-white/10 text-white/70">
              {card.badge}
            </span>
            <div className="relative z-10 flex flex-col items-center text-center h-full">
              <GalleryCardIcon kind={card.kind} accentColor={card.accentColor} />
              <h2 className="text-xl md:text-2xl font-bold mb-1.5 text-white">{card.title}</h2>
              <p className="text-sm text-white/60">{card.description}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* QR Code Card (Centered Below) */}
      <div className={`relative ${qrEnlarged ? 'z-50' : 'z-10'}`}>
        <div
          onClick={() => setQrEnlarged(!qrEnlarged)}
          className={`cursor-pointer transition-all duration-500 ease-in-out border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col items-center justify-center
            ${qrEnlarged
              ? 'fixed inset-4 md:inset-20 z-[60] bg-[#111] backdrop-blur-xl'
              : 'w-[17rem] h-auto py-4 bg-white/5 hover:scale-105 hover:bg-white/10'
            }
          `}
        >
          {qrEnlarged && (
            <button
              className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors p-2 text-2xl"
              onClick={(e) => {
                e.stopPropagation();
                setQrEnlarged(false);
              }}
            >
              ✕
            </button>
          )}

          <div className={`flex flex-col items-center w-full h-full justify-center ${qrEnlarged ? 'p-6' : 'p-4'}`}>
            <h2 className={`font-semibold text-white/90 ${qrEnlarged ? 'text-3xl mb-6' : 'text-sm mb-3'}`}>
              Scan to view on mobile
            </h2>

            <div className={`bg-white rounded-2xl flex items-center justify-center overflow-hidden transition-all duration-500 ${qrEnlarged ? 'w-[60vmin] h-[60vmin]' : 'w-28 h-28'}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/ARInteractiveWebpage/immersive-qr-code.png"
                alt="QR Code"
                className="w-full h-full object-contain p-2"
              />
            </div>

            {/* Copy to Clipboard Button */}
            <button
              onClick={handleCopy}
              className={`flex items-center justify-between gap-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors border border-white/10 w-full max-w-[220px] ${
                qrEnlarged ? 'scale-125 mt-10 px-4 py-3' : 'mt-3 px-3 py-2'
              }`}
            >
              <span className="text-[10px] text-white/70 truncate flex-1 text-left">
                {copied ? 'Link copied!' : pageUrl.replace(/^https?:\/\//, '')}
              </span>
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-white/90 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      </div>

      {/* Feedback Button */}
      <div className="mt-6 relative z-10 flex justify-center">
        <a
          href="https://forms.cloud.microsoft/Pages/ResponsePage.aspx?id=HcsB-6i7GkyU7979ecWaCSnp0LyYrbNAsuKV9Y5136tUN0tSMTVOVFVaUVVINDdFNk1MSzZZUTlQTiQlQCN0PWcu"
          target="_blank"
          rel="noopener noreferrer"
          className="px-10 py-4 rounded-full text-sm font-semibold tracking-widest bg-indigo-500/20 border border-indigo-500/35 text-indigo-200 shadow-[0_0_12px_rgba(99,102,241,0.2)] animate-feedback-pulse hover:bg-indigo-500/35 hover:border-indigo-500/50 hover:text-white hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(99,102,241,0.4)] transition-all duration-300"
        >
          Tell Us What You Think
        </a>
      </div>
    </div>
  );
}
