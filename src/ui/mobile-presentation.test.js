// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { EventBus, Events } from '../core/event-bus.js';
import { initMobilePresentation } from './mobile-presentation.js';

describe('mobile presentation', () => {
  it('blocks and pauses only gameplay in portrait', () => {
    document.body.innerHTML = '<main id="app"></main><div class="orientation-warning"><button></button></div>';
    const listeners = new Set();
    window.matchMedia = vi.fn(() => ({
      matches: true,
      addEventListener: (_name, callback) => listeners.add(callback),
      removeEventListener: (_name, callback) => listeners.delete(callback),
    }));
    const bus = new EventBus();
    const pause = vi.fn();
    const cleanup = initMobilePresentation({
      bus,
      isTouch: true,
      pause,
      resetInput: vi.fn(),
      goToMenu: vi.fn(),
    });

    bus.emit(Events.SCENE_CHANGED, { name: 'menu' });
    expect(document.body.classList.contains('needs-landscape')).toBe(false);
    expect(pause).not.toHaveBeenCalled();

    bus.emit(Events.SCENE_CHANGED, { name: 'game' });
    expect(document.body.classList.contains('needs-landscape')).toBe(true);
    expect(document.getElementById('app').inert).toBe(true);
    expect(pause).toHaveBeenCalledTimes(1);

    cleanup();
  });

  it('marks the body as playing only while gameplay accepts movement', () => {
    document.body.innerHTML = '<main id="app"></main>';
    window.matchMedia = vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    const bus = new EventBus();
    const cleanup = initMobilePresentation({ bus, isTouch: () => true, pause: vi.fn(), resetInput: vi.fn(), goToMenu: vi.fn() });
    bus.emit(Events.INPUT_MODE_CHANGED, { playing: true });
    expect(document.body.dataset.inputMode).toBe('playing');
    bus.emit(Events.INPUT_MODE_CHANGED, { playing: false });
    expect(document.body.dataset.inputMode).toBe('ui');
    cleanup();
    expect(document.body.dataset.inputMode).toBeUndefined();
  });
});
