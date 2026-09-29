import { describe, it, expect, vi } from 'vitest';
import { PhoneAdapter } from './phone-adapter.js';
import { Actions } from './actions.js';
import { InputManager } from './input-manager.js';

/** Fake transport: no socket, just lets the test fire messages by hand. */
function makeFakeTransport() {
  const handlers = new Set();
  return {
    onMessage: vi.fn((fn) => {
      handlers.add(fn);
      return () => handlers.delete(fn);
    }),
    emitMessage(payload) {
      for (const handler of [...handlers]) handler(payload);
    },
    get listenerCount() {
      return handlers.size;
    },
  };
}

describe('PhoneAdapter', () => {
  it('subscribes on attach, once, and never owns the connection', () => {
    const transport = makeFakeTransport();
    const adapter = new PhoneAdapter(vi.fn(), { transport });
    adapter.attach();
    adapter.attach();
    expect(transport.listenerCount).toBe(1);
    expect(transport).not.toHaveProperty('connect');
  });

  it('translates a jump message into the JUMP action', () => {
    const transport = makeFakeTransport();
    const onAction = vi.fn();
    new PhoneAdapter(onAction, { transport }).attach();
    transport.emitMessage({ button: 'jump', pressed: true });
    expect(onAction).toHaveBeenCalledWith(Actions.JUMP, { pressed: true, repeated: false });
  });

  it('ignores an unknown button instead of guessing an action', () => {
    const transport = makeFakeTransport();
    const onAction = vi.fn();
    new PhoneAdapter(onAction, { transport }).attach();
    transport.emitMessage({ button: 'dance', pressed: true });
    expect(onAction).not.toHaveBeenCalled();
  });

  it('drops commands while not armed', () => {
    const transport = makeFakeTransport();
    const onAction = vi.fn();
    let armed = false;
    new PhoneAdapter(onAction, { transport, isArmed: () => armed }).attach();
    transport.emitMessage({ button: 'jump', pressed: true });
    armed = true;
    transport.emitMessage({ button: 'jump', pressed: true });
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes on detach, leaving the session alone', () => {
    const transport = makeFakeTransport();
    const onAction = vi.fn();
    const adapter = new PhoneAdapter(onAction, { transport });
    adapter.attach();
    adapter.detach();
    transport.emitMessage({ button: 'jump', pressed: true });
    expect(onAction).not.toHaveBeenCalled();
    expect(transport.listenerCount).toBe(0);
  });

  it('never sets `repeated: true` — the phone only emits discrete jump events', () => {
    const transport = makeFakeTransport();
    const onAction = vi.fn();
    new PhoneAdapter(onAction, { transport }).attach();
    transport.emitMessage({ button: 'jump', pressed: true });
    transport.emitMessage({ button: 'jump', pressed: true });
    for (const call of onAction.mock.calls) expect(call[1].repeated).toBe(false);
  });

  it('pulse contract: each pulse is a new press edge, and the held state it leaves is cleared by reset()', () => {
    const input = new InputManager();
    const transport = makeFakeTransport();
    input.setAdapter(new PhoneAdapter(input.handleAction, { transport }));

    transport.emitMessage({ button: 'jump', pressed: true });
    expect(input.consumePressed(Actions.JUMP)).toBe(true);
    transport.emitMessage({ button: 'jump', pressed: true });
    expect(input.consumePressed(Actions.JUMP)).toBe(true);
    expect(input.isActionHeld(Actions.JUMP)).toBe(true);

    input.reset(); // pause / adapter swap
    expect(input.isActionHeld(Actions.JUMP)).toBe(false);
    expect(input.consumePressed(Actions.JUMP)).toBe(false);
  });
});
