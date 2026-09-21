import { describe, it, expect, vi } from 'vitest';
import { pumpMenuKeys, pumpOverlayInput } from './overlay-input.js';
import { Actions } from '../input/actions.js';
import { JumpConfirmGesture, JUMP_GESTURE_WINDOW_MS } from '../input/jump-confirm-gesture.js';

function fakeGame(pressed = []) {
  const queue = new Set(pressed);
  return {
    input: { consumePressed: vi.fn((action) => queue.delete(action)) },
    menu: { triggerPrimary: vi.fn(), triggerBack: vi.fn() },
  };
}

describe('overlay input', () => {
  it('maps CONFIRM to the primary action and BACK to the back action', () => {
    const game = fakeGame([Actions.CONFIRM, Actions.BACK]);
    pumpMenuKeys(game);
    expect(game.menu.triggerPrimary).toHaveBeenCalledTimes(1);
    expect(game.menu.triggerBack).toHaveBeenCalledTimes(1);
  });

  it('does nothing without input', () => {
    const game = fakeGame();
    pumpMenuKeys(game);
    expect(game.menu.triggerPrimary).not.toHaveBeenCalled();
    expect(game.menu.triggerBack).not.toHaveBeenCalled();
  });

  it('confirms after a single jump once the gesture window has passed', () => {
    const game = fakeGame([Actions.JUMP]);
    const gesture = new JumpConfirmGesture();
    pumpOverlayInput(game, gesture, 1000);
    expect(game.menu.triggerPrimary).not.toHaveBeenCalled();
    pumpOverlayInput(game, gesture, 1000 + JUMP_GESTURE_WINDOW_MS + 1);
    expect(game.menu.triggerPrimary).toHaveBeenCalledTimes(1);
  });

  it('goes back on a quick double jump and never confirms it', () => {
    const jumping = fakeGame();
    jumping.input.consumePressed.mockImplementation((action) => action === Actions.JUMP);
    const idle = fakeGame();
    const gesture = new JumpConfirmGesture();
    pumpOverlayInput(jumping, gesture, 1000);
    pumpOverlayInput(jumping, gesture, 1200);
    pumpOverlayInput(idle, gesture, 5000);
    expect(jumping.menu.triggerBack).toHaveBeenCalledTimes(1);
    expect(jumping.menu.triggerPrimary).not.toHaveBeenCalled();
    expect(idle.menu.triggerPrimary).not.toHaveBeenCalled();
  });
});
