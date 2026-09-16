import { describe, it, expect } from 'vitest';
import { CompositeAdapter } from './composite-adapter.js';
import { InputAdapter } from './input-adapter.js';
import { InputManager } from './input-manager.js';
import { Actions } from './actions.js';

class FakeAdapter extends InputAdapter {
  constructor(onAction) {
    super(onAction);
    this.attachCalls = 0;
    this.detachCalls = 0;
    this.disposeCalls = 0;
  }
  attach() {
    this.attachCalls += 1;
  }
  detach() {
    this.detachCalls += 1;
  }
  dispose() {
    this.disposeCalls += 1;
    super.dispose();
  }
  press(action) {
    this.onAction(action, { pressed: true, repeated: false });
  }
}

describe('CompositeAdapter', () => {
  it('attaches every child adapter', () => {
    const input = new InputManager();
    const keyboard = new FakeAdapter(input.handleAction);
    const touch = new FakeAdapter(input.handleAction);
    const composite = new CompositeAdapter(input.handleAction, [keyboard, touch]);

    input.setAdapter(composite);

    expect(keyboard.attachCalls).toBe(1);
    expect(touch.attachCalls).toBe(1);
  });

  it('lets any child source drive the same InputManager state', () => {
    const input = new InputManager();
    const keyboard = new FakeAdapter(input.handleAction);
    const touch = new FakeAdapter(input.handleAction);
    input.setAdapter(new CompositeAdapter(input.handleAction, [keyboard, touch]));

    touch.press(Actions.JUMP);
    expect(input.consumePressed(Actions.JUMP)).toBe(true);

    keyboard.press(Actions.MOVE_RIGHT);
    expect(input.getMoveAxis()).toBe(1);
  });

  it('detaches every child adapter on dispose', () => {
    const input = new InputManager();
    const keyboard = new FakeAdapter(input.handleAction);
    const touch = new FakeAdapter(input.handleAction);
    const composite = new CompositeAdapter(input.handleAction, [keyboard, touch]);
    input.setAdapter(composite);

    input.dispose();

    expect(keyboard.disposeCalls).toBe(1);
    expect(touch.disposeCalls).toBe(1);
  });
});
