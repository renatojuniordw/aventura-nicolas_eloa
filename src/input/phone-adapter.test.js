import { describe, it, expect, vi } from 'vitest';
import { PhoneAdapter } from './phone-adapter.js';
import { Actions } from './actions.js';

/** Fake transport: no socket, just lets the test fire messages by hand. */
function makeFakeTransport() {
  let handler = null;
  return {
    connectCalls: 0,
    disconnectCalls: 0,
    connect() {
      this.connectCalls += 1;
    },
    disconnect() {
      this.disconnectCalls += 1;
    },
    onMessage(fn) {
      handler = fn;
    },
    emitMessage(payload) {
      handler?.(payload);
    },
  };
}

describe('PhoneAdapter', () => {
  it('connects the transport on attach', () => {
    const transport = makeFakeTransport();
    const onAction = vi.fn();
    const adapter = new PhoneAdapter(onAction, { transport });

    adapter.attach();

    expect(transport.connectCalls).toBe(1);
  });

  it('translates a jump message into the JUMP action', () => {
    const transport = makeFakeTransport();
    const onAction = vi.fn();
    const adapter = new PhoneAdapter(onAction, { transport });
    adapter.attach();

    transport.emitMessage({ button: 'jump', pressed: true });

    expect(onAction).toHaveBeenCalledWith(Actions.JUMP, { pressed: true, repeated: false });
  });

  it('ignores an unknown button instead of guessing an action', () => {
    const transport = makeFakeTransport();
    const onAction = vi.fn();
    const adapter = new PhoneAdapter(onAction, { transport });
    adapter.attach();

    transport.emitMessage({ button: 'dance', pressed: true });

    expect(onAction).not.toHaveBeenCalled();
  });

  it('disconnects the transport on detach', () => {
    const transport = makeFakeTransport();
    const adapter = new PhoneAdapter(vi.fn(), { transport });
    adapter.attach();

    adapter.detach();

    expect(transport.disconnectCalls).toBe(1);
  });

  it('never sets `repeated: true` — the phone only emits discrete jump events', () => {
    const transport = makeFakeTransport();
    const onAction = vi.fn();
    const adapter = new PhoneAdapter(onAction, { transport });
    adapter.attach();

    transport.emitMessage({ button: 'jump', pressed: true });
    transport.emitMessage({ button: 'jump', pressed: true });

    for (const call of onAction.mock.calls) {
      expect(call[1].repeated).toBe(false);
    }
  });
});
