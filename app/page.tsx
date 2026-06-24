'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function Home() {
  const [qrEnlarged, setQrEnlarged] = useState(false);

  return (
    <div className="app-page min-h-screen text-white font-sans flex flex-col items-center justify-center p-6 bg-[#0a0a0a]">
      
      {/* Header */}
      <header className="mb-12 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
          Immersive Webpage
        </h1>
        <p className="text-white/60 max-w-lg mx-auto">
          Explore our collection of interactive 3D models and augmented reality assets.
        </p>
      </header>

      {/* The Two Main Cards */}
      <div className="flex flex-col md:flex-row gap-8 w-full max-w-4xl mb-16 relative z-10">
        
        {/* Interactive 3D Gallery Card */}
        <Link 
          href="/i3d" 
          className="flex-1 group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 transition-all hover:bg-white/10 hover:border-white/20 hover:-translate-y-1"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative z-10 flex flex-col items-center text-center h-full">
            <div className="w-20 h-20 mb-6 flex items-center justify-center" style={{ ['--i3d-accent' as string]: 'rgba(138, 86, 255, 0.8)' }}>
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
            <h2 className="text-2xl font-bold mb-3 text-white">Interactive 3D gallery</h2>
            <p className="text-white/60">
              Explore and interact with high-fidelity 3D models directly in your browser.
            </p>
          </div>
        </Link>

        {/* AR Gallery Card */}
        <Link 
          href="/iosar" 
          className="flex-1 group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 transition-all hover:bg-white/10 hover:border-white/20 hover:-translate-y-1"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative z-10 flex flex-col items-center text-center h-full">
            <div className="w-20 h-20 mb-6 flex items-center justify-center relative">
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
            <h2 className="text-2xl font-bold mb-3 text-white">AR gallery</h2>
            <p className="text-white/60">
              Launch models into your physical space using Augmented Reality on iOS devices.
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
              : 'w-64 h-72 bg-white/5 hover:scale-105 hover:bg-white/10'
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
          
          <div className="p-6 flex flex-col items-center w-full h-full justify-center">
            <h2 className={`font-semibold text-white/90 mb-6 ${qrEnlarged ? 'text-3xl' : 'text-xl'}`}>
              Scan to view on mobile
            </h2>
            <div className={`bg-white rounded-2xl flex items-center justify-center overflow-hidden transition-all duration-500 ${qrEnlarged ? 'w-[60vmin] h-[60vmin]' : 'w-40 h-40'}`}>
              <svg viewBox="0 0 100 100" className="w-full h-full text-black/20 p-4" fill="currentColor">
                <path fillRule="evenodd" clipRule="evenodd" d="M10 10h30v30H10V10zm5 5v20h20V15H15zm45-5h30v30H60V10zm5 5v20h20V15H65zM10 60h30v30H10V60zm5 5v20h20V65H15zm40 0h10v10H55V65zm20 0h10v10H75V65zm-20 20h10v10H55V85zm20 0h10v10H75V85zm-10-10h10v10H65V75zm0-20h10v10H65V55zm-10-10h10v10H55V45zm20 0h10v10H75V45zm0 10h10v10H75V55z" />
                <rect x="20" y="20" width="10" height="10" />
                <rect x="70" y="20" width="10" height="10" />
                <rect x="20" y="70" width="10" height="10" />
              </svg>
            </div>
            {qrEnlarged && (
              <p className="mt-8 text-white/50 text-lg">Tap anywhere to close</p>
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

    </div>
  );
}
