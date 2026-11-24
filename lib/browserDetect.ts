'use client';

import { useSyncExternalStore } from 'react';

const emptySubscribe = () => () => {};

export type EmbedContext = 'loading' | 'iframe' | 'top';

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

function getMobileEdgeFirefoxServerSnapshot(): boolean {
  return false;
}

/** SSR-safe hook that returns true on mobile Edge or mobile Firefox. */
export function useIsMobileEdgeOrFirefox(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    isMobileEdgeOrFirefox,
    getMobileEdgeFirefoxServerSnapshot
  );
}

/**
 * Returns true when the current document is embedded inline inside an <iframe>
 * (e.g., Articulate Rise / LMS embed blocks) rather than opened as a top-level browser tab.
 */
export function isEmbeddedInIframe(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    return window.self !== window.top;
  } catch {
    // Cross-origin access to window.top threw SecurityError — definitely inside an iframe.
    return true;
  }
}

function getEmbedContextSnapshot(): EmbedContext {
  return isEmbeddedInIframe() ? 'iframe' : 'top';
}

function getEmbedContextServerSnapshot(): EmbedContext {
  return 'loading';
}

/**
 * SSR-safe hook reporting whether the page is visited inline inside an iframe ('iframe')
 * or directly in a top-level browser tab ('top'). Returns 'loading' during static prerender.
 */
export function useEmbedContext(): EmbedContext {
  return useSyncExternalStore(
    emptySubscribe,
    getEmbedContextSnapshot,
    getEmbedContextServerSnapshot
  );
}

/**
 * In-memory flag indicating the user explicitly tapped a model card inside /ARglb
 * (works even in cross-origin iframes where sessionStorage may be restricted).
 */
let inlineArNavigationPending = false;

export function markInlineArNavigation(): void {
  inlineArNavigationPending = true;
}

export function hasInlineArNavigation(): boolean {
  return inlineArNavigationPending;
}

export function clearInlineArNavigation(): void {
  inlineArNavigationPending = false;
}
