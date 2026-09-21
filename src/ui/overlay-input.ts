import { Actions } from '../input/actions.js';
import type { JumpConfirmGesture } from '../input/jump-confirm-gesture.js';

/** The slice of the game context that overlay screens are driven through. */
interface OverlayGame {
  input: { consumePressed(action: string): boolean };
  menu: { triggerPrimary(): void; triggerBack(): void };
}

/** Forwards the abstracted CONFIRM/BACK actions to the mounted overlay screen. */
export function pumpMenuKeys(game: OverlayGame): void {
  if (game.input.consumePressed(Actions.CONFIRM)) game.menu.triggerPrimary();
  if (game.input.consumePressed(Actions.BACK)) game.menu.triggerBack();
}

/**
 * `pumpMenuKeys` plus the phone's jump gesture: one jump confirms, two in
 * quick succession go back (see `JumpConfirmGesture`).
 */
export function pumpOverlayInput(game: OverlayGame, gesture: JumpConfirmGesture, nowMs = performance.now()): void {
  pumpMenuKeys(game);
  if (game.input.consumePressed(Actions.JUMP) && gesture.press(nowMs) === 'back') game.menu.triggerBack();
  if (gesture.poll(nowMs) === 'confirm') game.menu.triggerPrimary();
}
