/**
 * How long to wait, after a single Actions.JUMP press on a menu/transition
 * screen, before treating it as a confirm instead of the first half of a
 * double-jump-to-go-back gesture.
 *
 * Deliberately larger than the phone's JumpDetector cooldown (which only
 * limits how fast the sensor can register two jumps) — a child needs real
 * time to physically jump twice, not just for the sensor to be ready again.
 */
export const JUMP_GESTURE_WINDOW_MS = 650;

/**
 * Classifies a rapid pair of Actions.JUMP presses on menu/transition screens:
 * one jump confirms (advance/retry), two jumps in quick succession go back.
 * Pure and side-effect free, like JumpDetector, so it's easy to test and to
 * reuse across scenes without duplicating the timing logic.
 */
export class JumpConfirmGesture {
  private _pendingSince: number | null = null;

  /** Call when Actions.JUMP was just pressed (edge-triggered). */
  press(nowMs: number): 'back' | null {
    if (this._pendingSince !== null && nowMs - this._pendingSince <= JUMP_GESTURE_WINDOW_MS) {
      this._pendingSince = null;
      return 'back';
    }
    this._pendingSince = nowMs;
    return null;
  }

  /** Call every frame; resolves to 'confirm' once the window elapses with no second press. */
  poll(nowMs: number): 'confirm' | null {
    if (this._pendingSince !== null && nowMs - this._pendingSince > JUMP_GESTURE_WINDOW_MS) {
      this._pendingSince = null;
      return 'confirm';
    }
    return null;
  }

  reset(): void {
    this._pendingSince = null;
  }
}
