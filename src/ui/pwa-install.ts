/**
 * PWA Installation Service
 * Manages the beforeinstallprompt lifecycle and provides a clean API
 * for UI components to prompt the user to install the game on their home screen.
 *
 * Single Responsibility: PWA install prompt lifecycle management.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<(canInstall: boolean) => void>();

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    Boolean((window.navigator as unknown as { standalone?: boolean }).standalone)
  );
}

export function isPwaInstallable(): boolean {
  return deferredPrompt != null && !isStandalone();
}

export function onPwaInstallableChange(callback: (canInstall: boolean) => void): () => void {
  listeners.add(callback);
  callback(isPwaInstallable());
  return () => listeners.delete(callback);
}

function notify(): void {
  const installable = isPwaInstallable();
  for (const listener of listeners) {
    listener(installable);
  }
}

/** Initialize global event listeners. Safe to call multiple times. */
export function initPwaInstallListener(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

/** Triggers the browser's native install dialog. */
export async function promptPwaInstall(): Promise<'accepted' | 'dismissed' | 'unsupported'> {
  if (!deferredPrompt) {
    return 'unsupported';
  }

  const promptEvent = deferredPrompt;
  deferredPrompt = null;
  notify();

  try {
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    return choice.outcome;
  } catch {
    return 'unsupported';
  }
}
