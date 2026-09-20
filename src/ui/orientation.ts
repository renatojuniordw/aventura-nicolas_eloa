/**
 * Orientation helper to ensure optimal landscape gameplay experience.
 *
 * Single Responsibility: Screen orientation detection and locking abstraction.
 */

export function isPortrait(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.screen?.orientation?.type) {
    return window.screen.orientation.type.startsWith('portrait');
  }
  return window.innerHeight > window.innerWidth;
}

export async function tryLockLandscape(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.screen?.orientation) {
    return false;
  }

  const orientation = window.screen.orientation as ScreenOrientation & {
    lock?: (orientation: OrientationLockType) => Promise<void>;
  };

  if (typeof orientation.lock !== 'function') {
    return false;
  }

  try {
    await orientation.lock('landscape');
    return true;
  } catch {
    return false;
  }
}
