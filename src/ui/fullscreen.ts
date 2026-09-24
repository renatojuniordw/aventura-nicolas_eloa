/**
 * Cross-browser Fullscreen API helper.
 * Supports standard API and WebKit prefix (iOS/Safari desktop).
 */

interface DocumentWithFullscreen extends Document {
  webkitFullscreenElement?: Element;
  webkitExitFullscreen?: () => Promise<void>;
}

interface ElementWithFullscreen extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void>;
}

export function isFullscreenSupported(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as DocumentWithFullscreen;
  return Boolean(
    doc.fullscreenEnabled ??
    (document as unknown as { webkitFullscreenEnabled?: boolean }).webkitFullscreenEnabled ??
    doc.documentElement.requestFullscreen ??
    (doc.documentElement as ElementWithFullscreen).webkitRequestFullscreen
  );
}

export function isFullscreen(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as DocumentWithFullscreen;
  return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
}

export async function enterFullscreen(target?: HTMLElement | null): Promise<boolean> {
  if (isFullscreen()) return true;
  if (!isFullscreenSupported()) return false;
  return toggleFullscreen(target);
}

export async function toggleFullscreen(target?: HTMLElement | null): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  const doc = document as DocumentWithFullscreen;
  const element = (target ?? doc.documentElement) as ElementWithFullscreen;

  try {
    if (isFullscreen()) {
      if (doc.exitFullscreen) {
        await doc.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen();
      }
      return false;
    } else {
      if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else if (element.webkitRequestFullscreen) {
        await element.webkitRequestFullscreen();
      } else {
        return false;
      }
      return true;
    }
  } catch (error) {
    console.warn('[fullscreen] Erro ao alternar tela cheia:', error);
    return isFullscreen();
  }
}

export function onFullscreenChange(callback: (active: boolean) => void): () => void {
  if (typeof document === 'undefined') return () => {};

  const handler = () => {
    callback(isFullscreen());
  };

  document.addEventListener('fullscreenchange', handler);
  document.addEventListener('webkitfullscreenchange', handler);

  return () => {
    document.removeEventListener('fullscreenchange', handler);
    document.removeEventListener('webkitfullscreenchange', handler);
  };
}
