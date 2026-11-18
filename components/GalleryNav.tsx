import Link from 'next/link';

export type GalleryPageKey =
  | '3Ds'
  | '3Di'
  | 'ARs'
  | 'ARi'
  | '360Image'
  | '360Video';

export type GalleryNavProps = {
  activePage: GalleryPageKey;
};

type NavTab = {
  key: GalleryPageKey;
  href: string;
  label: string;
  activeClass: string;
};

const NAV_TABS: NavTab[] = [
  {
    key: '360Image',
    href: '/360Image',
    label: '360° Tours',
    activeClass:
      'bg-teal-500/20 border border-teal-500/35 text-teal-200 shadow-[0_0_12px_rgba(20,184,166,0.2)]',
  },
  {
    key: '360Video',
    href: '/360Video',
    label: '360° Videos',
    activeClass:
      'bg-teal-500/20 border border-teal-500/35 text-teal-200 shadow-[0_0_12px_rgba(20,184,166,0.2)]',
  },
  {
    key: '3Ds',
    href: '/3Ds',
    label: 'Static 3D',
    activeClass:
      'bg-indigo-500/20 border border-indigo-500/35 text-indigo-200 shadow-[0_0_12px_rgba(99,102,241,0.2)]',
  },
  {
    key: '3Di',
    href: '/3Di',
    label: 'Interactive 3D',
    activeClass:
      'bg-indigo-500/20 border border-indigo-500/35 text-indigo-200 shadow-[0_0_12px_rgba(99,102,241,0.2)]',
  },
  {
    key: 'ARs',
    href: '/ARs',
    label: 'Static AR',
    activeClass:
      'bg-amber-500/20 border border-amber-500/35 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.2)]',
  },
  {
    key: 'ARi',
    href: '/ARi',
    label: 'Interactive AR',
    activeClass:
      'bg-amber-500/20 border border-amber-500/35 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.2)]',
  },
];

export function GalleryNav({ activePage }: GalleryNavProps) {
  return (
    <nav className="w-full max-w-7xl mx-auto px-6 pt-8 flex flex-col lg:flex-row items-center justify-between gap-4 border-b border-white/5 pb-6">
      <Link
        href="/"
        className="flex items-center gap-2 text-white/60 hover:text-white transition-colors group text-sm font-medium shrink-0"
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

      <div className="flex flex-wrap items-center justify-center gap-1.5 p-1.5 bg-white/5 rounded-2xl lg:rounded-full border border-white/10 backdrop-blur-md">
        {NAV_TABS.map(tab => (
          <Link
            key={tab.key}
            href={tab.href}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-300 ${
              activePage === tab.key
                ? tab.activeClass
                : 'text-white/50 border border-transparent hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
