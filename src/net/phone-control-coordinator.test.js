import { describe, it, expect, vi } from 'vitest';
import { PhoneControlCoordinator } from './phone-control-coordinator.js';
import { EventBus, Events } from '../core/event-bus.js';

function setup() {
  const bus = new EventBus();
  const input = { setAdapter: vi.fn(), handleAction: vi.fn() };
  const restoreDefaultInput = vi.fn();
  let callbacks;
  const handle = {
    session: 'abc',
    pairingUrl: 'http://x/controle?session=abc',
    transport: { onJump: vi.fn(() => () => {}) },
    measureLatency: vi.fn(() => Promise.resolve(12)),
    stop: vi.fn(),
  };
  const startSession = vi.fn((cb) => {
    callbacks = cb;
    return handle;
  });
  const coordinator = new PhoneControlCoordinator({ input, bus, restoreDefaultInput, startSession });
  const ui = { onPaired: vi.fn(), onDisconnected: vi.fn(), onError: vi.fn() };
  return { bus, input, restoreDefaultInput, handle, startSession, coordinator, ui, cb: () => callbacks };
}

describe('PhoneControlCoordinator', () => {
  it('exposes the pairing details and stays inactive until the phone pairs', () => {
    const { coordinator, ui } = setup();
    const result = coordinator.start(ui);
    expect(result.session).toBe('abc');
    expect(result.pairingUrl).toContain('session=abc');
    expect(coordinator.isActive).toBe(false);
  });

  it('swaps the input adapter and turns active when the phone pairs', () => {
    const { coordinator, input, ui, cb } = setup();
    coordinator.start(ui);
    cb().onPaired();
    expect(coordinator.isActive).toBe(true);
    expect(input.setAdapter).toHaveBeenCalledTimes(1);
    expect(ui.onPaired).toHaveBeenCalled();
    cb().onPaired(); // a reconnect must not stack another adapter
    expect(input.setAdapter).toHaveBeenCalledTimes(1);
  });

  it('pauses the game (APP_BLURRED) when a paired phone drops', () => {
    const { coordinator, bus, ui, cb } = setup();
    const blurred = vi.fn();
    bus.on(Events.APP_BLURRED, blurred);
    coordinator.start(ui);
    cb().onPaired();
    cb().onDisconnected();
    expect(blurred).toHaveBeenCalledTimes(1);
    expect(ui.onDisconnected).toHaveBeenCalled();
  });

  it('does not pause when the phone drops before ever pairing', () => {
    const { coordinator, bus, ui, cb } = setup();
    const blurred = vi.fn();
    bus.on(Events.APP_BLURRED, blurred);
    coordinator.start(ui);
    cb().onDisconnected();
    expect(blurred).not.toHaveBeenCalled();
  });

  it('closes the session and restores keyboard/touch on stop', () => {
    const { coordinator, handle, restoreDefaultInput, ui, cb } = setup();
    coordinator.start(ui);
    cb().onPaired();
    coordinator.stop();
    expect(handle.stop).toHaveBeenCalled();
    expect(restoreDefaultInput).toHaveBeenCalledTimes(1);
    expect(coordinator.isActive).toBe(false);
  });

  it('does not touch the input when stopped without ever pairing', () => {
    const { coordinator, restoreDefaultInput, ui } = setup();
    coordinator.start(ui);
    coordinator.stop();
    expect(restoreDefaultInput).not.toHaveBeenCalled();
  });

  it('starting again closes the previous session first', () => {
    const { coordinator, handle, ui } = setup();
    coordinator.start(ui);
    coordinator.start(ui);
    expect(handle.stop).toHaveBeenCalledTimes(1);
  });
});
