'use client';

import { useSyncExternalStore } from 'react';

const emptySubscribe = () => () => {};

/**
 * Returns true when running in Microsoft Edge or Mozilla Firefox on a mobile/tablet device
 * (iPhone, iPad, or Android). Returns false for Chrome, Safari, and all desktop browsers.
 */
export function isMobileEdgeOrFirefox(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return false;
  }

  const ua = navigator.userAgent || '';
  const isIPadOS =
    navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1;
  const isMobileDevice =
    (/iPad|iPhone|iPod|Android|Mobile/i.test(ua) || isIPadOS) &&
    !(window as Window & { MSStream?: unknown }).MSStream;

  if (!isMobileDevice) {
    return false;
  }

  const isEdge = /\bEdgiOS\b|\bEdgA\b|\bEdg\//i.test(ua);
  const isFirefox = /\bFxiOS\b|\bFirefox\//i.test(ua) && !/\bSeamonkey\//i.test(ua);

  return isEdge || isFirefox;
}

function getServerSnapshot(): boolean {
  return false;
}

/** SSR-safe hook that returns true on mobile Edge or mobile Firefox. */
export function useIsMobileEdgeOrFirefox(): boolean {
  return useSyncExternalStore(emptySubscribe, isMobileEdgeOrFirefox, getServerSnapshot);
}
