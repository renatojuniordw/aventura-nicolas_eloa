/**
 * Haptic Feedback Service using the Vibration API.
 * Provides subtle, tactile feedback on mobile devices for jump,
 * item collection, and level completion.
 *
 * Single Responsibility: Haptics abstraction with silent fallback.
 */

export function isHapticsSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

export function vibrate(pattern: number | number[]): boolean {
  if (!isHapticsSupported()) return false;
  try {
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}

/** Micro-pulse for character jumping (15ms). */
export function vibrateJump(): boolean {
  return vibrate(15);
}

/** Pleasant pulse when collecting a target letter/syllable (35ms). */
export function vibrateCollect(): boolean {
  return vibrate(35);
}

/** Celebratory rhythmic vibration on level victory. */
export function vibrateVictory(): boolean {
  return vibrate([40, 60, 40, 60, 100]);
}

/** Short double-tap for wrong obstacle collision or incorrect pick. */
export function vibrateWarning(): boolean {
  return vibrate([30, 40, 30]);
}

/** Subtle tap feedback for UI buttons and card selection (18ms). */
export function vibrateTap(): boolean {
  return vibrate(18);
}

/** Confirmatory pulse for positive selections and confirmations. */
export function vibrateSuccess(): boolean {
  return vibrate([20, 30, 40]);
}

/** Stop any ongoing vibration immediately. */
export function cancelHaptics(): void {
  if (!isHapticsSupported()) return;
  try {
    navigator.vibrate(0);
  } catch {
    // Ignored in environments where cancel fails
  }
}
