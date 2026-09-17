import { describe, it, expect } from 'vitest';
import { AutoRunAdapter } from './auto-run-adapter.js';
import { InputManager } from './input-manager.js';
import { Actions } from './actions.js';

describe('AutoRunAdapter', () => {
  it('holds MOVE_RIGHT as soon as it attaches', () => {
    const input = new InputManager();
    input.setAdapter(new AutoRunAdapter(input.handleAction));

    expect(input.isActionHeld(Actions.MOVE_RIGHT)).toBe(true);
    expect(input.getMoveAxis()).toBe(1);
  });

  it('releases MOVE_RIGHT on detach', () => {
    const input = new InputManager();
    const adapter = new AutoRunAdapter(input.handleAction);
    input.setAdapter(adapter);

    adapter.detach();

    expect(input.isActionHeld(Actions.MOVE_RIGHT)).toBe(false);
  });

  it('never emits MOVE_LEFT, JUMP or any other action', () => {
    const input = new InputManager();
    input.setAdapter(new AutoRunAdapter(input.handleAction));

    expect(input.isActionHeld(Actions.MOVE_LEFT)).toBe(false);
    expect(input.consumePressed(Actions.JUMP)).toBe(false);
  });
});
