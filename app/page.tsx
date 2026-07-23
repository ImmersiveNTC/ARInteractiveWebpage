'use client';

import Link from 'next/link';
import { useState } from 'react';

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
      <header className="mb-8 md:mb-12 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
          Immersive Webpage
        </h1>
        <p className="text-white/60 max-w-lg mx-auto">
          Explore our collection of interactive 3D models and augmented reality assets.
        </p>
      </header>

      {/* The Three Main Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl mb-6 md:mb-8 relative z-10">
        
        {/* Interactive 3D Gallery Card */}
        <Link 
          href="/i3d" 
          className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 transition-all hover:bg-white/10 hover:border-white/20 hover:-translate-y-1"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative z-10 flex flex-col items-center text-center h-full">
            <div className="w-20 h-20 mb-4 flex items-center justify-center" style={{ ['--i3d-accent' as string]: 'rgba(138, 86, 255, 0.8)' }}>
              <div className="i3d-cube-wrap" style={{ transform: 'scale(1)' }}>
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
            <h2 className="text-2xl font-bold mb-2 text-white">Interactive 3D gallery</h2>
            <p className="text-white/60">
              Explore and interact with high-fidelity 3D models.
            </p>
          </div>
        </Link>

        {/* AR Gallery Card */}
        <Link 
          href="/iosar" 
          className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 transition-all hover:bg-white/10 hover:border-white/20 hover:-translate-y-1"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative z-10 flex flex-col items-center text-center h-full">
            <div className="w-20 h-20 mb-4 flex items-center justify-center relative">
              <div className="iosar-target" aria-hidden="true" style={{ transform: 'scale(1)' }}>
                <div className="iosar-target__ring iosar-target__ring--outer" style={{ borderColor: 'rgba(251, 146, 60, 0.85)' }} />
                <div className="iosar-target__ring iosar-target__ring--inner" style={{ borderColor: 'rgba(251, 146, 60, 0.85)' }} />
                <div className="iosar-target__corners">
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} className={`iosar-target__corner iosar-target__corner--${i}`} style={{ borderColor: 'rgba(251, 146, 60, 0.85)' }} />
                  ))}
                </div>
                <div className="iosar-target__dot" style={{ backgroundColor: 'rgba(251, 146, 60, 0.85)' }} />
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-2 text-white">AR gallery</h2>
            <p className="text-white/60">
              Launch models into the real environment using augmented reality.
            </p>
          </div>
        </Link>

        {/* AR 360 Gallery Card */}
        <Link 
          href="/ar360" 
          className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 transition-all hover:bg-white/10 hover:border-white/20 hover:-translate-y-1"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-teal-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative z-10 flex flex-col items-center text-center h-full">
            <div className="w-20 h-20 mb-4 flex items-center justify-center relative">
              <div className="ar360-sphere-wrap" aria-hidden="true" style={{ transform: 'scale(1)' }}>
                <div className="ar360-sphere" style={{ ['--ar360-accent' as string]: 'rgba(45, 212, 191, 0.85)' }} />
                <div className="ar360-sphere__orbit" style={{ borderColor: 'rgba(45, 212, 191, 0.85)' }} />
                <div className="ar360-sphere__orbit ar360-sphere__orbit--vertical" style={{ borderColor: 'rgba(45, 212, 191, 0.85)' }} />
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-2 text-white">360° gallery</h2>
            <p className="text-white/60">
              Immerse yourself in 360° environments
            </p>
          </div>
        </Link>

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
