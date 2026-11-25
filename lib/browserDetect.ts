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

type FullscreenDocument = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

/**
 * Returns true if the current browser/iframe supports the standard or WebKit Fullscreen API.
 * Note: Apple WebKit on iPhone does not support requestFullscreen on HTML elements/iframes
 * (returns false safely so UI can hide unavailable fullscreen toggles).
 */
export function isFullscreenSupported(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as FullscreenDocument;
  const el = document.documentElement as FullscreenElement;
  const hasMethod =
    typeof el.requestFullscreen === 'function' ||
    typeof el.webkitRequestFullscreen === 'function';
  if (!hasMethod) return false;
  if (typeof doc.fullscreenEnabled === 'boolean') return doc.fullscreenEnabled;
  if (typeof doc.webkitFullscreenEnabled === 'boolean') return doc.webkitFullscreenEnabled;
  return true;
}

export function isDocumentFullscreen(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as FullscreenDocument;
  return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
}

/**
 * Requests Fullscreen API on the target element (must be invoked directly inside a user gesture).
 * Fails silently when unsupported (e.g., iPhone WebKit or iframe without allow="fullscreen").
 */
export function requestElementFullscreen(el?: HTMLElement | null): void {
  if (typeof document === 'undefined') return;
  if (isDocumentFullscreen()) return;
  const target = (el ?? document.documentElement) as FullscreenElement;
  const fn = target.requestFullscreen ?? target.webkitRequestFullscreen;
  if (typeof fn !== 'function') return;
  try {
    const result = fn.call(target);
    if (result && typeof (result as Promise<void>).catch === 'function') {
      (result as Promise<void>).catch(() => {
        // Ignore browser/iframe fullscreen policy denials.
      });
    }
  } catch {
    // Ignore synchronous fullscreen denials.
  }
}

/** Exits fullscreen cleanly if currently active. */
export function exitDocumentFullscreen(): void {
  if (typeof document === 'undefined' || !isDocumentFullscreen()) return;
  const doc = document as FullscreenDocument;
  const fn = doc.exitFullscreen ?? doc.webkitExitFullscreen;
  if (typeof fn !== 'function') return;
  try {
    const result = fn.call(doc);
    if (result && typeof (result as Promise<void>).catch === 'function') {
      (result as Promise<void>).catch(() => {
        // Ignore exit errors.
      });
    }
  } catch {
    // Ignore exit errors.
  }
}

function getFullscreenSupportedServerSnapshot(): boolean {
  return false;
}

/** SSR-safe hook reporting whether Fullscreen API is supported in the active browser/iframe. */
export function useIsFullscreenSupported(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    isFullscreenSupported,
    getFullscreenSupportedServerSnapshot
  );
}
