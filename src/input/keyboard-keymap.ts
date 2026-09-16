import { Actions } from './actions.js';

/**
 * Default keyboard bindings, keyed by `KeyboardEvent.code`.
 *
 * Mapping by `code` (physical key) instead of `key` (produced character) keeps
 * bindings stable across layouts — an ABNT2 Brazilian keyboard still reports
 * `KeyA` and `ArrowLeft` the same way. It also avoids breaking on Shift/AltGr
 * and on dead keys used for accents.
 */
export const DEFAULT_KEYMAP: Record<string, string> = Object.freeze({
  ArrowLeft: Actions.MOVE_LEFT,
  KeyA: Actions.MOVE_LEFT,
  ArrowRight: Actions.MOVE_RIGHT,
  KeyD: Actions.MOVE_RIGHT,
  Space: Actions.JUMP,
  ArrowUp: Actions.JUMP,
  KeyW: Actions.JUMP,
  KeyZ: Actions.JUMP,
  Escape: Actions.PAUSE,
  KeyP: Actions.PAUSE,
  Enter: Actions.CONFIRM,
  KeyJ: Actions.CONFIRM,
  KeyY: Actions.BACK,
  Backspace: Actions.BACK,
  KeyE: Actions.POWER_1,
  KeyQ: Actions.POWER_2,
  F2: Actions.DEBUG,
});

/**
 * Pure translation from a physical key code to a semantic action.
 *
 * Kept free of DOM types and side effects so it can be unit-tested directly and
 * reused by any adapter. Returns `null` for unmapped keys.
 *
 * @param code KeyboardEvent.code
 */
export function translateKey(code: string, keymap: Record<string, string> = DEFAULT_KEYMAP): string | null {
  return keymap[code] ?? null;
}

/** Reverse lookup used to render the controls help panel. */
export function keyLabelFor(action: string, keymap: Record<string, string> = DEFAULT_KEYMAP): string {
  const labels: Record<string, string> = {
    ArrowLeft: '←',
    ArrowRight: '→',
    ArrowUp: '↑',
    Space: 'Espaço',
    Escape: 'Esc',
    Enter: 'Enter',
    Backspace: 'Backspace',
  };
  const codes = Object.keys(keymap).filter((code) => keymap[code] === action);
  return codes.map((code) => labels[code] ?? code.replace(/^Key/, '')).join(' ou ');
}
