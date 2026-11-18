'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Redirects legacy routes cleanly back to the landing page in static exports. */
export function RedirectHome() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <div className="app-page min-h-screen text-white font-sans flex flex-col items-center justify-center p-6 bg-[#0a0a0a] text-center">
      <p className="text-white/70 mb-4">This page has moved. Redirecting to the landing page...</p>
      <Link
        href="/"
        className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-sm font-medium text-white transition-colors"
      >
        Go to Home
      </Link>
    </div>
  );
}
