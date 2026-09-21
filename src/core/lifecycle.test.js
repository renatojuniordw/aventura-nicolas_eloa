// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { registerLifecycleListeners } from './lifecycle.js';
import { EventBus, Events } from './event-bus.js';

describe('registerLifecycleListeners', () => {
  it('resets input and announces APP_BLURRED when the window loses focus', () => {
    const bus = new EventBus();
    const input = { reset: vi.fn() };
    const blurred = vi.fn();
    bus.on(Events.APP_BLURRED, blurred);
    registerLifecycleListeners({ bus, input, audio: { unlock: vi.fn() } });
    window.dispatchEvent(new Event('blur'));
    expect(input.reset).toHaveBeenCalledTimes(1);
    expect(blurred).toHaveBeenCalledTimes(1);
  });

  it('announces APP_FOCUSED when the tab becomes visible again', () => {
    const bus = new EventBus();
    const focused = vi.fn();
    bus.on(Events.APP_FOCUSED, focused);
    registerLifecycleListeners({ bus, input: { reset: vi.fn() }, audio: { unlock: vi.fn() } });
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(focused).toHaveBeenCalledTimes(1);
  });

  it('unlocks audio on the first tap only', () => {
    const audio = { unlock: vi.fn() };
    registerLifecycleListeners({ bus: new EventBus(), input: { reset: vi.fn() }, audio });
    window.dispatchEvent(new Event('pointerdown'));
    window.dispatchEvent(new Event('pointerdown'));
    expect(audio.unlock).toHaveBeenCalledTimes(1);
  });
});
