import { useEffect, useState } from 'react';
import { isFullscreenSupported, isFullscreen, toggleFullscreen, onFullscreenChange } from './fullscreen.js';
import { isPwaInstallable, onPwaInstallableChange } from './pwa-install.js';

/** Fullscreen state kept in sync with the browser, plus a toggle that updates it. */
export function useFullscreen(): { supported: boolean; fullscreen: boolean; toggle: () => Promise<void> } {
  const [fullscreen, setFullscreen] = useState(() => isFullscreen());

  useEffect(() => onFullscreenChange((active) => setFullscreen(active)), []);

  return {
    supported: isFullscreenSupported(),
    fullscreen,
    toggle: async () => setFullscreen(await toggleFullscreen()),
  };
}

/** Whether the browser is currently offering to install the app (PWA). */
export function usePwaInstallable(): boolean {
  const [installable, setInstallable] = useState(() => isPwaInstallable());

  useEffect(() => onPwaInstallableChange((canInstall) => setInstallable(canInstall)), []);

  return installable;
}
