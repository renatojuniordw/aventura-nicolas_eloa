import { describe, it, expect, vi } from 'vitest';
import { InputManager } from './input-manager.js';
import { InputAdapter } from './input-adapter.js';
import { Actions } from './actions.js';

/** Minimal adapter driven manually, stands in for keyboard AND esp32. */
class FakeAdapter extends InputAdapter {
  constructor(onAction) {
    super(onAction);
    this.attachCalls = 0;
    this.detachCalls = 0;
  }
  attach() {
    this.attachCalls += 1;
  }
  detach() {
    this.detachCalls += 1;
  }
  press(action, meta) {
    this.onAction(action, meta);
  }
}

describe('InputManager', () => {
  it('attaches the adapter on setAdapter', () => {
    const input = new InputManager();
    const adapter = new FakeAdapter(input.handleAction);
    input.setAdapter(adapter);
    expect(adapter.attachCalls).toBe(1);
  });

  it('records held continuous actions until release', () => {
    const input = new InputManager();
    const adapter = new FakeAdapter(input.handleAction);
    input.setAdapter(adapter);

    adapter.press(Actions.MOVE_RIGHT, { pressed: true });
    expect(input.isActionHeld(Actions.MOVE_RIGHT)).toBe(true);
    expect(input.getMoveAxis()).toBe(1);

    adapter.press(Actions.MOVE_RIGHT, { pressed: false });
    expect(input.isActionHeld(Actions.MOVE_RIGHT)).toBe(false);
    expect(input.getMoveAxis()).toBe(0);
  });

  it('JUMP edge is consumed exactly once', () => {
    const input = new InputManager();
    const adapter = new FakeAdapter(input.handleAction);
    input.setAdapter(adapter);

    adapter.press(Actions.JUMP, { pressed: true });
    expect(input.consumePressed(Actions.JUMP)).toBe(true);
    expect(input.consumePressed(Actions.JUMP)).toBe(false);
  });

  it('ignores OS key repeat for edge actions', () => {
    const input = new InputManager();
    const adapter = new FakeAdapter(input.handleAction);
    input.setAdapter(adapter);

    adapter.press(Actions.JUMP, { pressed: true, repeated: true });
    expect(input.consumePressed(Actions.JUMP)).toBe(false);
  });

  it('endFrame drops unread one-shot presses', () => {
    const input = new InputManager();
    const adapter = new FakeAdapter(input.handleAction);
    input.setAdapter(adapter);

    adapter.press(Actions.JUMP, { pressed: true });
    input.endFrame();
    expect(input.consumePressed(Actions.JUMP)).toBe(false);
  });

  it('tracks held state for edge actions too (variable jump height)', () => {
    const input = new InputManager();
    const adapter = new FakeAdapter(input.handleAction);
    input.setAdapter(adapter);

    adapter.press(Actions.JUMP, { pressed: true });
    expect(input.isActionHeld(Actions.JUMP)).toBe(true);
    adapter.press(Actions.JUMP, { pressed: false });
    expect(input.isActionHeld(Actions.JUMP)).toBe(false);
  });

  it('swapping adapters resets all state', () => {
    const input = new InputManager();
    const first = new FakeAdapter(input.handleAction);
    input.setAdapter(first);

    first.press(Actions.JUMP, { pressed: true });
    first.press(Actions.MOVE_RIGHT, { pressed: true });

    const second = new FakeAdapter(input.handleAction);
    const dispose = vi.spyOn(first, 'dispose');
    input.setAdapter(second);

    expect(dispose).toHaveBeenCalledTimes(1);
    expect(input.consumePressed(Actions.JUMP)).toBe(false);
    expect(input.isActionHeld(Actions.MOVE_RIGHT)).toBe(false);
    expect(second.attachCalls).toBe(1);
  });

  it('move axis composes left and right', () => {
    const input = new InputManager();
    const adapter = new FakeAdapter(input.handleAction);
    input.setAdapter(adapter);

    adapter.press(Actions.MOVE_RIGHT, { pressed: true });
    adapter.press(Actions.MOVE_LEFT, { pressed: true });
    expect(input.getMoveAxis()).toBe(0);

    adapter.press(Actions.MOVE_LEFT, { pressed: true });
    adapter.press(Actions.MOVE_RIGHT, { pressed: false });
    expect(input.getMoveAxis()).toBe(-1);
  });

  it('dispose detaches the adapter', () => {
    const input = new InputManager();
    const adapter = new FakeAdapter(input.handleAction);
    input.setAdapter(adapter);
    input.dispose();
    expect(adapter.detachCalls).toBe(1);
  });
});