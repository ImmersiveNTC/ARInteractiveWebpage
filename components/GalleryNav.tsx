import Link from 'next/link';

export type GalleryNavProps = {
  activePage: 'i3d' | 'iosar' | 'ar360';
};

export function GalleryNav({ activePage }: GalleryNavProps) {
  return (
    <nav className="w-full max-w-7xl mx-auto px-6 pt-8 flex flex-col sm:flex-row items-center justify-between gap-6 border-b border-white/5 pb-6">
      {/* Back to Home Link */}
      <Link 
        href="/" 
        className="flex items-center gap-2 text-white/60 hover:text-white transition-colors group text-sm font-medium"
      >
        <svg 
          viewBox="0 0 24 24" 
          width="16" 
          height="16" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2.5" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className="group-hover:-translate-x-1 transition-transform"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to Home
      </Link>

      {/* Gallery Selector Tab Pill */}
      <div className="flex items-center gap-1.5 p-1 bg-white/5 rounded-full border border-white/10 backdrop-blur-md">
        <Link 
          href="/i3d" 
          className={`px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-300 ${
            activePage === 'i3d' 
              ? 'bg-indigo-500/20 border border-indigo-500/35 text-indigo-200 shadow-[0_0_12px_rgba(99,102,241,0.2)]' 
              : 'text-white/50 border border-transparent hover:text-white hover:bg-white/5'
          }`}
        >
          Interactive 3D
        </Link>
        
        <Link 
          href="/iosar" 
          className={`px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-300 ${
            activePage === 'iosar' 
              ? 'bg-amber-500/20 border border-amber-500/35 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.2)]' 
              : 'text-white/50 border border-transparent hover:text-white hover:bg-white/5'
          }`}
        >
          iOS AR
        </Link>

        <Link 
          href="/ar360" 
          className={`px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-300 ${
            activePage === 'ar360' 
              ? 'bg-teal-500/20 border border-teal-500/35 text-teal-200 shadow-[0_0_12px_rgba(20,184,166,0.2)]' 
              : 'text-white/50 border border-transparent hover:text-white hover:bg-white/5'
          }`}
        >
          AR 360
        </Link>
      </div>
    </nav>
  );
}
